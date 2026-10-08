import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SupabaseService } from '../core/supabase.service';
import { ToastService } from '../core/toast.service';
import { CopPipe, FechaPipe } from '../shared/pipes';

interface Resumen {
  ventas_mes: number;
  costo_mes: number;
  utilidad_bruta_mes: number;
  gastos_mes: number;
  utilidad_neta_mes: number;
  recaudo_mes: number;
  por_cobrar: number;
  vencido: number;
  clientes_en_mora: number;
  cobros_hoy: number;
  cobros_hoy_valor: number;
  por_pedir: number;
  compras_por_pagar: number;
  ultimas_ventas: { id: number; numero: string; cliente_nombre: string; fecha_emision: string; total: number; saldo: number; estado_cobro: string }[];
}

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, CopPipe, FechaPipe],
  template: `
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
      <h2 class="mb-0">Resumen del mes</h2>
      <a routerLink="/admin/ventas/nueva" class="btn btn-primary"><i class="bi bi-plus-lg"></i> Nueva venta</a>
    </div>

    @if (r(); as r) {
      <div class="row g-3 mb-4">
        <div class="col-6 col-xl-3"><div class="card kpi p-3"><div class="kpi-label">Ventas del mes</div><div class="kpi-valor">{{ r.ventas_mes | cop }}</div></div></div>
        <div class="col-6 col-xl-3"><div class="card kpi exito p-3"><div class="kpi-label">Ganancia neta</div><div class="kpi-valor">{{ r.utilidad_neta_mes | cop }}</div>
          <small class="text-muted">Bruta {{ r.utilidad_bruta_mes | cop }} · Gastos {{ r.gastos_mes | cop }}</small></div></div>
        <div class="col-6 col-xl-3"><div class="card kpi p-3"><div class="kpi-label">Recaudado este mes</div><div class="kpi-valor">{{ r.recaudo_mes | cop }}</div></div></div>
        <div class="col-6 col-xl-3"><div class="card kpi p-3"><div class="kpi-label">Me deben (total)</div><div class="kpi-valor">{{ r.por_cobrar | cop }}</div></div></div>
        <div class="col-6 col-xl-3">
          <a routerLink="/admin/cartera" class="text-decoration-none"><div class="card kpi peligro p-3"><div class="kpi-label">En mora</div><div class="kpi-valor">{{ r.vencido | cop }}</div>
            <small class="text-muted">{{ r.clientes_en_mora }} cliente(s)</small></div></a>
        </div>
        <div class="col-6 col-xl-3">
          <a routerLink="/admin/cartera" class="text-decoration-none"><div class="card kpi p-3"><div class="kpi-label">Cobros para hoy</div><div class="kpi-valor">{{ r.cobros_hoy }}</div>
            <small class="text-muted">{{ r.cobros_hoy_valor | cop }}</small></div></a>
        </div>
        <div class="col-6 col-xl-3">
          <a routerLink="/admin/inventario" class="text-decoration-none"><div class="card kpi p-3"><div class="kpi-label">Unidades por pedir</div><div class="kpi-valor">{{ r.por_pedir }}</div>
            <small class="text-muted">Vendidas por encargo</small></div></a>
        </div>
        <div class="col-6 col-xl-3"><div class="card kpi p-3"><div class="kpi-label">Debo a proveedores</div><div class="kpi-valor">{{ r.compras_por_pagar | cop }}</div></div></div>
      </div>

      <div class="card">
        <div class="card-header bg-white d-flex justify-content-between">
          <strong>Últimas ventas</strong><a routerLink="/admin/ventas" class="small">Ver todas</a>
        </div>
        <div class="table-responsive">
          <table class="table table-hover mb-0">
            <thead><tr><th>Factura</th><th>Cliente</th><th>Fecha</th><th class="text-end">Total</th><th class="text-end">Saldo</th><th>Estado</th></tr></thead>
            <tbody>
              @for (v of r.ultimas_ventas; track v.id) {
                <tr role="button" [routerLink]="['/admin/ventas', v.id]">
                  <td class="fw-semibold">{{ v.numero }}</td><td>{{ v.cliente_nombre }}</td><td>{{ v.fecha_emision | fecha }}</td>
                  <td class="text-end">{{ v.total | cop }}</td><td class="text-end">{{ v.saldo | cop }}</td>
                  <td><span [class]="'estado-' + v.estado_cobro">{{ v.estado_cobro.replace('_', ' ') }}</span></td>
                </tr>
              } @empty {
                <tr><td colspan="6" class="text-center text-muted py-4">Aún no hay ventas.</td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    } @else {
      <div class="text-center py-5"><div class="spinner-border text-secondary"></div></div>
    }
  `,
})
export class Dashboard implements OnInit {
  private sb = inject(SupabaseService);
  private toast = inject(ToastService);
  r = signal<Resumen | null>(null);

  async ngOnInit() {
    try {
      this.r.set(await this.sb.rpc<Resumen>('sel_dashboard'));
    } catch (e) {
      this.toast.error(e);
    }
  }
}

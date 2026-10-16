import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SupabaseService } from '../core/supabase.service';
import { ToastService } from '../core/toast.service';
import { FacturaVenta } from '../core/models';
import { hoyISO, primerDiaMes } from '../core/utils';
import { CopPipe, FechaPipe, EstadoPipe } from '../shared/pipes';

@Component({
  selector: 'app-ventas',
  imports: [FormsModule, RouterLink, CopPipe, FechaPipe, EstadoPipe],
  template: `
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <h2 class="mb-0">Facturas de venta</h2>
      <a routerLink="/admin/ventas/nueva" class="btn btn-primary"><i class="bi bi-plus-lg"></i> Nueva factura</a>
    </div>

    <div class="row g-2 mb-3">
      <div class="col-6 col-md-2"><label class="form-label small mb-0">Desde</label><input type="date" class="form-control" [(ngModel)]="desde" /></div>
      <div class="col-6 col-md-2"><label class="form-label small mb-0">Hasta</label><input type="date" class="form-control" [(ngModel)]="hasta" /></div>
      <div class="col-6 col-md-3">
        <label class="form-label small mb-0">Estado</label>
        <select class="form-select" [(ngModel)]="estado">
          <option value="">Todos</option><option value="pagada">Pagadas</option><option value="al_dia">Pendientes al día</option>
          <option value="en_mora">En mora</option><option value="anulada">Anuladas</option>
        </select>
      </div>
      <div class="col-6 col-md-3"><label class="form-label small mb-0">Buscar</label><input class="form-control" placeholder="N°, cliente, tel." [(ngModel)]="busqueda" (keyup.enter)="cargar()" /></div>
      <div class="col-md-2 d-flex align-items-end"><button class="btn btn-outline-primary w-100" (click)="cargar()"><i class="bi bi-funnel"></i> Filtrar</button></div>
    </div>

    <div class="row g-3 mb-3">
      <div class="col-4"><div class="card kpi p-2 px-3"><div class="kpi-label">Facturado</div><div class="fw-semibold">{{ totales().total | cop }}</div></div></div>
      <div class="col-4"><div class="card kpi exito p-2 px-3"><div class="kpi-label">Pagado</div><div class="fw-semibold">{{ totales().pagado | cop }}</div></div></div>
      <div class="col-4"><div class="card kpi peligro p-2 px-3"><div class="kpi-label">Saldo</div><div class="fw-semibold">{{ totales().saldo | cop }}</div></div></div>
    </div>

    <div class="card">
      <div class="table-responsive">
        <table class="table table-hover mb-0">
          <thead>
            <tr><th>N°</th><th>Cliente</th><th>Emisión</th><th>Próx. cobro</th><th>Pago</th><th class="text-end">Total</th><th class="text-end">Saldo</th><th>Estado</th></tr>
          </thead>
          <tbody>
            @for (f of facturas(); track f.id) {
              <tr role="button" [routerLink]="['/admin/ventas', f.id]">
                <td class="fw-semibold">{{ f.numero }}</td>
                <td>{{ f.cliente_nombre }}<div class="small text-muted">{{ f.telefono_cobro }}</div></td>
                <td>{{ f.fecha_emision | fecha }}</td>
                <td>{{ f.proxima_fecha | fecha }}</td>
                <td class="text-capitalize">{{ f.tipo_pago }}</td>
                <td class="text-end">{{ f.total | cop }}</td>
                <td class="text-end">{{ f.saldo | cop }}</td>
                <td>
                  <span [class]="'estado-' + f.estado_cobro">{{ f.estado_cobro | estado }}</span>
                  @if (f.dias_mora > 0) { <div class="small text-danger">{{ f.dias_mora }} días</div> }
                </td>
              </tr>
            } @empty {
              <tr><td colspan="8" class="text-center text-muted py-4">No hay facturas en este rango.</td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class Ventas implements OnInit {
  private sb = inject(SupabaseService);
  private toast = inject(ToastService);
  facturas = signal<FacturaVenta[]>([]);
  desde = primerDiaMes();
  hasta = hoyISO();
  estado = '';
  busqueda = '';

  totales = computed(() => {
    const v = this.facturas().filter((f) => f.estado !== 'anulada');
    return {
      total: v.reduce((a, f) => a + Number(f.total), 0),
      pagado: v.reduce((a, f) => a + Number(f.total_pagado), 0),
      saldo: v.reduce((a, f) => a + Number(f.saldo), 0),
    };
  });

  ngOnInit() {
    this.cargar();
  }

  async cargar() {
    try {
      this.facturas.set(
        await this.sb.rpc('sel_facturas_venta', {
          p_desde: this.desde || null,
          p_hasta: this.hasta || null,
          p_estado_cobro: this.estado || null,
          p_busqueda: this.busqueda || null,
        }),
      );
    } catch (e) {
      this.toast.error(e);
    }
  }
}

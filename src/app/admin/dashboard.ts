import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SupabaseService } from '../core/supabase.service';
import { ToastService } from '../core/toast.service';
import { InformeMes } from '../core/models';
import { MESES } from '../core/utils';
import { CopPipe, FechaPipe, EstadoPipe } from '../shared/pipes';
import { GraficaBarras, SerieGrafica } from '../shared/grafica-barras';

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
  imports: [RouterLink, CopPipe, FechaPipe, GraficaBarras, EstadoPipe],
  template: `
    <div class="page-head">
      <div>
        <h2>{{ saludo }}</h2>
        <div class="sub">Así va {{ mesActual }}.</div>
      </div>
    </div>

    @if (r(); as r) {
      <div class="row g-3 mb-3">
        <div class="col-6 col-xl-3"><div class="card kpi p-3"><span class="kpi-icono"><i class="bi bi-receipt"></i></span><div class="kpi-label">Ventas del mes</div><div class="kpi-valor">{{ r.ventas_mes | cop }}</div><div class="kpi-nota">Costo {{ r.costo_mes | cop }}</div></div></div>
        <div class="col-6 col-xl-3"><div class="card kpi p-3" [class.exito]="r.utilidad_neta_mes >= 0" [class.peligro]="r.utilidad_neta_mes < 0"><span class="kpi-icono"><i class="bi bi-piggy-bank"></i></span><div class="kpi-label">Utilidad neta</div><div class="kpi-valor">{{ r.utilidad_neta_mes | cop }}</div><div class="kpi-nota">Margen {{ margen() }}% · gastos {{ r.gastos_mes | cop }}</div></div></div>
        <div class="col-6 col-xl-3"><div class="card kpi info p-3"><span class="kpi-icono"><i class="bi bi-cash-stack"></i></span><div class="kpi-label">Recaudado este mes</div><div class="kpi-valor">{{ r.recaudo_mes | cop }}</div><div class="kpi-nota">Contado + abonos</div></div></div>
        <div class="col-6 col-xl-3"><a routerLink="/admin/cartera" class="text-decoration-none"><div class="card kpi p-3"><span class="kpi-icono"><i class="bi bi-wallet2"></i></span><div class="kpi-label">Me deben</div><div class="kpi-valor">{{ r.por_cobrar | cop }}</div><div class="kpi-nota">Cartera total pendiente</div></div></a></div>
      </div>

      <div class="row g-3 mb-3">
        <div class="col-lg-5">
          <div class="card h-100">
            <div class="card-header"><strong>Pendientes</strong><div class="small text-tenue">Lo que necesita tu atención</div></div>
            <a routerLink="/admin/cartera" class="alerta-fila">
              <span class="punto" [style.background]="r.cobros_hoy ? '#b7791f' : '#d8cfc2'"></span>
              <div class="flex-grow-1"><div class="fw-medium">Cobros para hoy</div><small class="text-tenue">{{ r.cobros_hoy }} cuota(s)</small></div>
              <strong class="cifra">{{ r.cobros_hoy_valor | cop }}</strong><i class="bi bi-chevron-right text-tenue"></i>
            </a>
            <a routerLink="/admin/cartera" class="alerta-fila">
              <span class="punto" [style.background]="r.vencido ? '#a8352a' : '#d8cfc2'"></span>
              <div class="flex-grow-1"><div class="fw-medium">Cartera en mora</div><small class="text-tenue">{{ r.clientes_en_mora }} cliente(s) atrasados</small></div>
              <strong class="cifra" [class.text-danger]="r.vencido > 0">{{ r.vencido | cop }}</strong><i class="bi bi-chevron-right text-tenue"></i>
            </a>
            <a routerLink="/admin/inventario" class="alerta-fila">
              <span class="punto" [style.background]="r.por_pedir ? '#2c6fb8' : '#d8cfc2'"></span>
              <div class="flex-grow-1"><div class="fw-medium">Unidades por pedir</div><small class="text-tenue">Vendidas por encargo</small></div>
              <strong class="cifra">{{ r.por_pedir }}</strong><i class="bi bi-chevron-right text-tenue"></i>
            </a>
            <a routerLink="/admin/compras" class="alerta-fila">
              <span class="punto" [style.background]="r.compras_por_pagar ? '#8c6a35' : '#d8cfc2'"></span>
              <div class="flex-grow-1"><div class="fw-medium">Debo a proveedores</div><small class="text-tenue">Compras a crédito</small></div>
              <strong class="cifra">{{ r.compras_por_pagar | cop }}</strong><i class="bi bi-chevron-right text-tenue"></i>
            </a>
          </div>
        </div>
        <div class="col-lg-7">
          <div class="card h-100">
            <div class="card-header d-flex justify-content-between align-items-center">
              <strong>Ventas y utilidad {{ anio }}</strong><a routerLink="/admin/informes" class="small">Ver informes</a>
            </div>
            <div class="card-body"><app-grafica-barras titulo="Ventas y utilidad neta por mes" [etiquetas]="mesesCortos" [etiquetasLargas]="meses" [series]="series()" [alto]="200" /></div>
          </div>
        </div>
      </div>

      <div class="row g-2 g-md-3 mb-3">
        <div class="col-6 col-lg-3"><a routerLink="/admin/ventas/nueva" class="accion-rapida"><i class="bi bi-receipt-cutoff"></i><span><strong>Nueva venta</strong><small>Facturar a un cliente</small></span></a></div>
        <div class="col-6 col-lg-3"><a routerLink="/admin/compras/nueva" class="accion-rapida"><i class="bi bi-truck"></i><span><strong>Registrar compra</strong><small>Entrada de mercancía</small></span></a></div>
        <div class="col-6 col-lg-3"><a routerLink="/admin/gastos" class="accion-rapida"><i class="bi bi-wallet2"></i><span><strong>Registrar gasto</strong><small>Envíos, publicidad…</small></span></a></div>
        <div class="col-6 col-lg-3"><a routerLink="/admin/productos" class="accion-rapida"><i class="bi bi-droplet-half"></i><span><strong>Productos</strong><small>Precios y fotos</small></span></a></div>
      </div>

      <div class="card">
        <div class="card-header d-flex justify-content-between align-items-center">
          <strong>Últimas ventas</strong><a routerLink="/admin/ventas" class="small">Ver todas</a>
        </div>
        <div class="list-group list-group-flush d-md-none">
          @for (v of r.ultimas_ventas; track v.id) {
            <a class="list-group-item list-group-item-action d-flex justify-content-between align-items-center gap-2" [routerLink]="['/admin/ventas', v.id]">
              <div style="min-width: 0"><div class="fw-medium text-truncate">{{ v.cliente_nombre }}</div><small class="text-tenue">{{ v.numero }} · {{ v.fecha_emision | fecha }}</small></div>
              <div class="text-end"><div class="fw-semibold cifra">{{ v.total | cop }}</div><span [class]="'estado-' + v.estado_cobro">{{ v.estado_cobro | estado }}</span></div>
            </a>
          } @empty { <div class="list-group-item text-center text-tenue py-4">Aún no hay ventas. <a routerLink="/admin/ventas/nueva">Registra la primera</a>.</div> }
        </div>
        <div class="table-responsive d-none d-md-block">
          <table class="table table-hover">
            <thead><tr><th>Factura</th><th>Cliente</th><th>Fecha</th><th class="text-end">Total</th><th class="text-end">Saldo</th><th>Estado</th></tr></thead>
            <tbody>
              @for (v of r.ultimas_ventas; track v.id) {
                <tr role="button" [routerLink]="['/admin/ventas', v.id]">
                  <td class="fw-semibold">{{ v.numero }}</td><td>{{ v.cliente_nombre }}</td><td>{{ v.fecha_emision | fecha }}</td>
                  <td class="text-end">{{ v.total | cop }}</td><td class="text-end">{{ v.saldo | cop }}</td>
                  <td><span [class]="'estado-' + v.estado_cobro">{{ v.estado_cobro | estado }}</span></td>
                </tr>
              } @empty {
                <tr><td colspan="6" class="text-center text-tenue py-4">Aún no hay ventas. <a routerLink="/admin/ventas/nueva">Registra la primera</a>.</td></tr>
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
  anual = signal<InformeMes[]>([]);
  anio = new Date().getFullYear();
  meses = MESES;
  mesesCortos = MESES.map((m) => m.slice(0, 3));
  mesActual = MESES[new Date().getMonth()].toLowerCase();
  saludo = (() => {
    const h = new Date().getHours();
    return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  })();

  margen = computed(() => {
    const r = this.r();
    return r && Number(r.ventas_mes) ? ((Number(r.utilidad_neta_mes) / Number(r.ventas_mes)) * 100).toFixed(1) : '0';
  });

  series = computed<SerieGrafica[]>(() => [
    { nombre: 'Ventas', valores: this.anual().map((m) => Number(m.ventas)), color: '#c08a2e' },
    { nombre: 'Utilidad neta', valores: this.anual().map((m) => Number(m.utilidad_neta)), color: '#2c6fb8' },
  ]);

  async ngOnInit() {
    try {
      const [r, anual] = await Promise.all([
        this.sb.rpc<Resumen>('sel_dashboard'),
        this.sb.rpc<InformeMes[]>('sel_informe_mensual', { p_anio: this.anio }),
      ]);
      this.r.set(r);
      this.anual.set(anual ?? []);
    } catch (e) {
      this.toast.error(e);
    }
  }
}

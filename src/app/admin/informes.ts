import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../core/supabase.service';
import { ToastService } from '../core/toast.service';
import { InformeMes } from '../core/models';
import { MESES, hoyISO, primerDiaMes } from '../core/utils';
import { CopPipe, TipoPipe } from '../shared/pipes';

interface InformeProducto {
  producto: string;
  tipo: string;
  mililitros: number;
  unidades: number;
  ventas: number;
  costo: number;
  utilidad: number;
}

@Component({
  selector: 'app-informes',
  imports: [FormsModule, CopPipe, TipoPipe],
  template: `
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <h2 class="mb-0">Informes</h2>
      <div class="d-flex gap-2 no-print">
        <select class="form-select" style="width: 120px" [(ngModel)]="anio" (change)="cargarAnio()">
          @for (a of anios; track a) { <option [ngValue]="a">{{ a }}</option> }
        </select>
        <button class="btn btn-outline-primary" (click)="imprimir()"><i class="bi bi-printer"></i></button>
      </div>
    </div>

    <div class="row g-3 mb-3">
      <div class="col-6 col-lg-3"><div class="card kpi p-3"><div class="kpi-label">Ventas {{ anio }}</div><div class="kpi-valor">{{ tot().ventas | cop }}</div></div></div>
      <div class="col-6 col-lg-3"><div class="card kpi p-3"><div class="kpi-label">Costo de ventas</div><div class="kpi-valor">{{ tot().costo_ventas | cop }}</div></div></div>
      <div class="col-6 col-lg-3"><div class="card kpi p-3"><div class="kpi-label">Gastos</div><div class="kpi-valor">{{ tot().gastos | cop }}</div></div></div>
      <div class="col-6 col-lg-3"><div class="card kpi exito p-3"><div class="kpi-label">Ganancia neta</div><div class="kpi-valor">{{ tot().utilidad_neta | cop }}</div></div></div>
    </div>

    <div class="card mb-4">
      <div class="card-header bg-white"><strong>Ventas, gastos y ganancias por mes</strong></div>
      <div class="table-responsive">
        <table class="table table-sm table-hover mb-0">
          <thead>
            <tr>
              <th>Mes</th><th class="text-end">Ventas</th><th class="text-end">Contado</th><th class="text-end">Financiado</th>
              <th class="text-end">Costo</th><th class="text-end">Ganancia bruta</th><th class="text-end">Gastos</th>
              <th class="text-end">Ganancia neta</th><th class="text-end">Recaudado</th><th class="text-end">Compras</th><th style="width: 120px"></th>
            </tr>
          </thead>
          <tbody>
            @for (m of meses(); track m.mes) {
              <tr [class.text-muted]="!m.ventas && !m.gastos && !m.compras">
                <td>{{ nombreMes(m.mes) }}</td>
                <td class="text-end fw-semibold">{{ m.ventas | cop }}</td>
                <td class="text-end">{{ m.ventas_contado | cop }}</td>
                <td class="text-end">{{ m.ventas_financiado | cop }}</td>
                <td class="text-end">{{ m.costo_ventas | cop }}</td>
                <td class="text-end">{{ m.utilidad_bruta | cop }}</td>
                <td class="text-end">{{ m.gastos | cop }}</td>
                <td class="text-end fw-semibold" [class.text-danger]="m.utilidad_neta < 0" [class.text-success]="m.utilidad_neta > 0">{{ m.utilidad_neta | cop }}</td>
                <td class="text-end">{{ m.recaudo | cop }}</td>
                <td class="text-end">{{ m.compras | cop }}</td>
                <td><div class="barra-informe" [style.width.%]="maxVentas() ? (m.ventas / maxVentas()) * 100 : 0"></div></td>
              </tr>
            }
          </tbody>
          <tfoot class="fw-semibold">
            <tr>
              <td>Total</td>
              <td class="text-end">{{ tot().ventas | cop }}</td><td class="text-end">{{ tot().ventas_contado | cop }}</td><td class="text-end">{{ tot().ventas_financiado | cop }}</td>
              <td class="text-end">{{ tot().costo_ventas | cop }}</td><td class="text-end">{{ tot().utilidad_bruta | cop }}</td><td class="text-end">{{ tot().gastos | cop }}</td>
              <td class="text-end">{{ tot().utilidad_neta | cop }}</td><td class="text-end">{{ tot().recaudo | cop }}</td><td class="text-end">{{ tot().compras | cop }}</td><td></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div class="card-footer bg-white small text-muted">
        Ganancia bruta = ventas − costo de lo vendido. Ganancia neta = bruta − gastos. Recaudado = dinero recibido (contado + abonos) en el mes.
      </div>
    </div>

    <div class="card">
      <div class="card-header bg-white d-flex flex-wrap gap-2 align-items-center">
        <strong class="me-auto">Productos más vendidos</strong>
        <input type="date" class="form-control form-control-sm" style="width: 150px" [(ngModel)]="desde" />
        <input type="date" class="form-control form-control-sm" style="width: 150px" [(ngModel)]="hasta" />
        <button class="btn btn-sm btn-outline-primary" (click)="cargarProductos()">Ver</button>
      </div>
      <div class="table-responsive">
        <table class="table table-sm mb-0">
          <thead><tr><th>Producto</th><th>Tipo</th><th>Ml</th><th class="text-center">Unid.</th><th class="text-end">Ventas</th><th class="text-end">Costo</th><th class="text-end">Ganancia</th></tr></thead>
          <tbody>
            @for (p of productos(); track $index) {
              <tr><td>{{ p.producto }}</td><td>{{ p.tipo | tipo }}</td><td>{{ p.mililitros }}</td><td class="text-center">{{ p.unidades }}</td>
                <td class="text-end">{{ p.ventas | cop }}</td><td class="text-end">{{ p.costo | cop }}</td><td class="text-end fw-semibold">{{ p.utilidad | cop }}</td></tr>
            } @empty { <tr><td colspan="7" class="text-center text-muted py-3">Sin ventas en el rango.</td></tr> }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class Informes implements OnInit {
  private sb = inject(SupabaseService);
  private toast = inject(ToastService);
  anio = new Date().getFullYear();
  anios = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
  desde = primerDiaMes();
  hasta = hoyISO();
  meses = signal<InformeMes[]>([]);
  productos = signal<InformeProducto[]>([]);

  maxVentas = computed(() => Math.max(0, ...this.meses().map((m) => Number(m.ventas))));
  tot = computed(() => {
    const campos = ['ventas', 'ventas_contado', 'ventas_financiado', 'costo_ventas', 'utilidad_bruta', 'gastos', 'utilidad_neta', 'recaudo', 'compras'] as const;
    const r = {} as Record<(typeof campos)[number], number>;
    for (const c of campos) r[c] = this.meses().reduce((a, m) => a + Number(m[c]), 0);
    return r;
  });

  ngOnInit() {
    this.cargarAnio();
    this.cargarProductos();
  }

  nombreMes(n: number) {
    return MESES[n - 1];
  }

  async cargarAnio() {
    try {
      this.meses.set(await this.sb.rpc('sel_informe_mensual', { p_anio: this.anio }));
    } catch (e) {
      this.toast.error(e);
    }
  }

  async cargarProductos() {
    try {
      this.productos.set(await this.sb.rpc('sel_informe_productos', { p_desde: this.desde || null, p_hasta: this.hasta || null }));
    } catch (e) {
      this.toast.error(e);
    }
  }

  imprimir() {
    window.print();
  }
}

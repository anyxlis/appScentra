import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SupabaseService } from '../core/supabase.service';
import { ToastService } from '../core/toast.service';
import { FacturaCompra, Proveedor } from '../core/models';
import { hoyISO, primerDiaMes } from '../core/utils';
import { ModalComponent } from '../shared/modal.component';
import { CopPipe, FechaPipe, TipoPipe } from '../shared/pipes';

@Component({
  selector: 'app-compras',
  imports: [FormsModule, RouterLink, ModalComponent, CopPipe, FechaPipe, TipoPipe],
  template: `
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <h2 class="mb-0">Facturas de compra</h2>
      <a routerLink="/admin/compras/nueva" class="btn btn-primary"><i class="bi bi-plus-lg"></i> Nueva compra</a>
    </div>

    <div class="row g-2 mb-3">
      <div class="col-6 col-md-3"><label class="form-label small mb-0">Desde</label><input type="date" class="form-control" [(ngModel)]="desde" /></div>
      <div class="col-6 col-md-3"><label class="form-label small mb-0">Hasta</label><input type="date" class="form-control" [(ngModel)]="hasta" /></div>
      <div class="col-8 col-md-4">
        <label class="form-label small mb-0">Proveedor</label>
        <select class="form-select" [(ngModel)]="proveedorId">
          <option [ngValue]="null">Todos</option>
          @for (p of proveedores(); track p.id) { <option [ngValue]="p.id">{{ p.nombre }}</option> }
        </select>
      </div>
      <div class="col-4 col-md-2 d-flex align-items-end"><button class="btn btn-outline-primary w-100" (click)="cargar()">Filtrar</button></div>
    </div>

    <div class="card kpi p-2 px-3 mb-3" style="max-width: 260px"><div class="kpi-label">Total compras</div><div class="fw-semibold">{{ total() | cop }}</div></div>

    <div class="card">
      <div class="table-responsive">
        <table class="table table-hover mb-0">
          <thead><tr><th>Fecha</th><th>Proveedor</th><th>N° factura</th><th class="text-center">Unid.</th><th class="text-end">Total</th><th>Pago</th><th></th></tr></thead>
          <tbody>
            @for (c of compras(); track c.id) {
              <tr>
                <td>{{ c.fecha | fecha }}</td>
                <td class="fw-semibold">{{ c.proveedor }}</td>
                <td>{{ c.numero_factura }}</td>
                <td class="text-center">{{ c.unidades }}</td>
                <td class="text-end">{{ c.total | cop }}</td>
                <td>
                  <button class="btn btn-sm" [class]="c.pagada ? 'btn-outline-success' : 'btn-outline-danger'" (click)="cambiarPago(c)" title="Cambiar estado">
                    {{ c.pagada ? 'Pagada' : 'Por pagar' }}
                  </button>
                  @if (!c.pagada && c.fecha_vencimiento) { <div class="small text-muted">vence {{ c.fecha_vencimiento | fecha }}</div> }
                </td>
                <td class="text-end text-nowrap">
                  <button class="btn btn-sm btn-outline-secondary me-1" (click)="ver(c)"><i class="bi bi-eye"></i></button>
                  <button class="btn btn-sm btn-outline-danger" (click)="eliminar(c)"><i class="bi bi-trash"></i></button>
                </td>
              </tr>
            } @empty { <tr><td colspan="7" class="text-center text-muted py-4">No hay compras en este rango.</td></tr> }
          </tbody>
        </table>
      </div>
    </div>

    @if (detalle(); as d) {
      <app-modal [titulo]="'Compra #' + d.id + (d.numero_factura ? ' · ' + d.numero_factura : '')" (cerrar)="detalle.set(null)">
        <p class="small text-muted mb-2">{{ d.fecha | fecha }} · {{ $any(d.proveedor)?.nombre }} · {{ d.tipo_pago }}</p>
        <table class="table table-sm">
          <thead><tr><th>Producto</th><th>Ml</th><th class="text-center">Cant.</th><th class="text-end">Costo</th><th class="text-end">P. venta</th><th class="text-end">Subtotal</th></tr></thead>
          <tbody>
            @for (x of d.detalle; track x.id) {
              <tr><td>{{ x.producto }} <small class="text-muted">({{ x.tipo | tipo }})</small></td><td>{{ x.mililitros }}</td><td class="text-center">{{ x.cantidad }}</td>
                <td class="text-end">{{ x.costo_unitario | cop }}</td><td class="text-end">{{ x.precio_venta | cop }}</td><td class="text-end">{{ x.subtotal | cop }}</td></tr>
            }
          </tbody>
          <tfoot><tr><th colspan="5" class="text-end">Total</th><th class="text-end">{{ d.total | cop }}</th></tr></tfoot>
        </table>
        @if (d.notas) { <p class="small">Notas: {{ d.notas }}</p> }
        <ng-container pie><button class="btn btn-light" (click)="detalle.set(null)">Cerrar</button></ng-container>
      </app-modal>
    }
  `,
})
export class Compras implements OnInit {
  private sb = inject(SupabaseService);
  private toast = inject(ToastService);
  compras = signal<FacturaCompra[]>([]);
  proveedores = signal<Proveedor[]>([]);
  detalle = signal<FacturaCompra | null>(null);
  desde = primerDiaMes();
  hasta = hoyISO();
  proveedorId: number | null = null;
  total = computed(() => this.compras().reduce((a, c) => a + Number(c.total), 0));

  async ngOnInit() {
    this.cargar();
    try {
      this.proveedores.set(await this.sb.rpc('sel_proveedores'));
    } catch {
      /* */
    }
  }

  async cargar() {
    try {
      this.compras.set(
        await this.sb.rpc('sel_facturas_compra', { p_desde: this.desde || null, p_hasta: this.hasta || null, p_proveedor_id: this.proveedorId }),
      );
    } catch (e) {
      this.toast.error(e);
    }
  }

  async ver(c: FacturaCompra) {
    try {
      this.detalle.set(await this.sb.rpc('sel_factura_compra', { p_id: c.id }));
    } catch (e) {
      this.toast.error(e);
    }
  }

  async cambiarPago(c: FacturaCompra) {
    try {
      await this.sb.rpc('actualizar_estado_compra', { p_id: c.id, p_pagada: !c.pagada });
      this.cargar();
    } catch (e) {
      this.toast.error(e);
    }
  }

  async eliminar(c: FacturaCompra) {
    if (!confirm('¿Eliminar esta compra? Se descontarán las unidades del inventario.')) return;
    try {
      await this.sb.rpc('eliminar_factura_compra', { p_id: c.id });
      this.toast.ok('Compra eliminada');
      this.cargar();
    } catch (e) {
      this.toast.error(e);
    }
  }
}

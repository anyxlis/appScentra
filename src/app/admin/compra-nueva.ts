import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../core/supabase.service';
import { ToastService } from '../core/toast.service';
import { InventarioItem, Proveedor } from '../core/models';
import { hoyISO } from '../core/utils';
import { CopPipe, TipoPipe } from '../shared/pipes';

interface LineaCompra {
  presentacion_id: number | null;
  cantidad: number;
  costo_unitario: number;
  precio_venta: number;
}

@Component({
  selector: 'app-compra-nueva',
  imports: [FormsModule, RouterLink, CopPipe, TipoPipe],
  template: `
    <div class="d-flex align-items-center gap-2 mb-3">
      <a routerLink="/admin/compras" class="btn btn-sm btn-light"><i class="bi bi-arrow-left"></i></a>
      <h2 class="mb-0">Nueva factura de compra</h2>
    </div>

    <div class="card mb-3">
      <div class="card-body row g-2">
        <div class="col-md-4">
          <label class="form-label small">Proveedor *</label>
          <select class="form-select" [(ngModel)]="proveedorId">
            <option [ngValue]="null">Selecciona...</option>
            @for (p of proveedores(); track p.id) { <option [ngValue]="p.id">{{ p.nombre }}</option> }
          </select>
          <a routerLink="/admin/proveedores" class="small">+ Crear proveedor</a>
        </div>
        <div class="col-6 col-md-2"><label class="form-label small">N° factura proveedor</label><input class="form-control" [(ngModel)]="numero" /></div>
        <div class="col-6 col-md-2"><label class="form-label small">Fecha</label><input type="date" class="form-control" [(ngModel)]="fecha" /></div>
        <div class="col-6 col-md-2">
          <label class="form-label small">Pago</label>
          <select class="form-select" [(ngModel)]="tipoPago">
            <option value="contado">Contado (pagada)</option><option value="credito">Crédito (por pagar)</option>
          </select>
        </div>
        @if (tipoPago === 'credito') {
          <div class="col-6 col-md-2"><label class="form-label small">Vence</label><input type="date" class="form-control" [(ngModel)]="vence" /></div>
        }
      </div>
    </div>

    <div class="card mb-3">
      <div class="card-header bg-white d-flex justify-content-between align-items-center">
        <strong>Productos comprados</strong>
        <button class="btn btn-sm btn-outline-primary" (click)="agregarLinea()"><i class="bi bi-plus"></i> Agregar línea</button>
      </div>
      <div class="card-body">
        @for (l of lineas; track $index) {
          <div class="row g-2 align-items-end mb-2 pb-2 border-bottom">
            <div class="col-md-5">
              <label class="form-label small mb-0">Producto</label>
              <select class="form-select" [(ngModel)]="l.presentacion_id" (ngModelChange)="elegir(l, $event)">
                <option [ngValue]="null">Selecciona...</option>
                @for (i of inventario(); track i.presentacion_id) {
                  <option [ngValue]="i.presentacion_id">{{ i.producto }} · {{ i.tipo | tipo }} {{ i.mililitros }} ml {{ i.por_pedir > 0 ? '· pedir ' + i.por_pedir : '' }}</option>
                }
              </select>
            </div>
            <div class="col-4 col-md-2"><label class="form-label small mb-0">Cant.</label><input type="number" min="1" class="form-control" [(ngModel)]="l.cantidad" /></div>
            <div class="col-4 col-md-2"><label class="form-label small mb-0">Valor compra (unit.)</label><input type="number" min="0" class="form-control" [(ngModel)]="l.costo_unitario" /></div>
            <div class="col-4 col-md-2"><label class="form-label small mb-0">Valor venta</label><input type="number" min="0" class="form-control" [(ngModel)]="l.precio_venta" /></div>
            <div class="col-md-1 text-end">
              <button class="btn btn-link text-danger" (click)="lineas.splice($index, 1)" [disabled]="lineas.length === 1"><i class="bi bi-trash"></i></button>
            </div>
            @if (l.precio_venta > 0 && l.costo_unitario > 0) {
              <div class="col-12 small text-muted">Margen: {{ l.precio_venta - l.costo_unitario | cop }} ({{ ((l.precio_venta - l.costo_unitario) / l.precio_venta * 100).toFixed(1) }}%)</div>
            }
          </div>
        }
        <div class="text-end fs-5 mt-3">Total: <strong class="text-primary">{{ total | cop }}</strong></div>
      </div>
    </div>

    <div class="card mb-3"><div class="card-body"><label class="form-label small">Notas</label><textarea class="form-control" rows="2" [(ngModel)]="notas"></textarea></div></div>

    <div class="d-flex gap-2 justify-content-end">
      <button class="btn btn-outline-secondary" (click)="cargarPorPedir()"><i class="bi bi-list-check"></i> Cargar lo que está por pedir</button>
      <button class="btn btn-primary btn-lg" (click)="guardar()" [disabled]="guardando()">Guardar compra</button>
    </div>
  `,
})
export class CompraNueva implements OnInit {
  private sb = inject(SupabaseService);
  private toast = inject(ToastService);
  private router = inject(Router);
  proveedores = signal<Proveedor[]>([]);
  inventario = signal<InventarioItem[]>([]);
  guardando = signal(false);

  proveedorId: number | null = null;
  numero = '';
  fecha = hoyISO();
  tipoPago: 'contado' | 'credito' = 'contado';
  vence = '';
  notas = '';
  lineas: LineaCompra[] = [this.lineaVacia()];

  get total() {
    return this.lineas.reduce((a, l) => a + Number(l.cantidad || 0) * Number(l.costo_unitario || 0), 0);
  }

  async ngOnInit() {
    try {
      const [p, i] = await Promise.all([this.sb.rpc<Proveedor[]>('sel_proveedores'), this.sb.rpc<InventarioItem[]>('sel_inventario')]);
      this.proveedores.set(p);
      this.inventario.set(i);
    } catch (e) {
      this.toast.error(e);
    }
  }

  lineaVacia(): LineaCompra {
    return { presentacion_id: null, cantidad: 1, costo_unitario: 0, precio_venta: 0 };
  }

  agregarLinea() {
    this.lineas.push(this.lineaVacia());
  }

  elegir(l: LineaCompra, id: number | null) {
    const i = this.inventario().find((x) => x.presentacion_id === id);
    if (i) {
      l.costo_unitario = Number(i.costo);
      l.precio_venta = Number(i.precio_venta);
      if (i.por_pedir > 0) l.cantidad = i.por_pedir;
    }
  }

  /** Arma la compra con todo lo vendido por encargo que falta pedir */
  cargarPorPedir() {
    const pend = this.inventario().filter((i) => i.por_pedir > 0);
    if (!pend.length) return this.toast.info('No hay unidades pendientes por pedir');
    this.lineas = pend.map((i) => ({
      presentacion_id: i.presentacion_id,
      cantidad: i.por_pedir,
      costo_unitario: Number(i.costo),
      precio_venta: Number(i.precio_venta),
    }));
  }

  async guardar() {
    const items = this.lineas.filter((l) => l.presentacion_id && l.cantidad > 0);
    if (!this.proveedorId) return this.toast.error('Selecciona el proveedor');
    if (!items.length) return this.toast.error('Agrega al menos un producto');
    this.guardando.set(true);
    try {
      await this.sb.rpc('guardar_factura_compra', {
        p_data: {
          proveedor_id: this.proveedorId,
          numero_factura: this.numero,
          fecha: this.fecha,
          tipo_pago: this.tipoPago,
          fecha_vencimiento: this.tipoPago === 'credito' ? this.vence || null : null,
          notas: this.notas,
          items: items.map((l) => ({
            presentacion_id: l.presentacion_id,
            cantidad: Number(l.cantidad),
            costo_unitario: Number(l.costo_unitario),
            precio_venta: Number(l.precio_venta),
          })),
        },
      });
      this.toast.ok('Compra registrada e inventario actualizado');
      this.router.navigateByUrl('/admin/compras');
    } catch (e) {
      this.toast.error(e);
    } finally {
      this.guardando.set(false);
    }
  }
}

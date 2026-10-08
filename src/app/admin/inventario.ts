import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { SupabaseService } from '../core/supabase.service';
import { ToastService } from '../core/toast.service';
import { InventarioItem } from '../core/models';
import { ModalComponent } from '../shared/modal.component';
import { CopPipe, TipoPipe } from '../shared/pipes';

interface Movimiento {
  id: number;
  fecha: string;
  tipo: string;
  cantidad: number;
  costo_unitario: number | null;
  referencia: string | null;
}

@Component({
  selector: 'app-inventario',
  imports: [FormsModule, ModalComponent, CopPipe, TipoPipe, DatePipe],
  template: `
    <h2 class="mb-3">Inventario</h2>

    <div class="row g-3 mb-3">
      <div class="col-6 col-md-3"><div class="card kpi p-3"><div class="kpi-label">Valor inventario</div><div class="kpi-valor">{{ valorTotal() | cop }}</div></div></div>
      <div class="col-6 col-md-3"><div class="card kpi peligro p-3"><div class="kpi-label">Unidades por pedir</div><div class="kpi-valor">{{ porPedir() }}</div></div></div>
    </div>

    <div class="row g-2 mb-3">
      <div class="col-md-6"><input class="form-control" placeholder="Buscar producto..." [(ngModel)]="busqueda" (keyup.enter)="cargar()" /></div>
      <div class="col-md-3 d-flex align-items-center">
        <div class="form-check form-switch">
          <input class="form-check-input" type="checkbox" id="pp" [(ngModel)]="soloPorPedir" (change)="cargar()" />
          <label class="form-check-label" for="pp">Solo por pedir</label>
        </div>
      </div>
      <div class="col-md-3"><button class="btn btn-outline-primary w-100" (click)="cargar()">Buscar</button></div>
    </div>

    <div class="card">
      <div class="table-responsive">
        <table class="table table-hover table-sm mb-0">
          <thead>
            <tr><th>Producto</th><th>Tipo</th><th>Ml</th><th class="text-end">Costo</th><th class="text-end">Precio</th><th class="text-end">Margen</th><th class="text-center">Stock</th><th></th></tr>
          </thead>
          <tbody>
            @for (i of items(); track i.presentacion_id) {
              <tr>
                <td class="fw-semibold">{{ i.producto }}</td>
                <td>{{ i.tipo | tipo }}</td>
                <td>{{ i.mililitros }}</td>
                <td class="text-end">{{ i.costo | cop }}</td>
                <td class="text-end">{{ i.precio_venta | cop }}</td>
                <td class="text-end">{{ i.margen | cop }} <small class="text-muted">({{ i.margen_pct }}%)</small></td>
                <td class="text-center">
                  <span class="badge" [class]="i.stock < 0 ? 'text-bg-danger' : i.stock === 0 ? 'text-bg-secondary' : 'text-bg-success'">{{ i.stock }}</span>
                  @if (i.por_pedir > 0) { <div class="small text-danger">pedir {{ i.por_pedir }}</div> }
                </td>
                <td class="text-end text-nowrap">
                  <button class="btn btn-sm btn-outline-primary me-1" (click)="ajuste.set({ item: i, cantidad: 0, motivo: '' })" title="Ajustar"><i class="bi bi-plus-slash-minus"></i></button>
                  <button class="btn btn-sm btn-outline-secondary" (click)="verKardex(i)" title="Movimientos"><i class="bi bi-clock-history"></i></button>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="8" class="text-center text-muted py-4">Sin resultados.</td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    @if (ajuste(); as a) {
      <app-modal titulo="Ajuste de inventario" tamano="md" (cerrar)="ajuste.set(null)">
        <p class="mb-2">{{ a.item.producto }} · {{ a.item.mililitros }} ml (stock actual: {{ a.item.stock }})</p>
        <label class="form-label">Cantidad (+ entra, − sale)</label>
        <input type="number" class="form-control mb-2" [(ngModel)]="a.cantidad" />
        <label class="form-label">Motivo</label>
        <input class="form-control" [(ngModel)]="a.motivo" placeholder="Ej: conteo físico, muestra, daño" />
        <ng-container pie>
          <button class="btn btn-light" (click)="ajuste.set(null)">Cancelar</button>
          <button class="btn btn-primary" (click)="guardarAjuste(a)">Guardar</button>
        </ng-container>
      </app-modal>
    }

    @if (kardex(); as k) {
      <app-modal [titulo]="'Movimientos · ' + k.item.producto + ' ' + k.item.mililitros + ' ml'" (cerrar)="kardex.set(null)">
        <table class="table table-sm">
          <thead><tr><th>Fecha</th><th>Tipo</th><th class="text-end">Cant.</th><th class="text-end">Costo</th><th>Referencia</th></tr></thead>
          <tbody>
            @for (m of k.movs; track m.id) {
              <tr>
                <td>{{ m.fecha | date: 'dd/MM/yyyy HH:mm' }}</td><td class="text-capitalize">{{ m.tipo }}</td>
                <td class="text-end" [class.text-danger]="m.cantidad < 0">{{ m.cantidad }}</td>
                <td class="text-end">{{ m.costo_unitario | cop }}</td><td class="small">{{ m.referencia }}</td>
              </tr>
            } @empty { <tr><td colspan="5" class="text-muted text-center">Sin movimientos</td></tr> }
          </tbody>
        </table>
        <ng-container pie><button class="btn btn-light" (click)="kardex.set(null)">Cerrar</button></ng-container>
      </app-modal>
    }
  `,
})
export class Inventario implements OnInit {
  private sb = inject(SupabaseService);
  private toast = inject(ToastService);
  items = signal<InventarioItem[]>([]);
  ajuste = signal<{ item: InventarioItem; cantidad: number; motivo: string } | null>(null);
  kardex = signal<{ item: InventarioItem; movs: Movimiento[] } | null>(null);
  busqueda = '';
  soloPorPedir = false;

  valorTotal = computed(() => this.items().reduce((a, i) => a + Number(i.valor_inventario), 0));
  porPedir = computed(() => this.items().reduce((a, i) => a + Number(i.por_pedir), 0));

  ngOnInit() {
    this.cargar();
  }

  async cargar() {
    try {
      this.items.set(await this.sb.rpc('sel_inventario', { p_busqueda: this.busqueda || null, p_solo_por_pedir: this.soloPorPedir }));
    } catch (e) {
      this.toast.error(e);
    }
  }

  async guardarAjuste(a: { item: InventarioItem; cantidad: number; motivo: string }) {
    try {
      await this.sb.rpc('guardar_ajuste_inventario', {
        p_presentacion_id: a.item.presentacion_id,
        p_cantidad: Number(a.cantidad),
        p_motivo: a.motivo,
      });
      this.toast.ok('Inventario ajustado');
      this.ajuste.set(null);
      this.cargar();
    } catch (e) {
      this.toast.error(e);
    }
  }

  async verKardex(item: InventarioItem) {
    try {
      const movs = await this.sb.rpc<Movimiento[]>('sel_movimientos_inventario', { p_presentacion_id: item.presentacion_id });
      this.kardex.set({ item, movs });
    } catch (e) {
      this.toast.error(e);
    }
  }
}

import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../core/supabase.service';
import { ToastService } from '../core/toast.service';
import { Producto, TIPOS, TipoProducto } from '../core/models';
import { ModalComponent } from '../shared/modal.component';
import { CopPipe, TipoPipe } from '../shared/pipes';

const nuevo = (): Producto => ({
  nombre: '',
  tipo: 'imitacion',
  genero: 'unisex',
  marca: '',
  inspirado_en: '',
  descripcion: '',
  notas: '',
  imagen_url: '',
  destacado: false,
  activo: true,
  presentaciones: [
    { mililitros: 30, precio_venta: 0, costo: 0, stock: 0 },
    { mililitros: 60, precio_venta: 0, costo: 0, stock: 0 },
  ],
});

@Component({
  selector: 'app-productos',
  imports: [FormsModule, ModalComponent, CopPipe, TipoPipe],
  template: `
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <h2 class="mb-0">Productos</h2>
      <button class="btn btn-primary" (click)="abrir()"><i class="bi bi-plus-lg"></i> Nuevo producto</button>
    </div>

    <div class="row g-2 mb-3">
      <div class="col-md-6"><input class="form-control" placeholder="Buscar..." [(ngModel)]="busqueda" (keyup.enter)="cargar()" /></div>
      <div class="col-6 col-md-3">
        <select class="form-select" [(ngModel)]="tipo" (change)="cargar()">
          <option value="">Todos los tipos</option>
          @for (t of tipos; track t.valor) { <option [value]="t.valor">{{ t.etiqueta }}</option> }
        </select>
      </div>
      <div class="col-6 col-md-3"><button class="btn btn-outline-primary w-100" (click)="cargar()"><i class="bi bi-search"></i> Buscar</button></div>
    </div>

    <div class="card">
      <div class="table-responsive">
        <table class="table table-hover mb-0">
          <thead><tr><th></th><th>Producto</th><th>Tipo</th><th>Presentaciones (precio / costo / stock)</th><th></th></tr></thead>
          <tbody>
            @for (p of productos(); track p.id) {
              <tr>
                <td style="width:56px">
                  @if (p.imagen_url) { <img [src]="p.imagen_url" width="44" height="44" class="rounded object-fit-cover" alt="" /> }
                  @else { <i class="bi bi-droplet-half fs-3 text-dorado"></i> }
                </td>
                <td>
                  <div class="fw-semibold">{{ p.nombre }} @if (p.destacado) { <i class="bi bi-star-fill text-dorado small"></i> }</div>
                  <small class="text-muted">{{ p.inspirado_en ? 'Inspirado en ' + p.inspirado_en : p.marca }} · {{ p.genero }}</small>
                </td>
                <td><span class="badge text-bg-light border">{{ p.tipo | tipo }}</span></td>
                <td class="small">
                  @for (pr of p.presentaciones; track pr.id) {
                    <div>{{ pr.mililitros }} ml: <strong>{{ pr.precio_venta | cop }}</strong> / {{ pr.costo | cop }} /
                      <span [class.text-danger]="(pr.stock ?? 0) < 0">{{ pr.stock }}</span></div>
                  }
                </td>
                <td class="text-end text-nowrap">
                  <button class="btn btn-sm btn-outline-primary me-1" (click)="abrir(p)" title="Editar"><i class="bi bi-pencil"></i></button>
                  <button class="btn btn-sm btn-outline-danger" (click)="eliminar(p)" title="Eliminar"><i class="bi bi-trash"></i></button>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="5" class="text-center text-muted py-4">No hay productos.</td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    @if (form(); as f) {
      <app-modal [titulo]="f.id ? 'Editar producto' : 'Nuevo producto'" tamano="lg" (cerrar)="form.set(null)">
        <div class="row g-3">
          <div class="col-md-8">
            <label class="form-label">Nombre *</label>
            <input class="form-control" [(ngModel)]="f.nombre" />
          </div>
          <div class="col-md-4">
            <label class="form-label">Tipo *</label>
            <select class="form-select" [(ngModel)]="f.tipo" (ngModelChange)="cambioTipo(f, $event)">
              @for (t of tipos; track t.valor) { <option [value]="t.valor">{{ t.etiqueta }}</option> }
            </select>
          </div>
          <div class="col-md-4">
            <label class="form-label">Marca / casa</label>
            <input class="form-control" [(ngModel)]="f.marca" />
          </div>
          <div class="col-md-4">
            <label class="form-label">Inspirado en</label>
            <input class="form-control" [(ngModel)]="f.inspirado_en" placeholder="Solo para inspiradas" />
          </div>
          <div class="col-md-4">
            <label class="form-label">Género</label>
            <select class="form-select" [(ngModel)]="f.genero">
              <option value="hombre">Hombre</option><option value="mujer">Mujer</option><option value="unisex">Unisex</option>
            </select>
          </div>
          <div class="col-12">
            <label class="form-label">Notas olfativas</label>
            <input class="form-control" [(ngModel)]="f.notas" placeholder="Ej: vainilla, ámbar, maderas" />
          </div>
          <div class="col-12">
            <label class="form-label">Descripción</label>
            <textarea class="form-control" rows="2" [(ngModel)]="f.descripcion"></textarea>
          </div>
          <div class="col-md-8">
            <label class="form-label">Imagen</label>
            <input type="file" class="form-control" accept="image/*" (change)="subir($event, f)" [disabled]="subiendo()" />
            @if (subiendo()) { <small class="text-muted">Subiendo...</small> }
          </div>
          <div class="col-md-4 d-flex align-items-end gap-2">
            @if (f.imagen_url) { <img [src]="f.imagen_url" width="60" height="60" class="rounded object-fit-cover" alt="" /> }
          </div>
          <div class="col-12 d-flex gap-4">
            <div class="form-check form-switch"><input class="form-check-input" type="checkbox" id="dest" [(ngModel)]="f.destacado" /><label class="form-check-label" for="dest">Destacado</label></div>
            <div class="form-check form-switch"><input class="form-check-input" type="checkbox" id="act" [(ngModel)]="f.activo" /><label class="form-check-label" for="act">Visible en tienda</label></div>
          </div>

          <div class="col-12">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <strong>Presentaciones</strong>
              <button class="btn btn-sm btn-outline-primary" (click)="f.presentaciones.push({ mililitros: 100, precio_venta: 0, costo: 0, stock: 0 })">
                <i class="bi bi-plus"></i> Agregar
              </button>
            </div>
            <div class="table-responsive">
              <table class="table table-sm align-middle">
                <thead><tr><th>Ml</th><th>Precio venta</th><th>Costo</th><th>Stock</th><th></th></tr></thead>
                <tbody>
                  @for (pr of f.presentaciones; track $index) {
                    <tr>
                      <td style="width:90px"><input type="number" class="form-control form-control-sm" [(ngModel)]="pr.mililitros" min="1" /></td>
                      <td><input type="number" class="form-control form-control-sm" [(ngModel)]="pr.precio_venta" min="0" /></td>
                      <td><input type="number" class="form-control form-control-sm" [(ngModel)]="pr.costo" min="0" /></td>
                      <td style="width:90px"><input type="number" class="form-control form-control-sm" [(ngModel)]="pr.stock" [disabled]="!!pr.id" [title]="pr.id ? 'Ajusta el stock desde Inventario' : ''" /></td>
                      <td><button class="btn btn-sm btn-link text-danger" (click)="f.presentaciones.splice($index, 1)"><i class="bi bi-x-lg"></i></button></td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <small class="text-muted">Stock negativo = unidades vendidas por encargo pendientes por pedir. El stock de presentaciones existentes se ajusta en Inventario; el costo se actualiza al registrar compras.</small>
          </div>
        </div>
        <ng-container pie>
          <button class="btn btn-light" (click)="form.set(null)">Cancelar</button>
          <button class="btn btn-primary" (click)="guardar(f)" [disabled]="guardando()">Guardar</button>
        </ng-container>
      </app-modal>
    }
  `,
})
export class Productos implements OnInit {
  private sb = inject(SupabaseService);
  private toast = inject(ToastService);
  tipos = TIPOS;
  productos = signal<Producto[]>([]);
  form = signal<Producto | null>(null);
  guardando = signal(false);
  subiendo = signal(false);
  busqueda = '';
  tipo = '';

  ngOnInit() {
    this.cargar();
  }

  async cargar() {
    try {
      this.productos.set(await this.sb.rpc<Producto[]>('sel_productos', { p_busqueda: this.busqueda || null, p_tipo: this.tipo || null }));
    } catch (e) {
      this.toast.error(e);
    }
  }

  abrir(p?: Producto) {
    this.form.set(p ? structuredClone(p) : nuevo());
  }

  cambioTipo(f: Producto, tipo: TipoProducto) {
    // Al pasar a original/1.1 en un producto nuevo, sugerir una sola presentación de 100 ml
    if (!f.id && tipo !== 'imitacion' && f.presentaciones.length === 2 && f.presentaciones.every((p) => !p.precio_venta)) {
      f.presentaciones = [{ mililitros: 100, precio_venta: 0, costo: 0, stock: 0 }];
    }
    if (!f.id && tipo === 'imitacion' && f.presentaciones.length === 1 && !f.presentaciones[0].precio_venta) {
      f.presentaciones = nuevo().presentaciones;
    }
  }

  async subir(ev: Event, f: Producto) {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.subiendo.set(true);
    try {
      f.imagen_url = await this.sb.subirImagen(file);
    } catch (e) {
      this.toast.error(e);
    } finally {
      this.subiendo.set(false);
    }
  }

  async guardar(f: Producto) {
    this.guardando.set(true);
    try {
      const data = {
        ...f,
        presentaciones: f.presentaciones.map((p) => ({
          mililitros: Number(p.mililitros),
          precio_venta: Number(p.precio_venta || 0),
          costo: Number(p.costo || 0),
          // Stock solo para presentaciones nuevas; las existentes se ajustan en Inventario (evita pisar ventas recientes)
          stock: p.id ? null : Number(p.stock || 0),
        })),
      };
      if (f.id) await this.sb.rpc('actualizar_producto', { p_id: f.id, p_data: data });
      else await this.sb.rpc('guardar_producto', { p_data: data });
      this.toast.ok('Producto guardado');
      this.form.set(null);
      this.cargar();
    } catch (e) {
      this.toast.error(e);
    } finally {
      this.guardando.set(false);
    }
  }

  async eliminar(p: Producto) {
    if (!confirm(`¿Eliminar "${p.nombre}"?`)) return;
    try {
      const r = await this.sb.rpc<string>('eliminar_producto', { p_id: p.id });
      this.toast.ok(r === 'desactivado' ? 'El producto tiene movimientos: se desactivó' : 'Producto eliminado');
      this.cargar();
    } catch (e) {
      this.toast.error(e);
    }
  }
}

import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../core/supabase.service';
import { ToastService } from '../core/toast.service';
import { Cliente, InventarioItem, METODOS_PAGO } from '../core/models';
import { hoyISO, sumarDias } from '../core/utils';
import { CopPipe, FechaPipe, TipoPipe } from '../shared/pipes';

interface Linea {
  presentacion_id: number | null;
  cantidad: number;
  precio_unitario: number;
}

@Component({
  selector: 'app-venta-nueva',
  imports: [FormsModule, RouterLink, CopPipe, FechaPipe, TipoPipe],
  template: `
    <div class="d-flex align-items-center gap-2 mb-3">
      <a routerLink="/admin/ventas" class="btn btn-sm btn-light"><i class="bi bi-arrow-left"></i></a>
      <h2 class="mb-0">Nueva factura de venta</h2>
    </div>

    <div class="row g-3">
      <div class="col-xl-8">
        <!-- Cliente -->
        <div class="card mb-3">
          <div class="card-header bg-white d-flex justify-content-between align-items-center">
            <strong>Cliente</strong>
            <div class="btn-group btn-group-sm">
              <button class="btn" [class]="clienteNuevo ? 'btn-outline-primary' : 'btn-primary'" (click)="clienteNuevo = false">Existente</button>
              <button class="btn" [class]="clienteNuevo ? 'btn-primary' : 'btn-outline-primary'" (click)="clienteNuevo = true; clienteId = null">Nuevo</button>
            </div>
          </div>
          <div class="card-body row g-2">
            @if (!clienteNuevo) {
              <div class="col-12">
                <select class="form-select" [(ngModel)]="clienteId" (ngModelChange)="elegirCliente($event)">
                  <option [ngValue]="null">Selecciona un cliente...</option>
                  @for (c of clientes(); track c.id) {
                    <option [ngValue]="c.id">{{ c.nombre }} {{ c.telefono ? '· ' + c.telefono : '' }} {{ (c.saldo_pendiente ?? 0) > 0 ? '· debe' : '' }}</option>
                  }
                </select>
              </div>
            } @else {
              <div class="col-md-6"><label class="form-label small">Nombre *</label><input class="form-control" [(ngModel)]="cliente.nombre" /></div>
              <div class="col-md-6"><label class="form-label small">Documento</label><input class="form-control" [(ngModel)]="cliente.documento" /></div>
              <div class="col-md-6"><label class="form-label small">Dirección</label><input class="form-control" [(ngModel)]="cliente.direccion" /></div>
              <div class="col-md-6"><label class="form-label small">Ciudad</label><input class="form-control" [(ngModel)]="cliente.ciudad" /></div>
            }
            <div class="col-md-6">
              <label class="form-label small">Celular para cobro (WhatsApp) *</label>
              <input class="form-control" [(ngModel)]="telefonoCobro" placeholder="3001234567" />
            </div>
            <div class="col-md-6 d-flex align-items-end">
              <div class="form-check">
                <input class="form-check-input" type="checkbox" id="aut" [(ngModel)]="autorizaWhatsapp" />
                <label class="form-check-label small" for="aut">El cliente autoriza recordatorios por WhatsApp</label>
              </div>
            </div>
          </div>
        </div>

        <!-- Productos -->
        <div class="card mb-3">
          <div class="card-header bg-white d-flex justify-content-between align-items-center">
            <strong>Productos</strong>
            <button class="btn btn-sm btn-outline-primary" (click)="lineas.push({ presentacion_id: null, cantidad: 1, precio_unitario: 0 })">
              <i class="bi bi-plus"></i> Agregar línea
            </button>
          </div>
          <div class="card-body">
            @for (l of lineas; track $index) {
              <div class="row g-2 align-items-end mb-2 pb-2 border-bottom">
                <div class="col-md-6">
                  <label class="form-label small mb-0">Producto</label>
                  <select class="form-select" [(ngModel)]="l.presentacion_id" (ngModelChange)="elegirProducto(l, $event)">
                    <option [ngValue]="null">Selecciona...</option>
                    @for (i of inventario(); track i.presentacion_id) {
                      <option [ngValue]="i.presentacion_id">{{ i.producto }} · {{ i.tipo | tipo }} {{ i.mililitros }} ml · stock {{ i.stock }}</option>
                    }
                  </select>
                </div>
                <div class="col-3 col-md-2">
                  <label class="form-label small mb-0">Cant.</label>
                  <input type="number" min="1" class="form-control" [(ngModel)]="l.cantidad" />
                </div>
                <div class="col-5 col-md-3">
                  <label class="form-label small mb-0">Precio unit.</label>
                  <input type="number" min="0" class="form-control" [(ngModel)]="l.precio_unitario" />
                </div>
                <div class="col-4 col-md-1 text-end">
                  <button class="btn btn-link text-danger" (click)="lineas.splice($index, 1)" [disabled]="lineas.length === 1"><i class="bi bi-trash"></i></button>
                </div>
              </div>
            }
          </div>
        </div>

        <div class="card mb-3">
          <div class="card-body">
            <label class="form-label small">Notas</label>
            <textarea class="form-control" rows="2" [(ngModel)]="notas"></textarea>
          </div>
        </div>
      </div>

      <!-- Condiciones -->
      <div class="col-xl-4">
        <div class="card mb-3">
          <div class="card-header bg-white"><strong>Condiciones de pago</strong></div>
          <div class="card-body row g-2">
            <div class="col-12">
              <div class="btn-group w-100">
                <button class="btn" [class]="tipoPago === 'contado' ? 'btn-primary' : 'btn-outline-primary'" (click)="tipoPago = 'contado'">Contado</button>
                <button class="btn" [class]="tipoPago === 'financiado' ? 'btn-primary' : 'btn-outline-primary'" (click)="tipoPago = 'financiado'; abono = 0">Financiado</button>
              </div>
            </div>
            <div class="col-6"><label class="form-label small">Fecha emisión</label><input type="date" class="form-control" [(ngModel)]="fechaEmision" /></div>
            <div class="col-6">
              <label class="form-label small">{{ tipoPago === 'contado' ? 'Fecha de cobro' : '1ª cuota' }}</label>
              <input type="date" class="form-control" [(ngModel)]="fechaCobro" [min]="fechaEmision" />
            </div>
            @if (tipoPago === 'financiado') {
              <div class="col-6"><label class="form-label small">N° cuotas</label><input type="number" min="1" max="60" class="form-control" [(ngModel)]="cuotas" /></div>
              <div class="col-6">
                <label class="form-label small">Frecuencia</label>
                <select class="form-select" [(ngModel)]="frecuencia">
                  <option value="semanal">Semanal</option><option value="quincenal">Quincenal</option><option value="mensual">Mensual</option>
                </select>
              </div>
            }
            <div class="col-6">
              <label class="form-label small">Medio de pago</label>
              <select class="form-select" [(ngModel)]="metodo">
                @for (m of metodos; track m) { <option>{{ m }}</option> }
              </select>
            </div>
            <div class="col-6"><label class="form-label small">Descuento</label><input type="number" min="0" class="form-control" [(ngModel)]="descuento" /></div>
            <div class="col-12">
              <label class="form-label small">{{ tipoPago === 'contado' ? 'Valor pagado hoy' : 'Cuota inicial (opcional)' }}</label>
              <input type="number" min="0" class="form-control" [(ngModel)]="abono" [placeholder]="tipoPago === 'contado' ? 'Vacío = paga todo' : '0'" />
            </div>
          </div>
          <ul class="list-group list-group-flush">
            <li class="list-group-item d-flex justify-content-between"><span>Subtotal</span><span>{{ subtotal | cop }}</span></li>
            <li class="list-group-item d-flex justify-content-between"><span>Descuento</span><span>- {{ descuento || 0 | cop }}</span></li>
            <li class="list-group-item d-flex justify-content-between fs-5"><strong>Total</strong><strong class="text-primary">{{ total | cop }}</strong></li>
          </ul>
        </div>

        @if (tipoPago === 'financiado' && total > 0) {
          <div class="card mb-3">
            <div class="card-header bg-white"><strong>Plan de pagos</strong></div>
            <ul class="list-group list-group-flush small">
              @for (c of plan; track c.n) {
                <li class="list-group-item d-flex justify-content-between">
                  <span>{{ c.n === 0 ? 'Inicial' : 'Cuota ' + c.n }} · {{ c.fecha | fecha }}</span><span>{{ c.valor | cop }}</span>
                </li>
              }
            </ul>
          </div>
        }

        <button class="btn btn-primary btn-lg w-100" (click)="guardar()" [disabled]="guardando()">
          @if (guardando()) { <span class="spinner-border spinner-border-sm"></span> } Guardar factura
        </button>
      </div>
    </div>
  `,
})
export class VentaNueva implements OnInit {
  private sb = inject(SupabaseService);
  private toast = inject(ToastService);
  private router = inject(Router);

  metodos = METODOS_PAGO;
  clientes = signal<Cliente[]>([]);
  inventario = signal<InventarioItem[]>([]);
  guardando = signal(false);

  clienteNuevo = false;
  clienteId: number | null = null;
  cliente: Cliente = { nombre: '', documento: '', direccion: '', ciudad: 'Montería' };
  telefonoCobro = '';
  autorizaWhatsapp = true;
  lineas: Linea[] = [{ presentacion_id: null, cantidad: 1, precio_unitario: 0 }];
  tipoPago: 'contado' | 'financiado' = 'contado';
  fechaEmision = hoyISO();
  fechaCobro = hoyISO();
  cuotas = 2;
  frecuencia: 'semanal' | 'quincenal' | 'mensual' = 'quincenal';
  metodo = 'Efectivo';
  descuento = 0;
  abono: number | null = null;
  notas = '';

  get subtotal() {
    return this.lineas.reduce((a, l) => a + Number(l.cantidad || 0) * Number(l.precio_unitario || 0), 0);
  }
  get total() {
    return Math.max(this.subtotal - Number(this.descuento || 0), 0);
  }
  /** Vista previa: misma regla que guardar_factura_venta en la base de datos */
  get plan() {
    const abono = Number(this.abono || 0);
    const n = Math.max(Number(this.cuotas || 1), 1);
    const resto = this.total - abono;
    const valor = Math.round(resto / n);
    const paso = this.frecuencia === 'semanal' ? 7 : this.frecuencia === 'quincenal' ? 15 : 0;
    const out: { n: number; fecha: string; valor: number }[] = [];
    if (abono > 0) out.push({ n: 0, fecha: this.fechaEmision, valor: abono });
    for (let i = 1; i <= n; i++) {
      let fecha = sumarDias(this.fechaCobro, paso * (i - 1));
      if (!paso) {
        const [y, m, d] = this.fechaCobro.split('-').map(Number);
        const f = new Date(y, m - 1 + (i - 1), 1);
        const ultimo = new Date(f.getFullYear(), f.getMonth() + 1, 0).getDate();
        fecha = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(Math.min(d, ultimo)).padStart(2, '0')}`;
      }
      out.push({ n: i, fecha, valor: i === n ? resto - valor * (n - 1) : valor });
    }
    return out;
  }

  async ngOnInit() {
    try {
      const [c, i] = await Promise.all([this.sb.rpc<Cliente[]>('sel_clientes'), this.sb.rpc<InventarioItem[]>('sel_inventario')]);
      this.clientes.set(c);
      this.inventario.set(i);
    } catch (e) {
      this.toast.error(e);
    }
  }

  elegirCliente(id: number | null) {
    const c = this.clientes().find((x) => x.id === id);
    if (c) {
      this.telefonoCobro = c.telefono ?? '';
      this.autorizaWhatsapp = c.autoriza_whatsapp ?? true;
    }
  }

  elegirProducto(l: Linea, id: number | null) {
    const i = this.inventario().find((x) => x.presentacion_id === id);
    if (i) l.precio_unitario = Number(i.precio_venta);
  }

  async guardar() {
    const items = this.lineas.filter((l) => l.presentacion_id && l.cantidad > 0);
    if (!items.length) return this.toast.error('Agrega al menos un producto');
    if (!this.clienteNuevo && !this.clienteId) return this.toast.error('Selecciona el cliente');
    if (this.clienteNuevo && !this.cliente.nombre.trim()) return this.toast.error('Escribe el nombre del cliente');

    this.guardando.set(true);
    try {
      const r = await this.sb.rpc<{ id: number; numero: string }>('guardar_factura_venta', {
        p_data: {
          cliente_id: this.clienteNuevo ? null : this.clienteId,
          cliente: { ...(this.clienteNuevo ? this.cliente : {}), telefono: this.telefonoCobro, autoriza_whatsapp: this.autorizaWhatsapp },
          telefono_cobro: this.telefonoCobro,
          fecha_emision: this.fechaEmision,
          fecha_vencimiento: this.fechaCobro,
          tipo_pago: this.tipoPago,
          metodo_pago: this.metodo,
          numero_cuotas: this.tipoPago === 'financiado' ? this.cuotas : 1,
          frecuencia: this.frecuencia,
          descuento: this.descuento || 0,
          abono_inicial: this.abono === null || (this.abono as unknown) === '' ? null : this.abono,
          notas: this.notas,
          items: items.map((l) => ({ presentacion_id: l.presentacion_id, cantidad: Number(l.cantidad), precio_unitario: Number(l.precio_unitario) })),
        },
      });
      this.toast.ok(`Factura ${r.numero} creada`);
      this.router.navigate(['/admin/ventas', r.id]);
    } catch (e) {
      this.toast.error(e);
    } finally {
      this.guardando.set(false);
    }
  }
}

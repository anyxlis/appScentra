import { Component, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SupabaseService } from '../core/supabase.service';
import { ToastService } from '../core/toast.service';
import { PdfService } from '../core/pdf.service';
import { Configuracion, Cuota, FacturaVenta, METODOS_PAGO } from '../core/models';
import { hoyISO, mensajeRecordatorio, urlWhatsapp } from '../core/utils';
import { ModalComponent } from '../shared/modal.component';
import { CopPipe, FechaPipe, TipoPipe } from '../shared/pipes';

@Component({
  selector: 'app-venta-detalle',
  imports: [FormsModule, RouterLink, DatePipe, ModalComponent, CopPipe, FechaPipe, TipoPipe],
  template: `
    @if (f(); as f) {
      <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
        <a routerLink="/admin/ventas" class="btn btn-sm btn-light"><i class="bi bi-arrow-left"></i></a>
        <h2 class="mb-0 me-2">Factura {{ f.numero }}</h2>
        <span [class]="'estado-' + f.estado_cobro">{{ f.estado_cobro.replace('_', ' ') }}</span>
        <div class="ms-auto d-flex flex-wrap gap-2">
          <button class="btn btn-outline-primary" (click)="pdf()"><i class="bi bi-filetype-pdf"></i> PDF</button>
          @if (f.estado === 'pendiente') {
            <button class="btn btn-success" (click)="abrirPago(f)"><i class="bi bi-cash"></i> Registrar abono</button>
          }
          @if (f.estado !== 'anulada') {
            <button class="btn btn-outline-secondary" (click)="edicion.set({ telefono_cobro: f.telefono_cobro, metodo_pago: f.metodo_pago ?? '', cliente_direccion: f.cliente_direccion ?? '', notas: f.notas ?? '' })">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-outline-danger" (click)="anulacion.set('')"><i class="bi bi-x-octagon"></i> Anular</button>
          }
        </div>
      </div>

      @if (f.estado === 'anulada') {
        <div class="alert alert-secondary">Factura anulada. Motivo: {{ f.motivo_anulacion }}</div>
      }

      <div class="row g-3">
        <div class="col-lg-8">
          <div class="card mb-3">
            <div class="card-body row g-3 small">
              <div class="col-md-6">
                <div class="text-muted text-uppercase">Cliente</div>
                <div class="fw-semibold fs-6">{{ f.cliente_nombre }}</div>
                <div>{{ f.cliente_documento }}</div>
                <div><i class="bi bi-whatsapp text-success"></i> {{ f.telefono_cobro }}</div>
                <div>{{ f.cliente_direccion }}</div>
              </div>
              <div class="col-md-6">
                <div><span class="text-muted">Emisión:</span> {{ f.fecha_emision | fecha }}</div>
                <div><span class="text-muted">Fecha de cobro:</span> {{ f.fecha_vencimiento | fecha }}</div>
                <div><span class="text-muted">Forma de pago: </span><span class="text-capitalize">{{ f.tipo_pago }}</span>
                  @if (f.tipo_pago === 'financiado') { ({{ f.numero_cuotas }} cuotas, {{ f.frecuencia }}) }</div>
                <div><span class="text-muted">Medio:</span> {{ f.metodo_pago }}</div>
                @if (f.notas) { <div><span class="text-muted">Notas:</span> {{ f.notas }}</div> }
              </div>
            </div>
            <div class="table-responsive">
              <table class="table mb-0">
                <thead><tr><th>Producto</th><th>Tipo</th><th>Ml</th><th class="text-center">Cant.</th><th class="text-end">Precio</th><th class="text-end">Subtotal</th></tr></thead>
                <tbody>
                  @for (d of f.detalle; track d.id) {
                    <tr><td>{{ d.producto_nombre }}</td><td>{{ d.tipo | tipo }}</td><td>{{ d.mililitros }}</td><td class="text-center">{{ d.cantidad }}</td>
                      <td class="text-end">{{ d.precio_unitario | cop }}</td><td class="text-end">{{ d.subtotal | cop }}</td></tr>
                  }
                </tbody>
              </table>
            </div>
          </div>

          <div class="card mb-3">
            <div class="card-header bg-white"><strong>Plan de pagos y cobros</strong></div>
            <div class="table-responsive">
              <table class="table table-sm mb-0">
                <thead><tr><th>Cuota</th><th>Fecha de cobro</th><th class="text-end">Valor</th><th class="text-end">Pagado</th><th class="text-end">Saldo</th><th></th></tr></thead>
                <tbody>
                  @for (c of f.cuotas; track c.id) {
                    <tr [class.table-danger]="c.vencida">
                      <td>{{ c.numero === 0 ? 'Inicial' : c.numero }}</td>
                      <td>
                        @if (reprogramando() === c.id) {
                          <div class="input-group input-group-sm" style="max-width: 220px">
                            <input type="date" class="form-control" [(ngModel)]="nuevaFecha" />
                            <button class="btn btn-primary" (click)="reprogramar(c)"><i class="bi bi-check"></i></button>
                          </div>
                        } @else {
                          {{ c.fecha_vencimiento | fecha }}
                          @if (c.vencida) { <span class="badge text-bg-danger ms-1">{{ c.dias_mora }} días mora</span> }
                        }
                      </td>
                      <td class="text-end">{{ c.valor | cop }}</td>
                      <td class="text-end">{{ c.pagado | cop }}</td>
                      <td class="text-end fw-semibold">{{ c.saldo | cop }}</td>
                      <td class="text-end text-nowrap">
                        @if (c.saldo > 0 && f.estado === 'pendiente') {
                          <button class="btn btn-sm btn-success me-1" (click)="recordar(f, c)" title="Enviar recordatorio por WhatsApp"><i class="bi bi-whatsapp"></i></button>
                          <button class="btn btn-sm btn-outline-secondary" (click)="reprogramando.set(c.id); nuevaFecha = c.fecha_vencimiento" title="Cambiar fecha"><i class="bi bi-calendar-event"></i></button>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="col-lg-4">
          <div class="card mb-3">
            <ul class="list-group list-group-flush">
              <li class="list-group-item d-flex justify-content-between"><span>Subtotal</span><span>{{ f.subtotal | cop }}</span></li>
              <li class="list-group-item d-flex justify-content-between"><span>Descuento</span><span>- {{ f.descuento | cop }}</span></li>
              <li class="list-group-item d-flex justify-content-between fs-5"><strong>Total</strong><strong>{{ f.total | cop }}</strong></li>
              <li class="list-group-item d-flex justify-content-between text-success"><span>Pagado</span><span>{{ f.total_pagado | cop }}</span></li>
              <li class="list-group-item d-flex justify-content-between fs-5 text-danger"><strong>Saldo</strong><strong>{{ f.saldo | cop }}</strong></li>
            </ul>
          </div>

          <div class="card mb-3">
            <div class="card-header bg-white"><strong>Abonos</strong></div>
            <ul class="list-group list-group-flush small">
              @for (p of f.pagos; track p.id) {
                <li class="list-group-item d-flex justify-content-between align-items-center">
                  <div>{{ p.fecha | fecha }} · {{ p.metodo_pago }}<div class="text-muted">{{ p.nota }}</div></div>
                  <div class="text-nowrap">{{ p.valor | cop }}
                    @if (f.estado !== 'anulada') {
                      <button class="btn btn-sm btn-link text-danger p-0 ms-2" (click)="eliminarPago(p.id)" title="Eliminar abono"><i class="bi bi-trash"></i></button>
                    }
                  </div>
                </li>
              } @empty { <li class="list-group-item text-muted">Sin abonos</li> }
            </ul>
          </div>

          <div class="card">
            <div class="card-header bg-white"><strong>Recordatorios enviados</strong></div>
            <ul class="list-group list-group-flush small">
              @for (r of f.recordatorios; track r.id) {
                <li class="list-group-item">{{ r.created_at | date: 'dd/MM/yyyy HH:mm' }} · {{ r.telefono }}</li>
              } @empty { <li class="list-group-item text-muted">Ninguno</li> }
            </ul>
          </div>
        </div>
      </div>

      @if (pago(); as p) {
        <app-modal titulo="Registrar abono" tamano="md" (cerrar)="pago.set(null)">
          <p class="small text-muted">Saldo actual: {{ f.saldo | cop }}</p>
          <div class="row g-2">
            <div class="col-6"><label class="form-label">Valor</label><input type="number" class="form-control" [(ngModel)]="p.valor" [max]="f.saldo" /></div>
            <div class="col-6"><label class="form-label">Fecha</label><input type="date" class="form-control" [(ngModel)]="p.fecha" /></div>
            <div class="col-6">
              <label class="form-label">Medio</label>
              <select class="form-select" [(ngModel)]="p.metodo">@for (m of metodos; track m) { <option>{{ m }}</option> }</select>
            </div>
            <div class="col-6"><label class="form-label">Nota</label><input class="form-control" [(ngModel)]="p.nota" /></div>
          </div>
          <ng-container pie>
            <button class="btn btn-light" (click)="pago.set(null)">Cancelar</button>
            <button class="btn btn-success" (click)="guardarPago(p)">Guardar abono</button>
          </ng-container>
        </app-modal>
      }

      @if (anulacion() !== null) {
        <app-modal titulo="Anular factura" tamano="md" (cerrar)="anulacion.set(null)">
          <p class="small">La factura queda fuera de informes y cartera, y las unidades vuelven al inventario.</p>
          <label class="form-label">Motivo *</label>
          <input class="form-control" [ngModel]="anulacion()" (ngModelChange)="anulacion.set($event)" />
          <ng-container pie>
            <button class="btn btn-light" (click)="anulacion.set(null)">Cancelar</button>
            <button class="btn btn-danger" (click)="anular()">Anular factura</button>
          </ng-container>
        </app-modal>
      }

      @if (edicion(); as e) {
        <app-modal titulo="Editar datos de la factura" tamano="md" (cerrar)="edicion.set(null)">
          <div class="row g-2">
            <div class="col-12"><label class="form-label">Celular de cobro *</label><input class="form-control" [(ngModel)]="e.telefono_cobro" /></div>
            <div class="col-12">
              <label class="form-label">Medio de pago</label>
              <select class="form-select" [(ngModel)]="e.metodo_pago">@for (m of metodos; track m) { <option>{{ m }}</option> }</select>
            </div>
            <div class="col-12"><label class="form-label">Dirección</label><input class="form-control" [(ngModel)]="e.cliente_direccion" /></div>
            <div class="col-12"><label class="form-label">Notas</label><textarea class="form-control" rows="2" [(ngModel)]="e.notas"></textarea></div>
          </div>
          <ng-container pie>
            <button class="btn btn-light" (click)="edicion.set(null)">Cancelar</button>
            <button class="btn btn-primary" (click)="guardarEdicion(e)">Guardar</button>
          </ng-container>
        </app-modal>
      }
    } @else {
      <div class="text-center py-5"><div class="spinner-border text-secondary"></div></div>
    }
  `,
})
export class VentaDetalle implements OnInit {
  id = input.required<string>();
  private sb = inject(SupabaseService);
  private toast = inject(ToastService);
  private pdfSrv = inject(PdfService);

  metodos = METODOS_PAGO;
  f = signal<FacturaVenta | null>(null);
  cfg = signal<Configuracion | null>(null);
  pago = signal<{ valor: number; fecha: string; metodo: string; nota: string } | null>(null);
  anulacion = signal<string | null>(null);
  edicion = signal<{ telefono_cobro: string; metodo_pago: string; cliente_direccion: string; notas: string } | null>(null);
  reprogramando = signal<number | null>(null);
  nuevaFecha = '';

  async ngOnInit() {
    await this.cargar();
    try {
      this.cfg.set(await this.sb.rpc<Configuracion>('sel_configuracion'));
    } catch {
      /* opcional */
    }
  }

  async cargar() {
    try {
      this.f.set(await this.sb.rpc<FacturaVenta>('sel_factura_venta', { p_id: Number(this.id()) }));
    } catch (e) {
      this.toast.error(e);
    }
  }

  abrirPago(f: FacturaVenta) {
    const prox = f.cuotas?.find((c) => c.saldo > 0);
    this.pago.set({ valor: Number(prox?.saldo ?? f.saldo), fecha: hoyISO(), metodo: f.metodo_pago || 'Efectivo', nota: '' });
  }

  async guardarPago(p: { valor: number; fecha: string; metodo: string; nota: string }) {
    try {
      await this.sb.rpc('guardar_pago_venta', {
        p_factura_id: this.f()!.id,
        p_valor: Number(p.valor),
        p_fecha: p.fecha,
        p_metodo_pago: p.metodo,
        p_nota: p.nota,
      });
      this.toast.ok('Abono registrado');
      this.pago.set(null);
      this.cargar();
    } catch (e) {
      this.toast.error(e);
    }
  }

  async eliminarPago(id: number) {
    if (!confirm('¿Eliminar este abono?')) return;
    try {
      await this.sb.rpc('eliminar_pago_venta', { p_id: id });
      this.toast.ok('Abono eliminado');
      this.cargar();
    } catch (e) {
      this.toast.error(e);
    }
  }

  async anular() {
    try {
      await this.sb.rpc('actualizar_anular_factura_venta', { p_id: this.f()!.id, p_motivo: this.anulacion() });
      this.toast.ok('Factura anulada');
      this.anulacion.set(null);
      this.cargar();
    } catch (e) {
      this.toast.error(e);
    }
  }

  async guardarEdicion(e: { telefono_cobro: string; metodo_pago: string; cliente_direccion: string; notas: string }) {
    try {
      await this.sb.rpc('actualizar_factura_venta', { p_id: this.f()!.id, p_data: e });
      this.toast.ok('Factura actualizada');
      this.edicion.set(null);
      this.cargar();
    } catch (err) {
      this.toast.error(err);
    }
  }

  async reprogramar(c: Cuota) {
    try {
      await this.sb.rpc('actualizar_cuota_venta', { p_id: c.id, p_fecha_vencimiento: this.nuevaFecha });
      this.reprogramando.set(null);
      this.toast.ok('Fecha actualizada');
      this.cargar();
    } catch (e) {
      this.toast.error(e);
    }
  }

  recordar(f: FacturaVenta, c: Cuota) {
    const plantilla = this.cfg()?.mensaje_recordatorio ?? 'Hola {cliente}, tu factura {factura} tiene un saldo de {saldo}.';
    const msg = mensajeRecordatorio(plantilla, {
      cliente: f.cliente_nombre,
      factura: f.numero,
      valor: c.saldo,
      fecha: c.fecha_vencimiento,
      saldo: f.saldo,
    });
    window.open(urlWhatsapp(f.telefono_cobro, msg), '_blank');
    this.sb
      .rpc('guardar_recordatorio', { p_factura_id: f.id, p_cuota_id: c.id, p_telefono: f.telefono_cobro, p_mensaje: msg })
      .then(() => this.cargar())
      .catch(() => undefined);
  }

  async pdf() {
    const f = this.f();
    if (!f) return;
    try {
      const cfg = this.cfg() ?? (await this.sb.rpc<Configuracion>('sel_configuracion'));
      await this.pdfSrv.facturaVenta(f, cfg);
    } catch (e) {
      this.toast.error(e);
    }
  }
}

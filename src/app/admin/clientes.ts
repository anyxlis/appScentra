import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SupabaseService } from '../core/supabase.service';
import { ToastService } from '../core/toast.service';
import { Cliente } from '../core/models';
import { ModalComponent } from '../shared/modal.component';
import { CopPipe, FechaPipe } from '../shared/pipes';

interface ClienteDetalle extends Cliente {
  facturas_lista?: { id: number; numero: string; fecha_emision: string; total: number; saldo: number; estado_cobro: string; proxima_fecha: string }[];
}

@Component({
  selector: 'app-clientes',
  imports: [FormsModule, RouterLink, ModalComponent, CopPipe, FechaPipe],
  template: `
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <h2 class="mb-0">Clientes</h2>
      <button class="btn btn-primary" (click)="form.set({ nombre: '', autoriza_whatsapp: true })"><i class="bi bi-plus-lg"></i> Nuevo cliente</button>
    </div>
    <div class="input-group mb-3" style="max-width: 520px">
      <input class="form-control" placeholder="Nombre, documento o teléfono" [(ngModel)]="busqueda" (keyup.enter)="cargar()" />
      <button class="btn btn-outline-primary" (click)="cargar()"><i class="bi bi-search"></i></button>
    </div>

    <div class="card">
      <div class="table-responsive">
        <table class="table table-hover mb-0">
          <thead><tr><th>Cliente</th><th>Teléfono</th><th class="text-center">Facturas</th><th class="text-end">Debe</th><th class="text-end">Vencido</th><th></th></tr></thead>
          <tbody>
            @for (c of clientes(); track c.id) {
              <tr>
                <td><div class="fw-semibold">{{ c.nombre }}</div><small class="text-muted">{{ c.documento }} {{ c.ciudad }}</small></td>
                <td>{{ c.telefono }}</td>
                <td class="text-center">{{ c.facturas }}</td>
                <td class="text-end">{{ c.saldo_pendiente | cop }}</td>
                <td class="text-end" [class.text-danger]="(c.saldo_vencido ?? 0) > 0">{{ c.saldo_vencido | cop }}</td>
                <td class="text-end text-nowrap">
                  <button class="btn btn-sm btn-outline-secondary me-1" (click)="ver(c)" title="Historial"><i class="bi bi-eye"></i></button>
                  <button class="btn btn-sm btn-outline-primary me-1" (click)="form.set({ ...c })" title="Editar"><i class="bi bi-pencil"></i></button>
                  <button class="btn btn-sm btn-outline-danger" (click)="eliminar(c)" title="Eliminar"><i class="bi bi-trash"></i></button>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="6" class="text-center text-muted py-4">No hay clientes.</td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    @if (form(); as f) {
      <app-modal [titulo]="f.id ? 'Editar cliente' : 'Nuevo cliente'" tamano="md" (cerrar)="form.set(null)">
        <div class="row g-2">
          <div class="col-12"><label class="form-label">Nombre *</label><input class="form-control" [(ngModel)]="f.nombre" /></div>
          <div class="col-6"><label class="form-label">Documento</label><input class="form-control" [(ngModel)]="f.documento" /></div>
          <div class="col-6"><label class="form-label">Celular</label><input class="form-control" [(ngModel)]="f.telefono" /></div>
          <div class="col-12"><label class="form-label">Correo</label><input type="email" class="form-control" [(ngModel)]="f.email" /></div>
          <div class="col-8"><label class="form-label">Dirección</label><input class="form-control" [(ngModel)]="f.direccion" /></div>
          <div class="col-4"><label class="form-label">Ciudad</label><input class="form-control" [(ngModel)]="f.ciudad" /></div>
          <div class="col-12"><label class="form-label">Notas</label><textarea class="form-control" rows="2" [(ngModel)]="f.notas"></textarea></div>
          <div class="col-12 form-check ms-2">
            <input class="form-check-input" type="checkbox" id="aw" [(ngModel)]="f.autoriza_whatsapp" />
            <label class="form-check-label small" for="aw">Autoriza tratamiento de datos y recordatorios por WhatsApp (Ley 1581)</label>
          </div>
        </div>
        <ng-container pie>
          <button class="btn btn-light" (click)="form.set(null)">Cancelar</button>
          <button class="btn btn-primary" (click)="guardar(f)">Guardar</button>
        </ng-container>
      </app-modal>
    }

    @if (detalle(); as d) {
      <app-modal [titulo]="d.nombre" (cerrar)="detalle.set(null)">
        <p class="small text-muted">{{ d.documento }} · {{ d.telefono }} · {{ d.email }} · {{ d.direccion }} {{ d.ciudad }}</p>
        <table class="table table-sm">
          <thead><tr><th>Factura</th><th>Fecha</th><th class="text-end">Total</th><th class="text-end">Saldo</th><th>Estado</th></tr></thead>
          <tbody>
            @for (v of d.facturas_lista; track v.id) {
              <tr role="button" [routerLink]="['/admin/ventas', v.id]">
                <td>{{ v.numero }}</td><td>{{ v.fecha_emision | fecha }}</td>
                <td class="text-end">{{ v.total | cop }}</td><td class="text-end">{{ v.saldo | cop }}</td>
                <td><span [class]="'estado-' + v.estado_cobro">{{ v.estado_cobro.replace('_', ' ') }}</span></td>
              </tr>
            } @empty { <tr><td colspan="5" class="text-muted text-center">Sin facturas</td></tr> }
          </tbody>
        </table>
        <ng-container pie><button class="btn btn-light" (click)="detalle.set(null)">Cerrar</button></ng-container>
      </app-modal>
    }
  `,
})
export class Clientes implements OnInit {
  private sb = inject(SupabaseService);
  private toast = inject(ToastService);
  clientes = signal<Cliente[]>([]);
  form = signal<Cliente | null>(null);
  detalle = signal<ClienteDetalle | null>(null);
  busqueda = '';

  ngOnInit() {
    this.cargar();
  }

  async cargar() {
    try {
      this.clientes.set(await this.sb.rpc('sel_clientes', { p_busqueda: this.busqueda || null }));
    } catch (e) {
      this.toast.error(e);
    }
  }

  async ver(c: Cliente) {
    try {
      const d = await this.sb.rpc<Cliente & { facturas: unknown }>('sel_cliente', { p_id: c.id });
      this.detalle.set({ ...d, facturas_lista: d.facturas as ClienteDetalle['facturas_lista'] });
    } catch (e) {
      this.toast.error(e);
    }
  }

  async guardar(f: Cliente) {
    try {
      if (f.id) await this.sb.rpc('actualizar_cliente', { p_id: f.id, p_data: f });
      else await this.sb.rpc('guardar_cliente', { p_data: f });
      this.toast.ok('Cliente guardado');
      this.form.set(null);
      this.cargar();
    } catch (e) {
      this.toast.error(e);
    }
  }

  async eliminar(c: Cliente) {
    if (!confirm(`¿Eliminar a ${c.nombre}?`)) return;
    try {
      const r = await this.sb.rpc<string>('eliminar_cliente', { p_id: c.id });
      this.toast.ok(r === 'desactivado' ? 'Tiene facturas: se desactivó' : 'Cliente eliminado');
      this.cargar();
    } catch (e) {
      this.toast.error(e);
    }
  }
}

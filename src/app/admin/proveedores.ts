import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../core/supabase.service';
import { ToastService } from '../core/toast.service';
import { Proveedor } from '../core/models';
import { ModalComponent } from '../shared/modal.component';
import { CopPipe } from '../shared/pipes';

@Component({
  selector: 'app-proveedores',
  imports: [FormsModule, ModalComponent, CopPipe],
  template: `
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <h2 class="mb-0">Proveedores</h2>
      <button class="btn btn-primary" (click)="form.set({ nombre: '' })"><i class="bi bi-plus-lg"></i> Nuevo proveedor</button>
    </div>
    <div class="input-group mb-3" style="max-width: 520px">
      <input class="form-control" placeholder="Nombre o NIT" [(ngModel)]="busqueda" (keyup.enter)="cargar()" />
      <button class="btn btn-outline-primary" (click)="cargar()"><i class="bi bi-search"></i></button>
    </div>

    <div class="card">
      <div class="table-responsive">
        <table class="table table-hover mb-0">
          <thead><tr><th>Proveedor</th><th>Teléfono</th><th class="text-end">Total comprado</th><th class="text-end">Por pagar</th><th></th></tr></thead>
          <tbody>
            @for (p of proveedores(); track p.id) {
              <tr>
                <td><div class="fw-semibold">{{ p.nombre }}</div><small class="text-muted">{{ p.nit }}</small></td>
                <td>{{ p.telefono }}</td>
                <td class="text-end">{{ p.total_comprado | cop }}</td>
                <td class="text-end" [class.text-danger]="(p.por_pagar ?? 0) > 0">{{ p.por_pagar | cop }}</td>
                <td class="text-end text-nowrap">
                  <button class="btn btn-sm btn-outline-primary me-1" (click)="form.set({ ...p })"><i class="bi bi-pencil"></i></button>
                  <button class="btn btn-sm btn-outline-danger" (click)="eliminar(p)"><i class="bi bi-trash"></i></button>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="5" class="text-center text-muted py-4">No hay proveedores.</td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    @if (form(); as f) {
      <app-modal [titulo]="f.id ? 'Editar proveedor' : 'Nuevo proveedor'" tamano="md" (cerrar)="form.set(null)">
        <div class="row g-2">
          <div class="col-12"><label class="form-label">Nombre *</label><input class="form-control" [(ngModel)]="f.nombre" /></div>
          <div class="col-6"><label class="form-label">NIT / Documento</label><input class="form-control" [(ngModel)]="f.nit" /></div>
          <div class="col-6"><label class="form-label">Teléfono</label><input class="form-control" [(ngModel)]="f.telefono" /></div>
          <div class="col-12"><label class="form-label">Correo</label><input class="form-control" [(ngModel)]="f.email" /></div>
          <div class="col-12"><label class="form-label">Dirección</label><input class="form-control" [(ngModel)]="f.direccion" /></div>
          <div class="col-12"><label class="form-label">Notas</label><textarea class="form-control" rows="2" [(ngModel)]="f.notas"></textarea></div>
        </div>
        <ng-container pie>
          <button class="btn btn-light" (click)="form.set(null)">Cancelar</button>
          <button class="btn btn-primary" (click)="guardar(f)">Guardar</button>
        </ng-container>
      </app-modal>
    }
  `,
})
export class Proveedores implements OnInit {
  private sb = inject(SupabaseService);
  private toast = inject(ToastService);
  proveedores = signal<Proveedor[]>([]);
  form = signal<Proveedor | null>(null);
  busqueda = '';

  ngOnInit() {
    this.cargar();
  }

  async cargar() {
    try {
      this.proveedores.set(await this.sb.rpc('sel_proveedores', { p_busqueda: this.busqueda || null }));
    } catch (e) {
      this.toast.error(e);
    }
  }

  async guardar(f: Proveedor) {
    try {
      if (f.id) await this.sb.rpc('actualizar_proveedor', { p_id: f.id, p_data: f });
      else await this.sb.rpc('guardar_proveedor', { p_data: f });
      this.toast.ok('Proveedor guardado');
      this.form.set(null);
      this.cargar();
    } catch (e) {
      this.toast.error(e);
    }
  }

  async eliminar(p: Proveedor) {
    if (!confirm(`¿Eliminar a ${p.nombre}?`)) return;
    try {
      const r = await this.sb.rpc<string>('eliminar_proveedor', { p_id: p.id });
      this.toast.ok(r === 'desactivado' ? 'Tiene compras: se desactivó' : 'Proveedor eliminado');
      this.cargar();
    } catch (e) {
      this.toast.error(e);
    }
  }
}

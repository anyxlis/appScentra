import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../core/supabase.service';
import { ToastService } from '../core/toast.service';
import { CATEGORIAS_GASTO, Gasto, METODOS_PAGO } from '../core/models';
import { hoyISO, primerDiaMes } from '../core/utils';
import { ModalComponent } from '../shared/modal.component';
import { CopPipe, FechaPipe } from '../shared/pipes';

@Component({
  selector: 'app-gastos',
  imports: [FormsModule, ModalComponent, CopPipe, FechaPipe],
  template: `
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <h2 class="mb-0">Gastos</h2>
      <button class="btn btn-primary" (click)="form.set({ fecha: hoy, categoria: 'otros', descripcion: '', valor: 0, metodo_pago: 'Efectivo' })">
        <i class="bi bi-plus-lg"></i> Nuevo gasto
      </button>
    </div>
    <p class="text-muted small">Envíos, publicidad, empaques y demás gastos del negocio. Se restan de la ganancia en los informes.</p>

    <div class="row g-2 mb-3">
      <div class="col-6 col-md-3"><input type="date" class="form-control" [(ngModel)]="desde" /></div>
      <div class="col-6 col-md-3"><input type="date" class="form-control" [(ngModel)]="hasta" /></div>
      <div class="col-md-2"><button class="btn btn-outline-primary w-100" (click)="cargar()">Filtrar</button></div>
      <div class="col-md-4 text-md-end fs-5">Total: <strong>{{ total() | cop }}</strong></div>
    </div>

    <div class="card">
      <div class="table-responsive">
        <table class="table table-hover mb-0">
          <thead><tr><th>Fecha</th><th>Categoría</th><th>Descripción</th><th>Medio</th><th class="text-end">Valor</th><th></th></tr></thead>
          <tbody>
            @for (g of gastos(); track g.id) {
              <tr>
                <td>{{ g.fecha | fecha }}</td><td class="text-capitalize">{{ g.categoria }}</td><td>{{ g.descripcion }}</td><td>{{ g.metodo_pago }}</td>
                <td class="text-end">{{ g.valor | cop }}</td>
                <td class="text-end text-nowrap">
                  <button class="btn btn-sm btn-outline-primary me-1" (click)="form.set({ ...g })"><i class="bi bi-pencil"></i></button>
                  <button class="btn btn-sm btn-outline-danger" (click)="eliminar(g)"><i class="bi bi-trash"></i></button>
                </td>
              </tr>
            } @empty { <tr><td colspan="6" class="text-center text-muted py-4">Sin gastos en este rango.</td></tr> }
          </tbody>
        </table>
      </div>
    </div>

    @if (form(); as f) {
      <app-modal [titulo]="f.id ? 'Editar gasto' : 'Nuevo gasto'" tamano="md" (cerrar)="form.set(null)">
        <div class="row g-2">
          <div class="col-6"><label class="form-label">Fecha</label><input type="date" class="form-control" [(ngModel)]="f.fecha" /></div>
          <div class="col-6">
            <label class="form-label">Categoría</label>
            <select class="form-select text-capitalize" [(ngModel)]="f.categoria">@for (c of categorias; track c) { <option [value]="c">{{ c }}</option> }</select>
          </div>
          <div class="col-12"><label class="form-label">Descripción *</label><input class="form-control" [(ngModel)]="f.descripcion" /></div>
          <div class="col-6"><label class="form-label">Valor *</label><input type="number" min="1" class="form-control" [(ngModel)]="f.valor" /></div>
          <div class="col-6">
            <label class="form-label">Medio</label>
            <select class="form-select" [(ngModel)]="f.metodo_pago">@for (m of metodos; track m) { <option>{{ m }}</option> }</select>
          </div>
        </div>
        <ng-container pie>
          <button class="btn btn-light" (click)="form.set(null)">Cancelar</button>
          <button class="btn btn-primary" (click)="guardar(f)">Guardar</button>
        </ng-container>
      </app-modal>
    }
  `,
})
export class Gastos implements OnInit {
  private sb = inject(SupabaseService);
  private toast = inject(ToastService);
  categorias = CATEGORIAS_GASTO;
  metodos = METODOS_PAGO;
  hoy = hoyISO();
  gastos = signal<Gasto[]>([]);
  form = signal<Gasto | null>(null);
  desde = primerDiaMes();
  hasta = hoyISO();
  total = computed(() => this.gastos().reduce((a, g) => a + Number(g.valor), 0));

  ngOnInit() {
    this.cargar();
  }

  async cargar() {
    try {
      this.gastos.set(await this.sb.rpc('sel_gastos', { p_desde: this.desde || null, p_hasta: this.hasta || null }));
    } catch (e) {
      this.toast.error(e);
    }
  }

  async guardar(f: Gasto) {
    if (!f.descripcion?.trim() || !(Number(f.valor) > 0)) return this.toast.error('Descripción y valor son obligatorios');
    try {
      if (f.id) await this.sb.rpc('actualizar_gasto', { p_id: f.id, p_data: f });
      else await this.sb.rpc('guardar_gasto', { p_data: f });
      this.toast.ok('Gasto guardado');
      this.form.set(null);
      this.cargar();
    } catch (e) {
      this.toast.error(e);
    }
  }

  async eliminar(g: Gasto) {
    if (!confirm('¿Eliminar este gasto?')) return;
    try {
      await this.sb.rpc('eliminar_gasto', { p_id: g.id });
      this.cargar();
    } catch (e) {
      this.toast.error(e);
    }
  }
}

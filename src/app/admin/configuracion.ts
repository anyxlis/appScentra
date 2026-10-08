import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../core/supabase.service';
import { ToastService } from '../core/toast.service';
import { Configuracion as Config } from '../core/models';
import { hoyISO, mensajeRecordatorio } from '../core/utils';

@Component({
  selector: 'app-configuracion',
  imports: [FormsModule],
  template: `
    <h2 class="mb-3">Configuración</h2>
    @if (c(); as c) {
      <div class="card" style="max-width: 820px">
        <div class="card-body row g-3">
          <div class="col-md-6"><label class="form-label">Nombre del negocio</label><input class="form-control" [(ngModel)]="c.nombre_negocio" /></div>
          <div class="col-md-6"><label class="form-label">NIT / Documento</label><input class="form-control" [(ngModel)]="c.nit" /></div>
          <div class="col-md-6">
            <label class="form-label">WhatsApp de la tienda *</label>
            <input class="form-control" [(ngModel)]="c.telefono_whatsapp" placeholder="573001234567" />
            <small class="text-muted">Con indicativo 57, sin + ni espacios. Aquí llegan los pedidos del catálogo.</small>
          </div>
          <div class="col-md-6"><label class="form-label">Instagram</label><input class="form-control" [(ngModel)]="c.instagram" /></div>
          <div class="col-md-6"><label class="form-label">Dirección</label><input class="form-control" [(ngModel)]="c.direccion" /></div>
          <div class="col-md-3"><label class="form-label">Ciudad</label><input class="form-control" [(ngModel)]="c.ciudad" /></div>
          <div class="col-md-3"><label class="form-label">Correo</label><input class="form-control" [(ngModel)]="c.email" /></div>
          <div class="col-md-3">
            <label class="form-label">Prefijo factura</label><input class="form-control" [(ngModel)]="c.prefijo_factura" />
            <small class="text-muted">Última: {{ c.prefijo_factura }}-{{ (c.consecutivo_factura ?? 0).toString().padStart(5, '0') }}</small>
          </div>
          <div class="col-md-9"><label class="form-label">Pie de la factura (PDF)</label><input class="form-control" [(ngModel)]="c.pie_factura" /></div>
          <div class="col-12">
            <label class="form-label">Mensaje de recordatorio de cobro</label>
            <textarea class="form-control" rows="4" [(ngModel)]="c.mensaje_recordatorio"></textarea>
            <small class="text-muted">Variables: {{ '{cliente}' }} {{ '{factura}' }} {{ '{valor}' }} {{ '{fecha}' }} {{ '{saldo}' }}</small>
            <div class="alert alert-light border small mt-2 mb-0" style="white-space: pre-wrap">{{ vistaPrevia(c.mensaje_recordatorio) }}</div>
          </div>
        </div>
        <div class="card-footer bg-white text-end">
          <button class="btn btn-primary" (click)="guardar(c)">Guardar</button>
        </div>
      </div>
    }
  `,
})
export class Configuracion implements OnInit {
  private sb = inject(SupabaseService);
  private toast = inject(ToastService);
  c = signal<Config | null>(null);

  async ngOnInit() {
    try {
      this.c.set(await this.sb.rpc<Config>('sel_configuracion'));
    } catch (e) {
      this.toast.error(e);
    }
  }

  vistaPrevia(p: string) {
    return mensajeRecordatorio(p || '', { cliente: 'María', factura: 'SC-00012', valor: 75000, fecha: hoyISO(), saldo: 150000 });
  }

  async guardar(c: Config) {
    try {
      await this.sb.rpc('actualizar_configuracion', { p_data: c });
      this.toast.ok('Configuración guardada');
    } catch (e) {
      this.toast.error(e);
    }
  }
}

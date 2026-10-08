import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SupabaseService } from '../core/supabase.service';
import { ToastService } from '../core/toast.service';
import { CarteraCliente, Configuracion, CuotaPorCobrar } from '../core/models';
import { mensajeRecordatorio, urlWhatsapp } from '../core/utils';
import { CopPipe, FechaPipe } from '../shared/pipes';

type Pestana = 'hoy' | 'vencidas' | 'proximas' | 'clientes';

@Component({
  selector: 'app-cartera',
  imports: [RouterLink, DatePipe, CopPipe, FechaPipe],
  template: `
    <h2 class="mb-3">Cartera y cobros</h2>

    <div class="row g-3 mb-3">
      <div class="col-6 col-md-3"><div class="card kpi p-3"><div class="kpi-label">Me deben</div><div class="kpi-valor">{{ totalDeuda() | cop }}</div></div></div>
      <div class="col-6 col-md-3"><div class="card kpi peligro p-3"><div class="kpi-label">En mora</div><div class="kpi-valor">{{ totalMora() | cop }}</div></div></div>
      <div class="col-6 col-md-3"><div class="card kpi peligro p-3"><div class="kpi-label">Clientes en mora</div><div class="kpi-valor">{{ clientesMora() }}</div></div></div>
      <div class="col-6 col-md-3"><div class="card kpi p-3"><div class="kpi-label">Clientes que deben</div><div class="kpi-valor">{{ cartera().length }}</div></div></div>
    </div>

    <ul class="nav nav-tabs mb-3">
      @for (t of pestanas; track t.id) {
        <li class="nav-item">
          <button class="nav-link" [class.active]="pestana() === t.id" (click)="cambiar(t.id)">
            {{ t.texto }} @if (t.id === 'hoy' && conteoHoy() > 0) { <span class="badge text-bg-danger">{{ conteoHoy() }}</span> }
          </button>
        </li>
      }
    </ul>

    @if (pestana() === 'clientes') {
      <div class="card">
        <div class="table-responsive">
          <table class="table table-hover mb-0">
            <thead><tr><th>Cliente</th><th>Teléfono</th><th class="text-center">Facturas</th><th class="text-end">Debe</th><th class="text-end">Vencido</th><th>Mora</th><th>Próx. cobro</th></tr></thead>
            <tbody>
              @for (c of cartera(); track c.cliente_id) {
                <tr [class.table-danger]="c.estado === 'en_mora'">
                  <td class="fw-semibold">{{ c.cliente }}</td>
                  <td>{{ c.telefono }}</td>
                  <td class="text-center">{{ c.facturas }}</td>
                  <td class="text-end">{{ c.saldo_total | cop }}</td>
                  <td class="text-end">{{ c.saldo_vencido | cop }}</td>
                  <td>@if (c.dias_mora > 0) { <span class="badge text-bg-danger">{{ c.dias_mora }} días</span> } @else { <span class="badge text-bg-info">al día</span> }</td>
                  <td>{{ c.proxima_fecha | fecha }}</td>
                </tr>
              } @empty { <tr><td colspan="7" class="text-center text-muted py-4">Nadie te debe.</td></tr> }
            </tbody>
          </table>
        </div>
      </div>
    } @else {
      <div class="card">
        <div class="table-responsive">
          <table class="table table-hover mb-0">
            <thead><tr><th>Cliente</th><th>Factura</th><th>Cuota</th><th>Fecha de cobro</th><th class="text-end">Valor cuota</th><th class="text-end">Saldo factura</th><th>Último recordatorio</th><th></th></tr></thead>
            <tbody>
              @for (q of cuotas(); track q.cuota_id) {
                <tr>
                  <td><div class="fw-semibold">{{ q.cliente_nombre }}</div><small class="text-muted">{{ q.telefono_cobro }}</small></td>
                  <td><a [routerLink]="['/admin/ventas', q.factura_id]">{{ q.numero_factura }}</a></td>
                  <td>{{ q.cuota === 0 ? 'Inicial' : q.cuota }}</td>
                  <td>{{ q.fecha_vencimiento | fecha }} @if (q.dias_mora > 0) { <span class="badge text-bg-danger">{{ q.dias_mora }} d</span> }</td>
                  <td class="text-end fw-semibold">{{ q.saldo_cuota | cop }}</td>
                  <td class="text-end">{{ q.saldo_factura | cop }}</td>
                  <td class="small">{{ q.ultimo_recordatorio ? (q.ultimo_recordatorio | date: 'dd/MM HH:mm') : '—' }}</td>
                  <td class="text-end">
                    <button class="btn btn-sm btn-success text-nowrap" (click)="recordar(q)" [disabled]="!q.autoriza_whatsapp"
                            [title]="q.autoriza_whatsapp ? 'Abrir WhatsApp con el recordatorio' : 'El cliente no autorizó WhatsApp'">
                      <i class="bi bi-whatsapp"></i> Recordar
                    </button>
                  </td>
                </tr>
              } @empty { <tr><td colspan="8" class="text-center text-muted py-4">No hay cobros en esta lista.</td></tr> }
            </tbody>
          </table>
        </div>
      </div>
    }
  `,
})
export class Cartera implements OnInit {
  private sb = inject(SupabaseService);
  private toast = inject(ToastService);

  pestanas: { id: Pestana; texto: string }[] = [
    { id: 'hoy', texto: 'Cobrar hoy' },
    { id: 'vencidas', texto: 'En mora' },
    { id: 'proximas', texto: 'Próximos 7 días' },
    { id: 'clientes', texto: 'Por cliente' },
  ];
  pestana = signal<Pestana>('hoy');
  cuotas = signal<CuotaPorCobrar[]>([]);
  cartera = signal<CarteraCliente[]>([]);
  conteoHoy = signal(0);
  cfg = signal<Configuracion | null>(null);

  totalDeuda = computed(() => this.cartera().reduce((a, c) => a + Number(c.saldo_total), 0));
  totalMora = computed(() => this.cartera().reduce((a, c) => a + Number(c.saldo_vencido), 0));
  clientesMora = computed(() => this.cartera().filter((c) => c.estado === 'en_mora').length);

  async ngOnInit() {
    try {
      const [cartera, cfg] = await Promise.all([
        this.sb.rpc<CarteraCliente[]>('sel_cartera'),
        this.sb.rpc<Configuracion>('sel_configuracion'),
      ]);
      this.cartera.set(cartera);
      this.cfg.set(cfg);
    } catch (e) {
      this.toast.error(e);
    }
    await this.cambiar('hoy');
    this.conteoHoy.set(this.cuotas().length);
  }

  async cambiar(p: Pestana) {
    this.pestana.set(p);
    if (p === 'clientes') return;
    try {
      this.cuotas.set(await this.sb.rpc<CuotaPorCobrar[]>('sel_cuotas_por_cobrar', { p_filtro: p }));
    } catch (e) {
      this.toast.error(e);
    }
  }

  recordar(q: CuotaPorCobrar) {
    const plantilla = this.cfg()?.mensaje_recordatorio ?? 'Hola {cliente}, tu factura {factura} tiene un saldo de {saldo}.';
    const msg = mensajeRecordatorio(plantilla, {
      cliente: q.cliente_nombre,
      factura: q.numero_factura,
      valor: q.saldo_cuota,
      fecha: q.fecha_vencimiento,
      saldo: q.saldo_factura,
    });
    window.open(urlWhatsapp(q.telefono_cobro, msg), '_blank');
    this.sb
      .rpc('guardar_recordatorio', { p_factura_id: q.factura_id, p_cuota_id: q.cuota_id, p_telefono: q.telefono_cobro, p_mensaje: msg })
      .then(() => this.cambiar(this.pestana()))
      .catch(() => undefined);
  }
}

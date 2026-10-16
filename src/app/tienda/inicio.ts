import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SupabaseService } from '../core/supabase.service';
import { PwaService } from '../core/pwa.service';
import { Producto, TipoProducto } from '../core/models';
import { CopPipe } from '../shared/pipes';
import { ProductoCard } from './producto-card';

@Component({
  selector: 'app-inicio',
  imports: [RouterLink, ProductoCard, CopPipe],
  template: `
    <section class="hero-tienda">
      <div class="container py-5">
        <div class="row align-items-center g-5 py-lg-4">
          <div class="col-lg-7 text-center text-lg-start">
            <h1 class="titular mb-4">Un susurro de seducción en cada gota</h1>
            <p class="bajada mx-auto mx-lg-0 mb-4">
              Fragancias originales, 1.1 e inspiradas en los aromas más icónicos, potenciadas con feromonas. Elige la tuya, arma tu pedido
              y te lo confirmamos por WhatsApp.
            </p>
            <div class="d-flex gap-2 justify-content-center justify-content-lg-start flex-wrap">
              <a routerLink="/catalogo" class="btn btn-primary btn-lg px-4"><i class="bi bi-grid"></i> Ver catálogo</a>
              @if (pwa.mostrarBoton()) {
                <button class="btn btn-suave btn-lg px-4" (click)="pwa.instalar()"><i class="bi bi-phone"></i> Instalar la app</button>
              } @else {
                <a routerLink="/catalogo" [queryParams]="{ tipo: 'imitacion' }" class="btn btn-suave btn-lg px-4">Inspiradas 30 y 60 ml</a>
              }
            </div>
            <div class="d-flex gap-4 justify-content-center justify-content-lg-start mt-4 small text-tenue flex-wrap">
              <span><i class="bi bi-truck me-1 text-dorado"></i>Envíos desde Montería</span>
              <span><i class="bi bi-credit-card me-1 text-dorado"></i>Contado o financiado</span>
              <span><i class="bi bi-shop me-1 text-dorado"></i>Detal y por mayor</span>
            </div>
          </div>
          <div class="col-lg-5 text-center">
            <img src="img/logo.png" alt="SCENTRA" class="frasco" />
          </div>
        </div>
      </div>
    </section>

    <section class="container py-5">
      <h2 class="mb-1">Elige tu estilo</h2>
      <p class="text-tenue mb-4">Tres líneas, un mismo cuidado por el aroma.</p>
      <div class="row g-3">
        @for (t of lineas; track t.tipo) {
          <div class="col-md-4">
            <a class="ficha-tipo" routerLink="/catalogo" [queryParams]="{ tipo: t.tipo }">
              <div class="d-flex justify-content-between align-items-start mb-2">
                <span class="ficha-tipo-titulo">{{ t.titulo }}</span><i class="bi" [class]="t.icono"></i>
              </div>
              <p class="text-tenue small mb-3">{{ t.texto }}</p>
              <div class="d-flex justify-content-between align-items-center small">
                <span>@if (desde()[t.tipo]; as d) { Desde <strong class="cifra">{{ d | cop }}</strong> } @else { Ver opciones }</span>
                <span class="fw-medium" style="color: var(--sc-champan-osc)">Explorar <i class="bi bi-chevron-right"></i></span>
              </div>
            </a>
          </div>
        }
      </div>
    </section>

    @if (destacados().length) {
      <section class="container pb-5">
        <div class="d-flex justify-content-between align-items-end mb-3">
          <div><h2 class="mb-1">Los más pedidos</h2><p class="text-tenue mb-0 small">Toca la presentación (ml) y agrégala a tu pedido.</p></div>
          <a routerLink="/catalogo" class="link-secondary small text-nowrap">Ver todo <i class="bi bi-chevron-right"></i></a>
        </div>
        <div class="row row-cols-2 row-cols-md-3 row-cols-lg-4 g-2 g-md-3">
          @for (p of destacados(); track p.id) {
            <div class="col"><app-producto-card [producto]="p" /></div>
          }
        </div>
      </section>
    }

    <section class="container pb-5">
      <div class="card border-0 p-4 p-lg-5" style="background: #f3eadb">
        <div class="row g-4 align-items-center">
          <div class="col-lg-4">
            <h2 class="mb-2">Así de fácil pides</h2>
            <p class="text-tenue mb-0">Sin registros ni pagos en línea: hablas directo con nosotros.</p>
          </div>
          <div class="col-lg-8">
            <div class="pasos-pedido row g-4">
              <div class="col-md-4 paso"><div><div class="fw-semibold">Elige</div><small class="text-tenue">Tu fragancia y la presentación en ml.</small></div></div>
              <div class="col-md-4 paso"><div><div class="fw-semibold">Envía</div><small class="text-tenue">Tu pedido por WhatsApp con un toque.</small></div></div>
              <div class="col-md-4 paso"><div><div class="fw-semibold">Recibe</div><small class="text-tenue">Confirmamos, acordamos el pago y te lo llevamos.</small></div></div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="container pb-4">
      <div class="text-center py-4">
        <h2>Detal y planes mayoristas</h2>
        <p class="text-tenue mx-auto" style="max-width: 560px">
          Si quieres revender, arma tu pedido en el catálogo y pregúntanos por precios por volumen.
        </p>
        <a routerLink="/catalogo" class="btn btn-dorado btn-lg px-4">Armar mi pedido</a>
      </div>
    </section>
  `,
})
export class Inicio implements OnInit {
  private sb = inject(SupabaseService);
  pwa = inject(PwaService);
  todos = signal<Producto[]>([]);

  lineas: { tipo: TipoProducto; titulo: string; texto: string; icono: string }[] = [
    { tipo: 'original', titulo: 'Originales', texto: 'Las fragancias de siempre, 100% originales de la casa.', icono: 'bi-gem' },
    { tipo: '1.1', titulo: 'Réplicas 1.1', texto: 'Presentación y calidad premium a un precio más amable.', icono: 'bi-stars' },
    { tipo: 'imitacion', titulo: 'Inspiradas', texto: 'En 30 y 60 ml, con feromonas y gran duración.', icono: 'bi-droplet-half' },
  ];

  destacados = computed(() => {
    const t = this.todos();
    const d = t.filter((p) => p.destacado);
    return (d.length ? d : t).slice(0, 8);
  });

  desde = computed(() => {
    const r: Partial<Record<TipoProducto, number>> = {};
    for (const p of this.todos()) {
      for (const pr of p.presentaciones ?? []) {
        const v = Number(pr.precio_venta);
        if (v > 0 && (!r[p.tipo] || v < r[p.tipo]!)) r[p.tipo] = v;
      }
    }
    return r;
  });

  async ngOnInit() {
    try {
      this.todos.set(await this.sb.rpc<Producto[]>('sel_catalogo'));
    } catch {
      this.todos.set([]);
    }
  }
}

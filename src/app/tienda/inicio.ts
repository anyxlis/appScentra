import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SupabaseService } from '../core/supabase.service';
import { Producto } from '../core/models';
import { ProductoCard } from './producto-card';

@Component({
  selector: 'app-inicio',
  imports: [RouterLink, ProductoCard],
  template: `
    <section class="hero py-5">
      <div class="container py-lg-4">
        <div class="row align-items-center g-5">
          <div class="col-lg-6 text-center text-lg-start">
            <p class="text-dorado text-uppercase fw-semibold small mb-2" style="letter-spacing: .2em">Fragancias con feromonas</p>
            <h1 class="mb-3">Un susurro de seducción en cada gota</h1>
            <p class="lead text-secondary">
              Fragancias inspiradas en los aromas más icónicos del mundo, potenciadas con feromonas para transmitir confianza,
              atracción y estilo.
            </p>
            <div class="d-flex gap-2 justify-content-center justify-content-lg-start flex-wrap mt-4">
              <a routerLink="/catalogo" class="btn btn-primary btn-lg px-4">Ver catálogo</a>
              <a routerLink="/catalogo" [queryParams]="{ tipo: 'imitacion' }" class="btn btn-outline-primary btn-lg px-4">Inspiradas 30 / 60 ml</a>
            </div>
          </div>
          <div class="col-lg-6 text-center">
            <img src="img/logo.png" alt="SCENTRA" class="logo-hero" />
          </div>
        </div>
      </div>
    </section>

    <section class="container py-5">
      <div class="row g-4 text-center">
        <div class="col-md-4">
          <i class="bi bi-gem fs-1 text-dorado"></i>
          <h4 class="mt-2">Originales</h4>
          <p class="text-secondary small mb-0">Las fragancias de siempre, 100% originales.</p>
        </div>
        <div class="col-md-4">
          <i class="bi bi-stars fs-1 text-dorado"></i>
          <h4 class="mt-2">1.1</h4>
          <p class="text-secondary small mb-0">Calidad y presentación premium a mejor precio.</p>
        </div>
        <div class="col-md-4">
          <i class="bi bi-droplet-half fs-1 text-dorado"></i>
          <h4 class="mt-2">Inspiradas</h4>
          <p class="text-secondary small mb-0">En 30 ml y 60 ml, con feromonas y gran duración.</p>
        </div>
      </div>
    </section>

    @if (destacados().length) {
      <section class="container pb-4">
        <div class="d-flex justify-content-between align-items-end mb-3">
          <h2 class="mb-0">Destacados</h2>
          <a routerLink="/catalogo" class="link-secondary">Ver todo <i class="bi bi-arrow-right"></i></a>
        </div>
        <div class="row row-cols-2 row-cols-md-3 row-cols-lg-4 g-3">
          @for (p of destacados(); track p.id) {
            <div class="col"><app-producto-card [producto]="p" /></div>
          }
        </div>
      </section>
    }

    <section class="container py-5">
      <div class="card border-0 bg-crema p-4 p-lg-5 text-center">
        <h2>Detal y planes mayoristas</h2>
        <p class="text-secondary mx-auto" style="max-width: 640px">
          Desde Montería acercamos lujo y seducción a precios accesibles. Arma tu pedido en el catálogo y te lo confirmamos
          por WhatsApp.
        </p>
        <div><a routerLink="/catalogo" class="btn btn-dorado btn-lg px-4">Armar mi pedido</a></div>
      </div>
    </section>
  `,
})
export class Inicio implements OnInit {
  private sb = inject(SupabaseService);
  destacados = signal<Producto[]>([]);

  async ngOnInit() {
    try {
      const todos = await this.sb.rpc<Producto[]>('sel_catalogo');
      const dest = todos.filter((p) => p.destacado);
      this.destacados.set((dest.length ? dest : todos).slice(0, 8));
    } catch {
      this.destacados.set([]);
    }
  }
}

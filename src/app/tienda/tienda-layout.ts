import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CarritoService } from '../core/carrito.service';
import { ConfigService } from '../core/config.service';
import { telefonoWa } from '../core/utils';

@Component({
  selector: 'app-tienda-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <nav class="navbar navbar-expand-md navbar-tienda sticky-top">
      <div class="container">
        <a class="navbar-brand d-flex align-items-center gap-2" routerLink="/">
          <img src="img/logo.png" alt="SCENTRA" />
          <span class="fuente-marca fs-3 fw-bold text-primary">SCENTRA</span>
        </a>
        <div class="d-flex align-items-center gap-2 order-md-last">
          <a routerLink="/carrito" class="btn btn-primary position-relative" aria-label="Ver pedido">
            <i class="bi bi-bag"></i>
            @if (carrito.cantidad() > 0) {
              <span class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-secondary">{{ carrito.cantidad() }}</span>
            }
          </a>
          <button class="navbar-toggler" type="button" (click)="menu.set(!menu())" aria-label="Menú">
            <span class="navbar-toggler-icon"></span>
          </button>
        </div>
        <div class="collapse navbar-collapse" [class.show]="menu()">
          <ul class="navbar-nav ms-auto me-3">
            <li class="nav-item"><a class="nav-link" routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" (click)="menu.set(false)">Inicio</a></li>
            <li class="nav-item"><a class="nav-link" routerLink="/catalogo" [queryParams]="{}" routerLinkActive="active" (click)="menu.set(false)">Catálogo</a></li>
            <li class="nav-item"><a class="nav-link" routerLink="/catalogo" [queryParams]="{ tipo: 'original' }" (click)="menu.set(false)">Originales</a></li>
            <li class="nav-item"><a class="nav-link" routerLink="/catalogo" [queryParams]="{ tipo: '1.1' }" (click)="menu.set(false)">1.1</a></li>
            <li class="nav-item"><a class="nav-link" routerLink="/catalogo" [queryParams]="{ tipo: 'imitacion' }" (click)="menu.set(false)">Inspiradas</a></li>
          </ul>
        </div>
      </div>
    </nav>

    <main><router-outlet /></main>

    <footer class="pie py-5 mt-5">
      <div class="container">
        <div class="row g-4 align-items-center">
          <div class="col-md-6">
            <div class="fuente-marca fs-2">SCENTRA</div>
            <p class="mb-0 fst-italic opacity-75">Un susurro de seducción en cada gota.</p>
          </div>
          <div class="col-md-6 text-md-end">
            <p class="mb-1"><i class="bi bi-geo-alt"></i> {{ cfg.publica().ciudad || 'Montería' }}, Colombia</p>
            <p class="mb-1">
              <a [href]="'https://instagram.com/' + (cfg.publica().instagram || 'scentra.vip')" target="_blank" rel="noopener">
                <i class="bi bi-instagram"></i> &#64;{{ cfg.publica().instagram || 'scentra.vip' }}
              </a>
            </p>
            @if (waLink()) {
              <p class="mb-0"><a [href]="waLink()" target="_blank" rel="noopener"><i class="bi bi-whatsapp"></i> Escríbenos</a></p>
            }
          </div>
        </div>
      </div>
    </footer>

    @if (waLink()) {
      <a class="whatsapp-flotante" [href]="waLink()" target="_blank" rel="noopener" aria-label="WhatsApp"><i class="bi bi-whatsapp"></i></a>
    }
  `,
})
export class TiendaLayout implements OnInit {
  carrito = inject(CarritoService);
  cfg = inject(ConfigService);
  menu = signal(false);
  waLink = computed(() => {
    const t = this.cfg.publica().telefono_whatsapp;
    return t ? `https://wa.me/${telefonoWa(t)}?text=${encodeURIComponent('Hola SCENTRA, quiero información sobre sus fragancias.')}` : '';
  });

  ngOnInit() {
    this.cfg.cargar();
  }
}

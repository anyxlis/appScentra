import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CarritoService } from '../core/carrito.service';
import { ConfigService } from '../core/config.service';
import { PwaService } from '../core/pwa.service';
import { telefonoWa } from '../core/utils';

@Component({
  selector: 'app-tienda-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <nav class="navbar navbar-expand-md navbar-tienda sticky-top">
      <div class="container">
        <a class="navbar-brand d-flex align-items-center gap-2" routerLink="/">
          <img src="img/logo.png" alt="" />
          <span class="fuente-marca fs-4 fw-bold" style="color: var(--sc-espresso)">SCENTRA</span>
        </a>
        <div class="d-flex align-items-center gap-2 order-md-last">
          @if (pwa.mostrarBoton()) {
            <button class="btn btn-suave btn-sm d-none d-md-inline-flex" (click)="pwa.instalar()"><i class="bi bi-phone"></i> Instalar app</button>
          }
          <a routerLink="/carrito" class="btn btn-primary position-relative d-none d-md-inline-flex" aria-label="Ver mi pedido">
            <i class="bi bi-bag"></i> Mi pedido
            @if (carrito.cantidad() > 0) {
              <span class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-secondary">{{ carrito.cantidad() }}</span>
            }
          </a>
          @if (pwa.mostrarBoton()) {
            <button class="btn btn-suave btn-sm d-md-none" (click)="pwa.instalar()" aria-label="Instalar la app"><i class="bi bi-download"></i> App</button>
          }
          <a routerLink="/admin" class="btn btn-suave btn-icono d-md-none" aria-label="Ingresar a administración" title="Administración"><i class="bi bi-person-lock"></i></a>
        </div>
        <div class="collapse navbar-collapse d-none d-md-flex">
          <ul class="navbar-nav ms-auto me-3">
            <li class="nav-item"><a class="nav-link" routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Inicio</a></li>
            <li class="nav-item"><a class="nav-link" routerLink="/catalogo" routerLinkActive="active">Catálogo</a></li>
            <li class="nav-item"><a class="nav-link" routerLink="/catalogo" [queryParams]="{ tipo: 'original' }">Originales</a></li>
            <li class="nav-item"><a class="nav-link" routerLink="/catalogo" [queryParams]="{ tipo: '1.1' }">1.1</a></li>
            <li class="nav-item"><a class="nav-link" routerLink="/catalogo" [queryParams]="{ tipo: 'imitacion' }">Inspiradas</a></li>
          </ul>
        </div>
      </div>
    </nav>

    <main><router-outlet /></main>

    <footer class="pie pt-5 pb-4 mt-5 con-barra-movil">
      <div class="container">
        <div class="row g-4 align-items-start">
          <div class="col-md-5">
            <div class="d-flex align-items-center gap-3 mb-2">
              <img src="img/logo.png" alt="" width="52" height="52" class="rounded-circle" />
              <div class="fuente-marca fs-3">SCENTRA</div>
            </div>
            <p class="mb-0 fst-italic" style="font-family: 'Cormorant Garamond', serif; font-size: 1.15rem">Un susurro de seducción en cada gota.</p>
          </div>
          <div class="col-6 col-md-3">
            <div class="fw-medium text-white mb-2">Tienda</div>
            <div class="d-grid gap-1 small">
              <a routerLink="/catalogo">Catálogo completo</a>
              <a routerLink="/catalogo" [queryParams]="{ tipo: 'original' }">Originales</a>
              <a routerLink="/catalogo" [queryParams]="{ tipo: 'imitacion' }">Inspiradas 30 y 60 ml</a>
              <a routerLink="/carrito">Mi pedido</a>
            </div>
          </div>
          <div class="col-6 col-md-4">
            <div class="fw-medium text-white mb-2">Contacto</div>
            <div class="d-grid gap-1 small">
              <span><i class="bi bi-geo-alt me-1"></i>{{ cfg.publica().ciudad || 'Montería' }}, Colombia</span>
              <a [href]="'https://instagram.com/' + (cfg.publica().instagram || 'scentra.vip')" target="_blank" rel="noopener"><i class="bi bi-instagram me-1"></i>&#64;{{ cfg.publica().instagram || 'scentra.vip' }}</a>
              @if (waLink()) { <a [href]="waLink()" target="_blank" rel="noopener"><i class="bi bi-whatsapp me-1"></i>Escríbenos por WhatsApp</a> }
              @if (pwa.mostrarBoton()) { <a href="#" (click)="$event.preventDefault(); pwa.instalar()"><i class="bi bi-phone me-1"></i>Instala la app en tu celular</a> }
            </div>
          </div>
        </div>
        <div class="small mt-4 pt-3 d-flex justify-content-between flex-wrap gap-2" style="border-top: 1px solid rgba(255,255,255,.1); opacity: .6">
          <span>© {{ anio }} SCENTRA</span>
          <a routerLink="/admin">Acceso administración</a>
        </div>
      </div>
    </footer>

    @if (waLink()) {
      <a class="whatsapp-flotante" [href]="waLink()" target="_blank" rel="noopener" aria-label="Escríbenos por WhatsApp"><i class="bi bi-whatsapp"></i></a>
    }

    <nav class="barra-movil d-md-none" aria-label="Navegación">
      <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }"><i class="bi bi-house"></i>Inicio</a>
      <a routerLink="/catalogo" routerLinkActive="active"><i class="bi bi-grid"></i>Catálogo</a>
      <a routerLink="/carrito" routerLinkActive="active"><i class="bi bi-bag"></i>Mi pedido
        @if (carrito.cantidad() > 0) { <span class="contador">{{ carrito.cantidad() }}</span> }
      </a>
      @if (waLink()) {
        <a [href]="waLink()" target="_blank" rel="noopener"><i class="bi bi-whatsapp" style="color:#1f9e55"></i>WhatsApp</a>
      } @else {
        <a routerLink="/catalogo" [queryParams]="{ tipo: 'original' }"><i class="bi bi-gem"></i>Originales</a>
      }
    </nav>
  `,
})
export class TiendaLayout implements OnInit {
  carrito = inject(CarritoService);
  cfg = inject(ConfigService);
  pwa = inject(PwaService);
  menu = signal(false);
  anio = new Date().getFullYear();
  waLink = computed(() => {
    const t = this.cfg.publica().telefono_whatsapp;
    return t ? `https://wa.me/${telefonoWa(t)}?text=${encodeURIComponent('Hola SCENTRA, quiero información sobre sus fragancias.')}` : '';
  });

  ngOnInit() {
    this.cfg.cargar();
  }
}

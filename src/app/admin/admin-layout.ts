import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SupabaseService } from '../core/supabase.service';

@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="admin-wrap">
      <aside class="admin-sidebar d-flex flex-column p-3" [class.abierto]="menu()">
        <a routerLink="/admin" class="brand d-flex align-items-center gap-2 text-decoration-none mb-4 px-2">
          <img src="img/logo.png" alt="" />
          <span class="fuente-marca fs-4 text-white">SCENTRA</span>
        </a>
        <nav class="nav flex-column gap-1 flex-grow-1">
          @for (l of links; track l.ruta) {
            <a class="nav-link" [routerLink]="l.ruta" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: l.exacto ?? false }" (click)="menu.set(false)">
              <i class="bi" [class]="l.icono"></i> {{ l.texto }}
            </a>
          }
        </nav>
        <hr class="border-secondary" />
        <a routerLink="/" class="nav-link" target="_blank"><i class="bi bi-shop"></i> Ver tienda</a>
        <button class="nav-link text-start border-0 bg-transparent" (click)="salir()"><i class="bi bi-box-arrow-left"></i> Cerrar sesión</button>
      </aside>
      @if (menu()) {
        <div class="modal-backdrop show d-lg-none" style="z-index: 1040" (click)="menu.set(false)"></div>
      }

      <div class="admin-main">
        <header class="d-lg-none bg-white border-bottom px-3 py-2 d-flex align-items-center gap-2 sticky-top no-print">
          <button class="btn btn-outline-primary btn-sm" (click)="menu.set(true)" aria-label="Menú"><i class="bi bi-list"></i></button>
          <span class="fuente-marca fs-5 fw-bold">SCENTRA</span>
        </header>
        <div class="p-3 p-md-4"><router-outlet /></div>
      </div>
    </div>
  `,
})
export class AdminLayout {
  private sb = inject(SupabaseService);
  private router = inject(Router);
  menu = signal(false);

  links: { ruta: string; texto: string; icono: string; exacto?: boolean }[] = [
    { ruta: '/admin', texto: 'Resumen', icono: 'bi-speedometer2', exacto: true },
    { ruta: '/admin/ventas', texto: 'Facturas de venta', icono: 'bi-receipt' },
    { ruta: '/admin/cartera', texto: 'Cartera y cobros', icono: 'bi-cash-coin' },
    { ruta: '/admin/compras', texto: 'Facturas de compra', icono: 'bi-truck' },
    { ruta: '/admin/productos', texto: 'Productos', icono: 'bi-droplet-half' },
    { ruta: '/admin/inventario', texto: 'Inventario', icono: 'bi-box-seam' },
    { ruta: '/admin/clientes', texto: 'Clientes', icono: 'bi-people' },
    { ruta: '/admin/proveedores', texto: 'Proveedores', icono: 'bi-building' },
    { ruta: '/admin/gastos', texto: 'Gastos', icono: 'bi-wallet2' },
    { ruta: '/admin/informes', texto: 'Informes', icono: 'bi-graph-up' },
    { ruta: '/admin/configuracion', texto: 'Configuración', icono: 'bi-gear' },
  ];

  async salir() {
    await this.sb.logout();
    this.router.navigateByUrl('/admin/login');
  }
}

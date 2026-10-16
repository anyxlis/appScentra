import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { SupabaseService } from '../core/supabase.service';
import { PwaService } from '../core/pwa.service';

interface Enlace { ruta: string; texto: string; icono: string; exacto?: boolean }

@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="admin-wrap">
      <aside class="admin-sidebar d-flex flex-column p-3" [class.abierto]="menu()" aria-label="Menú principal">
        <div class="d-flex align-items-center justify-content-between mb-3 px-1">
          <a routerLink="/admin" class="brand d-flex align-items-center gap-2 text-decoration-none" (click)="menu.set(false)">
            <img src="img/logo.png" alt="" />
            <span>
              <span class="fuente-marca fs-5 text-white d-block lh-1">SCENTRA</span>
              <small style="color: var(--sc-champan)">Panel del negocio</small>
            </span>
          </a>
          <button class="btn btn-sm text-white d-lg-none" (click)="menu.set(false)" aria-label="Cerrar menú"><i class="bi bi-x-lg"></i></button>
        </div>

        <a routerLink="/admin/ventas/nueva" class="btn btn-nueva-venta w-100 mb-2" (click)="menu.set(false)"><i class="bi bi-plus-lg"></i> Nueva venta</a>

        <nav class="nav flex-column flex-grow-1">
          @for (g of grupos; track g.nombre) {
            <div class="grupo">{{ g.nombre }}</div>
            @for (l of g.enlaces; track l.ruta) {
              <a class="nav-link" [routerLink]="l.ruta" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: l.exacto ?? false }" (click)="menu.set(false)">
                <i class="bi" [class]="l.icono"></i> {{ l.texto }}
              </a>
            }
          }
        </nav>

        <div class="mt-3 pt-3" style="border-top: 1px solid rgba(255,255,255,.1)">
          @if (pwa.mostrarBoton()) {
            <button class="nav-link w-100 border-0 bg-transparent" (click)="pwa.instalar()"><i class="bi bi-phone"></i> Instalar en el celular</button>
          }
          <a routerLink="/" class="nav-link" target="_blank"><i class="bi bi-shop"></i> Ver tienda</a>
          <button class="nav-link w-100 border-0 bg-transparent" (click)="salir()"><i class="bi bi-box-arrow-left"></i> Cerrar sesión</button>
          @if (correo()) { <div class="small px-3 pt-2 text-truncate" style="color: rgba(250,245,236,.5)">{{ correo() }}</div> }
        </div>
      </aside>
      @if (menu()) {
        <div class="modal-backdrop show d-lg-none" style="z-index: 1040" (click)="menu.set(false)"></div>
      }

      <div class="admin-main">
        <header class="admin-top no-print">
          <button class="btn btn-suave btn-icono d-lg-none" (click)="menu.set(true)" aria-label="Abrir menú"><i class="bi bi-list fs-5"></i></button>
          <img src="img/logo.png" alt="" width="34" height="34" class="rounded-circle d-lg-none" />
          <div class="flex-grow-1" style="min-width: 0">
            <div class="titulo-ruta text-truncate"><span class="text-tenue d-none d-md-inline">Panel /</span> {{ titulo() }}</div>
            <div class="small text-tenue d-none d-md-block">{{ hoy }}</div>
          </div>
          @if (pwa.mostrarBoton()) {
            <button class="btn btn-suave btn-sm" (click)="pwa.instalar()"><i class="bi bi-download"></i><span class="d-none d-sm-inline">Instalar app</span></button>
          }
        </header>
        <main class="admin-contenido"><router-outlet /></main>
      </div>

      <nav class="admin-barra d-lg-none no-print" aria-label="Accesos rápidos">
        <a routerLink="/admin" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }"><i class="bi bi-grid-1x2"></i>Resumen</a>
        <a routerLink="/admin/ventas" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }"><i class="bi bi-receipt"></i>Ventas</a>
        <a routerLink="/admin/ventas/nueva" class="central" aria-label="Nueva venta"><i class="bi bi-plus-lg"></i>Vender</a>
        <a routerLink="/admin/cartera" routerLinkActive="active"><i class="bi bi-cash-coin"></i>Cobros</a>
        <button (click)="menu.set(true)"><i class="bi bi-three-dots"></i>Más</button>
      </nav>
    </div>
  `,
})
export class AdminLayout {
  private sb = inject(SupabaseService);
  private router = inject(Router);
  pwa = inject(PwaService);
  menu = signal(false);
  titulo = signal('Resumen');
  correo = computed(() => this.sb.session()?.user?.email ?? '');
  hoy = ((t: string) => t.charAt(0).toUpperCase() + t.slice(1))(
    new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota' }).format(new Date()),
  );

  grupos: { nombre: string; enlaces: Enlace[] }[] = [
    { nombre: 'Vender', enlaces: [
      { ruta: '/admin', texto: 'Resumen', icono: 'bi-grid-1x2', exacto: true },
      { ruta: '/admin/ventas', texto: 'Facturas de venta', icono: 'bi-receipt' },
      { ruta: '/admin/cartera', texto: 'Cartera y cobros', icono: 'bi-cash-coin' },
      { ruta: '/admin/clientes', texto: 'Clientes', icono: 'bi-people' },
    ] },
    { nombre: 'Comprar e inventario', enlaces: [
      { ruta: '/admin/compras', texto: 'Facturas de compra', icono: 'bi-truck' },
      { ruta: '/admin/proveedores', texto: 'Proveedores', icono: 'bi-building' },
      { ruta: '/admin/productos', texto: 'Productos', icono: 'bi-droplet-half' },
      { ruta: '/admin/inventario', texto: 'Inventario', icono: 'bi-box-seam' },
    ] },
    { nombre: 'Finanzas', enlaces: [
      { ruta: '/admin/gastos', texto: 'Gastos', icono: 'bi-wallet2' },
      { ruta: '/admin/informes', texto: 'Informes', icono: 'bi-graph-up-arrow' },
      { ruta: '/admin/configuracion', texto: 'Configuración', icono: 'bi-gear' },
    ] },
  ];

  constructor() {
    this.actualizarTitulo();
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => this.actualizarTitulo());
  }

  private actualizarTitulo() {
    let r = this.router.routerState.snapshot.root;
    while (r.firstChild) r = r.firstChild;
    const t = (r.title ?? 'Resumen').replace(' · SCENTRA', '');
    this.titulo.set(t === 'Panel' ? 'Resumen' : t);
  }

  async salir() {
    await this.sb.logout();
    this.router.navigateByUrl('/admin/login');
  }
}

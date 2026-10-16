import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SupabaseService } from '../core/supabase.service';
import { Producto } from '../core/models';
import { ProductoCard } from './producto-card';

type Orden = 'destacados' | 'precio_asc' | 'precio_desc' | 'nombre';

@Component({
  selector: 'app-catalogo',
  imports: [FormsModule, ProductoCard],
  template: `
    <div class="container py-4">
      <h1 class="mb-1" style="font-size: clamp(2rem, 5vw, 2.8rem)">Catálogo</h1>
      <p class="text-tenue mb-3">Elige tu fragancia, toca la presentación y agrégala a tu pedido.</p>

      <div class="buscador mb-3">
        <i class="bi bi-search"></i>
        <input class="form-control" type="search" placeholder="Busca un nombre o un perfume que te guste" aria-label="Buscar"
               [ngModel]="busqueda()" (ngModelChange)="busqueda.set($event)" />
      </div>

      <div class="chips mb-2" role="group" aria-label="Tipo">
        @for (t of tipos; track t.valor) {
          <button class="chip" [class.activo]="tipo() === t.valor" (click)="cambiarTipo(t.valor)">{{ t.texto }}</button>
        }
      </div>
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div class="chips" role="group" aria-label="Para quién">
          @for (g of generos; track g.valor) {
            <button class="chip" [class.activo]="genero() === g.valor" (click)="genero.set(g.valor)">{{ g.texto }}</button>
          }
        </div>
        <select class="form-select form-select-sm w-auto" [ngModel]="orden()" (ngModelChange)="orden.set($event)" aria-label="Ordenar">
          <option value="destacados">Destacados primero</option>
          <option value="precio_asc">Menor precio</option>
          <option value="precio_desc">Mayor precio</option>
          <option value="nombre">Nombre A-Z</option>
        </select>
      </div>

      @if (cargando()) {
        <div class="text-center py-5"><div class="spinner-border text-secondary"></div></div>
      } @else if (filtrados().length === 0) {
        <div class="text-center py-5">
          <i class="bi bi-search fs-1 text-dorado"></i>
          <p class="mt-2 mb-3">No hay fragancias con esos filtros.</p>
          <button class="btn btn-suave" (click)="limpiar()">Quitar filtros</button>
        </div>
      } @else {
        <p class="small text-tenue mb-2">{{ filtrados().length }} fragancia(s)</p>
        <div class="row row-cols-2 row-cols-md-3 row-cols-lg-4 g-2 g-md-3">
          @for (p of filtrados(); track p.id) {
            <div class="col"><app-producto-card [producto]="p" /></div>
          }
        </div>
      }
    </div>
  `,
})
export class Catalogo implements OnInit {
  private sb = inject(SupabaseService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  tipos = [
    { valor: '', texto: 'Todas' },
    { valor: 'original', texto: 'Originales' },
    { valor: '1.1', texto: '1.1' },
    { valor: 'imitacion', texto: 'Inspiradas' },
  ];
  generos = [
    { valor: '', texto: 'Para todos' },
    { valor: 'mujer', texto: 'Mujer' },
    { valor: 'hombre', texto: 'Hombre' },
    { valor: 'unisex', texto: 'Unisex' },
  ];
  productos = signal<Producto[]>([]);
  cargando = signal(true);
  busqueda = signal('');
  tipo = signal('');
  genero = signal('');
  orden = signal<Orden>('destacados');

  filtrados = computed(() => {
    const q = normalizar(this.busqueda().trim());
    const precio = (p: Producto) => Math.min(...(p.presentaciones ?? []).map((x) => Number(x.precio_venta)), Infinity);
    const lista = this.productos().filter(
      (p) =>
        (!this.tipo() || p.tipo === this.tipo()) &&
        (!this.genero() || p.genero === this.genero()) &&
        (!q || [p.nombre, p.marca, p.inspirado_en, p.notas].some((x) => x && normalizar(x).includes(q))),
    );
    switch (this.orden()) {
      case 'precio_asc': return [...lista].sort((a, b) => precio(a) - precio(b));
      case 'precio_desc': return [...lista].sort((a, b) => precio(b) - precio(a));
      case 'nombre': return [...lista].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
      default: return [...lista].sort((a, b) => Number(!!b.destacado) - Number(!!a.destacado));
    }
  });

  async ngOnInit() {
    this.route.queryParamMap.subscribe((q) => this.tipo.set(q.get('tipo') ?? ''));
    try {
      this.productos.set(await this.sb.rpc<Producto[]>('sel_catalogo'));
    } finally {
      this.cargando.set(false);
    }
  }

  cambiarTipo(t: string) {
    this.router.navigate([], { queryParams: { tipo: t || null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  limpiar() {
    this.busqueda.set('');
    this.genero.set('');
    this.cambiarTipo('');
  }
}

function normalizar(t: string): string {
  return t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

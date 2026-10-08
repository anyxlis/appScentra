import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SupabaseService } from '../core/supabase.service';
import { Producto, TIPOS } from '../core/models';
import { ProductoCard } from './producto-card';

@Component({
  selector: 'app-catalogo',
  imports: [FormsModule, ProductoCard],
  template: `
    <div class="container py-4">
      <h1 class="mb-1">Catálogo</h1>
      <p class="text-secondary">Elige tu fragancia, la presentación y agrégala a tu pedido.</p>

      <div class="row g-2 mb-4">
        <div class="col-12 col-md-5">
          <div class="input-group">
            <span class="input-group-text bg-white"><i class="bi bi-search"></i></span>
            <input class="form-control" placeholder="Buscar por nombre o fragancia..." [ngModel]="busqueda()" (ngModelChange)="busqueda.set($event)" />
          </div>
        </div>
        <div class="col-6 col-md-4">
          <select class="form-select" [ngModel]="tipo()" (ngModelChange)="cambiarTipo($event)">
            <option value="">Todos los tipos</option>
            @for (t of tipos; track t.valor) {
              <option [value]="t.valor">{{ t.valor === 'imitacion' ? 'Inspiradas' : t.etiqueta }}</option>
            }
          </select>
        </div>
        <div class="col-6 col-md-3">
          <select class="form-select" [ngModel]="genero()" (ngModelChange)="genero.set($event)">
            <option value="">Hombre y mujer</option>
            <option value="hombre">Hombre</option>
            <option value="mujer">Mujer</option>
            <option value="unisex">Unisex</option>
          </select>
        </div>
      </div>

      @if (cargando()) {
        <div class="text-center py-5"><div class="spinner-border text-secondary"></div></div>
      } @else if (filtrados().length === 0) {
        <div class="text-center text-secondary py-5">
          <i class="bi bi-emoji-neutral fs-1"></i>
          <p class="mt-2">No encontramos fragancias con ese filtro.</p>
        </div>
      } @else {
        <div class="row row-cols-2 row-cols-md-3 row-cols-lg-4 g-3">
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

  tipos = TIPOS;
  productos = signal<Producto[]>([]);
  cargando = signal(true);
  busqueda = signal('');
  tipo = signal('');
  genero = signal('');

  filtrados = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    return this.productos().filter(
      (p) =>
        (!this.tipo() || p.tipo === this.tipo()) &&
        (!this.genero() || p.genero === this.genero()) &&
        (!q || [p.nombre, p.marca, p.inspirado_en].some((x) => x?.toLowerCase().includes(q))),
    );
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
    this.router.navigate([], { queryParams: { tipo: t || null }, queryParamsHandling: 'merge' });
  }
}

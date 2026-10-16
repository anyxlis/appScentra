import { Component, computed, inject, input, signal } from '@angular/core';
import { Presentacion, Producto } from '../core/models';
import { CarritoService } from '../core/carrito.service';
import { CopPipe, TipoPipe } from '../shared/pipes';

@Component({
  selector: 'app-producto-card',
  imports: [CopPipe, TipoPipe],
  template: `
    @let p = producto();
    <article class="producto-card h-100 d-flex flex-column">
      <div class="position-relative">
        @if (p.imagen_url) {
          <img [src]="p.imagen_url" class="producto-img" [alt]="p.nombre" loading="lazy" />
        } @else {
          <div class="sin-imagen"><img src="img/logo.png" alt="" /></div>
        }
        <span class="badge badge-tipo position-absolute top-0 start-0 m-2"
              [class.original]="p.tipo === 'original'" [class.t11]="p.tipo === '1.1'" [class.imitacion]="p.tipo === 'imitacion'">{{ p.tipo === 'imitacion' ? 'Inspirada' : (p.tipo | tipo) }}</span>
        @if (enPedido() > 0) {
          <span class="badge position-absolute top-0 end-0 m-2" style="background: var(--sc-espresso)"><i class="bi bi-bag-check"></i> {{ enPedido() }}</span>
        }
      </div>
      <div class="p-2 p-md-3 d-flex flex-column flex-grow-1">
        <h3 class="nombre mb-1">{{ p.nombre }}</h3>
        @if (p.inspirado_en) {
          <div class="inspirado">Inspirado en {{ p.inspirado_en }}</div>
        } @else if (p.marca) {
          <div class="inspirado">{{ p.marca }}</div>
        }
        <div class="inspirado text-capitalize">{{ p.genero }}</div>
        @if (p.notas) { <p class="notas mt-1 mb-0 d-none d-sm-block">{{ p.notas }}</p> }

        <div class="mt-auto pt-2">
          @if (p.presentaciones.length > 1) {
            <div class="ml-opciones mb-2" role="group" aria-label="Presentación">
              @for (pr of p.presentaciones; track pr.id) {
                <button type="button" class="btn-ml" [class.active]="sel()?.id === pr.id" [attr.aria-pressed]="sel()?.id === pr.id" (click)="seleccion.set(pr.id!)">{{ pr.mililitros }} ml</button>
              }
            </div>
          } @else if (sel()) {
            <div class="small text-tenue mb-2">{{ sel()!.mililitros }} ml</div>
          }
          <div class="d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-2">
            <span class="precio">{{ sel()?.precio_venta | cop }}</span>
            <button class="btn btn-sm" [class.btn-dorado]="!agregado()" [class.btn-espresso]="agregado()" (click)="agregar()" [disabled]="!sel()">
              @if (agregado()) { <i class="bi bi-check2"></i> Agregado } @else { <i class="bi bi-bag-plus"></i> Agregar }
            </button>
          </div>
        </div>
      </div>
    </article>
  `,
})
export class ProductoCard {
  producto = input.required<Producto>();
  private carrito = inject(CarritoService);
  seleccion = signal<number | null>(null);
  agregado = signal(false);
  sel = computed<Presentacion | undefined>(() => {
    const lista = this.producto().presentaciones ?? [];
    return lista.find((x) => x.id === this.seleccion()) ?? lista[0];
  });
  enPedido = computed(() => {
    const ids = new Set((this.producto().presentaciones ?? []).map((x) => x.id));
    return this.carrito.items().filter((i) => ids.has(i.presentacion_id)).reduce((a, i) => a + i.cantidad, 0);
  });

  agregar() {
    const p = this.producto();
    const pr = this.sel();
    if (!pr?.id) return;
    this.carrito.agregar({
      presentacion_id: pr.id,
      producto_id: p.id!,
      nombre: p.nombre,
      tipo: p.tipo,
      mililitros: pr.mililitros,
      precio: Number(pr.precio_venta),
      cantidad: 1,
      imagen_url: p.imagen_url,
    });
    this.agregado.set(true);
    setTimeout(() => this.agregado.set(false), 1400);
  }
}

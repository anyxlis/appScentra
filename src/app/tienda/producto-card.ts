import { Component, inject, input, signal, computed } from '@angular/core';
import { Presentacion, Producto } from '../core/models';
import { CarritoService } from '../core/carrito.service';
import { ToastService } from '../core/toast.service';
import { CopPipe, TipoPipe } from '../shared/pipes';

@Component({
  selector: 'app-producto-card',
  imports: [CopPipe, TipoPipe],
  template: `
    @let p = producto();
    <div class="card producto-card h-100">
      <div class="position-relative">
        @if (p.imagen_url) {
          <img [src]="p.imagen_url" class="card-img-top producto-img" [alt]="p.nombre" loading="lazy" />
        } @else {
          <div class="sin-imagen"><i class="bi bi-droplet-half"></i></div>
        }
        <span class="badge badge-tipo position-absolute top-0 start-0 m-2"
              [class.original]="p.tipo === 'original'" [class.t11]="p.tipo === '1.1'" [class.imitacion]="p.tipo === 'imitacion'">
          {{ p.tipo | tipo }}
        </span>
        @if (p.destacado) {
          <span class="badge bg-light text-dark position-absolute top-0 end-0 m-2"><i class="bi bi-star-fill text-dorado"></i></span>
        }
      </div>
      <div class="card-body d-flex flex-column">
        <h5 class="card-title mb-0">{{ p.nombre }}</h5>
        @if (p.inspirado_en) {
          <small class="text-muted fst-italic">Inspirado en {{ p.inspirado_en }}</small>
        } @else if (p.marca) {
          <small class="text-muted">{{ p.marca }}</small>
        }
        <small class="text-muted text-capitalize">{{ p.genero }}</small>
        @if (p.notas) {
          <p class="small mt-2 mb-0 text-secondary">{{ p.notas }}</p>
        }

        <div class="mt-auto pt-3">
          <div class="btn-group btn-group-sm mb-2 flex-wrap" role="group">
            @for (pr of p.presentaciones; track pr.id) {
              <button type="button" class="btn btn-outline-primary btn-ml" [class.active]="sel()?.id === pr.id" (click)="seleccion.set(pr.id!)">
                {{ pr.mililitros }} ml
              </button>
            }
          </div>
          <div class="d-flex align-items-center justify-content-between gap-2">
            <span class="fs-5 fw-semibold text-primary">{{ sel()?.precio_venta | cop }}</span>
            <button class="btn btn-dorado btn-sm" (click)="agregar()"><i class="bi bi-bag-plus"></i> Agregar</button>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class ProductoCard {
  producto = input.required<Producto>();
  private carrito = inject(CarritoService);
  private toast = inject(ToastService);
  seleccion = signal<number | null>(null);
  sel = computed<Presentacion | undefined>(() => {
    const lista = this.producto().presentaciones ?? [];
    return lista.find((x) => x.id === this.seleccion()) ?? lista[0];
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
    this.toast.ok(`${p.nombre} ${pr.mililitros} ml agregado al pedido`);
  }
}

import { computed, effect, Injectable, signal } from '@angular/core';
import { ItemCarrito } from './models';

const CLAVE = 'scentra_carrito';

@Injectable({ providedIn: 'root' })
export class CarritoService {
  readonly items = signal<ItemCarrito[]>(this.cargar());
  readonly cantidad = computed(() => this.items().reduce((a, i) => a + i.cantidad, 0));
  readonly total = computed(() => this.items().reduce((a, i) => a + i.cantidad * i.precio, 0));

  constructor() {
    effect(() => {
      try {
        localStorage.setItem(CLAVE, JSON.stringify(this.items()));
      } catch {
        /* almacenamiento no disponible */
      }
    });
  }

  agregar(item: ItemCarrito) {
    this.items.update((lista) => {
      const existe = lista.find((i) => i.presentacion_id === item.presentacion_id);
      if (existe) {
        return lista.map((i) => (i.presentacion_id === item.presentacion_id ? { ...i, cantidad: i.cantidad + item.cantidad } : i));
      }
      return [...lista, item];
    });
  }

  cambiarCantidad(presentacionId: number, cantidad: number) {
    if (cantidad <= 0) return this.quitar(presentacionId);
    this.items.update((l) => l.map((i) => (i.presentacion_id === presentacionId ? { ...i, cantidad } : i)));
  }

  quitar(presentacionId: number) {
    this.items.update((l) => l.filter((i) => i.presentacion_id !== presentacionId));
  }

  vaciar() {
    this.items.set([]);
  }

  private cargar(): ItemCarrito[] {
    try {
      return JSON.parse(localStorage.getItem(CLAVE) || '[]');
    } catch {
      return [];
    }
  }
}

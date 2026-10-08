import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CarritoService } from '../core/carrito.service';
import { ConfigService } from '../core/config.service';
import { cop, telefonoWa } from '../core/utils';
import { etiquetaTipo } from '../core/models';
import { CopPipe, TipoPipe } from '../shared/pipes';

@Component({
  selector: 'app-carrito',
  imports: [FormsModule, RouterLink, CopPipe, TipoPipe],
  template: `
    <div class="container py-4" style="max-width: 980px">
      <h1 class="mb-4">Tu pedido</h1>

      @if (carrito.items().length === 0) {
        <div class="text-center py-5">
          <i class="bi bi-bag fs-1 text-dorado"></i>
          <p class="mt-2 text-secondary">Tu pedido está vacío.</p>
          <a routerLink="/catalogo" class="btn btn-primary">Ir al catálogo</a>
        </div>
      } @else {
        <div class="row g-4">
          <div class="col-lg-7">
            <ul class="list-group">
              @for (i of carrito.items(); track i.presentacion_id) {
                <li class="list-group-item d-flex gap-3 align-items-center py-3">
                  @if (i.imagen_url) {
                    <img [src]="i.imagen_url" width="64" height="64" class="rounded object-fit-cover" [alt]="i.nombre" />
                  } @else {
                    <div class="rounded bg-crema d-flex align-items-center justify-content-center" style="width:64px;height:64px">
                      <i class="bi bi-droplet-half text-dorado fs-3"></i>
                    </div>
                  }
                  <div class="flex-grow-1">
                    <div class="fw-semibold">{{ i.nombre }}</div>
                    <small class="text-muted">{{ i.tipo | tipo }} · {{ i.mililitros }} ml · {{ i.precio | cop }}</small>
                    <div class="input-group input-group-sm mt-2" style="width: 120px">
                      <button class="btn btn-outline-secondary" (click)="carrito.cambiarCantidad(i.presentacion_id, i.cantidad - 1)">−</button>
                      <input class="form-control text-center" [value]="i.cantidad" readonly />
                      <button class="btn btn-outline-secondary" (click)="carrito.cambiarCantidad(i.presentacion_id, i.cantidad + 1)">+</button>
                    </div>
                  </div>
                  <div class="text-end">
                    <div class="fw-semibold">{{ i.precio * i.cantidad | cop }}</div>
                    <button class="btn btn-link btn-sm text-danger p-0" (click)="carrito.quitar(i.presentacion_id)">Quitar</button>
                  </div>
                </li>
              }
            </ul>
          </div>

          <div class="col-lg-5">
            <div class="card p-3 p-md-4">
              <div class="d-flex justify-content-between fs-5 mb-3">
                <span>Total</span><strong class="text-primary">{{ carrito.total() | cop }}</strong>
              </div>
              <form (ngSubmit)="enviar()" #f="ngForm">
                <div class="mb-2">
                  <label class="form-label small">Nombre *</label>
                  <input class="form-control" name="nombre" [(ngModel)]="datos.nombre" required />
                </div>
                <div class="mb-2">
                  <label class="form-label small">Ciudad / barrio / dirección *</label>
                  <input class="form-control" name="direccion" [(ngModel)]="datos.direccion" required />
                </div>
                <div class="mb-2">
                  <label class="form-label small">Forma de pago preferida</label>
                  <select class="form-select" name="pago" [(ngModel)]="datos.pago">
                    <option>Contado</option>
                    <option>Contraentrega</option>
                    <option>Quiero financiar</option>
                  </select>
                </div>
                <div class="mb-3">
                  <label class="form-label small">Nota</label>
                  <textarea class="form-control" rows="2" name="nota" [(ngModel)]="datos.nota"></textarea>
                </div>
                <button class="btn btn-success w-100 btn-lg" [disabled]="f.invalid">
                  <i class="bi bi-whatsapp"></i> Enviar pedido por WhatsApp
                </button>
                <p class="small text-muted mt-2 mb-0">Te confirmamos disponibilidad y tiempo de entrega por WhatsApp.</p>
                @if (enviado) {
                  <div class="alert alert-success small mt-3 mb-0 d-flex justify-content-between align-items-center gap-2">
                    ¿Ya enviaste el mensaje?
                    <button type="button" class="btn btn-sm btn-outline-success" (click)="carrito.vaciar(); enviado = false">Vaciar pedido</button>
                  </div>
                }
              </form>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class Carrito implements OnInit {
  carrito = inject(CarritoService);
  private cfg = inject(ConfigService);
  enviado = false;
  datos = { nombre: '', direccion: '', pago: 'Contado', nota: '' };

  ngOnInit() {
    this.cfg.cargar();
  }

  // Sin await antes de window.open: así el navegador no bloquea la ventana emergente
  enviar() {
    const telefono_whatsapp = this.cfg.publica().telefono_whatsapp;
    if (!telefono_whatsapp) return;
    const lineas = this.carrito
      .items()
      .map((i) => `• ${i.cantidad} x ${i.nombre} (${etiquetaTipo(i.tipo)} ${i.mililitros} ml) - ${cop(i.precio * i.cantidad)}`);
    const msg = [
      'Hola SCENTRA, quiero hacer este pedido:',
      '',
      ...lineas,
      '',
      `*Total: ${cop(this.carrito.total())}*`,
      '',
      `Nombre: ${this.datos.nombre}`,
      `Dirección: ${this.datos.direccion}`,
      `Pago: ${this.datos.pago}`,
      this.datos.nota ? `Nota: ${this.datos.nota}` : '',
    ]
      .filter((l, idx, arr) => l !== '' || arr[idx - 1] !== '')
      .join('\n');

    window.open(`https://wa.me/${telefonoWa(telefono_whatsapp)}?text=${encodeURIComponent(msg)}`, '_blank');
    this.enviado = true;
  }
}

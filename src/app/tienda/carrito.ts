import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CarritoService } from '../core/carrito.service';
import { ConfigService } from '../core/config.service';
import { cop, telefonoWa } from '../core/utils';
import { etiquetaTipo } from '../core/models';
import { CopPipe, TipoPipe } from '../shared/pipes';

const CLAVE_DATOS = 'scentra_datos_pedido';

@Component({
  selector: 'app-carrito',
  imports: [FormsModule, RouterLink, CopPipe, TipoPipe],
  template: `
    <div class="container py-4" style="max-width: 1040px">
      <h1 class="mb-1" style="font-size: clamp(2rem, 5vw, 2.8rem)">Tu pedido</h1>

      @if (carrito.items().length === 0) {
        <div class="text-center py-5">
          <img src="img/logo.png" alt="" width="96" height="96" class="rounded-circle mb-3" style="opacity:.7" />
          <p class="mb-3">Aún no has agregado fragancias.</p>
          <a routerLink="/catalogo" class="btn btn-primary btn-lg">Ir al catálogo</a>
        </div>
      } @else {
        <p class="text-tenue mb-4">{{ carrito.cantidad() }} producto(s). Revisa, completa tus datos y envíalo por WhatsApp.</p>
        <div class="row g-4">
          <div class="col-lg-7">
            <div class="card">
              <ul class="list-group list-group-flush">
                @for (i of carrito.items(); track i.presentacion_id) {
                  <li class="list-group-item d-flex gap-3 align-items-center py-3">
                    @if (i.imagen_url) {
                      <img [src]="i.imagen_url" width="68" height="68" class="rounded-3 object-fit-cover flex-shrink-0" [alt]="i.nombre" />
                    } @else {
                      <div class="rounded-3 bg-crema d-flex align-items-center justify-content-center flex-shrink-0" style="width:68px;height:68px"><i class="bi bi-droplet-half text-dorado fs-3"></i></div>
                    }
                    <div class="flex-grow-1" style="min-width: 0">
                      <div class="fw-semibold text-truncate">{{ i.nombre }}</div>
                      <small class="text-tenue">{{ i.tipo | tipo }} · {{ i.mililitros }} ml · {{ i.precio | cop }} c/u</small>
                      <div class="d-flex align-items-center gap-2 mt-2">
                        <div class="input-group input-group-sm" style="width: 112px">
                          <button class="btn btn-suave" (click)="carrito.cambiarCantidad(i.presentacion_id, i.cantidad - 1)" aria-label="Quitar uno"><i class="bi bi-dash"></i></button>
                          <input class="form-control text-center" style="min-height: 32px" [value]="i.cantidad" readonly aria-label="Cantidad" />
                          <button class="btn btn-suave" (click)="carrito.cambiarCantidad(i.presentacion_id, i.cantidad + 1)" aria-label="Agregar uno"><i class="bi bi-plus"></i></button>
                        </div>
                        <button class="btn btn-link btn-sm text-danger p-0 ms-1" (click)="carrito.quitar(i.presentacion_id)"><i class="bi bi-trash3"></i><span class="d-none d-sm-inline">Quitar</span></button>
                      </div>
                    </div>
                    <div class="fw-semibold cifra text-end">{{ i.precio * i.cantidad | cop }}</div>
                  </li>
                }
              </ul>
              <div class="card-footer d-flex justify-content-between">
                <a routerLink="/catalogo" class="small"><i class="bi bi-plus-lg"></i> Agregar más fragancias</a>
                <span>Total <strong class="cifra ms-1">{{ carrito.total() | cop }}</strong></span>
              </div>
            </div>
          </div>

          <div class="col-lg-5">
            <div class="card p-3 p-md-4">
              <h2 class="h4 mb-3">Tus datos de entrega</h2>
              <form id="pedido" (ngSubmit)="enviar()" #f="ngForm">
                <div class="mb-3">
                  <label class="form-label" for="nombre">Nombre</label>
                  <input id="nombre" class="form-control" name="nombre" [(ngModel)]="datos.nombre" required autocomplete="name" />
                </div>
                <div class="mb-3">
                  <label class="form-label" for="dir">Ciudad, barrio y dirección</label>
                  <input id="dir" class="form-control" name="direccion" [(ngModel)]="datos.direccion" required autocomplete="street-address" />
                </div>
                <div class="mb-3">
                  <span class="form-label d-block">¿Cómo quieres pagar?</span>
                  <div class="chips flex-wrap">
                    @for (o of opcionesPago; track o) {
                      <button type="button" class="chip" [class.activo]="datos.pago === o" (click)="datos.pago = o">{{ o }}</button>
                    }
                  </div>
                </div>
                <div class="mb-3">
                  <label class="form-label" for="nota">Nota <span class="text-tenue fw-normal">(opcional)</span></label>
                  <textarea id="nota" class="form-control" rows="2" name="nota" [(ngModel)]="datos.nota" placeholder="Ej: es para regalo, entregar en la tarde"></textarea>
                </div>
                <button class="btn btn-whatsapp w-100 btn-lg d-none d-md-flex" [disabled]="f.invalid">
                  <i class="bi bi-whatsapp"></i> Enviar pedido por WhatsApp
                </button>
                @if (f.invalid && f.submitted) { <p class="small text-danger mt-2 mb-0">Escribe tu nombre y dirección para enviar el pedido.</p> }
                <p class="small text-tenue mt-2 mb-0"><i class="bi bi-shield-check me-1"></i>No pagas nada aquí. Te confirmamos disponibilidad y entrega por WhatsApp.</p>
                @if (enviado) {
                  <div class="alert alert-success small mt-3 mb-0 d-flex justify-content-between align-items-center gap-2">
                    ¿Ya enviaste el mensaje?
                    <button type="button" class="btn btn-sm btn-success" (click)="carrito.vaciar(); enviado = false">Vaciar pedido</button>
                  </div>
                }
              </form>
            </div>
          </div>
        </div>

        <div class="resumen-fijo d-md-none">
          <div class="d-flex align-items-center gap-3">
            <div><div class="small text-tenue">Total</div><div class="fw-semibold fs-5 cifra">{{ carrito.total() | cop }}</div></div>
            <button type="submit" form="pedido" class="btn btn-whatsapp flex-grow-1" [disabled]="f.invalid"><i class="bi bi-whatsapp"></i> Enviar por WhatsApp</button>
          </div>
        </div>
        <div class="d-md-none" style="height: 80px"></div>
      }
    </div>
  `,
})
export class Carrito implements OnInit {
  carrito = inject(CarritoService);
  private cfg = inject(ConfigService);
  enviado = false;
  opcionesPago = ['Contado', 'Contraentrega', 'Quiero financiar'];
  datos = { nombre: '', direccion: '', pago: 'Contado', nota: '' };

  ngOnInit() {
    this.cfg.cargar();
    try {
      const g = JSON.parse(localStorage.getItem(CLAVE_DATOS) || 'null');
      if (g) this.datos = { ...this.datos, nombre: g.nombre ?? '', direccion: g.direccion ?? '' };
    } catch {
      /* sin almacenamiento */
    }
  }

  // Sin await antes de window.open: así el navegador no bloquea la ventana emergente
  enviar() {
    const telefono_whatsapp = this.cfg.publica().telefono_whatsapp;
    if (!telefono_whatsapp || !this.datos.nombre.trim() || !this.datos.direccion.trim()) return;
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
    try {
      localStorage.setItem(CLAVE_DATOS, JSON.stringify({ nombre: this.datos.nombre, direccion: this.datos.direccion }));
    } catch {
      /* sin almacenamiento */
    }
  }
}

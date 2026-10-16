import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastService } from './core/toast.service';
import { PwaService } from './core/pwa.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: `
    <router-outlet />

    <div class="toast-container position-fixed bottom-0 end-0 p-3" style="z-index: 2000; margin-bottom: calc(64px + env(safe-area-inset-bottom, 0px))">
      @for (t of toast.toasts(); track t.id) {
        <div class="toast show align-items-center border-0" [class]="'text-bg-' + t.tipo" role="alert">
          <div class="d-flex">
            <div class="toast-body">{{ t.texto }}</div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" aria-label="Cerrar" (click)="toast.cerrar(t.id)"></button>
          </div>
        </div>
      }
    </div>

    @if (pwa.hayActualizacion()) {
      <div class="position-fixed top-0 start-50 translate-middle-x mt-3 px-3" style="z-index: 2100; width: min(440px, 100%)">
        <div class="card p-3 d-flex flex-row align-items-center gap-3">
          <i class="bi bi-arrow-repeat fs-4 text-dorado"></i>
          <div class="flex-grow-1 small">Hay una nueva versión de SCENTRA.</div>
          <button class="btn btn-primary btn-sm" (click)="pwa.actualizar()">Actualizar</button>
        </div>
      </div>
    }

    @if (pwa.verGuiaIos()) {
      <div class="modal d-block" tabindex="-1" (click)="pwa.verGuiaIos.set(false)">
        <div class="modal-dialog modal-dialog-centered" (click)="$event.stopPropagation()">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Instalar en tu iPhone</h5>
              <button type="button" class="btn-close" aria-label="Cerrar" (click)="pwa.verGuiaIos.set(false)"></button>
            </div>
            <div class="modal-body">
              <ol class="mb-0 ps-3 d-grid gap-2">
                <li>Abre esta página en <strong>Safari</strong>.</li>
                <li>Toca el botón <strong>Compartir</strong> <i class="bi bi-box-arrow-up"></i> en la barra inferior.</li>
                <li>Elige <strong>Agregar a inicio</strong> <i class="bi bi-plus-square"></i> y confirma con <strong>Agregar</strong>.</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-backdrop show"></div>
    }
  `,
})
export class App implements OnInit {
  toast = inject(ToastService);
  pwa = inject(PwaService);

  ngOnInit() {
    this.pwa.iniciar();
  }
}

import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastService } from './core/toast.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: `
    <router-outlet />
    <div class="toast-container position-fixed bottom-0 end-0 p-3" style="z-index: 2000">
      @for (t of toast.toasts(); track t.id) {
        <div class="toast show align-items-center border-0" [class]="'text-bg-' + t.tipo" role="alert">
          <div class="d-flex">
            <div class="toast-body">{{ t.texto }}</div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" (click)="toast.cerrar(t.id)"></button>
          </div>
        </div>
      }
    </div>
  `,
})
export class App {
  toast = inject(ToastService);
}

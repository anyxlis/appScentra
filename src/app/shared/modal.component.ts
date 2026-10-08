import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-modal',
  template: `
    <div class="modal d-block" tabindex="-1" (click)="cerrar.emit()">
      <div class="modal-dialog modal-dialog-scrollable" [class]="'modal-' + tamano()" (click)="$event.stopPropagation()">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">{{ titulo() }}</h5>
            <button type="button" class="btn-close" aria-label="Cerrar" (click)="cerrar.emit()"></button>
          </div>
          <div class="modal-body"><ng-content /></div>
          <div class="modal-footer"><ng-content select="[pie]" /></div>
        </div>
      </div>
    </div>
    <div class="modal-backdrop show"></div>
  `,
})
export class ModalComponent {
  titulo = input('');
  tamano = input<'sm' | 'lg' | 'xl' | 'md'>('lg');
  cerrar = output<void>();
}

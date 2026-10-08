import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  texto: string;
  tipo: 'success' | 'danger' | 'info';
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private seq = 0;

  ok(texto: string) {
    this.mostrar(texto, 'success');
  }
  error(e: unknown) {
    this.mostrar(e instanceof Error ? e.message : String(e), 'danger', 6000);
  }
  info(texto: string) {
    this.mostrar(texto, 'info');
  }

  cerrar(id: number) {
    this.toasts.update((t) => t.filter((x) => x.id !== id));
  }

  private mostrar(texto: string, tipo: Toast['tipo'], ms = 3500) {
    const id = ++this.seq;
    this.toasts.update((t) => [...t, { id, texto, tipo }]);
    setTimeout(() => this.cerrar(id), ms);
  }
}

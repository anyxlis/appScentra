import { inject, Injectable, isDevMode, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** App instalable (PWA): botón "Instalar", instrucciones para iPhone y aviso de nueva versión. */
@Injectable({ providedIn: 'root' })
export class PwaService {
  private router = inject(Router);
  private evento: BeforeInstallPromptEvent | null = null;

  /** true cuando el navegador permite instalar con un toque (Android / Chrome / Edge). */
  readonly puedeInstalar = signal(false);
  /** iPhone/iPad en Safari: se instala desde Compartir → Agregar a inicio. */
  readonly esIos = /iphone|ipad|ipod/i.test(navigator.userAgent) && !('MSStream' in window);
  readonly instalada = signal(this.modoApp());
  readonly verGuiaIos = signal(false);
  readonly hayActualizacion = signal(false);
  private swEnEspera: ServiceWorker | null = null;

  iniciar() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.evento = e as BeforeInstallPromptEvent;
      this.puedeInstalar.set(true);
    });
    window.addEventListener('appinstalled', () => {
      this.instalada.set(true);
      this.puedeInstalar.set(false);
    });

    // El panel admin se instala como una app aparte que abre directo en /admin
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe((e) => {
      const admin = (e as NavigationEnd).urlAfterRedirects.startsWith('/admin');
      const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
      const href = admin ? 'manifest-admin.webmanifest' : 'manifest.webmanifest';
      if (link && !link.href.endsWith(href)) link.href = href;
    });

    if (!isDevMode() && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        reg.addEventListener('updatefound', () => {
          const nuevo = reg.installing;
          nuevo?.addEventListener('statechange', () => {
            if (nuevo.state === 'installed' && navigator.serviceWorker.controller) {
              this.swEnEspera = nuevo;
              this.hayActualizacion.set(true);
            }
          });
        });
      });
      // Solo recarga cuando reemplaza una versión anterior (no en la primera visita)
      const habiaVersion = !!navigator.serviceWorker.controller;
      let recargado = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (recargado || !habiaVersion) return;
        recargado = true;
        location.reload();
      });
    }
  }

  /** Mostrar el botón solo si aún no está instalada y hay forma de instalarla. */
  mostrarBoton(): boolean {
    return !this.instalada() && (this.puedeInstalar() || this.esIos);
  }

  async instalar() {
    if (this.evento) {
      await this.evento.prompt();
      const r = await this.evento.userChoice;
      if (r.outcome === 'accepted') this.instalada.set(true);
      this.evento = null;
      this.puedeInstalar.set(false);
    } else if (this.esIos) {
      this.verGuiaIos.set(true);
    }
  }

  actualizar() {
    this.swEnEspera?.postMessage('ACTUALIZAR');
  }

  private modoApp(): boolean {
    return window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  }
}

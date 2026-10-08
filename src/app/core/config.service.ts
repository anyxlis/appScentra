import { inject, Injectable, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface ConfigPublica {
  nombre_negocio: string;
  telefono_whatsapp: string;
  instagram?: string | null;
  ciudad?: string | null;
}

@Injectable({ providedIn: 'root' })
export class ConfigService {
  private sb = inject(SupabaseService);
  readonly publica = signal<ConfigPublica>({ nombre_negocio: 'SCENTRA', telefono_whatsapp: '', instagram: 'scentra.vip', ciudad: 'Montería' });
  private cargada = false;

  async cargar(): Promise<ConfigPublica> {
    if (!this.cargada) {
      try {
        const c = await this.sb.rpc<ConfigPublica>('sel_configuracion_publica');
        if (c) this.publica.set(c);
        this.cargada = true;
      } catch {
        /* se usa el valor por defecto */
      }
    }
    return this.publica();
  }
}

import { Injectable, signal } from '@angular/core';
import { createClient, Session, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly client: SupabaseClient;
  readonly session = signal<Session | null>(null);

  constructor() {
    this.client = createClient(environment.supabaseUrl, environment.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Evita el error "NavigatorLockAcquireTimeoutError" de supabase-js con Angular
        lock: async <R>(_name: string, _timeout: number, fn: () => Promise<R>) => fn(),
      },
    });
    this.client.auth.getSession().then(({ data }) => this.session.set(data.session));
    this.client.auth.onAuthStateChange((_e, s) => this.session.set(s));
  }

  /** Llama una función RPC (PostgREST). Lanza Error con el mensaje de la base de datos. */
  async rpc<T>(fn: string, params: Record<string, unknown> = {}): Promise<T> {
    const { data, error } = await this.client.rpc(fn, params);
    if (error) {
      if (error.code === '42501' || error.message.includes('No autorizado')) {
        throw new Error('No autorizado. Inicia sesión como administrador.');
      }
      throw new Error(error.message);
    }
    return data as T;
  }

  async login(email: string, password: string): Promise<void> {
    const { error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) {
      if (environment.supabaseUrl.includes('TU-PROYECTO') || error.message.includes('fetch')) {
        throw new Error('No hay conexión con Supabase. Revisa supabaseUrl y supabaseAnonKey en src/environments/environment.ts');
      }
      throw new Error('Correo o contraseña incorrectos');
    }
  }

  async logout(): Promise<void> {
    await this.client.auth.signOut();
  }

  async getSession(): Promise<Session | null> {
    const { data } = await this.client.auth.getSession();
    return data.session;
  }

  async subirImagen(file: File): Promise<string> {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const bucket = this.client.storage.from(environment.storageBucket);
    const { error } = await bucket.upload(path, file, { cacheControl: '31536000', upsert: false });
    if (error) throw new Error('No se pudo subir la imagen: ' + error.message);
    return bucket.getPublicUrl(path).data.publicUrl;
  }
}

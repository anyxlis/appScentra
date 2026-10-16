import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../core/supabase.service';
import { PwaService } from '../core/pwa.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="min-vh-100 d-flex flex-column flex-lg-row" style="background: var(--sc-lino)">
      <div class="d-none d-lg-flex flex-column justify-content-between p-5" style="flex: 1; background: var(--sc-espresso); color: rgba(250,245,236,.85)">
        <div class="d-flex align-items-center gap-2"><img src="img/logo.png" alt="" width="44" height="44" class="rounded-circle" /><span class="fuente-marca fs-4 text-white">SCENTRA</span></div>
        <div>
          <div style="font-family: 'Cormorant Garamond', serif; font-size: 3rem; line-height: 1.05; color: #fff; max-width: 28rem">Tus ventas, cobros e inventario en un solo lugar.</div>
          <ul class="list-unstyled mt-4 d-grid gap-2" style="max-width: 26rem">
            <li><i class="bi bi-receipt me-2" style="color: var(--sc-champan)"></i>Facturas de contado y financiadas</li>
            <li><i class="bi bi-whatsapp me-2" style="color: var(--sc-champan)"></i>Recordatorios de cobro por WhatsApp</li>
            <li><i class="bi bi-graph-up-arrow me-2" style="color: var(--sc-champan)"></i>Estado de resultados y flujo de caja</li>
          </ul>
        </div>
        <small style="opacity: .5">Panel de administración</small>
      </div>

      <div class="d-flex align-items-center justify-content-center p-3 p-md-5" style="flex: 1">
        <div style="width: 100%; max-width: 380px">
          <div class="text-center mb-4 d-lg-none">
            <img src="img/logo.png" alt="SCENTRA" width="96" class="rounded-circle" />
          </div>
          <h1 class="mb-1" style="font-size: 2.2rem">Ingresar</h1>
          <p class="text-tenue mb-4">Usa el correo y la contraseña de administrador.</p>
          @if (error()) {
            <div class="alert alert-danger py-2 small d-flex gap-2"><i class="bi bi-exclamation-circle"></i>{{ error() }}</div>
          }
          <form (ngSubmit)="ingresar()">
            <div class="mb-3">
              <label class="form-label" for="email">Correo</label>
              <input id="email" type="email" class="form-control" name="email" [(ngModel)]="email" required autocomplete="username" inputmode="email" />
            </div>
            <div class="mb-3">
              <label class="form-label" for="pass">Contraseña</label>
              <div class="input-group">
                <input id="pass" [type]="ver() ? 'text' : 'password'" class="form-control" name="pass" [(ngModel)]="password" required autocomplete="current-password" />
                <button type="button" class="btn btn-suave" (click)="ver.set(!ver())" [attr.aria-label]="ver() ? 'Ocultar contraseña' : 'Mostrar contraseña'"><i class="bi" [class.bi-eye]="!ver()" [class.bi-eye-slash]="ver()"></i></button>
              </div>
            </div>
            <button class="btn btn-primary btn-lg w-100" [disabled]="cargando()">
              @if (cargando()) { <span class="spinner-border spinner-border-sm"></span> } Ingresar
            </button>
          </form>
          @if (pwa.mostrarBoton()) {
            <button class="btn btn-suave w-100 mt-2" (click)="pwa.instalar()"><i class="bi bi-phone"></i> Instalar el panel en este dispositivo</button>
          }
          <a routerLink="/" class="small d-block text-center mt-4 link-secondary">Volver a la tienda</a>
        </div>
      </div>
    </div>
  `,
})
export class Login implements OnInit {
  private sb = inject(SupabaseService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  pwa = inject(PwaService);
  email = '';
  password = '';
  cargando = signal(false);
  error = signal('');
  ver = signal(false);

  ngOnInit() {
    if (this.route.snapshot.queryParamMap.get('error') === 'no-admin') {
      this.error.set('Tu usuario no tiene permisos de administrador.');
    }
  }

  async ingresar() {
    this.cargando.set(true);
    this.error.set('');
    try {
      await this.sb.login(this.email.trim(), this.password);
      await this.router.navigateByUrl('/admin');
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.cargando.set(false);
    }
  }
}

import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../core/supabase.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="min-vh-100 d-flex align-items-center justify-content-center hero px-3">
      <div class="card shadow-sm p-4" style="width: 100%; max-width: 400px">
        <div class="text-center mb-3">
          <img src="img/logo.png" alt="SCENTRA" width="110" class="rounded-circle" />
          <h3 class="mt-2 mb-0">Administración</h3>
        </div>
        @if (error()) {
          <div class="alert alert-danger py-2 small">{{ error() }}</div>
        }
        <form (ngSubmit)="ingresar()">
          <div class="mb-3">
            <label class="form-label">Correo</label>
            <input type="email" class="form-control" name="email" [(ngModel)]="email" required autocomplete="username" />
          </div>
          <div class="mb-3">
            <label class="form-label">Contraseña</label>
            <input type="password" class="form-control" name="pass" [(ngModel)]="password" required autocomplete="current-password" />
          </div>
          <button class="btn btn-primary w-100" [disabled]="cargando()">
            @if (cargando()) { <span class="spinner-border spinner-border-sm"></span> } Ingresar
          </button>
        </form>
        <a routerLink="/" class="small d-block text-center mt-3 link-secondary">Volver a la tienda</a>
      </div>
    </div>
  `,
})
export class Login implements OnInit {
  private sb = inject(SupabaseService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  email = '';
  password = '';
  cargando = signal(false);
  error = signal('');

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

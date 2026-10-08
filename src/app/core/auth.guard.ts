import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseService } from './supabase.service';

export const adminGuard: CanActivateFn = async () => {
  const sb = inject(SupabaseService);
  const router = inject(Router);

  const session = await sb.getSession();
  if (!session) return router.parseUrl('/admin/login');

  try {
    const esAdmin = await sb.rpc<boolean>('sel_es_admin');
    if (esAdmin) return true;
  } catch {
    /* sin permisos */
  }
  await sb.logout();
  return router.parseUrl('/admin/login?error=no-admin');
};

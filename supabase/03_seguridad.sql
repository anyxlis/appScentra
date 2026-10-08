-- =====================================================================
-- SCENTRA · 03 SEGURIDAD
-- Volver a ejecutar este archivo cada vez que agregues funciones nuevas.
-- =====================================================================

-- Fechas en hora de Colombia (sin esto, después de las 7 p.m. "hoy" sería mañana)
alter database postgres set timezone to 'America/Bogota';

-- ---------- RLS: nadie lee ni escribe las tablas directo; todo pasa por las funciones
do $$
declare t text;
begin
  foreach t in array array['administradores','configuracion','productos','presentaciones','clientes','proveedores',
                           'facturas_venta','factura_venta_detalle','cuotas_venta','pagos_venta','recordatorios',
                           'facturas_compra','factura_compra_detalle','gastos','movimientos_inventario'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
  end loop;
end $$;

revoke all on public.v_facturas_venta from anon, authenticated;

-- ---------- Funciones: Postgres da EXECUTE a PUBLIC por defecto; se quita a todas
revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- Panel admin: solo usuarios autenticados (cada función valida además que sea administrador)
grant execute on all functions in schema public to authenticated;
revoke execute on function public._recalcular_factura_venta(bigint) from authenticated;
revoke execute on function public._sincronizar_presentaciones(bigint, jsonb) from authenticated;

-- Tienda pública (visitantes sin sesión)
grant execute on function public.sel_catalogo(text, text, text) to anon;
grant execute on function public.sel_configuracion_publica() to anon;

-- ---------- Storage: imágenes de productos (bucket público para lectura)
insert into storage.buckets (id, name, public)
values ('productos', 'productos', true)
on conflict (id) do update set public = true;

drop policy if exists "productos_admin_select" on storage.objects;
drop policy if exists "productos_admin_insert" on storage.objects;
drop policy if exists "productos_admin_update" on storage.objects;
drop policy if exists "productos_admin_delete" on storage.objects;

create policy "productos_admin_select" on storage.objects for select to authenticated
  using (bucket_id = 'productos' and public._es_admin());
create policy "productos_admin_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'productos' and public._es_admin());
create policy "productos_admin_update" on storage.objects for update to authenticated
  using (bucket_id = 'productos' and public._es_admin());
create policy "productos_admin_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'productos' and public._es_admin());

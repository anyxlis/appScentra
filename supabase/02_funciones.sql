-- =====================================================================
-- SCENTRA · 02 FUNCIONES (RPC vía PostgREST)
-- Convención: sel_ (consultas) · guardar_ (insertar) · actualizar_ · eliminar_
-- Las funciones con prefijo _ son internas (no se llaman desde la web).
-- =====================================================================

-- =========================== INTERNAS ================================

create or replace function public._es_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(auth.role(), '') = 'service_role'
      or exists (select 1 from public.administradores where user_id = auth.uid());
$$;

create or replace function public._validar_admin()
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not public._es_admin() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
end $$;

-- Recalcula total pagado, reparte los pagos en las cuotas (en orden) y fija el estado
create or replace function public._recalcular_factura_venta(p_factura_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_pagado numeric(14,2);
  v_resto  numeric(14,2);
  c record;
begin
  select coalesce(sum(valor), 0) into v_pagado from pagos_venta where factura_id = p_factura_id;
  update facturas_venta set total_pagado = v_pagado where id = p_factura_id;

  v_resto := v_pagado;
  for c in select id, valor from cuotas_venta where factura_id = p_factura_id order by numero loop
    update cuotas_venta set pagado = least(c.valor, greatest(v_resto, 0)) where id = c.id;
    v_resto := v_resto - c.valor;
  end loop;

  update facturas_venta
     set estado = case when estado = 'anulada' then 'anulada'
                       when total - total_pagado <= 0 then 'pagada'
                       else 'pendiente' end
   where id = p_factura_id;
end $$;

-- Vista de facturas con estado de cobro calculado (al día / en mora)
create or replace view public.v_facturas_venta with (security_invoker = true) as
select f.*,
       c.proxima_fecha,
       c.saldo_vencido,
       c.dias_mora,
       case when f.estado = 'anulada' then 'anulada'
            when f.estado = 'pagada'  then 'pagada'
            when c.saldo_vencido > 0  then 'en_mora'
            else 'al_dia' end as estado_cobro
  from public.facturas_venta f
  left join lateral (
    select min(q.fecha_vencimiento) filter (where q.saldo > 0) as proxima_fecha,
           coalesce(sum(q.saldo) filter (where q.saldo > 0 and q.fecha_vencimiento < current_date), 0) as saldo_vencido,
           coalesce(max(current_date - q.fecha_vencimiento) filter (where q.saldo > 0 and q.fecha_vencimiento < current_date), 0) as dias_mora
      from public.cuotas_venta q
     where q.factura_id = f.id
  ) c on true;

-- =========================== PÚBLICAS ================================

create or replace function public.sel_configuracion_publica()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('nombre_negocio', nombre_negocio, 'telefono_whatsapp', telefono_whatsapp,
                            'instagram', instagram, 'ciudad', ciudad)
    from configuracion where id = 1;
$$;

create or replace function public.sel_catalogo(p_tipo text default null, p_genero text default null, p_busqueda text default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(s) order by s.destacado desc, s.nombre), '[]'::jsonb)
    from (
      select p.id, p.nombre, p.marca, p.inspirado_en, p.tipo, p.genero, p.descripcion, p.notas,
             p.imagen_url, p.destacado,
             (select jsonb_agg(jsonb_build_object('id', pr.id, 'mililitros', pr.mililitros,
                                                  'precio_venta', pr.precio_venta) order by pr.mililitros)
                from presentaciones pr where pr.producto_id = p.id and pr.activo) as presentaciones
        from productos p
       where p.activo
         and (p_tipo is null or p.tipo = p_tipo)
         and (p_genero is null or p.genero = p_genero)
         and (coalesce(p_busqueda, '') = ''
              or p.nombre ilike '%' || p_busqueda || '%'
              or p.marca ilike '%' || p_busqueda || '%'
              or p.inspirado_en ilike '%' || p_busqueda || '%')
         and exists (select 1 from presentaciones pr where pr.producto_id = p.id and pr.activo)
    ) s;
$$;

-- ============================ SESIÓN =================================

create or replace function public.sel_es_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public._es_admin();
$$;

-- ========================= CONFIGURACIÓN =============================

create or replace function public.sel_configuracion()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform _validar_admin();
  return (select to_jsonb(c) from configuracion c where id = 1);
end $$;

create or replace function public.actualizar_configuracion(p_data jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform _validar_admin();
  update configuracion set
    nombre_negocio       = coalesce(nullif(p_data->>'nombre_negocio', ''), nombre_negocio),
    nit                  = case when p_data ? 'nit' then nullif(p_data->>'nit', '') else nit end,
    telefono_whatsapp    = coalesce(nullif(regexp_replace(coalesce(p_data->>'telefono_whatsapp', ''), '\D', '', 'g'), ''), telefono_whatsapp),
    direccion            = case when p_data ? 'direccion' then nullif(p_data->>'direccion', '') else direccion end,
    ciudad               = case when p_data ? 'ciudad' then nullif(p_data->>'ciudad', '') else ciudad end,
    email                = case when p_data ? 'email' then nullif(p_data->>'email', '') else email end,
    instagram            = case when p_data ? 'instagram' then nullif(p_data->>'instagram', '') else instagram end,
    prefijo_factura      = coalesce(nullif(p_data->>'prefijo_factura', ''), prefijo_factura),
    mensaje_recordatorio = coalesce(nullif(p_data->>'mensaje_recordatorio', ''), mensaje_recordatorio),
    pie_factura          = case when p_data ? 'pie_factura' then nullif(p_data->>'pie_factura', '') else pie_factura end,
    updated_at           = now()
  where id = 1;
end $$;

-- =========================== PRODUCTOS ===============================

create or replace function public.sel_productos(p_busqueda text default null, p_tipo text default null, p_incluir_inactivos boolean default false)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform _validar_admin();
  return (
    select coalesce(jsonb_agg(to_jsonb(s) order by s.nombre), '[]'::jsonb)
      from (
        select p.*,
               (select coalesce(jsonb_agg(to_jsonb(pr) order by pr.mililitros), '[]'::jsonb)
                  from presentaciones pr where pr.producto_id = p.id and (pr.activo or p_incluir_inactivos)) as presentaciones
          from productos p
         where (p.activo or p_incluir_inactivos)
           and (p_tipo is null or p.tipo = p_tipo)
           and (coalesce(p_busqueda, '') = ''
                or p.nombre ilike '%' || p_busqueda || '%'
                or p.marca ilike '%' || p_busqueda || '%'
                or p.inspirado_en ilike '%' || p_busqueda || '%')
      ) s);
end $$;

create or replace function public.sel_producto(p_id bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform _validar_admin();
  return (
    select to_jsonb(p) || jsonb_build_object('presentaciones',
             (select coalesce(jsonb_agg(to_jsonb(pr) order by pr.mililitros), '[]'::jsonb)
                from presentaciones pr where pr.producto_id = p.id and pr.activo))
      from productos p where p.id = p_id);
end $$;

-- Inserta/actualiza presentaciones de un producto por mililitros (uso interno)
create or replace function public._sincronizar_presentaciones(p_producto_id bigint, p_presentaciones jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_actual presentaciones%rowtype;
  v_id bigint;
  v_ml int[] := '{}';
begin
  if jsonb_typeof(p_presentaciones) is distinct from 'array' or jsonb_array_length(p_presentaciones) = 0 then
    raise exception 'Agrega al menos una presentación (ml)';
  end if;

  for r in select * from jsonb_to_recordset(p_presentaciones)
             as x(mililitros int, precio_venta numeric, costo numeric, stock int) loop
    if r.mililitros is null or r.mililitros <= 0 then
      raise exception 'Mililitros inválidos';
    end if;
    if r.mililitros = any(v_ml) then
      raise exception 'La presentación de % ml está repetida', r.mililitros;
    end if;
    v_ml := v_ml || r.mililitros;

    select * into v_actual from presentaciones
     where producto_id = p_producto_id and mililitros = r.mililitros for update;

    if found then
      update presentaciones set precio_venta = coalesce(r.precio_venta, 0), costo = coalesce(r.costo, 0),
                                stock = coalesce(r.stock, v_actual.stock), activo = true
       where id = v_actual.id;
      if coalesce(r.stock, v_actual.stock) <> v_actual.stock then
        insert into movimientos_inventario (presentacion_id, tipo, cantidad, costo_unitario, referencia)
        values (v_actual.id, 'ajuste', r.stock - v_actual.stock, r.costo, 'Ajuste desde edición de producto');
      end if;
    else
      insert into presentaciones (producto_id, mililitros, precio_venta, costo, stock)
      values (p_producto_id, r.mililitros, coalesce(r.precio_venta, 0), coalesce(r.costo, 0), coalesce(r.stock, 0))
      returning id into v_id;
      if coalesce(r.stock, 0) <> 0 then
        insert into movimientos_inventario (presentacion_id, tipo, cantidad, costo_unitario, referencia)
        values (v_id, 'ajuste', r.stock, r.costo, 'Stock inicial');
      end if;
    end if;
  end loop;

  update presentaciones set activo = false
   where producto_id = p_producto_id and not (mililitros = any(v_ml));
end $$;

create or replace function public.guardar_producto(p_data jsonb)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  perform _validar_admin();
  if coalesce(trim(p_data->>'nombre'), '') = '' then raise exception 'El nombre es obligatorio'; end if;

  insert into productos (nombre, marca, inspirado_en, tipo, genero, descripcion, notas, imagen_url, destacado, activo)
  values (trim(p_data->>'nombre'), nullif(p_data->>'marca', ''), nullif(p_data->>'inspirado_en', ''),
          p_data->>'tipo', coalesce(nullif(p_data->>'genero', ''), 'unisex'),
          nullif(p_data->>'descripcion', ''), nullif(p_data->>'notas', ''), nullif(p_data->>'imagen_url', ''),
          coalesce((p_data->>'destacado')::boolean, false), coalesce((p_data->>'activo')::boolean, true))
  returning id into v_id;

  perform _sincronizar_presentaciones(v_id, p_data->'presentaciones');
  return v_id;
end $$;

create or replace function public.actualizar_producto(p_id bigint, p_data jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform _validar_admin();
  if coalesce(trim(p_data->>'nombre'), '') = '' then raise exception 'El nombre es obligatorio'; end if;

  update productos set
    nombre = trim(p_data->>'nombre'),
    marca = nullif(p_data->>'marca', ''),
    inspirado_en = nullif(p_data->>'inspirado_en', ''),
    tipo = p_data->>'tipo',
    genero = coalesce(nullif(p_data->>'genero', ''), 'unisex'),
    descripcion = nullif(p_data->>'descripcion', ''),
    notas = nullif(p_data->>'notas', ''),
    imagen_url = nullif(p_data->>'imagen_url', ''),
    destacado = coalesce((p_data->>'destacado')::boolean, false),
    activo = coalesce((p_data->>'activo')::boolean, true)
  where id = p_id;
  if not found then raise exception 'Producto no encontrado'; end if;

  if p_data ? 'presentaciones' then
    perform _sincronizar_presentaciones(p_id, p_data->'presentaciones');
  end if;
end $$;

-- Si el producto ya tiene ventas o compras se desactiva; si no, se borra
create or replace function public.eliminar_producto(p_id bigint)
returns text language plpgsql security definer set search_path = public as $$
begin
  perform _validar_admin();
  if exists (select 1 from factura_venta_detalle d join presentaciones pr on pr.id = d.presentacion_id where pr.producto_id = p_id)
     or exists (select 1 from factura_compra_detalle d join presentaciones pr on pr.id = d.presentacion_id where pr.producto_id = p_id) then
    update productos set activo = false where id = p_id;
    update presentaciones set activo = false where producto_id = p_id;
    return 'desactivado';
  end if;
  delete from productos where id = p_id;
  return 'eliminado';
end $$;

-- =========================== INVENTARIO ==============================

create or replace function public.sel_inventario(p_busqueda text default null, p_solo_por_pedir boolean default false)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform _validar_admin();
  return (
    select coalesce(jsonb_agg(to_jsonb(s) order by s.producto, s.mililitros), '[]'::jsonb)
      from (
        select pr.id as presentacion_id, p.id as producto_id, p.nombre as producto, p.tipo, p.genero,
               pr.mililitros, pr.precio_venta, pr.costo, pr.stock,
               pr.precio_venta - pr.costo as margen,
               case when pr.precio_venta > 0 then round((pr.precio_venta - pr.costo) / pr.precio_venta * 100, 1) else 0 end as margen_pct,
               greatest(pr.stock, 0) * pr.costo as valor_inventario,
               greatest(-pr.stock, 0) as por_pedir
          from presentaciones pr
          join productos p on p.id = pr.producto_id
         where pr.activo and p.activo
           and (not p_solo_por_pedir or pr.stock < 0)
           and (coalesce(p_busqueda, '') = ''
                or p.nombre ilike '%' || p_busqueda || '%'
                or p.marca ilike '%' || p_busqueda || '%'
                or p.inspirado_en ilike '%' || p_busqueda || '%')
      ) s);
end $$;

create or replace function public.sel_movimientos_inventario(p_presentacion_id bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform _validar_admin();
  return (select coalesce(jsonb_agg(to_jsonb(m) order by m.fecha desc), '[]'::jsonb)
            from movimientos_inventario m where m.presentacion_id = p_presentacion_id);
end $$;

create or replace function public.guardar_ajuste_inventario(p_presentacion_id bigint, p_cantidad int, p_motivo text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform _validar_admin();
  if coalesce(p_cantidad, 0) = 0 then raise exception 'La cantidad no puede ser 0'; end if;
  update presentaciones set stock = stock + p_cantidad where id = p_presentacion_id;
  if not found then raise exception 'Presentación no encontrada'; end if;
  insert into movimientos_inventario (presentacion_id, tipo, cantidad, referencia)
  values (p_presentacion_id, 'ajuste', p_cantidad, coalesce(nullif(p_motivo, ''), 'Ajuste manual'));
end $$;

-- ============================ CLIENTES ===============================

create or replace function public.sel_clientes(p_busqueda text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform _validar_admin();
  return (
    select coalesce(jsonb_agg(to_jsonb(s) order by s.nombre), '[]'::jsonb)
      from (
        select c.*,
               coalesce(t.saldo, 0) as saldo_pendiente,
               coalesce(t.vencido, 0) as saldo_vencido,
               coalesce(t.facturas, 0) as facturas
          from clientes c
          left join lateral (
            select sum(v.saldo) filter (where v.estado = 'pendiente') as saldo,
                   sum(v.saldo_vencido) filter (where v.estado = 'pendiente') as vencido,
                   count(*) filter (where v.estado <> 'anulada') as facturas
              from v_facturas_venta v where v.cliente_id = c.id
          ) t on true
         where c.activo
           and (coalesce(p_busqueda, '') = ''
                or c.nombre ilike '%' || p_busqueda || '%'
                or c.documento ilike '%' || p_busqueda || '%'
                or c.telefono ilike '%' || p_busqueda || '%')
      ) s);
end $$;

create or replace function public.sel_cliente(p_id bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform _validar_admin();
  return (
    select to_jsonb(c) || jsonb_build_object('facturas',
             (select coalesce(jsonb_agg(jsonb_build_object(
                       'id', v.id, 'numero', v.numero, 'fecha_emision', v.fecha_emision, 'total', v.total,
                       'saldo', v.saldo, 'estado_cobro', v.estado_cobro, 'proxima_fecha', v.proxima_fecha)
                     order by v.fecha_emision desc), '[]'::jsonb)
                from v_facturas_venta v where v.cliente_id = c.id))
      from clientes c where c.id = p_id);
end $$;

create or replace function public.guardar_cliente(p_data jsonb)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  perform _validar_admin();
  if coalesce(trim(p_data->>'nombre'), '') = '' then raise exception 'El nombre del cliente es obligatorio'; end if;
  insert into clientes (nombre, documento, telefono, email, direccion, ciudad, autoriza_whatsapp, notas)
  values (trim(p_data->>'nombre'), nullif(p_data->>'documento', ''),
          nullif(regexp_replace(coalesce(p_data->>'telefono', ''), '\D', '', 'g'), ''),
          nullif(p_data->>'email', ''), nullif(p_data->>'direccion', ''), nullif(p_data->>'ciudad', ''),
          coalesce((p_data->>'autoriza_whatsapp')::boolean, true), nullif(p_data->>'notas', ''))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.actualizar_cliente(p_id bigint, p_data jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform _validar_admin();
  if coalesce(trim(p_data->>'nombre'), '') = '' then raise exception 'El nombre del cliente es obligatorio'; end if;
  update clientes set
    nombre = trim(p_data->>'nombre'),
    documento = nullif(p_data->>'documento', ''),
    telefono = nullif(regexp_replace(coalesce(p_data->>'telefono', ''), '\D', '', 'g'), ''),
    email = nullif(p_data->>'email', ''),
    direccion = nullif(p_data->>'direccion', ''),
    ciudad = nullif(p_data->>'ciudad', ''),
    autoriza_whatsapp = coalesce((p_data->>'autoriza_whatsapp')::boolean, true),
    notas = nullif(p_data->>'notas', '')
  where id = p_id;
  if not found then raise exception 'Cliente no encontrado'; end if;
end $$;

create or replace function public.eliminar_cliente(p_id bigint)
returns text language plpgsql security definer set search_path = public as $$
begin
  perform _validar_admin();
  if exists (select 1 from facturas_venta where cliente_id = p_id) then
    update clientes set activo = false where id = p_id;
    return 'desactivado';
  end if;
  delete from clientes where id = p_id;
  return 'eliminado';
end $$;

-- =========================== PROVEEDORES =============================

create or replace function public.sel_proveedores(p_busqueda text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform _validar_admin();
  return (
    select coalesce(jsonb_agg(to_jsonb(s) order by s.nombre), '[]'::jsonb)
      from (
        select pv.*,
               (select coalesce(sum(total), 0) from facturas_compra fc where fc.proveedor_id = pv.id) as total_comprado,
               (select coalesce(sum(total), 0) from facturas_compra fc where fc.proveedor_id = pv.id and not fc.pagada) as por_pagar
          from proveedores pv
         where pv.activo
           and (coalesce(p_busqueda, '') = '' or pv.nombre ilike '%' || p_busqueda || '%' or pv.nit ilike '%' || p_busqueda || '%')
      ) s);
end $$;

create or replace function public.guardar_proveedor(p_data jsonb)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  perform _validar_admin();
  if coalesce(trim(p_data->>'nombre'), '') = '' then raise exception 'El nombre del proveedor es obligatorio'; end if;
  insert into proveedores (nombre, nit, telefono, email, direccion, notas)
  values (trim(p_data->>'nombre'), nullif(p_data->>'nit', ''),
          nullif(regexp_replace(coalesce(p_data->>'telefono', ''), '\D', '', 'g'), ''),
          nullif(p_data->>'email', ''), nullif(p_data->>'direccion', ''), nullif(p_data->>'notas', ''))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.actualizar_proveedor(p_id bigint, p_data jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform _validar_admin();
  if coalesce(trim(p_data->>'nombre'), '') = '' then raise exception 'El nombre del proveedor es obligatorio'; end if;
  update proveedores set
    nombre = trim(p_data->>'nombre'),
    nit = nullif(p_data->>'nit', ''),
    telefono = nullif(regexp_replace(coalesce(p_data->>'telefono', ''), '\D', '', 'g'), ''),
    email = nullif(p_data->>'email', ''),
    direccion = nullif(p_data->>'direccion', ''),
    notas = nullif(p_data->>'notas', '')
  where id = p_id;
  if not found then raise exception 'Proveedor no encontrado'; end if;
end $$;

create or replace function public.eliminar_proveedor(p_id bigint)
returns text language plpgsql security definer set search_path = public as $$
begin
  perform _validar_admin();
  if exists (select 1 from facturas_compra where proveedor_id = p_id) then
    update proveedores set activo = false where id = p_id;
    return 'desactivado';
  end if;
  delete from proveedores where id = p_id;
  return 'eliminado';
end $$;

-- ======================== FACTURAS DE VENTA ==========================

create or replace function public.sel_facturas_venta(p_desde date default null, p_hasta date default null,
                                                     p_estado_cobro text default null, p_busqueda text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform _validar_admin();
  return (
    select coalesce(jsonb_agg(to_jsonb(v) order by v.fecha_emision desc, v.id desc), '[]'::jsonb)
      from v_facturas_venta v
     where (p_desde is null or v.fecha_emision >= p_desde)
       and (p_hasta is null or v.fecha_emision <= p_hasta)
       and (p_estado_cobro is null or v.estado_cobro = p_estado_cobro)
       and (coalesce(p_busqueda, '') = ''
            or v.numero ilike '%' || p_busqueda || '%'
            or v.cliente_nombre ilike '%' || p_busqueda || '%'
            or v.telefono_cobro ilike '%' || p_busqueda || '%'));
end $$;

create or replace function public.sel_factura_venta(p_id bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform _validar_admin();
  return (
    select to_jsonb(v) || jsonb_build_object(
             'cliente', (select to_jsonb(c) from clientes c where c.id = v.cliente_id),
             'detalle', (select coalesce(jsonb_agg(to_jsonb(d) order by d.id), '[]'::jsonb)
                           from factura_venta_detalle d where d.factura_id = v.id),
             'cuotas', (select coalesce(jsonb_agg(to_jsonb(q) || jsonb_build_object(
                                 'vencida', q.saldo > 0 and q.fecha_vencimiento < current_date,
                                 'dias_mora', case when q.saldo > 0 and q.fecha_vencimiento < current_date
                                                   then current_date - q.fecha_vencimiento else 0 end)
                               order by q.numero), '[]'::jsonb)
                          from cuotas_venta q where q.factura_id = v.id),
             'pagos', (select coalesce(jsonb_agg(to_jsonb(p) order by p.fecha, p.id), '[]'::jsonb)
                         from pagos_venta p where p.factura_id = v.id),
             'recordatorios', (select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc), '[]'::jsonb)
                                 from recordatorios r where r.factura_id = v.id))
      from v_facturas_venta v where v.id = p_id);
end $$;

/*
  p_data = {
    cliente_id?: number,                       -- si no viene, se crea el cliente
    cliente: { nombre, documento, telefono, direccion, ciudad, email, autoriza_whatsapp },
    telefono_cobro: '3001234567',              -- obligatorio
    fecha_emision?: 'YYYY-MM-DD',
    fecha_vencimiento: 'YYYY-MM-DD',           -- fecha de cobro (1ª cuota si es financiado)
    tipo_pago: 'contado' | 'financiado',
    metodo_pago?, numero_cuotas?, frecuencia?: 'semanal'|'quincenal'|'mensual',
    descuento?, abono_inicial?, notas?,
    items: [{ presentacion_id, cantidad, precio_unitario? }]
  }
*/
create or replace function public.guardar_factura_venta(p_data jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_cliente      clientes%rowtype;
  v_cliente_id   bigint := nullif(p_data->>'cliente_id', '')::bigint;
  v_tel          text := regexp_replace(coalesce(p_data->>'telefono_cobro', ''), '\D', '', 'g');
  v_tipo         text := coalesce(p_data->>'tipo_pago', 'contado');
  v_emision      date := coalesce(nullif(p_data->>'fecha_emision', '')::date, current_date);
  v_venc         date;
  v_cuotas       int  := greatest(coalesce(nullif(p_data->>'numero_cuotas', '')::int, 1), 1);
  v_frec         text := coalesce(nullif(p_data->>'frecuencia', ''), 'mensual');
  v_desc         numeric(14,2) := coalesce(nullif(p_data->>'descuento', '')::numeric, 0);
  v_abono        numeric(14,2);
  v_prefijo      text;
  v_consec       int;
  v_numero       text;
  v_factura_id   bigint;
  v_subtotal     numeric(14,2) := 0;
  v_total        numeric(14,2);
  v_resto        numeric(14,2);
  v_valor_cuota  numeric(14,2);
  v_paso         interval;
  it             record;
  v_pres         record;
  v_precio       numeric(14,2);
  i              int;
begin
  perform _validar_admin();

  if jsonb_typeof(p_data->'items') is distinct from 'array' or jsonb_array_length(p_data->'items') = 0 then
    raise exception 'La factura debe tener al menos un producto';
  end if;
  if length(v_tel) < 7 then raise exception 'El teléfono de cobro es obligatorio'; end if;
  if v_tipo not in ('contado', 'financiado') then raise exception 'Tipo de pago inválido'; end if;
  if v_tipo = 'contado' then v_cuotas := 1; end if;

  v_venc := coalesce(nullif(p_data->>'fecha_vencimiento', '')::date, v_emision);
  if v_venc < v_emision then raise exception 'La fecha de cobro no puede ser anterior a la fecha de emisión'; end if;

  -- Cliente
  if v_cliente_id is null then
    v_cliente_id := guardar_cliente(coalesce(p_data->'cliente', '{}'::jsonb)
                                    || jsonb_build_object('telefono', coalesce(nullif(p_data->'cliente'->>'telefono', ''), v_tel)));
  end if;
  select * into v_cliente from clientes where id = v_cliente_id;
  if not found then raise exception 'Cliente no encontrado'; end if;
  if v_cliente.telefono is null then update clientes set telefono = v_tel where id = v_cliente_id; end if;
  if p_data->'cliente' ? 'autoriza_whatsapp' then
    update clientes set autoriza_whatsapp = (p_data->'cliente'->>'autoriza_whatsapp')::boolean where id = v_cliente_id;
  end if;

  -- Consecutivo (el UPDATE bloquea la fila: no se repiten números)
  update configuracion set consecutivo_factura = consecutivo_factura + 1 where id = 1
  returning prefijo_factura, consecutivo_factura into v_prefijo, v_consec;
  v_numero := v_prefijo || '-' || lpad(v_consec::text, 5, '0');

  insert into facturas_venta (numero, cliente_id, cliente_nombre, cliente_documento, cliente_direccion, telefono_cobro,
                              fecha_emision, fecha_vencimiento, tipo_pago, metodo_pago, numero_cuotas, frecuencia, notas)
  values (v_numero, v_cliente_id, v_cliente.nombre, v_cliente.documento,
          coalesce(nullif(p_data->'cliente'->>'direccion', ''), v_cliente.direccion), v_tel,
          v_emision, v_venc, v_tipo, nullif(p_data->>'metodo_pago', ''), v_cuotas, v_frec, nullif(p_data->>'notas', ''))
  returning id into v_factura_id;

  -- Detalle + inventario (por encargo: el stock puede quedar negativo = por pedir)
  for it in select * from jsonb_to_recordset(p_data->'items') as x(presentacion_id bigint, cantidad int, precio_unitario numeric) loop
    if coalesce(it.cantidad, 0) <= 0 then raise exception 'Cantidad inválida'; end if;
    select pr.*, p.nombre as producto_nombre, p.tipo into v_pres
      from presentaciones pr join productos p on p.id = pr.producto_id
     where pr.id = it.presentacion_id for update of pr;
    if not found then raise exception 'Presentación % no encontrada', it.presentacion_id; end if;

    v_precio := coalesce(it.precio_unitario, v_pres.precio_venta);
    if v_precio < 0 then raise exception 'Precio inválido'; end if;

    insert into factura_venta_detalle (factura_id, presentacion_id, producto_nombre, tipo, mililitros, cantidad, precio_unitario, costo_unitario)
    values (v_factura_id, v_pres.id, v_pres.producto_nombre, v_pres.tipo, v_pres.mililitros, it.cantidad, v_precio, v_pres.costo);

    update presentaciones set stock = stock - it.cantidad where id = v_pres.id;
    insert into movimientos_inventario (presentacion_id, tipo, cantidad, costo_unitario, referencia)
    values (v_pres.id, 'salida', -it.cantidad, v_pres.costo, 'Venta ' || v_numero);

    v_subtotal := v_subtotal + it.cantidad * v_precio;
  end loop;

  if v_desc > v_subtotal then raise exception 'El descuento no puede ser mayor al subtotal'; end if;
  v_total := v_subtotal - v_desc;
  update facturas_venta set subtotal = v_subtotal, descuento = v_desc, total = v_total where id = v_factura_id;

  -- Abono inicial: en contado por defecto se paga todo
  v_abono := coalesce(nullif(p_data->>'abono_inicial', '')::numeric, case when v_tipo = 'contado' then v_total else 0 end);
  if v_abono < 0 or v_abono > v_total then raise exception 'El abono inicial no es válido'; end if;
  if v_tipo = 'financiado' and v_abono >= v_total then raise exception 'Si se paga todo, la factura debe ser de contado'; end if;

  -- Cuotas
  if v_tipo = 'contado' then
    insert into cuotas_venta (factura_id, numero, fecha_vencimiento, valor) values (v_factura_id, 1, v_venc, v_total);
  else
    if v_abono > 0 then
      insert into cuotas_venta (factura_id, numero, fecha_vencimiento, valor) values (v_factura_id, 0, v_emision, v_abono);
    end if;
    v_resto := v_total - v_abono;
    v_valor_cuota := round(v_resto / v_cuotas, 0);
    v_paso := case v_frec when 'semanal' then interval '7 days' when 'quincenal' then interval '15 days' else interval '1 month' end;
    for i in 1..v_cuotas loop
      insert into cuotas_venta (factura_id, numero, fecha_vencimiento, valor)
      values (v_factura_id, i, (v_venc + v_paso * (i - 1))::date,
              case when i = v_cuotas then v_resto - v_valor_cuota * (v_cuotas - 1) else v_valor_cuota end);
    end loop;
  end if;

  if v_abono > 0 then
    insert into pagos_venta (factura_id, fecha, valor, metodo_pago, nota)
    values (v_factura_id, v_emision, v_abono, nullif(p_data->>'metodo_pago', ''),
            case when v_tipo = 'contado' then 'Pago de contado' else 'Cuota inicial' end);
  end if;

  perform _recalcular_factura_venta(v_factura_id);
  return jsonb_build_object('id', v_factura_id, 'numero', v_numero);
end $$;

-- Datos editables después de emitida (teléfono, notas, método, dirección)
create or replace function public.actualizar_factura_venta(p_id bigint, p_data jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_tel text := regexp_replace(coalesce(p_data->>'telefono_cobro', ''), '\D', '', 'g');
begin
  perform _validar_admin();
  if length(v_tel) < 7 then raise exception 'El teléfono de cobro es obligatorio'; end if;
  update facturas_venta set
    telefono_cobro = v_tel,
    metodo_pago = nullif(p_data->>'metodo_pago', ''),
    cliente_direccion = nullif(p_data->>'cliente_direccion', ''),
    notas = nullif(p_data->>'notas', '')
  where id = p_id and estado <> 'anulada';
  if not found then raise exception 'Factura no encontrada o anulada'; end if;
end $$;

-- Reprogramar la fecha de una cuota (acuerdo de pago)
create or replace function public.actualizar_cuota_venta(p_id bigint, p_fecha_vencimiento date)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform _validar_admin();
  if p_fecha_vencimiento is null then raise exception 'Fecha inválida'; end if;
  update cuotas_venta q set fecha_vencimiento = p_fecha_vencimiento
    from facturas_venta f
   where q.id = p_id and f.id = q.factura_id and f.estado = 'pendiente';
  if not found then raise exception 'Cuota no encontrada o factura sin saldo'; end if;
end $$;

-- Anular: devuelve el inventario y deja la factura fuera de informes y cartera
create or replace function public.actualizar_anular_factura_venta(p_id bigint, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare d record; v_num text;
begin
  perform _validar_admin();
  if coalesce(trim(p_motivo), '') = '' then raise exception 'Indica el motivo de la anulación'; end if;
  update facturas_venta set estado = 'anulada', motivo_anulacion = p_motivo
   where id = p_id and estado <> 'anulada' returning numero into v_num;
  if not found then raise exception 'Factura no encontrada o ya anulada'; end if;

  for d in select presentacion_id, cantidad, costo_unitario from factura_venta_detalle where factura_id = p_id loop
    update presentaciones set stock = stock + d.cantidad where id = d.presentacion_id;
    insert into movimientos_inventario (presentacion_id, tipo, cantidad, costo_unitario, referencia)
    values (d.presentacion_id, 'anulacion', d.cantidad, d.costo_unitario, 'Anulación ' || v_num);
  end loop;
end $$;

-- ========================= PAGOS / ABONOS ============================

create or replace function public.guardar_pago_venta(p_factura_id bigint, p_valor numeric, p_fecha date default null,
                                                     p_metodo_pago text default null, p_nota text default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_f facturas_venta%rowtype; v_id bigint;
begin
  perform _validar_admin();
  select * into v_f from facturas_venta where id = p_factura_id for update;
  if not found then raise exception 'Factura no encontrada'; end if;
  if v_f.estado <> 'pendiente' then raise exception 'La factura no tiene saldo pendiente'; end if;
  if coalesce(p_valor, 0) <= 0 then raise exception 'El valor debe ser mayor a 0'; end if;
  if p_valor > v_f.saldo then raise exception 'El abono (%) supera el saldo (%)', p_valor, v_f.saldo; end if;

  insert into pagos_venta (factura_id, fecha, valor, metodo_pago, nota)
  values (p_factura_id, coalesce(p_fecha, current_date), p_valor, nullif(p_metodo_pago, ''), nullif(p_nota, ''))
  returning id into v_id;
  perform _recalcular_factura_venta(p_factura_id);
  return v_id;
end $$;

create or replace function public.eliminar_pago_venta(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare v_fac bigint;
begin
  perform _validar_admin();
  delete from pagos_venta p using facturas_venta f
   where p.id = p_id and f.id = p.factura_id and f.estado <> 'anulada'
  returning p.factura_id into v_fac;
  if v_fac is null then raise exception 'Pago no encontrado o factura anulada'; end if;
  perform _recalcular_factura_venta(v_fac);
end $$;

-- ====================== CARTERA Y RECORDATORIOS ======================

-- Quién me debe (agrupado por cliente)
create or replace function public.sel_cartera()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform _validar_admin();
  return (
    select coalesce(jsonb_agg(to_jsonb(s) order by s.saldo_vencido desc, s.saldo_total desc), '[]'::jsonb)
      from (
        select v.cliente_id, c.nombre as cliente, c.autoriza_whatsapp,
               (array_agg(v.telefono_cobro order by v.fecha_emision desc))[1] as telefono,
               count(*) as facturas,
               sum(v.saldo) as saldo_total,
               sum(v.saldo_vencido) as saldo_vencido,
               max(v.dias_mora) as dias_mora,
               min(v.proxima_fecha) as proxima_fecha,
               case when sum(v.saldo_vencido) > 0 then 'en_mora' else 'al_dia' end as estado
          from v_facturas_venta v join clientes c on c.id = v.cliente_id
         where v.estado = 'pendiente'
         group by v.cliente_id, c.nombre, c.autoriza_whatsapp
      ) s);
end $$;

-- Cuotas por cobrar. p_filtro: 'hoy' | 'vencidas' | 'proximas' (7 días) | 'todas'
create or replace function public.sel_cuotas_por_cobrar(p_filtro text default 'todas')
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform _validar_admin();
  return (
    select coalesce(jsonb_agg(to_jsonb(s) order by s.fecha_vencimiento, s.numero_factura), '[]'::jsonb)
      from (
        select q.id as cuota_id, q.numero as cuota, q.fecha_vencimiento, q.valor, q.saldo as saldo_cuota,
               f.id as factura_id, f.numero as numero_factura, f.cliente_id, f.cliente_nombre, f.telefono_cobro,
               f.saldo as saldo_factura, c.autoriza_whatsapp,
               greatest(current_date - q.fecha_vencimiento, 0) as dias_mora,
               (select max(r.created_at) from recordatorios r where r.factura_id = f.id) as ultimo_recordatorio
          from cuotas_venta q
          join facturas_venta f on f.id = q.factura_id
          join clientes c on c.id = f.cliente_id
         where f.estado = 'pendiente' and q.saldo > 0
           and case coalesce(p_filtro, 'todas')
                 when 'hoy'      then q.fecha_vencimiento = current_date
                 when 'vencidas' then q.fecha_vencimiento < current_date
                 when 'proximas' then q.fecha_vencimiento between current_date and current_date + 7
                 else true end
      ) s);
end $$;

create or replace function public.guardar_recordatorio(p_factura_id bigint, p_cuota_id bigint, p_telefono text, p_mensaje text,
                                                       p_canal text default 'whatsapp')
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  perform _validar_admin();
  insert into recordatorios (factura_id, cuota_id, telefono, mensaje, canal)
  values (p_factura_id, p_cuota_id, regexp_replace(coalesce(p_telefono, ''), '\D', '', 'g'), p_mensaje, coalesce(p_canal, 'whatsapp'))
  returning id into v_id;
  return v_id;
end $$;

-- ======================= FACTURAS DE COMPRA ==========================

create or replace function public.sel_facturas_compra(p_desde date default null, p_hasta date default null, p_proveedor_id bigint default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform _validar_admin();
  return (
    select coalesce(jsonb_agg(to_jsonb(s) order by s.fecha desc, s.id desc), '[]'::jsonb)
      from (
        select fc.*, pv.nombre as proveedor,
               (select coalesce(sum(cantidad), 0) from factura_compra_detalle d where d.factura_id = fc.id) as unidades
          from facturas_compra fc join proveedores pv on pv.id = fc.proveedor_id
         where (p_desde is null or fc.fecha >= p_desde)
           and (p_hasta is null or fc.fecha <= p_hasta)
           and (p_proveedor_id is null or fc.proveedor_id = p_proveedor_id)
      ) s);
end $$;

create or replace function public.sel_factura_compra(p_id bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform _validar_admin();
  return (
    select to_jsonb(fc) || jsonb_build_object(
             'proveedor', (select to_jsonb(pv) from proveedores pv where pv.id = fc.proveedor_id),
             'detalle', (select coalesce(jsonb_agg(to_jsonb(d) || jsonb_build_object(
                                   'producto', p.nombre, 'tipo', p.tipo, 'mililitros', pr.mililitros) order by d.id), '[]'::jsonb)
                           from factura_compra_detalle d
                           join presentaciones pr on pr.id = d.presentacion_id
                           join productos p on p.id = pr.producto_id
                          where d.factura_id = fc.id))
      from facturas_compra fc where fc.id = p_id);
end $$;

/*
  p_data = { proveedor_id, numero_factura?, fecha?, tipo_pago: 'contado'|'credito', fecha_vencimiento?, notas?,
             items: [{ presentacion_id, cantidad, costo_unitario, precio_venta }] }
  Actualiza stock, costo promedio y precio de venta de cada presentación.
*/
create or replace function public.guardar_factura_compra(p_data jsonb)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  v_id    bigint;
  v_total numeric(14,2) := 0;
  v_tipo  text := coalesce(nullif(p_data->>'tipo_pago', ''), 'contado');
  it      record;
  v_pres  presentaciones%rowtype;
  v_costo numeric(14,2);
begin
  perform _validar_admin();
  if nullif(p_data->>'proveedor_id', '') is null then raise exception 'Selecciona el proveedor'; end if;
  if jsonb_typeof(p_data->'items') is distinct from 'array' or jsonb_array_length(p_data->'items') = 0 then
    raise exception 'La compra debe tener al menos un producto';
  end if;

  insert into facturas_compra (numero_factura, proveedor_id, fecha, tipo_pago, fecha_vencimiento, pagada, notas)
  values (nullif(p_data->>'numero_factura', ''), (p_data->>'proveedor_id')::bigint,
          coalesce(nullif(p_data->>'fecha', '')::date, current_date), v_tipo,
          nullif(p_data->>'fecha_vencimiento', '')::date,
          coalesce((p_data->>'pagada')::boolean, v_tipo = 'contado'), nullif(p_data->>'notas', ''))
  returning id into v_id;

  for it in select * from jsonb_to_recordset(p_data->'items')
              as x(presentacion_id bigint, cantidad int, costo_unitario numeric, precio_venta numeric) loop
    if coalesce(it.cantidad, 0) <= 0 then raise exception 'Cantidad inválida'; end if;
    if coalesce(it.costo_unitario, -1) < 0 then raise exception 'Costo inválido'; end if;

    select * into v_pres from presentaciones where id = it.presentacion_id for update;
    if not found then raise exception 'Presentación % no encontrada', it.presentacion_id; end if;

    -- Costo promedio ponderado (si había stock negativo por encargos, se toma el costo nuevo)
    if v_pres.stock > 0 then
      v_costo := round((v_pres.stock * v_pres.costo + it.cantidad * it.costo_unitario) / (v_pres.stock + it.cantidad), 2);
    else
      v_costo := it.costo_unitario;
    end if;

    insert into factura_compra_detalle (factura_id, presentacion_id, cantidad, costo_unitario, precio_venta)
    values (v_id, v_pres.id, it.cantidad, it.costo_unitario, coalesce(it.precio_venta, v_pres.precio_venta));

    update presentaciones
       set stock = stock + it.cantidad,
           costo = v_costo,
           precio_venta = coalesce(nullif(it.precio_venta, 0), precio_venta)
     where id = v_pres.id;

    -- Ventas por encargo que quedaron sin costo: se les asigna el costo real de esta compra
    update factura_venta_detalle set costo_unitario = it.costo_unitario
     where presentacion_id = v_pres.id and costo_unitario = 0;

    insert into movimientos_inventario (presentacion_id, tipo, cantidad, costo_unitario, referencia)
    values (v_pres.id, 'entrada', it.cantidad, it.costo_unitario, 'Compra #' || v_id || coalesce(' (' || (p_data->>'numero_factura') || ')', ''));

    v_total := v_total + it.cantidad * it.costo_unitario;
  end loop;

  update facturas_compra set total = v_total where id = v_id;
  return v_id;
end $$;

create or replace function public.actualizar_estado_compra(p_id bigint, p_pagada boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform _validar_admin();
  update facturas_compra set pagada = p_pagada where id = p_id;
  if not found then raise exception 'Compra no encontrada'; end if;
end $$;

-- Devuelve el stock (el costo promedio no se revierte)
create or replace function public.eliminar_factura_compra(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare d record;
begin
  perform _validar_admin();
  if not exists (select 1 from facturas_compra where id = p_id) then raise exception 'Compra no encontrada'; end if;
  for d in select presentacion_id, cantidad, costo_unitario from factura_compra_detalle where factura_id = p_id loop
    update presentaciones set stock = stock - d.cantidad where id = d.presentacion_id;
    insert into movimientos_inventario (presentacion_id, tipo, cantidad, costo_unitario, referencia)
    values (d.presentacion_id, 'reverso', -d.cantidad, d.costo_unitario, 'Compra #' || p_id || ' eliminada');
  end loop;
  delete from facturas_compra where id = p_id;
end $$;

-- ============================= GASTOS ================================

create or replace function public.sel_gastos(p_desde date default null, p_hasta date default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform _validar_admin();
  return (select coalesce(jsonb_agg(to_jsonb(g) order by g.fecha desc, g.id desc), '[]'::jsonb)
            from gastos g
           where (p_desde is null or g.fecha >= p_desde) and (p_hasta is null or g.fecha <= p_hasta));
end $$;

create or replace function public.guardar_gasto(p_data jsonb)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  perform _validar_admin();
  insert into gastos (fecha, categoria, descripcion, valor, metodo_pago)
  values (coalesce(nullif(p_data->>'fecha', '')::date, current_date), coalesce(nullif(p_data->>'categoria', ''), 'otros'),
          p_data->>'descripcion', (p_data->>'valor')::numeric, nullif(p_data->>'metodo_pago', ''))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.actualizar_gasto(p_id bigint, p_data jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform _validar_admin();
  update gastos set
    fecha = coalesce(nullif(p_data->>'fecha', '')::date, fecha),
    categoria = coalesce(nullif(p_data->>'categoria', ''), 'otros'),
    descripcion = p_data->>'descripcion',
    valor = (p_data->>'valor')::numeric,
    metodo_pago = nullif(p_data->>'metodo_pago', '')
  where id = p_id;
  if not found then raise exception 'Gasto no encontrado'; end if;
end $$;

create or replace function public.eliminar_gasto(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform _validar_admin();
  delete from gastos where id = p_id;
end $$;

-- ============================ INFORMES ===============================

create or replace function public.sel_informe_mensual(p_anio int default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_anio int := coalesce(p_anio, extract(year from current_date)::int);
begin
  perform _validar_admin();
  return (
    select jsonb_agg(to_jsonb(s) order by s.mes)
      from (
        select m.mes,
               v.ventas, v.ventas_contado, v.ventas_financiado, v.facturas,
               cv.costo_ventas,
               v.ventas - cv.costo_ventas as utilidad_bruta,
               g.gastos,
               v.ventas - cv.costo_ventas - g.gastos as utilidad_neta,
               co.compras,
               r.recaudo
          from generate_series(1, 12) as m(mes)
          cross join lateral (
            select coalesce(sum(total), 0) as ventas,
                   coalesce(sum(total) filter (where tipo_pago = 'contado'), 0) as ventas_contado,
                   coalesce(sum(total) filter (where tipo_pago = 'financiado'), 0) as ventas_financiado,
                   count(*) as facturas
              from facturas_venta
             where estado <> 'anulada'
               and fecha_emision >= make_date(v_anio, m.mes, 1)
               and fecha_emision <  make_date(v_anio, m.mes, 1) + interval '1 month') v
          cross join lateral (
            select coalesce(sum(d.cantidad * d.costo_unitario), 0) as costo_ventas
              from factura_venta_detalle d join facturas_venta f on f.id = d.factura_id
             where f.estado <> 'anulada'
               and f.fecha_emision >= make_date(v_anio, m.mes, 1)
               and f.fecha_emision <  make_date(v_anio, m.mes, 1) + interval '1 month') cv
          cross join lateral (
            select coalesce(sum(valor), 0) as gastos from gastos
             where fecha >= make_date(v_anio, m.mes, 1) and fecha < make_date(v_anio, m.mes, 1) + interval '1 month') g
          cross join lateral (
            select coalesce(sum(total), 0) as compras from facturas_compra
             where fecha >= make_date(v_anio, m.mes, 1) and fecha < make_date(v_anio, m.mes, 1) + interval '1 month') co
          cross join lateral (
            select coalesce(sum(p.valor), 0) as recaudo
              from pagos_venta p join facturas_venta f on f.id = p.factura_id
             where f.estado <> 'anulada'
               and p.fecha >= make_date(v_anio, m.mes, 1) and p.fecha < make_date(v_anio, m.mes, 1) + interval '1 month') r
      ) s);
end $$;

create or replace function public.sel_informe_productos(p_desde date default null, p_hasta date default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform _validar_admin();
  return (
    select coalesce(jsonb_agg(to_jsonb(s) order by s.ventas desc), '[]'::jsonb)
      from (
        select d.producto_nombre as producto, d.tipo, d.mililitros,
               sum(d.cantidad) as unidades,
               sum(d.subtotal) as ventas,
               sum(d.cantidad * d.costo_unitario) as costo,
               sum(d.subtotal) - sum(d.cantidad * d.costo_unitario) as utilidad
          from factura_venta_detalle d join facturas_venta f on f.id = d.factura_id
         where f.estado <> 'anulada'
           and (p_desde is null or f.fecha_emision >= p_desde)
           and (p_hasta is null or f.fecha_emision <= p_hasta)
         group by d.producto_nombre, d.tipo, d.mililitros
      ) s);
end $$;

create or replace function public.sel_dashboard()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_ini date := date_trunc('month', current_date)::date;
  v_fin date := (date_trunc('month', current_date) + interval '1 month')::date;
  v_ventas numeric; v_costo numeric; v_gastos numeric; v_recaudo numeric;
begin
  perform _validar_admin();
  select coalesce(sum(total), 0) into v_ventas from facturas_venta
   where estado <> 'anulada' and fecha_emision >= v_ini and fecha_emision < v_fin;
  select coalesce(sum(d.cantidad * d.costo_unitario), 0) into v_costo
    from factura_venta_detalle d join facturas_venta f on f.id = d.factura_id
   where f.estado <> 'anulada' and f.fecha_emision >= v_ini and f.fecha_emision < v_fin;
  select coalesce(sum(valor), 0) into v_gastos from gastos where fecha >= v_ini and fecha < v_fin;
  select coalesce(sum(p.valor), 0) into v_recaudo
    from pagos_venta p join facturas_venta f on f.id = p.factura_id
   where f.estado <> 'anulada' and p.fecha >= v_ini and p.fecha < v_fin;

  return jsonb_build_object(
    'ventas_mes', v_ventas,
    'costo_mes', v_costo,
    'utilidad_bruta_mes', v_ventas - v_costo,
    'gastos_mes', v_gastos,
    'utilidad_neta_mes', v_ventas - v_costo - v_gastos,
    'recaudo_mes', v_recaudo,
    'por_cobrar', (select coalesce(sum(saldo), 0) from facturas_venta where estado = 'pendiente'),
    'vencido', (select coalesce(sum(saldo_vencido), 0) from v_facturas_venta where estado = 'pendiente'),
    'clientes_en_mora', (select count(distinct cliente_id) from v_facturas_venta where estado_cobro = 'en_mora'),
    'cobros_hoy', (select count(*) from cuotas_venta q join facturas_venta f on f.id = q.factura_id
                    where f.estado = 'pendiente' and q.saldo > 0 and q.fecha_vencimiento = current_date),
    'cobros_hoy_valor', (select coalesce(sum(q.saldo), 0) from cuotas_venta q join facturas_venta f on f.id = q.factura_id
                          where f.estado = 'pendiente' and q.saldo > 0 and q.fecha_vencimiento = current_date),
    'por_pedir', (select coalesce(sum(-stock), 0) from presentaciones where activo and stock < 0),
    'compras_por_pagar', (select coalesce(sum(total), 0) from facturas_compra where not pagada),
    'ultimas_ventas', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
                         select id, numero, cliente_nombre, fecha_emision, total, saldo, estado_cobro
                           from v_facturas_venta order by id desc limit 6) x)
  );
end $$;

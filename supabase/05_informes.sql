-- =====================================================================
-- SCENTRA · 05 INFORMES AVANZADOS
-- Ejecutar después de 01-04. Ya incluye sus permisos (no hace falta repetir 03).
-- =====================================================================

-- Informe completo de un período: estado de resultados, flujo de caja,
-- comparativo con el período anterior, mezcla por tipo, gastos por categoría,
-- medios de pago, mejores clientes, ventas por día, edades de cartera e inventario.
create or replace function public.sel_informe_periodo(p_desde date default null, p_hasta date default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_desde date := coalesce(p_desde, date_trunc('month', current_date)::date);
  v_hasta date := coalesce(p_hasta, current_date);
  v_dias  int;
  v_ant_desde date;
  v_ant_hasta date;
  v_res jsonb;
  v_ant jsonb;
begin
  perform _validar_admin();
  if v_hasta < v_desde then raise exception 'La fecha final no puede ser menor que la inicial'; end if;
  v_dias := v_hasta - v_desde + 1;
  v_ant_hasta := v_desde - 1;
  v_ant_desde := v_desde - v_dias;

  v_res := public._resultados_periodo(v_desde, v_hasta);
  v_ant := public._resultados_periodo(v_ant_desde, v_ant_hasta);

  return jsonb_build_object(
    'desde', v_desde,
    'hasta', v_hasta,
    'resultados', v_res,
    'anterior', v_ant || jsonb_build_object('desde', v_ant_desde, 'hasta', v_ant_hasta),

    -- Flujo de caja (dinero que realmente entró y salió)
    'flujo', (
      select jsonb_build_object(
               'recaudo', r.recaudo,
               'compras_pagadas', c.pagadas,
               'gastos', g.gastos,
               'flujo_neto', r.recaudo - c.pagadas - g.gastos,
               'compras_credito', c.credito)
        from (select coalesce(sum(p.valor), 0) as recaudo
                from pagos_venta p join facturas_venta f on f.id = p.factura_id
               where f.estado <> 'anulada' and p.fecha between v_desde and v_hasta) r,
             (select coalesce(sum(total) filter (where pagada), 0) as pagadas,
                     coalesce(sum(total) filter (where not pagada), 0) as credito
                from facturas_compra where fecha between v_desde and v_hasta) c,
             (select coalesce(sum(valor), 0) as gastos from gastos where fecha between v_desde and v_hasta) g),

    'gastos_categoria', (
      select coalesce(jsonb_agg(jsonb_build_object('categoria', categoria, 'valor', valor) order by valor desc), '[]'::jsonb)
        from (select categoria, sum(valor) as valor from gastos
               where fecha between v_desde and v_hasta group by categoria) s),

    'por_tipo', (
      select coalesce(jsonb_agg(to_jsonb(s) order by s.ventas desc), '[]'::jsonb)
        from (select d.tipo, sum(d.cantidad) as unidades, sum(d.subtotal) as ventas,
                     sum(d.cantidad * d.costo_unitario) as costo,
                     sum(d.subtotal) - sum(d.cantidad * d.costo_unitario) as utilidad
                from factura_venta_detalle d join facturas_venta f on f.id = d.factura_id
               where f.estado <> 'anulada' and f.fecha_emision between v_desde and v_hasta
               group by d.tipo) s),

    'productos', (
      select coalesce(jsonb_agg(to_jsonb(s) order by s.ventas desc), '[]'::jsonb)
        from (select d.producto_nombre as producto, d.tipo, d.mililitros,
                     sum(d.cantidad) as unidades, sum(d.subtotal) as ventas,
                     sum(d.cantidad * d.costo_unitario) as costo,
                     sum(d.subtotal) - sum(d.cantidad * d.costo_unitario) as utilidad,
                     sum(d.cantidad) filter (where d.costo_unitario = 0) as unidades_sin_costo
                from factura_venta_detalle d join facturas_venta f on f.id = d.factura_id
               where f.estado <> 'anulada' and f.fecha_emision between v_desde and v_hasta
               group by d.producto_nombre, d.tipo, d.mililitros) s),

    'metodos_pago', (
      select coalesce(jsonb_agg(jsonb_build_object('metodo', metodo, 'valor', valor, 'pagos', pagos) order by valor desc), '[]'::jsonb)
        from (select coalesce(nullif(p.metodo_pago, ''), 'Sin especificar') as metodo, sum(p.valor) as valor, count(*) as pagos
                from pagos_venta p join facturas_venta f on f.id = p.factura_id
               where f.estado <> 'anulada' and p.fecha between v_desde and v_hasta
               group by 1) s),

    'top_clientes', (
      select coalesce(jsonb_agg(to_jsonb(s) order by s.total desc), '[]'::jsonb)
        from (select f.cliente_id, max(f.cliente_nombre) as cliente, count(*) as facturas,
                     sum(f.total) as total, sum(f.saldo) as saldo, max(f.fecha_emision) as ultima_compra
                from facturas_venta f
               where f.estado <> 'anulada' and f.fecha_emision between v_desde and v_hasta
               group by f.cliente_id
               order by sum(f.total) desc limit 10) s),

    'ventas_diarias', (
      select coalesce(jsonb_agg(jsonb_build_object('fecha', d.dia, 'ventas', coalesce(v.ventas, 0), 'recaudo', coalesce(r.recaudo, 0)) order by d.dia), '[]'::jsonb)
        from generate_series(v_desde, v_hasta, interval '1 day') as d(dia)
        left join (select fecha_emision, sum(total) as ventas from facturas_venta
                    where estado <> 'anulada' and fecha_emision between v_desde and v_hasta
                    group by fecha_emision) v on v.fecha_emision = d.dia::date
        left join (select p.fecha, sum(p.valor) as recaudo
                     from pagos_venta p join facturas_venta f on f.id = p.factura_id
                    where f.estado <> 'anulada' and p.fecha between v_desde and v_hasta
                    group by p.fecha) r on r.fecha = d.dia::date
       where v_dias <= 92),

    -- Cartera por edades (al día de hoy, no depende del período)
    'cartera_edades', (
      select jsonb_build_object(
               'por_vencer', coalesce(sum(q.saldo) filter (where q.fecha_vencimiento >= current_date), 0),
               'd1_30',  coalesce(sum(q.saldo) filter (where current_date - q.fecha_vencimiento between 1 and 30), 0),
               'd31_60', coalesce(sum(q.saldo) filter (where current_date - q.fecha_vencimiento between 31 and 60), 0),
               'd61_90', coalesce(sum(q.saldo) filter (where current_date - q.fecha_vencimiento between 61 and 90), 0),
               'd90_mas', coalesce(sum(q.saldo) filter (where current_date - q.fecha_vencimiento > 90), 0),
               'total', coalesce(sum(q.saldo), 0),
               'clientes', count(distinct f.cliente_id))
        from cuotas_venta q join facturas_venta f on f.id = q.factura_id
       where f.estado = 'pendiente' and q.saldo > 0),

    -- Inventario valorizado (al día de hoy)
    'inventario', (
      select jsonb_build_object(
               'referencias', count(*),
               'unidades', coalesce(sum(greatest(pr.stock, 0)), 0),
               'valor_costo', coalesce(sum(greatest(pr.stock, 0) * pr.costo), 0),
               'valor_venta', coalesce(sum(greatest(pr.stock, 0) * pr.precio_venta), 0),
               'por_pedir', coalesce(sum(greatest(-pr.stock, 0)), 0),
               'costo_por_pedir', coalesce(sum(greatest(-pr.stock, 0) * pr.costo), 0),
               'sin_costo', count(*) filter (where pr.costo = 0),
               'agotadas', count(*) filter (where pr.stock = 0))
        from presentaciones pr join productos p on p.id = pr.producto_id
       where pr.activo and p.activo),

    'cuentas_por_pagar', (select coalesce(sum(total), 0) from facturas_compra where not pagada)
  );
end $$;

-- Totales del estado de resultados de un rango (uso interno)
create or replace function public._resultados_periodo(p_desde date, p_hasta date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform _validar_admin();
  return (
  with fv as (
    select * from facturas_venta
     where estado <> 'anulada' and fecha_emision between p_desde and p_hasta
  ), det as (
    select coalesce(sum(d.cantidad), 0) as unidades,
           coalesce(sum(d.cantidad * d.costo_unitario), 0) as costo,
           coalesce(sum(d.cantidad) filter (where d.costo_unitario = 0), 0) as unidades_sin_costo
      from factura_venta_detalle d join fv on fv.id = d.factura_id
  ), g as (
    select coalesce(sum(valor), 0) as gastos from gastos where fecha between p_desde and p_hasta
  ), v as (
    select coalesce(sum(subtotal), 0) as brutas, coalesce(sum(descuento), 0) as descuentos,
           coalesce(sum(total), 0) as netas, count(*) as facturas, count(distinct cliente_id) as clientes,
           coalesce(sum(total) filter (where tipo_pago = 'contado'), 0) as contado,
           coalesce(sum(total) filter (where tipo_pago = 'financiado'), 0) as financiado
      from fv
  ), an as (
    select count(*) as anuladas, coalesce(sum(total), 0) as valor_anuladas
      from facturas_venta where estado = 'anulada' and fecha_emision between p_desde and p_hasta
  )
  select jsonb_build_object(
    'ventas_brutas', v.brutas,
    'descuentos', v.descuentos,
    'ventas_netas', v.netas,
    'costo_ventas', det.costo,
    'utilidad_bruta', v.netas - det.costo,
    'margen_bruto', case when v.netas > 0 then round((v.netas - det.costo) / v.netas * 100, 1) else 0 end,
    'gastos', g.gastos,
    'utilidad_neta', v.netas - det.costo - g.gastos,
    'margen_neto', case when v.netas > 0 then round((v.netas - det.costo - g.gastos) / v.netas * 100, 1) else 0 end,
    'facturas', v.facturas,
    'clientes', v.clientes,
    'unidades', det.unidades,
    'unidades_sin_costo', det.unidades_sin_costo,
    'ticket_promedio', case when v.facturas > 0 then round(v.netas / v.facturas, 0) else 0 end,
    'ventas_contado', v.contado,
    'ventas_financiado', v.financiado,
    'anuladas', an.anuladas,
    'valor_anuladas', an.valor_anuladas)
  from v, det, g, an);
end $$;

-- ---------- Permisos (mismo esquema de 03_seguridad.sql)
revoke execute on function public.sel_informe_periodo(date, date) from public, anon;
revoke execute on function public._resultados_periodo(date, date) from public, anon, authenticated;
grant execute on function public.sel_informe_periodo(date, date) to authenticated;

-- =====================================================================
-- SCENTRA · 04 DATOS INICIALES
-- 1) Primero crea tu usuario en Supabase > Authentication > Users > Add user
--    (correo + contraseña, marca "Auto Confirm User").
-- 2) Cambia el correo y el WhatsApp de abajo y ejecuta.
-- =====================================================================

insert into public.configuracion (id, nombre_negocio, telefono_whatsapp, ciudad, instagram, prefijo_factura)
values (1, 'SCENTRA', '573000000000', 'Montería', 'scentra.vip', 'SC')   -- WhatsApp con indicativo 57, sin + ni espacios
on conflict (id) do update set telefono_whatsapp = excluded.telefono_whatsapp;

insert into public.administradores (user_id, nombre)
select id, 'Administrador' from auth.users where email = 'TU_CORREO@gmail.com'
on conflict (user_id) do nothing;

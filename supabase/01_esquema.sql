-- =====================================================================
-- SCENTRA · 01 ESQUEMA
-- Ejecutar en Supabase > SQL Editor (en orden: 01, 02, 03, 04)
-- =====================================================================

-- ---------- Administradores (usuarios de Supabase Auth con acceso al panel)
create table if not exists public.administradores (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  nombre     text,
  created_at timestamptz not null default now()
);

-- ---------- Configuración del negocio (una sola fila)
create table if not exists public.configuracion (
  id                   int primary key default 1 check (id = 1),
  nombre_negocio       text not null default 'SCENTRA',
  nit                  text,
  telefono_whatsapp    text not null default '573000000000',
  direccion            text,
  ciudad               text default 'Montería',
  email                text,
  instagram            text default 'scentra.vip',
  prefijo_factura      text not null default 'SC',
  consecutivo_factura  int  not null default 0,
  mensaje_recordatorio text not null default
    'Hola {cliente}, te saludamos de SCENTRA. Te recordamos que tu factura {factura} tiene una cuota de {valor} con fecha de pago {fecha}. Saldo total pendiente: {saldo}. ¡Gracias por tu confianza!',
  pie_factura          text default 'Gracias por tu compra. Un susurro de seducción en cada gota.',
  updated_at           timestamptz not null default now()
);

-- ---------- Productos
create table if not exists public.productos (
  id           bigint generated always as identity primary key,
  nombre       text not null,
  marca        text,
  inspirado_en text,
  tipo         text not null check (tipo in ('original','1.1','imitacion')),
  genero       text not null default 'unisex' check (genero in ('hombre','mujer','unisex')),
  descripcion  text,
  notas        text,
  imagen_url   text,
  destacado    boolean not null default false,
  activo       boolean not null default true,
  created_at   timestamptz not null default now()
);

-- Presentaciones (ml). Imitaciones: 30 y 60 ml. Originales/1.1: la que aplique.
-- El stock puede quedar negativo: los productos son por encargo y el negativo
-- indica unidades vendidas pendientes por pedir al proveedor.
create table if not exists public.presentaciones (
  id           bigint generated always as identity primary key,
  producto_id  bigint not null references public.productos(id) on delete cascade,
  mililitros   int not null check (mililitros > 0),
  precio_venta numeric(14,2) not null default 0 check (precio_venta >= 0),
  costo        numeric(14,2) not null default 0 check (costo >= 0),
  stock        int not null default 0,
  activo       boolean not null default true,
  unique (producto_id, mililitros)
);

-- ---------- Clientes y proveedores
create table if not exists public.clientes (
  id                  bigint generated always as identity primary key,
  nombre              text not null,
  documento           text,
  telefono            text,
  email               text,
  direccion           text,
  ciudad              text,
  autoriza_whatsapp   boolean not null default true,
  notas               text,
  activo              boolean not null default true,
  created_at          timestamptz not null default now()
);

create table if not exists public.proveedores (
  id         bigint generated always as identity primary key,
  nombre     text not null,
  nit        text,
  telefono   text,
  email      text,
  direccion  text,
  notas      text,
  activo     boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- Facturas de venta
create table if not exists public.facturas_venta (
  id                bigint generated always as identity primary key,
  numero            text not null unique,
  cliente_id        bigint not null references public.clientes(id),
  cliente_nombre    text not null,
  cliente_documento text,
  cliente_direccion text,
  telefono_cobro    text not null,
  fecha_emision     date not null default current_date,
  fecha_vencimiento date not null,                      -- fecha (primera) de cobro
  tipo_pago         text not null check (tipo_pago in ('contado','financiado')),
  metodo_pago       text,
  numero_cuotas     int  not null default 1 check (numero_cuotas between 1 and 60),
  frecuencia        text not null default 'mensual' check (frecuencia in ('semanal','quincenal','mensual')),
  subtotal          numeric(14,2) not null default 0,
  descuento         numeric(14,2) not null default 0 check (descuento >= 0),
  total             numeric(14,2) not null default 0,
  total_pagado      numeric(14,2) not null default 0,
  saldo             numeric(14,2) generated always as (total - total_pagado) stored,
  estado            text not null default 'pendiente' check (estado in ('pendiente','pagada','anulada')),
  motivo_anulacion  text,
  notas             text,
  created_by        uuid default auth.uid(),
  created_at        timestamptz not null default now()
);

create table if not exists public.factura_venta_detalle (
  id               bigint generated always as identity primary key,
  factura_id       bigint not null references public.facturas_venta(id) on delete cascade,
  presentacion_id  bigint not null references public.presentaciones(id),
  producto_nombre  text not null,
  tipo             text not null,
  mililitros       int  not null,
  cantidad         int  not null check (cantidad > 0),
  precio_unitario  numeric(14,2) not null check (precio_unitario >= 0),
  costo_unitario   numeric(14,2) not null default 0,   -- costo al momento de la venta
  subtotal         numeric(14,2) generated always as (cantidad * precio_unitario) stored
);

-- Cuotas: numero 0 = cuota inicial. El campo pagado se recalcula siempre
-- repartiendo la suma de pagos en orden de cuota.
create table if not exists public.cuotas_venta (
  id                bigint generated always as identity primary key,
  factura_id        bigint not null references public.facturas_venta(id) on delete cascade,
  numero            int  not null,
  fecha_vencimiento date not null,
  valor             numeric(14,2) not null check (valor >= 0),
  pagado            numeric(14,2) not null default 0,
  saldo             numeric(14,2) generated always as (valor - pagado) stored,
  unique (factura_id, numero)
);

create table if not exists public.pagos_venta (
  id          bigint generated always as identity primary key,
  factura_id  bigint not null references public.facturas_venta(id) on delete cascade,
  fecha       date not null default current_date,
  valor       numeric(14,2) not null check (valor > 0),
  metodo_pago text,
  nota        text,
  created_at  timestamptz not null default now()
);

create table if not exists public.recordatorios (
  id          bigint generated always as identity primary key,
  factura_id  bigint not null references public.facturas_venta(id) on delete cascade,
  cuota_id    bigint references public.cuotas_venta(id) on delete set null,
  telefono    text not null,
  mensaje     text not null,
  canal       text not null default 'whatsapp',
  created_at  timestamptz not null default now()
);

-- ---------- Facturas de compra
create table if not exists public.facturas_compra (
  id                bigint generated always as identity primary key,
  numero_factura    text,
  proveedor_id      bigint not null references public.proveedores(id),
  fecha             date not null default current_date,
  tipo_pago         text not null default 'contado' check (tipo_pago in ('contado','credito')),
  fecha_vencimiento date,
  pagada            boolean not null default true,
  total             numeric(14,2) not null default 0,
  notas             text,
  created_at        timestamptz not null default now()
);

create table if not exists public.factura_compra_detalle (
  id              bigint generated always as identity primary key,
  factura_id      bigint not null references public.facturas_compra(id) on delete cascade,
  presentacion_id bigint not null references public.presentaciones(id),
  cantidad        int not null check (cantidad > 0),
  costo_unitario  numeric(14,2) not null check (costo_unitario >= 0),
  precio_venta    numeric(14,2) not null check (precio_venta >= 0),
  subtotal        numeric(14,2) generated always as (cantidad * costo_unitario) stored
);

-- ---------- Gastos operativos
create table if not exists public.gastos (
  id          bigint generated always as identity primary key,
  fecha       date not null default current_date,
  categoria   text not null default 'otros',
  descripcion text not null,
  valor       numeric(14,2) not null check (valor > 0),
  metodo_pago text,
  created_at  timestamptz not null default now()
);

-- ---------- Kardex de inventario
create table if not exists public.movimientos_inventario (
  id              bigint generated always as identity primary key,
  presentacion_id bigint not null references public.presentaciones(id) on delete cascade,
  fecha           timestamptz not null default now(),
  tipo            text not null check (tipo in ('entrada','salida','ajuste','anulacion','reverso')),
  cantidad        int not null,             -- + entra, - sale
  costo_unitario  numeric(14,2),
  referencia      text
);

-- ---------- Índices
create index if not exists ix_presentaciones_producto on public.presentaciones(producto_id);
create index if not exists ix_fv_cliente   on public.facturas_venta(cliente_id);
create index if not exists ix_fv_fecha     on public.facturas_venta(fecha_emision);
create index if not exists ix_fvd_factura  on public.factura_venta_detalle(factura_id);
create index if not exists ix_cuotas_fecha on public.cuotas_venta(fecha_vencimiento);
create index if not exists ix_pagos_fac    on public.pagos_venta(factura_id);
create index if not exists ix_pagos_fecha  on public.pagos_venta(fecha);
create index if not exists ix_fc_fecha     on public.facturas_compra(fecha);
create index if not exists ix_fcd_factura  on public.factura_compra_detalle(factura_id);
create index if not exists ix_gastos_fecha on public.gastos(fecha);
create index if not exists ix_mov_pres     on public.movimientos_inventario(presentacion_id);

export type TipoProducto = 'original' | '1.1' | 'imitacion';
export type Genero = 'hombre' | 'mujer' | 'unisex';
export type EstadoCobro = 'pagada' | 'al_dia' | 'en_mora' | 'anulada';

export interface Presentacion {
  id?: number;
  producto_id?: number;
  mililitros: number;
  precio_venta: number;
  costo?: number;
  stock?: number;
  activo?: boolean;
}

export interface Producto {
  id?: number;
  nombre: string;
  marca?: string | null;
  inspirado_en?: string | null;
  tipo: TipoProducto;
  genero: Genero;
  descripcion?: string | null;
  notas?: string | null;
  imagen_url?: string | null;
  destacado?: boolean;
  activo?: boolean;
  presentaciones: Presentacion[];
}

export interface ItemCarrito {
  presentacion_id: number;
  producto_id: number;
  nombre: string;
  tipo: TipoProducto;
  mililitros: number;
  precio: number;
  cantidad: number;
  imagen_url?: string | null;
}

export interface Cliente {
  id?: number;
  nombre: string;
  documento?: string | null;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
  ciudad?: string | null;
  autoriza_whatsapp?: boolean;
  notas?: string | null;
  saldo_pendiente?: number;
  saldo_vencido?: number;
  facturas?: number;
}

export interface Proveedor {
  id?: number;
  nombre: string;
  nit?: string | null;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
  notas?: string | null;
  total_comprado?: number;
  por_pagar?: number;
}

export interface InventarioItem {
  presentacion_id: number;
  producto_id: number;
  producto: string;
  tipo: TipoProducto;
  genero: Genero;
  mililitros: number;
  precio_venta: number;
  costo: number;
  stock: number;
  margen: number;
  margen_pct: number;
  valor_inventario: number;
  por_pedir: number;
}

export interface FacturaVenta {
  id: number;
  numero: string;
  cliente_id: number;
  cliente_nombre: string;
  cliente_documento?: string | null;
  cliente_direccion?: string | null;
  telefono_cobro: string;
  fecha_emision: string;
  fecha_vencimiento: string;
  tipo_pago: 'contado' | 'financiado';
  metodo_pago?: string | null;
  numero_cuotas: number;
  frecuencia: string;
  subtotal: number;
  descuento: number;
  total: number;
  total_pagado: number;
  saldo: number;
  estado: 'pendiente' | 'pagada' | 'anulada';
  estado_cobro: EstadoCobro;
  motivo_anulacion?: string | null;
  notas?: string | null;
  proxima_fecha?: string | null;
  saldo_vencido: number;
  dias_mora: number;
  cliente?: Cliente;
  detalle?: DetalleVenta[];
  cuotas?: Cuota[];
  pagos?: Pago[];
  recordatorios?: { id: number; created_at: string; telefono: string; mensaje: string }[];
}

export interface DetalleVenta {
  id: number;
  presentacion_id: number;
  producto_nombre: string;
  tipo: TipoProducto;
  mililitros: number;
  cantidad: number;
  precio_unitario: number;
  costo_unitario: number;
  subtotal: number;
}

export interface Cuota {
  id: number;
  numero: number;
  fecha_vencimiento: string;
  valor: number;
  pagado: number;
  saldo: number;
  vencida: boolean;
  dias_mora: number;
}

export interface Pago {
  id: number;
  fecha: string;
  valor: number;
  metodo_pago?: string | null;
  nota?: string | null;
}

export interface CuotaPorCobrar {
  cuota_id: number;
  cuota: number;
  fecha_vencimiento: string;
  valor: number;
  saldo_cuota: number;
  factura_id: number;
  numero_factura: string;
  cliente_id: number;
  cliente_nombre: string;
  telefono_cobro: string;
  saldo_factura: number;
  autoriza_whatsapp: boolean;
  dias_mora: number;
  ultimo_recordatorio?: string | null;
}

export interface CarteraCliente {
  cliente_id: number;
  cliente: string;
  telefono: string;
  autoriza_whatsapp: boolean;
  facturas: number;
  saldo_total: number;
  saldo_vencido: number;
  dias_mora: number;
  proxima_fecha?: string | null;
  estado: 'en_mora' | 'al_dia';
}

export interface FacturaCompra {
  id: number;
  numero_factura?: string | null;
  proveedor_id: number;
  proveedor?: string | Proveedor;
  fecha: string;
  tipo_pago: 'contado' | 'credito';
  fecha_vencimiento?: string | null;
  pagada: boolean;
  total: number;
  notas?: string | null;
  unidades?: number;
  detalle?: {
    id: number;
    producto: string;
    tipo: TipoProducto;
    mililitros: number;
    cantidad: number;
    costo_unitario: number;
    precio_venta: number;
    subtotal: number;
  }[];
}

export interface Gasto {
  id?: number;
  fecha: string;
  categoria: string;
  descripcion: string;
  valor: number;
  metodo_pago?: string | null;
}

export interface InformeMes {
  mes: number;
  ventas: number;
  ventas_contado: number;
  ventas_financiado: number;
  facturas: number;
  costo_ventas: number;
  utilidad_bruta: number;
  gastos: number;
  utilidad_neta: number;
  compras: number;
  recaudo: number;
}

export interface Configuracion {
  nombre_negocio: string;
  nit?: string | null;
  telefono_whatsapp: string;
  direccion?: string | null;
  ciudad?: string | null;
  email?: string | null;
  instagram?: string | null;
  prefijo_factura: string;
  consecutivo_factura?: number;
  mensaje_recordatorio: string;
  pie_factura?: string | null;
}

export const TIPOS: { valor: TipoProducto; etiqueta: string }[] = [
  { valor: 'original', etiqueta: 'Original' },
  { valor: '1.1', etiqueta: '1.1' },
  { valor: 'imitacion', etiqueta: 'Imitación' },
];

export const METODOS_PAGO = ['Efectivo', 'Transferencia', 'Nequi', 'Daviplata', 'Tarjeta', 'Otro'];
export const CATEGORIAS_GASTO = ['envíos', 'publicidad', 'empaques', 'transporte', 'servicios', 'arriendo', 'nómina', 'otros'];

export function etiquetaTipo(t: string): string {
  return TIPOS.find((x) => x.valor === t)?.etiqueta ?? t;
}

export interface ResultadosPeriodo {
  ventas_brutas: number;
  descuentos: number;
  ventas_netas: number;
  costo_ventas: number;
  utilidad_bruta: number;
  margen_bruto: number;
  gastos: number;
  utilidad_neta: number;
  margen_neto: number;
  facturas: number;
  clientes: number;
  unidades: number;
  unidades_sin_costo: number;
  ticket_promedio: number;
  ventas_contado: number;
  ventas_financiado: number;
  anuladas: number;
  valor_anuladas: number;
}

export interface InformePeriodo {
  desde: string;
  hasta: string;
  resultados: ResultadosPeriodo;
  anterior: ResultadosPeriodo & { desde: string; hasta: string };
  flujo: { recaudo: number; compras_pagadas: number; gastos: number; flujo_neto: number; compras_credito: number };
  gastos_categoria: { categoria: string; valor: number }[];
  por_tipo: { tipo: TipoProducto; unidades: number; ventas: number; costo: number; utilidad: number }[];
  productos: { producto: string; tipo: TipoProducto; mililitros: number; unidades: number; ventas: number; costo: number; utilidad: number; unidades_sin_costo: number | null }[];
  metodos_pago: { metodo: string; valor: number; pagos: number }[];
  top_clientes: { cliente_id: number; cliente: string; facturas: number; total: number; saldo: number; ultima_compra: string }[];
  ventas_diarias: { fecha: string; ventas: number; recaudo: number }[];
  cartera_edades: { por_vencer: number; d1_30: number; d31_60: number; d61_90: number; d90_mas: number; total: number; clientes: number };
  inventario: { referencias: number; unidades: number; valor_costo: number; valor_venta: number; por_pedir: number; costo_por_pedir: number; sin_costo: number; agotadas: number };
  cuentas_por_pagar: number;
}

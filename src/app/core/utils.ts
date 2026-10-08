const fmtCop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

export function cop(valor: number | string | null | undefined): string {
  return fmtCop.format(Number(valor ?? 0));
}

/** Fecha local de hoy en formato YYYY-MM-DD (sin desfase UTC). */
export function hoyISO(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function sumarDias(iso: string, dias: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const f = new Date(y, m - 1, d + dias);
  return new Date(f.getTime() - f.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function primerDiaMes(): string {
  return hoyISO().slice(0, 8) + '01';
}

/** 'YYYY-MM-DD' -> 'DD/MM/YYYY' */
export function fecha(iso: string | null | undefined): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

/** Normaliza un celular colombiano para wa.me (57 + 10 dígitos). */
export function telefonoWa(tel: string | null | undefined): string {
  const t = (tel ?? '').replace(/\D/g, '');
  if (t.length === 10 && t.startsWith('3')) return '57' + t;
  return t;
}

export function urlWhatsapp(tel: string, mensaje: string): string {
  return `https://wa.me/${telefonoWa(tel)}?text=${encodeURIComponent(mensaje)}`;
}

/** Reemplaza {cliente} {factura} {valor} {fecha} {saldo} en la plantilla del recordatorio. */
export function mensajeRecordatorio(
  plantilla: string,
  datos: { cliente: string; factura: string; valor: number; fecha: string; saldo: number },
): string {
  return plantilla
    .replaceAll('{cliente}', datos.cliente)
    .replaceAll('{factura}', datos.factura)
    .replaceAll('{valor}', cop(datos.valor))
    .replaceAll('{fecha}', fecha(datos.fecha))
    .replaceAll('{saldo}', cop(datos.saldo));
}

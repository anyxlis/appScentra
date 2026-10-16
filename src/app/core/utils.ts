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

/** Variación porcentual entre dos valores (null si no hay base para comparar). */
export function variacion(actual: number, anterior: number): number | null {
  const a = Number(actual), b = Number(anterior);
  if (!b) return null;
  return Math.round(((a - b) / Math.abs(b)) * 1000) / 10;
}

/** Descarga una tabla como CSV (se abre en Excel con tildes correctas). */
export function descargarCsv(nombre: string, encabezados: string[], filas: (string | number | null | undefined)[][]): void {
  const esc = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[";\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  const contenido = [encabezados, ...filas].map((f) => f.map(esc).join(';')).join('\r\n');
  const blob = new Blob(['﻿' + contenido], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre.endsWith('.csv') ? nombre : nombre + '.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ultimoDiaMes(iso: string): string {
  const [y, m] = iso.split('-').map(Number);
  const f = new Date(y, m, 0);
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
}

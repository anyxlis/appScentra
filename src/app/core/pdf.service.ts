import { Injectable } from '@angular/core';
import { Configuracion, FacturaVenta, InformePeriodo } from './models';
import { cop, fecha } from './utils';
import { etiquetaTipo } from './models';

const MARRON: [number, number, number] = [74, 44, 26];
const DORADO: [number, number, number] = [176, 137, 74];

@Injectable({ providedIn: 'root' })
export class PdfService {
  private logo?: string;

  async facturaVenta(f: FacturaVenta, cfg: Configuracion): Promise<void> {
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
    const doc = new jsPDF({ unit: 'mm', format: 'letter' });
    const W = doc.internal.pageSize.getWidth();
    const M = 14;

    // Encabezado
    const logo = await this.cargarLogo();
    if (logo) doc.addImage(logo, 'PNG', M, 10, 30, 30);
    doc.setTextColor(...MARRON);
    doc.setFont('times', 'bold').setFontSize(20).text(cfg.nombre_negocio || 'SCENTRA', M + 35, 18);
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(80);
    const datosNegocio = [
      cfg.nit ? `NIT: ${cfg.nit}` : '',
      [cfg.direccion, cfg.ciudad].filter(Boolean).join(' - '),
      `WhatsApp: +${cfg.telefono_whatsapp}`,
      [cfg.email, cfg.instagram ? `@${cfg.instagram}` : ''].filter(Boolean).join('  ·  '),
    ].filter(Boolean);
    doc.text(datosNegocio, M + 35, 24);

    doc.setFillColor(...MARRON).roundedRect(W - M - 62, 10, 62, 22, 2, 2, 'F');
    doc.setTextColor(255).setFont('helvetica', 'bold').setFontSize(10).text('FACTURA DE VENTA', W - M - 31, 17, { align: 'center' });
    doc.setFontSize(14).text(f.numero, W - M - 31, 26, { align: 'center' });
    if (f.estado === 'anulada') {
      doc.setTextColor(200, 0, 0).setFontSize(40).text('ANULADA', W / 2, 140, { align: 'center', angle: 30 });
    }

    // Cliente y condiciones
    let y = 46;
    doc.setDrawColor(...DORADO).setLineWidth(0.4).line(M, y - 3, W - M, y - 3);
    doc.setTextColor(...MARRON).setFont('helvetica', 'bold').setFontSize(10).text('CLIENTE', M, y);
    doc.text('CONDICIONES', W / 2 + 5, y);
    doc.setFont('helvetica', 'normal').setTextColor(40).setFontSize(9);
    doc.text(
      [
        f.cliente_nombre,
        f.cliente_documento ? `Doc: ${f.cliente_documento}` : '',
        `Tel: ${f.telefono_cobro}`,
        f.cliente_direccion ?? '',
      ].filter(Boolean),
      M,
      y + 5,
    );
    doc.text(
      [
        `Fecha de emisión: ${fecha(f.fecha_emision)}`,
        `Fecha de cobro: ${fecha(f.fecha_vencimiento)}`,
        `Forma de pago: ${f.tipo_pago === 'contado' ? 'Contado' : `Financiado (${f.numero_cuotas} cuotas ${f.frecuencia}es)`}`,
        f.metodo_pago ? `Medio de pago: ${f.metodo_pago}` : '',
      ].filter(Boolean),
      W / 2 + 5,
      y + 5,
    );

    // Detalle
    autoTable(doc, {
      startY: y + 26,
      head: [['Producto', 'Tipo', 'Ml', 'Cant.', 'Precio unit.', 'Subtotal']],
      body: (f.detalle ?? []).map((d) => [
        d.producto_nombre,
        etiquetaTipo(d.tipo),
        String(d.mililitros),
        String(d.cantidad),
        cop(d.precio_unitario),
        cop(d.subtotal),
      ]),
      theme: 'striped',
      headStyles: { fillColor: MARRON },
      styles: { fontSize: 9 },
      columnStyles: { 2: { halign: 'center' }, 3: { halign: 'center' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
      margin: { left: M, right: M },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

    // Totales
    const filas: [string, string][] = [
      ['Subtotal', cop(f.subtotal)],
      ['Descuento', '- ' + cop(f.descuento)],
      ['TOTAL', cop(f.total)],
      ['Pagado', cop(f.total_pagado)],
      ['Saldo pendiente', cop(f.saldo)],
    ];
    doc.setFontSize(10);
    filas.forEach(([k, v], i) => {
      const negrita = k === 'TOTAL' || k === 'Saldo pendiente';
      doc.setFont('helvetica', negrita ? 'bold' : 'normal').setTextColor(negrita ? MARRON[0] : 40, negrita ? MARRON[1] : 40, negrita ? MARRON[2] : 40);
      doc.text(k, W - M - 70, y + i * 6);
      doc.text(v, W - M, y + i * 6, { align: 'right' });
    });
    y += filas.length * 6 + 4;

    // Plan de pagos
    if (f.tipo_pago === 'financiado' && f.cuotas?.length) {
      autoTable(doc, {
        startY: y,
        head: [['Cuota', 'Fecha de cobro', 'Valor', 'Pagado', 'Saldo']],
        body: f.cuotas.map((c) => [
          c.numero === 0 ? 'Inicial' : String(c.numero),
          fecha(c.fecha_vencimiento),
          cop(c.valor),
          cop(c.pagado),
          cop(c.saldo),
        ]),
        theme: 'grid',
        headStyles: { fillColor: DORADO },
        styles: { fontSize: 8.5 },
        columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
        margin: { left: M, right: M },
      });
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
    }

    if (f.notas) {
      doc.setFont('helvetica', 'italic').setFontSize(9).setTextColor(60);
      doc.text(doc.splitTextToSize(`Notas: ${f.notas}`, W - 2 * M), M, y);
      y += 10;
    }

    // Pie
    const H = doc.internal.pageSize.getHeight();
    doc.setDrawColor(...DORADO).line(M, H - 20, W - M, H - 20);
    doc.setFont('times', 'italic').setFontSize(10).setTextColor(...MARRON);
    doc.text(cfg.pie_factura || 'Un susurro de seducción en cada gota.', W / 2, H - 14, { align: 'center' });

    doc.save(`Factura-${f.numero}.pdf`);
  }

  /** Informe gerencial del período en PDF (estado de resultados, flujo, cartera, inventario y productos). */
  async informePeriodo(inf: InformePeriodo, cfg: Configuracion | null): Promise<void> {
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
    const doc = new jsPDF({ unit: 'mm', format: 'letter' });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const M = 14;
    const r = inf.resultados;
    const a = inf.anterior;
    const pct = (v: number) => `${Number(v).toLocaleString('es-CO', { maximumFractionDigits: 1 })}%`;
    const varr = (x: number, y: number) => (Number(y) ? pct(((Number(x) - Number(y)) / Math.abs(Number(y))) * 100) : '—');
    const finY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
    const titulo = (t: string, y: number) => {
      doc.setFont('times', 'bold').setFontSize(13).setTextColor(...MARRON).text(t, M, y);
      return y + 3;
    };
    const base = {
      theme: 'plain' as const,
      styles: { fontSize: 8.5, cellPadding: 1.4, textColor: 40 },
      headStyles: { fillColor: [244, 238, 228] as [number, number, number], textColor: MARRON, fontStyle: 'bold' as const },
      margin: { left: M, right: M },
    };

    type Opc = Parameters<typeof autoTable>[1];
    // Alinea los encabezados igual que su columna (autoTable solo aplica columnStyles al cuerpo)
    const tabla = (o: Opc) => {
      const propio = o.didParseCell;
      autoTable(doc, {
        ...o,
        didParseCell: (d) => {
          const cs = (o.columnStyles as Record<number, { halign?: 'left' | 'right' | 'center' }> | undefined)?.[d.column.index];
          if (d.section === 'head' && cs?.halign) d.cell.styles.halign = cs.halign;
          propio?.(d);
        },
      });
    };
    const espacio = (alto: number) => {
      let y = finY() + 9;
      if (y + alto > H - 16) { doc.addPage(); y = 18; }
      return y;
    };

    const logo = await this.cargarLogo();
    if (logo) doc.addImage(logo, 'PNG', M, 10, 22, 22);
    doc.setTextColor(...MARRON).setFont('times', 'bold').setFontSize(18).text('Informe de gestión', M + 27, 18);
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(90);
    doc.text([`${cfg?.nombre_negocio || 'SCENTRA'}${cfg?.nit ? ' · NIT ' + cfg.nit : ''}`, `Período: ${fecha(inf.desde)} al ${fecha(inf.hasta)}`,
      `Comparado con: ${fecha(a.desde)} al ${fecha(a.hasta)}`], M + 27, 24);
    doc.setFontSize(8).text(`Generado el ${new Date().toLocaleString('es-CO')}`, W - M, 14, { align: 'right' });
    doc.setDrawColor(...DORADO).setLineWidth(0.4).line(M, 36, W - M, 36);

    let y = titulo('Estado de resultados', 44);
    tabla({
      ...base, startY: y,
      head: [['Concepto', 'Período', '% ventas', 'Anterior', 'Variación']],
      body: [
        ['Ventas brutas', cop(r.ventas_brutas), '', cop(a.ventas_brutas), varr(r.ventas_brutas, a.ventas_brutas)],
        ['(-) Descuentos', cop(r.descuentos), '', cop(a.descuentos), ''],
        ['Ventas netas', cop(r.ventas_netas), '100%', cop(a.ventas_netas), varr(r.ventas_netas, a.ventas_netas)],
        ['(-) Costo de ventas', cop(r.costo_ventas), r.ventas_netas ? pct((r.costo_ventas / r.ventas_netas) * 100) : '', cop(a.costo_ventas), varr(r.costo_ventas, a.costo_ventas)],
        ['Utilidad bruta', cop(r.utilidad_bruta), pct(r.margen_bruto), cop(a.utilidad_bruta), varr(r.utilidad_bruta, a.utilidad_bruta)],
        ...inf.gastos_categoria.map((g) => ['   ' + capital(g.categoria), cop(g.valor), r.ventas_netas ? pct((g.valor / r.ventas_netas) * 100) : '', '', '']),
        ['(-) Gastos operacionales', cop(r.gastos), r.ventas_netas ? pct((r.gastos / r.ventas_netas) * 100) : '', cop(a.gastos), varr(r.gastos, a.gastos)],
        ['Utilidad neta', cop(r.utilidad_neta), pct(r.margen_neto), cop(a.utilidad_neta), varr(r.utilidad_neta, a.utilidad_neta)],
      ],
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
      didParseCell: (d) => {
        const t = String(d.row.raw && (d.row.raw as string[])[0]);
        if (d.section === 'body' && ['Ventas netas', 'Utilidad bruta', 'Utilidad neta'].includes(t)) {
          d.cell.styles.fontStyle = 'bold';
          d.cell.styles.fillColor = [250, 246, 239];
        }
      },
    });

    y = titulo('Indicadores', espacio(30));
    tabla({
      ...base, startY: y,
      body: [
        ['Facturas emitidas', String(r.facturas), 'Ticket promedio', cop(r.ticket_promedio)],
        ['Unidades vendidas', String(r.unidades), 'Clientes atendidos', String(r.clientes)],
        ['Ventas de contado', cop(r.ventas_contado), 'Ventas financiadas', cop(r.ventas_financiado)],
        ['Facturas anuladas', `${r.anuladas} (${cop(r.valor_anuladas)})`, 'Unidades sin costo asignado', String(r.unidades_sin_costo)],
      ],
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' }, 3: { halign: 'right', fontStyle: 'bold' } },
    });

    y = titulo('Flujo de caja', espacio(30));
    const f = inf.flujo;
    tabla({
      ...base, startY: y,
      body: [
        ['Entradas: recaudo de clientes', cop(f.recaudo)],
        ['(-) Compras pagadas a proveedores', cop(f.compras_pagadas)],
        ['(-) Gastos pagados', cop(f.gastos)],
        ['Flujo neto del período', cop(f.flujo_neto)],
        ['Compras a crédito del período (por pagar)', cop(f.compras_credito)],
      ],
      columnStyles: { 1: { halign: 'right' } },
      didParseCell: (d) => { if (d.section === 'body' && d.row.index === 3) d.cell.styles.fontStyle = 'bold'; },
    });

    y = titulo('Cartera por edades (hoy)', espacio(30));
    const c = inf.cartera_edades;
    tabla({
      ...base, startY: y,
      head: [['Por vencer', '1-30 días', '31-60 días', '61-90 días', 'Más de 90', 'Total']],
      body: [[cop(c.por_vencer), cop(c.d1_30), cop(c.d31_60), cop(c.d61_90), cop(c.d90_mas), cop(c.total)]],
      columnStyles: { 0: { halign: 'right' }, 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
    });

    y = titulo('Inventario valorizado (hoy)', espacio(30));
    const iv = inf.inventario;
    tabla({
      ...base, startY: y,
      body: [
        ['Valor a costo', cop(iv.valor_costo), 'Valor a precio de venta', cop(iv.valor_venta)],
        ['Unidades en bodega', String(iv.unidades), 'Unidades por pedir (encargos)', `${iv.por_pedir} (${cop(iv.costo_por_pedir)})`],
        ['Cuentas por pagar a proveedores', cop(inf.cuentas_por_pagar), 'Referencias sin costo', String(iv.sin_costo)],
      ],
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' }, 3: { halign: 'right', fontStyle: 'bold' } },
    });

    y = titulo('Ventas por tipo de producto', espacio(30));
    tabla({
      ...base, startY: y,
      head: [['Tipo', 'Unidades', 'Ventas', 'Costo', 'Utilidad', 'Margen']],
      body: inf.por_tipo.map((t) => [etiquetaTipo(t.tipo), String(t.unidades), cop(t.ventas), cop(t.costo), cop(t.utilidad), t.ventas ? pct((t.utilidad / t.ventas) * 100) : '']),
      columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
    });

    y = titulo('Productos vendidos', espacio(30));
    tabla({
      ...base, startY: y,
      head: [['Producto', 'Tipo', 'Ml', 'Unid.', 'Ventas', 'Utilidad', 'Margen', 'Part.']],
      body: inf.productos.map((p) => [p.producto, etiquetaTipo(p.tipo), String(p.mililitros), String(p.unidades), cop(p.ventas), cop(p.utilidad),
        p.ventas ? pct((p.utilidad / p.ventas) * 100) : '', r.ventas_brutas ? pct((p.ventas / r.ventas_brutas) * 100) : '']),
      columnStyles: { 2: { halign: 'center' }, 3: { halign: 'center' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' } },
    });

    y = titulo('Mejores clientes', espacio(30));
    tabla({
      ...base, startY: y,
      head: [['Cliente', 'Facturas', 'Compras', 'Saldo pendiente', 'Última compra']],
      body: inf.top_clientes.map((t) => [t.cliente, String(t.facturas), cop(t.total), cop(t.saldo), fecha(t.ultima_compra)]),
      columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    });

    y = titulo('Recaudo por medio de pago', espacio(30));
    tabla({
      ...base, startY: y,
      head: [['Medio de pago', 'Pagos', 'Valor']],
      body: inf.metodos_pago.map((m) => [m.metodo, String(m.pagos), cop(m.valor)]),
      columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' } },
    });

    const paginas = doc.getNumberOfPages();
    for (let i = 1; i <= paginas; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(130);
      doc.text('Valores en pesos colombianos. Utilidad neta = ventas netas - costo de ventas - gastos operacionales.', M, H - 8);
      doc.text(`Página ${i} de ${paginas}`, W - M, H - 8, { align: 'right' });
    }
    doc.save(`Informe-SCENTRA-${inf.desde}-a-${inf.hasta}.pdf`);
  }

  private async cargarLogo(): Promise<string | undefined> {
    if (this.logo) return this.logo;
    try {
      const blob = await (await fetch('img/logo.png')).blob();
      this.logo = await new Promise<string>((ok, fail) => {
        const r = new FileReader();
        r.onload = () => ok(r.result as string);
        r.onerror = fail;
        r.readAsDataURL(blob);
      });
      return this.logo;
    } catch {
      return undefined;
    }
  }
}

function capital(t: string): string {
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

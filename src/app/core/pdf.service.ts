import { Injectable } from '@angular/core';
import { Configuracion, FacturaVenta } from './models';
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

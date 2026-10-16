import { Component, computed, input, signal } from '@angular/core';
import { cop } from '../core/utils';

export interface SerieGrafica {
  nombre: string;
  valores: number[];
  color: string;
}

/** Gráfica de barras (1 o 2 series) en SVG, sin librerías. Tooltip al pasar el dedo o el mouse. */
@Component({
  selector: 'app-grafica-barras',
  template: `
    @if (series().length > 1) {
      <div class="leyenda mb-2">
        @for (s of series(); track s.nombre) { <span><i [style.background]="s.color"></i>{{ s.nombre }}</span> }
      </div>
    }
    <div class="position-relative" (mouseleave)="activo.set(-1)">
      <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" width="100%" [attr.height]="alto()" preserveAspectRatio="none" role="img" [attr.aria-label]="titulo()">
        @for (t of g().ticks; track t.v) {
          <line [attr.x1]="IZQ" [attr.x2]="W" [attr.y1]="t.y" [attr.y2]="t.y" [attr.stroke]="t.v === 0 ? '#cfc3b2' : '#efe8dd'" stroke-width="1" vector-effect="non-scaling-stroke" />
        }
        @for (c of g().columnas; track $index) {
          @if (activo() === $index) {
            <rect [attr.x]="c.x" y="0" [attr.width]="c.ancho" [attr.height]="H - ABAJO" fill="rgba(184,147,90,.08)" />
          }
          @for (b of c.barras; track $index) {
            <path [attr.d]="b.d" [attr.fill]="b.color" />
          }
          <rect [attr.x]="c.x" y="0" [attr.width]="c.ancho" [attr.height]="H" fill="transparent"
                (mouseenter)="activo.set($index)" (touchstart)="activo.set($index)" (click)="activo.set($index)" />
        }
      </svg>
      <div class="d-flex small text-tenue" [style.padding-left.%]="(IZQ / W) * 100">
        @for (c of g().columnas; track $index) {
          <div class="text-center text-truncate" style="flex: 1 1 0; font-size: .72rem">{{ c.mostrarEtiqueta ? c.etiqueta : '' }}</div>
        }
      </div>
      @for (t of g().ticks; track t.v) {
        <div class="position-absolute small text-tenue" style="left: 0; font-size: .7rem; transform: translateY(-50%)" [style.top.px]="(t.y / H) * alto()">{{ t.texto }}</div>
      }
      @if (activo() >= 0 && g().columnas[activo()]; as c) {
        <div class="position-absolute card px-3 py-2 small" style="pointer-events: none; z-index: 5; min-width: 170px; top: 0"
             [style.left.%]="izquierdaTooltip(c.x, c.ancho)">
          <div class="fw-semibold mb-1">{{ c.etiquetaLarga }}</div>
          @for (s of series(); track s.nombre; let i = $index) {
            <div class="d-flex justify-content-between gap-3"><span><i class="d-inline-block rounded-1 me-1" style="width:8px;height:8px" [style.background]="s.color"></i>{{ s.nombre }}</span><strong class="cifra">{{ cop(s.valores[activo()]) }}</strong></div>
          }
        </div>
      }
    </div>
  `,
})
export class GraficaBarras {
  etiquetas = input.required<string[]>();
  /** Etiquetas del tooltip (si no, se usan las del eje). */
  etiquetasLargas = input<string[] | null>(null);
  series = input.required<SerieGrafica[]>();
  alto = input(220);
  titulo = input('Gráfica');

  readonly W = 720;
  readonly H = 220;
  readonly IZQ = 62;
  readonly ABAJO = 4;
  activo = signal(-1);
  cop = cop;

  g = computed(() => {
    const series = this.series();
    const n = this.etiquetas().length;
    const todos = series.flatMap((s) => s.valores.map(Number));
    let max = Math.max(0, ...todos);
    const min = Math.min(0, ...todos);
    if (max === 0 && min === 0) max = 1;
    const paso = this.pasoBonito((max - min) / 4);
    const tope = Math.ceil(max / paso) * paso;
    const piso = Math.floor(min / paso) * paso;
    const alto = this.H - this.ABAJO - 8;
    const y = (v: number) => 8 + ((tope - v) / (tope - piso)) * alto;

    const ticks: { v: number; y: number; texto: string }[] = [];
    for (let v = piso; v <= tope + 0.5; v += paso) ticks.push({ v, y: y(v), texto: compacto(v) });

    const ancho = (this.W - this.IZQ) / Math.max(n, 1);
    const cada = Math.ceil(n / 12);
    const largas = this.etiquetasLargas() ?? this.etiquetas();
    const columnas = this.etiquetas().map((etiqueta, i) => {
      const x = this.IZQ + i * ancho;
      const relleno = Math.min(ancho * 0.18, 14);
      const anchoBarra = (ancho - relleno * 2 - (series.length - 1) * 2) / series.length;
      const barras = series.map((s, k) => {
        const v = Number(s.valores[i] ?? 0);
        const bx = x + relleno + k * (anchoBarra + 2);
        return { color: s.color, d: barra(bx, y(0), Math.max(anchoBarra, 1), y(v) - y(0)) };
      });
      return { x, ancho, barras, etiqueta, etiquetaLarga: largas[i], mostrarEtiqueta: i % cada === 0 };
    });
    return { ticks, columnas };
  });

  izquierdaTooltip(x: number, ancho: number) {
    const centro = ((x + ancho / 2) / this.W) * 100;
    return Math.min(Math.max(centro - 14, 0), 62);
  }

  private pasoBonito(v: number) {
    if (v <= 0) return 1;
    const e = Math.pow(10, Math.floor(Math.log10(v)));
    const f = v / e;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e;
  }
}

/** Barra con esquinas redondeadas (4px) solo en el extremo de dato; la base queda recta sobre el eje. */
function barra(x: number, base: number, w: number, h: number): string {
  if (Math.abs(h) < 0.5) return '';
  const r = Math.min(4, w / 2, Math.abs(h));
  if (h < 0) {
    const top = base + h; // valor positivo: crece hacia arriba
    return `M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + w - r} Q${x + w},${top} ${x + w},${top + r} V${base} Z`;
  }
  const fondo = base + h; // valor negativo: crece hacia abajo
  return `M${x},${base} V${fondo - r} Q${x},${fondo} ${x + r},${fondo} H${x + w - r} Q${x + w},${fondo} ${x + w},${fondo - r} V${base} Z`;
}

export function compacto(v: number): string {
  const a = Math.abs(v);
  const s = v < 0 ? '-' : '';
  if (a >= 1e6) return `${s}$${(a / 1e6).toLocaleString('es-CO', { maximumFractionDigits: 1 })} M`;
  if (a >= 1e3) return `${s}$${Math.round(a / 1e3).toLocaleString('es-CO')} mil`;
  return `${s}$${a}`;
}

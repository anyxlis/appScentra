import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SupabaseService } from '../core/supabase.service';
import { ToastService } from '../core/toast.service';
import { PdfService } from '../core/pdf.service';
import { Configuracion, InformeMes, InformePeriodo } from '../core/models';
import { descargarCsv, fecha, hoyISO, MESES, primerDiaMes, sumarDias, ultimoDiaMes, variacion } from '../core/utils';
import { etiquetaTipo } from '../core/models';
import { CopPipe, FechaPipe, TipoPipe } from '../shared/pipes';
import { GraficaBarras, SerieGrafica } from '../shared/grafica-barras';

type Pestana = 'resultados' | 'mensual' | 'productos' | 'clientes' | 'inventario';
type Rango = 'mes' | 'mes_anterior' | 'trimestre' | 'anio' | 'personalizado';

const SERIE_1 = '#c08a2e';
const SERIE_2 = '#2c6fb8';

@Component({
  selector: 'app-informes',
  imports: [FormsModule, RouterLink, CopPipe, FechaPipe, TipoPipe, GraficaBarras],
  template: `
    <div class="page-head">
      <div>
        <h2>Informes</h2>
        <div class="sub">Resultados, flujo de caja, cartera e inventario de tu negocio.</div>
      </div>
      <div class="acciones no-print">
        <button class="btn btn-suave" (click)="imprimir()"><i class="bi bi-printer"></i><span class="d-none d-sm-inline">Imprimir</span></button>
        <button class="btn btn-primary" (click)="pdf()" [disabled]="!inf() || generando()">
          @if (generando()) { <span class="spinner-border spinner-border-sm"></span> } @else { <i class="bi bi-file-earmark-pdf"></i> }
          Descargar PDF
        </button>
      </div>
    </div>

    <ul class="nav nav-tabs mb-3 no-print">
      @for (t of pestanas; track t.id) {
        <li class="nav-item"><button class="nav-link" [class.active]="pestana() === t.id" (click)="pestana.set(t.id)"><i class="bi me-1" [class]="t.icono"></i>{{ t.texto }}</button></li>
      }
    </ul>

    @if (pestana() !== 'mensual' && pestana() !== 'inventario') {
      <div class="card p-3 mb-3 no-print">
        <div class="d-flex flex-wrap gap-2 align-items-end">
          <div class="chips flex-grow-1">
            @for (r of rangos; track r.id) {
              <button class="chip" [class.activo]="rango() === r.id" (click)="elegirRango(r.id)">{{ r.texto }}</button>
            }
          </div>
          @if (rango() === 'personalizado') {
            <div class="d-flex gap-2 align-items-end flex-wrap">
              <div><label class="form-label mb-1">Desde</label><input type="date" class="form-control form-control-sm" [(ngModel)]="desde" /></div>
              <div><label class="form-label mb-1">Hasta</label><input type="date" class="form-control form-control-sm" [(ngModel)]="hasta" /></div>
              <button class="btn btn-primary btn-sm" (click)="cargarPeriodo()">Ver</button>
            </div>
          }
        </div>
      </div>
    }

    @if (inf(); as i) {
      @let r = i.resultados;
      @let a = i.anterior;

      <!-- ======================= RESULTADOS ======================= -->
      @if (pestana() === 'resultados') {
        <p class="small text-tenue mb-3">Del {{ i.desde | fecha }} al {{ i.hasta | fecha }}, comparado con el {{ a.desde | fecha }} al {{ a.hasta | fecha }}.</p>

        <div class="row g-3 mb-3">
          @for (k of kpis(); track k.label) {
            <div class="col-6 col-xl-3">
              <div class="card kpi p-3" [class.exito]="k.tono === 'exito'" [class.peligro]="k.tono === 'peligro'">
                <span class="kpi-icono"><i class="bi" [class]="k.icono"></i></span>
                <div class="kpi-label">{{ k.label }}</div>
                <div class="kpi-valor">{{ k.valor | cop }}</div>
                <div class="d-flex flex-wrap align-items-center gap-2 mt-1">
                  @if (k.delta !== null) {
                    <span class="delta" [class.sube]="k.delta >= 0" [class.baja]="k.delta < 0">
                      <i class="bi" [class.bi-arrow-up-right]="k.delta >= 0" [class.bi-arrow-down-right]="k.delta < 0"></i> {{ k.delta }}%
                    </span>
                  }
                  <span class="kpi-nota">{{ k.nota }}</span>
                </div>
              </div>
            </div>
          }
        </div>

        @if (r.unidades_sin_costo > 0) {
          <div class="alert alert-warning d-flex gap-2 align-items-start small">
            <i class="bi bi-exclamation-triangle mt-1"></i>
            <div>Hay <strong>{{ r.unidades_sin_costo }} unidad(es)</strong> vendidas por encargo que aún no tienen costo. La utilidad se verá más alta hasta que registres su
              <a routerLink="/admin/compras/nueva">factura de compra</a>.</div>
          </div>
        }

        <div class="row g-3">
          <div class="col-lg-7">
            <div class="card h-100">
              <div class="card-header d-flex justify-content-between align-items-center">
                <strong>Estado de resultados</strong>
                <button class="btn btn-sm btn-suave no-print" (click)="csvResultados(i)"><i class="bi bi-filetype-csv"></i> Excel</button>
              </div>
              <div class="table-responsive">
                <table class="table estado-resultados">
                  <thead><tr><th>Concepto</th><th class="text-end">Período</th><th class="text-end">% ventas</th><th class="text-end d-none d-md-table-cell">Anterior</th></tr></thead>
                  <tbody>
                    <tr><td>Ventas brutas</td><td class="text-end">{{ r.ventas_brutas | cop }}</td><td></td><td class="text-end d-none d-md-table-cell">{{ a.ventas_brutas | cop }}</td></tr>
                    <tr class="nivel-2"><td>Menos descuentos</td><td class="text-end">−{{ r.descuentos | cop }}</td><td></td><td class="text-end d-none d-md-table-cell">−{{ a.descuentos | cop }}</td></tr>
                    <tr class="nivel-1"><td>Ventas netas</td><td class="text-end">{{ r.ventas_netas | cop }}</td><td class="text-end pct">100%</td><td class="text-end d-none d-md-table-cell">{{ a.ventas_netas | cop }}</td></tr>
                    <tr class="nivel-2"><td>Menos costo de ventas</td><td class="text-end">−{{ r.costo_ventas | cop }}</td><td class="text-end pct">{{ pctVentas(r.costo_ventas) }}</td><td class="text-end d-none d-md-table-cell">−{{ a.costo_ventas | cop }}</td></tr>
                    <tr class="nivel-1"><td>Utilidad bruta</td><td class="text-end">{{ r.utilidad_bruta | cop }}</td><td class="text-end pct">{{ r.margen_bruto }}%</td><td class="text-end d-none d-md-table-cell">{{ a.utilidad_bruta | cop }}</td></tr>
                    @for (g of i.gastos_categoria; track g.categoria) {
                      <tr class="nivel-2"><td class="text-capitalize">{{ g.categoria }}</td><td class="text-end">−{{ g.valor | cop }}</td><td class="text-end pct">{{ pctVentas(g.valor) }}</td><td class="d-none d-md-table-cell"></td></tr>
                    }
                    <tr class="nivel-1"><td>Total gastos operacionales</td><td class="text-end">−{{ r.gastos | cop }}</td><td class="text-end pct">{{ pctVentas(r.gastos) }}</td><td class="text-end d-none d-md-table-cell">−{{ a.gastos | cop }}</td></tr>
                    <tr class="resultado"><td>Utilidad neta</td>
                      <td class="text-end" [class.text-danger]="r.utilidad_neta < 0" [class.text-success]="r.utilidad_neta > 0">{{ r.utilidad_neta | cop }}</td>
                      <td class="text-end pct">{{ r.margen_neto }}%</td><td class="text-end d-none d-md-table-cell">{{ a.utilidad_neta | cop }}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div class="col-lg-5 d-flex flex-column gap-3">
            <div class="card">
              <div class="card-header"><strong>Flujo de caja</strong><div class="small text-tenue">Dinero que realmente entró y salió</div></div>
              <ul class="list-group list-group-flush">
                <li class="list-group-item d-flex justify-content-between"><span><i class="bi bi-arrow-down-left text-success me-2"></i>Recaudo de clientes</span><strong class="cifra">{{ i.flujo.recaudo | cop }}</strong></li>
                <li class="list-group-item d-flex justify-content-between"><span><i class="bi bi-arrow-up-right text-danger me-2"></i>Compras pagadas</span><span class="cifra">−{{ i.flujo.compras_pagadas | cop }}</span></li>
                <li class="list-group-item d-flex justify-content-between"><span><i class="bi bi-arrow-up-right text-danger me-2"></i>Gastos</span><span class="cifra">−{{ i.flujo.gastos | cop }}</span></li>
                <li class="list-group-item d-flex justify-content-between fw-semibold" style="background:#fbf8f3"><span>Flujo neto</span>
                  <span class="cifra" [class.text-danger]="i.flujo.flujo_neto < 0" [class.text-success]="i.flujo.flujo_neto > 0">{{ i.flujo.flujo_neto | cop }}</span></li>
              </ul>
              @if (i.flujo.compras_credito > 0) {
                <div class="card-footer small text-tenue">Compras a crédito de este período aún por pagar: <strong>{{ i.flujo.compras_credito | cop }}</strong></div>
              }
            </div>

            <div class="card">
              <div class="card-header"><strong>Indicadores</strong></div>
              <div class="row g-0 text-center">
                <div class="col-4 p-3 border-end border-bottom"><div class="fs-5 fw-semibold cifra">{{ r.facturas }}</div><div class="small text-tenue">Facturas</div></div>
                <div class="col-4 p-3 border-end border-bottom"><div class="fs-5 fw-semibold cifra">{{ r.unidades }}</div><div class="small text-tenue">Unidades</div></div>
                <div class="col-4 p-3 border-bottom"><div class="fs-5 fw-semibold cifra">{{ r.clientes }}</div><div class="small text-tenue">Clientes</div></div>
                <div class="col-6 p-3 border-end"><div class="fw-semibold cifra">{{ r.ticket_promedio | cop }}</div><div class="small text-tenue">Ticket promedio</div></div>
                <div class="col-6 p-3"><div class="fw-semibold cifra">{{ pctVentas(r.ventas_financiado) }}</div><div class="small text-tenue">Ventas financiadas</div></div>
              </div>
              @if (r.anuladas > 0) {
                <div class="card-footer small text-tenue">{{ r.anuladas }} factura(s) anulada(s) por {{ r.valor_anuladas | cop }} (no suman en las ventas).</div>
              }
            </div>
          </div>

          @if (diarias().etiquetas.length) {
            <div class="col-12">
              <div class="card">
                <div class="card-header"><strong>Ventas y recaudo por día</strong></div>
                <div class="card-body">
                  <app-grafica-barras titulo="Ventas y recaudo por día" [etiquetas]="diarias().etiquetas" [etiquetasLargas]="diarias().largas" [series]="diarias().series" />
                </div>
              </div>
            </div>
          }
        </div>
      }

      <!-- ======================= PRODUCTOS ======================= -->
      @if (pestana() === 'productos') {
        <div class="row g-3 mb-3">
          @for (t of i.por_tipo; track t.tipo) {
            <div class="col-md-4">
              <div class="card kpi p-3">
                <div class="kpi-label">{{ t.tipo | tipo }} · {{ t.unidades }} unid.</div>
                <div class="kpi-valor">{{ t.ventas | cop }}</div>
                <div class="barra-h my-2"><span [style.width.%]="r.ventas_brutas ? (t.ventas / r.ventas_brutas) * 100 : 0"></span></div>
                <div class="kpi-nota">Utilidad {{ t.utilidad | cop }} · margen {{ t.ventas ? ((t.utilidad / t.ventas) * 100).toFixed(1) : 0 }}%</div>
              </div>
            </div>
          } @empty {
            <div class="col-12 text-tenue">Sin ventas en este período.</div>
          }
        </div>

        <div class="card">
          <div class="card-header d-flex justify-content-between align-items-center">
            <strong>Productos vendidos</strong>
            <button class="btn btn-sm btn-suave no-print" (click)="csvProductos(i)"><i class="bi bi-filetype-csv"></i> Excel</button>
          </div>
          <div class="table-responsive">
            <table class="table table-hover">
              <thead><tr><th>Producto</th><th>Tipo</th><th class="text-center">Ml</th><th class="text-center">Unid.</th><th class="text-end">Ventas</th><th class="text-end">Costo</th><th class="text-end">Utilidad</th><th class="text-end">Margen</th><th style="min-width: 110px">Participación</th></tr></thead>
              <tbody>
                @for (p of i.productos; track $index) {
                  <tr>
                    <td class="fw-medium">{{ p.producto }} @if (p.unidades_sin_costo) { <i class="bi bi-exclamation-circle text-warning" title="Unidades sin costo asignado"></i> }</td>
                    <td>{{ p.tipo | tipo }}</td><td class="text-center">{{ p.mililitros }}</td><td class="text-center">{{ p.unidades }}</td>
                    <td class="text-end">{{ p.ventas | cop }}</td><td class="text-end">{{ p.costo | cop }}</td>
                    <td class="text-end fw-semibold">{{ p.utilidad | cop }}</td>
                    <td class="text-end">{{ p.ventas ? ((p.utilidad / p.ventas) * 100).toFixed(1) : 0 }}%</td>
                    <td><div class="d-flex align-items-center gap-2"><div class="barra-h flex-grow-1"><span [style.width.%]="r.ventas_brutas ? (p.ventas / r.ventas_brutas) * 100 : 0"></span></div><small class="text-tenue">{{ r.ventas_brutas ? ((p.ventas / r.ventas_brutas) * 100).toFixed(0) : 0 }}%</small></div></td>
                  </tr>
                } @empty { <tr><td colspan="9" class="text-center text-tenue py-4">Sin ventas en este período.</td></tr> }
              </tbody>
            </table>
          </div>
        </div>
      }

      <!-- ======================= CLIENTES Y CARTERA ======================= -->
      @if (pestana() === 'clientes') {
        @let c = i.cartera_edades;
        <div class="card mb-3">
          <div class="card-header d-flex flex-wrap justify-content-between gap-2">
            <div><strong>Cartera por edades</strong><div class="small text-tenue">Lo que te deben hoy, según los días de atraso</div></div>
            <div class="text-md-end"><div class="fs-5 fw-semibold cifra">{{ c.total | cop }}</div><div class="small text-tenue">{{ c.clientes }} cliente(s)</div></div>
          </div>
          <div class="card-body">
            <div class="d-flex rounded-pill overflow-hidden mb-3" style="height: 14px; gap: 2px; background: #f0e9df">
              @for (e of edades(); track e.texto) {
                @if (e.valor > 0) { <div [style.flex]="e.valor" [style.background]="e.color" [title]="e.texto + ': ' + e.valor"></div> }
              }
            </div>
            <div class="row g-2">
              @for (e of edades(); track e.texto) {
                <div class="col-6 col-md">
                  <div class="d-flex align-items-center gap-2 small text-tenue"><i class="d-inline-block rounded-1" style="width:10px;height:10px" [style.background]="e.color"></i>{{ e.texto }}</div>
                  <div class="fw-semibold cifra">{{ e.valor | cop }}</div>
                  <div class="small text-tenue">{{ c.total ? ((e.valor / c.total) * 100).toFixed(0) : 0 }}%</div>
                </div>
              }
            </div>
          </div>
          <div class="card-footer small"><a routerLink="/admin/cartera">Ir a cobrar <i class="bi bi-arrow-right-short"></i></a></div>
        </div>

        <div class="row g-3">
          <div class="col-lg-7">
            <div class="card h-100">
              <div class="card-header d-flex justify-content-between align-items-center">
                <strong>Mejores clientes del período</strong>
                <button class="btn btn-sm btn-suave no-print" (click)="csvClientes(i)"><i class="bi bi-filetype-csv"></i> Excel</button>
              </div>
              <div class="table-responsive">
                <table class="table table-hover">
                  <thead><tr><th>Cliente</th><th class="text-center">Facturas</th><th class="text-end">Compras</th><th class="text-end">Debe</th><th>Última</th></tr></thead>
                  <tbody>
                    @for (t of i.top_clientes; track t.cliente_id) {
                      <tr><td class="fw-medium">{{ t.cliente }}</td><td class="text-center">{{ t.facturas }}</td><td class="text-end">{{ t.total | cop }}</td>
                        <td class="text-end" [class.text-danger]="t.saldo > 0">{{ t.saldo | cop }}</td><td>{{ t.ultima_compra | fecha }}</td></tr>
                    } @empty { <tr><td colspan="5" class="text-center text-tenue py-4">Sin ventas en este período.</td></tr> }
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div class="col-lg-5">
            <div class="card h-100">
              <div class="card-header"><strong>Recaudo por medio de pago</strong></div>
              <div class="card-body d-grid gap-3">
                @for (m of i.metodos_pago; track m.metodo) {
                  <div>
                    <div class="d-flex justify-content-between small mb-1"><span>{{ m.metodo }} <span class="text-tenue">· {{ m.pagos }} pago(s)</span></span><strong class="cifra">{{ m.valor | cop }}</strong></div>
                    <div class="barra-h"><span [style.width.%]="i.flujo.recaudo ? (m.valor / i.flujo.recaudo) * 100 : 0"></span></div>
                  </div>
                } @empty { <div class="text-tenue small">No hubo pagos en este período.</div> }
              </div>
            </div>
          </div>
        </div>
      }

      <!-- ======================= INVENTARIO ======================= -->
      @if (pestana() === 'inventario') {
        @let iv = i.inventario;
        <div class="row g-3 mb-3">
          <div class="col-6 col-xl-3"><div class="card kpi p-3"><span class="kpi-icono"><i class="bi bi-box-seam"></i></span><div class="kpi-label">Inventario a costo</div><div class="kpi-valor">{{ iv.valor_costo | cop }}</div><div class="kpi-nota">{{ iv.unidades }} unidades en bodega</div></div></div>
          <div class="col-6 col-xl-3"><div class="card kpi exito p-3"><span class="kpi-icono"><i class="bi bi-tag"></i></span><div class="kpi-label">A precio de venta</div><div class="kpi-valor">{{ iv.valor_venta | cop }}</div><div class="kpi-nota">Ganancia posible {{ iv.valor_venta - iv.valor_costo | cop }}</div></div></div>
          <div class="col-6 col-xl-3"><a routerLink="/admin/inventario" class="text-decoration-none"><div class="card kpi peligro p-3"><span class="kpi-icono"><i class="bi bi-cart-plus"></i></span><div class="kpi-label">Por pedir (encargos)</div><div class="kpi-valor">{{ iv.por_pedir }} unid.</div><div class="kpi-nota">Costo estimado {{ iv.costo_por_pedir | cop }}</div></div></a></div>
          <div class="col-6 col-xl-3"><div class="card kpi alerta p-3"><span class="kpi-icono"><i class="bi bi-truck"></i></span><div class="kpi-label">Debo a proveedores</div><div class="kpi-valor">{{ i.cuentas_por_pagar | cop }}</div><div class="kpi-nota">Compras a crédito sin pagar</div></div></div>
        </div>
        <div class="card">
          <ul class="list-group list-group-flush">
            <li class="list-group-item d-flex justify-content-between"><span>Referencias activas (producto + ml)</span><strong>{{ iv.referencias }}</strong></li>
            <li class="list-group-item d-flex justify-content-between"><span>Referencias agotadas (stock 0)</span><strong>{{ iv.agotadas }}</strong></li>
            <li class="list-group-item d-flex justify-content-between"><span>Referencias sin costo registrado</span><strong [class.text-warning]="iv.sin_costo > 0">{{ iv.sin_costo }}</strong></li>
          </ul>
          <div class="card-footer small text-tenue">El inventario se valoriza al costo promedio ponderado de cada presentación. Las unidades por pedir no restan del valor.</div>
        </div>
      }
    } @else if (pestana() !== 'mensual') {
      <div class="text-center py-5"><div class="spinner-border text-secondary"></div></div>
    }

    <!-- ======================= MES A MES ======================= -->
    @if (pestana() === 'mensual') {
      <div class="d-flex flex-wrap gap-2 align-items-center mb-3 no-print">
        <label class="form-label mb-0">Año</label>
        <select class="form-select" style="width: 120px" [(ngModel)]="anio" (change)="cargarAnio()">
          @for (a of anios; track a) { <option [ngValue]="a">{{ a }}</option> }
        </select>
      </div>

      <div class="row g-3 mb-3">
        <div class="col-6 col-lg-3"><div class="card kpi p-3"><div class="kpi-label">Ventas {{ anio }}</div><div class="kpi-valor">{{ tot().ventas | cop }}</div></div></div>
        <div class="col-6 col-lg-3"><div class="card kpi p-3"><div class="kpi-label">Costo de ventas</div><div class="kpi-valor">{{ tot().costo_ventas | cop }}</div></div></div>
        <div class="col-6 col-lg-3"><div class="card kpi p-3"><div class="kpi-label">Gastos</div><div class="kpi-valor">{{ tot().gastos | cop }}</div></div></div>
        <div class="col-6 col-lg-3"><div class="card kpi exito p-3"><div class="kpi-label">Utilidad neta</div><div class="kpi-valor">{{ tot().utilidad_neta | cop }}</div>
          <div class="kpi-nota">Margen {{ tot().ventas ? ((tot().utilidad_neta / tot().ventas) * 100).toFixed(1) : 0 }}%</div></div></div>
      </div>

      <div class="card mb-3">
        <div class="card-header"><strong>Ventas y utilidad neta por mes</strong></div>
        <div class="card-body"><app-grafica-barras titulo="Ventas y utilidad neta por mes" [etiquetas]="mesesCortos" [etiquetasLargas]="mesesLargos" [series]="seriesAnio()" /></div>
      </div>

      <div class="card">
        <div class="card-header d-flex justify-content-between align-items-center">
          <strong>Detalle mensual</strong>
          <button class="btn btn-sm btn-suave no-print" (click)="csvMensual()"><i class="bi bi-filetype-csv"></i> Excel</button>
        </div>
        <div class="table-responsive">
          <table class="table table-sm table-hover">
            <thead>
              <tr><th>Mes</th><th class="text-end">Ventas</th><th class="text-end">Contado</th><th class="text-end">Financiado</th><th class="text-end">Costo</th>
                <th class="text-end">Utilidad bruta</th><th class="text-end">Gastos</th><th class="text-end">Utilidad neta</th><th class="text-end">Margen</th><th class="text-end">Recaudado</th><th class="text-end">Compras</th></tr>
            </thead>
            <tbody>
              @for (m of meses(); track m.mes) {
                <tr [class.text-tenue]="!m.ventas && !m.gastos && !m.compras">
                  <td>{{ nombreMes(m.mes) }}</td>
                  <td class="text-end fw-semibold">{{ m.ventas | cop }}</td><td class="text-end">{{ m.ventas_contado | cop }}</td><td class="text-end">{{ m.ventas_financiado | cop }}</td>
                  <td class="text-end">{{ m.costo_ventas | cop }}</td><td class="text-end">{{ m.utilidad_bruta | cop }}</td><td class="text-end">{{ m.gastos | cop }}</td>
                  <td class="text-end fw-semibold" [class.text-danger]="m.utilidad_neta < 0" [class.text-success]="m.utilidad_neta > 0">{{ m.utilidad_neta | cop }}</td>
                  <td class="text-end">{{ m.ventas ? ((m.utilidad_neta / m.ventas) * 100).toFixed(1) + '%' : '—' }}</td>
                  <td class="text-end">{{ m.recaudo | cop }}</td><td class="text-end">{{ m.compras | cop }}</td>
                </tr>
              }
            </tbody>
            <tfoot class="fw-semibold">
              <tr><td>Total</td><td class="text-end">{{ tot().ventas | cop }}</td><td class="text-end">{{ tot().ventas_contado | cop }}</td><td class="text-end">{{ tot().ventas_financiado | cop }}</td>
                <td class="text-end">{{ tot().costo_ventas | cop }}</td><td class="text-end">{{ tot().utilidad_bruta | cop }}</td><td class="text-end">{{ tot().gastos | cop }}</td>
                <td class="text-end">{{ tot().utilidad_neta | cop }}</td><td class="text-end">{{ tot().ventas ? ((tot().utilidad_neta / tot().ventas) * 100).toFixed(1) + '%' : '—' }}</td>
                <td class="text-end">{{ tot().recaudo | cop }}</td><td class="text-end">{{ tot().compras | cop }}</td></tr>
            </tfoot>
          </table>
        </div>
        <div class="card-footer small text-tenue">Utilidad bruta = ventas − costo de lo vendido. Utilidad neta = bruta − gastos. Recaudado = dinero recibido (contado + abonos) en el mes.</div>
      </div>
    }
  `,
})
export class Informes implements OnInit {
  private sb = inject(SupabaseService);
  private toast = inject(ToastService);
  private pdfs = inject(PdfService);

  pestanas: { id: Pestana; texto: string; icono: string }[] = [
    { id: 'resultados', texto: 'Resultados', icono: 'bi-clipboard-data' },
    { id: 'mensual', texto: 'Mes a mes', icono: 'bi-bar-chart' },
    { id: 'productos', texto: 'Productos', icono: 'bi-droplet-half' },
    { id: 'clientes', texto: 'Clientes y cartera', icono: 'bi-people' },
    { id: 'inventario', texto: 'Inventario', icono: 'bi-box-seam' },
  ];
  rangos: { id: Rango; texto: string }[] = [
    { id: 'mes', texto: 'Este mes' },
    { id: 'mes_anterior', texto: 'Mes anterior' },
    { id: 'trimestre', texto: 'Últimos 90 días' },
    { id: 'anio', texto: 'Este año' },
    { id: 'personalizado', texto: 'Personalizado' },
  ];
  pestana = signal<Pestana>('resultados');
  rango = signal<Rango>('mes');
  desde = primerDiaMes();
  hasta = hoyISO();
  inf = signal<InformePeriodo | null>(null);
  generando = signal(false);
  private cfg: Configuracion | null = null;

  anio = new Date().getFullYear();
  anios = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
  meses = signal<InformeMes[]>([]);
  mesesCortos = MESES.map((m) => m.slice(0, 3));
  mesesLargos = MESES;

  kpis = computed(() => {
    const i = this.inf();
    if (!i) return [];
    const r = i.resultados, a = i.anterior;
    return [
      { label: 'Ventas netas', valor: r.ventas_netas, delta: variacion(r.ventas_netas, a.ventas_netas), nota: `${r.facturas} facturas`, icono: 'bi-receipt', tono: '' },
      { label: 'Utilidad bruta', valor: r.utilidad_bruta, delta: variacion(r.utilidad_bruta, a.utilidad_bruta), nota: `Margen ${r.margen_bruto}%`, icono: 'bi-graph-up', tono: '' },
      { label: 'Utilidad neta', valor: r.utilidad_neta, delta: variacion(r.utilidad_neta, a.utilidad_neta), nota: `Margen ${r.margen_neto}%`, icono: 'bi-piggy-bank', tono: r.utilidad_neta < 0 ? 'peligro' : 'exito' },
      { label: 'Recaudado', valor: i.flujo.recaudo, delta: null, nota: 'Dinero recibido', icono: 'bi-cash-stack', tono: '' },
    ];
  });

  diarias = computed(() => {
    const d = this.inf()?.ventas_diarias ?? [];
    const series: SerieGrafica[] = [
      { nombre: 'Ventas', valores: d.map((x) => Number(x.ventas)), color: SERIE_1 },
      { nombre: 'Recaudo', valores: d.map((x) => Number(x.recaudo)), color: SERIE_2 },
    ];
    return { etiquetas: d.map((x) => x.fecha.slice(8, 10)), largas: d.map((x) => fecha(x.fecha)), series };
  });

  edades = computed(() => {
    const c = this.inf()?.cartera_edades;
    if (!c) return [];
    return [
      { texto: 'Por vencer', valor: Number(c.por_vencer), color: '#2c6fb8' },
      { texto: '1 a 30 días', valor: Number(c.d1_30), color: '#d9a441' },
      { texto: '31 a 60 días', valor: Number(c.d31_60), color: '#c97a2b' },
      { texto: '61 a 90 días', valor: Number(c.d61_90), color: '#b5532a' },
      { texto: 'Más de 90 días', valor: Number(c.d90_mas), color: '#8a2a20' },
    ];
  });

  seriesAnio = computed<SerieGrafica[]>(() => [
    { nombre: 'Ventas', valores: this.meses().map((m) => Number(m.ventas)), color: SERIE_1 },
    { nombre: 'Utilidad neta', valores: this.meses().map((m) => Number(m.utilidad_neta)), color: SERIE_2 },
  ]);

  tot = computed(() => {
    const campos = ['ventas', 'ventas_contado', 'ventas_financiado', 'costo_ventas', 'utilidad_bruta', 'gastos', 'utilidad_neta', 'recaudo', 'compras'] as const;
    const r = {} as Record<(typeof campos)[number], number>;
    for (const c of campos) r[c] = this.meses().reduce((a, m) => a + Number(m[c]), 0);
    return r;
  });

  ngOnInit() {
    this.cargarPeriodo();
    this.cargarAnio();
    this.sb.rpc<Configuracion>('sel_configuracion').then((c) => (this.cfg = c)).catch(() => undefined);
  }

  elegirRango(r: Rango) {
    this.rango.set(r);
    const hoy = hoyISO();
    if (r === 'mes') { this.desde = primerDiaMes(); this.hasta = hoy; }
    if (r === 'mes_anterior') { const ini = sumarDias(primerDiaMes(), -1).slice(0, 8) + '01'; this.desde = ini; this.hasta = ultimoDiaMes(ini); }
    if (r === 'trimestre') { this.desde = sumarDias(hoy, -89); this.hasta = hoy; }
    if (r === 'anio') { this.desde = hoy.slice(0, 4) + '-01-01'; this.hasta = hoy; }
    if (r !== 'personalizado') this.cargarPeriodo();
  }

  async cargarPeriodo() {
    try {
      this.inf.set(await this.sb.rpc<InformePeriodo>('sel_informe_periodo', { p_desde: this.desde || null, p_hasta: this.hasta || null }));
    } catch (e) {
      this.toast.error(e);
    }
  }

  async cargarAnio() {
    try {
      this.meses.set(await this.sb.rpc('sel_informe_mensual', { p_anio: this.anio }));
    } catch (e) {
      this.toast.error(e);
    }
  }

  nombreMes(n: number) {
    return MESES[n - 1];
  }

  pctVentas(v: number): string {
    const n = Number(this.inf()?.resultados.ventas_netas ?? 0);
    return n ? `${((Number(v) / n) * 100).toFixed(1)}%` : '—';
  }

  async pdf() {
    const i = this.inf();
    if (!i) return;
    this.generando.set(true);
    try {
      await this.pdfs.informePeriodo(i, this.cfg);
    } catch (e) {
      this.toast.error(e);
    } finally {
      this.generando.set(false);
    }
  }

  imprimir() {
    window.print();
  }

  csvResultados(i: InformePeriodo) {
    const r = i.resultados, a = i.anterior;
    descargarCsv(`estado-resultados-${i.desde}-${i.hasta}`, ['Concepto', 'Período', 'Anterior'], [
      ['Ventas brutas', r.ventas_brutas, a.ventas_brutas],
      ['Descuentos', -r.descuentos, -a.descuentos],
      ['Ventas netas', r.ventas_netas, a.ventas_netas],
      ['Costo de ventas', -r.costo_ventas, -a.costo_ventas],
      ['Utilidad bruta', r.utilidad_bruta, a.utilidad_bruta],
      ...i.gastos_categoria.map((g) => [`Gasto: ${g.categoria}`, -g.valor, '']),
      ['Gastos operacionales', -r.gastos, -a.gastos],
      ['Utilidad neta', r.utilidad_neta, a.utilidad_neta],
      ['Margen bruto %', r.margen_bruto, a.margen_bruto],
      ['Margen neto %', r.margen_neto, a.margen_neto],
      ['Recaudo', i.flujo.recaudo, ''],
      ['Compras pagadas', -i.flujo.compras_pagadas, ''],
      ['Flujo neto', i.flujo.flujo_neto, ''],
    ]);
  }

  csvProductos(i: InformePeriodo) {
    descargarCsv(`productos-${i.desde}-${i.hasta}`, ['Producto', 'Tipo', 'Ml', 'Unidades', 'Ventas', 'Costo', 'Utilidad'],
      i.productos.map((p) => [p.producto, etiquetaTipo(p.tipo), p.mililitros, p.unidades, p.ventas, p.costo, p.utilidad]));
  }

  csvClientes(i: InformePeriodo) {
    descargarCsv(`clientes-${i.desde}-${i.hasta}`, ['Cliente', 'Facturas', 'Compras', 'Saldo', 'Última compra'],
      i.top_clientes.map((t) => [t.cliente, t.facturas, t.total, t.saldo, t.ultima_compra]));
  }

  csvMensual() {
    descargarCsv(`informe-mensual-${this.anio}`, ['Mes', 'Ventas', 'Contado', 'Financiado', 'Costo', 'Utilidad bruta', 'Gastos', 'Utilidad neta', 'Recaudado', 'Compras'],
      this.meses().map((m) => [MESES[m.mes - 1], m.ventas, m.ventas_contado, m.ventas_financiado, m.costo_ventas, m.utilidad_bruta, m.gastos, m.utilidad_neta, m.recaudo, m.compras]));
  }
}

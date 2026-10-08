import { Routes } from '@angular/router';
import { adminGuard } from './core/auth.guard';
import { TiendaLayout } from './tienda/tienda-layout';

export const routes: Routes = [
  {
    path: '',
    component: TiendaLayout,
    children: [
      { path: '', loadComponent: () => import('./tienda/inicio').then((m) => m.Inicio), title: 'SCENTRA · Fragancias' },
      { path: 'catalogo', loadComponent: () => import('./tienda/catalogo').then((m) => m.Catalogo), title: 'Catálogo · SCENTRA' },
      { path: 'carrito', loadComponent: () => import('./tienda/carrito').then((m) => m.Carrito), title: 'Tu pedido · SCENTRA' },
    ],
  },
  { path: 'admin/login', loadComponent: () => import('./admin/login').then((m) => m.Login), title: 'Ingresar · SCENTRA' },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () => import('./admin/admin-layout').then((m) => m.AdminLayout),
    children: [
      { path: '', loadComponent: () => import('./admin/dashboard').then((m) => m.Dashboard), title: 'Panel · SCENTRA' },
      { path: 'productos', loadComponent: () => import('./admin/productos').then((m) => m.Productos), title: 'Productos' },
      { path: 'inventario', loadComponent: () => import('./admin/inventario').then((m) => m.Inventario), title: 'Inventario' },
      { path: 'clientes', loadComponent: () => import('./admin/clientes').then((m) => m.Clientes), title: 'Clientes' },
      { path: 'proveedores', loadComponent: () => import('./admin/proveedores').then((m) => m.Proveedores), title: 'Proveedores' },
      { path: 'ventas', loadComponent: () => import('./admin/ventas').then((m) => m.Ventas), title: 'Facturas de venta' },
      { path: 'ventas/nueva', loadComponent: () => import('./admin/venta-nueva').then((m) => m.VentaNueva), title: 'Nueva venta' },
      { path: 'ventas/:id', loadComponent: () => import('./admin/venta-detalle').then((m) => m.VentaDetalle), title: 'Factura' },
      { path: 'compras', loadComponent: () => import('./admin/compras').then((m) => m.Compras), title: 'Facturas de compra' },
      { path: 'compras/nueva', loadComponent: () => import('./admin/compra-nueva').then((m) => m.CompraNueva), title: 'Nueva compra' },
      { path: 'cartera', loadComponent: () => import('./admin/cartera').then((m) => m.Cartera), title: 'Cartera y cobros' },
      { path: 'gastos', loadComponent: () => import('./admin/gastos').then((m) => m.Gastos), title: 'Gastos' },
      { path: 'informes', loadComponent: () => import('./admin/informes').then((m) => m.Informes), title: 'Informes' },
      { path: 'configuracion', loadComponent: () => import('./admin/configuracion').then((m) => m.Configuracion), title: 'Configuración' },
    ],
  },
  { path: '**', redirectTo: '' },
];

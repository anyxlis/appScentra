import { Pipe, PipeTransform } from '@angular/core';
import { cop, fecha } from '../core/utils';
import { etiquetaTipo } from '../core/models';

@Pipe({ name: 'cop' })
export class CopPipe implements PipeTransform {
  transform(v: number | string | null | undefined): string {
    return cop(v);
  }
}

@Pipe({ name: 'fecha' })
export class FechaPipe implements PipeTransform {
  transform(v: string | null | undefined): string {
    return fecha(v);
  }
}

@Pipe({ name: 'tipo' })
export class TipoPipe implements PipeTransform {
  transform(v: string): string {
    return etiquetaTipo(v);
  }
}

const ESTADOS: Record<string, string> = { pagada: 'Pagada', al_dia: 'Al día', en_mora: 'En mora', anulada: 'Anulada', pendiente: 'Pendiente' };

@Pipe({ name: 'estado' })
export class EstadoPipe implements PipeTransform {
  transform(v: string | null | undefined): string {
    return ESTADOS[v ?? ''] ?? v ?? '';
  }
}

import { Pipe, PipeTransform } from '@angular/core';

/** Un montant en francs CFA comme on l'écrit : `6 500 F` (espace fine insécable entre les milliers). */
@Pipe({ name: 'xaf' })
export class XafPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    if (value === null || value === undefined) return '—';
    return `${Math.round(value).toLocaleString('fr-FR').replace(/\s/g, ' ')} F`;
  }
}

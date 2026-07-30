import { Pipe, PipeTransform } from '@angular/core';

/**
 * Rend affichable dans un `<img [src]>` une valeur de logo qui peut être :
 *  - une URL hébergée (MinIO) — cas nominal après upload backend,
 *  - un data-URI déjà encodé,
 *  - du **markup SVG inline** — cas des concepts streamés (SSE) et des données
 *    persistées avant externalisation.
 *
 * Un `<img>` ne sait pas afficher du markup brut : sans conversion en data-URI,
 * l'image reste vide (cards de logos sans visuel). La conversion est faite ici
 * plutôt que dans chaque template pour que tous les points d'affichage du logo
 * se comportent de la même façon.
 */
@Pipe({
  name: 'logoSrc',
})
export class LogoSrcPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    const raw = (value ?? '').trim();
    if (!raw) return '';
    if (!raw.startsWith('<')) return raw; // URL, chemin d'asset ou data-URI
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(raw)}`;
  }
}

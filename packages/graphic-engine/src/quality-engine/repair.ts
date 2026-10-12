/**
 * La RÉPARATION, d'abord par le code.
 *
 * Leçon tirée du moteur précédent : un contrôle qui REFUSE une page la renvoie au rendu du cran inférieur,
 * et le cran payé le plus cher finit par rendre exactement ce que rend le cran Medium. Ici, un défaut à
 * réponse déterministe se CORRIGE, dans cet ordre :
 *   1. l'ajustement au pixel dans le navigateur (titres et chiffres qui cèdent de la taille) ;
 *   2. la simplification des décors (un décor d'encre posé sur un texte s'efface seul ; puis l'accent et la
 *      tension cèdent la place au contenu) ;
 *   3. la mise à l'échelle bornée du corps de la page ;
 *   4. la composition suivante du classement.
 * On mesure, on corrige, on remesure ; on garde la MEILLEURE tentative, pas la dernière. Un modèle
 * n'intervient (réparation ciblée, crans High+) que si le code n'a pas su.
 *
 * Deux catégories de constats, jamais une :
 *  · `blocking` — la page est fausse : contenu hors page ou hors de son aplat, blocs superposés ;
 *  · `advisory` — perfectible : contraste limite, page un peu creuse, police non chargée.
 */
import type { Issue } from '../contracts/common';
import type { Measurement } from './measure';

/** En dessous de cette échelle, un texte cesse d'être lisible : on change de composition plutôt. */
export const FIT_FLOOR = 0.74;

export type RepairAction = { kind: 'accept' } | { kind: 'zoom'; scale: number } | { kind: 'next'; reason: string };

export function decide(m: Measurement, currentScale: number, fixed: boolean): RepairAction {
  if (m.overlaps > 0) return { kind: 'next', reason: `${m.overlaps} chevauchement(s)` };
  const tooTall = fixed && (m.overflowPx > 1 || m.panelOverflow > 1);
  if (m.overflowX > 2 && !tooTall) return currentScale > FIT_FLOOR && fixed ? { kind: 'zoom', scale: Math.max(FIT_FLOOR, Math.floor(currentScale * (1 - m.overflowX / Math.max(1, m.width)) * 100) / 100) } : { kind: 'next', reason: `débordement latéral ${m.overflowX} px` };
  if (tooTall) {
    const needed = (currentScale * m.usableHeight) / Math.max(1, m.contentHeight);
    const scale = Math.floor(Math.min(needed * 0.985, currentScale - 0.04) * 100) / 100;
    if (scale >= FIT_FLOOR && scale < currentScale) return { kind: 'zoom', scale };
    return { kind: 'next', reason: `débordement ${Math.max(m.overflowPx, m.panelOverflow)} px même réduit` };
  }
  return { kind: 'accept' };
}

/**
 * Une note de qualité mesurée (plus haut = mieux), pour garder la meilleure tentative. Un défaut BLOQUANT,
 * même d'un pixel, coûte plus que toute réduction d'échelle admise : une page juste à 89 % l'emporte
 * toujours sur une page qui déborde à 93 %.
 */
export function measuredScore(m: Measurement, scale: number, fixed: boolean): number {
  let s = 100;
  if (fixed && m.overflowPx > 1) s -= 15 + Math.min(60, m.overflowPx / 4);
  if (m.panelOverflow > 1) s -= 15 + Math.min(40, m.panelOverflow / 2);
  if (m.overflowX > 2) s -= 15 + Math.min(40, m.overflowX / 2);
  s -= m.overlaps * 25;
  s -= m.decorOverText.length * 20;
  s -= m.lowContrast.length * 3;
  s -= Math.max(0, 1 - scale) * 40;
  if (fixed && m.fill < 0.38) s -= (0.38 - m.fill) * 40;
  return s;
}

/** Les constats d'une mesure, classés. `judgementBlocks` : à Low/Medium, le jugement peut bloquer. */
export function issuesOf(m: Measurement, fixed: boolean, scale: number, judgementBlocks: boolean, light: boolean): Issue[] {
  const out: Issue[] = [];
  if (fixed && m.overflowPx > 1) out.push({ code: 'overflow', severity: 'blocking', message: `Le contenu dépasse la page de ${m.overflowPx} px, même réduit à ${Math.round(scale * 100)} %.`, fix: 'raccourcir le contenu ou choisir une composition à plus grande capacité' });
  if (m.panelOverflow > 1) out.push({ code: 'panel_overflow', severity: 'blocking', message: `Un texte sort de son aplat de ${m.panelOverflow} px.`, fix: 'composition à panneau plus grand ou contenu plus court' });
  if (m.overflowX > 2) out.push({ code: 'overflow_x', severity: 'blocking', message: `Un élément déborde de ${m.overflowX} px sur le côté.`, fix: 'variante plus compacte du bloc' });
  if (m.overlaps) out.push({ code: 'overlap', severity: 'blocking', message: `${m.overlaps} bloc(s) se chevauchent.` });
  if (m.decorOverText.length) out.push({ code: 'decor_over_text', severity: 'blocking', message: `${m.decorOverText.length} décor(s) posé(s) sur un texte.`, fix: 'retirer le décor ou le déplacer dans un angle libre' });
  for (const low of m.lowContrast.slice(0, 4)) out.push({ code: 'contrast', severity: judgementBlocks && low.ratio < low.need - 1 ? 'blocking' : 'advisory', message: `Contraste ${low.ratio}:1 (attendu ${low.need}:1) sur « ${low.text} ».` });
  if (m.missingImages) out.push({ code: 'image_missing', severity: 'advisory', message: `${m.missingImages} image(s) non chargée(s).`, fix: 'vérifier l’adresse ou l’hôte autorisé' });
  if (!m.fontsLoaded) out.push({ code: 'font_missing', severity: 'advisory', message: 'La police de la marque n’a pas pu être chargée : rendu dans la police de repli.' });
  if (fixed && !light && m.fill < 0.38) out.push({ code: 'sparse', severity: 'advisory', message: `Page peu remplie (${Math.round(m.fill * 100)} % de la hauteur utile).` });
  if (scale < 1) out.push({ code: 'scaled', severity: 'advisory', message: `Contenu réduit à ${Math.round(scale * 100)} % pour tenir dans la page.` });
  return out;
}

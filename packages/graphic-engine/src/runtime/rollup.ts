/**
 * LE ROLL-UP (kakémono 85 × 200 cm) — dessiné par le code, jamais par un gabarit de flyer.
 *
 * Un roll-up se lit debout, à deux mètres, sur une toile très haute et très étroite : les squelettes de flyers
 * (carré, story, A4) y posaient un titre démesuré, sans logo, qui sortait du cadre. Ici la toile est découpée
 * une fois pour toutes, à l'échelle 1 px = 1 mm, dans la zone sûre du format (`rollup-85x200`) :
 *
 *   ┌──────────────┐  90  haut (sert au passage de la cassette)
 *   │ logo         │
 *   │ ▬            │
 *   │ TITRE        │  corps ajusté PAR MESURE dans sa boîte
 *   │ accroche     │
 *   ├──────────────┤  panneau de la couleur de marque (motif discret)
 *   │ ① point      │
 *   │ ② point      │
 *   │ ③ point      │
 *   │ @adresse     │
 *   └──────────────┘  220 bas : le pied d'enrouleur, rien d'utile
 *
 * Le texte vient du kit de marque (promesse, bio, titres des idées) : rien n'est inventé ici. Les corps sont
 * ajustés dans le navigateur (aucune coupe, aucun débordement) puis le rendu vérifie que rien ne sort de sa boîte.
 */
import { buildTokens, type BrandInput, type DirectionInput } from '../design-system/tokens';
import { ensureContrast, isDeep } from '../foundation/color';
import { patternHtml } from './primitives';
import { withPage } from './browser';

export const ROLLUP_SIZE = { width: 850, height: 2000 } as const;

export interface RollupInput {
  brand: BrandInput;
  direction?: DirectionInput;
  /** Le message : une phrase, en grand. */
  headline: string;
  /** Une ligne ou deux sous le titre. */
  tagline?: string;
  /** Jusqu'à trois points forts, courts. */
  points?: string[];
  /** Adresse, pseudo ou site, en pied de panneau. */
  handle?: string;
  seed?: string;
}

export interface RollupResult {
  png: Buffer;
  /** Les boîtes dont le texte dépasse encore après ajustement (vide : tout tient). */
  overflow: string[];
}

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clip = (s: string, n: number): string => {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length <= n ? t : `${t.slice(0, n - 1).replace(/\s+\S*$/, '')}…`;
};

/** Ajuste chaque `[data-fit]` : le plus grand corps (entre data-max et data-min) qui tient en hauteur ET en largeur. */
const FIT = `(function () {
  var failed = [];
  document.querySelectorAll('[data-fit]').forEach(function (el) {
    var max = Number(el.getAttribute('data-max')), min = Number(el.getAttribute('data-min'));
    var lo = min, hi = max, best = min;
    while (lo <= hi) {
      var mid = Math.floor((lo + hi) / 2);
      el.style.fontSize = mid + 'px';
      if (el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1) { best = mid; lo = mid + 1; } else { hi = mid - 1; }
    }
    el.style.fontSize = best + 'px';
    if (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1) failed.push(el.getAttribute('data-fit'));
  });
  return failed;
})()`;

export async function composeRollup(input: RollupInput): Promise<RollupResult> {
  const { width: W, height: H } = ROLLUP_SIZE;
  const tokens = buildTokens({ brand: input.brand, direction: input.direction, format: 'rollup-85x200', size: ROLLUP_SIZE });
  const c = tokens.color;
  const { safe } = tokens.format;
  const logos = tokens.brand.logos;

  // Surfaces claires (politique de la charte) : le haut est le fond de page, le panneau porte la couleur de marque.
  const panelBg = c.primary;
  const panelInk = ensureContrast(isDeep(panelBg) ? '#FFFFFF' : c.ink, panelBg, 4.5);
  const markBg = c.accent;
  const markInk = ensureContrast(c.onAccent, markBg, 4.5);
  const titleInk = ensureContrast(c.primary, c.ground, 7);

  const x = safe.left;
  const inner = W - safe.left - safe.right;
  const logoUrl = logos.onLight ?? logos.primary;
  const logo = logoUrl
    ? `<img data-ge-logo src="${esc(logoUrl)}" alt="Logo ${esc(tokens.brand.name)}" style="height:96px;max-width:${inner}px;width:auto;object-fit:contain;object-position:left center;display:block">`
    : `<span data-ge-wordmark style="font:800 64px/1 ${tokens.font.displayStack};color:${titleInk}">${esc(tokens.brand.name)}</span>`;

  const points = (input.points ?? []).map((p) => clip(p, 56)).filter(Boolean).slice(0, 3);
  const tagline = input.tagline ? clip(input.tagline, 150) : '';
  const handle = input.handle ? clip(input.handle, 40) : '';

  const panelTop = 1120;
  const panelBottom = H - safe.bottom; // fin de la zone utile du panneau
  const headlineTop = 330;
  const headlineBox = tagline ? 520 : 680;
  const taglineTop = headlineTop + headlineBox + 40;

  const pattern = patternHtml(tokens, 0, {});
  const pointRows = points
    .map(
      (p, i) => `<div style="display:flex;gap:28px;align-items:flex-start;padding:${points.length <= 2 ? 40 : 28}px 0;border-top:2px solid ${panelInk}33">
        <div style="flex:none;width:68px;height:68px;border-radius:50%;background:${markBg};color:${markInk};display:flex;align-items:center;justify-content:center;font:800 34px/1 ${tokens.font.displayStack}">${i + 1}</div>
        <div style="flex:1;min-width:0;padding-top:8px;font:600 42px/1.22 ${tokens.font.bodyStack};color:${panelInk};overflow-wrap:break-word">${esc(p)}</div>
      </div>`
    )
    .join('');

  const body = `<div class="ge-page" style="position:relative;width:${W}px;height:${H}px;overflow:hidden;background:${c.ground};font-family:${tokens.font.bodyStack}">
    <div style="position:absolute;left:${x}px;top:${safe.top}px;width:${inner}px">${logo}</div>
    <div style="position:absolute;left:${x}px;top:${safe.top + 96 + 56}px;width:132px;height:14px;background:${markBg}"></div>
    <div data-fit="headline" data-max="190" data-min="64" style="position:absolute;left:${x}px;top:${headlineTop}px;width:${inner}px;height:${headlineBox}px;overflow:hidden;font:800 190px/1.02 ${tokens.font.displayStack};letter-spacing:${tokens.tracking.tight}em;color:${titleInk};overflow-wrap:normal">${esc(clip(input.headline, 90))}</div>
    ${tagline ? `<div data-fit="tagline" data-max="46" data-min="30" style="position:absolute;left:${x}px;top:${taglineTop}px;width:${inner}px;height:${panelTop - taglineTop - 60}px;overflow:hidden;font:500 46px/1.3 ${tokens.font.bodyStack};color:${ensureContrast(c.muted, c.ground, 4.5)};overflow-wrap:break-word">${esc(tagline)}</div>` : ''}
    <div style="position:absolute;left:0;top:${panelTop}px;width:${W}px;height:${H - panelTop}px;background:${panelBg};overflow:hidden">
      <div style="position:absolute;inset:0;opacity:0.08">${pattern}</div>
      <div style="position:absolute;left:0;top:0;width:${W}px;height:14px;background:${markBg}"></div>
    </div>
    <div style="position:absolute;left:${x}px;top:${panelTop + 80}px;width:${inner}px;height:${panelBottom - panelTop - 80}px;display:flex;flex-direction:column;justify-content:flex-start">
      ${pointRows}
      ${handle ? `<div data-fit="handle" data-max="48" data-min="28" style="margin-top:auto;height:70px;overflow:hidden;white-space:nowrap;font:700 48px/70px ${tokens.font.displayStack};color:${panelInk};border-top:2px solid ${panelInk}33;padding-top:20px;box-sizing:content-box">${esc(handle)}</div>` : ''}
    </div>
  </div>`;

  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8">${tokens.font.headHtml}<style>html,body{margin:0;padding:0;background:${c.ground}}*,*::before,*::after{box-sizing:border-box}[data-ge-pattern]{width:100%;height:100%}</style></head><body>${body}</body></html>`;

  return withPage(html, { width: W, height: H, scale: 1 }, async (page) => {
    const overflow = (await page.evaluate(FIT)) as string[];
    const raw = await (await page.$('.ge-page'))!.screenshot({ type: 'png' });
    return { png: Buffer.from(raw), overflow };
  });
}

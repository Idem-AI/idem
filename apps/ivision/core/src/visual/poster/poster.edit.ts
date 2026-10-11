/**
 * LES RETOUCHES CIBLÉES — modifier UN élément d'un visuel déjà composé, sans le recomposer.
 *
 * Chaque calque d'un visuel porte un identifiant stable (`data-el`, posé au rendu) ; les formes du
 * kit gardent en plus leurs paramètres (`data-gfx`). Une retouche tient donc en une ligne :
 * « déplace photo-1 », « redessine g-rings-1 avec une autre graine », « supprime motif-2 ». C'est
 * ce qui permet à un agent (ou à l'éditeur) de corriger un défaut précis pour une poignée de jetons
 * au lieu de régénérer l'affiche entière.
 *
 * Le texte n'est jamais retouché ici : ses mots et son ajustage restent ceux du rendu mesuré.
 */
import { flyerRenderService } from '../flyer.render';
import { gfxContext, readGfxParams, regenerateGfx } from './kit/render';
import type { GfxBox, GfxParams } from './kit/types';

export type PosterEdit =
  | { id: string; move: { x?: number; y?: number } }
  | { id: string; resize: { w?: number; h?: number } }
  /** Redessine une forme du kit : autre graine, autre variante, autre couleur (hex), autre opacité. */
  | { id: string; gfx: Partial<Omit<GfxParams, 'kind'>> }
  | { id: string; opacity: number }
  | { id: string; remove: true };

export interface PosterEditResult {
  html: string;
  png: Buffer;
  applied: string[];
  /** Ce qui n'a pas pu être appliqué (identifiant inconnu, élément qui n'est pas une forme du kit…). */
  skipped: string[];
}

interface Found {
  id: string;
  params: string | null;
  box: GfxBox;
}

export async function applyPosterEdits(html: string, width: number, height: number, edits: PosterEdit[]): Promise<PosterEditResult> {
  return flyerRenderService.withPage(width, height, async (page) => {
    await page.setContent(html, { waitUntil: 'load', timeout: 30000 });
    await page.evaluate('document.fonts ? document.fonts.ready.then(() => true) : true').catch(() => undefined);
    const applied: string[] = [];
    const skipped: string[] = [];

    // 1. Les formes à redessiner : lues dans la page, redessinées ici (le kit est du code, pas du navigateur).
    const redraw = edits.filter((e): e is Extract<PosterEdit, { gfx: unknown }> => 'gfx' in e);
    const found = (await page.evaluate(
      `(function (ids) {
        return ids.map(function (id) {
          var el = document.querySelector('[data-el="' + id + '"]');
          if (!el) return null;
          return { id: id, params: el.getAttribute('data-gfx'), box: { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight } };
        });
      })(${JSON.stringify(redraw.map((e) => e.id))})`
    )) as (Found | null)[];
    const replacements: { id: string; html: string }[] = [];
    redraw.forEach((e, i) => {
      const f = found[i];
      const params = f?.params ? readGfxParams(f.params) : null;
      if (!f || !params) return void skipped.push(`${e.id}: not a kit graphic`);
      const ctx = gfxContext({ width, height, u: Math.min(width, height) / 100, tokens: {}, primary: params.color || '#111111', secondary: params.color2 || params.color || '#111111', bg: '#ffffff', ink: '#111111' });
      const res = regenerateGfx(params, e.gfx, f.box, ctx, e.id);
      if (!res.html) return void skipped.push(`${e.id}: ${res.issues[0] || 'could not be redrawn'}`);
      replacements.push({ id: e.id, html: res.html });
    });
    if (replacements.length) {
      await page.evaluate(
        `(function (list) {
          list.forEach(function (r) {
            var el = document.querySelector('[data-el="' + r.id + '"]');
            if (!el) return;
            var tpl = document.createElement('template');
            tpl.innerHTML = r.html.trim();
            el.replaceWith(tpl.content.firstElementChild);
          });
        })(${JSON.stringify(replacements)})`
      );
      replacements.forEach((r) => applied.push(`${r.id}: redrawn`));
    }

    // 2. Position, taille, opacité, suppression.
    const simple = edits.filter((e) => !('gfx' in e));
    const done = (await page.evaluate(
      `(function (edits) {
        return edits.map(function (e) {
          var el = document.querySelector('[data-el="' + e.id + '"]');
          if (!el || el.getAttribute('data-el') === 'canvas') return e.id + ': unknown element';
          if (e.remove) { el.remove(); return e.id + ': removed'; }
          if (e.move) { if (e.move.x !== undefined) el.style.left = Math.round(e.move.x) + 'px'; if (e.move.y !== undefined) el.style.top = Math.round(e.move.y) + 'px'; return e.id + ': moved'; }
          if (e.resize) { if (e.resize.w !== undefined) el.style.width = Math.round(e.resize.w) + 'px'; if (e.resize.h !== undefined) el.style.height = Math.round(e.resize.h) + 'px'; return e.id + ': resized'; }
          if (e.opacity !== undefined) { el.style.opacity = String(Math.max(0, Math.min(1, e.opacity))); return e.id + ': opacity'; }
          return e.id + ': unknown edit';
        });
      })(${JSON.stringify(simple)})`
    )) as string[];
    for (const line of done) (/unknown/.test(line) ? skipped : applied).push(line);

    const png = (await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width, height } })) as Buffer;
    const out = (await page.evaluate('"<!doctype html>" + document.documentElement.outerHTML')) as string;
    return { html: out, png, applied, skipped };
  });
}

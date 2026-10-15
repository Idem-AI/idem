/**
 * LE SEUL CONTRÔLE : la page s'affiche-t-elle ?
 *
 * Chromium (le même moteur que l'impression PDF) ouvre la page. Une page qui ne se charge pas, une racine sans
 * taille, ou une toile où rien n'est visible (ni texte, ni image, ni dessin) est une ERREUR TECHNIQUE — elle
 * part en correction. Rien d'autre n'est jugé : ni débordement, ni contraste, ni équilibre. C'est l'auteur qui
 * décide de la page.
 */
import { pageDocument, withPage } from './browser';
import type { FormatDef } from '../design-system/formats';

export interface RenderCheck {
  ok: boolean;
  /** L'erreur, en une phrase lisible par l'auteur qui la corrigera. */
  error?: string;
  width?: number;
  height?: number;
  png?: Buffer;
  /** Le navigateur lui-même manque (lancement impossible) : ce n'est pas la faute de la page, rien à corriger. */
  infra?: boolean;
}

const PROBE = `(function () {
  var root = document.querySelector('.ge-page');
  if (!root) return { error: 'the page root is missing' };
  var box = root.getBoundingClientRect();
  if (box.width < 2 || box.height < 2) return { error: 'the page has no size (' + Math.round(box.width) + 'x' + Math.round(box.height) + ')' };
  var visible = 0;
  var all = root.querySelectorAll('*');
  for (var i = 0; i < all.length && visible < 3; i++) {
    var el = all[i];
    var cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) continue;
    var r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    if (r.right <= box.left || r.left >= box.right || r.bottom <= box.top || r.top >= box.bottom) continue;
    var tag = el.tagName.toLowerCase();
    if (tag === 'img' || tag === 'svg' || tag === 'video') { visible++; continue; }
    for (var c = el.firstChild; c; c = c.nextSibling) if (c.nodeType === 3 && c.textContent.trim()) { visible++; break; }
  }
  if (!visible) return { error: 'nothing is visible inside the canvas (no text, image or drawing within ' + Math.round(box.width) + 'x' + Math.round(box.height) + ' px)' };
  return { width: box.width, height: box.height };
})()`;

export async function checkRender(html: string, head: string, format: FormatDef, o: { lang?: string; shoot?: boolean } = {}): Promise<RenderCheck> {
  try {
    return await withPage(pageDocument(html, head, { lang: o.lang, background: '#ffffff' }), { width: format.width, height: format.height }, async (page) => {
      const probe = (await page.evaluate(PROBE)) as { error?: string; width?: number; height?: number };
      if (probe.error) return { ok: false, error: probe.error };
      let png: Buffer | undefined;
      if (o.shoot) {
        const target = await page.$('.ge-page');
        if (target) png = Buffer.from(await target.screenshot({ type: 'png' }));
      }
      return { ok: true, width: Math.round(probe.width ?? 0), height: Math.round(probe.height ?? 0), ...(png ? { png } : {}) };
    });
  } catch (error) {
    const message = String((error as Error)?.message ?? error);
    if (/launch|Could not find (Chrome|Chromium|expected browser)|ECONNREFUSED|Target closed|Protocol error|Navigation timeout/i.test(message)) return { ok: true, infra: true, error: message.slice(0, 200) };
    return { ok: false, error: `the page could not be rendered: ${String((error as Error)?.message ?? error).slice(0, 200)}` };
  }
}

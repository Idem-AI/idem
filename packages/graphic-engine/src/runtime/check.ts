/**
 * LE SEUL CONTRÔLE : la page s'affiche-t-elle ?
 *
 * Chromium (le même moteur que l'impression PDF) ouvre la page. Une page qui ne se charge pas, une racine sans
 * taille, une toile où rien n'est visible, ou — sur une toile fixe — un TEXTE COUPÉ par le bord (il ne s'affiche
 * pas en entier) est une ERREUR TECHNIQUE : elle part en correction. Rien d'autre n'est jugé : ni contraste, ni
 * équilibre, ni goût. C'est l'auteur qui décide de la page.
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
  /** L'erreur est un texte coupé par le bord (la page s'affiche presque entière). */
  cut?: boolean;
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
  // Une page FIXE : un texte coupé par le bord de la toile ne s'affiche pas (en entier).
  if (root.getAttribute('data-ge-fixed') === '1') {
    var cut = [];
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (var n = walker.nextNode(); n && cut.length < 4; n = walker.nextNode()) {
      if (!n.textContent.trim() || !n.parentElement || n.parentElement.closest('svg,template')) continue;
      var cs = getComputedStyle(n.parentElement);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      var range = document.createRange();
      range.selectNodeContents(n);
      var r = range.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      if (r.bottom > box.bottom + 2 || r.right > box.right + 2 || r.top < box.top - 2 || r.left < box.left - 2) cut.push('"' + n.textContent.trim().slice(0, 40) + '" (' + Math.round(Math.max(r.bottom - box.bottom, r.right - box.right, box.top - r.top, box.left - r.left)) + ' px outside)');
    }
    if (cut.length) return { error: 'text is cut off by the edge of the canvas: ' + cut.join(', ') + ' — the content must fit inside ' + Math.round(box.width) + 'x' + Math.round(box.height) + ' px (less space for decoration, smaller or fewer elements; never remove a content key)' };
  }
  return { width: box.width, height: box.height };
})()`;

export async function checkRender(html: string, head: string, format: FormatDef, o: { lang?: string; shoot?: boolean } = {}): Promise<RenderCheck> {
  try {
    return await withPage(pageDocument(html, head, { lang: o.lang, background: '#ffffff' }), { width: format.width, height: format.height }, async (page) => {
      const probe = (await page.evaluate(PROBE)) as { error?: string; width?: number; height?: number };
      const cut = Boolean(probe.error && /cut off by the edge/.test(probe.error));
      if (probe.error && !cut) return { ok: false, error: probe.error };
      let png: Buffer | undefined;
      if (o.shoot) {
        const target = await page.$('.ge-page');
        if (target) png = Buffer.from(await target.screenshot({ type: 'png' }));
      }
      // Un texte coupé : la photographie est gardée (la page servira de repli si la correction échoue).
      if (cut) return { ok: false, cut: true, error: probe.error, ...(png ? { png } : {}) };
      return { ok: true, width: Math.round(probe.width ?? 0), height: Math.round(probe.height ?? 0), ...(png ? { png } : {}) };
    });
  } catch (error) {
    const message = String((error as Error)?.message ?? error);
    if (/launch|Could not find (Chrome|Chromium|expected browser)|ECONNREFUSED|Target closed|Protocol error|Navigation timeout/i.test(message)) return { ok: true, infra: true, error: message.slice(0, 200) };
    return { ok: false, error: `the page could not be rendered: ${String((error as Error)?.message ?? error).slice(0, 200)}` };
  }
}

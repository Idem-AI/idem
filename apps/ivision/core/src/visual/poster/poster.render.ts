/**
 * Le rendu d'une composition : ajustage des textes AU MILLIMÈTRE dans le navigateur, puis mesure.
 *
 *  1. polices de la charte chargées (toutes les graisses utilisées), images chargées ;
 *  2. chaque colonne de texte (`[data-stack]`) : toutes ses tailles sont réduites ensemble, par
 *     dichotomie, de leur maximum vers leur minimum, jusqu'à ce que RIEN ne déborde — ni en
 *     hauteur, ni un mot trop long en largeur. Aucun mot n'est jamais coupé ;
 *  3. mesure : débordement restant, textes qui se chevauchent, texte hors des marges, taille du
 *     titre. Un défaut bloquant fait écarter la composition (le compositeur en essaie une autre) ;
 *  4. photographie, et le HTML aux tailles finales (celui qui a produit l'image).
 */
import type { Page } from 'puppeteer';
import { brandFontLinks } from '../../design/google-fonts';
import { flyerRenderService } from '../flyer.render';
import type { PosterMeasure, PosterSpec } from './poster.types';

const BASE_CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{overflow:hidden;background:#ffffff}
.pv{position:relative;overflow:hidden;font-family:var(--fb);-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
.stack,.blk,.ph,.logo,.wordmark,.marks{position:absolute}
.stack{display:flex;flex-direction:column;overflow:hidden}
.fit{max-width:100%;overflow-wrap:normal;word-break:normal;hyphens:manual}
.stack>.fit{width:100%;flex:none}
.kicker{font-family:var(--fb);font-weight:700;letter-spacing:.14em;text-transform:uppercase;line-height:1.2}
.headline{font-family:var(--fd);font-weight:800;line-height:1.02;letter-spacing:-0.022em;text-wrap:balance}
.sub{font-family:var(--fb);font-weight:400;line-height:1.36;text-wrap:pretty}
.facts{font-family:var(--fb);font-weight:600;line-height:1.3;display:flex;flex-wrap:wrap;align-items:center;column-gap:.65em;row-gap:.25em}
.facts-col{flex-direction:column;align-items:flex-start}
.fact{white-space:nowrap}
.sep{display:inline-block;width:.3em;height:.3em;border-radius:50%;flex:none}
.offer,.date{font-family:var(--fd)}
.quote{font-family:var(--fd);font-weight:600;line-height:1.2;text-wrap:balance}
.marks{font-family:var(--fd);font-weight:900;line-height:1}
.ph{overflow:hidden}
.ph img{width:100%;height:100%;object-fit:cover;display:block}
.wordmark{font-family:var(--fd);font-weight:800;white-space:nowrap;letter-spacing:-0.01em}
.rule{flex:none}
`;

/** Ajustage puis mesure, exécutés DANS la page (chaîne : pas d'aide de compilation côté navigateur). */
const FIT_AND_MEASURE = `(function () {
  var report = { overflow: [], overlaps: [], outside: [], tooSmall: [], headlineU: 0 };
  var root = document.querySelector('.pv');
  var u = parseFloat(root.getAttribute('data-u')) || 10;
  var safe = JSON.parse(root.getAttribute('data-safe') || '{"top":0,"right":0,"bottom":0,"left":0}');
  var W = root.clientWidth, H = root.clientHeight;
  var stacks = document.querySelectorAll('[data-stack]');
  report.dropped = [];
  for (var i = 0; i < stacks.length; i++) {
    var st = stacks[i];
    // Mesuré calé en haut : calé en bas ou au centre, un débordement part HORS de la zone de
    // défilement (vers le haut) et ne se verrait pas.
    var justify = st.style.justifyContent;
    st.style.justifyContent = 'flex-start';
    var els = Array.prototype.slice.call(st.querySelectorAll('.fit'));
    var apply = function (k) {
      for (var j = 0; j < els.length; j++) {
        var e = els[j], mn = +e.getAttribute('data-min'), mx = +e.getAttribute('data-max');
        e.style.fontSize = (mn + (mx - mn) * k).toFixed(2) + 'px';
      }
    };
    var ok = function () {
      if (st.scrollHeight > st.clientHeight + 1) return false;
      for (var j = 0; j < els.length; j++) if (els[j].offsetParent !== null && els[j].scrollWidth > els[j].clientWidth + 1) return false;
      return true;
    };
    // Ce qui ne tient pas cède sa place, dans l'ordre : le sous-titre, le sur-titre, les faits
    // secondaires — jamais le titre. Un titre lisible vaut mieux que tout dire en petit.
    var drops = els.filter(function (e) { return e.getAttribute('data-drop'); }).sort(function (a, b) { return +a.getAttribute('data-drop') - +b.getAttribute('data-drop'); });
    apply(0);
    while (!ok() && drops.length) { var d = drops.shift(); d.style.display = 'none'; report.dropped.push(d.className.split(' ')[1]); }
    if (!ok()) { report.overflow.push(st.getAttribute('data-stack')); st.style.justifyContent = justify; continue; }
    apply(1);
    if (!ok()) {
      var lo = 0, hi = 1;
      for (var n = 0; n < 16; n++) { var mid = (lo + hi) / 2; apply(mid); if (ok()) lo = mid; else hi = mid; }
      apply(lo);
    }
    st.style.justifyContent = justify;
  }
  // Les boîtes RÉELLES des textes (pas leur colonne) et du logo.
  var boxes = [];
  var texts = document.querySelectorAll('.fit, .wordmark');
  for (var t = 0; t < texts.length; t++) {
    var el = texts[t];
    if (el.offsetParent === null) continue;
    var range = document.createRange();
    range.selectNodeContents(el);
    var rr = range.getBoundingClientRect();
    // La boîte du texte, bornée à celle de son élément : les jambages d'une très grande taille
    // (interligne serré) débordent la ligne sans que l'encre ne touche quoi que ce soit.
    var er = el.getBoundingClientRect();
    var top = Math.max(rr.top, er.top), bottom = Math.min(rr.bottom, er.bottom);
    var rc = { left: rr.left, top: top, width: rr.width, height: bottom - top };
    if (rc.width < 1 || rc.height < 1) continue;
    var stEl = el.closest('[data-stack]');
    boxes.push({ name: (el.className.split(' ')[1] || 'text'), over: !!(stEl && stEl.getAttribute('data-over-photo')), group: stEl ? stEl.getAttribute('data-stack') + ':' + Array.prototype.indexOf.call(stacks, stEl) : 'free' + t, x: rc.left, y: rc.top, w: rc.width, h: rc.height, size: parseFloat(getComputedStyle(el).fontSize) });
    if (el.classList.contains('headline')) report.headlineU = Math.max(report.headlineU, parseFloat(getComputedStyle(el).fontSize) / u);
  }
  // Les photos posées (pas celles de fond) : un texte ne les croise jamais.
  var photos = document.querySelectorAll('.ph:not([data-bg])');
  for (var p = 0; p < photos.length; p++) { var pr = photos[p].getBoundingClientRect(); boxes.push({ name: 'photo', group: 'photo' + p, x: pr.left, y: pr.top, w: pr.width, h: pr.height, size: 99 }); }
  var logos = document.querySelectorAll('.logo');
  for (var l = 0; l < logos.length; l++) { var lr = logos[l].getBoundingClientRect(); boxes.push({ name: 'logo', group: 'logo', x: lr.left, y: lr.top, w: lr.width, h: lr.height, size: 99 }); }
  var margin = Math.min(safe.top, safe.right, safe.bottom, safe.left) * 0.5;
  for (var a = 0; a < boxes.length; a++) {
    var b = boxes[a];
    if (b.name !== 'photo' && (b.x < margin - 1 || b.y < margin - 1 || b.x + b.w > W - margin + 1 || b.y + b.h > H - margin + 1)) report.outside.push(b.name);
    if (b.name !== 'logo' && b.name !== 'photo' && b.size < 2.0 * u) report.tooSmall.push(b.name);
    for (var c = a + 1; c < boxes.length; c++) {
      var d = boxes[c];
      if (b.group === d.group) continue;
      // Deux photos peuvent se toucher (mosaïque), un logo peut être posé sur une photo de carte.
      if ((b.name === 'photo' && d.name === 'photo') || (b.name === 'photo' && d.name === 'logo') || (b.name === 'logo' && d.name === 'photo')) continue;
      if ((b.name === 'photo' && d.over) || (d.name === 'photo' && b.over)) continue;
      var ix = Math.min(b.x + b.w, d.x + d.w) - Math.max(b.x, d.x);
      var iy = Math.min(b.y + b.h, d.y + d.h) - Math.max(b.y, d.y);
      if (ix > 2 && iy > 2) report.overlaps.push(b.name + '/' + d.name);
    }
  }
  return report;
})()`;

/** Le document complet d'une composition : polices de la charte, CSS de base, la composition. */
export function posterDocument(spec: PosterSpec, body: string, fonts: { display: string; body: string; links: string }): string {
  const withData = body.replace('<div class="pv" style="', `<div class="pv" data-u="${spec.u.toFixed(3)}" data-safe='${JSON.stringify(spec.safe)}' style="--fd:'${fonts.display.replace(/'/g, '')}', system-ui, sans-serif;--fb:'${fonts.body.replace(/'/g, '')}', system-ui, sans-serif;`);
  return `<!doctype html><html lang="${spec.language}"><head><meta charset="utf-8"><meta name="viewport" content="width=${spec.width},initial-scale=1">${fonts.links}<style>${BASE_CSS}</style></head><body style="width:${spec.width}px;height:${spec.height}px">${withData}</body></html>`;
}

export function posterFonts(typography: { primaryFont?: string; secondaryFont?: string; url?: string; primary?: { family?: string; cssUrl?: string }; secondary?: { family?: string; cssUrl?: string } }): { display: string; body: string; links: string } {
  const display = typography.primaryFont || typography.primary?.family || 'Archivo';
  const body = typography.secondaryFont || typography.secondary?.family || display;
  return { display, body, links: brandFontLinks({ ...typography, primaryFont: display, secondaryFont: body } as never) };
}

async function settle(page: Page, fonts: { display: string; body: string }): Promise<void> {
  const fams = JSON.stringify([fonts.display, fonts.body]);
  await page.evaluate(`(function () {
    var fams = ${fams};
    var jobs = [];
    fams.forEach(function (f) { ['400', '600', '700', '800', '900'].forEach(function (w) { jobs.push(document.fonts.load(w + ' 40px "' + f + '"', 'AÀaé0').catch(function () {})); }); });
    var imgs = Array.prototype.map.call(document.images, function (img) {
      return img.complete ? Promise.resolve() : new Promise(function (res) { img.addEventListener('load', res, { once: true }); img.addEventListener('error', res, { once: true }); });
    });
    return Promise.race([Promise.all(jobs.concat(imgs)).then(function () { return document.fonts.ready; }), new Promise(function (res) { setTimeout(res, 12000); })]);
  })()`);
}

export interface PosterRender {
  png: Buffer;
  html: string;
  measure: PosterMeasure;
}

/** Rend, ajuste, mesure et photographie une composition. */
export async function renderPoster(spec: PosterSpec, body: string, fonts: { display: string; body: string; links: string }): Promise<PosterRender> {
  const doc = posterDocument(spec, body, fonts);
  return flyerRenderService.withPage(spec.width, spec.height, async (page) => {
    await page.setContent(doc, { waitUntil: 'load', timeout: 30000 });
    await settle(page, fonts);
    const raw = (await page.evaluate(FIT_AND_MEASURE)) as Omit<PosterMeasure, 'score' | 'blocking'>;
    const png = (await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: spec.width, height: spec.height } })) as Buffer;
    const html = (await page.evaluate(`document.querySelector('.pv').outerHTML`)) as string;
    const blocking = raw.overflow.length > 0 || raw.overlaps.length > 0 || raw.outside.length > 0;
    const dropped = (raw as { dropped?: string[] }).dropped || [];
    let score = 100 - raw.overflow.length * 35 - raw.overlaps.length * 20 - raw.outside.length * 12 - raw.tooSmall.length * 6 - dropped.length * 7;
    // Un titre d'affiche se lit de loin : trop petit, la composition perd sa force.
    if (raw.headlineU && raw.headlineU < 6) score -= Math.round((6 - raw.headlineU) * 6);
    return { png, html: posterDocument(spec, html, fonts), measure: { ...raw, score: Math.max(0, score), blocking } };
  });
}

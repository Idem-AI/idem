/**
 * L'EXPORT POWERPOINT — le HTML Tailwind reste la SOURCE du deck ; le `.pptx` est un fichier produit à la demande,
 * qui ne modifie jamais le HTML et ne redemande rien à l'IA.
 *
 *   fidèle       (par défaut) chaque slide est photographiée par Chromium en haute résolution et posée en pleine
 *                page : le rendu est celui de l'aperçu, quelle que soit la composition ;
 *   modifiable   les VISUELS (fonds, aplats, formes, photos, graphiques, motifs) forment l'image de fond de la slide,
 *                rendue sans ses textes ; chaque bloc de texte devient une zone de texte PowerPoint native, à sa
 *                place, avec sa police, son corps, sa graisse, sa couleur et son alignement (les mots en gras ou en
 *                couleur gardent leur style). Ce qui ne se traduit pas (texte pivoté, texte dans un graphique) reste
 *                dans l'image : rien n'est perdu, rien n'est simplifié.
 *
 * Les notes de l'orateur (`<template data-speaker-notes>`) deviennent les notes de la slide, dans les deux modes.
 */
import type { Page } from 'puppeteer';
import { pageDocument, withPage } from '../runtime/browser';

export type PptxMode = 'fidelity' | 'editable';

export interface PptxSlideInput {
  /** Le fragment stocké : polices et feuille Tailwind, la racine `.ge-page`, puis les notes éventuelles. */
  html: string;
  /** Les notes de l'orateur (sinon lues dans le fragment). */
  notes?: string;
}

export interface PptxOptions {
  mode?: PptxMode;
  title?: string;
  author?: string;
  company?: string;
  /** La toile des slides, en px CSS (16:9 du moteur par défaut : 297 × 167 mm). */
  size?: { width: number; height: number };
  /** Résolution des images (2 = deux pixels par pixel CSS). */
  scale?: number;
}

export interface PptxReport {
  buffer: Buffer;
  slides: number;
  /** Zones de texte natives créées (mode modifiable). */
  textBoxes: number;
  /** Ce qui n'a pas pu être traduit, slide par slide (dit, jamais corrigé). */
  notes: string[];
}

const MM = 96 / 25.4;
const DEFAULT_SIZE = { width: Math.round(297 * MM), height: Math.round(167 * MM) };

interface TextRun {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  color: string;
  size: number;
  font: string;
  breakLine?: boolean;
}

interface TextBlock {
  x: number;
  y: number;
  w: number;
  h: number;
  align: 'left' | 'center' | 'right' | 'justify';
  lineHeight: number;
  letterSpacing: number;
  runs: TextRun[];
}

/** Lu DANS la page (chaîne ES5 : la cible ES2016 transpilerait async et la décomposition). */
const EXTRACT = `(function () {
  var root = document.querySelector('.ge-page');
  if (!root) return { blocks: [], skipped: 0 };
  var box = root.getBoundingClientRect();
  var INLINE = { inline: 1, contents: 1 };
  function visible(el) {
    for (var e = el; e && e !== document.body; e = e.parentElement) {
      var cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return false;
    }
    return true;
  }
  function inSvg(el) { return !!(el.closest && el.closest('svg')); }
  function rotated(el) {
    for (var e = el; e && e !== root; e = e.parentElement) { var t = getComputedStyle(e).transform; if (t && t !== 'none' && !/^matrix\\(1, 0, 0, 1,/.test(t)) return true; }
    return false;
  }
  function blockOf(el) {
    var e = el;
    while (e && e !== root && INLINE[getComputedStyle(e).display]) e = e.parentElement;
    return e || root;
  }
  function hex(c) {
    var m = c.match(/rgba?\\(([^)]+)\\)/);
    if (!m) return '000000';
    var p = m[1].split(',').map(function (x) { return parseFloat(x); });
    return [p[0], p[1], p[2]].map(function (v) { var h = Math.round(v).toString(16); return h.length < 2 ? '0' + h : h; }).join('');
  }
  var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  var blocks = [];
  var index = new Map();
  var skipped = 0;
  for (var n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent || !n.textContent.trim()) continue;
    var parent = n.parentElement;
    if (!parent || inSvg(parent) || parent.closest('template') || !visible(parent)) continue;
    if (rotated(parent)) { skipped++; continue; }
    var block = blockOf(parent);
    var entry = index.get(block);
    if (!entry) {
      var bcs = getComputedStyle(block);
      entry = { el: block, runs: [], align: bcs.textAlign, lineHeight: bcs.lineHeight, fontSize: parseFloat(bcs.fontSize), letterSpacing: bcs.letterSpacing, rects: [] };
      index.set(block, entry);
      blocks.push(entry);
    }
    var cs = getComputedStyle(parent);
    var text = n.textContent.replace(/\\s+/g, ' ');
    if (cs.textTransform === 'uppercase') text = text.toUpperCase();
    else if (cs.textTransform === 'lowercase') text = text.toLowerCase();
    var range = document.createRange();
    range.selectNodeContents(n);
    var rects = range.getClientRects();
    for (var r = 0; r < rects.length; r++) entry.rects.push({ l: rects[r].left, t: rects[r].top, r: rects[r].right, b: rects[r].bottom });
    entry.runs.push({
      text: text,
      bold: parseInt(cs.fontWeight, 10) >= 600,
      italic: cs.fontStyle === 'italic',
      underline: (cs.textDecorationLine || '').indexOf('underline') >= 0,
      color: hex(cs.color),
      size: parseFloat(cs.fontSize),
      font: (cs.fontFamily.split(',')[0] || '').replace(/["']/g, '').trim()
    });
    // Un <br> entre deux textes du même bloc : un retour à la ligne.
    var next = n.nextSibling;
    if (next && next.nodeName === 'BR') entry.runs[entry.runs.length - 1].breakLine = true;
  }
  var out = [];
  for (var i = 0; i < blocks.length; i++) {
    var b = blocks[i];
    if (!b.rects.length) continue;
    var l = Infinity, t = Infinity, rr = -Infinity, bb = -Infinity;
    for (var k = 0; k < b.rects.length; k++) { var q = b.rects[k]; l = Math.min(l, q.l); t = Math.min(t, q.t); rr = Math.max(rr, q.r); bb = Math.max(bb, q.b); }
    if (rr <= box.left || l >= box.right || bb <= box.top || t >= box.bottom) continue;
    var lh = parseFloat(b.lineHeight);
    out.push({
      x: l - box.left, y: t - box.top, w: rr - l, h: bb - t,
      align: b.align === 'center' ? 'center' : b.align === 'right' || b.align === 'end' ? 'right' : b.align === 'justify' ? 'justify' : 'left',
      lineHeight: isNaN(lh) ? 1.2 : lh / b.fontSize,
      letterSpacing: parseFloat(b.letterSpacing) || 0,
      runs: b.runs.map(function (x) { return { text: x.text, bold: x.bold, italic: x.italic, underline: x.underline, color: x.color, size: x.size, font: x.font, breakLine: !!x.breakLine }; })
    });
  }
  return { blocks: out, skipped: skipped };
})()`;

/** Cache les textes que l'export rend modifiables (le texte des graphiques SVG reste dans l'image). */
const HIDE_TEXT = `(function () {
  Array.prototype.forEach.call(document.querySelectorAll('.ge-page svg'), function (s) { s.style.color = getComputedStyle(s).color; });
  var st = document.createElement('style');
  st.textContent = '.ge-page :not(svg):not(svg *), .ge-page { color: transparent !important; text-shadow: none !important; -webkit-text-stroke: 0 !important; text-decoration-color: transparent !important; }';
  document.head.appendChild(st);
  return true;
})()`;

async function shoot(page: Page): Promise<Buffer> {
  const root = await page.$('.ge-page');
  return Buffer.from(root ? await root.screenshot({ type: 'png' }) : await page.screenshot({ type: 'png' }));
}

const notesOf = (html: string): string | undefined => {
  const raw = html.match(/<template data-speaker-notes>([\s\S]*?)<\/template>/)?.[1];
  return raw ? raw.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim() || undefined : undefined;
};

export async function exportPptx(slides: PptxSlideInput[], o: PptxOptions = {}): Promise<PptxReport> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const PptxGenJS = require('pptxgenjs');
  const pptx = new PptxGenJS();
  const size = o.size ?? DEFAULT_SIZE;
  const W = size.width / 96;
  const H = size.height / 96;
  pptx.defineLayout({ name: 'IDEM', width: W, height: H });
  pptx.layout = 'IDEM';
  if (o.title) pptx.title = o.title;
  if (o.author) pptx.author = o.author;
  if (o.company) pptx.company = o.company;
  const mode: PptxMode = o.mode ?? 'fidelity';
  const scale = o.scale ?? 2;
  const report: Omit<PptxReport, 'buffer'> = { slides: 0, textBoxes: 0, notes: [] };

  for (const [i, input] of slides.entries()) {
    const slide = pptx.addSlide();
    const html = input.html;
    const notes = input.notes ?? notesOf(html);
    const doc = pageDocument(html.replace(/<template data-speaker-notes>[\s\S]*?<\/template>/g, ''), '', { background: '#ffffff' });
    const { image, blocks, skipped } = await withPage(doc, { width: size.width, height: size.height, scale }, async (page) => {
      if (mode === 'fidelity') return { image: await shoot(page), blocks: [] as TextBlock[], skipped: 0 };
      const read = (await page.evaluate(EXTRACT)) as { blocks: TextBlock[]; skipped: number };
      await page.evaluate(HIDE_TEXT);
      return { image: await shoot(page), blocks: read.blocks, skipped: read.skipped };
    });
    slide.addImage({ data: `data:image/png;base64,${image.toString('base64')}`, x: 0, y: 0, w: W, h: H });
    for (const b of blocks) {
      // Un peu d'aisance : les métriques d'une police dans PowerPoint ne sont jamais tout à fait celles de Chromium.
      const slack = b.w * 0.06;
      const runs = b.runs.map((r, k) => ({
        text: k === 0 ? r.text.replace(/^\s+/, '') : r.text,
        options: { bold: r.bold, italic: r.italic, underline: r.underline ? { style: 'sng' } : undefined, color: r.color, fontSize: Math.max(4, Math.round(r.size * 0.75 * 10) / 10), fontFace: r.font || undefined, breakLine: r.breakLine },
      }));
      slide.addText(runs, {
        x: Math.max(0, (b.x - (b.align === 'center' ? slack / 2 : b.align === 'right' ? slack : 0)) / 96),
        y: Math.max(0, b.y / 96),
        w: Math.min(W, (b.w + slack) / 96),
        h: Math.max(0.1, b.h / 96),
        align: b.align,
        valign: 'top',
        margin: 0,
        lineSpacingMultiple: Math.min(3, Math.max(0.8, b.lineHeight)),
        charSpacing: b.letterSpacing ? Math.round(b.letterSpacing * 0.75 * 10) / 10 : undefined,
        fit: 'none',
        wrap: true,
      });
      report.textBoxes += 1;
    }
    if (skipped) report.notes.push(`slide ${i + 1} : ${skipped} texte(s) pivoté(s) laissé(s) dans l'image`);
    if (notes) slide.addNotes(notes);
    report.slides += 1;
  }
  const buffer = (await pptx.write({ outputType: 'nodebuffer' })) as Buffer;
  return { ...report, buffer };
}

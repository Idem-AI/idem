/**
 * LA COMPOSITION HYPERFRAMES — un film devient UNE page HTML que HyperFrames (Apache 2.0) rend image par image dans
 * Chrome, puis encode avec FFmpeg.
 *
 * Pourquoi : les petits modèles écrivent mal le TSX de Motion Canvas (banc : 3 MP4 valides sur 8) mais bien le HTML
 * Tailwind — celui que le moteur graphique leur fait déjà écrire. Chaque scène est un fragment HTML Tailwind aux
 * couleurs de la marque, animé par un court script : GSAP par défaut, Anime.js au choix (`IDEM_VIDEO_ANIMATION`).
 *
 * Ce que le CODE garantit (l'IA ne fait que le fragment et son animation) :
 *   · les textes EXACTS (`{{text.clé}}`) et les médias (`{{media.id}}`, `{{logo}}`) posés par le code ;
 *   · la feuille Tailwind compilée avec le thème de la marque (le compilateur du moteur graphique) ;
 *   · le temps : chaque scène est un clip HyperFrames (`data-start`, `data-duration`) et son animation est ajoutée à
 *     UNE timeline GSAP maîtresse, en pause, enregistrée sur `window.__timelines` — HyperFrames la positionne image par
 *     image (rendu déterministe). Une timeline Anime.js est pilotée par cette même timeline (`seek`) ;
 *   · le cloisonnement : politique de sécurité de contenu sans réseau (`connect-src 'none'`), médias servis depuis le
 *     dossier du rendu, une erreur de script ne coupe que sa scène (elle est relevée, et la scène dite en erreur).
 */
import fs from 'fs';
import path from 'path';
import { buildTokens, compileTailwind } from '@idem/graphic-engine';
import type { BrandTokens } from '../../../../motion/kit/context';
import { CATALOG_RUNTIME } from '../../catalog/runtime';
import { isCatalogScript } from '../../catalog/assemble';

export type AnimationLib = 'gsap' | 'anime';

/** La bibliothèque d'animation des nouvelles scènes : GSAP par défaut (décision du 04/11/2026), Anime.js au choix. */
export function animationLib(): AnimationLib {
  return (process.env.IDEM_VIDEO_ANIMATION || 'gsap').trim().toLowerCase() === 'anime' ? 'anime' : 'gsap';
}

/** Le moteur de rendu des nouveaux films : HyperFrames par défaut, Motion Canvas au choix (et en repli). */
export function videoRenderer(): 'hyperframes' | 'motion-canvas' {
  return (process.env.IDEM_VIDEO_RENDERER || 'hyperframes').trim().toLowerCase() === 'motion-canvas' ? 'motion-canvas' : 'hyperframes';
}

export interface HtmlScene {
  key: string;
  start: number;
  duration: number;
  /** Le fragment HTML Tailwind écrit par l'IA (aucun script, aucun texte en dur). */
  html: string;
  /** Le corps de la fonction d'animation écrit par l'IA. */
  script: string;
  animation: AnimationLib;
  texts: Record<string, string>;
}

export interface CompositionMedia {
  /** Adresse servie : un nom de fichier du dossier du rendu, ou une URL https en aperçu. */
  src: string;
  kind: 'image' | 'video';
}

export interface CompositionInput {
  scenes: HtmlScene[];
  /** Taille de composition (celle que l'auteur reçoit) et taille de sortie (qualité). */
  width: number;
  height: number;
  output?: { width: number; height: number };
  durationSec: number;
  brand: BrandTokens;
  media: Record<string, CompositionMedia>;
  /** Le logo servi (fichier du rendu ou URL d'aperçu), et sa déclinaison pour fond sombre. */
  logo?: string;
  logoDark?: string;
  /** Les polices embarquées (`embeddedFontCss`). */
  fontCss: string;
  mode: 'render' | 'preview';
  /** Aperçu : la musique et la voix jouées en même temps que la timeline (le rendu les mixe avec FFmpeg). */
  audio?: { music?: { url: string; startAt: number; gain: number }; voice: { url: string; at: number }[] };
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Pose les textes exacts et les médias à la place des clés ; une clé inconnue disparaît (jamais imprimée). */
export function fillScene(html: string, scene: Pick<HtmlScene, 'texts'>, media: Record<string, CompositionMedia>, logo?: string, logoDark?: string): string {
  return html.replace(/\{\{\s*(text|media)\.([\w-]+)\s*\}\}|\{\{\s*(logo|logoDark)\s*\}\}/g, (_m, kind?: string, key?: string, which?: string) => {
    if (!kind) {
      const src = which === 'logoDark' ? logoDark || logo : logo;
      return src ? escapeHtml(src) : '';
    }
    if (kind === 'text') return escapeHtml(scene.texts[key!] ?? '');
    return media[key!] ? escapeHtml(media[key!].src) : '';
  });
}

let libCache: { gsap: string; anime: string } | null = null;

/** GSAP et Anime.js embarqués dans la page (aucune adresse externe : la page n'a pas de réseau). */
export function animationLibraries(): { gsap: string; anime: string } {
  if (!libCache) {
    const read = (pkg: string, file: string) => fs.readFileSync(path.join(path.dirname(require.resolve(`${pkg}/package.json`)), file), 'utf8');
    libCache = { gsap: read('gsap', 'dist/gsap.min.js'), anime: read('animejs', 'dist/bundles/anime.umd.min.js') };
  }
  return libCache;
}

function csp(mode: CompositionInput['mode']): string {
  const remote = mode === 'preview' ? ' https:' : '';
  return [`default-src 'none'`, `script-src 'unsafe-inline'`, `style-src 'unsafe-inline'`, `img-src 'self' data: blob:${remote}`, `media-src 'self' data: blob:${remote}`, `font-src 'self' data:${remote}`, `connect-src 'none'`].join('; ');
}

/** Le script d'une scène, enveloppé : sa timeline est ajoutée à la maîtresse à son début ; une erreur ne coupe qu'elle. */
function sceneScript(s: HtmlScene): string {
  const key = JSON.stringify(s.key);
  const start = s.start.toFixed(3);
  const d = s.duration.toFixed(3);
  const body =
    s.animation === 'anime'
      ? `var a = (function (anime, root, D) {\n${s.script}\n})(window.anime, root, ${d});
    if (a && typeof a.seek === 'function') { var p = { t: 0 }; master.add(gsap.to(p, { t: ${d}, duration: ${d}, ease: 'none', onUpdate: function () { a.seek(p.t * 1000); } }), ${start}); }
    else throw new Error('the scene script must return an Anime.js timeline (createTimeline({ autoplay: false }))');`
      : `var tl = gsap.timeline();\n    (function (tl, root, D, gsap) {\n${s.script}\n})(tl, root, ${d}, gsap);\n    master.add(tl, ${start});`;
  return `(function () {
  var root = document.getElementById(${key});
  try {
    ${body}
  } catch (e) { window.__sceneErrors.push({ key: ${key}, message: String((e && e.message) || e).slice(0, 300) }); }
})();`;
}

/** Le code d'un format pour les variantes des mises en page du catalogue (`group-data-[f=ls]/f:…`). */
export function formatCode(width: number, height: number): 'st' | 'po' | 'sq' | 'ls' {
  if (width > height * 1.05) return 'ls';
  if (Math.abs(width - height) <= height * 0.05) return 'sq';
  return height / width > 1.6 ? 'st' : 'po';
}

export async function buildComposition(input: CompositionInput): Promise<string> {
  const out = input.output ?? { width: input.width, height: input.height };
  const scale = out.width / input.width;
  // Les scènes du CATALOGUE : leur script n'est que des données pour le runtime `__ge` (découpe, mise à la taille,
  // tweens, transitions), embarqué avant elles ; leurs panneaux de transition vivent dans un calque au-dessus.
  const catalog = input.scenes.some((s) => isCatalogScript(s.script));
  const scenesHtml = input.scenes
    .map((s) => `<section id="${s.key}" class="clip scene" data-start="${s.start.toFixed(3)}" data-duration="${s.duration.toFixed(3)}" data-track-index="0" style="position:absolute;left:0;top:0;width:${input.width}px;height:${input.height}px;overflow:hidden">${fillScene(s.html, s, input.media, input.logo, input.logoDark)}</section>`)
    .join('\n');
  // La feuille Tailwind de la marque (portée `.ge-page`), compilée comme les pages du moteur graphique.
  const tokens = buildTokens({
    brand: { name: input.brand.name, palette: { primary: input.brand.colors.primary, secondary: input.brand.colors.secondary, accent: input.brand.colors.accent, background: input.brand.colors.background, text: input.brand.colors.text }, fonts: { display: input.brand.fonts.display, body: input.brand.fonts.body } },
    format: 'flyer-square',
    size: { width: input.width, height: input.height },
  });
  const css = await compileTailwind(scenesHtml, tokens);
  const libs = animationLibraries();
  const needsAnime = input.scenes.some((s) => s.animation === 'anime');
  const audio = input.mode === 'preview' && input.audio ? previewAudio(input.audio) : '';
  return `<!doctype html>
<html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${csp(input.mode)}">
<style>html,body{margin:0;padding:0;background:${input.brand.colors.background};}#stage{position:relative;overflow:hidden;width:${out.width}px;height:${out.height}px}#comp{position:absolute;left:0;top:0;width:${input.width}px;height:${input.height}px;transform:scale(${scale});transform-origin:0 0}</style>
${input.fontCss}
<style data-ge-tailwind>${css}</style>
</head><body>
<div id="stage" data-composition-id="film" data-start="0" data-duration="${input.durationSec.toFixed(3)}" data-width="${out.width}" data-height="${out.height}">
<div id="comp" data-f="${formatCode(input.width, input.height)}" class="ge-page group/f bg-ground font-body text-ink" style="container-type:size">
${scenesHtml}
${catalog ? '<div id="ge-fx" style="position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;overflow:hidden"></div>' : ''}
</div>
</div>
<script>${libs.gsap}</script>
${needsAnime ? `<script>${libs.anime}</script>` : ''}
<script>
window.__sceneErrors = [];
var master = gsap.timeline({ paused: true });
</script>
${catalog ? `<script>${CATALOG_RUNTIME}</script>` : ''}
<script>
${input.scenes.map(sceneScript).join('\n')}
master.set({}, {}, ${input.durationSec.toFixed(3)});
window.__timelines = window.__timelines || {};
window.__timelines.film = master;
</script>
${audio}
</body></html>`;
}

/** L'aperçu dans le navigateur : un bouton « Lire » lance la timeline et la bande son (les navigateurs exigent un geste). */
function previewAudio(audio: NonNullable<CompositionInput['audio']>): string {
  const tracks = [...(audio.music ? [{ url: audio.music.url, at: 0, offset: audio.music.startAt, gain: audio.music.gain }] : []), ...audio.voice.map((v) => ({ url: v.url, at: v.at, offset: 0, gain: 1 }))];
  return `<button id="play" style="position:fixed;inset:auto 16px 16px auto;z-index:9;padding:10px 18px;border:0;border-radius:999px;background:#111;color:#fff;font:600 14px sans-serif;cursor:pointer">Lire</button>
<script>
(function () {
  // Sans le moteur HyperFrames, l'aperçu montre lui-même la scène du moment (au rendu, HyperFrames s'en charge).
  var scenes = Array.prototype.slice.call(document.querySelectorAll('section.scene'));
  function show(t) { scenes.forEach(function (s) { var a = parseFloat(s.dataset.start), d = parseFloat(s.dataset.duration); s.style.visibility = t >= a && t < a + d ? 'visible' : 'hidden'; }); }
  window.__timelines.film.eventCallback('onUpdate', function () { show(this.time()); });
  window.__timelines.film.seek(0.001); show(0.001);
  var tracks = ${JSON.stringify(tracks)};
  var els = tracks.map(function (t) { var a = new Audio(t.url); a.volume = Math.min(1, t.gain); return { a: a, t: t }; });
  var timers = [];
  document.getElementById('play').addEventListener('click', function () {
    timers.forEach(clearTimeout); timers = [];
    els.forEach(function (e) { e.a.pause(); e.a.currentTime = e.t.offset; timers.push(setTimeout(function () { e.a.play().catch(function () {}); }, e.t.at * 1000)); });
    window.__timelines.film.restart();
  });
})();
</script>`;
}

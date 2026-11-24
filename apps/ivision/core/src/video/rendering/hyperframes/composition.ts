/**
 * LA COMPOSITION HYPERFRAMES — un film devient UNE page HTML que HyperFrames (Apache 2.0) rend image par image dans
 * Chrome, puis encode avec FFmpeg.
 *
 * Pourquoi : les petits modèles écrivent mal le TSX de Motion Canvas (banc : 3 MP4 valides sur 8) mais bien le HTML
 * Tailwind — celui que le moteur graphique leur fait déjà écrire. Chaque scène est un fragment HTML Tailwind aux
 * couleurs de la marque, animé par GSAP. Depuis le 11/11/2026 les scènes sont ASSEMBLÉES depuis le catalogue vidéo
 * (`video/catalog/`) ; les films écrits avant (HTML libre, parfois Anime.js) se rendent toujours tels quels.
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
import { buildTokens, compileTailwind, lightnessOf, patternLayerHtml, patternVerdict, planPattern, QUIET_STRENGTH, QUIET_STYLES } from '@idem/graphic-engine';
import type { PatternTile } from '@idem/graphic-engine';
import type { BrandTokens } from '../../contracts/brand-tokens';
import { CATALOG_RUNTIME } from '../../catalog/runtime';
import { isCatalogScript } from '../../catalog/assemble';

export type AnimationLib = 'gsap' | 'anime';

/** La version du moteur de rendu (servie par `GET …/videos/options`) : celle d'`@hyperframes/producer`. */
export const HYPERFRAMES_VERSION = '0.9.70';

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
  /** Le logo SVG assaini (`rendering/logo-svg.ts`) : la signature le dessine trait par trait. */
  logoSvg?: string;
  /** Les polices embarquées (`embeddedFontCss`). */
  fontCss: string;
  /** Les motifs de la charte, déjà servis (fichier du rendu ou URL d'aperçu) : posés par scène quand elle les gagne. */
  patterns?: PatternTile[];
  /** La direction artistique de la charte (une direction sobre pose moins de motifs). */
  styleId?: string;
  mode: 'render' | 'preview';
  /** Aperçu : la musique et la voix jouées en même temps que la timeline (le rendu les mixe avec FFmpeg). */
  /** `sfx` : les effets sonores posés à leur instant (gain linéaire déjà calculé, sonie égalisée). */
  audio?: { music?: { url: string; startAt: number; gain: number }; voice: { url: string; at: number }[]; sfx?: { url: string; at: number; gain: number }[] };
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

/**
 * Le motif d'une scène, décidé sans modèle et sans hasard, sur le même principe que les visuels : le CONTENU décide.
 * Pas de motif sur une scène qui montre une photo ou un clip (rien de visible dessous), ni quand le texte est très
 * dense ; sinon le motif de la charte est posé, le même pour tout le film, léger en direction sobre. Son opacité
 * (5 à 14 %) suit la luminosité du fond de la scène ; il se marque dans un coin qui change de scène en scène et se
 * fond vers le centre. Posé APRÈS la scène, mélangé (multiply / screen) : aucun script de scène n'est touché.
 */
export function scenePattern(input: Pick<CompositionInput, 'patterns' | 'styleId' | 'width' | 'height' | 'brand'>, scene: Pick<HtmlScene, 'key' | 'start' | 'duration' | 'html' | 'texts'>, index: number): string {
  const tiles = input.patterns ?? [];
  if (!tiles.length || /\{\{\s*media\./.test(scene.html)) return '';
  const textShare = Math.min(0.8, Object.keys(scene.texts).length * 0.12);
  if (!patternVerdict({ exposed: 1, textShare }).place) return '';
  const dark = /\bbg-(ink|deep|brand|secondary|primary|black)\b|bg-\[#[0-3][0-9a-f]{5}\]/i.test(scene.html);
  const ground = dark ? (lightnessOf(input.brand.colors.secondary) < 0.5 ? input.brand.colors.secondary : '#101828') : input.brand.colors.background;
  const quiet = QUIET_STYLES.has(input.styleId ?? '');
  // Le motif du film : le même pour toutes les scènes (graine du film).
  const plan = planPattern({ regionLum: Math.pow(lightnessOf(ground), 2.4), tiles, textShare, seed: input.brand.name, strength: quiet ? QUIET_STRENGTH : 1, inks: [input.brand.colors.primary, input.brand.colors.accent, input.brand.colors.secondary] });
  if (!plan) return '';
  const corners = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 1 }];
  const at = corners[index % corners.length];
  const layer = patternLayerHtml(plan, { size: { w: input.width, h: input.height }, anchor: { ...at, reach: quiet ? 0.7 : 0.95 }, scale: Math.min(input.width, input.height) / 1080 });
  return `<section id="${scene.key}-pat" class="clip scene" data-start="${scene.start.toFixed(3)}" data-duration="${scene.duration.toFixed(3)}" data-track-index="1" style="position:absolute;left:0;top:0;width:${input.width}px;height:${input.height}px;overflow:hidden;pointer-events:none">${layer}</section>`;
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

/**
 * Les origines des médias de l'APERÇU (photos, clips, logo, motifs, polices, musique, voix, effets). L'aperçu
 * n'autorisait que `https:` : en local (MinIO en `http://localhost:9000`, sons servis par l'API en http) TOUT était
 * bloqué — ni image, ni clip, ni son. Chaque origine réellement utilisée est donc nommée, en http comme en https ;
 * rien d'autre n'est ouvert.
 */
export function previewOrigins(input: Pick<CompositionInput, 'media' | 'audio' | 'logo' | 'logoDark' | 'patterns' | 'fontCss'>): string[] {
  const urls = [
    ...Object.values(input.media).map((m) => m.src),
    input.logo,
    input.logoDark,
    ...(input.patterns ?? []).map((p) => p.src),
    input.audio?.music?.url,
    ...(input.audio?.voice ?? []).map((v) => v.url),
    ...(input.audio?.sfx ?? []).map((x) => x.url),
    ...[...input.fontCss.matchAll(/url\(\s*['"]?(https?:\/\/[^'")\s]+)/g)].map((m) => m[1]),
  ];
  const origins = new Set<string>();
  for (const url of urls) {
    if (!url || !/^https?:\/\//i.test(url)) continue;
    try {
      origins.add(new URL(url).origin);
    } catch {
      /* adresse illisible : ignorée */
    }
  }
  return [...origins];
}

function csp(mode: CompositionInput['mode'], origins: string[] = []): string {
  const remote = mode === 'preview' ? [' https:', ...origins.map((o) => ` ${o}`)].join('') : '';
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
    .map((s, i) => `<section id="${s.key}" class="clip scene" data-start="${s.start.toFixed(3)}" data-duration="${s.duration.toFixed(3)}" data-track-index="0" style="position:absolute;left:0;top:0;width:${input.width}px;height:${input.height}px;overflow:hidden">${fillScene(s.html, s, input.media, input.logo, input.logoDark)}</section>${scenePattern(input, s, i)}`)
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
  const preview = input.mode === 'preview';
  const scripts = `${input.scenes.map(sceneScript).join('\n')}
master.set({}, {}, ${input.durationSec.toFixed(3)});
window.__timelines = window.__timelines || {};
window.__timelines.film = master;`;
  return `<!doctype html>
<html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${csp(input.mode, preview ? previewOrigins(input) : [])}">
<style>html,body{margin:0;padding:0;background:${input.brand.colors.background};}#stage{position:relative;overflow:hidden;width:${out.width}px;height:${out.height}px}#comp{position:absolute;left:0;top:0;width:${input.width}px;height:${input.height}px;transform:scale(${scale});transform-origin:0 0}${preview ? 'html,body{width:100%;height:100%;overflow:hidden}#stage{position:absolute;left:0;top:0;transform-origin:0 0;opacity:0;cursor:pointer}' : ''}</style>
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
var master${preview ? '' : ' = gsap.timeline({ paused: true })'};
${catalog && input.logoSvg ? `window.__geLogoSvg = ${JSON.stringify(input.logoSvg).replace(/</g, '\\u003c')};` : ''}
${catalog ? `window.__gePalette = ${JSON.stringify({ primary: input.brand.colors.primary, secondary: input.brand.colors.secondary, accent: input.brand.colors.accent, ground: input.brand.colors.background, ink: input.brand.colors.text }).replace(/</g, '\\u003c')};` : ''}
</script>
${catalog ? `<script>${CATALOG_RUNTIME}</script>` : ''}
<script>
${preview ? `function __buildFilm() {\nmaster = gsap.timeline({ paused: true });\n${scripts}\n}\n__buildFilm();` : scripts}
</script>
${preview ? previewPlayer(input) : ''}
</body></html>`;
}

/** Un JSON posé dans un `<script>` : rien ne peut y fermer la balise. */
const scriptJson = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

/**
 * L'aperçu dans le navigateur : le lecteur que les éditeurs pilotent (`@idem/shared-video-editor`, résultat iVision) :
 *
 *   → parent  `ivision:ready` (durée, scènes, erreurs) · `ivision:loading` / `ivision:playable` (sons et médias en
 *             mémoire) · `ivision:time` (instant, lecture) · `ivision:errors`
 *             `ivision:picked {key, at, t, zone, roles, texts}` (réponse à un pointage)
 *   ← parent  `ivision:play` · `ivision:pause` · `ivision:seek {t}` · `ivision:focus {key}` · `ivision:edit {key, texts?, media?}`
 *             · `ivision:pick {x, y, w, h}` (zone pointée, fractions de l'iframe)
 *
 * La scène (taille de sortie, 1080 px et plus) est mise à l'échelle pour TENIR dans l'iframe, centrée — sans cela
 * l'aperçu n'en montrait que le coin haut-gauche. La mise à l'échelle n'est posée qu'APRÈS la mise à la taille des
 * textes du catalogue (mesurée sans transformation, comme au rendu). Une retouche de texte ou de photo recompose
 * les scènes depuis leurs modèles et rejoue les animations : la vidéo change sans être rechargée.
 */
function previewPlayer(input: CompositionInput): string {
  const out = input.output ?? { width: input.width, height: input.height };
  const audio = input.audio ?? { voice: [] };
  const tracks = [...(audio.music ? [{ url: audio.music.url, at: 0, offset: audio.music.startAt, gain: audio.music.gain }] : []), ...audio.voice.map((v) => ({ url: v.url, at: v.at, offset: 0, gain: 1 })), ...(audio.sfx ?? []).map((x) => ({ url: x.url, at: x.at, offset: 0, gain: x.gain }))];
  const scenes = input.scenes.map((s) => ({ key: s.key, start: s.start, duration: s.duration, html: s.html, texts: s.texts }));
  const data = { width: out.width, height: out.height, duration: input.durationSec, tracks, scenes, media: Object.fromEntries(Object.entries(input.media).map(([k, m]) => [k, m.src])), logo: input.logo ?? '', logoDark: input.logoDark ?? '' };
  return `<script>
(function () {
  var D = ${scriptJson(data)};
  var stage = document.getElementById('stage'), fx = document.getElementById('ge-fx');
  var post = function (m) { try { window.parent.postMessage(m, '*'); } catch (e) {} };
  var END = Math.max(0, D.duration - 0.001);
  var playing = false, lastPost = 0, timers = [], building = null;

  // ── La scène tient dans l'iframe, centrée ──
  function fit() {
    var w = window.innerWidth || D.width, h = window.innerHeight || D.height;
    var s = Math.min(w / D.width, h / D.height) || 1;
    stage.style.transform = 'translate(' + ((w - D.width * s) / 2).toFixed(2) + 'px,' + ((h - D.height * s) / 2).toFixed(2) + 'px) scale(' + s.toFixed(5) + ')';
  }
  window.addEventListener('resize', fit);

  // ── La scène du moment (au rendu, HyperFrames s'en charge) ──
  var sections = Array.prototype.slice.call(document.querySelectorAll('section.scene'));
  function show(t) {
    var changed = false;
    sections.forEach(function (s) {
      var a = parseFloat(s.dataset.start), d = parseFloat(s.dataset.duration), vis = t >= a && t < a + d ? 'visible' : 'hidden';
      if (s.style.visibility !== vis) changed = true;
      s.style.visibility = vis;
    });
    if (changed) syncClips(t);
  }
  // ── Les CLIPS de la scène du moment, calés sur la timeline (au rendu, HyperFrames les cale image par image) ──
  // Muets comme au rendu ; un clip plus court que sa scène boucle.
  function syncClips(t) {
    sections.forEach(function (s) {
      var a = parseFloat(s.dataset.start), d = parseFloat(s.dataset.duration), on = t >= a && t < a + d;
      Array.prototype.forEach.call(s.querySelectorAll('video'), function (v) {
        v.muted = true;
        v.loop = true;
        if (!on) { if (!v.paused) v.pause(); return; }
        var len = isFinite(v.duration) && v.duration > 0 ? v.duration : 0, want = len ? (t - a) % len : t - a;
        if (Math.abs((v.currentTime || 0) - want) > 0.3) { try { v.currentTime = want; } catch (e) {} }
        if (playing) { if (v.paused) v.play().catch(function () {}); }
        else if (!v.paused) v.pause();
      });
    });
  }
  function film() { return window.__timelines.film; }
  function now() { return film().time(); }
  function report(force) {
    var stamp = Date.now();
    if (!force && stamp - lastPost < 60) return;
    lastPost = stamp;
    post({ type: 'ivision:time', t: Math.round(now() * 1000) / 1000, playing: playing });
  }
  function errors() { return (window.__sceneErrors || []).map(function (e) { return { key: e.key, stage: 'runtime', message: e.message }; }); }
  function wire() {
    var tl = film();
    tl.eventCallback('onUpdate', function () { show(this.time()); report(false); });
    tl.eventCallback('onComplete', function () { playing = false; stopAudio(); report(true); });
  }

  // ── Le son, calé sur la timeline ──
  var els = D.tracks.map(function (t) { var a = new Audio(t.url); a.preload = 'auto'; a.volume = Math.min(1, t.gain); return { a: a, t: t }; });
  function stopAudio() { timers.forEach(clearTimeout); timers = []; els.forEach(function (e) { e.a.pause(); }); }
  function startAudio(t) {
    stopAudio();
    els.forEach(function (e) {
      var go = function (from) { try { e.a.currentTime = e.t.offset + from; } catch (x) {} e.a.play().catch(function () {}); };
      if (e.t.at <= t) { var len = e.a.duration || Infinity; if (t - e.t.at < len) go(t - e.t.at); }
      else timers.push(setTimeout(function () { go(0); }, (e.t.at - t) * 1000));
    });
  }

  function play() {
    if (playing || building) return;
    if (now() >= END) seekTo(0);
    playing = true;
    startAudio(now());
    film().play();
    syncClips(now());
    report(true);
  }
  function pause() {
    playing = false;
    film().pause();
    stopAudio();
    syncClips(now());
    report(true);
  }
  function seekTo(t) {
    var was = playing;
    if (was) pause();
    var at = Math.max(0, Math.min(END, Number(t) || 0));
    film().pause(at === 0 ? 0.001 : at);
    show(at === 0 ? 0.001 : at);
    syncClips(at === 0 ? 0.001 : at);
    report(true);
    if (was) play();
  }
  function focusAt(key) {
    for (var i = 0; i < D.scenes.length; i++) if (D.scenes[i].key === key) return D.scenes[i].start + Math.min(D.scenes[i].duration * 0.6, 1.4);
    return null;
  }

  // ── Une retouche : les scènes recomposées depuis leurs modèles, les animations rejouées ──
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function fill(sc) {
    return sc.html.replace(/\\{\\{\\s*(text|media)\\.([\\w-]+)\\s*\\}\\}|\\{\\{\\s*(logo|logoDark)\\s*\\}\\}/g, function (_m, kind, key, which) {
      if (!kind) { var src = which === 'logoDark' ? D.logoDark || D.logo : D.logo; return src ? esc(src) : ''; }
      if (kind === 'text') return esc(sc.texts[key] == null ? '' : sc.texts[key]);
      return D.media[key] ? esc(D.media[key]) : '';
    });
  }
  function settled(fn) { (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(function () { setTimeout(fn, 0); }); }
  function rebuild(at) {
    var was = playing;
    if (was) pause();
    building = true;
    film().kill();
    stage.style.opacity = '0';
    stage.style.transform = 'none';
    D.scenes.forEach(function (sc) { var el = document.getElementById(sc.key); if (el) el.innerHTML = fill(sc); });
    if (fx) fx.innerHTML = '';
    window.__sceneErrors = [];
    if (window.__ge) window.__ge.fitIssues.length = 0;
    window.__buildFilm();
    wire();
    settled(function () {
      fit();
      stage.style.opacity = '1';
      building = null;
      seekTo(at);
      post({ type: 'ivision:errors', errors: errors() });
    });
  }
  function edit(msg) {
    var sc = null;
    for (var i = 0; i < D.scenes.length; i++) if (D.scenes[i].key === msg.key) sc = D.scenes[i];
    if (!sc) return;
    if (msg.texts && typeof msg.texts === 'object') for (var k in msg.texts) sc.texts[k] = String(msg.texts[k]);
    if (Array.isArray(msg.media)) msg.media.forEach(function (m) { if (m && m.id && /^https?:\\/\\//.test(String(m.url))) D.media[m.id] = String(m.url); });
    var at = msg.focus === false ? now() : focusAt(sc.key);
    rebuild(at == null ? now() : at);
  }

  // ── Une zone POINTÉE (éditeur) : la scène du moment et les éléments visibles sous la zone, relevés ici ──
  // La zone arrive en fractions de l'iframe ; elle repart en fractions du cadre de la vidéo (bandes autour retirées).
  function pick(m) {
    if (building) return;
    if (playing) pause();
    var t = now(), sc = null;
    for (var i = 0; i < D.scenes.length; i++) if (t >= D.scenes[i].start && t < D.scenes[i].start + D.scenes[i].duration) sc = D.scenes[i];
    if (!sc) sc = D.scenes[D.scenes.length - 1];
    var sec = sc && document.getElementById(sc.key);
    if (!sec) return;
    var W = window.innerWidth || 1, H = window.innerHeight || 1, f = stage.getBoundingClientRect();
    var zx = Number(m.x) * W, zy = Number(m.y) * H, zw = Math.max(2, Number(m.w) * W), zh = Math.max(2, Number(m.h) * H);
    var clamp = function (n) { return Math.max(0, Math.min(1, n)); };
    var zone = { x: clamp((zx - f.left) / f.width), y: clamp((zy - f.top) / f.height), w: 0, h: 0 };
    zone.w = clamp((zx + zw - f.left) / f.width) - zone.x;
    zone.h = clamp((zy + zh - f.top) / f.height) - zone.y;
    var hits = [], ground = false;
    Array.prototype.forEach.call(sec.querySelectorAll('[data-v]'), function (el) {
      if (el.getAttribute('data-v') === 'bg') { ground = true; return; }
      var r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      var cs = window.getComputedStyle(el);
      if (cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05) return;
      var ox = Math.max(0, Math.min(r.right, zx + zw) - Math.max(r.left, zx)), oy = Math.max(0, Math.min(r.bottom, zy + zh) - Math.max(r.top, zy));
      var share = (ox * oy) / Math.min(r.width * r.height, zw * zh);
      if (share > 0.12) hits.push({ role: el.getAttribute('data-v'), share: share, text: el.getAttribute('data-v') === 'media' ? '' : String(el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 80) });
    });
    hits.sort(function (a, b) { return b.share - a.share; });
    var roles = [], texts = [];
    hits.forEach(function (h) { if (roles.indexOf(h.role) < 0 && roles.length < 6) roles.push(h.role); if (h.text && texts.indexOf(h.text) < 0 && texts.length < 4) texts.push(h.text); });
    if (!roles.length && ground) roles.push('bg');
    var r3 = function (n) { return Math.round(n * 1000) / 1000; };
    post({ type: 'ivision:picked', key: sc.key, at: Math.round((t - sc.start) * 100) / 100, t: r3(t), zone: { x: r3(zone.x), y: r3(zone.y), w: r3(zone.w), h: r3(zone.h) }, roles: roles, texts: texts });
  }

  window.addEventListener('message', function (event) {
    if (event.source !== window.parent) return;
    var m = event.data;
    if (!m || typeof m !== 'object') return;
    if (m.type === 'ivision:play') { if (building) return; play(); }
    else if (m.type === 'ivision:pause') { if (!building) pause(); }
    else if (m.type === 'ivision:seek') { if (!building) seekTo(m.t); }
    else if (m.type === 'ivision:focus') { var t = focusAt(m.key); if (t != null && !building) seekTo(t); }
    else if (m.type === 'ivision:edit') edit(m);
    else if (m.type === 'ivision:pick') pick(m);
  });
  stage.addEventListener('click', function () { if (building) return; playing ? pause() : play(); });

  // ── Sons et médias en mémoire avant de proposer la lecture (une coupure en pleine vidéo serait pire) ──
  function preload() {
    var waits = [];
    els.forEach(function (e) { waits.push({ el: e.a, ok: function () { return e.a.readyState >= 4; }, ev: 'canplaythrough', ms: 15000 }); });
    Array.prototype.forEach.call(document.querySelectorAll('#comp img'), function (img) { waits.push({ el: img, ok: function () { return img.complete; }, ev: 'load', ms: 20000 }); });
    Array.prototype.forEach.call(document.querySelectorAll('#comp video'), function (v) { v.preload = 'auto'; waits.push({ el: v, ok: function () { return v.readyState >= 3; }, ev: 'canplaythrough', ms: 20000 }); });
    var total = waits.length, loaded = 0;
    post({ type: 'ivision:loading', loaded: 0, total: total });
    if (!total) return post({ type: 'ivision:playable' });
    waits.forEach(function (w) {
      var done = false;
      var finish = function () { if (done) return; done = true; loaded++; post({ type: 'ivision:loading', loaded: loaded, total: total }); if (loaded === total) post({ type: 'ivision:playable' }); };
      if (w.ok()) return finish();
      setTimeout(finish, w.ms);
      w.el.addEventListener(w.ev, finish, { once: true });
      w.el.addEventListener('error', finish, { once: true });
    });
  }

  wire();
  settled(function () {
    fit();
    stage.style.opacity = '1';
    var first = D.scenes[0] ? Math.min(1.2, D.scenes[0].duration * 0.6) : 0.001;
    film().pause(first);
    show(first);
    post({ type: 'ivision:ready', duration: D.duration, scenes: D.scenes.map(function (s) { return { key: s.key, start: s.start, end: s.start + s.duration }; }), errors: errors() });
    report(true);
    preload();
  });
})();
</script>`;
}

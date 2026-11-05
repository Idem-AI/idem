/**
 * LE CONTRÔLE D'UNE SCÈNE HTML — avant tout rendu, par le code (aucun modèle).
 *
 * Il refuse ce qui casserait le rendu déterministe d'HyperFrames ou sortirait du cloisonnement : un script dans le
 * fragment, un appel réseau, un minuteur, le hasard ou l'horloge, un texte écrit en dur au lieu de sa clé, un média
 * inconnu. Chaque refus est dit en une phrase (anglais) renvoyée à l'auteur pour une correction bornée.
 */
import vm from 'vm';
import type { AnimationLib } from './composition';

export interface LintInput {
  html: string;
  script: string;
  animation: AnimationLib;
  /** Les clés de textes de la scène (toutes doivent être posées). */
  textKeys: string[];
  /** Les identifiants des médias de la scène. */
  mediaIds: string[];
}

const FORBIDDEN_JS: Array<[RegExp, string]> = [
  [/\b(fetch|XMLHttpRequest|WebSocket|EventSource|importScripts|sendBeacon)\b/, 'no network access in the animation script'],
  [/\bimport\s*\(|\brequire\s*\(/, 'no import or require in the animation script'],
  [/\beval\s*\(|\bnew\s+Function\b/, 'no eval or new Function'],
  [/\bDate\.now\b|\bnew\s+Date\b|\bperformance\.now\b/, 'no clock: animate with the timeline only (the render seeks frame by frame)'],
  [/\bMath\.random\b/, 'no Math.random: the render must be identical every time (use fixed values)'],
  [/\b(setTimeout|setInterval|requestAnimationFrame)\b/, 'no timers or requestAnimationFrame: put every motion on the timeline'],
  [/\b(document\.cookie|localStorage|sessionStorage|indexedDB|window\.open|location\s*[.=])/, 'no storage, navigation or window opening'],
  [/\b(document\.write|innerHTML\s*=|outerHTML\s*=|insertAdjacentHTML)\b/, 'do not write HTML from the script: the markup is in the HTML block'],
  [/\.(play|pause)\s*\(\s*\)/, 'do not play or pause media from the script: HyperFrames controls media timing'],
];

export function lintScene(input: LintInput): string[] {
  const errors: string[] = [];
  const html = input.html || '';
  const script = input.script || '';
  if (!html.trim()) errors.push('the HTML block is empty');
  if (/<script\b/i.test(html)) errors.push('no <script> in the HTML block: the animation goes in the js block');
  if (/\son[a-z]+\s*=/i.test(html)) errors.push('no inline event handlers (onclick, onload…) in the HTML');
  if (/<(iframe|object|embed|link|meta|base|form)\b/i.test(html)) errors.push('no iframe, object, embed, link, meta, base or form element');
  if (/(src|href|srcset|poster)\s*=\s*["']?\s*(https?:|\/\/)/i.test(html) || /url\(\s*["']?\s*(https?:|\/\/)/i.test(html)) errors.push('no external address: use {{media.<id>}} and {{logo}} for images and videos');
  if (/<style\b/i.test(html)) errors.push('no <style> block: style with Tailwind classes (arbitrary values like w-[37%] are allowed)');
  for (const k of input.textKeys) if (!new RegExp(`\\{\\{\\s*text\\.${k}\\s*\\}\\}`).test(html)) errors.push(`the text {{text.${k}}} is missing from the scene`);
  for (const m of html.matchAll(/\{\{\s*media\.([\w-]+)\s*\}\}/g)) if (!input.mediaIds.includes(m[1])) errors.push(`unknown media {{media.${m[1]}}} — use only: ${input.mediaIds.join(', ') || 'none'}`);
  // Un texte écrit en dur (hors clés) : des mots visibles en dehors d'une balise et d'une clé.
  const visible = html.replace(/<[^>]+>/g, ' ').replace(/\{\{[^}]+\}\}/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
  if (/[A-Za-zÀ-ÿ]{3,}/.test(visible)) errors.push(`words written in the HTML (« ${visible.slice(0, 60)} »): every visible word comes from a {{text.*}} key`);
  if (!script.trim()) errors.push('the js block is empty: the scene needs its animation');
  for (const [re, why] of FORBIDDEN_JS) if (re.test(script)) errors.push(why);
  if (input.animation === 'gsap' && !/\btl\s*\.\s*(to|from|fromTo|set|add|call)\s*\(/.test(script)) errors.push('the GSAP script must put its tweens on the scene timeline `tl` (tl.to, tl.from, tl.fromTo)');
  if (input.animation === 'anime' && (!/\bcreateTimeline\s*\(/.test(script) || !/\breturn\b/.test(script))) errors.push('the Anime.js script must create anime.createTimeline({ autoplay: false }) and return it');
  if (input.animation === 'anime' && /autoplay\s*:\s*true/.test(script)) errors.push('the Anime.js timeline must not autoplay (autoplay: false)');
  // La syntaxe : compilée (jamais exécutée) dans un contexte isolé.
  try {
    new vm.Script(`(function (tl, root, D, gsap, anime) {\n${script}\n})`);
  } catch (error) {
    errors.push(`the js block does not parse: ${String((error as Error).message).slice(0, 160)}`);
  }
  return [...new Set(errors)];
}

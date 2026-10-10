/**
 * LA PAGE DU MONTAGE — la vidéo montée, ses sous-titres et son habillage, dans une page HTML.
 *
 * Même contrat que le moteur des vidéos motion design (`window.__IDEM_VIDEO__`) : l'aperçu de
 * la retouche et le MP4 sortent de la MÊME page. Tout est fonction de t (aucune animation qui
 * dépend de l'horloge) : le rendu pose la vidéo image par image, capture, et ffmpeg remet le son.
 *
 *   aperçu  la vidéo joue nativement (avec sa voix), l'habillage suit son horloge ; pont
 *           `montage:*` vers la retouche (instant courant, saut à un mot) ;
 *   rendu   vidéo muette, positionnée à chaque image ; le son est mixé par ffmpeg.
 */
import { contrastRatio } from '../design/color';
import { frameSpec } from '../video/video.composer';
import { inlineFontLinks } from '../video/video.fonts';
import { iconSvg } from '../video/video.icons';
import type { VideoTheme } from '../video/video.theme';
import type { MontageElement, MontageVideo } from './montage.model';
import { MONTAGE_PAGE_SCRIPT, MONTAGE_PAGE_STYLE } from './montage.page';
import { elementWindows, TimedWord } from './montage.timeline';

const cssFamily = (f: string) => `'${String(f || 'Inter').replace(/'/g, '')}', system-ui, sans-serif`;

/** Encre lisible sur un fond : blanc ou quasi-noir. */
const ink = (bg: string) => (contrastRatio('#ffffff', bg) >= contrastRatio('#111418', bg) ? '#ffffff' : '#111418');
/** La couleur de marque la plus lisible sur `bg`, sinon l'encre neutre. */
const brandInk = (bg: string, candidates: string[]) => candidates.find((c) => c && contrastRatio(c, bg) >= 3) || ink(bg);

/** Les groupes de mots des sous-titres, selon le style. */
export function captionChunks(words: { text: string; t: TimedWord }[], style: MontageVideo['captions']['style']): { s: number; e: number; w: number[] }[] {
  if (style === 'none') return [];
  const maxWords = style === 'pop' ? 3 : style === 'karaoke' ? 6 : 8;
  const maxChars = style === 'pop' ? 18 : style === 'karaoke' ? 34 : 44;
  const out: { s: number; e: number; w: number[] }[] = [];
  let cur: number[] = [];
  let chars = 0;
  const flush = () => {
    if (cur.length) out.push({ s: words[cur[0]].t!.start, e: words[cur[cur.length - 1]].t!.end, w: cur });
    cur = [];
    chars = 0;
  };
  words.forEach((w, i) => {
    if (!w.t) return;
    const prev = cur.length ? words[cur[cur.length - 1]].t! : null;
    if (prev && (w.t.start - prev.end > 0.45 || cur.length >= maxWords || chars + w.text.length > maxChars)) flush();
    cur.push(i);
    chars += w.text.length + 1;
    if (/[.!?…,;:]$/.test(w.text) && cur.length >= 2) flush();
  });
  flush();
  return out;
}

/** Les instants d'apparition des points d'une liste : chaque point quand son premier mot est dit. */
function itemTimes(el: MontageElement, words: { text: string; t: TimedWord }[], tin: number, tout: number): number[] {
  const items = el.items || [];
  const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}]+/gu, '');
  const times: number[] = [];
  let cursor = el.from;
  items.forEach((item, k) => {
    const first = (item.match(/[\p{L}\p{N}]{3,}/gu) || [item])[0];
    let found: number | null = null;
    for (let i = cursor; i <= Math.min(words.length - 1, el.to + 2); i++) {
      if (words[i].t && fold(words[i].text) === fold(first)) {
        found = words[i].t!.start;
        cursor = i + 1;
        break;
      }
    }
    const even = tin + ((tout - tin - 0.8) * k) / Math.max(1, items.length);
    times.push(Math.max(tin, Math.min(tout - 0.6, found ?? even)));
  });
  for (let k = 1; k < times.length; k++) times[k] = Math.max(times[k], times[k - 1] + 0.25);
  return times;
}

export interface ComposeMontageOptions {
  montage: MontageVideo;
  /** Les mots dans le temps de la vidéo montée (null : coupé). */
  timed: TimedWord[];
  theme: VideoTheme;
  mode: 'preview' | 'render';
  /** URL de la vidéo montée (aperçu : stockage ; rendu : stockage aussi, lu image par image). */
  videoUrl: string;
  musicUrl?: string;
}

export async function composeMontageHtml(opts: ComposeMontageOptions): Promise<{ html: string; width: number; height: number; fps: number; duration: number }> {
  const { montage, timed, theme } = opts;
  const spec = frameSpec(montage.format, montage.quality);
  const speechEnd = montage.edit?.durationSec || 0;
  const outro = montage.outro ? { ...montage.outro, tin: speechEnd } : null;
  const duration = Math.round((speechEnd + (outro?.durationSec || 0)) * 1000) / 1000;
  const words = montage.words.map((w, i) => ({ text: w.text, t: timed[i] }));
  const windows = elementWindows(montage.elements, timed, speechEnd);
  const byId = new Map(montage.elements.map((e) => [e.id, e]));
  const elements = windows.map((w) => {
    const el = byId.get(w.id)!;
    return {
      id: el.id,
      type: el.type,
      zone: w.zone,
      tin: w.tin,
      tout: w.tout,
      text: el.text,
      value: el.value,
      label: el.label,
      items: el.items,
      itemTimes: el.type === 'list' ? itemTimes(el, words, w.tin, w.tout) : undefined,
      icon: el.icon ? iconSvg('lucide', el.icon) || undefined : undefined,
      image: el.type === 'broll' ? el.image : undefined,
      mode: el.mode,
    };
  });
  const p = theme.palette;
  const accentInk = ink(p.accent);
  const data = {
    mode: opts.mode,
    width: spec.width,
    height: spec.height,
    fps: spec.fps,
    duration,
    speechEnd,
    video: opts.videoUrl,
    poster: montage.edit?.posterUrl,
    music: opts.mode === 'preview' && opts.musicUrl ? { url: opts.musicUrl, startAt: montage.music?.startAt || 0 } : undefined,
    captions: { style: montage.captions.style, chunks: captionChunks(words, montage.captions.style) },
    words: words.map((w) => ({ x: w.text, s: w.t?.start ?? -1, e: w.t?.end ?? -1 })),
    // Les débuts des passages gardés : la caméra alterne deux cadrages pour masquer les coupes.
    cuts: montage.cuts.ranges.map((r) => r.at).filter((at) => at > 0.05),
    elements,
    outro,
    brandName: theme.brandName,
    logo: theme.logo.onLight || theme.logo.icon || theme.logo.onDark || '',
    colors: {
      primary: p.primary,
      secondary: p.secondary,
      accent: p.accent,
      background: p.background,
      text: p.text,
      onPrimary: ink(p.primary),
      onAccent: accentInk,
      // Sur fond clair, le titre prend la couleur de marque qui se lit.
      brandOnLight: brandInk(p.background, [p.primary, p.secondary, p.text]),
    },
    landscape: spec.width > spec.height,
    square: spec.width === spec.height,
  };
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  const allText = [theme.brandName, ...montage.words.map((w) => w.text), ...elements.flatMap((e) => [e.text, e.value, e.label, ...(e.items || [])]), outro?.text, outro?.detail].filter(Boolean).join(' ');
  const fonts = opts.mode === 'render' ? await inlineFontLinks(theme.fonts.links, allText) : theme.fonts.links;
  const html = `<!doctype html>
<html lang="${montage.language || 'fr'}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
${fonts}
<style>
:root{--f-display:${cssFamily(theme.fonts.display)};--f-body:${cssFamily(theme.fonts.body)};--w:${spec.width}px;--h:${spec.height}px;--u:${Math.min(spec.width, spec.height) / 100}px}
${opts.mode === 'render' ? `html,body{width:${spec.width}px;height:${spec.height}px}` : ''}
${MONTAGE_PAGE_STYLE}
</style>
</head><body>
<script>window.__MONTAGE__=${json};</script>
<script>${MONTAGE_PAGE_SCRIPT}</script>
</body></html>`;
  return { html, width: spec.width, height: spec.height, fps: spec.fps, duration };
}

/**
 * LA PAGE D'APERÇU — autonome, jouée dans un iframe isolé (`sandbox="allow-scripts"`) par l'éditeur.
 *
 * Le même paquet de scènes que le rendu, avec le lecteur temps réel. Une politique de sécurité
 * stricte coupe toute requête sortante du code des scènes (`connect-src 'none'`) ; les images sont
 * embarquées (data URI) : `Img` de Motion Canvas les charge en CORS, ce que le stockage ne garantit pas.
 */
import sharp from 'sharp';
import logger from '../../runtime/logger';
import type { FilmAudio, FilmData } from '../../../motion/runtime/film-data';
import { fetchMedia } from './runner';

const json = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

const CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  'img-src data: blob: https:',
  'media-src data: blob: https:',
  'font-src data:',
  "connect-src 'none'",
].join('; ');

const inlined = new Map<string, Promise<string>>();

/** Une image distante, réduite (1600 px au plus) et embarquée. */
function inlineImage(url: string): Promise<string> {
  let job = inlined.get(url);
  if (!job) {
    job = (async () => {
      const file = await fetchMedia(url);
      if (file.mimeType === 'image/svg+xml') return `data:image/svg+xml;base64,${file.buffer.toString('base64')}`;
      const img = sharp(file.buffer, { failOn: 'none' }).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true });
      const meta = await sharp(file.buffer, { failOn: 'none' }).metadata();
      const out = meta.hasAlpha ? await img.png({ compressionLevel: 8 }).toBuffer() : await img.jpeg({ quality: 84 }).toBuffer();
      return `data:image/${meta.hasAlpha ? 'png' : 'jpeg'};base64,${out.toString('base64')}`;
    })();
    inlined.set(url, job);
    job.catch(() => inlined.delete(url));
    if (inlined.size > 120) inlined.delete(inlined.keys().next().value as string);
  }
  return job;
}

async function inlineFilmImages(data: FilmData): Promise<FilmData> {
  const swap = async (url?: string) => {
    if (!url || !/^(https?:|file:)/.test(url)) return url;
    try {
      return await inlineImage(url);
    } catch (error) {
      logger.warn('video.preview.image_unavailable', { url: url.slice(0, 160), error: (error as Error)?.message });
      return url;
    }
  };
  const scenes = await Promise.all(data.scenes.map(async (s) => ({ ...s, media: await Promise.all(s.media.map(async (m) => (m.kind === 'image' ? { ...m, url: (await swap(m.url)) || m.url } : m))) })));
  const logo = data.brand.logo ? { ...data.brand.logo, light: await swap(data.brand.logo.light), dark: await swap(data.brand.logo.dark) } : undefined;
  return { ...data, scenes, brand: { ...data.brand, ...(logo ? { logo } : {}) } };
}

export async function previewPageHtml(input: { data: FilmData; audio: FilmAudio; bundle: string; fontCss: string }): Promise<string> {
  const data = await inlineFilmImages(input.data);
  return `<!doctype html><html lang="${data.lang}"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${CSP}"><meta name="viewport" content="width=device-width,initial-scale=1">${input.fontCss}
<style>html,body{margin:0;height:100%;overflow:hidden;background:#ebe8e2}#stage{position:fixed;inset:0;display:flex;align-items:center;justify-content:center}#stage canvas{display:block;cursor:pointer}</style></head>
<body><div id="stage"></div>
<script>window.__IDEM_FILM__=${json(data)};window.__IDEM_AUDIO__=${json(input.audio)};</script>
<script>${input.bundle.replace(/<\/script/gi, '<\\/script')}</script>
</body></html>`;
}

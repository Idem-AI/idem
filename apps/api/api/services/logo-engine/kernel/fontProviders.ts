/**
 * Les fournisseurs de polices du moteur.
 *
 *   idemFontProvider   le chargeur de polices de l'API (Google Fonts, Fontshare, polices
 *                      importées par l'utilisateur ; cache Redis) — celui de la production
 *   diskFontProvider   Google Fonts + cache sur disque, sans Redis — pour les contrôles et les
 *                      scripts, qui ne doivent pas dépendre de l'infrastructure
 *   fileFontProvider   un fichier local imposé — contrôles hors ligne
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import * as opentype from 'opentype.js';
import type { EngineFont, FontProvider } from './typography';

/** La production : le chargeur de polices de la charte (import paresseux, il tire Redis et axios). */
export const idemFontProvider: FontProvider = {
  async load(family, weight, cssUrl) {
    const { fontLoader } = await import('../../BandIdentity/lockup/fontLoader.service');
    return fontLoader.load(family, weight, cssUrl);
  },
};

function toEngineFont(buffer: Buffer, family: string, weight: number): EngineFont {
  const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
  const font = opentype.parse(ab);
  let capHeightUnits = font.tables?.os2?.sCapHeight;
  if (!capHeightUnits || capHeightUnits <= 0) {
    try {
      capHeightUnits = Math.abs(font.getPath('H', 0, 0, font.unitsPerEm).getBoundingBox().y1);
    } catch {
      capHeightUnits = 0;
    }
  }
  return { family, weight, font, unitsPerEm: font.unitsPerEm || 1000, capHeightUnits: capHeightUnits || font.unitsPerEm * 0.7 };
}

/** Un fichier de police local, quelles que soient la famille et la graisse demandées. */
export function fileFontProvider(file: string): FontProvider {
  let cached: EngineFont | null = null;
  return {
    async load(family, weight) {
      if (!cached) cached = toEngineFont(fs.readFileSync(file), family, weight);
      return cached;
    },
  };
}

const NEUTRAL_UA = 'idem-brand-pipeline/1.0';

/** Google Fonts (TTF brut grâce à l'UA neutre) avec cache sur disque. Les échecs rendent `null`. */
export function diskFontProvider(cacheDir = path.join(os.tmpdir(), 'idem-logo-fonts')): FontProvider {
  const memory = new Map<string, EngineFont | null>();
  return {
    async load(family, weight) {
      const key = `${family.toLowerCase().replace(/\s+/g, '-')}-${weight}`;
      if (memory.has(key)) return memory.get(key)!;
      fs.mkdirSync(cacheDir, { recursive: true });
      const file = path.join(cacheDir, `${key}.ttf`);
      try {
        if (!fs.existsSync(file)) {
          const enc = encodeURIComponent(family).replace(/%20/g, '+');
          let url: string | null = null;
          for (const w of [weight, 700, 600, 500, 400]) {
            const res = await fetch(`https://fonts.googleapis.com/css2?family=${enc}:wght@${w}`, { headers: { 'User-Agent': NEUTRAL_UA } });
            if (!res.ok) continue;
            url = (await res.text()).match(/url\((https:[^)]+\.ttf)\)/i)?.[1] ?? null;
            if (url) break;
          }
          if (!url) throw new Error('police introuvable');
          fs.writeFileSync(file, Buffer.from(await (await fetch(url)).arrayBuffer()));
        }
        const font = toEngineFont(fs.readFileSync(file), family, weight);
        memory.set(key, font);
        return font;
      } catch {
        memory.set(key, null);
        return null;
      }
    },
  };
}

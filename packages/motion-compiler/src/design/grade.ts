/**
 * L'ÉTALONNAGE COMMUN DU FILM — une même lumière sur des médias venus de partout (photos importées, images générées,
 * clips, banque d'images) : la direction visuelle donne ses paramètres (`directions.ts#grade`).
 *
 * Les opérations (lift/gain, exposition, contraste, balance des blancs, virage partiel, saturation et vibrance) et le
 * format du `.cube` sont portés du constructeur de LUT paramétrique de HyperFrames (`packages/cli/src/media-use/lib/
 * cube-build.mjs`, HeyGen, Apache-2.0 — voir NOTICE). Ajouts IDEM : la teinte de la marque mêlée aux médias (harmonie),
 * le grain et le vignettage (appliqués par l'appelant, jamais au texte ni au logo).
 */
import type { GradeParams } from './types';

const clamp = (v: number, min: number, max: number) => (Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : 0);
const unit = (v: number) => clamp(v, 0, 1);
const luma = (c: number[]) => c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
const smoothstep = (a: number, b: number, v: number) => {
  const t = unit((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const p = (params: GradeParams, key: keyof GradeParams, min = -1, max = 1) => clamp(Number(params[key] ?? 0), min, max);

/** Un pixel (0..1) étalonné. */
export function gradeColor(color: [number, number, number], params: GradeParams, brand?: [number, number, number]): [number, number, number] {
  let c = [...color];
  // Lift / gain par zones de luminance.
  {
    const y = luma(c);
    const offset = p(params, 'blacks') * 0.08 + p(params, 'shadows') * 0.12 * (1 - smoothstep(0.18, 0.62, y)) + p(params, 'highlights') * 0.12 * smoothstep(0.38, 0.82, y) + p(params, 'whites') * 0.08;
    c = c.map((v) => unit(v + offset));
  }
  // Exposition.
  {
    const e = p(params, 'exposure', -2, 2);
    const gain = 2 ** e;
    const lift = Math.max(0, e) * 0.015;
    c = c.map((v) => unit(v * gain + lift));
  }
  // Contraste.
  {
    const k = 1 + p(params, 'contrast') * 1.2;
    c = c.map((v) => unit(0.5 + (v - 0.5) * k));
  }
  // Balance des blancs.
  {
    const t = p(params, 'temperature');
    const tint = p(params, 'tint');
    c = [unit(c[0] * (1 + t * 0.28 + tint * 0.08)), unit(c[1] * (1 - Math.abs(tint) * 0.1 - tint * 0.08)), unit(c[2] * (1 - t * 0.28 + tint * 0.08))];
  }
  // Virage partiel (ombres / hautes lumières).
  const split = params.splitTone;
  if (split && split.intensity > 0) {
    const y = luma(c);
    const b = unit(split.balance ?? 0.5);
    const sm = 1 - smoothstep(b - 0.25, b + 0.2, y);
    const hm = smoothstep(b - 0.2, b + 0.25, y);
    c = c.map((v, i) => unit(v + (split.shadows[i] ?? 0) * sm * split.intensity + (split.highlights[i] ?? 0) * hm * split.intensity));
  }
  // Saturation et vibrance.
  {
    const sat = p(params, 'saturation');
    const vib = p(params, 'vibrance');
    if (sat || vib) {
      const y = luma(c);
      const cur = Math.max(...c.map((v) => Math.abs(v - y)));
      const k = clamp(1 + sat + vib * (1 - unit(cur * 2)), 0, 2.5);
      c = c.map((v) => unit(y + (v - y) * k));
    }
  }
  // La teinte de la marque, mêlée en douceur (le patchwork de sources devient un film).
  const tint = clamp(Number(params.brandTint ?? 0), 0, 0.2);
  if (brand && tint > 0) {
    const y = luma(c);
    const by = luma(brand) || 1e-3;
    c = c.map((v, i) => unit(v * (1 - tint) + (brand[i] * (y / by)) * tint));
  }
  return c as [number, number, number];
}

/** Le fichier `.cube` (LUT 3D) d'un étalonnage, pour ffmpeg (`lut3d`) — les clips. */
export function buildCube(params: GradeParams, brand?: [number, number, number], size = 33): string {
  const lines = ['TITLE "IDEM film grade"', 'DOMAIN_MIN 0 0 0', 'DOMAIN_MAX 1 1 1', `LUT_3D_SIZE ${size}`];
  const d = size - 1;
  for (let b = 0; b < size; b++) for (let g = 0; g < size; g++) for (let r = 0; r < size; r++) {
    const o = gradeColor([r / d, g / d, b / d], params, brand);
    lines.push(`${o[0].toFixed(6)} ${o[1].toFixed(6)} ${o[2].toFixed(6)}`);
  }
  return `${lines.join('\n')}\n`;
}

/** Étalonne une image brute (RGB ou RGBA, 8 bits) EN PLACE, avec grain et vignettage ; graine fixe (même rendu partout). */
export function gradePixels(data: Uint8Array | Buffer, width: number, height: number, channels: number, params: GradeParams, brand?: [number, number, number]): void {
  const grain = clamp(Number(params.grain ?? 0), 0, 0.12);
  const vignette = clamp(Number(params.vignette ?? 0), 0, 0.4);
  // Une table 33³ (comme la LUT des clips) puis une interpolation trilinéaire : rapide et identique aux clips.
  const size = 33;
  const lut = new Float32Array(size * size * size * 3);
  const d = size - 1;
  for (let b = 0; b < size; b++) for (let g = 0; g < size; g++) for (let r = 0; r < size; r++) {
    const o = gradeColor([r / d, g / d, b / d], params, brand);
    const i = ((b * size + g) * size + r) * 3;
    lut[i] = o[0];
    lut[i + 1] = o[1];
    lut[i + 2] = o[2];
  }
  const at = (r: number, g: number, b: number, k: number) => lut[((b * size + g) * size + r) * 3 + k];
  let seed = 1234567;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) - 0.5;
  const cx = width / 2;
  const cy = height / 2;
  const maxR = Math.hypot(cx, cy);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const fr = (data[i] / 255) * d, fg = (data[i + 1] / 255) * d, fb = (data[i + 2] / 255) * d;
      const r0 = Math.floor(fr), g0 = Math.floor(fg), b0 = Math.floor(fb);
      const r1 = Math.min(d, r0 + 1), g1 = Math.min(d, g0 + 1), b1 = Math.min(d, b0 + 1);
      const tr = fr - r0, tg = fg - g0, tb = fb - b0;
      const v = Math.pow(Math.hypot(x - cx, y - cy) / maxR, 2.2) * vignette;
      const n = grain ? rand() * grain : 0;
      for (let k = 0; k < 3; k++) {
        const c00 = at(r0, g0, b0, k) * (1 - tr) + at(r1, g0, b0, k) * tr;
        const c10 = at(r0, g1, b0, k) * (1 - tr) + at(r1, g1, b0, k) * tr;
        const c01 = at(r0, g0, b1, k) * (1 - tr) + at(r1, g0, b1, k) * tr;
        const c11 = at(r0, g1, b1, k) * (1 - tr) + at(r1, g1, b1, k) * tr;
        const c0 = c00 * (1 - tg) + c10 * tg;
        const c1 = c01 * (1 - tg) + c11 * tg;
        const out = (c0 * (1 - tb) + c1 * tb) * (1 - v) + n;
        data[i + k] = Math.round(unit(out) * 255);
      }
    }
  }
}

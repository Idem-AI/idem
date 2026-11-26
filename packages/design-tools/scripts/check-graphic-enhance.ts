/**
 * `npm run check:graphic-enhance` — logos synthétiques dégradés (réduits, JPEG qualité 25) : l'amélioration doit être
 * plus proche du rendu de référence qu'un simple agrandissement Lanczos.
 */
import sharp from 'sharp';
import { enhanceGraphic } from '../src/graphic-enhance';

const LOGOS: Record<string, string> = {
  rond: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="#fff"/><circle cx="200" cy="200" r="170" fill="#0e7c66"/><path d="M110 250 L200 110 L290 250 Z" fill="#fff"/><rect x="170" y="250" width="60" height="50" fill="#f2b705"/></svg>`,
  texte: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 200"><rect width="600" height="200" fill="#fff"/><rect x="20" y="40" width="120" height="120" rx="24" fill="#c0392b"/><text x="165" y="135" font-family="Arial" font-weight="bold" font-size="96" fill="#1b2a49">Kora</text></svg>`,
  detoure: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><path d="M200 30 L370 330 L30 330 Z" fill="#6c3fc5"/><circle cx="200" cy="230" r="55" fill="#ffd166"/></svg>`,
};

let failed = 0;
const check = (ok: boolean, label: string) => {
  console.log(`${ok ? '✓' : '✗'} ${label}`);
  if (!ok) failed++;
};
const rgba = async (b: Buffer, w: number, h: number) => (await sharp(b).resize({ width: w, height: h, fit: 'fill', kernel: 'lanczos3' }).ensureAlpha().flatten({ background: '#fff' }).raw().toBuffer({ resolveWithObject: true }));
const mae = (a: Buffer, b: Buffer) => { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length; };

(async () => {
  for (const [name, svg] of Object.entries(LOGOS)) {
    for (const side of [96, 160]) {
      const ref = await sharp(Buffer.from(svg), { density: 300 }).png().toBuffer();
      const small = await sharp(Buffer.from(svg), { density: 300 }).resize({ width: side }).flatten({ background: '#fff' }).jpeg({ quality: 25 }).toBuffer();
      const r = await enhanceGraphic(small, { targetSide: 640 });
      if (!r) { check(false, `${name} ${side}px : aucune amélioration`); continue; }
      const w = r.width;
      const truth = await rgba(ref, w, r.height);
      const plain = await rgba(small, w, r.height);
      const got = await sharp(r.buffer).ensureAlpha().flatten({ background: '#fff' }).raw().toBuffer();
      const e0 = mae(truth.data, plain.data);
      const e1 = mae(truth.data, got);
      console.log(`   ${name} ${side}px → ${r.method}, ${r.width}×${r.height}, erreur ${e0.toFixed(2)} → ${e1.toFixed(2)}, ${r.ms} ms`);
      check(e1 < e0, `${name} ${side}px plus proche du rendu de référence`);
    }
  }
  // Déjà grand et propre : rien à faire.
  const big = await sharp(Buffer.from(LOGOS.rond), { density: 300 }).resize({ width: 1200 }).png().toBuffer();
  check((await enhanceGraphic(big)) === null, 'logo grand et propre laissé tel quel');
  // Transparence conservée.
  const small = await sharp(Buffer.from(LOGOS.detoure), { density: 300 }).resize({ width: 120 }).png().toBuffer();
  const t = await enhanceGraphic(small, { targetSide: 600 });
  check(!!t && (await sharp(t.buffer).stats()).channels[3].min < 10, 'fond transparent conservé');
  process.exit(failed ? 1 : 0);
})();

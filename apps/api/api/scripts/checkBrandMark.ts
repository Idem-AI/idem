/**
 * Contrôle de la marque d'en-tête (`services/SiteImport/brandMark.service.ts`) — sans réseau, sans stockage, sans modèle.
 *
 *   npm run check:brand-mark --            logos synthétiques : cadre vide rogné, logotype / icône, logo blanc
 *   npm run check:brand-mark -- <dossier>  en plus : chaque .svg du dossier, mesuré et rendu à 36 px (planche PNG)
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { cropSvg, measure } from '../services/SiteImport/brandMark.service';

let failed = 0;
const check = (label: string, ok: boolean, detail = '') => {
  if (!ok) failed += 1;
  console.log(`${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
};

// Un logotype (texte large) perdu au centre d'une toile carrée : le cas EKnumeriK.
const padded = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 170 170"><rect x="45" y="75" width="80" height="20" fill="#cb8b63"/></svg>`;
// Une icône (symbole presque carré) : le cas PromoWeb.
const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 246 241"><circle cx="123" cy="120" r="100" fill="#2164f3"/></svg>`;
// Un logo blanc sur transparent : dessiné pour un en-tête sombre.
const white = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 100"><rect x="10" y="30" width="280" height="40" fill="#ffffff"/></svg>`;
// Un logo sur son propre fond blanc opaque.
const opaque = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><rect width="400" height="200" fill="#ffffff"/><rect x="100" y="80" width="200" height="40" fill="#111111"/></svg>`;

(async () => {
  const p = await measure(Buffer.from(padded), true);
  check('cadre vide détecté', !!p && p.box.w < 0.55 && p.box.h < 0.2, JSON.stringify(p?.box));
  check('logotype reconnu (rapport ≥ 1,75)', !!p && p.aspect >= 1.75, String(p?.aspect.toFixed(2)));
  const cropped = p && cropSvg(padded, p.box);
  const vb = cropped?.match(/viewBox="([^"]+)"/)?.[1].split(' ').map(Number);
  check('viewBox recadré sur l’encre', !!vb && vb[2] < 90 && vb[3] < 25 && vb[0] > 40, vb?.join(' '));
  check('largeur/hauteur fixes retirées', !!cropped && !/\swidth="/.test(cropped.match(/<svg[^>]*>/)![0]));

  const i = await measure(Buffer.from(icon), true);
  check('icône reconnue (rapport < 1,75)', !!i && i.aspect < 1.75, String(i?.aspect.toFixed(2)));

  const w = await measure(Buffer.from(white), true);
  check('logo blanc sur transparent signalé', !!w?.light);
  check('logo coloré non signalé clair', !p?.light && !i?.light);

  const o = await measure(Buffer.from(opaque), true);
  check('fond opaque : encre lue par écart au fond', !!o && o.box.w < 0.6 && o.aspect > 4, JSON.stringify(o?.box));
  const oc = o && cropSvg(opaque, o.box);
  check('SVG sans viewBox recadré par width/height', !!oc && /viewBox="9\d/.test(oc), oc?.match(/viewBox="[^"]+"/)?.[0]);

  const dir = process.argv[2];
  if (dir) {
    const tiles: Buffer[] = [];
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.svg'))) {
      const svg = fs.readFileSync(path.join(dir, file), 'utf8');
      if (!svg.trim()) continue;
      const m = await measure(Buffer.from(svg), true);
      const c = m && cropSvg(svg, m.box);
      console.log(`  ${file} : ${m ? `${m.aspect >= 1.75 ? 'logotype' : 'icône'} ${m.aspect.toFixed(2)}${m.light ? ' clair' : ''}` : 'illisible'}`);
      if (c) tiles.push(await sharp(Buffer.from(c), { density: 144 }).resize({ height: 36 }).flatten({ background: '#ffffff' }).extend({ top: 12, bottom: 12, left: 12, right: 12, background: '#ffffff' }).png().toBuffer());
    }
    let y = 0;
    const layers = tiles.map((input) => {
      const layer = { input, left: 0, top: y };
      y += 64;
      return layer;
    });
    if (layers.length) {
      const out = path.join(dir, 'header-36px.png');
      await sharp({ create: { width: 480, height: y, channels: 3, background: '#eeeeee' } }).composite(layers).png().toFile(out);
      console.log(`  planche : ${out}`);
    }
  }

  console.log(failed ? `\n${failed} contrôle(s) en échec` : '\nTout est bon');
  process.exit(failed ? 1 : 0);
})();

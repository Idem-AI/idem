/**
 * `npm run check:logo-director` — la logique pure du directeur de logo (déclinaison, place, taille, ombre), sans navigateur.
 */
import { bestVariant, choose, inkTarget, plannedCandidates, shadowFor } from '../src/runtime/logo-director';
import type { PlanInput, Region, VariantInfo } from '../src/runtime/logo-director';

import { clipPathOf, maskOf, patternVerdict, planPattern, recolorSvg } from '../src/runtime/pattern-director';

let failures = 0;
const check = (label: string, ok: boolean, detail = '') => {
  if (!ok) failures++;
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
};

const dark: VariantInfo = { key: 'primary', url: 'p', lum: 0.03, aspect: 3.2, inkW: 0.96, inkH: 0.9 };
const light: VariantInfo = { key: 'onDark', url: 'd', lum: 0.95, aspect: 3.2, inkW: 0.96, inkH: 0.9 };
const calm = (mean: number, std = 0.03): Region => ({ mean, p10: mean * 0.9, p90: Math.min(1, mean * 1.1), std });

check('logo sombre sur photo sombre : la déclinaison claire est retenue', bestVariant([dark, light], calm(0.04), true).variant.key === 'onDark');
check('logo sur fond clair : le logo de marque est gardé', bestVariant([dark, light], calm(0.9), true).variant.key === 'primary');
check('contraste net et zone calme : aucune ombre', shadowFor(light, 12, calm(0.03), 90) === null);
const s = shadowFor(light, 3.1, calm(0.3, 0.2), 90);
check('contraste juste ou zone agitée : ombre très discrète', !!s && s.alpha <= 0.38 && s.blur <= 6 && s.color === 'dark', JSON.stringify(s));
const t = inkTarget({ w: 1080, h: 1080 }, 3);
check('taille : ≈ 9,5 % du petit côté, jamais plus de 42 % de la largeur', Math.abs(t.h - 102.6) < 1 && t.w <= 1080 * 0.42, `${Math.round(t.w)}×${Math.round(t.h)}`);
check('un logo carré est plus haut qu\'un logo allongé', inkTarget({ w: 1080, h: 1080 }, 1).h > inkTarget({ w: 1080, h: 1080 }, 3).h);

const input: PlanInput = { canvas: { w: 1080, h: 1080 }, safe: { top: 60, right: 60, bottom: 60, left: 60 }, obstacles: [{ x: 60, y: 780, w: 960, h: 240 }], current: { x: 700, y: 990, w: 220, h: 70 }, variants: [dark, light] };
const candidates = plannedCandidates(input);
check('aucun emplacement ne recouvre un texte', candidates.every((c) => !(c.box.y + c.box.h > 780 && c.box.y < 1020 && c.box.x + c.box.w > 60 && c.box.x < 1020)), candidates.map((c) => c.id).join(','));
check('le logo actuel est agrandi, jamais rapetissé', plannedCandidates({ ...input, obstacles: [], current: { x: 700, y: 900, w: 400, h: 140 } }).find((c) => c.id === 'current')!.box.w >= 400);
const picked = choose(input, candidates, candidates.map((c) => (c.id.startsWith('t') ? calm(0.05) : calm(0.5, 0.25))));
check('la zone calme et sombre l\'emporte, en déclinaison claire', !!picked && picked.where.startsWith('t') && picked.variant.key === 'onDark', picked?.reason);
const tile = (ink: string, ground: string, kind = 'dots') => ({ src: 'x.svg', tile: 48, ink, ground, kind });
const onLight = planPattern({ regionLum: 0.95, tiles: [tile('#1a2a4f', '#f8f9fb')], textShare: 0.2, seed: 'a' });
check('motif : zone claire → multiply, opacité entre 5 et 14 %', onLight?.blend === 'multiply' && onLight.opacity >= 0.05 && onLight.opacity <= 0.14, JSON.stringify(onLight));
const onDark = planPattern({ regionLum: 0.01, tiles: [tile('#f2a93b', '#10182c')], textShare: 0.2, seed: 'a' });
check('motif : zone sombre → screen', onDark?.blend === 'screen', JSON.stringify(onDark));
check('motif : encre invisible sur la zone (sombre sur sombre) → aucun motif', planPattern({ regionLum: 0.01, tiles: [tile('#10182c', '#0b1020')], textShare: 0.2, seed: 'a' }) === null);
check('motif : refusé seulement si le fond est couvert ou le texte étouffant', !patternVerdict({ exposed: 0.05, textShare: 0.1 }).place && !patternVerdict({ exposed: 1, textShare: 0.8 }).place && patternVerdict({ exposed: 0.36, textShare: 0.4 }).place);
check('motif : déterministe (aucun tirage)', JSON.stringify(planPattern({ regionLum: 0.9, tiles: [tile('#1a2a4f', '#f8f9fb')], textShare: 0.2, seed: 'a' })) === JSON.stringify(planPattern({ regionLum: 0.9, tiles: [tile('#1a2a4f', '#f8f9fb')], textShare: 0.2, seed: 'a' })));
const softer = planPattern({ regionLum: 0.9, tiles: [tile('#1a2a4f', '#f8f9fb')], textShare: 0.2, seed: 'a', strength: 0.75 });
check('motif : direction sobre → plus léger, jamais supprimé', !!softer && !!onLight && softer.opacity <= onLight.opacity, `${softer?.opacity} ≤ ${onLight?.opacity}`);
check('motif : découpé autour des images (clip-path evenodd)', clipPathOf({ w: 1000, h: 1000 }, [{ x: 0, y: 500, w: 1000, h: 500 }]).includes('evenodd') && maskOf({ x: 1, y: 0, reach: 0.95 }).includes('radial-gradient'));
const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="48" height="48" fill="#F8F9FB"/><circle r="4" fill="#1a2a4f"/></svg>';
const adapted = planPattern({ regionLum: 0.01, tiles: [{ ...tile('#1a2a4f', '#f8f9fb'), svg }], textShare: 0.2, seed: 'a', inks: ['#f2a93b'] });
check('motif : encre sombre sur fond sombre → adaptée à une couleur de la charte (jamais perdu)', !!adapted && adapted.blend === 'screen' && adapted.tile.ink === '#f2a93b' && adapted.tile.src.startsWith('data:image/svg+xml'), adapted ? `${adapted.blend} ${adapted.tile.ink} ${adapted.opacity}` : 'null');
check('motif : tuile adaptée = fond neutre noir (screen), encre recolorée', !!adapted && Buffer.from(adapted.tile.src.split(',')[1], 'base64').toString().includes('#000000') && !Buffer.from(adapted.tile.src.split(',')[1], 'base64').toString().includes('#1a2a4f'));
check('recolorSvg : casse et hex courts', recolorSvg('<a fill="#ABC"/><b fill="#aabbcc"/>', { '#aabbcc': '#000000' }) === '<a fill="#000000"/><b fill="#000000"/>');
console.log(failures ? `\n${failures} échec(s)` : '\nTout passe.');
process.exit(failures ? 1 : 0);

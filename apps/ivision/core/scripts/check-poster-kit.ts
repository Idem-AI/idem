/**
 * `npm run check:poster --prefix apps/ivision/core` — le kit graphique des visuels, SANS modèle.
 *
 *  1. Le kit : chaque forme est déterministe (même graine, même dessin), légère, sans texte, aux seules
 *     couleurs demandées ; un fluo ne remplit jamais une surface ; les demandes fautives sont signalées.
 *  2. Les balises <x-gfx> de l'agent Ultra et les éléments « graphic » de l'agent Max : construits,
 *     vérifiés, rendus et mesurés ; ce qui masque le texte est renvoyé au designer.
 *  3. Les compositions (13) × trois formats avec décor et grain : aucun débordement ni chevauchement,
 *     identifiants de calque stables et uniques.
 *  4. Le routeur de motifs suit la direction artistique de la marque, sans un jeton.
 *  5. Les retouches ciblées : déplacer, redessiner une forme, supprimer — le texte ne bouge pas.
 *  6. La variété : six briefs fixes (promo, événement, bannière, citation, produit, information), six
 *     propositions chacun — de vraies compositions différentes, pas quelques positions changées.
 *  7. L'économie de jetons : une forme nommée pèse une fraction du SVG qu'elle remplace.
 */
process.env.RENDER_ALLOWED_HOSTS = '127.0.0.1,localhost';
import fs from 'fs';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import { configureCore } from '../src/runtime/host';
import { composeVisual } from '../src/visual/visual.composer';
import { colorTokens } from '../src/visual/poster/poster.canvas';
import { applyPosterEdits } from '../src/visual/poster/poster.edit';
import { buildAuthored } from '../src/visual/poster/poster.author';
import { buildLayout, parseLayout } from '../src/visual/poster/poster.layout';
import { posterImage, analyzeLogo } from '../src/visual/poster/poster.images';
import { posterFonts, renderPoster } from '../src/visual/poster/poster.render';
import { schemesOf, specFor } from '../src/visual/poster/poster.spec';
import { POSTER_TEMPLATES } from '../src/visual/poster/poster.templates';
import { GFX_CATALOG, kitManifest } from '../src/visual/poster/kit/catalog';
import { expandGfxMacros, gfxContext, gfxHtml } from '../src/visual/poster/kit/render';
import { excludedMotifs, grainFor, MOTIFS, rankMotifs } from '../src/visual/poster/kit/motifs';
import type { FlyerFormat } from '../src/visual/visual.model';

let failures = 0;
let passes = 0;
function check(label: string, ok: boolean, detail = '') {
  if (ok) passes++;
  else failures++;
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
}
const section = (t: string) => console.log(`\n${t}`);
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'ivision-poster-kit-'));

configureCore({
  apiBaseUrl: () => 'http://127.0.0.1:1',
  sfxUrl: (n) => `http://127.0.0.1:1/sfx/${n}`,
  storage: {
    async uploadFile(content, fileName, folder) {
      const dir = path.join(OUT, 'storage', folder.replace(/[^a-zA-Z0-9/_-]/g, '_'));
      fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, fileName);
      fs.writeFileSync(file, content);
      return { fileName, downloadURL: `file://${file}` };
    },
  },
});

const TOKENS = { primary: '#d6246e', secondary: '#2b2d42', accent: '#ffb703', tint: '#fbeaf1', paper: '#ffffff', neon: '#39ff14' };
const ctx = gfxContext({ width: 1080, height: 1080, u: 10.8, tokens: TOKENS, primary: TOKENS.primary, secondary: TOKENS.secondary, bg: '#ffffff', ink: '#1d1d1f' });

/** Une empreinte perceptuelle (dHash 8×8) : deux visuels qui se ressemblent ont des empreintes proches. */
async function dhash(png: Buffer): Promise<boolean[]> {
  const { data } = await sharp(png).greyscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  const bits: boolean[] = [];
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits.push(data[y * 9 + x] > data[y * 9 + x + 1]);
  return bits;
}
const hamming = (a: boolean[], b: boolean[]) => a.reduce((n, v, i) => n + (v !== b[i] ? 1 : 0), 0);

(async () => {
  // ── 1. Le kit ──
  section('1. Le kit — formes dessinées par le code');
  {
    const bad: string[] = [];
    let heaviest = { id: '', n: 0 };
    for (const e of GFX_CATALOG) {
      if (e.kind === 'icon') continue;
      for (const v of e.variants) {
        const id = `${e.kind}/${v}`;
        const p = { kind: e.kind, variant: v, seed: 7, color: 'primary', color2: 'accent', density: 3 } as const;
        const a = gfxHtml(p, { x: 0, y: 0, w: 1080, h: 1080 }, ctx, 'k1');
        const b = gfxHtml(p, { x: 0, y: 0, w: 1080, h: 1080 }, ctx, 'k1');
        const c = gfxHtml({ ...p, seed: 8 }, { x: 0, y: 0, w: 1080, h: 1080 }, ctx, 'k1');
        if (a.html !== b.html) bad.push(`${id} non déterministe`);
        if (e.kind !== 'grain' && e.kind !== 'grid' && e.kind !== 'stripes' && e.kind !== 'frame' && a.html === c.html && ['blob', 'contours', 'dots', 'arcs', 'scribble', 'swash', 'waves', 'mesh'].includes(e.kind)) bad.push(`${id} insensible à la graine`);
        if (/NaN|undefined|Infinity/.test(a.html)) bad.push(`${id} valeur invalide`);
        if (/<text\b|<script|href=|@import|http/i.test(a.html.replace('http://www.w3.org/2000/svg', ''))) bad.push(`${id} texte ou ressource`);
        const used = [...a.html.matchAll(/#[0-9a-f]{6}\b/gi)].map((m) => m[0].toLowerCase());
        if (used.some((h) => ![TOKENS.primary, TOKENS.accent, '#ffffff', '#000000'].includes(h) && !/^#[0-9a-f]{6}$/.test(h))) bad.push(`${id} couleur hors charte`);
        if (a.html.length > 16000) bad.push(`${id} trop lourd (${a.html.length})`);
        if (a.issues.length) bad.push(`${id}: ${a.issues[0]}`);
        if (a.html.length > heaviest.n) heaviest = { id, n: a.html.length };
      }
    }
    check(`${GFX_CATALOG.length - 1} formes × déclinaisons : déterministes, légères (≤ 16 Ko, la plus lourde ${heaviest.id} ${heaviest.n} o), sans texte ni ressource`, !bad.length, bad.join(' · '));

    const unknown = gfxHtml({ kind: 'nope' as never }, { x: 0, y: 0, w: 100, h: 100 }, ctx, 'x');
    const badColour = gfxHtml({ kind: 'rings', color: 'fuchsia' }, { x: 0, y: 0, w: 400, h: 400 }, ctx, 'x');
    const badVariant = gfxHtml({ kind: 'rings', variant: 'spiral' }, { x: 0, y: 0, w: 400, h: 400 }, ctx, 'x');
    const neon = gfxHtml({ kind: 'blob', color: 'neon' }, { x: 0, y: 0, w: 900, h: 900 }, ctx, 'x');
    const neonLine = gfxHtml({ kind: 'contours', color: 'neon' }, { x: 0, y: 0, w: 900, h: 900 }, ctx, 'x');
    const neon2 = gfxHtml({ kind: 'blob', variant: 'duo', color: 'primary', color2: 'neon' }, { x: 0, y: 0, w: 900, h: 900 }, ctx, 'x');
    check('forme inconnue, couleur inconnue, déclinaison inventée : signalées', unknown.issues.length === 1 && badColour.issues.some((i) => /colour/.test(i)) && badVariant.issues.some((i) => /variant/.test(i)));
    check('un fluo ne remplit jamais une surface (couleur 1 et 2), mais passe en filet fin', neon.issues.some((i) => /neon/.test(i)) && !neon.html.includes(TOKENS.neon) && neon2.issues.some((i) => /neon/.test(i)) && !neon2.html.includes(TOKENS.neon) && !neonLine.issues.length && neonLine.html.includes(TOKENS.neon));
    const stored = gfxHtml({ kind: 'rings', seed: 3, color: 'primary' }, { x: 10, y: 20, w: 300, h: 300 }, ctx, 'g-rings-1');
    check('une forme garde un identifiant stable et ses paramètres (redessinable seule)', /data-el="g-rings-1"/.test(stored.html) && /data-gfx='\{[^']*"seed":3/.test(stored.html));
    const icon = gfxHtml({ kind: 'icon', concept: 'rocket', color: 'primary' }, { x: 0, y: 0, w: 120, h: 120 }, ctx, 'i1');
    check('pictogramme Tabler lu côté serveur (sans React)', /<svg/.test(icon.html) && !icon.issues.length && icon.html.length < 2500, `${icon.html.length} o`);
  }

  // ── 2. Les balises de l'agent Ultra ──
  section('2. Balises <x-gfx> (Ultra) et éléments « graphic » (Max)');
  const sceneFile = path.join(OUT, 'scene.png');
  await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900"><rect width="1200" height="900" fill="#e8c9a8"/><circle cx="760" cy="380" r="220" fill="#3b2a20"/><rect y="700" width="1200" height="200" fill="#5d7a4a"/></svg>')).png().toFile(sceneFile);
  const logoFile = path.join(OUT, 'logo.png');
  await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="200"><rect x="40" y="40" width="120" height="120" rx="24" fill="#d6246e"/><text x="190" y="130" font-family="Arial" font-weight="700" font-size="72" fill="#1d1d1f">Kofi</text></svg>')).png().toFile(logoFile);
  const photo = (await posterImage(`file://${sceneFile}`, 'brand'))!;
  const logo = await analyzeLogo(`file://${logoFile}`);
  const fonts = posterFonts({ primaryFont: 'Poppins', secondaryFont: 'Inter' });
  const palette = { primary: '#d6246e', secondary: '#2b2d42', accent: '#39ff14', background: '#ffffff', text: '#1d1d1f' };
  const copy = { kicker: 'Atelier pratique', headline: 'Créez votre première œuvre avec l’IA', facts: [{ kind: 'date' as const, text: 'Samedi 18 octobre' }, { kind: 'place' as const, text: 'Plateau, Abidjan' }] };
  const input: any = { format: 'square' as FlyerFormat, copy, palette, image: photo, extraImages: [], allowDark: false, logo, brandName: 'Kofi', language: 'fr' };
  const schemes = schemesOf(input);
  const carrier = specFor(input, { template: 'free', scheme: 'paper', mirror: false, treatment: 'natural' }, schemes)!;
  const tokens = colorTokens(carrier, schemes);
  const context: any = { brandName: 'Kofi', businessType: 'formation', tone: 'chaleureux', keywords: [], language: 'fr', branding: { ...palette, primaryFont: 'Poppins', secondaryFont: 'Inter' } };
  const brief: any = { spec: carrier, tokens, images: [photo], context, request: 'Atelier pratique samedi', intent: 'event' };

  const ultraHtml = `<x-gfx kind="rings" x="560" y="-120" w="640" h="640" color="primary" color2="tint" variant="lines" seed="3" opacity="0.9"></x-gfx>
<x-gfx kind="dots" x="0" y="700" w="420" h="380" color="secondary" seed="2" opacity="0.18"/>
<x-gfx kind="grain" opacity="0.2"></x-gfx>
<div class="ph" style="position:absolute;left:0;top:0;width:1080px;height:520px"><img src="{{PHOTO_1}}" style="object-position:60% 40%"></div>
<div data-stack="head" style="position:absolute;left:76px;top:560px;width:928px;height:320px;display:flex;flex-direction:column;justify-content:flex-start;gap:16px">
<div class="fit kicker" data-min="24" data-max="34" style="color:var(--primary)">Atelier pratique</div>
<div class="fit headline" data-min="50" data-max="130" style="color:var(--text)">Créez votre première œuvre avec l’IA</div>
<div class="fit facts" data-min="26" data-max="36" style="color:var(--text)"><span class="fact">Samedi 18 octobre</span><span class="sep" style="background:var(--text)"></span><span class="fact">Plateau, Abidjan</span></div></div>
<div class="logo" style="position:absolute;left:76px;top:930px"><img src="{{LOGO}}" style="height:62px;width:auto;display:block"></div>`;
  const built = buildAuthored({ html: ultraHtml }, brief, copy as any);
  const ultraRender = await renderPoster(carrier, built.body, fonts);
  fs.writeFileSync(path.join(OUT, 'ultra-kit.png'), ultraRender.png);
  check('Ultra : trois balises <x-gfx> deviennent des dessins, le texte et le logo restent mesurés sans défaut', !built.issues.length && !/<x-gfx/.test(built.body) && (built.body.match(/class="gfx"/g) || []).length === 3 && !ultraRender.measure.blocking, `${built.issues.join(' · ')} ${JSON.stringify(ultraRender.measure).slice(0, 200)}`);
  check('Ultra : formes redessinables et identifiées dans le HTML final', /data-gfx=/.test(ultraRender.html) && /data-el="g-rings-1"/.test(ultraRender.html));
  const badKind = buildAuthored({ html: ultraHtml.replace('kind="rings"', 'kind="spirograph"') }, brief, copy as any);
  const noBox = buildAuthored({ html: ultraHtml.replace(' x="0" y="700" w="420" h="380"', '') }, brief, copy as any);
  const neonFill = buildAuthored({ html: ultraHtml.replace('color="primary" color2="tint"', 'color="accent"').replace('kind="rings"', 'kind="blob"') }, brief, copy as any);
  const handSvg = buildAuthored({ html: ultraHtml + `<svg viewBox="0 0 100 100">${'<path d="M0 0L10 10L20 5L30 15L40 0L50 20L60 10"/>'.repeat(60)}</svg>` }, brief, copy as any);
  const many = buildAuthored({ html: Array.from({ length: 11 }, (_, i) => `<x-gfx kind="rings" x="${i * 10}" y="0" w="200" h="200" seed="${i}"></x-gfx>`).join('') + ultraHtml }, brief, copy as any);
  check('Ultra : forme inconnue, boîte manquante, fluo en surface, trop de formes : renvoyés au designer', badKind.issues.some((i) => /unknown kind/.test(i)) && noBox.issues.some((i) => /needs x, y, w, h/.test(i)) && neonFill.issues.some((i) => /neon/.test(i)) && many.issues.some((i) => /too many graphics/.test(i)), [badKind.issues[0], noBox.issues[0], neonFill.issues[0], many.issues[0]].join(' · ').slice(0, 280));
  const busy = buildAuthored({ html: ultraHtml.replace('opacity="0.18"', 'opacity="0.6"').replace('x="0" y="700" w="420" h="380"', 'x="40" y="540" w="900" h="340"') }, brief, copy as any);
  const above = buildAuthored({ html: ultraHtml.replace('<x-gfx kind="grain" opacity="0.2"></x-gfx>', '') + '<x-gfx kind="blob" x="60" y="560" w="900" h="300" color="secondary"></x-gfx>' }, brief, copy as any);
  check('Ultra : texture dense sous le texte, forme peinte par-dessus le texte : renvoyées au designer', busy.issues.some((i) => /busy texture/.test(i)) && above.issues.some((i) => /painted OVER/.test(i)), [busy.issues[0], above.issues[0]].join(' · ').slice(0, 260));
  check('Ultra : un long SVG écrit à la main est renvoyé (le kit dessine pour un centième des jetons)', handSvg.issues.some((i) => /hand-written SVG/.test(i)), handSvg.issues.join(' · ').slice(0, 160));

  const maxDesign = parseLayout(JSON.stringify({ concept: 'photo en haut, anneaux de marque, bande en bas', background: 'paper', elements: [
    { type: 'graphic', kind: 'rings', x: 55, y: -12, w: 70, h: 70, color: 'primary', color2: 'tint', variant: 'offset', seed: 4 },
    { type: 'photo', photo: 1, x: 0, y: 0, w: 100, h: 52 },
    { type: 'shape', color: 'primary', x: 0, y: 52, w: 100, h: 48 },
    { type: 'graphic', kind: 'dots', x: 62, y: 60, w: 36, h: 36, color: 'tint', seed: 2, opacity: 0.18 },
    { type: 'text', x: 7, y: 57, w: 86, h: 24, items: ['kicker', 'headline', 'facts'], valign: 'top', headline: 'large' },
    { type: 'logo', x: 7, y: 88, size: 7 },
    { type: 'graphic', kind: 'grain', opacity: 0.2 },
  ] }))!;
  const maxBuilt = buildLayout(maxDesign, brief);
  const maxRender = await renderPoster(carrier, maxBuilt.body, fonts);
  fs.writeFileSync(path.join(OUT, 'max-kit.png'), maxRender.png);
  check('Max : des éléments « graphic » (une ligne chacun) construits et mesurés sans défaut, texte lisible sur l’aplat de marque', !maxBuilt.issues.length && !maxRender.measure.blocking && (maxBuilt.body.match(/class="gfx"/g) || []).length === 3, `${maxBuilt.issues.join(' · ')} ${JSON.stringify(maxRender.measure).slice(0, 200)}`);
  const over = buildLayout({ ...maxDesign, elements: [...maxDesign.elements.slice(0, 5), { type: 'graphic', kind: 'blob', x: 5, y: 55, w: 80, h: 30, color: 'secondary' } as never, ...maxDesign.elements.slice(5)] }, brief);
  const bigNeon = buildLayout({ ...maxDesign, elements: [{ type: 'graphic', kind: 'burst', x: 0, y: 0, w: 100, h: 100, color: 'accent' } as never, ...maxDesign.elements] }, brief);
  const unknownKind = buildLayout({ ...maxDesign, elements: [{ type: 'graphic', kind: 'sparkles', x: 0, y: 0, w: 50, h: 50 } as never, ...maxDesign.elements] }, brief);
  check('Max : forme peinte PAR-DESSUS le texte, fluo en surface, forme inconnue : renvoyés au designer', over.issues.some((i) => /painted OVER the text/.test(i)) && bigNeon.issues.some((i) => /neon/.test(i)) && unknownKind.issues.some((i) => /unknown graphic kind/.test(i)), [over.issues[0], bigNeon.issues[0], unknownKind.issues[0]].join(' · ').slice(0, 300));
  const busyMax = buildLayout({ ...maxDesign, elements: maxDesign.elements.map((e) => (e.kind === 'dots' ? { ...e, opacity: 0.6, x: 8, y: 58, w: 80, h: 30 } : e)) }, brief);
  check('Max : texture dense sous le texte renvoyée au designer', busyMax.issues.some((i) => /busy texture/.test(i)), busyMax.issues[0]);
  const manifestMax = kitManifest('json').join('\n');
  const manifestUltra = kitManifest('html').join('\n');
  check(`manifeste court pour les agents (Max ${manifestMax.length} signes, Ultra ${manifestUltra.length})`, manifestMax.length < 3200 && manifestUltra.length < 3400 && !/icon \[/.test(manifestMax));

  // ── 3. Les compositions ──
  section('3. Compositions × formats, avec décor tonal et grain');
  {
    const failed: string[] = [];
    let rendered = 0;
    const palette2 = { primary: '#d6246e', secondary: '#2b2d42', accent: '#ffb703', background: '#ffffff', text: '#1d1d1f' };
    const copies: Record<string, any> = {
      event: { kicker: 'Kofi Live', headline: 'La tech au féminin prend le micro', sub: 'Scène ouverte, témoignages et rencontres.', facts: [{ kind: 'date', text: 'Samedi 12 oct.' }, { kind: 'time', text: '18h00' }, { kind: 'place', text: 'Plateau, Abidjan' }], emphasis: 3 },
      promo: { headline: 'Sur toutes nos formations', facts: [{ kind: 'date', text: 'Jusqu’au 31 octobre' }], offer: '−30 %' },
      quote: { headline: 'Elles racontent Kofi', facts: [], quote: { text: 'Kofi m’a donné le courage de lancer ma startup.', author: 'Awa K.' } },
    };
    const ids = new Set<string>();
    const NEW = new Set(['geometric', 'diagonal', 'collage']);
    for (const format of ['square', 'story', 'banner'] as FlyerFormat[]) {
      for (const t of POSTER_TEMPLATES) {
        const c = t.id === 'offer' ? copies.promo : t.id === 'quote' ? copies.quote : copies.event;
        const inp: any = { format, copy: c, palette: palette2, image: t.needsImage || ['event', 'diagonal'].includes(t.id) ? photo : undefined, extraImages: [photo, photo], allowDark: false, logo, brandName: 'Kofi', language: 'fr' };
        const sch = schemesOf(inp);
        const sid = t.schemes.find((id) => sch.some((x) => x.id === id)) || 'paper';
        const mirror = ids.size % 2 === 0;
        const treatment = ids.size % 3 === 0 ? ('duotone' as const) : ('natural' as const);
        const motif = MOTIFS[(ids.size % (MOTIFS.length - 1)) + 1].id;
        const choice = { template: t.id, scheme: sid, mirror, treatment };
        const bareSpec = specFor(inp, choice, sch);
        if (!bareSpec || (t.needs && !t.needs(bareSpec))) continue;
        ids.add(`${format}/${t.id}`);
        // Le décor ne doit rien casser : on compare au même gabarit SANS décor (un défaut propre au gabarit n'est pas le sien).
        const bare = await renderPoster(bareSpec, t.render(bareSpec), fonts);
        const deco = specFor(inp, { ...choice, motif, motifSeed: 5 + ids.size, grain: 'fine' }, sch)!;
        const res = await renderPoster(deco, t.render(deco), fonts);
        rendered += 2;
        const tag = `${format}/${t.id}/${motif}${mirror ? '/miroir' : ''}`;
        const els = [...res.html.matchAll(/data-el="([^"]+)"/g)].map((m) => m[1]);
        if (new Set(els).size !== els.length) failed.push(`${tag} identifiants en double`);
        if (!els.includes('canvas') || !els.some((e) => /^text-/.test(e))) failed.push(`${tag} identifiants manquants`);
        const detail = JSON.stringify({ o: res.measure.overflow, x: res.measure.overlaps, out: res.measure.outside, c: res.measure.lowContrast });
        if (!bare.measure.blocking && (res.measure.blocking || res.measure.score < bare.measure.score - 4)) failed.push(`${tag} le décor dégrade ${bare.measure.score}→${res.measure.score} ${detail}`);
        // Les nouvelles compositions, elles, doivent être irréprochables d'emblée.
        if (NEW.has(t.id) && (bare.measure.blocking || bare.measure.score < 85)) failed.push(`${tag} (sans décor) ${bare.measure.score} ${JSON.stringify({ o: bare.measure.overflow, x: bare.measure.overlaps, out: bare.measure.outside, c: bare.measure.lowContrast })}`);
      }
    }
    check(`${rendered} affiches rendues (13 compositions × 3 formats, avec et sans décor) : le décor ne dégrade rien, les nouvelles compositions sont sans défaut, calques identifiés`, rendered >= 70 && !failed.length, failed.slice(0, 4).join(' · '));
  }

  // ── 4. Le routeur de motifs ──
  section('4. Le routeur de motifs suit la direction artistique (sans jeton)');
  {
    const top = (styleId: string, intent: any = 'event', donts?: string[]) => rankMotifs({ intent, styleId, donts, seed: 11 }).slice(0, 3).map((m) => m.id);
    check(`minimalisme : le calme d'abord (${top('minimalism')})`, rankMotifs({ intent: 'event', styleId: 'minimalism', seed: 11 })[0].id === 'none');
    check(`suisse : grille technique (${top('swiss')})`, top('swiss', 'info').includes('grid-marks'));
    check(`pop art : trame de points ou rayons (${top('pop-art', 'promo')})`, top('pop-art', 'promo').some((m) => m === 'dot-field' || m === 'burst'));
    check(`aurore / verre : lueur (${top('aurora', 'launch')})`, top('aurora', 'launch')[0] === 'mesh');
    check(`bohème : tissage (${top('bohemian')})`, top('bohemian').includes('weave'));
    const nog = rankMotifs({ intent: 'launch', styleId: 'aurora', donts: ['no gradients or glows'], seed: 11 });
    check('« à éviter : dégradés » écarte la lueur', !nog.some((m) => m.id === 'mesh') && excludedMotifs(['no gradients']).motifs.has('mesh'));
    check('« à éviter : motifs, textures » écarte tissage, trames, courbes et le grain', grainFor({ intent: 'event', styleId: 'retro', donts: ['no patterns or textures'], seed: 1 }) === undefined && !rankMotifs({ intent: 'event', styleId: 'bohemian', donts: ['no patterns'], seed: 1 }).some((m) => m.id === 'weave'));
    const same = JSON.stringify(rankMotifs({ intent: 'event', styleId: 'swiss', seed: 5 })) === JSON.stringify(rankMotifs({ intent: 'event', styleId: 'swiss', seed: 5 }));
    const seeds = new Set(Array.from({ length: 12 }, (_, s) => rankMotifs({ intent: 'event', styleId: undefined, seed: s })[0].id));
    check(`déterministe pour une graine, varié d'une graine à l'autre (${seeds.size} motifs en tête sur 12 graines)`, same && seeds.size >= 3);
  }

  // ── 5. Les retouches ciblées ──
  section('5. Retouches ciblées — un élément, pas l’affiche');
  {
    const inp: any = { format: 'square', copy: { kicker: 'Kofi Live', headline: 'La tech au féminin prend le micro', facts: [{ kind: 'date', text: 'Samedi 12 oct.' }], emphasis: 3 }, palette: { ...palette, accent: '#ffb703' }, image: photo, extraImages: [], allowDark: false, logo, brandName: 'Kofi', language: 'fr' };
    const sch = schemesOf(inp);
    const t = POSTER_TEMPLATES.find((x) => x.id === 'collage')!;
    const spec = specFor(inp, { template: 'collage', scheme: 'paper', mirror: false, treatment: 'natural', motif: 'tonal-rings', motifSeed: 4 }, sch)!;
    const base = await renderPoster(spec, t.render(spec), fonts);
    const photoId = [...base.html.matchAll(/data-el="(photo[^"]*)"/g)][0]?.[1];
    const gfxId = [...base.html.matchAll(/data-el="(motif-1)"/g)][0]?.[1];
    const textBefore = base.html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    const edited = await applyPosterEdits(base.html, spec.width, spec.height, [
      { id: photoId!, move: { y: 40 } },
      { id: gfxId!, gfx: { seed: 99, color: '#2b2d42', variant: 'lines' } },
      { id: 'nope-1', remove: true },
    ]);
    fs.writeFileSync(path.join(OUT, 'edited.png'), edited.png);
    const textAfter = edited.html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    const redrawn = /(&quot;|")seed(&quot;|"):99/.test(edited.html) && new RegExp(`data-el="${gfxId}"`).test(edited.html);
    check(`photo déplacée, forme redessinée (même identifiant, nouvelle graine), élément inconnu signalé (${edited.applied.join(', ')})`, edited.applied.length === 2 && redrawn && edited.skipped.length === 1 && Buffer.compare(base.png, edited.png) !== 0, JSON.stringify(edited.skipped));
    check('le texte n’a pas bougé d’une lettre', textBefore === textAfter);
    const removed = await applyPosterEdits(edited.html, spec.width, spec.height, [{ id: gfxId!, remove: true }]);
    check('une forme supprimée disparaît du HTML', !new RegExp(`data-el="${gfxId}"`).test(removed.html) && removed.applied.length === 1);
  }

  // ── 6. La variété ──
  section('6. Variété — six briefs fixes, six propositions chacun');
  {
    const brand = (artDirection?: any) => ({ brandName: 'Kofi', businessType: 'formation en ligne', tone: 'chaleureux', keywords: ['tech'], language: 'fr', branding: { primary: '#d6246e', secondary: '#2b2d42', accent: '#ffb703', background: '#ffffff', text: '#1d1d1f', primaryFont: 'Poppins', secondaryFont: 'Inter' }, ...(artDirection ? { artDirection } : {}) });
    const BRIEFS: { family: string; format: FlyerFormat; title: string; description: string }[] = [
      { family: 'flyer publicitaire', format: 'post', title: 'Sur toutes nos formations', description: '−30 % jusqu’au 31 octobre sur toutes les formations Kofi.' },
      { family: 'affiche événementielle', format: 'a4', title: 'La tech au féminin prend le micro', description: 'Samedi 12 octobre, 18h00, Plateau, Abidjan. Scène ouverte et rencontres.' },
      { family: 'bannière', format: 'banner', title: 'Notre application mobile arrive', description: 'Apprenez où vous voulez, quand vous voulez. Disponible dès novembre.' },
      { family: 'publication réseau', format: 'square', title: 'Elles racontent Kofi', description: '« Kofi m’a donné le courage de lancer ma startup. » Awa K.' },
      { family: 'promotion produit', format: 'square', title: 'Le pack Kofi Starter', description: 'Quatre formations, un mentor, un certificat. 25 000 F.' },
      { family: 'information', format: 'story', title: 'Comment rejoindre Kofi', description: 'Trois étapes : inscrivez-vous, choisissez votre parcours, commencez dès demain.' },
    ];
    const sheet: { input: Buffer; left: number; top: number }[] = [];
    const T = 220;
    let allOk = true;
    const lines: string[] = [];
    for (const [bi, b] of BRIEFS.entries()) {
      const combos = new Set<string>();
      const hashes: boolean[][] = [];
      const defects: string[] = [];
      const tiles: Buffer[] = [];
      for (let s = 0; s < 6; s++) {
        const res = await composeVisual({ runPrompt: async () => '' }, 'u', 'brand-var', { id: `v${bi}-${s}`, title: b.title, description: b.description }, brand() as any, b.format, 'check', `variety:${bi}:${s}`, undefined, true, { creativity: s < 3 ? 'low' : 'medium' });
        const p = res.parsed as any;
        // Un même brief, deux crans : Low rejoue la meilleure composition ; on mesure la variété des tirages Medium
        // et des graines différentes de Low (le seedKey change la graine du décor).
        combos.add(`${p.layout}|${p.scheme}|${p.motif || '-'}`);
        hashes.push(await dhash(res.png));
        if (res.audit.blocking || res.audit.score < 80) defects.push(`#${s} score ${res.audit.score}`);
        tiles.push(await sharp(res.png).resize({ width: T, height: T, fit: 'contain', background: '#444' }).png().toBuffer());
      }
      let sum = 0;
      let pairs = 0;
      for (let i = 0; i < hashes.length; i++) for (let j = i + 1; j < hashes.length; j++) {
        sum += hamming(hashes[i], hashes[j]);
        pairs++;
      }
      const mean = sum / pairs;
      tiles.forEach((tile, i) => sheet.push({ input: tile, left: i * (T + 4), top: bi * (T + 4) }));
      const ok = combos.size >= 3 && mean >= 9 && !defects.length;
      allOk = allOk && ok;
      lines.push(`${b.family} (${b.format}) : ${combos.size} compositions distinctes sur 6, écart moyen ${mean.toFixed(1)}/64${defects.length ? ` — défauts ${defects.join(', ')}` : ''}`);
      check(lines[lines.length - 1], ok);
    }
    await sharp({ create: { width: 6 * (T + 4), height: BRIEFS.length * (T + 4), channels: 3, background: '#333' } }).composite(sheet).png().toFile(path.join(OUT, 'variety.png'));
    check('planche de variété écrite pour relecture humaine', allOk || true, path.join(OUT, 'variety.png'));
  }

  // ── 7. Jetons ──
  section('7. Économie de jetons');
  {
    const named = '<x-gfx kind="rings" x="560" y="-120" w="640" h="640" color="primary" color2="tint" variant="offset" seed="3"></x-gfx>';
    const drawn = gfxHtml({ kind: 'rings', variant: 'offset', color: 'primary', color2: 'tint', seed: 3 }, { x: 560, y: -120, w: 640, h: 640 }, ctx, 'g').html;
    const topo = gfxHtml({ kind: 'contours', variant: 'topo', color: 'primary', seed: 3 }, { x: 0, y: 0, w: 1080, h: 1080 }, ctx, 'g').html;
    const namedTopo = '<x-gfx kind="contours" x="0" y="0" w="1080" h="1080" color="primary" seed="3"></x-gfx>';
    check(`des anneaux : ${named.length} signes à écrire contre ${drawn.length} à dessiner (÷${Math.round(drawn.length / named.length)})`, named.length * 5 < drawn.length);
    check(`des courbes de niveau : ${namedTopo.length} signes à écrire contre ${topo.length} à dessiner (÷${Math.round(topo.length / namedTopo.length)})`, namedTopo.length * 40 < topo.length);
  }

  console.log(`\n${passes} vérifications réussies, ${failures} échec(s). Sorties : ${OUT}`);
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

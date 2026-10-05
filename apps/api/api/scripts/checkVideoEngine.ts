/**
 * `npm run check:video:engine` — l'environnement du moteur vidéo.
 *
 *  1. Paquets : runtime, moteur, addons ; chaque addon s'inscrit seul, sans erreur.
 *  2. Tailwind : classes de la charte présentes, palette par défaut absente.
 *  3. Icônes : chaque concept existe dans chaque bibliothèque, SVG normalisé.
 *  4. Logo : nettoyage d'un SVG piégé.
 *  5. Graphe : arêtes valides, implémentations présentes, routeur déterministe,
 *     choix toujours possibles, variété, contraintes (qualité, logo, médias).
 *  6. Rendu (Chromium) : chaque animation de logo, chaque fond, chaque
 *     annotation, chaque bibliothèque d'icônes — aucune erreur, image identique
 *     quel que soit l'ordre de lecture, planche contact.
 *  7. (--online) Rive : un fichier .riv réel joué image par image.
 *
 * Planche : tmp/video-engine-kit/index.html
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import puppeteer, { Browser } from 'puppeteer';
import { VideoKit } from '../models/motionVideo.model';
import { buildVideoEngine, ADDON_IDS, buildEngineCss } from '../services/Communication/video/video.engine';
import { CAP_BY_ID, CAPABILITIES, KitContext, resolveKit, unmet, applyKitOverrides, assignIcons, capabilityCard } from '../services/Communication/video/video.capabilities';
import { ICON_CONCEPT_IDS, ICON_CONCEPTS, iconFile, iconSvg, IconSetId } from '../services/Communication/video/video.icons';
import { analyzeLogo, sanitizeLogoSvg } from '../services/Communication/video/video.logo';
import { buildVideoTheme } from '../services/Communication/video/video.theme';
import { buildStoryboard } from '../services/Communication/video/video.storyboard';
import { composeVideoHtml, inlineAssets } from '../services/Communication/video/video.composer';
import { DIRECTION_IDS, DirectionId } from '../services/Communication/video/video.direction';
import { brandById } from './fixtures/motion-video/brands';

const ONLINE = process.argv.includes('--online');
const OUT = path.resolve(process.cwd(), 'tmp/video-engine-kit');
fs.mkdirSync(OUT, { recursive: true });

let failures = 0;
function check(label: string, ok: boolean, detail = '') {
  if (!ok) failures++;
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
}
const section = (t: string) => console.log(`\n${t}`);

const API_ROOT = path.resolve(__dirname, '../..');

// ─── 6. Outils de rendu ─────────────────────────────────────────────────────

interface Shot {
  label: string;
  frames: string[];
}
const sheet: { group: string; shots: Shot[] }[] = [];

function baseKit(over: Partial<VideoKit>): VideoKit {
  return { background: 'none', backdropScenes: [], annotate: 'none', logo: 'classic', iconSet: 'lucide', icons: {}, postfx: [], addons: [], trace: [], ...over };
}

/** Rend une page, vérifie erreurs + déterminisme sur `times`, renvoie les images (data URI JPEG). */
async function renderCheck(browser: Browser, html: string, spec: { width: number; height: number }, times: number[], label: string, opts: { mustMove?: boolean } = {}): Promise<string[]> {
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String((e as Error).message || e).slice(0, 200)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 200));
  });
  try {
    await page.setViewport({ width: spec.width, height: spec.height, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'load', timeout: 60000 });
    await page.evaluate(() => (window as any).__IDEM_VIDEO__.ready);
    const shoot = async (t: number) => {
      await page.evaluate((x: number) => (window as any).__IDEM_VIDEO__.seek(x), t);
      return Buffer.from(await page.screenshot({ type: 'png' }));
    };
    const forward: Buffer[] = [];
    for (const t of times) forward.push(await shoot(t));
    const backward: Buffer[] = [];
    for (const t of [...times].reverse()) backward.unshift(await shoot(t));
    const sharp = (await import('sharp')).default;
    let worst = 0;
    for (let i = 0; i < times.length; i++) {
      const [a, b] = await Promise.all([forward[i], backward[i]].map((p) => sharp(p).raw().toBuffer()));
      let n = 0;
      for (let k = 0; k < a.length; k += 4) if (Math.abs(a[k] - b[k]) > 8 || Math.abs(a[k + 1] - b[k + 1]) > 8 || Math.abs(a[k + 2] - b[k + 2]) > 8) n++;
      worst = Math.max(worst, n / (a.length / 4));
    }
    if (opts.mustMove) {
      // L'animation doit réellement changer l'image entre le premier et le dernier instant.
      const [a, b] = await Promise.all([forward[0], forward[forward.length - 1]].map((p) => sharp(p).raw().toBuffer()));
      let n = 0;
      for (let k = 0; k < a.length; k += 4) if (Math.abs(a[k] - b[k]) > 24 || Math.abs(a[k + 1] - b[k + 1]) > 24 || Math.abs(a[k + 2] - b[k + 2]) > 24) n++;
      check(`${label} : l'animation progresse`, n / (a.length / 4) > 0.01, `${((n / (a.length / 4)) * 100).toFixed(1)} % de pixels changent`);
    }
    const sections = await page.evaluate(() => document.querySelectorAll('section.scene').length);
    check(`${label} : aucune erreur, scènes présentes`, errors.length === 0 && sections > 0, errors.slice(0, 2).join(' | '));
    check(`${label} : même image à l'aller et au retour`, worst <= 0.002, `écart ${(worst * 100).toFixed(2)} %`);
    return Promise.all(forward.map(async (p) => `data:image/jpeg;base64,${(await sharp(p).resize({ width: 300 }).jpeg({ quality: 70 }).toBuffer()).toString('base64')}`));
  } finally {
    await page.close();
  }
}

async function composeKit(opts: { brandId: string; sceneIds: string[]; slots: Record<string, string>[]; kit: (keys: string[]) => VideoKit; direction: DirectionId; format?: 'square' | 'story' | 'landscape'; type3dLogo?: boolean }) {
  const brand = brandById(opts.brandId);
  const theme = buildVideoTheme(brand.branding, brand.name);
  const sb = buildStoryboard({ sceneIds: opts.sceneIds, slots: opts.slots, durationSec: 6, style: 'premium', seed: 7, images: [], direction: opts.direction, logo3d: !!opts.type3dLogo });
  sb.kit = opts.kit(sb.scenes.map((s) => s.key));
  const assets = await inlineAssets(sb, theme);
  const { html, spec } = await composeVideoHtml({ ...assets, format: opts.format || 'square', quality: 'standard', mode: 'render' });
  return { html, spec, sb };
}

// ─── Programme ──────────────────────────────────────────────────────────────

(async () => {
  console.log('Environnement du moteur vidéo\n');

  section('1. Paquets');
  const bundles = await buildVideoEngine();
  check(`runtime ${Math.round(bundles.runtime.length / 1024)} ko, moteur ${Math.round(bundles.engine.length / 1024)} ko`, bundles.engine.length > 50000);
  check('le moteur n’embarque pas React (runtime partagé)', !bundles.engine.includes('__SECRET_INTERNALS') && !/react\.production/.test(bundles.engine) && bundles.engine.length < bundles.runtime.length);
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
  try {
    for (const id of ADDON_IDS) {
      const page = await browser.newPage();
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(String((e as Error).message || e)));
      await page.setContent(`<html><body><script>${bundles.runtime}</script><script>${bundles.addons[id]}</script></body></html>`, { waitUntil: 'load' });
      const registered = await page.evaluate((k: string) => !!(window as any).__IDEM_ADDONS__?.[k], id);
      check(`addon ${id} (${Math.round(bundles.addons[id].length / 1024)} ko) : s’inscrit sans erreur`, registered && errors.length === 0, errors[0] || '');
      await page.close();
    }

    section('2. Tailwind (charte dans les classes)');
    const css = await buildEngineCss(path.join(API_ROOT, 'video-engine/src'));
    for (const cls of ['.bg-hl-soft', '.text-hl-text', '.font-display', '.rounded-pill']) check(`classe ${cls} compilée`, css.includes(cls));
    check('palette par défaut absente (bg-blue-500, --color-red-500)', !css.includes('.bg-blue-500') && !css.includes('--color-red-500'));
    check('couches dans l’ordre : thème, moteur, utilitaires', css.includes('@layer theme, engine, utilities;'));

    section('3. Icônes');
    const sets: IconSetId[] = ['lucide', 'tabler', 'phosphor-thin', 'phosphor-light', 'phosphor-bold', 'phosphor-fill', 'phosphor-duotone', 'heroicons-solid'];
    let missing = 0;
    for (const c of ICON_CONCEPT_IDS) for (const s of sets) if (!(s === 'heroicons-solid' && !ICON_CONCEPTS[c].names[3]) && !iconFile(s, c)) missing++;
    check(`${ICON_CONCEPT_IDS.length} concepts × ${sets.length} bibliothèques : tous présents`, missing === 0, `${missing} manquant(s)`);
    const sample = iconSvg('tabler', 'delivery') || '';
    check('SVG normalisé (sans dimensions ni classe, currentColor)', !/\swidth=|\sclass=/.test(sample.slice(0, sample.indexOf('>'))) && sample.includes('currentColor'));
    check('repli quand Heroicons n’a pas le concept', !!iconSvg('heroicons-solid', 'natural'));
    const icons = assignIcons([{ key: 'benefits-1', sceneId: 'benefits', slots: { b1: 'Livraison en 24 h', b2: 'Paiement mobile money', b3: 'Qualité garantie', icons: 'delivery, nonsense, delivery' } }]);
    check('concepts : proposition du modèle validée, repli par mots-clés, sans doublon', icons['benefits-1'].join(',') === 'delivery,payment,quality', icons['benefits-1'].join(','));

    section('4. Logo vectoriel');
    const evil = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="10" height="10" onload="x()"><script>x()</script><foreignObject/><rect width="5" height="5" onclick="y()"/><image href="http://169.254.169.254/a.png"/><animate/></svg>';
    const clean = sanitizeLogoSvg(evil) || '';
    check('script, foreignObject, SMIL, on*, liens externes retirés', !/script|foreignObject|onload|onclick|169\.254|<animate/.test(clean), clean.slice(0, 120));
    check('viewBox garanti, dimensions retirées', clean.includes('viewBox') && !/\swidth="10"/.test(clean));
    const wax = buildVideoTheme(brandById('wax').branding, 'Wax & Co');
    const info = analyzeLogo(wax.logo.fullSvgMarkup, wax.logo.svgMarkup);
    check('logo avec <text> → le symbole est animé, le nom écrit par le moteur', !!info?.isIcon && info.shapes === 2, JSON.stringify({ ...info, svg: undefined }));

    section('5. Graphe de capacités');
    const dangling = CAPABILITIES.flatMap((n) => (n.requires || []).filter((r) => !CAP_BY_ID.has(r)).map((r) => `${n.id}→${r}`));
    check(`${CAPABILITIES.length} nœuds, aucune arête vers un nœud absent`, dangling.length === 0, dangling.join(' '));
    const impls = CAPABILITIES.filter((n) => n.impl && !n.impl.startsWith('public/')).filter((n) => !fs.existsSync(path.join(API_ROOT, n.impl!.split('#')[0])));
    check('chaque implémentation citée existe', impls.length === 0, impls.map((n) => n.id).join(' '));
    const pkg = JSON.parse(fs.readFileSync(path.join(API_ROOT, 'package.json'), 'utf8'));
    const notInstalled = CAPABILITIES.flatMap((n) => n.packages || []).filter((p) => !pkg.dependencies?.[p] && !pkg.devDependencies?.[p]);
    check('chaque paquet cité est installé', notInstalled.length === 0, notInstalled.join(' '));

    const ctxFor = (over: Partial<KitContext>): KitContext => ({
      type: 'promo',
      objective: 'promotion',
      direction: 'kinetic',
      quality: 'hd',
      format: 'story',
      durationSec: 15,
      logo: info,
      hasLogoIcon: true,
      media: { images: 2, videos: 0, models: 0, lotties: 0, rive: 0 },
      scenes: [
        { key: 'hook-1', sceneId: 'hook', hasMedia: false, hasTitle: true },
        { key: 'statement-2', sceneId: 'statement', hasMedia: false, hasTitle: true },
        { key: 'benefits-3', sceneId: 'benefits', hasMedia: false, hasTitle: true },
        { key: 'cta-4', sceneId: 'cta', hasMedia: false, hasTitle: true },
        { key: 'logo-5', sceneId: 'logo', hasMedia: false, hasTitle: false },
      ],
      text: 'Livraison de wax à Abidjan, paiement mobile money',
      seed: 42,
      ...over,
    });
    const a = resolveKit(ctxFor({}));
    const b = resolveKit(ctxFor({}));
    check('routeur déterministe (même contexte → même kit)', JSON.stringify(a) === JSON.stringify(b));
    let impossible = 0;
    const logos = new Set<string>();
    const bgs = new Set<string>();
    for (const dir of DIRECTION_IDS) {
      for (let seed = 1; seed <= 12; seed++) {
        const k = resolveKit(ctxFor({ direction: dir, seed }));
        logos.add(k.logo);
        bgs.add(k.background);
        for (const id of [`logo:${k.logo}`, `bg:${k.background}`, `annotate:${k.annotate}`, `icons:${k.iconSet}`]) if (unmet(CAP_BY_ID.get(id)!, ctxFor({ direction: dir, seed }))) impossible++;
        if (k.backdropScenes.length > 2) impossible++;
      }
    }
    check('96 kits : chaque choix est possible dans son contexte, fond sur 2 scènes max', impossible === 0, `${impossible} écart(s)`);
    check(`variété : ${logos.size} animations de logo, ${bgs.size} fonds sur 96 kits`, logos.size >= 5 && bgs.size >= 5, `${[...logos].join(',')} | ${[...bgs].join(',')}`);
    const noLogo = resolveKit(ctxFor({ logo: null, hasLogoIcon: false }));
    check('sans logo vectoriel ni symbole → signature de la direction', noLogo.logo === 'classic', noLogo.logo);
    const std = resolveKit(ctxFor({ quality: 'standard', type: 'showcase3d', scenes: [...ctxFor({}).scenes, { key: 'showcase3d-6', sceneId: 'showcase3d', hasMedia: false, hasTitle: true, three: true }] }));
    const prem = resolveKit(ctxFor({ quality: 'premium', direction: 'cinematic', type: 'showcase3d', scenes: [...ctxFor({}).scenes, { key: 'showcase3d-6', sceneId: 'showcase3d', hasMedia: false, hasTitle: true, three: true }] }));
    check('qualité standard → aucun effet 3D ; premium cinématique → bloom + SMAA', std.postfx.length === 0 && prem.postfx.includes('bloom') && prem.postfx.includes('smaa'), `${std.postfx} | ${prem.postfx}`);
    check('extrusion 3D réservée au type « logo »', !CAPABILITIES.some(() => false) && resolveKit(ctxFor({ type: 'promo' })).logo !== 'extrude');
    const recent = resolveKit(ctxFor({ recent: [a, a] }));
    check('variété entre vidéos : le logo d’une vidéo récente est évité', recent.logo !== a.logo || a.logo === 'classic', `${a.logo} → ${recent.logo}`);
    const ov = applyKitOverrides(a, { logo: 'extrude', background: 'halftone' }, ctxFor({}));
    check('retouche : un choix impossible est refusé avec sa raison, un possible est accepté', ov.kit.logo === a.logo && ov.kit.background === 'halftone' && ov.refused[0]?.field === 'logo', JSON.stringify(ov.refused));
    check('les addons suivent les choix (morphose → flubber, plume → gsap, vague → anime)', ['logo:morph:flubber', 'logo:trace:gsap', 'bg:stagger-grid:anime'].every((s) => {
      const [kind, value, addon] = s.split(':');
      const k = applyKitOverrides(baseKit({}), { [kind === 'bg' ? 'background' : 'logo']: value } as any, ctxFor({})).kit;
      return k.addons.includes(addon as any);
    }));
    const card = capabilityCard(ctxFor({}));
    check(`carte de capacités compacte (${card.length} caractères ≈ ${Math.ceil(card.length / 4)} tokens)`, card.length < 1600 && card.includes('logo:'), '');
    console.log(card.split('\n').map((l) => `      ${l}`).join('\n'));

    section('6. Rendu des composants du kit (Chromium)');
    // Animations de logo (le symbole de la marque est animé, le nom écrit dessous).
    const logoShots: Shot[] = [];
    for (const variant of ['draw', 'trace', 'morph', 'assemble', 'wipe', 'split', 'classic', 'extrude']) {
      for (const brandId of variant === 'extrude' || variant === 'split' ? ['wax'] : ['wax', 'kofi']) {
        const { html, spec, sb } = await composeKit({
          brandId,
          sceneIds: ['statement', 'logo'],
          slots: [{ title: 'Le goût du vrai', sub: 'Depuis 2019' }, { tagline: 'Fait main à Abidjan' }],
          direction: variant === 'classic' ? 'collage' : 'precision',
          type3dLogo: variant === 'extrude',
          kit: () => baseKit({ logo: variant }),
        });
        const logo = sb.scenes[1];
        const times = [logo.start + 0.35, logo.start + 0.9, logo.start + 1.6, logo.start + logo.duration - 0.2];
        const frames = await renderCheck(browser, html, spec, times, `logo ${variant} · ${brandId}`, { mustMove: true });
        logoShots.push({ label: `${variant} · ${brandId}`, frames });
      }
    }
    sheet.push({ group: 'Animations de logo', shots: logoShots });

    const bgShots: Shot[] = [];
    for (const bg of ['dot-grid', 'halftone', 'shape-field', 'stagger-grid', 'marquee', 'spotlight', 'ticks']) {
      const { html, spec, sb } = await composeKit({
        brandId: 'bissap',
        sceneIds: ['statement', 'cta'],
        slots: [{ title: 'Pressé le matin, livré le midi', sub: 'Bissap, gingembre, baobab' }, { title: 'Commandez votre pack', action: 'Écrivez-nous' }],
        direction: bg === 'marquee' ? 'brutal' : bg === 'shape-field' || bg === 'stagger-grid' ? 'kinetic' : bg === 'halftone' ? 'collage' : 'precision',
        format: 'story',
        kit: (keys) => baseKit({ background: bg, backdropScenes: [keys[0]] }),
      });
      const s0 = sb.scenes[0];
      const frames = await renderCheck(browser, html, spec, [0.4, 1.0, s0.duration - 0.3], `fond ${bg}`);
      bgShots.push({ label: bg, frames });
    }
    sheet.push({ group: 'Fonds', shots: bgShots });

    const annShots: Shot[] = [];
    for (const ann of ['marker', 'underline', 'circle']) {
      for (const dir of ['editorial', 'kinetic', 'swiss'] as DirectionId[]) {
        const { html, spec } = await composeKit({
          brandId: 'wax',
          sceneIds: ['hook', 'logo'],
          slots: [{ title: 'Le wax qui raconte votre histoire' }, {}],
          direction: dir,
          kit: (keys) => baseKit({ annotate: ann, annotateScene: keys[0] }),
        });
        const frames = await renderCheck(browser, html, spec, [0.6, 1.4, 2.2], `annotation ${ann} · ${dir}`);
        annShots.push({ label: `${ann} · ${dir}`, frames });
      }
    }
    sheet.push({ group: 'Annotations', shots: annShots });

    // Grand moment : l'effet que la direction donne à LA scène choisie.
    const accentShots: Shot[] = [];
    for (const [effect, dir] of [['punch', 'brutal'], ['giant', 'swiss'], ['hold', 'cinematic'], ['flip', 'drenched']] as [string, DirectionId][]) {
      const brand = brandById('wax');
      const theme = buildVideoTheme(brand.branding, brand.name);
      const sb = buildStoryboard({
        sceneIds: ['hook', 'statement', 'logo'],
        slots: [{ title: 'Le wax qui vous ressemble' }, { title: 'Tissé pour durer', sub: 'Depuis 2019' }, {}],
        durationSec: 6,
        style: 'premium',
        seed: 9,
        images: [],
        direction: dir,
        accent: { index: 1, effect: effect as any },
      });
      sb.kit = baseKit({});
      const { html, spec } = await composeVideoHtml({ ...(await inlineAssets(sb, theme)), format: 'square', quality: 'standard', mode: 'render' });
      const s1 = sb.scenes[1];
      check(`grand moment ${effect} posé sur sa scène (${s1.surface})`, s1.accent === effect);
      const frames = await renderCheck(browser, html, spec, [s1.start + 0.05, s1.start + 0.25, s1.start + s1.duration * 0.7], `grand moment ${effect} · ${dir}`);
      accentShots.push({ label: `${effect} · ${dir}`, frames });
    }
    sheet.push({ group: 'Grand moment', shots: accentShots });

    const iconShots: Shot[] = [];
    for (const [set, dir] of [['lucide', 'precision'], ['tabler', 'swiss'], ['phosphor-light', 'editorial'], ['phosphor-bold', 'brutal'], ['phosphor-fill', 'kinetic'], ['phosphor-duotone', 'collage'], ['phosphor-thin', 'cinematic'], ['heroicons-solid', 'drenched']] as [IconSetId, DirectionId][]) {
      const { html, spec, sb } = await composeKit({
        brandId: 'kofi',
        sceneIds: ['benefits', 'logo'],
        slots: [{ title: 'Pourquoi Kofi', b1: 'Livraison en 24 h', b2: 'Paiement mobile money', b3: 'Support 7j/7' }, {}],
        direction: dir,
        kit: (keys) => baseKit({ iconSet: set, icons: { [keys[0]]: ['delivery', 'payment', 'support'] } }),
      });
      const frames = await renderCheck(browser, html, spec, [sb.scenes[0].duration - 0.4], `icônes ${set} · ${dir}`);
      iconShots.push({ label: `${set} · ${dir}`, frames });
    }
    sheet.push({ group: 'Icônes par direction', shots: iconShots });

    if (ONLINE) {
      section('7. Rive (fichier réel)');
      try {
        const riv = await axios.get('https://cdn.rive.app/animations/vehicles.riv', { responseType: 'arraybuffer', timeout: 20000 });
        const file = path.join(OUT, 'vehicles.riv');
        fs.writeFileSync(file, Buffer.from(riv.data));
        process.env.VIDEO_ALLOW_FILE_URLS = '1';
        const brand = brandById('bissap');
        const theme = buildVideoTheme(brand.branding, brand.name);
        const sb = buildStoryboard({ sceneIds: ['lottie', 'logo'], slots: [{ title: 'En route', sub: 'Livraison partout' }, {}], durationSec: 6, style: 'playful', seed: 3, images: [], rives: [`file://${file}`], direction: 'kinetic' });
        sb.kit = baseKit({});
        const assets = await inlineAssets(sb, theme);
        const { html, spec } = await composeVideoHtml({ ...assets, format: 'square', quality: 'standard', mode: 'render' });
        const frames = await renderCheck(browser, html, spec, [0.8, 1.6, 2.4], 'Rive vehicles.riv');
        sheet.push({ group: 'Rive', shots: [{ label: 'vehicles.riv', frames }] });
      } catch (e: any) {
        check('Rive : fichier d’exemple téléchargé', false, e.message);
      }
    }
  } finally {
    await browser.close();
  }

  const html = `<!doctype html><meta charset="utf-8"><title>Kit vidéo</title><style>body{font:14px system-ui;margin:24px;background:#fafaf9;color:#1c1917}h2{margin:28px 0 10px}.row{display:flex;gap:12px;align-items:flex-start;margin:8px 0}.row b{width:180px;flex:none}.row img{width:150px;border:1px solid #e7e5e4}</style><h1>Kit du moteur vidéo</h1>${sheet
    .map((g) => `<h2>${g.group}</h2>${g.shots.map((s) => `<div class="row"><b>${s.label}</b>${s.frames.map((f) => `<img src="${f}">`).join('')}</div>`).join('')}`)
    .join('')}`;
  fs.writeFileSync(path.join(OUT, 'index.html'), html);
  console.log(`\nPlanche : ${path.join(OUT, 'index.html')}`);
  console.log(failures ? `\n✗ ${failures} vérification(s) en échec.` : '\n✓ Environnement du moteur vidéo : tout est en place.');
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

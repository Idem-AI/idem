/**
 * `npm run check:video:engine` — l'environnement du moteur vidéo.
 *
 *  1. Paquets : runtime, moteur, addons ; chaque addon s'inscrit seul, sans erreur.
 *  2. Tailwind : classes de la charte présentes, palette par défaut absente.
 *  3. Icônes : chaque concept existe dans chaque bibliothèque, SVG normalisé.
 *  4. Logo : nettoyage d'un SVG piégé.
 *  5. Graphe : arêtes valides, implémentations présentes, routeur déterministe,
 *     choix toujours possibles, variété, contraintes (qualité, logo, médias) ;
 *     licences comparées aux package.json installés, repli de tout nœud coûteux,
 *     particules : pose pure de la graine et du temps.
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
import { buildVideoEngine, ADDON_IDS, buildEngineCss } from '../../../ivision/core/src/video/video.engine';
import { CAP_BY_ID, CAPABILITIES, KitContext, resolveKit, unmet, applyKitOverrides, assignIcons, capabilityCard, fallbackIssues, licenseIssues, licensesOf, pickAccentEffect } from '../../../ivision/core/src/video/video.capabilities';
import { MAX_PARTICLES, PARTICLE_MODES, particlesAt } from '../../../ivision/core/engine/src/kit/particles.math';
import { ICON_CONCEPT_IDS, ICON_CONCEPTS, iconFile, iconSvg, IconSetId } from '../../../ivision/core/src/video/video.icons';
import { analyzeLogo, sanitizeLogoSvg } from '../../../ivision/core/src/video/video.logo';
import { buildVideoTheme } from '../../../ivision/core/src/video/video.theme';
import { buildStoryboard } from '../../../ivision/core/src/video/video.storyboard';
import { composeVideoHtml, inlineAssets } from '../../../ivision/core/src/video/video.composer';
import { DIRECTION_IDS, DirectionId } from '../../../ivision/core/src/video/video.direction';
import { brandById } from './fixtures/motion-video/brands';
import { makePhotos } from './fixtures/motion-video/media';

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
/** Le moteur partagé iVision : sources du moteur React et implémentations du graphe. */
const CORE_ROOT = path.resolve(__dirname, '../../../ivision/core');

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
async function renderCheck(
  browser: Browser,
  html: string,
  spec: { width: number; height: number },
  times: number[],
  label: string,
  opts: { mustMove?: boolean; clip?: boolean; probe?: (page: import('puppeteer').Page) => Promise<void> } = {}
): Promise<string[]> {
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String((e as Error).message || e).slice(0, 200)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 200));
  });
  try {
    await page.setViewport({ width: spec.width, height: spec.height, deviceScaleFactor: 1 });
    // Comme le moteur de rendu : sans focus émulé, Chromium ne décode pas les clips d'un onglet.
    const cdp = await page.createCDPSession();
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true }).catch(() => undefined);
    await page.setContent(html, { waitUntil: 'load', timeout: 60000 });
    await page.evaluate(() => (window as any).__IDEM_VIDEO__.ready);
    const shoot = async (t: number) => {
      await page.evaluate((x: number) => (window as any).__IDEM_VIDEO__.seek(x), t);
      return Buffer.from(await page.screenshot({ type: 'png' }));
    };
    const forward: Buffer[] = [];
    for (const t of times) forward.push(await shoot(t));
    // Contrôles de mise en page sur l'image posée (le dernier instant).
    if (opts.probe) await opts.probe(page);
    const backward: Buffer[] = [];
    if (opts.clip) {
      // Clip : comme en production, un AUTRE onglet chargé à neuf, qui avance dans le même ordre.
      const other = await browser.newPage();
      const cdp2 = await other.createCDPSession();
      await cdp2.send('Emulation.setFocusEmulationEnabled', { enabled: true }).catch(() => undefined);
      await other.setViewport({ width: spec.width, height: spec.height, deviceScaleFactor: 1 });
      await other.setContent(html, { waitUntil: 'load', timeout: 60000 });
      await other.evaluate(() => (window as any).__IDEM_VIDEO__.ready);
      for (const t of times) {
        await other.evaluate((x: number) => (window as any).__IDEM_VIDEO__.seek(x), t);
        backward.push(Buffer.from(await other.screenshot({ type: 'png' })));
      }
      await other.close();
    } else for (const t of [...times].reverse()) backward.unshift(await shoot(t));
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
    // Une scène cachée ne doit rien laisser voir (un enfant en « visibility: visible » passerait au-dessus).
    const leaks = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('section.scene')]
        .filter((sec) => sec.style.visibility === 'hidden')
        .flatMap((sec) => [...sec.querySelectorAll<HTMLElement>('*')].filter((el) => getComputedStyle(el).visibility === 'visible').map((el) => `${sec.dataset.scene}>${el.className}`))
        .slice(0, 3)
    );
    check(`${label} : rien ne déborde d’une scène cachée`, leaks.length === 0, leaks.join(', '));
    const sections = await page.evaluate(() => document.querySelectorAll('section.scene').length);
    check(`${label} : aucune erreur, scènes présentes`, errors.length === 0 && sections > 0, errors.slice(0, 2).join(' | '));
    if (worst > 0.002) {
      // Diagnostic : les deux images de l'instant le plus différent sont gardées.
      const slug = label.replace(/[^a-z0-9]+/gi, '-');
      forward.forEach((png, i) => fs.writeFileSync(path.join(OUT, `diff-${slug}-${i}-aller.png`), png));
      backward.forEach((png, i) => fs.writeFileSync(path.join(OUT, `diff-${slug}-${i}-retour.png`), png));
    }
    check(`${label} : ${opts.clip ? 'même image dans deux onglets' : 'même image à l’aller et au retour'}`, worst <= 0.002, `écart ${(worst * 100).toFixed(2)} %`);
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
  // Embarquer React ajouterait au moteur la taille du runtime : le seuil est 1,5 × le runtime, pas le runtime lui-même
  // (un moteur qui s'enrichit de quelques ko ne doit pas faire croire qu'il embarque React).
  check('le moteur n’embarque pas React (runtime partagé)', !bundles.engine.includes('__SECRET_INTERNALS') && !/react\.production/.test(bundles.engine) && bundles.engine.length < bundles.runtime.length * 1.5);
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
    const css = await buildEngineCss(path.join(CORE_ROOT, 'engine/src'));
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
    const impls = CAPABILITIES.filter((n) => n.impl && !n.impl.startsWith('public/')).filter((n) => !fs.existsSync(path.join(CORE_ROOT, n.impl!.split('#')[0])));
    check('chaque implémentation citée existe', impls.length === 0, impls.map((n) => n.id).join(' '));
    // Le moteur partagé déclare ses paquets ; l'API IDEM, qui l'exécute dans son processus, les installe aussi.
    const pkgOf = (root: string) => JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    const [corePkg, apiPkg] = [pkgOf(CORE_ROOT), pkgOf(API_ROOT)];
    const declared = (pkg: any, p: string) => !!(pkg.dependencies?.[p] || pkg.devDependencies?.[p]);
    const notInstalled = CAPABILITIES.flatMap((n) => n.packages || []).filter((p) => !declared(corePkg, p) || !declared(apiPkg, p));
    check('chaque paquet cité est déclaré par le moteur partagé et installé par l’API IDEM', notInstalled.length === 0, notInstalled.join(' '));

    // Licences : le graphe déclare celle de chaque bibliothèque ; le package.json installé fait foi.
    const readLicense = (pkg: string): string | null => {
      for (let dir = CORE_ROOT; dir !== path.dirname(dir); dir = path.dirname(dir)) {
        const file = path.join(dir, 'node_modules', pkg, 'package.json');
        if (!fs.existsSync(file)) continue;
        const j = JSON.parse(fs.readFileSync(file, 'utf8'));
        return typeof j.license === 'string' ? j.license : j.license?.type || null;
      }
      return null;
    };
    const licIssues = licenseIssues(readLicense);
    check(`licences : ${CAPABILITIES.filter((n) => n.kind === 'library').length} bibliothèques déclarées, conformes aux paquets installés et à l’usage commercial`, licIssues.length === 0, licIssues.join(' | '));
    check('licences : un nœud hérite de celles de ses bibliothèques (morphose de logo → flubber)', licensesOf('logo:morph').join() === 'MIT', licensesOf('logo:morph').join());
    // Replis : tout effet coûteux a une variante ou une composition de secours.
    const fbIssues = fallbackIssues();
    check(`replis : ${CAPABILITIES.filter((n) => n.cost >= 2).length} nœuds de coût ≥ 2, chacun avec un repli moins cher, du même rôle, sans horloge posée`, fbIssues.length === 0, fbIssues.join(' | '));

    // Particules : la pose est une fonction pure de (graine, indice, temps).
    {
      const modes = PARTICLE_MODES.map((mode) => {
        const spec = { mode, count: 60, seed: 11, area: (mode === 'dissolve' ? [10, 40, 70, 60] : [0, 0, 100, 100]) as [number, number, number, number], aspect: 9 / 16 };
        const frames = [0.2, 0.9, 1.7, 3.1, 5.4].map((t) => ({ t, p: Math.min(1, t / 3) }));
        const forward = frames.map((f) => JSON.stringify(particlesAt(spec, f.t, f.p)));
        const backward = [...frames].reverse().map((f) => JSON.stringify(particlesAt(spec, f.t, f.p))).reverse();
        const other = JSON.stringify(particlesAt({ ...spec, seed: 12 }, 1.7, 0.5));
        const all = frames.flatMap((f) => particlesAt(spec, f.t, f.p));
        return {
          mode,
          pure: forward.join() === backward.join(),
          seeded: other !== forward[2],
          finite: all.every((q) => [q.x, q.y, q.size, q.rot, q.alpha].every(Number.isFinite) && q.alpha >= 0 && q.alpha <= 1),
          visible: all.some((q) => q.alpha > 0.2),
          moves: JSON.stringify(particlesAt(spec, 0.2, 0.1)) !== JSON.stringify(particlesAt(spec, 3.1, 0.9)),
        };
      });
      for (const key of ['pure', 'seeded', 'finite', 'visible', 'moves'] as const) {
        const bad = modes.filter((m) => !m[key]).map((m) => m.mode);
        check(`particules (${PARTICLE_MODES.length} modes) : ${{ pure: 'même pose quel que soit l’ordre de rendu', seeded: 'une autre graine donne d’autres particules', finite: 'valeurs finies, opacité bornée', visible: 'des particules sont visibles', moves: 'elles bougent' }[key]}`, bad.length === 0, bad.join(' '));
      }
      check(`particules : au plus ${MAX_PARTICLES}, même demandées par milliers`, particlesAt({ count: 5000 }, 1, 0).length === MAX_PARTICLES && particlesAt({ count: NaN as any }, 1, 0).length > 0);
      const edge = (mode: any) => particlesAt({ mode, count: 40, seed: 3, area: [20, 20, 20, 20], aspect: 9 / 16 }, 1, mode === 'burst' ? 0 : 0);
      check('éclat et rassemblement : rien de visible avant l’événement', edge('burst').every((q) => q.alpha < 0.01) && edge('converge').every((q) => q.alpha < 0.01));
      check('éclat : tout s’est éteint à la fin (rien ne reste sur le texte)', particlesAt({ mode: 'burst', count: 40, seed: 3, area: [50, 50, 50, 50], aspect: 1 }, 2, 1).every((q) => q.alpha < 0.01));
    }

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
    const accentsKinetic = new Set(Array.from({ length: 24 }, (_, seed) => pickAccentEffect('kinetic', seed + 1)));
    check(`grand moment : le graphe tire l’éclat de particules parmi d’autres effets en cinétique (${[...accentsKinetic].join(', ')})`, accentsKinetic.has('burst') && accentsKinetic.size >= 2);
    const particleBgs = new Set<string>();
    for (const dir of DIRECTION_IDS) for (let seed = 1; seed <= 30; seed++) particleBgs.add(resolveKit(ctxFor({ direction: dir, seed })).background);
    check(`fonds : au moins un fond de particules est retenu sur 30 graines × ${DIRECTION_IDS.length} directions`, ['motes', 'embers', 'confetti'].some((b) => particleBgs.has(b)), [...particleBgs].join(','));
    // Matière, réseau, dégradé, effets d'image, animation des icônes : choisis par le graphe, jamais hors contexte.
    const matter = ['aurora', 'silk', 'plasma', 'fluid', 'mesh', 'topology', 'waves', 'blobs', 'network', 'gradient'];
    const matterSeen = new Set<string>();
    const iconMotions = new Set<string>();
    const fxWithPhoto = new Set<string>();
    let fxWithoutPhoto = 0;
    let styled3d = 0;
    for (const dir of DIRECTION_IDS) {
      for (let seed = 1; seed <= 24; seed++) {
        const k = resolveKit(ctxFor({ direction: dir, seed }));
        if (matter.includes(k.background)) matterSeen.add(k.background);
        if (k.iconMotion) iconMotions.add(k.iconMotion);
        const product = { key: 'product-9', sceneId: 'product', hasMedia: true, hasTitle: true };
        const withPhoto = resolveKit(ctxFor({ direction: dir, seed, scenes: [...ctxFor({}).scenes, product], media: { images: 2, videos: 0, models: 0, lotties: 0, rive: 0 } }));
        if (withPhoto.imageFx && withPhoto.imageFx !== 'none') fxWithPhoto.add(withPhoto.imageFx);
        const noPhoto = resolveKit(ctxFor({ direction: dir, seed, media: { images: 0, videos: 0, models: 0, lotties: 0, rive: 0 } }));
        if (noPhoto.imageFx && noPhoto.imageFx !== 'none') fxWithoutPhoto++;
        const prem3d = resolveKit(ctxFor({ direction: dir, seed, quality: 'premium', type: 'showcase3d', scenes: [...ctxFor({}).scenes, { key: 'showcase3d-6', sceneId: 'showcase3d', hasMedia: false, hasTitle: true, three: true }] }));
        if (prem3d.postfx.filter((x) => x !== 'smaa').length > 2) styled3d++;
      }
    }
    check(`matière : ${matterSeen.size} des ${matter.length} fonds de matière, de réseau ou de dégradé sont retenus par le graphe`, matterSeen.size >= 5, [...matterSeen].join(','));
    check(`animation des pictogrammes : ${iconMotions.size} choix différents (${[...iconMotions].join(', ')})`, iconMotions.size >= 3);
    check(`effets d’image : ${fxWithPhoto.size} effets retenus quand il y a une photo de produit`, fxWithPhoto.size >= 3, [...fxWithPhoto].join(','));
    check('effets d’image : aucun sans photo de produit', fxWithoutPhoto === 0, `${fxWithoutPhoto} cas`);
    check('postfx 3D : au plus deux effets de style (plus SMAA), jamais quatre empilés', styled3d === 0, `${styled3d} cas`);

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
    for (const bg of ['dot-grid', 'halftone', 'shape-field', 'stagger-grid', 'marquee', 'spotlight', 'ticks', 'flow-field', 'sketch-shapes', 'voronoi', 'flat3d', 'motes', 'embers', 'confetti', 'aurora', 'silk', 'plasma', 'fluid', 'mesh', 'topology', 'waves', 'blobs', 'network', 'gradient']) {
      const { html, spec, sb } = await composeKit({
        brandId: 'bissap',
        sceneIds: ['statement', 'cta'],
        slots: [{ title: 'Pressé le matin, livré le midi', sub: 'Bissap, gingembre, baobab' }, { title: 'Commandez votre pack', action: 'Écrivez-nous' }],
        direction: bg === 'marquee' ? 'brutal' : bg === 'shape-field' || bg === 'stagger-grid' ? 'kinetic' : bg === 'halftone' ? 'collage' : 'precision',
        format: 'story',
        kit: (keys) => baseKit({ background: bg, backdropScenes: [keys[0]] }),
      });
      const s0 = sb.scenes[0];
      // La page ne charge que la bibliothèque qu'exige le fond, et pas les autres.
      const wanted = ({ 'flow-field': 'draw', 'sketch-shapes': 'draw', voronoi: 'viz', flat3d: 'zdog' } as Record<string, string>)[bg];
      // Les particules n'ont besoin d'aucune bibliothèque : aucun addon dans la page.
      if (['motes', 'embers', 'confetti'].includes(bg)) check(`fond ${bg} : aucun addon chargé (particules à graine, sans bibliothèque)`, !html.includes('data-addon='));
      if (wanted) check(`fond ${bg} : addon-${wanted} chargé, aucun autre addon de dessin`, html.includes(`data-addon="${wanted}"`) && ['chart', 'viz', 'draw', 'zdog'].filter((a) => a !== wanted).every((a) => !html.includes(`data-addon="${a}"`)));
      const shaderBg = ['aurora', 'silk', 'plasma', 'fluid', 'mesh', 'topology', 'waves', 'blobs'].includes(bg);
      if (shaderBg) check(`fond ${bg} : addon-ogl chargé, ni pixi ni addon de dessin`, html.includes('data-addon="ogl"') && !html.includes('data-addon="pixi"') && ['chart', 'viz', 'draw', 'zdog'].every((a) => !html.includes(`data-addon="${a}"`)));
      if (['network', 'gradient'].includes(bg)) check(`fond ${bg} : aucun addon chargé (SVG ou CSS pur)`, !html.includes('data-addon='));
      const frames = await renderCheck(browser, html, spec, [0.4, 1.0, s0.duration - 0.3], `fond ${bg}`, {
        mustMove: ['network', 'gradient', 'aurora', 'fluid', 'plasma', 'waves', 'blobs', 'silk', 'mesh'].includes(bg),
        probe: shaderBg
          ? async (page) => {
              const st = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.gl-host')].map((c) => ({ ready: !!c.dataset.glReady, failed: !!c.dataset.glFailed, w: c.getBoundingClientRect().width })));
              check(`fond ${bg} : la toile WebGL est prête, sans échec, étirée au cadre`, st.length >= 1 && st.every((c) => c.ready && !c.failed && c.w > 300), JSON.stringify(st));
            }
          : undefined,
      });
      bgShots.push({ label: bg, frames });
    }
    sheet.push({ group: 'Fonds', shots: bgShots });

    // Une toile WebGL libère son contexte quand sa scène est loin, et en retrouve un neuf quand on y revient
    // (aperçu, retouche) : même image avant et après le détour.
    {
      const { html, spec, sb } = await composeKit({
        brandId: 'bissap',
        sceneIds: ['statement', 'statement', 'statement', 'statement'],
        slots: [{ title: 'Premier plan' }, { title: 'Deuxième plan' }, { title: 'Troisième plan' }, { title: 'Quatrième plan' }],
        direction: 'kinetic',
        kit: (keys) => baseKit({ background: 'fluid', backdropScenes: [keys[0]] }),
      });
      const page = await browser.newPage();
      try {
        await page.setViewport({ width: spec.width, height: spec.height, deviceScaleFactor: 1 });
        await page.setContent(html, { waitUntil: 'load', timeout: 60000 });
        await page.evaluate(() => (window as any).__IDEM_VIDEO__.ready);
        const shot = async (t: number) => {
          await page.evaluate((x: number) => (window as any).__IDEM_VIDEO__.seek(x), t);
          return Buffer.from(await page.screenshot({ type: 'png' }));
        };
        const live = () => page.evaluate(() => document.querySelectorAll('.gl-host[data-gl-live]').length);
        const early = sb.scenes[0].start + 1.0;
        const a = await shot(early);
        const liveBefore = await live();
        await shot(sb.durationSec - 0.4);
        const liveFar = await live();
        const b = await shot(early);
        const sharpLib = (await import('sharp')).default;
        const [ra, rb] = await Promise.all([sharpLib(a).raw().toBuffer(), sharpLib(b).raw().toBuffer()]);
        let diff = 0;
        for (let k = 0; k < ra.length; k += 4) if (Math.abs(ra[k] - rb[k]) > 8 || Math.abs(ra[k + 1] - rb[k + 1]) > 8 || Math.abs(ra[k + 2] - rb[k + 2]) > 8) diff++;
        check('toile WebGL : libérée quand la scène est loin, neuve quand on y revient', liveBefore === 1 && liveFar === 0, `${liveBefore} → ${liveFar}`);
        check('toile WebGL : même image avant et après le détour', diff / (ra.length / 4) < 0.002, `${((diff / (ra.length / 4)) * 100).toFixed(3)} % de pixels`);
      } finally {
        await page.close();
      }
    }

    const annShots: Shot[] = [];
    for (const ann of ['marker', 'underline', 'circle', 'sketch-circle', 'brush']) {
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

    // Graphiques et dessin : chaque brique du kit, dans une scène écrite comme par l'agent codeur.
    {
      const drawShots: Shot[] = [];
      const brand = brandById('kofi');
      const theme = buildVideoTheme(brand.branding, brand.name);
      const head = (names: string) => `import { useScene, useEngine, useLocalTime, Kinetic, ${names} } from '@idem/kit';\n`;
      const title = `<div className="safe" style={{ justifyContent: 'flex-start' }}><div style={{ width: '70%' }}><Kinetic text={s.slots.title || ''} technique="maskUp" at={0.1} role="headline" fit={[8, 4, 2]} /></div></div>`;
      const scenes: [string, string, string, Record<string, string>][] = [
        ['Chart.js barres', 'ChartJs, numbersIn', `<div style={{ position: 'absolute', left: '8%', right: '8%', top: '34%', bottom: '10%' }}><ChartJs type="bar" values data={{ labels: ['2024', '2025', '2026'], datasets: [{ data: numbersIn(s.slots.sub) }] }} /></div>`, { title: 'Nos ventes progressent', sub: '120 puis 340 puis 610 commandes' }],
        ['Chart.js ligne', 'ChartJs, numbersIn', `<div style={{ position: 'absolute', left: '8%', right: '8%', top: '34%', bottom: '10%' }}><ChartJs type="line" grow="reveal" data={{ labels: ['T1', 'T2', 'T3', 'T4'], datasets: [{ data: numbersIn(s.slots.sub) }] }} /></div>`, { title: 'Une année de croissance', sub: '40, 55, 90 et 130 clients' }],
        ['Chart.js radar', 'ChartJs, numbersIn', `<div style={{ position: 'absolute', left: '12%', right: '12%', top: '30%', bottom: '6%' }}><ChartJs type="radar" data={{ labels: ['Prix', 'Délai', 'Qualité', 'Service', 'Choix'], datasets: [{ data: numbersIn(s.slots.sub) }] }} /></div>`, { title: 'Notre profil', sub: '8, 9, 7, 9 et 6 sur 10' }],
        ['Chart.js treemap', 'ChartJs, numbersIn', `<div style={{ position: 'absolute', left: '8%', right: '8%', top: '32%', bottom: '8%' }}><ChartJs type="treemap" data={{ datasets: [{ tree: numbersIn(s.slots.sub), labels: { display: false } }] }} /></div>`, { title: 'Nos ventes par rayon', sub: '45, 25, 18 et 12 %' }],
        ['Chart.js sankey', 'ChartJs, numbersIn', `<div style={{ position: 'absolute', left: '6%', right: '6%', top: '32%', bottom: '8%' }}><ChartJs type="sankey" data={{ datasets: [{ data: [{ from: 'Web', to: 'Ventes', flow: numbersIn(s.slots.sub)[0] }, { from: 'Boutique', to: 'Ventes', flow: numbersIn(s.slots.sub)[1] }] }] }} /></div>`, { title: 'D’où viennent nos clients', sub: '60 en ligne, 40 en boutique' }],
        ['visx aire', 'GrowArea, numbersIn', `<div style={{ position: 'absolute', left: '6%', right: '6%', top: '36%', bottom: '8%' }}><GrowArea values={numbersIn(s.slots.sub)} /></div>`, { title: 'Une courbe qui monte', sub: '10, 14, 22, 35 et 52' }],
        ['visx jauge', 'DataArc, percentIn', `<div style={{ position: 'absolute', left: '25%', right: '25%', top: '30%', bottom: '6%' }}><DataArc value={percentIn(s.slots.sub) || 0} /></div>`, { title: 'Clients satisfaits', sub: '92 %' }],
        ['carte de l’Afrique', 'AfricaMap', `<div style={{ position: 'absolute', left: '18%', right: '18%', top: '26%', bottom: '4%' }}><AfricaMap highlightIn={s.slots.sub} /></div>`, { title: 'Livrés dans 3 pays', sub: 'Togo, Bénin et Côte d’Ivoire' }],
        ['croquis rough', 'Sketch, progress', `<Sketch draw={{ shape: 'ellipse', cx: 50, cy: 62, w: 70, h: 40 }} p={progress(lt, 0.3, 1)} weight={0.6} />`, { title: 'Dessiné à la main' }],
        ['pinceau', 'Brush, progress', `<Brush points={[[10, 70], [30, 62], [55, 72], [80, 60], [92, 66]]} p={progress(lt, 0.2, 1.2)} size={6} />`, { title: 'Un coup de pinceau' }],
        ['flux de bruit', 'FlowField', `<FlowField seed={4} opacity={0.5} />`, { title: 'Un champ vivant' }],
        ...(['aurora', 'silk', 'plasma', 'fluid', 'mesh', 'topology', 'waves', 'blobs'] as const).map((e) => [`matière ${e}`, 'Shader', `<Shader effect="${e}" strength={0.8} />`, { title: 'La matière en mouvement' }] as [string, string, string, Record<string, string>]),
        ['dégradé animé', 'Gradient', `<Gradient kind="linear" />`, { title: 'Un dégradé qui glisse' }],
        ['réseau de points', 'Network', `<Network count={46} reach={20} />`, { title: 'Un réseau qui se tisse' }],
        ['verre liquide', 'Shader, LiquidGlass', `<Shader effect="mesh" strength={1} /><LiquidGlass x={50} y={44} w={70} h={22}><span style={{ width: 6 * u, height: 6 * u }} /></LiquidGlass>`, { title: 'Le verre qui plie la lumière' }],
        ['morphose de formes', 'Morph', `<div style={{ position: 'absolute', left: '25%', right: '25%', top: '14%', height: '34%' }}><Morph shapes={['circle', 'star', 'heart']} hold={0.4} fade={0.8} fill="var(--hl)" style={{ width: '100%', height: '100%' }} /></div>`, { title: 'La forme qui devient autre' }],
        ['particules : poussière', 'Particles', `<Particles mode="drift" count={40} seed={4} />`, { title: 'Un air qui brille' }],
        ['particules : désintégration', 'Particles, progress', `<Particles mode="dissolve" area={[10, 40, 90, 60]} at={0.3} dur={1.6} count={80} seed={2} />`, { title: 'Ce qui s’efface' }],
        ['Zdog', 'Flat3D', `<div style={{ position: 'absolute', left: '20%', right: '20%', top: '32%', bottom: '6%' }}><Flat3D rotate={{ x: -0.4, y: lt * 0.9 }} items={[{ kind: 'box', width: 30, height: 30, depth: 30, color: 'var(--hl)', shade: 'var(--c-primary)' }, { kind: 'ring', diameter: 56, stroke: 3, color: 'var(--c-accent)', rotate: { x: 1.3 } }]} /></div>`, { title: 'Un objet en 3D plate' }],
      ];
      for (const [label, names, body, slots] of scenes) {
        const tsx = `${head(names)}\nexport default function Scene() {\n  const s = useScene();\n  const { u } = useEngine();\n  const lt = useLocalTime();\n  return (<>${body}${title}</>);\n}\n`;
        const sb = buildStoryboard({ sceneIds: ['statement', 'logo'], slots: [slots, {}], durationSec: 6, style: 'premium', seed: 4, images: [], direction: 'precision' });
        sb.kit = baseKit({});
        (sb.scenes[0] as any).code = { tsx, agent: 'check' };
        const { html, spec } = await composeVideoHtml({ ...(await inlineAssets(sb, theme)), format: 'square', quality: 'standard', mode: 'render' });
        const d0 = sb.scenes[0].duration;
        const frames = await renderCheck(browser, html, spec, [0.25, 0.9, d0 - 0.4], label, {
          mustMove: true,
          probe: async (page) => {
            const res = await page.evaluate(() => ({
              errors: (window as any).__IDEM_SCENE_ERRORS__ || {},
              drawn: !!document.querySelector('section.scene canvas, section.scene svg path, section.scene svg circle, section.scene [data-particles], section.scene .liquid-glass, section.scene [style*="gradient"]'),
              glReady: document.querySelectorAll('.gl-host[data-gl-ready]').length,
              glFailed: document.querySelectorAll('.gl-host[data-gl-failed]').length,
              values: [...document.querySelectorAll('[data-chart-values]')].map((el) => el.getAttribute('data-chart-values')),
              map: document.querySelector('[data-map-highlight]')?.getAttribute('data-map-highlight') || null,
              // Un graphique doit laisser de l'encre sur sa toile (un treemap vidé par une affectation de `data` passait « drawn » ; un radar, fin, couvre ~1,5 %).
              chartInk: (() => {
                const c = document.querySelector('section.scene [data-chart-values] canvas') as HTMLCanvasElement | null;
                if (!c) return null;
                const px = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
                let n = 0;
                for (let k = 3; k < px.length; k += 4) if (px[k] > 40) n++;
                return n / (px.length / 4);
              })(),
            }));
            check(`${label} : la scène codée se rend sans erreur, la brique dessine`, !Object.keys(res.errors).length && res.drawn, JSON.stringify(res.errors).slice(0, 160));
            if (/Shader|ImageFx/.test(names)) check(`${label} : la toile WebGL est prête, sans échec`, res.glReady > 0 && res.glFailed === 0, `${res.glReady} prête(s), ${res.glFailed} en échec`);
            if (res.chartInk != null) check(`${label} : le graphique est dessiné (pas une toile vide)`, res.chartInk > 0.005, `${(res.chartInk * 100).toFixed(1)} % de la toile`);
            if (res.values.length) check(`${label} : les valeurs du graphique viennent des textes`, res.values.every((v) => (JSON.parse(v || '[]') as number[]).length > 0), res.values.join(' '));
            if (res.map) check(`${label} : les pays nommés dans le texte sont mis en valeur (et eux seuls)`, res.map === JSON.stringify(['768', '204', '384']), res.map);
          },
        });
        drawShots.push({ label, frames });
      }
      sheet.push({ group: 'Graphiques et dessin', shots: drawShots });
    }

    // Effets d'image (PixiJS), animation des icônes (graphe), logos de marques, effets 3D : par les chemins du moteur.
    {
      process.env.VIDEO_ALLOW_FILE_URLS = '1';
      const fxPhotos = await makePhotos(path.join(OUT, 'photos'));
      const fxPhoto = `file://${Object.values(fxPhotos)[0]}`;
      const waxBrand = brandById('wax');
      const waxTheme = buildVideoTheme(waxBrand.branding, waxBrand.name);
      const fxShots: Shot[] = [];
      for (const effect of ['rgbSplit', 'shockwave', 'bulge', 'twist', 'zoomBlur', 'pixelate', 'glitch', 'wavy', 'crt']) {
        // « swiss » : la photo est dans un cadre (Media) ; « kinetic » : plein cadre (MediaTreatment).
        for (const dir of ['swiss', 'kinetic'] as DirectionId[]) {
          const sb = buildStoryboard({ sceneIds: ['product', 'logo'], slots: [{ name: 'Pagne Héritage', tagline: 'Tissé à la main' }, {}], durationSec: 6, style: 'premium', seed: 4, images: [fxPhoto], direction: dir });
          sb.kit = baseKit({ imageFx: effect });
          const { html, spec } = await composeVideoHtml({ ...(await inlineAssets(sb, waxTheme)), format: 'story', quality: 'standard', mode: 'render' });
          check(`effet photo ${effect} · ${dir} : addon-pixi chargé`, html.includes('data-addon="pixi"'));
          const frames = await renderCheck(browser, html, spec, [0.5, 1.3, 2.4], `effet photo ${effect} · ${dir}`, {
            mustMove: true,
            probe: async (page) => {
              const st = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.gl-host[data-image-fx]')].map((c) => ({ ready: !!c.dataset.glReady, failed: !!c.dataset.glFailed })));
              check(`effet photo ${effect} · ${dir} : la toile PixiJS est prête, sans échec`, st.length === 1 && st[0].ready && !st[0].failed, JSON.stringify(st));
            },
          });
          fxShots.push({ label: `${effect} · ${dir}`, frames });
        }
      }
      sheet.push({ group: 'Effets sur la photo (PixiJS)', shots: fxShots });

      // Animation des pictogrammes : posée, l'icône doit être EXACTEMENT l'icône fixe.
      const iconShots: Shot[] = [];
      const shootAt = async (html: string, spec: { width: number; height: number }, t: number): Promise<Buffer> => {
        const page = await browser.newPage();
        try {
          await page.setViewport({ width: spec.width, height: spec.height, deviceScaleFactor: 1 });
          await page.setContent(html, { waitUntil: 'load', timeout: 60000 });
          await page.evaluate(() => (window as any).__IDEM_VIDEO__.ready);
          await page.evaluate((x: number) => (window as any).__IDEM_VIDEO__.seek(x), t);
          return Buffer.from(await page.screenshot({ type: 'png' }));
        } finally {
          await page.close();
        }
      };
      const sharpLib = (await import('sharp')).default;
      for (const [set, mode] of [['lucide', 'draw'], ['phosphor-fill', 'draw'], ['tabler', 'stagger'], ['heroicons-solid', 'pop'], ['phosphor-duotone', 'draw']] as [IconSetId, string][]) {
        const make = (iconMotion: string) =>
          composeKit({
            brandId: 'kofi',
            sceneIds: ['benefits', 'logo'],
            slots: [{ title: 'Pourquoi Kofi', b1: 'Livraison en 24 h', b2: 'Paiement mobile money', b3: 'Support 7j/7' }, {}],
            direction: 'swiss',
            kit: (keys) => baseKit({ iconSet: set, icons: { [keys[0]]: ['delivery', 'payment', 'support'] }, iconMotion }),
          });
        const animated = await make(mode);
        const fixed = await make('none');
        const end = animated.sb.scenes[0].duration - 0.3;
        const [a, b] = await Promise.all([shootAt(animated.html, animated.spec, end), shootAt(fixed.html, fixed.spec, end)]);
        const [ra, rb] = await Promise.all([sharpLib(a).raw().toBuffer(), sharpLib(b).raw().toBuffer()]);
        let diff = 0;
        for (let k = 0; k < ra.length; k += 4) if (Math.abs(ra[k] - rb[k]) > 8 || Math.abs(ra[k + 1] - rb[k + 1]) > 8 || Math.abs(ra[k + 2] - rb[k + 2]) > 8) diff++;
        check(`icônes ${set} · ${mode} : posées, identiques aux icônes fixes`, diff / (ra.length / 4) < 0.001, `${((diff / (ra.length / 4)) * 100).toFixed(3)} % de pixels`);
        const frames = await renderCheck(browser, animated.html, animated.spec, [0.45, 0.9, 1.4], `icônes animées ${set} · ${mode}`, { mustMove: true });
        iconShots.push({ label: `${set} · ${mode}`, frames });
      }
      sheet.push({ group: 'Pictogrammes animés (SVG)', shots: iconShots });

      // Logos de marques : une marque NOMMÉE dans le texte donne son logo (Simple Icons), tracé sous l'appel.
      {
        const { html, spec } = await composeKit({
          brandId: 'bissap',
          sceneIds: ['cta', 'logo'],
          slots: [{ title: 'Commandez votre pack', action: 'Écrivez-nous', contact: 'WhatsApp, Instagram ou Orange Money' }, {}],
          direction: 'precision',
          kit: () => baseKit({}),
        });
        const frames = await renderCheck(browser, html, spec, [0.6, 1.6, 2.6], 'logos de marques nommées', {
          mustMove: true,
          probe: async (page) => {
            const n = await page.evaluate(() => document.querySelectorAll('section.scene[data-scene="cta"] svg').length);
            check('logos de marques : WhatsApp, Instagram et Orange tracés sous l’appel', n >= 3, `${n} SVG`);
          },
        });
        iconShots.push({ label: 'marques nommées', frames });
      }

      // Effets 3D supplémentaires (premium) : profondeur de champ, franges de couleur, vignettage.
      const fx3dShots: Shot[] = [];
      for (const fxs of [['smaa', 'dof'], ['smaa', 'bloom', 'chromatic'], ['smaa', 'vignette']]) {
        const { html, spec, sb } = await composeKit({
          brandId: 'kofi',
          sceneIds: ['showcase3d', 'logo'],
          slots: [{ title: 'Le produit en 3D', sub: 'Studio' }, {}],
          direction: 'cinematic',
          kit: () => baseKit({ postfx: fxs }),
        });
        const d0 = sb.scenes[0].duration;
        const frames = await renderCheck(browser, html, spec, [0.8, 1.6, d0 - 0.4], `3D ${fxs.join('+')}`, { mustMove: true });
        fx3dShots.push({ label: fxs.join(' + '), frames });
      }
      sheet.push({ group: 'Effets 3D (postprocessing)', shots: fx3dShots });
    }

    // Mises en scène des plans : chacune sur une vraie photo (et un vrai clip s'il y en a un en cache).
    {
      process.env.VIDEO_ALLOW_FILE_URLS = '1';
      const photos = await makePhotos(path.join(OUT, 'photos'));
      const clip = (() => {
        const dir = path.resolve(process.cwd(), 'tmp/motion-video-examples/storage');
        const walk = (d: string): string[] => (fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.webm') ? [path.join(d, e.name)] : [])) : []);
        return walk(dir)[0];
      })();
      const treatmentShots: Shot[] = [];
      const plan: [string, DirectionId][] = [['split', 'swiss'], ['window', 'editorial'], ['blinds', 'brutal'], ['magazine', 'editorial'], ['knockout', 'kinetic'], ['inline', 'collage'], ['duotone', 'drenched'], ['broadcast', 'precision'], ['cinema', 'cinematic']];
      for (const [kind, dir] of plan) {
        for (const format of ['story', 'landscape'] as const) {
          const brand = brandById('bissap');
          const theme = buildVideoTheme(brand.branding, brand.name);
          const useClip = !!clip && format === 'story';
          const sb = buildStoryboard({
            sceneIds: ['footage', 'logo'],
            slots: [{ title: 'Pressé chaque matin à Dakar', sub: 'Bissap, gingembre, baobab' }, {}],
            durationSec: 6,
            style: 'premium',
            seed: 4,
            images: [`file://${photos[Object.keys(photos)[0]]}`],
            videos: useClip ? [`file://${clip}`] : [],
            direction: dir,
          });
          sb.kit = baseKit({ treatments: { [sb.scenes[0].key]: kind } });
          if (kind === 'knockout' && !['light', 'tint', 'deep'].includes(sb.scenes[0].surface)) sb.scenes[0].surface = 'light';
          const { html, spec } = await composeVideoHtml({ ...(await inlineAssets(sb, theme)), format, quality: 'standard', mode: 'render' });
          const f = sb.scenes[0];
          const frames = await renderCheck(browser, html, spec, [0.15, 0.8, Math.min(f.duration - 0.3, 2.6)], `plan ${kind} · ${dir} · ${format}${useClip ? ' (clip)' : ''}`, { mustMove: true, clip: useClip });
          treatmentShots.push({ label: `${kind} · ${format}${useClip ? ' · clip' : ''}`, frames });
        }
      }
      sheet.push({ group: 'Mises en scène des plans', shots: treatmentShots });
    }

    // Vocabulaire élargi : chaque nouvelle entrée de texte, chaque famille d'entrée des éléments, chaque caméra.
    {
      const vocabShots: Shot[] = [];
      const brand = brandById('kofi');
      const theme = buildVideoTheme(brand.branding, brand.name);
      const render = async (label: string, dir: DirectionId, ids: string[], slots: Record<string, string>[], tweak: (sb: any) => void, times: number[]) => {
        const sb = buildStoryboard({ sceneIds: ids, slots, durationSec: 6, style: 'premium', seed: 21, images: [], direction: dir });
        sb.kit = baseKit({});
        tweak(sb);
        const { html, spec } = await composeVideoHtml({ ...(await inlineAssets(sb, theme)), format: 'square', quality: 'standard', mode: 'render' });
        const frames = await renderCheck(browser, html, spec, times, label, { mustMove: true });
        vocabShots.push({ label, frames });
      };
      for (const tech of ['springUp', 'wave', 'stretch', 'rotateX', 'zoomWords', 'skewIn', 'scatter', 'outlineFill', 'shine', 'glitch', 'shuffle', 'gradientFlow']) {
        await render(`entrée ${tech}`, 'kinetic', ['statement', 'logo'], [{ title: 'Le studio qui livre vite', sub: 'Remote, depuis Lomé' }, {}], (sb) => (sb.scenes[0].motion.headline = tech), [0.1, 0.45, 2.4]);
      }
      for (const family of ['spring', 'flip', 'unfold', 'skew', 'iris']) {
        await render(`éléments ${family}`, 'swiss', ['benefits', 'logo'], [{ title: 'Pourquoi Kofi', b1: 'Livraison en 24 h', b2: 'Paiement mobile', b3: 'Support 7j/7' }, {}], (sb) => (sb.kit.entrance = family), [0.3, 1.0, 2.8]);
      }
      for (const camera of ['tilt', 'pull', 'rise']) {
        await render(`caméra ${camera}`, 'precision', ['statement', 'logo'], [{ title: 'Le code propre, livré', sub: 'Studio logiciel' }, {}], (sb) => (sb.kit.camera = camera), [0.2, 1.4, 3.0]);
      }
      sheet.push({ group: 'Vocabulaire élargi', shots: vocabShots });
    }

    // Mises en page (archétypes) : chacune, dans les trois formats, posée sur une grille de tempo.
    {
      const layoutShots: Shot[] = [];
      const brand = brandById('wax');
      const theme = buildVideoTheme(brand.branding, brand.name);
      const cases: [string, DirectionId, string, Record<string, string>][] = [
        ['glassPanel', 'cinematic', 'statement', { title: 'Le verre qui plie la lumière', sub: 'Une réfraction en direct' }],
        ['wordStack', 'brutal', 'hook', { title: 'Le wax qui vous ressemble vraiment' }],
        ['marqueeBack', 'kinetic', 'statement', { title: 'Tissé à la main à Lomé', sub: 'Depuis 2019' }],
        ['bigNumber', 'swiss', 'stat', { value: '87 %', label: 'de clientes fidèles' }],
        ['diagonalBand', 'kinetic', 'cta', { title: 'Venez essayer en boutique', action: 'Réserver', contact: 'wax-lome.tg' }],
        ['circleStage', 'precision', 'stat', { value: '12 000', label: 'pagnes vendus cette année' }],
        ['chartRing', 'precision', 'stat', { value: '87 %', label: 'de clientes reviennent dans l’année' }],
        ['dataArc', 'cinematic', 'stat', { value: '72 %', label: 'des commandes livrées en 24 h' }],
        ['barCompare', 'swiss', 'offer', { price: '15 000 F', oldPrice: '20 000 F', badge: '-25 %', note: 'Jusqu’à dimanche seulement' }],
        // Le cas qui sortait du cadre en carré : cercle plein + titre long + sous-titre + bouton.
        ['circleStage', 'precision', 'cta', { title: 'Le wax authentique, livré chez vous', action: 'Commander', contact: 'wax-lome.tg' }],
        ['circleStage', 'editorial', 'statement', { title: 'Le wax authentique, livré chez vous partout', sub: 'Tissé à la main à Lomé, depuis 2019' }],
        ['splitBlock', 'swiss', 'benefits', { title: 'Pourquoi nous choisir', b1: 'Coton certifié', b2: 'Teintures fixes', b3: 'Retouches offertes' }],
        ['layeredCards', 'collage', 'event', { title: 'Défilé de lancement', date: 'Samedi 14 juin', time: '19 h', place: 'Lomé, quartier Bè' }],
        ['gridCards', 'precision', 'benefits', { title: 'Le wax premium', b1: 'Coton certifié', b2: 'Teintures fixes', b3: 'Retouches offertes' }],
        ['checklist', 'editorial', 'benefits', { title: 'Ce qui change tout', b1: 'Coton certifié', b2: 'Teintures fixes', b3: 'Retouches offertes' }],
        ['quoteBig', 'editorial', 'quote', { quote: 'Le plus beau wax que j’ai porté, et il tient au lavage.', author: 'Afi, Lomé' }],
        ['priceBurst', 'collage', 'offer', { price: '15 000 F', oldPrice: '20 000 F', badge: '-25 %', note: 'Jusqu’à dimanche' }],
        ['ticker', 'brutal', 'cta', { title: 'La collection arrive samedi', action: 'Réserver', contact: 'wax-lome.tg' }],
        ['spotlightWord', 'cinematic', 'statement', { title: 'Chaque motif raconte une histoire', sub: 'Collection Héritage' }],
        ['frameOverlap', 'editorial', 'hook', { title: 'Un tissu, mille histoires' }],
      ];
      for (const [layout, dir, sceneId, slots] of cases) {
        for (const format of ['story', 'square', 'landscape'] as const) {
          const sb = buildStoryboard({ sceneIds: [sceneId, 'logo'], slots: [slots, {}], durationSec: 6, style: 'premium', seed: 5, images: [], direction: dir });
          sb.kit = baseKit({});
          sb.scenes[0].layout = layout;
          sb.beat = { bpm: 120, offset: 0, confidence: 1 };
          const { html, spec } = await composeVideoHtml({ ...(await inlineAssets(sb, theme)), format, quality: 'standard', mode: 'render' });
          // Une feuille de polices externe qui tarde bloquait le chargement de la page (export en échec) :
          // en rendu, les polices de la charte sont embarquées.
          if (ONLINE && layout === 'wordStack' && format === 'story') check('rendu : polices de la charte embarquées, aucune feuille externe', !/<link[^>]+stylesheet/i.test(html) && /@font-face/.test(html));
          const d0 = sb.scenes[0].duration;
          const label = `mise en page ${layout} · ${format}`;
          const frames = await renderCheck(browser, html, spec, [0.15, 0.9, d0 - 0.35], label, {
            mustMove: true,
            probe: async (page) => {
              // Posée : la mise en page est bien rendue, et aucun texte ne sort du cadre.
              const res = await page.evaluate((w: number, h: number) => {
                const sec = document.querySelector<HTMLElement>('section.scene[style*="visible"]');
                const marker = sec?.className || '';
                const out = [...(sec?.querySelectorAll<HTMLElement>('.kt') || [])]
                  .filter((el) => !el.closest('.ly-bignum,.ly-marquee,.ly-ticker'))
                  .filter((el) => {
                    const r = el.getBoundingClientRect();
                    return r.width > 0 && (r.left < -2 || r.top < -2 || r.right > w + 2 || r.bottom > h + 2);
                  })
                  .map((el) => (el.textContent || '').slice(0, 24));
                return { marker, out };
              }, spec.width, spec.height);
              check(`${label} : rendue par l’archétype`, res.marker.includes(`ly-${layout}`), res.marker);
              check(`${label} : aucun texte hors du cadre`, res.out.length === 0, res.out.join(' | '));
            },
          });
          layoutShots.push({ label: `${layout} · ${format}`, frames });
        }
      }
      sheet.push({ group: 'Mises en page', shots: layoutShots });
    }

    // Transitions du catalogue élargi : chacune autour de la coupe (avant, pendant, après, posée).
    {
      const trShots: Shot[] = [];
      const brand = brandById('kofi');
      const theme = buildVideoTheme(brand.branding, brand.name);
      for (const kind of ['shapeWipe', 'stripes', 'split', 'liquid', 'zoomBlur', 'cube', 'glitch']) {
        const sb = buildStoryboard({ sceneIds: ['hook', 'statement', 'logo'], slots: [{ title: 'Le studio qui livre vite' }, { title: 'Du code propre, testé', sub: 'Depuis Lomé' }, {}], durationSec: 6, style: 'premium', seed: 13, images: [], direction: 'kinetic' });
        sb.kit = baseKit({});
        sb.scenes[1].motion = { ...sb.scenes[1].motion!, transition: kind as any };
        const { html, spec } = await composeVideoHtml({ ...(await inlineAssets(sb, theme)), format: 'square', quality: 'standard', mode: 'render' });
        const c = sb.scenes[1].start;
        const frames = await renderCheck(browser, html, spec, [c - 0.16, c, c + 0.12, c + 1.1], `transition ${kind}`, { mustMove: true });
        trShots.push({ label: kind, frames });
      }
      sheet.push({ group: 'Transitions (catalogue élargi)', shots: trShots });
    }

    // Grand moment : l'effet que la direction donne à LA scène choisie.
    const accentShots: Shot[] = [];
    for (const [effect, dir] of [['punch', 'brutal'], ['giant', 'swiss'], ['hold', 'cinematic'], ['flip', 'drenched'], ['burst', 'kinetic']] as [string, DirectionId][]) {
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
      const frames = await renderCheck(browser, html, spec, [s1.start + 0.05, s1.start + 0.25, s1.start + s1.duration * 0.7], `grand moment ${effect} · ${dir}`, {
        probe:
          effect === 'burst'
            ? async (page) => {
                // Les instants sont posés un à un côté Node (une fonction async transpilée n'existe pas dans la page).
                const counts: number[] = [];
                for (const t of [s1.start + 0.05, s1.start + 0.7, s1.start + s1.duration * 0.9]) {
                  await page.evaluate((x: number) => (window as any).__IDEM_VIDEO__.seek(x), t);
                  counts.push(await page.evaluate(() => Number(document.querySelector('section.scene[data-scene="statement"] [data-particles]')?.getAttribute('data-particles') || 0)));
                }
                check('éclat : les particules jaillissent puis s’éteignent', counts[1] > 10 && counts[2] === 0, counts.join(' → '));
              }
            : undefined,
      });
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

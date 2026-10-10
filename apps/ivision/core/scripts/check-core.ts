/**
 * `npm run check --workspace=@idem/ivision-core` — le moteur partagé, SANS IDEM.
 *
 * Tout ce qui suit tourne avec des ports d'hôte factices (stockage sur disque, modèles simulés) :
 * c'est la preuve que le core s'exécute ailleurs que dans l'API IDEM — dans l'API iVision.
 *
 *  1. Scan de site : une page locale (couleurs, variables CSS, polices, logo SVG, images, textes)
 *     → palette, trois propositions, typographie, logo, ton (modèle simulé).
 *  2. Vidéo modèle : une vidéo synthétique (ffmpeg) à trois plans coupés net → trois plans aux
 *     bonnes durées ; la vision simulée les décrit ; le plan de reproduction en tire les scènes.
 *  3. Reproduction : une vidéo créée par le service du core avec ce modèle garde ses plans, ses
 *     durées (à l'échelle), ses mises en page et ses coupes.
 *  4. Visuel : un flyer composé par le code (cran Low) et rendu, mesuré, photographié.
 */
process.env.VIDEO_MUSIC_OPENVERSE = 'off';
process.env.VIDEO_MUSIC_CCMIXTER = 'off';
process.env.VIDEO_SFX_OFFLINE = '1';
process.env.RENDER_ALLOWED_HOSTS = '127.0.0.1,localhost';
delete process.env.PEXELS_API_KEY;
import { spawnSync } from 'child_process';
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import { configureCore } from '../src/runtime/host';
import { brandKitFromScan, scanWebsite } from '../src/site/site-scanner';
import { analyzeReferenceVideo, shotsFromCuts } from '../src/reference/reference.analyzer';
import { planFromBlueprint } from '../src/reference/reference.plan';
import { MotionVideoService } from '../src/video/motionVideo.service';
import type { VideoStore } from '../src/video/video.store';
import type { MotionVideo } from '../src/video/video.model';
import { extractFacts } from '../src/video/video.copy';
import { composeVisual } from '../src/visual/visual.composer';
import { contrastRatio } from '../src/design/color';

let failures = 0;
let passes = 0;
function check(label: string, ok: boolean, detail = '') {
  if (ok) passes++;
  else failures++;
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
}
const section = (t: string) => console.log(`\n${t}`);
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'ivision-core-check-'));

// Hôte factice : fichiers locaux, aucun réseau, aucun modèle.
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

const SITE = `<!doctype html><html lang="fr"><head><title>Kora Café — Torréfacteur à Abidjan</title>
<meta name="description" content="Café de spécialité torréfié chaque semaine à Abidjan, livré chez vous.">
<meta property="og:site_name" content="Kora Café"><meta name="theme-color" content="#b4532a">
<style>:root{--brand-primary:#b4532a;--brand-accent:#f2c14e}
body{margin:0;background:#fbf7f2;color:#2a1d17;font-family:Georgia,serif}
header{display:flex;align-items:center;justify-content:space-between;padding:24px 48px;background:#fbf7f2}
h1{font-family:'Playfair Display',Georgia,serif;font-size:64px;color:#2a1d17;margin:0}
.hero{padding:96px 48px;background:#fbf7f2} .cta{display:inline-block;background:#b4532a;color:#fff;padding:18px 32px;font-family:Arial,sans-serif;font-weight:700}
section.dark{background:#3b2a22;color:#fbf7f2;padding:80px 48px} p{font-family:Inter,Arial,sans-serif;font-size:18px;max-width:640px}
a{color:#b4532a}</style></head><body>
<header><a href="/" class="logo"><svg class="logo" width="120" height="40" viewBox="0 0 120 40"><circle cx="20" cy="20" r="16" fill="#b4532a"/><rect x="44" y="12" width="70" height="16" fill="#2a1d17"/></svg></a><nav><a href="/a-propos">À propos</a></nav></header>
<div class="hero"><h1>Le café qui réveille Abidjan</h1><p>Des grains d'Afrique de l'Ouest, torréfiés chaque semaine dans notre atelier de Cocody et livrés en 24 h partout à Abidjan.</p><a class="cta" href="#">Commander</a></div>
<section class="dark"><h2>Torréfié ici, chaque lundi</h2><p>Nous travaillons en direct avec des coopératives de Man et de Daloa, pour un café juste et frais, payé au bon prix aux producteurs.</p></section>
</body></html>`;

function serve(html: string): Promise<{ url: string; close: () => void }> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(req.url?.startsWith('/a-propos') ? html.replace('Le café qui réveille Abidjan', 'Notre histoire') : html);
    });
    server.listen(0, '127.0.0.1', () => resolve({ url: `http://127.0.0.1:${(server.address() as any).port}/`, close: () => server.close() }));
  });
}

/** Une vidéo synthétique : trois aplats de couleur, coupés net, avec un carré qui bouge. */
function syntheticVideo(file: string) {
  const seg = (color: string, d: number, i: number) => `color=c=${color}:s=540x960:d=${d},format=yuv420p[b${i}];color=c=white:s=120x120:d=${d}[w${i}];[b${i}][w${i}]overlay=x='40+t*120':y=400[v${i}]`;
  const filter = `${seg('0xb4532a', 2, 0)};${seg('0x2a6fb4', 3, 1)};${seg('0x3bb45a', 2.5, 2)};[v0][v1][v2]concat=n=3:v=1:a=0[out]`;
  const r = spawnSync(process.env.FFMPEG_PATH || 'ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-filter_complex', filter, '-map', '[out]', '-r', '30', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', file]);
  if (r.status !== 0) throw new Error(`ffmpeg: ${r.stderr}`);
}

/** Un hôte de vidéos en mémoire, comme celui d'iVision (une marque, ses vidéos). */
class MemoryStore implements VideoStore {
  videos: MotionVideo[] = [];
  constructor(private readonly kit: any) {}
  async loadBrand() {
    return { brandName: 'Kora Café', branding: this.kit, voice: { businessType: 'torréfacteur', tone: 'chaleureux', valueProposition: 'Café de spécialité torréfié chaque semaine', keywords: ['café', 'Abidjan'], language: 'fr' }, visuals: [], videos: this.videos };
  }
  async listVideos() {
    return JSON.parse(JSON.stringify(this.videos));
  }
  async saveVideo(_u: string, _p: string, video: MotionVideo) {
    this.videos = [...this.videos.filter((v) => v.id !== video.id), JSON.parse(JSON.stringify(video))];
  }
  async mutateVideo(_u: string, _p: string, id: string, mutate: (v: MotionVideo) => MotionVideo) {
    let out: MotionVideo | null = null;
    this.videos = this.videos.map((v) => (v.id === id ? (out = mutate(v)) : v));
    return out;
  }
  async removeVideo() {
    return true;
  }
  async runVideoTieredPrompt(_u: string, _s: string, user: string) {
    // Rédacteur simulé : chaque case demandée reçoit un texte court et fondé.
    return [...user.matchAll(/^(\d+)\.([a-zA-Z0-9]+) \(max (\d+)/gm)].map((m) => `${m[1]}.${m[2]}: ${({ title: 'Le café qui réveille', sub: 'Torréfié chaque lundi', action: 'Commander', tagline: 'Kora Café', l1: 'Frais', l2: 'Local', label: 'livré à Abidjan', value: '24 h' } as Record<string, string>)[m[2]] || 'Café frais'}`.slice(0, Number(m[3]))).join('\n');
  }
}

(async () => {
  console.log('Moteur partagé iVision — sans IDEM\n');

  // ── 1 ──
  section('1. Scan de site');
  const site = await serve(SITE);
  let kit: any;
  try {
    const scan = await scanWebsite({
      url: site.url,
      maxPages: 1,
      textModel: async () => '{"brandName":"Kora Café","businessType":"torréfacteur de café","valueProposition":"Un café de spécialité torréfié chaque semaine à Abidjan.","tone":"chaleureux, artisanal, fier","keywords":["café","torréfaction","Abidjan","coopératives","frais"],"language":"fr"}',
    });
    check(`nom et langue : ${scan.brandName} (${scan.language})`, scan.brandName === 'Kora Café' && scan.language === 'fr');
    check(`primaire = la couleur d'action du site (${scan.palette.primary})`, scan.palette.primary === '#b4532a', JSON.stringify(scan.palette));
    check(`fond clair et texte lisible (${scan.palette.background} / ${scan.palette.text}, ${contrastRatio(scan.palette.text, scan.palette.background).toFixed(1)}:1)`, contrastRatio(scan.palette.text, scan.palette.background) >= 7);
    check(`trois propositions de palette (${scan.palettes.map((p) => p.id).join(', ')}), toutes lisibles`, scan.palettes.length === 3 && scan.palettes.every((p) => contrastRatio(p.colors.text, p.colors.background) >= 4.5));
    check(`typographie : titres ${scan.typography.display}, texte ${scan.typography.body} (vu : ${scan.typography.original.display} / ${scan.typography.original.body})`, scan.typography.display === 'Playfair Display' && scan.typographies.length === 3);
    check(`logo SVG de l'en-tête trouvé`, scan.logo.source === 'inline-svg' && /<svg/.test(scan.logo.svg || ''));
    check(`ton et promesse lus par le modèle (${scan.voice.tone})`, scan.voice.businessType === 'torréfacteur de café' && (scan.voice.keywords || []).length >= 3);
    check(`page interne visitée (${scan.pages.length} pages)`, scan.pages.length === 2);
    kit = brandKitFromScan(scan, { palette: 'contrast', typography: 'pairing' });
    check('BrandKit : même forme qu’une charte IDEM', !!kit.colors?.colors?.primary && !!kit.typography?.primary?.family && !!kit.logo?.svg);
  } finally {
    site.close();
  }

  // ── 2 ──
  section('2. Vidéo modèle');
  check('plans tirés des coupes : fusion des plans < 0,6 s, longs plans découpés en temps', JSON.stringify(shotsFromCuts([2, 2.3, 5], 13)) === JSON.stringify([{ start: 0, duration: 2.3 }, { start: 2.3, duration: 2.7 }, { start: 5, duration: 4 }, { start: 9, duration: 4 }]), JSON.stringify(shotsFromCuts([2, 2.3, 5], 13)));
  const ref = path.join(OUT, 'reference.mp4');
  syntheticVideo(ref);
  const visionAnswers = [
    '{"role":"hook","media":"none","layout":"poster-stack","textMotion":"stack","camera":"push","background":"brand","texts":[{"role":"headline","words":4,"position":"center"}],"energy":"high","description":"Huge stacked words slam in one by one on the brand colour, camera pushes in."}',
    '{"role":"proof","media":"none","layout":"giant-number","textMotion":"scale-blur","transitionIn":"flash-cut","camera":"still","background":"brand","texts":[{"role":"number","words":1,"position":"center"},{"role":"support","words":3,"position":"bottom"}],"energy":"high","description":"A giant number rolls up and fills the frame, label under it."}',
    '{"role":"signature","media":"none","layout":"logo","textMotion":"fade","transitionIn":"iris","camera":"still","background":"light","texts":[],"energy":"calm","description":"The logo draws itself in the centre."}',
  ];
  let calls = 0;
  const blueprint = await analyzeReferenceVideo(ref, { vision: async (_b64, _m, instruction) => visionAnswers[Number(instruction.match(/shot (\d+) of/)?.[1] || 1) - 1] ?? visionAnswers[(calls++) % 3] });
  check(`${blueprint.shots.length} plans aux bonnes durées (${blueprint.shots.map((s) => s.duration.toFixed(1)).join(' + ')} s)`, blueprint.shots.length === 3 && Math.abs(blueprint.shots[0].duration - 2) < 0.2 && Math.abs(blueprint.shots[1].duration - 3) < 0.2 && Math.abs(blueprint.shots[2].duration - 2.5) < 0.25);
  check('lu par la vision dans le vocabulaire du moteur (mises en page, entrées, coupes)', blueprint.source === 'vision' && blueprint.shots[0].layout === 'poster-stack' && blueprint.shots[1].transitionIn === 'flashCut' && blueprint.shots[0].textMotion === 'stackPush');
  check('une planche par plan (aperçu, critique comparée)', blueprint.shots.every((s) => (s.sheet?.length || 0) > 2000));
  const facts = extractFacts('Plus de 500 clients chaque mois, café livré à Abidjan');
  const refPlan = planFromBlueprint(blueprint, { facts, media: { images: 0, videos: 0, models: 0, lotties: 0 }, durationSec: 15 });
  check(`plan de reproduction : ${refPlan.sceneIds.join(' › ')}, ${refPlan.durations.join(' + ')} = 15 s`, refPlan.sceneIds.join() === 'hook,stat,logo' && Math.abs(refPlan.durations.reduce((a, b) => a + b, 0) - 15) < 0.01 && refPlan.patterns[0] === 'posterStack');

  // ── 3 ──
  section('3. Reproduction par le service vidéo du core');
  const store = new MemoryStore(kit);
  const service = new MotionVideoService(store, undefined, () => async () => '', () => undefined, undefined);
  const video = await service.createVideo(
    'u',
    'brand-1',
    { brief: { message: 'Plus de 500 clients chaque mois : notre café livré à Abidjan', musicMood: 'none', sfx: false, allowStock: false, allowGenerate: false } as any, scope: { durationSec: 15, formats: ['story'], quality: 'standard' }, creativity: 'low', reference: blueprint },
    0
  );
  const scenes = video.storyboard.scenes;
  check(`mêmes plans que le modèle : ${scenes.map((s) => s.sceneId).join(' › ')}`, scenes.map((s) => s.sceneId).join() === 'hook,stat,logo');
  check(`mêmes proportions : ${scenes.map((s) => s.duration.toFixed(1)).join(' + ')} s`, Math.abs(scenes[1].duration / scenes[0].duration - 1.5) < 0.35);
  check(`mises en page du modèle : ${scenes.map((s) => s.layout || '-').join(', ')}`, scenes[0].layout === 'wordStack' && scenes[1].layout === 'bigNumber');
  check(`coupes du modèle : ${scenes.map((s) => s.motion?.transition || '-').join(', ')}`, scenes[1].motion?.transition === 'flashCut' && scenes[2].motion?.transition === 'iris');
  check('rapport : la vidéo modèle est notée', video.storyboard.creative?.reference?.shots === 3 && !video.storyboard.creative?.accent);

  // ── 4 ──
  section('4. Visuel composé par le code (cran Low), sans IDEM');
  const context = {
    brandName: 'Kora Café',
    businessType: 'torréfacteur',
    tone: 'chaleureux',
    keywords: ['café'],
    language: 'fr',
    branding: { primary: kit.colors.colors.primary, secondary: kit.colors.colors.secondary, accent: kit.colors.colors.accent, background: kit.colors.colors.background, text: kit.colors.colors.text, primaryFont: kit.typography.primary.family, secondaryFont: kit.typography.secondary.family },
  };
  const composed = await composeVisual({ runPrompt: async () => '' }, 'u', 'brand-1', { id: 'c1', title: 'Le café qui réveille Abidjan', description: 'Torréfié chaque lundi, livré en 24 h.' }, context, 'square', 'check', 'check:1', undefined, true, { creativity: 'low' });
  fs.writeFileSync(path.join(OUT, 'visual.png'), composed.png);
  const visualText = composed.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  check(`visuel rendu et mesuré (${composed.png.length} octets, score ${composed.audit.score}/100)`, composed.png.length > 10000 && composed.audit.score >= 70 && /café qui r(é|&eacute;)veille/i.test(visualText), visualText.slice(0, 160));

  section('Moteur d’affiches — gabarits dessinés par le code, rendu mesuré');
  {
    const sharp = (await import('sharp')).default;
    const { POSTER_TEMPLATES } = await import('../src/visual/poster/poster.templates');
    const { renderPoster, posterFonts } = await import('../src/visual/poster/poster.render');
    const { specFor, schemesOf } = await import('../src/visual/poster/poster.spec');
    const { posterImage, analyzeLogo } = await import('../src/visual/poster/poster.images');
    // Une photo et un logo synthétiques (aucun réseau).
    const photoFile = path.join(OUT, 'photo.jpg');
    await sharp({ create: { width: 1200, height: 900, channels: 3, background: '#c9a27a' } })
      .composite([{ input: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900"><circle cx="760" cy="380" r="220" fill="#3b2a20"/><rect x="0" y="700" width="1200" height="200" fill="#5d7a4a"/></svg>'), top: 0, left: 0 }])
      .jpeg()
      .toFile(photoFile);
    const logoFile = path.join(OUT, 'logo.png');
    await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="200"><rect x="40" y="40" width="120" height="120" rx="24" fill="#d6246e"/><text x="190" y="130" font-family="Arial" font-weight="700" font-size="72" fill="#1d1d1f">Kofi</text></svg>')).png().toFile(logoFile);
    const photo = await posterImage(`file://${photoFile}`, 'brand');
    const logo = await analyzeLogo(`file://${logoFile}`);
    check('photo synthétique lue (point d’intérêt, proportions)', !!photo && photo.aspect > 1.2 && photo.focal.x > 0.4, JSON.stringify(photo?.focal));
    check('logo analysé (encre sombre, marges rognées)', logo.ink === 'dark' || logo.ink === 'color', `${logo.ink} ${logo.aspect.toFixed(2)}`);
    const fonts = posterFonts({ primaryFont: 'Poppins', secondaryFont: 'Inter' });
    const palette = { primary: '#d6246e', secondary: '#2b2d42', accent: '#ffb703', background: '#ffffff', text: '#1d1d1f' };
    const copies: Record<string, any> = {
      event: { kicker: 'Kofi Live', headline: 'La tech au féminin prend le micro', sub: 'Scène ouverte, témoignages et rencontres.', facts: [{ kind: 'date', text: 'Samedi 12 oct.' }, { kind: 'time', text: '18h00' }, { kind: 'place', text: 'Plateau, Abidjan' }], emphasis: 3 },
      promo: { headline: 'Sur toutes nos formations', facts: [{ kind: 'date', text: 'Jusqu’au 31 octobre' }], offer: '−30 %' },
      quote: { headline: 'Elles racontent Kofi', facts: [], quote: { text: 'Kofi m’a donné le courage de lancer ma startup.', author: 'Awa K.' } },
    };
    const failed: string[] = [];
    let rendered = 0;
    for (const format of ['square', 'story', 'banner'] as const) {
      for (const t of POSTER_TEMPLATES) {
        const copy = t.id === 'offer' ? copies.promo : t.id === 'quote' ? copies.quote : copies.event;
        const input = { format, copy, palette, image: t.needsImage || t.id === 'event' ? photo! : undefined, extraImages: [photo!, photo!], allowDark: false, logo, brandName: 'Kofi', language: 'fr' };
        const schemes = schemesOf(input as any);
        if (schemes.some((x) => x.id === 'ink')) failed.push(`${format}/${t.id} fond sombre sans demande`);
        const spec = specFor(input as any, { template: t.id, scheme: t.schemes.find((id) => schemes.some((x) => x.id === id)) || 'paper', mirror: false, treatment: 'natural' }, schemes);
        if (!spec || (t.needs && !t.needs(spec))) continue;
        const res = await renderPoster(spec, t.render(spec), fonts);
        rendered++;
        if (res.measure.blocking || res.measure.score < 85) failed.push(`${format}/${t.id} ${res.measure.score} ${JSON.stringify({ o: res.measure.overflow, x: res.measure.overlaps, out: res.measure.outside, c: res.measure.lowContrast })}`);
        fs.writeFileSync(path.join(OUT, `poster-${format}-${t.id}.png`), res.png);
      }
    }
    check(`${rendered} affiches rendues sur fond clair, sans débordement ni chevauchement (score ≥ 85)`, rendered >= 27 && !failed.length, failed.join(' · '));
  }

  section('Méthodes des crans Max et Ultra — conception par l’IA, sous contrôle');
  {
    const sharp = (await import('sharp')).default;
    const { renderPoster, posterFonts } = await import('../src/visual/poster/poster.render');
    const { specFor, schemesOf } = await import('../src/visual/poster/poster.spec');
    const { posterImage, analyzeLogo } = await import('../src/visual/poster/poster.images');
    const { colorTokens } = await import('../src/visual/poster/poster.canvas');
    const { parseLayout, buildLayout } = await import('../src/visual/poster/poster.layout');
    const { buildAuthored, extractHtml } = await import('../src/visual/poster/poster.author');
    const { parseCritique } = await import('../src/visual/poster/poster.critic');
    const { designLoop } = await import('../src/visual/poster/poster.loop');
    const photo = await posterImage(`file://${path.join(OUT, 'photo.jpg')}`, 'brand');
    const logoFile = path.join(OUT, 'logo2.png');
    // Un logo bicolore : texte noir, marque rose (comme « #DEV_Girls »).
    await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="160"><text x="10" y="120" font-family="Arial" font-weight="700" font-size="110" fill="#111111">Ko</text><text x="170" y="120" font-family="Arial" font-weight="700" font-size="110" fill="#d6246e">fi</text></svg>')).png().toFile(logoFile);
    const logo = await analyzeLogo(`file://${logoFile}`);
    const fonts = posterFonts({ primaryFont: 'Poppins', secondaryFont: 'Inter' });
    const palette = { primary: '#d6246e', secondary: '#2b2d42', accent: '#39ff14', background: '#ffffff', text: '#1d1d1f' };
    const copy = { kicker: 'Atelier pratique', headline: 'Créez votre première œuvre avec l’IA', facts: [{ kind: 'date' as const, text: 'Samedi 18 octobre' }, { kind: 'place' as const, text: 'Plateau, Abidjan' }] };
    const input = { format: 'square' as const, copy, palette, image: photo!, extraImages: [], allowDark: false, logo, brandName: 'Kofi', language: 'fr' };
    const schemes = schemesOf(input as any);
    const carrier = specFor(input as any, { template: 'free', scheme: 'paper', mirror: false, treatment: 'natural' }, schemes)!;
    const tokens = colorTokens(carrier, schemes);
    check('jetons de la charte (le vert fluo marqué comme tel)', tokens.some((t) => t.id === 'accent' && t.neon) && !tokens.some((t) => t.id === 'deep'), tokens.map((t) => `${t.id}${t.neon ? '*' : ''}`).join(' '));
    const brief: any = { spec: carrier, tokens, images: [photo!], context, request: 'Atelier pratique samedi', intent: 'event' };

    // Max : une mise en page écrite comme le ferait le designer, construite et mesurée.
    const design = parseLayout(JSON.stringify({ concept: 'photo en haut, bande de marque en bas', background: 'paper', elements: [
      { type: 'photo', photo: 1, x: 0, y: 0, w: 100, h: 56 },
      { type: 'shape', color: 'primary', x: 0, y: 56, w: 100, h: 44 },
      { type: 'text', x: 7, y: 60, w: 86, h: 22, items: ['kicker', 'headline', 'facts'], valign: 'top', headline: 'large' },
      { type: 'logo', x: 7, y: 87, size: 7 },
    ] }))!;
    const built = buildLayout(design, brief);
    const layoutRender = await renderPoster(carrier, built.body, fonts);
    fs.writeFileSync(path.join(OUT, 'max-layout.png'), layoutRender.png);
    check('Max : la mise en page de l’IA construite et mesurée sans défaut', !!design && !built.issues.length && !layoutRender.measure.blocking, `${built.issues.join(' · ')} ${JSON.stringify(layoutRender.measure)}`.slice(0, 300));
    const neon = buildLayout({ ...design, elements: [...design.elements, { type: 'shape', color: 'accent', x: 0, y: 0, w: 50, h: 30 }] }, brief);
    check('Max : un grand aplat fluo est renvoyé au designer', neon.issues.some((i) => /neon/.test(i)));
    const noHead = buildLayout({ ...design, elements: design.elements.filter((e) => e.type !== 'text') }, brief);
    check('Max : titre et logo exigés', noHead.issues.some((i) => /headline is missing/.test(i)));

    // Ultra : le HTML d'auteur, vérifié et nettoyé.
    const good = `<div class="x-band" style="position:absolute;left:0;top:560px;width:1080px;height:520px;background:var(--primary)"></div>
<div class="ph" style="position:absolute;left:0;top:0;width:1080px;height:560px"><img src="{{PHOTO_1}}" style="object-position:60% 40%"></div>
<div data-stack="head" style="position:absolute;left:76px;top:600px;width:928px;height:300px;display:flex;flex-direction:column;justify-content:flex-start;gap:16px">
<div class="fit kicker" data-min="24" data-max="34" style="color:var(--white)">Atelier pratique</div>
<div class="fit headline" data-min="50" data-max="130" style="color:#FFFFFF;font-family:Comic Sans MS">Créez votre première œuvre avec l’IA</div>
<div class="fit facts" data-min="26" data-max="36" style="color:var(--white)"><span class="fact">Samedi 18 octobre</span><span class="sep" style="background:var(--white)"></span><span class="fact">Plateau, Abidjan</span></div></div>
<div class="logo" style="position:absolute;left:76px;top:930px;background:#ffffff;padding:14px;border-radius:8px"><img src="{{LOGO}}" style="height:62px;width:auto;display:block"></div>`;
    const okBuild = buildAuthored({ html: good }, brief, copy as any);
    const authorRender = await renderPoster(carrier, okBuild.body, fonts);
    fs.writeFileSync(path.join(OUT, 'ultra-author.png'), authorRender.png);
    check('Ultra : un HTML d’auteur conforme est rendu et mesuré sans défaut', !okBuild.issues.length && !authorRender.measure.blocking && !/Comic/.test(okBuild.body), `${okBuild.issues.join(' · ')} ${JSON.stringify(authorRender.measure)}`.slice(0, 300));
    const bad = buildAuthored({ html: good.replace('Atelier pratique', 'Inscrivez-vous vite').replace('{{LOGO}}', '').replace('</div>\n<div class="ph"', '</div><script>alert(1)</script>\n<div class="ph"') }, brief, copy as any);
    check('Ultra : texte inventé, script et logo absent renvoyés au designer', bad.issues.some((i) => /not an approved word/.test(i)) && bad.issues.some((i) => /forbidden/.test(i)) && bad.issues.some((i) => /logo/.test(i)) && !/<script/.test(bad.body), bad.issues.join(' · ').slice(0, 300));
    const snapped = buildAuthored({ html: good.replace('var(--primary)', '#d4256c').replace('color:var(--white)">Atelier', 'color:var(--accent)">Atelier') }, brief, copy as any);
    check('Ultra : couleur en dur ramenée au jeton, fluo retiré du texte', /#d6246e/i.test(snapped.body) && !/#d4256c/i.test(snapped.body) && !/color:var\(--accent\)/.test(snapped.body) && !snapped.issues.length, snapped.issues.join(' · '));
    const twice = buildAuthored({ html: good.replace('</div></div>', '</div></div><div data-stack="b" style="position:absolute;left:600px;top:40px;width:300px;height:60px"><div class="fit kicker">Atelier</div></div>') }, brief, copy as any);
    check('Ultra : un mot répété dans un badge est refusé', twice.issues.some((i) => /repeated/.test(i)), twice.issues.join(' · '));
    check('Ultra : le HTML extrait sans le raisonnement qui l’entoure', extractHtml(`Looking at the fixes, here it is: ${good} done.`) === good.trim());

    // Le logo sur sa propre couleur : sa partie rose disparaît, la mesure le voit.
    const lost = await renderPoster(carrier, buildAuthored({ html: good.replace('top:930px;background:#ffffff;padding:14px;border-radius:8px', 'top:930px') }, brief, copy as any).body, fonts);
    check('logo illisible sur sa propre couleur détecté (pixels)', (lost.measure.lowContrast || []).some((c) => c.name === 'logo' && c.blocking), JSON.stringify(lost.measure.lowContrast));

    // La critique : note par critères, le plus faible pesant double.
    const crit = parseCritique('{"hierarchy":8,"legibility":8,"balance":7,"brand":8,"finish":8,"originality":4,"fixes":["move the logo","enlarge the headline"]}');
    check('critique : note par critères (un défaut grave tire la note), verdict « à revoir »', !!crit && crit.score < 7.2 && crit.verdict === 'revise' && crit.fixes.length === 2, JSON.stringify(crit));

    // La boucle : un premier jet refusé, la correction reçoit les défauts et aboutit.
    const seen: string[][] = [];
    const loop = await designLoop<{ html: string }>({
      key: 'check', rounds: 3, deadline: Date.now() + 60_000,
      write: async (round, previous) => {
        if (previous) seen.push(previous.issues);
        return { html: round === 0 ? good.replace('{{LOGO}}', '') : good };
      },
      build: (d) => buildAuthored(d, brief, copy as any),
      render: (body) => renderPoster(carrier, body, fonts),
      review: async () => ({ verdict: 'ok', score: 8.5, fixes: [] }),
    });
    check('boucle de conception : défaut renvoyé, version corrigée retenue', !!loop.best && loop.best.round === 1 && seen[0]?.some((i) => /logo/.test(i)), loop.log.join(' | '));
  }

  section('Moteur d’affiches — les mots');
  {
    const { extractFacts, languageMatches, validHeadline, polish, heuristicCopy } = await import('../src/visual/poster/poster.copy');
    const brief = { message: 'Promo de rentrée', details: 'Promo de rentrée : -20 % sur toutes nos formations jusqu au 31 octobre', brandName: 'Kofi', language: 'fr' };
    const read = extractFacts(brief.details);
    check('faits lus dans la demande (offre, date)', read.offer === '−20 %' && read.facts.some((f) => f.kind === 'date' && /31 octobre/.test(f.text)), JSON.stringify(read));
    check('titre anglais refusé pour une marque francophone', !languageMatches('Kofi helped me land my first job', 'fr') && languageMatches('On se retrouve samedi', 'fr'));
    check('format inventé refusé (« soirée » absente de la demande)', !validHeadline('Une soirée pour coder', { ...brief, details: 'Rencontre samedi' }));
    check('chiffre absent de la demande refusé', !validHeadline('-50 % sur tout', brief));
    const p = polish({ headline: 'Créez avec l IA', facts: [{ kind: 'date', text: '31 octobre' }], offer: '-20%' }, 'fr', brief.details);
    check('typographie : élision, offre normalisée, date de fin', p.headline === 'Créez avec l’IA' && p.offer === '−20 %' && p.facts[0].text === 'Jusqu’au 31 octobre', JSON.stringify(p));
    const h = heuristicCopy({ message: 'Atelier', details: 'Atelier pratique : créez votre première œuvre avec l IA, samedi 18 octobre', brandName: 'Kofi', language: 'fr' }, 'event');
    check('repli sans modèle : préambule en sur-titre, la suite en titre', h.kicker === 'Atelier pratique' && /^Créez votre première œuvre/.test(h.headline) && !h.sub, JSON.stringify(h));
  }

  console.log(`\n${passes} vérifications réussies, ${failures} en échec · fichiers : ${OUT}`);
  process.exit(failures ? 1 : 0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

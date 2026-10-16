/**
 * `npm run check --prefix packages/motion-compiler` — le langage et le compilateur, sans modèle.
 *
 *   1. expressions : variables, pourcentages, pick(), noms refusés ;
 *   2. validation : ce qui est refusé (et pourquoi), ce qui n'est qu'un avertissement (effets sonores, courbes) ;
 *   3. chaque exemple validé, compilé, accepté par esbuild, programme gardé en tête du code ;
 *   4. les GARANTIES, prouvées dans Motion Canvas en story ET en paysage : exemples sans erreur ni défaut
 *      d'affichage, texte géant ramené dans le cadre, piste trop longue qui finit avant la coupe, deux textes
 *      superposés bien détectés par le contrôle d'affichage ; puis un MP4 par format.
 *
 * L'auteur (qui fait écrire ces programmes par un modèle) est contrôlé avec le moteur : `npm run check:motion`
 * dans `apps/ivision/core`.
 */
process.env.VIDEO_SFX_OFFLINE = '1';
process.env.VIDEO_ALLOW_FILE_URLS = '1';
import fs from 'fs';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import { exprCode, exprError } from '../src/dsl/expr';
import { validateProgram } from '../src/dsl/validate';
import { compileProgram, programOf, untangle } from '../src/compiler/compile';
import { PROGRAM_EXAMPLES } from '../src/author/examples';
import type { MotionProgram } from '../src/dsl/types';
import { buildFilmBundle, compileScene } from '../../../apps/ivision/core/src/video/rendering/compiler';
import { closeFilmBrowser, localizeFilm, probeFilm, renderFilm, cleanupFilmRender } from '../../../apps/ivision/core/src/video/rendering/runner';
import { COMPOSITION, frameSpec } from '../../../apps/ivision/core/src/video/rendering/formats';
import { probe } from '../../../apps/ivision/core/src/video/rendering/ffmpeg';
import type { FilmData } from '../../../apps/ivision/core/motion/runtime/film-data';
import type { VideoFormat } from '../../../apps/ivision/core/src/video/contracts/model';

let failures = 0;
let passes = 0;
function check(label: string, ok: boolean, detail = '') {
  if (ok) passes++;
  else failures++;
  console.log(`  ${ok ? '✓' : '✗'} ${label}${!ok && detail ? ` — ${detail}` : ''}`);
}
const section = (t: string) => console.log(`\n${t}`);
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'motion-compiler-check-'));

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="80" viewBox="0 0 240 80"><circle cx="40" cy="40" r="30" fill="#f2a93b"/><text x="84" y="54" font-family="Arial" font-size="40" font-weight="700" fill="#14324a">Kora</text></svg>`;
const BRAND = { name: 'Kora Café', colors: { primary: '#1f6f4a', secondary: '#14324a', accent: '#f2a93b', background: '#fbfaf7', text: '#16181d' }, fonts: { display: 'Inter', body: 'Inter' }, logo: { light: `data:image/svg+xml;base64,${Buffer.from(LOGO_SVG).toString('base64')}`, width: 240, height: 80 } };
const TEXTS: Record<string, string> = { headline: 'Le café qui réveille Dakar', sub: 'Torréfié chaque matin, à deux pas de chez vous', figure: '1 250 clients', label: 'servis chaque semaine', caption: 'Grains du Fouta-Djalon, torréfiés à Dakar', tagline: 'Réveillez votre journée', cta: 'kora.sn' };

async function variance(jpg: Buffer): Promise<number> {
  const stats = await sharp(jpg).stats();
  return stats.channels.slice(0, 3).reduce((a, c) => a + c.stdev, 0) / 3;
}

interface SceneSpec { key: string; program: MotionProgram; texts: Record<string, string>; media: { kind: 'image' | 'video'; file: string; width: number; height: number }[]; duration: number }

function compile(spec: SceneSpec): string {
  const v = validateProgram(spec.program, { texts: Object.keys(spec.texts), media: spec.media.map((m) => m.kind), duration: spec.duration, hasLogo: true });
  if (!v.ok) throw new Error(`${spec.key} invalide : ${v.errors.join(' | ')}`);
  return compileProgram(v.program!, { warnings: v.warnings }).code;
}

function filmData(specs: SceneSpec[], format: VideoFormat): FilmData {
  const frame = frameSpec(format, 'standard');
  let start = 0;
  return {
    format,
    ...COMPOSITION[format],
    resolutionScale: frame.scale,
    fps: frame.fps,
    background: BRAND.colors.background,
    lang: 'fr',
    fontFamilies: ['Inter'],
    brand: BRAND,
    scenes: specs.map((s) => {
      const scene = { key: s.key, start, duration: s.duration, texts: s.texts, media: s.media.map((m, i) => ({ id: `m${i + 1}`, kind: m.kind, url: `file://${m.file}`, width: m.width, height: m.height })) };
      start += s.duration;
      return scene;
    }),
  };
}

async function probeIn(specs: SceneSpec[], format: VideoFormat) {
  const bundle = await buildFilmBundle(specs.map((s) => ({ key: s.key, code: compile(s) })), 'render');
  const local = await localizeFilm(filmData(specs, format));
  return { probed: await probeFilm({ data: local.data, bundle, fontCss: '', files: local.files }), bundle, local };
}

(async () => {
  console.log('iVision Motion Compiler — langage, compilateur, garanties d’affichage\n');

  section('1. Expressions');
  check('variables et opérateurs', exprCode('L+SW*0.5', 'length') === 'L + SW * 0.5' && exprCode('-(T)/2', 'length') === '-(T) / 2');
  check('constantes de répétition', exprCode('i*12-30', 'length', { i: 2 }) === '(2) * 12 - 30');
  check('instants : D, V, VE', exprCode('D-1', 'time') === 'D - 1' && !!exprError('W', 'time'));
  check('pourcentages rapportés à l’axe (x → largeur, y → hauteur)', exprCode('30%', 'length', {}, 'x') === '(30 * W / 100)' && exprCode('-25%', 'length', {}, 'y') === '-(25 * H / 100)');
  check('pick(vertical, horizontal) et pick(vertical, carré, horizontal)', exprCode('pick(0, -SW*0.25)', 'length') === '(TALL ? 0 : -SW * 0.25)' && /SQUARE/.test(exprCode('pick(1, 2, 3)', 'length')) && !!exprError('pick(1)', 'length'));
  check('nom libre refusé (aucun code injecté)', !!exprError('window', 'length') && !!exprError('alert(1)', 'length') && !!exprError('i', 'length'));

  section('2. Validation (technique seulement)');
  const ctx = { texts: ['headline', 'sub'], media: ['image' as const], duration: 3, hasLogo: false };
  const bad = validateProgram(
    {
      nodes: [
        { id: 't', type: 'text', text: 'Bonjour à tous' },
        { id: 'x', type: 'sparkle' },
        { id: 's', type: 'stack', children: [{ id: 'c', type: 'text', text: '$sub' }] },
        { id: 'p', type: 'image', media: 3 },
        { id: 'l', type: 'logo' },
      ],
      timeline: [
        { at: 0, target: 'ghost', to: { opacity: 1 } },
        { at: 0, target: 'c', to: { x: 10 } },
        { at: 0, target: 't', to: { wobble: 2 } },
      ],
    },
    ctx
  );
  const has = (re: RegExp) => bad.errors.some((e) => re.test(e));
  check('texte littéral refusé (les textes viennent de la scène)', has(/\$clé/));
  check('type de nœud inconnu refusé', has(/type inconnu « sparkle »/));
  check('média absent refusé', has(/media : rang/));
  check('logo absent refusé', has(/pas de logo/));
  check('cible inexistante refusée (avec la liste des ids)', has(/« ghost » n'existe pas \(ids : t/));
  const warned = (re: RegExp) => bad.warnings.some((w) => re.test(w));
  check('x d’un enfant de pile : sans effet, ignoré et dit (jamais un refus)', warned(/posé par une pile/) && !has(/posé par une pile/));
  check('propriété non animable : ignorée et dite (jamais un refus)', warned(/wobble/) && !has(/wobble/));
  const clear = validateProgram({ nodes: [{ id: 't', type: 'text', text: 'Torréfié  chaque matin' }, { id: 'w', type: 'line', points: [[0, 0], [10, 0]], lineWidth: '0.4*2' }], timeline: [] }, { ...ctx, values: { headline: 'x', sub: 'Torréfié chaque matin' } });
  check('texte de la scène écrit en clair → remplacé par sa clé ; calcul constant → sa valeur', clear.ok && (clear.program!.nodes[0] as { text: string }).text === '$sub' && (clear.program!.nodes[1] as { lineWidth: number }).lineWidth === 0.8, JSON.stringify(clear));
  const lenient = validateProgram({ nodes: [{ id: 't', type: 'text', text: '$headline', glow: true }], timeline: [{ at: 0, sfx: 'swoosh' }, { at: 0.5, sfx: 'ding' }, { at: 1, sfx: 'pop' }, { at: 1.2, sfx: 'laser' }, { at: 0.2, target: 't', ease: 'easeOutCubic', to: { opacity: 1 } }, { at: 0.4, target: 't', ease: 'wiggle', to: { scale: 1.1 } }] }, ctx);
  const sfx = lenient.program?.timeline.filter((s) => s.sfx).map((s) => s.sfx);
  check('effets sonores : alias reconnus, au-delà de deux ou inconnus ignorés (jamais un refus)', lenient.ok && JSON.stringify(sfx) === '["whoosh","shimmer"]', JSON.stringify({ sfx, errors: lenient.errors }));
  check('courbes : alias reconnus (easeOutCubic), inconnues ignorées', lenient.ok && lenient.program!.timeline.some((s) => s.ease === 'outCubic') && lenient.warnings.some((w) => /wiggle/.test(w)));
  check('propriété inconnue : avertissement, programme gardé', lenient.warnings.some((w) => /glow/.test(w)));

  section('3. Exemples : validés, compilés, acceptés par esbuild');
  const photoFile = path.join(OUT, 'photo.jpg');
  await sharp({ create: { width: 1200, height: 1500, channels: 3, background: '#8a5a3c' } }).composite([{ input: Buffer.from('<svg width="1200" height="1500"><circle cx="600" cy="700" r="380" fill="#e9c79a"/><rect x="200" y="1150" width="800" height="120" rx="40" fill="#3d2414"/></svg>') }]).jpeg().toFile(photoFile);
  const shotFile = path.join(OUT, 'screen.png');
  await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="900"><rect width="1440" height="900" fill="#f6f7fb"/><rect width="260" height="900" fill="#14324a"/><rect x="300" y="60" width="1080" height="120" rx="16" fill="#1f6f4a"/><rect x="300" y="220" width="520" height="300" rx="16" fill="#ffffff"/><rect x="860" y="220" width="520" height="300" rx="16" fill="#f2a93b"/><rect x="300" y="560" width="1080" height="280" rx="16" fill="#ffffff"/></svg>')).png().toFile(shotFile);
  const specs: SceneSpec[] = PROGRAM_EXAMPLES.map((ex, k) => ({
    key: `s${k + 1}`,
    program: ex.program,
    texts: Object.fromEntries(ex.texts.map((t) => [t, TEXTS[t]])),
    media: ex.media.map((kind) => (ex.id === 'interface-focus' ? { kind, file: shotFile, width: 1440, height: 900 } : { kind, file: photoFile, width: 1200, height: 1500 })),
    duration: 3,
  }));
  for (const sp of specs) {
    const ex = PROGRAM_EXAMPLES[Number(sp.key.slice(1)) - 1];
    try {
      const code = compile(sp);
      const es = await compileScene(code);
      check(`${ex.id} : ${JSON.stringify(ex.program).length} signes de programme → ${code.split('\n').length} lignes de TSX, compilées`, es.ok, es.error || '');
      check(`${ex.id} : le programme source est gardé en tête du code`, JSON.stringify(programOf(code)?.nodes) === JSON.stringify(ex.program.nodes));
      fs.writeFileSync(path.join(OUT, `${ex.id}.tsx`), code);
    } catch (error) {
      check(`${ex.id} : valide`, false, (error as Error).message);
    }
  }

  section('4. Garanties, exécutées par Motion Canvas (story et paysage)');
  for (const format of ['story', 'landscape'] as VideoFormat[]) {
    const { probed, bundle, local } = await probeIn(specs, format);
    check(`${format} : aucune erreur d’exécution (${specs.length} scènes)`, probed.errors.length === 0, JSON.stringify(probed.errors));
    check(`${format} : aucun texte coupé ni chevauché`, Object.keys(probed.layout).length === 0, JSON.stringify(probed.layout));
    const vars = await Promise.all(Object.entries(probed.thumbnails).map(async ([k, buf]) => (fs.writeFileSync(path.join(OUT, `${format}-${k}.jpg`), buf), variance(buf))));
    check(`${format} : une vignette par scène, aucune vide`, vars.length === specs.length && vars.every((v) => v > 6), vars.map((v) => v.toFixed(0)).join(', '));
    const out = await renderFilm({ data: local.data, bundle, fontCss: '', files: local.files, durationSec: specs.length * 3, quality: 'standard', concurrency: 3 });
    const info = await probe(out.file);
    check(`${format} : MP4 à la durée exacte (${info.duration.toFixed(2)} s, ${info.width}×${info.height})`, Math.abs(info.duration - specs.length * 3) < 0.1 && out.errors.length === 0);
    fs.copyFileSync(out.file, path.join(OUT, `examples-${format}.mp4`));
    cleanupFilmRender(out);
  }

  // Le texte géant, mal placé, dans une piste qui déborde de la scène.
  const giant: SceneSpec = {
    key: 'g1',
    duration: 3,
    texts: { headline: 'Disponible dès le 12 novembre dans toutes nos boutiques', sub: 'pagneroyal.ci' },
    media: [],
    program: {
      nodes: [
        { id: 'big', type: 'text', text: '$headline', x: 30, y: -70, size: 40, weight: 800 },
        { id: 'tiny', type: 'text', text: '$sub', x: 'R', y: 'B', anchor: 'left', size: 5 },
      ],
      timeline: [
        { at: 0.5, target: 'big', dur: 1, from: { opacity: 0 }, to: {} },
        { at: 6, target: 'tiny', dur: 2, from: { opacity: 0 }, to: {} },
      ],
    },
  };
  const overlap: SceneSpec = {
    key: 'o1',
    duration: 3,
    texts: { headline: 'Grandir ensemble', sub: 'Depuis 2010 à Lomé' },
    media: [],
    program: { nodes: [{ type: 'text', text: '$headline', size: 9 }, { type: 'text', text: '$sub', y: 1, size: 8 }], timeline: [] },
  };
  const offStack: SceneSpec = {
    key: 'k1',
    duration: 3,
    texts: { figure: '85 %', label: 'de taux de remboursement' },
    media: [],
    program: { nodes: [{ id: 'group', type: 'stack', dir: 'row', gap: 2, x: 'SW*0.5', y: 'SH*0.45', anchor: 'left', children: [{ type: 'text', text: '$figure', size: 14, weight: 800 }, { type: 'text', text: '$label', size: 6 }] }], timeline: [{ at: 0, target: 'group', dur: 0.5, from: { opacity: 0 }, to: {} }] },
  };
  const scaled: SceneSpec = {
    key: 'x1',
    duration: 3,
    texts: { headline: 'Grandir ensemble', sub: 'Depuis 2010 à Lomé' },
    media: [],
    program: {
      nodes: [{ id: 'a', type: 'text', text: '$headline', size: 9 }, { id: 'b', type: 'text', text: '$sub', y: 1, size: 8 }, { id: 'dot', type: 'circle', y: 30, size: 6 }],
      timeline: [{ at: 0, target: 'b', dur: 0.3, to: { scaleX: 0, scaleY: 0 } }, { at: 0, target: 'dot', dur: 0.4, repeat: 'yoyo', to: { scaleX: 1.4 } }],
    },
  };
  const covered: SceneSpec = {
    key: 'c1',
    duration: 3,
    texts: { headline: 'Mama Bissap', sub: 'Le goût du vrai', cta: 'COMMENCE' },
    media: [{ kind: 'image', file: photoFile, width: 1200, height: 1500 }],
    program: {
      nodes: [
        { id: 'name', type: 'text', text: '$headline', y: -20, size: 9, z: 1 },
        { id: 'bottle', type: 'image', media: 0, y: -20, w: 20, h: 26, z: 2 },
        { id: 'slogan', type: 'text', text: '$sub', y: 10, size: 7, z: 1 },
        { id: 'strike', type: 'line', points: [['-SW*0.3', 10], ['SW*0.3', 10]], stroke: 'accent', lineWidth: 0.8, z: 2 },
        { id: 'word', type: 'text', text: '$cta', split: 'chars', y: 30, size: 8 },
      ],
      timeline: [{ at: 0, target: 'word.*', dur: 0.4, to: { x: 0 } }],
    },
  };
  // Des textes ancrés dans les coins (mesure exacte de la boîte d'un nœud ancré), et un texte ancré vraiment hors cadre.
  const anchored: SceneSpec = {
    key: 'a1',
    duration: 3,
    texts: { headline: 'La nouvelle collection wax', sub: 'Disponible dès le 12 novembre', cta: 'pagneroyal.ci' },
    media: [],
    program: {
      nodes: [
        { type: 'text', text: '$headline', x: 'L', y: 'T', anchor: 'top-left', size: 8, italic: true },
        { type: 'text', text: '$sub', x: 'R', y: 'B', anchor: 'bottom-right', size: 5, upper: true, letterSpacing: 0.8 },
        { type: 'group', x: 'R', children: [{ type: 'text', text: '$cta', x: 6, anchor: 'left', size: 6 }] },
      ],
      timeline: [],
    },
  };
  for (const format of ['story', 'landscape'] as VideoFormat[]) {
    const { probed } = await probeIn([anchored], format);
    const a1 = probed.layout.a1 || [];
    check(`${format} : textes ancrés dans les coins non signalés ; texte ancré hors cadre signalé`, a1.length > 0 && a1.every((m) => /« pagneroyal\.ci » est coupé/.test(m)), JSON.stringify(a1));
  }
  // Sans « z » imposé, le compilateur garde les textes devant : le même décor ne cache plus rien.
  const front: SceneSpec = { ...covered, key: 'f1', program: { ...covered.program, nodes: covered.program.nodes.filter((n) => n.id !== 'word' && n.id !== 'strike').map((n) => ({ ...n, z: undefined })), timeline: [] } };
  const contrastLow: SceneSpec = { key: 'n1', duration: 3, texts: { headline: 'Pagne Royal' }, media: [], program: { nodes: [{ type: 'rect', w: 'SW', h: 20, fill: '#1d2a44' }, { type: 'text', text: '$headline', size: 9, color: '#1b1b1b' }], timeline: [] } };
  const contrastOk: SceneSpec = { key: 'n2', duration: 3, texts: { headline: 'Pagne Royal' }, media: [], program: { nodes: [{ type: 'rect', w: 'SW', h: 20, fill: '#1d2a44' }, { type: 'text', text: '$headline', size: 9, color: 'on-secondary' }], timeline: [] } };
  // Le fondu final d'une scène reste à la fin, même quand la piste est mise à l'échelle ; une scène vide est signalée.
  const fadeOut: SceneSpec = { key: 'e1', duration: 3, texts: { headline: 'Le goût du vrai' }, media: [], program: { nodes: [{ id: 't', type: 'text', text: '$headline', size: 8 }], timeline: [{ at: 0.2, target: 't', dur: 4, from: { opacity: 0 }, to: {} }, { at: 5.6, target: 'world', dur: 0.5, to: { opacity: 0 } }] } };
  const empty: SceneSpec = { key: 'e2', duration: 3, texts: { headline: 'Le goût du vrai' }, media: [], program: { nodes: [{ id: 't', type: 'text', text: '$headline', size: 8, opacity: 0 }], timeline: [] } };
  for (const format of ['story', 'landscape'] as VideoFormat[]) {
    const { probed } = await probeIn([giant, overlap, offStack, scaled, covered, front, contrastLow, contrastOk, fadeOut, empty], format);
    check(`${format} : texte sombre sur un bandeau sombre signalé (contraste mesuré sur l’image) ; texte clair sur le même bandeau non signalé`, (probed.layout.n1 || []).some((m) => /ne se lit pas sur son fond/.test(m)) && !probed.layout.n2, JSON.stringify({ n1: probed.layout.n1, n2: probed.layout.n2 }));
    check(`${format} : un fondu final reste à la fin (scène pas vide à 78 %) ; une scène qui n’affiche aucun texte est signalée`, !probed.layout.e1 && (probed.layout.e2 || []).some((m) => /aucun de ses textes/.test(m)), JSON.stringify({ e1: probed.layout.e1, e2: probed.layout.e2 }));
    check(`${format} : sans ordre imposé, les textes restent devant l’image et le trait (rien de caché)`, !probed.layout.f1, JSON.stringify(probed.layout.f1));
    const c1 = probed.layout.c1 || [];
    check(`${format} : texte caché par une image dessinée par-dessus, texte barré par un trait, lettres superposées : détectés`, c1.some((m) => /« Mama Bissap » est caché par une image/.test(m)) && c1.some((m) => /« Le goût du vrai » est barré/.test(m)) && c1.some((m) => /se superposent/.test(m)), JSON.stringify(c1));
    check(`${format} : une pile posée à moitié hors cadre est ramenée dans la zone sûre`, !probed.layout.k1, JSON.stringify(probed.layout.k1));
    check(`${format} : scaleX / scaleY animent vraiment (le texte réduit à zéro ne chevauche plus) et une boucle yoyo sur scaleX ne fige pas le rendu`, !probed.layout.x1 && probed.errors.length === 0, JSON.stringify(probed.layout.x1 || probed.errors));
    check(`${format} : un texte de taille 40 posé hors cadre est réduit et ramené dans le cadre ; un pas prévu à 6 s dans une scène de 3 s joue avant la coupe`, !probed.layout.g1 && probed.errors.length === 0, JSON.stringify(probed.layout.g1 || probed.errors));
    check(`${format} : deux textes superposés sont détectés (« se chevauchent »)`, (probed.layout.o1 || []).some((m) => /se chevauchent/.test(m)), JSON.stringify(probed.layout));
  }
  // Une pile qui contient le logo, exportée en MP4 (plusieurs tronçons, chacun repart de zéro) : aucune erreur.
  const logoStack: SceneSpec = { key: 'l1', duration: 3, texts: { tagline: 'Grandir ensemble' }, media: [], program: { bg: 'primary', nodes: [{ id: 'end', type: 'stack', dir: 'column', gap: 2, children: [{ type: 'logo', w: 'SW*0.4', on: 'primary' }, { type: 'text', text: '$tagline', size: 6, color: 'on-primary' }] }], timeline: [{ at: 0.2, target: 'end', dur: 0.6, from: { opacity: 0, scale: 0.9 }, to: {} }] } };
  {
    const specs2 = [logoStack, { ...logoStack, key: 'l2' }];
    const { bundle, local } = await probeIn(specs2, 'square');
    const out = await renderFilm({ data: local.data, bundle, fontCss: '', files: local.files, durationSec: 6, quality: 'standard', concurrency: 3 });
    check('une pile avec le logo s’exporte en MP4 sans erreur (aucune taille d’image lue avant son chargement)', out.errors.length === 0, JSON.stringify(out.errors));
    cleanupFilmRender(out);
  }
  const tangled = untangle([
    { at: 0, target: 'a', dur: 1, to: { x: 10 } },
    { at: 0.5, target: 'a', dur: 1, to: { x: 0 } },
    { at: 0.5, target: 'a', dur: 1, to: { opacity: 0.5 } },
  ]);
  check('deux pas sur la même propriété du même nœud s’enchaînent au lieu de se battre', tangled.timeline[1].at === 1 && tangled.timeline[2].at === 0.5 && tangled.notes.length === 1, JSON.stringify(tangled));

  await closeFilmBrowser();
  console.log(`\n${passes} vérifications réussies, ${failures} en échec · fichiers : ${OUT}`);
  process.exit(failures ? 1 : 0);
})().catch(async (error) => {
  console.error(error);
  await closeFilmBrowser().catch(() => undefined);
  process.exit(1);
});

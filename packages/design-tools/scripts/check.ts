/**
 * Contrôle de @idem/design-tools — sans réseau ni modèle payant (CLIP n'est essayé que s'il est déjà en cache).
 *   npm run check --workspace=@idem/design-tools
 * Chaque outil est aussi chronométré : les budgets de temps du plan doivent tenir sur la machine.
 */
import sharp from 'sharp';
import { analyzeSaliency, axisLine, bestOf, contrastRatio, CULTURAL_AXES, COUNTRIES, derivePalette, fixContrast, imageEmbedding, judgeImage, modelsDir, novelty, parseVerdict, patternSvg, pickAxis, runTool, scoreVariant, textEmbedding, typePairsTool, vectorizeImage, contrastTool } from '../src';
import fs from 'fs';
import path from 'path';

let failed = 0;
let passed = 0;
const ok = (name: string, cond: boolean, detail = '') => {
  if (cond) passed++;
  else failed++;
  console.log(`${cond ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
};
const timed = async <T>(fn: () => Promise<T>): Promise<[T, number]> => {
  const t = Date.now();
  const v = await fn();
  return [v, Date.now() - t];
};

const svgPng = (body: string, w = 512, h = 512) => sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#fdf6e3"/>${body}</svg>`)).png().toBuffer();

async function main() {
  // Couleur
  const pal = derivePalette(['#E4572E', '#1D3557']);
  ok('palette : les couleurs de marque restent', pal.brand[0] === '#E4572E');
  ok('palette : une harmonie calculée', pal.harmony.length >= 2, pal.harmony.join(' '));
  ok('palette : encre lisible sur le fond (≥ 7)', contrastRatio(pal.ink, pal.ground) >= 7, `${contrastRatio(pal.ink, pal.ground)}`);
  ok('contraste : noir sur blanc = 21', contrastRatio('#000000', '#ffffff') === 21);
  const fixed = fixContrast('#9a9a9a', '#ffffff', 4.5);
  ok('contraste : correction minimale ≥ 4,5', !!fixed && contrastRatio(fixed, '#ffffff') >= 4.5, `${fixed}`);
  const viaTool = await runTool(contrastTool, { foreground: '#cccccc', background: '#ffffff' });
  ok('outil contrast : refuse et propose une correction', viaTool.ok && viaTool.value!.passes === false && !!viaTool.value!.fixed);
  const bad = await runTool(contrastTool, { foreground: 3 });
  ok('outil : entrée invalide refusée sans exception', !bad.ok && /entrée refusée/.test(bad.error ?? ''));

  // Polices
  const pairs = await runTool(typePairsTool, { display: 'Playfair Display' });
  ok('paires : un texte sans pour un titre à empattements', pairs.ok && pairs.value!.body.includes('Source Sans 3'));
  const unknown = await runTool(typePairsTool, { display: 'Police Inconnue' });
  ok('paires : police inconnue → texte neutre', unknown.ok && unknown.value!.body[0] === 'Inter');

  // Motifs
  for (const kind of ['scatter', 'flow', 'grain', 'hand-lines', 'hand-circles'] as const) {
    const [svg, ms] = await timed(async () => patternSvg({ kind, size: 512, colors: ['#E4572E', '#1D3557'], density: 0.5, seed: 'idem' }));
    ok(`motif ${kind} : SVG non vide en < 200 ms`, svg.startsWith('<svg') && svg.length > 200 && ms < 200, `${svg.length} o, ${ms} ms`);
  }
  ok('motif : déterministe', patternSvg({ kind: 'flow', size: 256, colors: ['#000'], density: 0.4, seed: 'a' }) === patternSvg({ kind: 'flow', size: 256, colors: ['#000'], density: 0.4, seed: 'a' }));

  // Saliency : un seul foyer contre trois foyers concurrents.
  const one = await svgPng('<circle cx="256" cy="220" r="110" fill="#E4572E"/>');
  const three = await svgPng('<circle cx="90" cy="100" r="60" fill="#E4572E"/><circle cx="420" cy="110" r="60" fill="#1D3557"/><circle cx="256" cy="420" r="60" fill="#2A9D8F"/>');
  const [s1, ms1] = await timed(() => analyzeSaliency(one, { focal: { x: 0.25, y: 0.2, w: 0.5, h: 0.45 } }));
  const [s3] = await timed(() => analyzeSaliency(three));
  ok('saliency : < 1 s', ms1 < 1000, `${ms1} ms`);
  ok('saliency : un visuel à un sujet a moins de foyers qu’un visuel à trois', s1.focalCount < s3.focalCount, `${s1.focalCount} contre ${s3.focalCount}`);
  ok('saliency : l’attention se concentre sur le sujet', (s1.shares.focal ?? 0) > 0.4, `${s1.shares.focal}`);

  // Vectorisation
  const [vec, msV] = await timed(async () => vectorizeImage({ image: await svgPng('<circle cx="512" cy="440" r="260" fill="#E4572E"/><path d="M100 900 Q512 600 924 900" stroke="#1D3557" stroke-width="40" fill="none"/>', 1024, 1024), palette: ['#E4572E', '#1D3557', '#fdf6e3'], detail: 0.3 }));
  ok('vectorisation : SVG aux couleurs de marque en < 3 s', vec.svg.includes('<svg') && msV < 3000, `${vec.engine}, ${vec.paths} chemins, ${msV} ms`);
  ok('vectorisation : palette respectée (aucune couleur hors palette)', !/fill="#(?!e4572e|1d3557|fdf6e3)[0-9a-f]{6}"/i.test(vec.svg));

  // Nouveauté des idées (texte)
  const a = textEmbedding('A film where the market stall becomes a stage, the trader the hero');
  const b = textEmbedding('The market stall turns into a stage and the trader becomes the hero');
  const c = textEmbedding('Isometric diagram of solar panels feeding a village grid at night');
  ok('nouveauté : une idée reformulée est reconnue', novelty(b, [a]) < novelty(c, [a]), `${novelty(b, [a])} < ${novelty(c, [a])}`);
  ok('nouveauté : sans historique = 1', novelty(a, []) === 1);

  // CLIP (seulement si le modèle est déjà en cache : aucun téléchargement pendant un contrôle).
  if (fs.existsSync(path.join(modelsDir(), 'clip-vit-base-patch32-vision-q8.onnx'))) {
    const [e1, msC] = await timed(() => imageEmbedding(one));
    const e2 = await imageEmbedding(await svgPng('<circle cx="280" cy="220" r="110" fill="#E4572E"/>'));
    const e3 = await imageEmbedding(three);
    ok('CLIP : embedding de 512 dimensions', e1?.length === 512, `${msC} ms (premier appel, chargement compris)`);
    ok('CLIP : deux visuels proches plus proches qu’un visuel différent', !!e1 && !!e2 && !!e3 && novelty(e2!, [e1!]) < novelty(e3!, [e1!]));
  } else console.log(`· CLIP non essayé (modèle absent de ${modelsDir()} ; il se télécharge au premier usage réel)`);

  // Juge visuel : lecture des réponses et repli.
  const v = parseVerdict('1: no\n2: yes\n3: no\n4: no\n5: no');
  ok('juge : un défaut sur cinq', v.score === 0.8 && v.faults.length === 1, v.faults.join(''));
  ok('juge : réponse illisible → neutre', parseVerdict('Looks great!').unavailable === true);
  const offline = await judgeImage(undefined, one);
  ok('juge : sans modèle de vision → neutre, sans exception', offline.unavailable === true && offline.score === 0.5);
  const failing = await judgeImage(async () => { throw new Error('panne'); }, one);
  ok('juge : panne → neutre', failing.unavailable === true);

  // Score des variantes
  const good = scoreVariant({ issues: { blocking: 0, advisory: 0 }, metrics: { sizes: 4, hierarchy: 3, coverage: 0.5, focalArea: 0.3, regions: {} }, focalCount: 1, focalShare: 0.4, judge: 1, novelty: 0.4 });
  const weak = scoreVariant({ issues: { blocking: 1, advisory: 2 }, metrics: { sizes: 9, hierarchy: 1.2, coverage: 0.92, focalArea: 0.1, regions: {} }, focalCount: 3, focalShare: 0.1, judge: 0.4, novelty: 0.05 });
  ok('score : la variante propre l’emporte', good.score > weak.score, `${good.score} > ${weak.score}`);
  ok('score : les défauts sont dits', weak.faults.length >= 3, weak.faults[0]);
  ok('score : bestOf garde la meilleure', bestOf([{ value: 'weak', score: weak }, { value: 'good', score: good }])?.value === 'good');

  // Axes de départ
  ok('axes : les 13 pays ont au moins deux axes', COUNTRIES.every((c) => CULTURAL_AXES.filter((x) => x.country === c).length >= 2));
  ok('axes : chaque axe culturel est documenté', CULTURAL_AXES.every((x) => (x.sources?.length ?? 0) > 0 && !!x.review));
  const first = pickAxis({ seed: 'marque-x|deck', country: 'SN', medium: 'document' });
  ok('axes : tirage déterministe', pickAxis({ seed: 'marque-x|deck', country: 'SEN', medium: 'document' }).id === first.id, first.id);
  const used: string[] = [];
  for (let i = 0; i < 12; i++) used.push(pickAxis({ seed: `m|${i}`, country: 'KEN', used, medium: 'video' }).id);
  ok('axes : jamais recyclé tant qu’il en reste', new Set(used).size === used.length, used.slice(0, 4).join(', '));
  ok('axes : un document ne reçoit pas d’axe de mouvement', Array.from({ length: 40 }, (_, i) => pickAxis({ seed: `d${i}`, medium: 'document' })).every((x) => x.kind !== 'motion'));
  ok('axes : la consigne interdit de nommer ou reproduire', /never name it on screen/.test(axisLine(CULTURAL_AXES[0], 'video')));

  console.log(`\n${passed} réussies, ${failed} en échec`);
  if (failed) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

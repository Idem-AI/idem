/**
 * Contrôle du CLASSIFICATEUR D'INTENTION VIDÉO — `npm run check:video:intent`.
 *
 * Un corpus de demandes représentatives (application, site, vidéo filmée, sous-titres, promotion, motion
 * libre, imports seuls, scénario) : l'objectif, le mode de production et le langage de motion doivent être
 * ceux attendus, toutes les consignes explicites respectées, et une question posée SEULEMENT quand
 * l'ambiguïté change le résultat. Aucun modèle : la lecture est celle du code.
 */
import { applyClarification, clarifyVideoIntent, classifyVideoIntent, ClassifyInput, describeVideoIntent, legacyOf, MotionLanguage, ProductionMode, VideoGoal } from '../../../ivision/core/src/video/video.intent';
import { parseRequest } from '../../../ivision/core/src/video/video.request';

let failures = 0;
let passed = 0;
const ok = (label: string, cond: boolean, detail = ''): void => {
  if (cond) passed += 1;
  else failures += 1;
  console.log(`  ${cond ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
};

interface Case {
  name: string;
  input: ClassifyInput;
  goal: VideoGoal;
  mode?: ProductionMode;
  motion?: MotionLanguage;
  /** La question attendue, ou `null` : aucune. */
  question: string | null;
  check?: (i: ReturnType<typeof classifyVideoIntent>) => boolean;
}

const CASES: Case[] = [
  { name: 'app avec captures, français, voix off', input: { request: 'Présente notre application avec ces captures, en français, avec voix off', assets: [{ id: 's1', kind: 'image', note: 'screenshot: dashboard of deliveries' }, { id: 's2', kind: 'screen' }] }, goal: 'product-demo', mode: 'app-presentation', motion: 'interface', question: null, check: (i) => i.voiceover === 'yes' && i.language === 'fr' },
  { name: 'visite du site web', input: { request: 'Une vidéo qui présente notre site web et ses pages principales', brandHasScreens: true }, goal: 'website-tour', mode: 'app-presentation', question: null },
  { name: 'vidéo importée seule, sans texte', input: { request: '', assets: [{ id: 'v1', kind: 'video', durationSec: 42 }] }, goal: 'repurpose', mode: 'footage-edit', question: 'video-treatment' },
  { name: 'enregistrement d’écran seul : la question propose une démo', input: { request: '', assets: [{ id: 'v1', kind: 'video', note: 'screen recording of the app' }] }, goal: 'product-demo', question: 'video-treatment', check: (i) => true },
  { name: 'sous-titres d’une vidéo filmée → montage', input: { request: 'Ajoute des sous-titres français à ma vidéo', assets: [{ id: 'v1', kind: 'video' }] }, goal: 'conversion', mode: 'footage-edit', question: null, check: (i) => i.subtitles === 'yes' && i.pipeline === 'montage' },
  { name: 'annonce de lancement d’événement avec photos et date', input: { request: 'Une annonce pour le lancement de notre salon le 12 mars à Douala, inscrivez-vous', assets: [{ id: 'p1', kind: 'image' }, { id: 'p2', kind: 'image' }] }, goal: 'event', question: null },
  { name: 'événement sans date ni lieu → question', input: { request: 'Une vidéo pour notre prochain webinaire' }, goal: 'event', question: 'event-details' },
  { name: 'promotion chiffrée', input: { request: 'Soldes de fin d’année : -30 % sur toute la boutique jusqu’à dimanche' }, goal: 'conversion', mode: 'pure-motion', question: null, check: (i) => i.legacy.type === 'promo' },
  { name: 'film de marque, style libre', input: { request: 'Un film de marque qui exprime notre vision : rendre l’entrepreneuriat accessible à tous' }, goal: 'brand-film', mode: 'pure-motion', motion: 'cinematic', question: null, check: (i) => i.decided.motionDirection === 'auto' },
  { name: 'typographie animée demandée en toutes lettres', input: { request: 'Une vidéo en typographie animée pour annoncer notre nouvelle offre' }, goal: 'announcement', motion: 'kinetic-type', question: null, check: (i) => i.decided.motionDirection === 'explicit' && i.legacy.direction === 'kinetic' },
  { name: 'données mises en scène', input: { request: 'Montre nos chiffres clés : 12 000 clients, 45 % de croissance, 3 pays, avec des graphiques' }, goal: 'conversion', mode: 'data-story', motion: 'data-led', question: null },
  { name: 'explication de service', input: { request: 'Explique comment marche notre service de livraison en trois étapes' }, goal: 'explainer', question: null },
  { name: 'découpe en formats courts', input: { request: 'Découpe ma conférence en clips courts pour TikTok', assets: [{ id: 'v1', kind: 'video', durationSec: 1800 }] }, goal: 'repurpose', mode: 'footage-edit', question: null, check: (i) => i.pipeline === 'montage' },
  { name: 'démo produit sans aucune capture → question', input: { request: 'Présente notre application mobile de comptabilité' }, goal: 'product-demo', question: 'product-captures' },
  { name: 'photos produit', input: { request: 'Une vidéo pour mettre en valeur nos nouveaux sacs en cuir', assets: [{ id: 'p1', kind: 'image' }, { id: 'p2', kind: 'image' }, { id: 'p3', kind: 'image' }, { id: 'p4', kind: 'image' }] }, goal: 'announcement', mode: 'product-showcase', question: null, check: (i) => i.legacy.type === 'slideshow' },
  { name: 'illustration 2D', input: { request: 'Une vidéo illustrée avec des personnages dessinés pour expliquer notre mission' }, goal: 'explainer', motion: 'illustration-2d', question: null, check: (i) => i.legacy.type === 'illustrated' },
  { name: 'témoignage client', input: { request: 'Le témoignage de Mme Ndiaye : avant et après notre accompagnement' }, goal: 'story', question: null, check: (i) => i.legacy.objective === 'testimonial' },
  { name: 'sans musique demandé', input: { request: 'Promo de notre boulangerie, sans musique' }, goal: 'conversion', question: null, check: (i) => i.music === 'no' },
];

function main(): void {
  console.log('\nClassificateur d’intention vidéo\n');
  let goalHits = 0;
  let modeHits = 0;
  let modeTotal = 0;
  for (const c of CASES) {
    const intent = classifyVideoIntent(c.input);
    const question = clarifyVideoIntent(intent, c.input);
    const goalOk = intent.objective === c.goal;
    const modeOk = !c.mode || intent.productionModes.includes(c.mode);
    const motionOk = !c.motion || intent.motionDirection.includes(c.motion);
    const questionOk = (question?.id ?? null) === c.question;
    const extraOk = c.check ? c.check(intent) : true;
    goalHits += goalOk ? 1 : 0;
    if (c.mode) {
      modeTotal += 1;
      modeHits += modeOk ? 1 : 0;
    }
    ok(c.name, goalOk && modeOk && motionOk && questionOk && extraOk, `${intent.objective} · ${intent.productionModes.join('+')} · ${intent.motionDirection.join('+')} · question ${question?.id ?? 'aucune'} · ${intent.legacy.type}`);
  }
  ok(`justesse de l’objectif ≥ 90 % (${goalHits}/${CASES.length})`, goalHits / CASES.length >= 0.9);
  ok(`justesse du mode de production ≥ 90 % (${modeHits}/${modeTotal})`, modeHits / modeTotal >= 0.9);

  // La clarification : les choix suivent le média, la réponse rend la décision explicite.
  const screenRec: ClassifyInput = { request: '', assets: [{ id: 'v1', kind: 'video', note: 'screen recording of the app' }] };
  const filmed: ClassifyInput = { request: '', assets: [{ id: 'v1', kind: 'video' }] };
  const qScreen = clarifyVideoIntent(classifyVideoIntent(screenRec), screenRec);
  const qFilmed = clarifyVideoIntent(classifyVideoIntent(filmed), filmed);
  ok('les choix suivent le média (démo pour un enregistrement d’écran, motion pour un film tourné)', Boolean(qScreen?.options.some((o) => o.id === 'demo')) && Boolean(qFilmed?.options.some((o) => o.id === 'motion')) && !qFilmed?.options.some((o) => o.id === 'demo'));
  const answered = applyClarification(classifyVideoIntent(filmed), qFilmed!, 'subtitles');
  ok('répondre « sous-titres » : décision prise, plus aucune question, pipeline de montage', answered.subtitles === 'yes' && answered.pipeline === 'montage' && clarifyVideoIntent(answered, filmed) === null);

  // Jamais de question sur ce que la demande dit déjà ni sur un réglage par défaut.
  const explicit = classifyVideoIntent({ request: 'Sous-titres en français pour ma vidéo, format story, 30 secondes, musique calme', assets: [{ id: 'v1', kind: 'video' }] });
  ok('consigne explicite : aucune question (langue, format, durée et musique ne se demandent pas)', clarifyVideoIntent(explicit, { request: 'x', assets: [{ id: 'v1', kind: 'video' }] }) === null);

  // Le scénario : suivi tel quel, et l'objectif ne l'emporte pas sur ce qu'il écrit.
  const script = 'SCÈNE 1 — L’IDÉE (00:00–00:05)\nUne femme ouvre son ordinateur.\nTexte : « Votre business, enfin clair »\nSCÈNE 2 — LA SOLUTION (00:05–00:12)\nL’interface montre le tableau de bord.\nTexte : « IDEM »';
  const scripted = classifyVideoIntent({ request: script, spec: parseRequest(script) });
  ok('scénario fourni : suivi tel quel, ses plans filmés donnent le mode', scripted.scripted && scripted.productionModes.includes('footage-edit'));

  // Corriger l'interprétation : la traduction suit.
  const corrected = legacyOf({ objective: 'conversion', productionModes: ['pure-motion'], motionDirection: ['spatial-3d'], decided: { objective: 'explicit', productionModes: 'explicit', motionDirection: 'explicit' } }, { request: 'une vidéo' });
  ok('une correction de l’utilisateur se traduit dans le pipeline (3D → showcase3d, direction précise)', corrected.type === 'showcase3d' && corrected.direction === 'precision');

  // L'interface : trois étiquettes et une phrase, jamais la liste technique.
  const shown = describeVideoIntent(classifyVideoIntent(CASES[0].input));
  ok('interprétation affichée : objectif, matière, mouvement, voix off, et une phrase', shown.tags.length >= 4 && shown.tags[0] === 'Démo produit' && shown.tags[1] === 'Captures réelles' && /captures du produit/.test(shown.summary));

  console.log(`\n${failures ? '✗' : '✓'} Intention vidéo : ${passed} vérification(s) réussie(s), ${failures} en échec.`);
  process.exit(failures ? 1 : 0);
}

main();

/**
 * `npm run check:video:creative` — créativité bornée, robustesse, variété.
 *
 *  1. Concepts : chaque concept × durée × médias se déplie en un enchaînement valide.
 *  2. Modèles faibles : réponses parfaites, JSON, bavardes, inventées, vides, en panne —
 *     la vidéo est toujours complète et correcte ; les médias de l'utilisateur sont montrés.
 *  3. Variété : 12 vidéos du même projet et du même brief ne se ressemblent pas
 *     (concept, direction, logo, fond), même si le modèle répond toujours la même chose.
 *  4. Budget : tokens de la direction créative, de la copie, de « Améliorer ».
 *  5. Charte : la DA fixe les directions admises, la casse, le rythme, les bonus du graphe.
 *  6. « Améliorer ma demande » : faits gardés, chiffres inventés retirés.
 *  7. Calendrier : une vidéo sur trois au moins, chacune avec un type valide.
 */
import { VideoType } from '../models/motionVideo.model';
import { ContentIdea } from '../models/communication.model';
import { CONCEPTS, CONCEPT_IDS, ConceptId, expandConcept, mediaCapacity, mustShowScenes, pickConcept, sceneRange, TYPE_SIGNATURE } from '../services/Communication/video/video.concepts';
import { buildCreativePrompt, CreativeInput, parseCreative, planCreative, SCENE_MENU } from '../services/Communication/video/video.storyline';
import { copyPlan, buildCopyPrompt, estimateTokens, extractFacts } from '../services/Communication/video/video.copy';
import { DIRECTION_IDS, DIRECTIONS, DirectionId, pickDirection } from '../services/Communication/video/video.direction';
import { motionFromArtDirection } from '../services/Communication/video/video.artdirection';
import { applyKitOverrides, KitContext, pickAccentEffect, resolveKit, topNodes } from '../services/Communication/video/video.capabilities';
import { buildEnhancePrompt, enhanceRequest, groundEnhanced } from '../services/Communication/video/video.enhance';
import { ensureVideoShare, suggestVideoType } from '../services/Communication/video/video.calendar';
import { SCENES } from '../services/Communication/video/video.scenes';
import { available, MediaCounts } from '../services/Communication/video/video.types';
import { analyzeLogo } from '../services/Communication/video/video.logo';
import { buildVideoTheme } from '../services/Communication/video/video.theme';
import { brandById } from './fixtures/motion-video/brands';

let failures = 0;
function check(label: string, ok: boolean, detail = '') {
  if (!ok) failures++;
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
}
const section = (t: string) => console.log(`\n${t}`);

const ctx = { brandName: 'Bissap Délices', businessType: 'boissons artisanales', tone: 'chaleureux', valueProposition: 'Des jus pressés le matin à Dakar', keywords: ['Frais', 'Naturel'], language: 'fr' };
const MESSAGE = 'Notre nouveau jus de bissap à 1 000 F, pressé chaque matin, livré à Dakar';
const facts = extractFacts(MESSAGE);
const NONE: MediaCounts = { images: 0, videos: 0, models: 0, lotties: 0 };
const PROFILES: Record<string, MediaCounts> = {
  rien: NONE,
  photos: { images: 4, videos: 0, models: 0, lotties: 0 },
  clips: { images: 0, videos: 3, models: 0, lotties: 0 },
  '3d': { images: 0, videos: 0, models: 1, lotties: 0 },
  lottie: { images: 0, videos: 0, models: 0, lotties: 1 },
  tout: { images: 4, videos: 3, models: 1, lotties: 1 },
};

const validSequence = (scenes: string[], d: number, media: MediaCounts): string | null => {
  const [, max] = sceneRange(d);
  if (scenes[scenes.length - 1] !== 'logo') return 'pas de signature finale';
  if (['cta', 'logo'].includes(scenes[0]) && scenes.length > 1) return `ouverture ${scenes[0]}`;
  if (scenes.length > max) return `${scenes.length} scènes > ${max}`;
  for (let i = 0; i < scenes.length; i++) {
    if (!SCENES[scenes[i]]) return `scène inconnue ${scenes[i]}`;
    if (scenes[i] !== 'logo' && !available(scenes[i], facts, media)) return `scène sans contenu ${scenes[i]}`;
    if (i > 0 && scenes[i] === scenes[i - 1]) return `doublon ${scenes[i]}`;
  }
  return null;
};

function baseInput(over: Partial<CreativeInput> = {}): CreativeInput {
  return {
    message: MESSAGE,
    durationSec: 15,
    media: PROFILES.photos,
    facts,
    ctx,
    direction: 'editorial',
    techniques: DIRECTIONS.editorial.headline,
    logoMenu: ['draw', 'trace', 'wipe'],
    art: { summary: 'Editorial · photographie lumineuse', styleId: 'editorial', medium: 'photography' },
    seed: 11,
    ...over,
  };
}

(async () => {
  console.log('Direction créative bornée\n');

  section('1. Concepts dépliés (13 concepts × 4 durées × 6 profils de médias)');
  let bad = 0;
  let total = 0;
  for (const id of CONCEPT_IDS.filter((c) => c !== 'logo-sting')) {
    for (const d of [6, 15, 30, 60]) {
      for (const [name, media] of Object.entries(PROFILES)) {
        total++;
        const { scenes, accent } = expandConcept(id, { durationSec: d, facts, media, owned: media });
        const issue = validSequence(scenes, d, media) || (accent < 0 || accent >= scenes.length - 1 ? `grand moment ${accent}` : null);
        const missing = mustShowScenes(media, facts, media).slice(0, mediaCapacity(d)).filter((s) => !scenes.includes(s));
        if (issue || missing.length) {
          bad++;
          if (bad <= 5) console.log(`      ${id} · ${d}s · ${name} : ${issue || `médias non montrés ${missing.join(',')}`} (${scenes.join(' → ')})`);
        }
      }
    }
  }
  check(`${total} dépliages valides (signature, ouverture, bornes, médias de l’utilisateur montrés)`, bad === 0, `${bad} défaut(s)`);
  let typeBad = 0;
  for (const type of Object.keys(TYPE_SIGNATURE) as VideoType[]) {
    for (const d of [15, 30]) {
      const media = PROFILES.tout;
      const concept = pickConcept({ objective: 'product', type, direction: 'editorial', durationSec: d, facts, media, seed: 5 });
      const scenes = expandConcept(concept, { durationSec: d, facts, media, type }).scenes;
      if (!(TYPE_SIGNATURE[type] || []).every((s) => scenes.includes(s))) typeBad++;
    }
  }
  check('type imposé : sa scène signature est toujours là', typeBad === 0, `${typeBad} écart(s)`);

  section('2. Modèles faibles');
  const perfect = 'concept: product-hero\nscenes: hook, product, benefits, offer, cta, logo\naccent: 2\nmoves: 1=lineWipe, 3=maskUp\nlogo: trace';
  const p1 = await planCreative(baseInput(), async () => perfect);
  check('réponse propre : concept, scènes, grand moment, entrées et logo du modèle', p1.concept === 'product-hero' && p1.scenes.join(',') === 'hook,product,benefits,offer,cta,logo' && p1.accent === 1 && p1.logo === 'trace' && p1.source === 'llm', JSON.stringify({ c: p1.concept, s: p1.scenes, a: p1.accent, m: p1.moves, l: p1.logo }));
  const techniquesOk = Object.values(p1.moves).every((t) => (DIRECTIONS.editorial.headline as string[]).includes(t));
  check('entrées hors de la direction ignorées, celles de la direction gardées', techniquesOk, JSON.stringify(p1.moves));
  const json = await planCreative(baseInput(), async () => JSON.stringify({ concept: 'reasons', scenes: ['hook', 'benefits', 'product', 'cta', 'logo'], accent: 2, moves: { 1: 'blurWords' } }));
  check('réponse en JSON comprise', json.concept === 'reasons' && json.scenes.includes('benefits') && json.source === 'llm', `${json.concept} ${json.scenes.join(',')}`);
  const messy = await planCreative(baseInput(), async () => 'Bien sûr ! Voici ma proposition :\n**Concept** : Question\n- Scenes: Hook > 3D > Statement > CTA > Logo\n* Accent = scène 3\nLogo: WIPE.\nJ’espère que ça vous plaît.');
  check('réponse bavarde (gras, puces, majuscules, synonymes « 3D ») comprise', messy.concept === 'question' && messy.logo === 'wipe' && messy.scenes.includes('statement'), `${messy.concept} ${messy.scenes.join(',')} logo=${messy.logo}`);
  const invented = await planCreative(baseInput({ media: NONE, owned: NONE }), async () => 'concept: viral-dance\nscenes: hook, drone, hologram, footage, footage, footage, product, logo, cta\naccent: 99\nmoves: 1=explode, 2=matrix\nlogo: fireworks');
  const issueInv = validSequence(invented.scenes, 15, NONE);
  check('réponse inventée : concept, scènes, effets et logo inexistants remplacés', !issueInv && CONCEPT_IDS.includes(invented.concept) && !invented.logo && Object.keys(invented.moves).length === 0 && invented.accent < invented.scenes.length - 1, `${issueInv || ''} ${invented.concept} ${invented.scenes.join(',')}`);
  const empty = await planCreative(baseInput(), async () => '');
  const down = await planCreative(baseInput(), async () => {
    throw new Error('quota');
  });
  check('réponse vide ou modèle en panne : plan du graphe, complet', empty.source === 'graph' && down.source === 'graph' && !validSequence(down.scenes, 15, PROFILES.photos), `${down.concept} ${down.scenes.join(',')}`);
  const forgot = await planCreative(baseInput({ media: PROFILES.tout, owned: { images: 3, videos: 2, models: 1, lotties: 0 } }), async () => 'concept: question\nscenes: hook, statement, cta, logo\naccent: 2');
  check('médias de l’utilisateur oubliés par le modèle : remis dans la vidéo', ['showcase3d', 'footage'].every((s) => forgot.scenes.includes(s)) && forgot.scenes.some((s) => s === 'gallery' || s === 'product'), forgot.scenes.join(','));
  const fixed = await planCreative(baseInput({ type: 'footage', media: PROFILES.clips }), async () => {
    throw new Error('ne doit pas être appelé');
  });
  check('type imposé : aucun appel au modèle (zéro token), type garanti', fixed.source === 'graph' && fixed.type === 'footage' && fixed.scenes.includes('footage') && fixed.tokens.input === 0, `${fixed.concept} ${fixed.scenes.join(',')}`);
  const longOne = await planCreative(baseInput({ durationSec: 6 }), async () => 'concept: reasons\nscenes: hook, benefits, stat, product, quote, cta, logo');
  check('trop de scènes pour 6 s : ramené aux bornes', longOne.scenes.length <= sceneRange(6)[1], longOne.scenes.join(','));

  section('3. Variété : 12 vidéos du même projet, même brief');
  const brand = brandById('bissap');
  const theme = buildVideoTheme(brand.branding, brand.name);
  const logo = analyzeLogo(theme.logo.fullSvgMarkup, theme.logo.svgMarkup !== theme.logo.fullSvgMarkup ? theme.logo.svgMarkup : undefined);
  const art = motionFromArtDirection(brand.branding.artDirection);
  const run = async (writerFor: (i: number) => ((s: string, u: string) => Promise<string>) | undefined) => {
    const recentConcepts: string[] = [];
    const recentDirections: string[] = [];
    const recentSequences: string[] = [];
    const kits: any[] = [];
    const out: { concept: string; direction: string; logo: string; background: string; accent: string; scenes: string }[] = [];
    for (let i = 0; i < 12; i++) {
      const seed = 1000 + i * 7919;
      const direction = pickDirection({ type: 'mix', artStyleId: brand.branding.artDirection?.styleId, artDirections: art.directions, seed, avoid: recentDirections });
      const plan = await planCreative(baseInput({ seed, direction, techniques: DIRECTIONS[direction].headline, recentConcepts: [...recentConcepts], recentSequences: recentSequences.slice(-2), recentLogos: kits.map((k) => k.logo), logoMenu: ['draw', 'trace', 'morph', 'wipe'], media: PROFILES.tout, owned: NONE }), writerFor(i));
      recentSequences.push(plan.scenes.join('>'));
      const kctx: KitContext = {
        type: plan.type,
        objective: plan.objective,
        direction,
        artStyleId: brand.branding.artDirection?.styleId,
        quality: 'hd',
        format: 'story',
        durationSec: 15,
        logo,
        hasLogoIcon: !!theme.logo.icon,
        media: { images: 4, videos: 3, models: 1, lotties: 1, rive: 0 },
        scenes: plan.scenes.map((id, k) => ({ key: `${id}-${k}`, sceneId: id, hasMedia: ['product', 'gallery', 'footage'].includes(id), hasTitle: true, three: id === 'showcase3d' })),
        text: MESSAGE,
        seed,
        recent: kits.slice(-6),
        boosts: art.boosts,
      };
      let kit = resolveKit(kctx);
      if (plan.logo) kit = applyKitOverrides(kit, { logo: plan.logo }, kctx).kit;
      kits.push(kit);
      recentConcepts.push(plan.concept);
      recentDirections.push(direction);
      out.push({ concept: plan.concept, direction, logo: kit.logo, background: kit.background, accent: pickAccentEffect(direction, seed, art.boosts), scenes: plan.scenes.join('>') });
    }
    return out;
  };
  const graphOnly = await run(() => undefined);
  const stubborn = await run(() => async () => 'concept: product-hero\nscenes: hook, showcase3d, benefits, cta, logo\naccent: 2\nlogo: draw');
  for (const [name, list] of [['sans modèle', graphOnly], ['modèle qui répond toujours pareil', stubborn]] as const) {
    const concepts = new Set(list.map((v) => v.concept));
    const combos = new Set(list.map((v) => `${v.concept}|${v.direction}|${v.logo}|${v.background}`));
    const sequences = new Set(list.map((v) => v.scenes));
    const consecutive = list.filter((v, i) => i > 0 && v.concept === list[i - 1].concept).length;
    check(`${name} : ${concepts.size} concepts, ${sequences.size} enchaînements, ${combos.size}/12 combinaisons distinctes, ${consecutive} concept(s) répété(s) d’affilée`, concepts.size >= 4 && combos.size >= 10 && consecutive === 0 && sequences.size >= 5);
  }
  console.log(`      sans modèle : ${graphOnly.map((v) => `${v.concept}/${v.direction}/${v.logo}/${v.background}`).join('  ')}`);
  console.log(`      modèle têtu : ${stubborn.slice(0, 6).map((v) => `${v.concept}/${v.direction}/${v.logo}`).join('  ')}`);

  section('4. Budget de tokens');
  const prompt = buildCreativePrompt(baseInput({ media: PROFILES.tout }), CONCEPT_IDS.slice(0, 5) as ConceptId[], Object.keys(SCENE_MENU));
  const creativeIn = estimateTokens(prompt.system + prompt.user);
  const plan = copyPlan(['hook', 'product', 'benefits', 'offer', 'cta', 'logo'], true, ['delivery', 'price', 'quality'], { hints: CONCEPTS['product-hero'].copy, accentIndex: 1 });
  const copyPrompt = buildCopyPrompt(plan, { objective: 'product', message: MESSAGE, musicMood: 'auto' } as any, ctx);
  const copyIn = estimateTokens(copyPrompt.system + copyPrompt.user);
  const enhance = buildEnhancePrompt({ text: MESSAGE, ctx, media: PROFILES.photos, art: 'Editorial' });
  const enhanceIn = estimateTokens(enhance.system + enhance.user);
  check(`direction créative ≈ ${creativeIn} tokens en entrée (≤ 750)`, creativeIn <= 750);
  check(`copie ≈ ${copyIn} tokens en entrée (≤ 1 000)`, copyIn <= 1000);
  check(`« Améliorer ma demande » ≈ ${enhanceIn} tokens en entrée (≤ 350)`, enhanceIn <= 350);
  console.log(`      par vidéo : ≈ ${creativeIn + copyIn} tokens en entrée + ≈ 250 en sortie (type imposé : ≈ ${copyIn} + 150)`);

  section('5. Charte et direction artistique');
  const minimal = motionFromArtDirection({
    styleId: 'minimalism',
    styleName: 'Minimalisme',
    typography: { caseAndTracking: 'Titres en majuscules, interlettrage large', scaleContrast: '', treatment: '' },
    layout: { grid: 'colonnes', density: 'airy', whitespace: 'beaucoup d’espace', signatureMove: 'filet fin' },
    color: { distribution: '70/20/10', application: '', contrast: 'monochrome + accent' },
    imagery: { medium: 'photography', subjects: '', treatment: 'grain léger', lighting: '', framing: '' },
    graphicDevices: ['grille modulaire', 'filets fins'],
    donts: ['Pas de rebond cartoon'],
  } as any);
  check('DA minimaliste → directions précision / suisse / éditorial', minimal.directions.join(',') === 'precision,swiss,editorial', minimal.directions.join(','));
  check('casse, rythme, couleur, décor traduits (majuscules, aéré, retenu, grain)', minimal.overrides.displayCase === 'upper' && minimal.overrides.pace === 1.15 && minimal.overrides.color === 'restrained' && minimal.overrides.decor === 'grain', JSON.stringify(minimal.overrides));
  check('éléments graphiques et « à éviter » → bonus du graphe (grille, filets ; pas de rebond)', (minimal.boosts['bg:dot-grid'] || 0) > 0 && (minimal.boosts['bg:ticks'] || 0) > 0 && (minimal.boosts['easing:spring'] || 0) < 0, JSON.stringify(minimal.boosts));
  let outside = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const d = pickDirection({ type: (['mix', 'product', 'promo', 'kinetic'] as VideoType[])[seed % 4], artDirections: minimal.directions, seed: seed * 977 });
    if (!minimal.directions.includes(d)) outside++;
  }
  check('60 vidéos : la direction reste toujours dans celles de la DA', outside === 0, `${outside} hors DA`);
  const accents = new Map<DirectionId, Set<string>>();
  for (const dir of DIRECTION_IDS) accents.set(dir, new Set([1, 2, 3, 4, 5, 6].map((s) => pickAccentEffect(dir, s * 131))));
  check('grand moment : l’effet suit la direction (cinéma → temps suspendu, brutal → coup de poing)', accents.get('cinematic')!.has('hold') && accents.get('brutal')!.has('punch'), [...accents.entries()].map(([d, s]) => `${d}:${[...s].join('/')}`).join(' '));
  const kctx: KitContext = { type: 'mix', objective: 'product', direction: 'precision', quality: 'hd', format: 'story', durationSec: 15, logo, hasLogoIcon: true, media: { images: 0, videos: 0, models: 0, lotties: 0, rive: 0 }, scenes: [], text: MESSAGE, seed: 3 };
  const menu = topNodes('logo', kctx, 3);
  check(`menu de logo proposé au modèle : ${menu.join(', ')} (3 au plus, tous possibles)`, menu.length >= 1 && menu.length <= 3);

  section('6. « Améliorer ma demande »');
  const grounded = groundEnhanced('Annoncez le nouveau jus de bissap à 1 000 F, pressé chaque matin. Profitez de -20 % ce week-end. Livraison à Dakar — commandez sur WhatsApp au 77 000 00 00 🍹 #bissap', MESSAGE);
  check('fait gardé (1 000 F), chiffres inventés retirés (-20 %, numéro), émoji, hashtag, tiret cadratin nettoyés', grounded.includes('1 000 F') && !/20 %|77 000/.test(grounded) && !/🍹|#bissap|—/.test(grounded), grounded);
  const viaModel = await enhanceRequest({ text: 'video jus', ctx, media: PROFILES.photos }, async () => 'Une vidéo qui présente le jus de bissap pressé le matin, avec les photos du produit, sur un ton chaleureux, et qui invite à commander.');
  const viaTemplate = await enhanceRequest({ text: 'video jus', ctx, media: PROFILES.photos }, async () => '');
  check('modèle utile → réécriture ; réponse vide → gabarit (photos, ton, appel à l’action)', viaModel.source === 'llm' && viaTemplate.source === 'template' && /photos/i.test(viaTemplate.prompt), viaTemplate.prompt);

  section('7. Calendrier éditorial');
  const items: ContentIdea[] = Array.from({ length: 12 }, (_, i) => ({
    id: `c${i}`,
    title: ['Nouveau jus de bissap', 'Les coulisses de la récolte', 'Promo -20 % ce week-end', 'Nos clients racontent', 'Recrutement livreurs', 'Fête de l’indépendance'][i % 6],
    hook: '',
    description: '',
    format: i === 3 ? 'reel' : 'post',
    channel: (['instagram', 'linkedin', 'tiktok', 'facebook', 'blog', 'email'] as const)[i % 6],
    scheduledFor: `2026-11-${String(i + 1).padStart(2, '0')}`,
    week: 1,
    hashtags: [],
    callToAction: '',
    intent: (['awareness', 'awareness', 'promotion', 'awareness', 'recruitment', 'celebration'] as const)[i % 6],
    status: 'idea',
    videoType: i === 3 ? ('quote' as any) : undefined,
  }));
  const shared = ensureVideoShare(items, true);
  const videos = shared.filter((i) => i.format === 'reel' || i.format === 'short-video');
  check(`${videos.length}/12 contenus vidéo (au moins un sur trois), chacun avec un type valide`, videos.length >= 4 && videos.every((v) => !!v.videoType && v.videoType !== ('quote' as any)), videos.map((v) => `${v.channel}:${v.videoType}`).join(' '));
  check('jamais de vidéo pour un blog ou un e-mail', shared.filter((i) => ['blog', 'email'].includes(i.channel)).every((i) => i.format !== 'reel'));
  check('type déduit du contenu (promo → promo, coulisses → footage)', suggestVideoType({ title: 'Promo -20 %', hook: '', description: '', intent: 'promotion', channel: 'instagram' }, true) === 'promo' && suggestVideoType({ title: 'Les coulisses', hook: '', description: '', intent: 'awareness', channel: 'tiktok' }, true) === 'footage');

  console.log(failures ? `\n✗ ${failures} vérification(s) en échec.` : '\n✓ Direction créative : bornée, robuste, variée.');
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

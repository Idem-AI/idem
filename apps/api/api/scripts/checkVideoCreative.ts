/**
 * `npm run check:video:creative` — créativité bornée, robustesse, variété.
 *
 *  1. Concepts : chaque concept × durée × médias se déplie en un enchaînement valide.
 *  2. Modèles faibles : réponses parfaites, JSON, bavardes, inventées, vides, en panne —
 *     la vidéo est toujours complète et correcte ; les médias de l'utilisateur sont montrés.
 *  3. Variété : 12 vidéos du même projet et du même brief ne se ressemblent pas
 *     (concept, direction, logo, fond), même si le modèle répond toujours la même chose.
 *  4. Budget : tokens de la direction créative, de la copie, de « Améliorer ».
 *  5. Charte : la DA exclut des directions, transitions et mises en page ; casse, rythme, bonus.
 *  6. « Améliorer ma demande » : faits gardés, chiffres inventés retirés.
 *  7. Calendrier : une vidéo sur trois au moins, chacune avec un type valide.
 *  8. Agents : directeur artistique, animateur, sound designer, critique — réponses parfaites,
 *     lettres seules, JSON, inventions, vides, pannes ; budgets ; menus fidèles à la DA.
 */
import { VideoType } from '../models/motionVideo.model';
import { ContentIdea } from '../models/communication.model';
import { CONCEPTS, CONCEPT_IDS, ConceptId, expandConcept, mediaCapacity, mustShowScenes, pickConcept, sceneRange, TYPE_SIGNATURE } from '../services/Communication/video/video.concepts';
import { buildCreativePrompt, CreativeInput, parseCreative, planCreative, SCENE_MENU } from '../services/Communication/video/video.storyline';
import { copyPlan, buildCopyPrompt, estimateTokens, extractFacts } from '../services/Communication/video/video.copy';
import { DIRECTION_IDS, DIRECTIONS, DirectionId, pickDirection, planMotion, transitionMenu } from '../services/Communication/video/video.direction';
import { ART_TRANSITION_EXCLUDES, motionFromArtDirection } from '../services/Communication/video/video.artdirection';
import { assignLayouts, layoutMenu, LayoutScene } from '../services/Communication/video/video.layouts';
import {
  AnimatorInput,
  brandSheet,
  buildAnimatorPrompt,
  buildArtDirectorPrompt,
  buildCriticPrompt,
  buildSoundPrompt,
  CriticInput,
  parseAnimator,
  parseArtDirector,
  parseCritic,
  parseSound,
  runAnimator,
} from '../services/Communication/video/video.agents';
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
  // La DA EXCLUT (au lieu de restreindre à 2-3 directions, ce qui rendait toutes les vidéos
  // d'une marque semblables) : jamais une direction exclue, une majorité de directions préférées,
  // et de la variété d'une vidéo à l'autre.
  const series: DirectionId[] = [];
  for (let seed = 1; seed <= 60; seed++) {
    series.push(pickDirection({ type: (['mix', 'product', 'promo', 'kinetic'] as VideoType[])[seed % 4], artDirections: minimal.directions, artExcluded: minimal.excluded, seed: seed * 977, avoid: series.slice(-3) }));
  }
  const excludedHits = series.filter((d) => minimal.excluded.includes(d)).length;
  const preferred = series.filter((d) => minimal.directions.includes(d)).length;
  const twins = series.filter((d, i) => i > 0 && d === series[i - 1]).length;
  check('60 vidéos : jamais une direction exclue par la DA (brutal, collage)', excludedHits === 0, `${excludedHits} exclue(s)`);
  check('60 vidéos : les directions préférées de la DA dominent (≥ 50 %)', preferred >= 30, `${preferred}/60`);
  check('60 vidéos : au moins 4 directions, jamais deux fois de suite la même', new Set(series).size >= 4 && twins === 0, `${new Set(series).size} directions, ${twins} répétition(s)`);
  check('DA minimaliste : transitions et mises en page tapageuses exclues', ['glitch', 'stripes', 'flashCut'].every((t) => minimal.excludedTransitions.includes(t)) && ['ticker', 'priceBurst'].every((l) => minimal.excludedLayouts.includes(l)), `${minimal.excludedTransitions.join(',')} | ${minimal.excludedLayouts.join(',')}`);
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

  section('8. Équipe d’agents (directeur artistique, animateur, sound designer, critique)');
  {
    const sheet = brandSheet({
      ctx,
      palette: { primary: '#8B1E3F', secondary: '#F2C14E', accent: '#2E7D32', background: '#FFF8F0' },
      fonts: { display: 'Fraunces', body: 'Inter' },
      art: { styleId: 'minimalism', styleName: 'Minimalisme', tagline: 'Le goût, sans détour', keywords: ['épuré', 'naturel'], dos: ['Beaucoup d’air'], donts: ['Pas de rebond cartoon'] } as any,
    });
    check('fiche de marque : couleurs, polices, DA, à faire / à éviter', /#8B1E3F/.test(sheet) && /Fraunces/.test(sheet) && /sans détour/.test(sheet) && /AVOID: Pas de rebond/.test(sheet), sheet.replace(/\n/g, ' | ').slice(0, 160));

    // Directeur artistique : une scène, un menu filtré par la direction et la DA.
    const statScene = { sceneId: 'stat', slots: { value: '87 %', label: 'de clients fidèles' } };
    const menu = layoutMenu(statScene, { direction: 'swiss', excluded: minimal.excludedLayouts });
    check('menu de mise en page d’un chiffre (suisse) : grand chiffre en tête, « classic » en dernier', menu[0] === 'bigNumber' && menu[menu.length - 1] === 'classic' && menu.length <= 4, menu.join(','));
    const adScene = { index: 2, count: 6, sceneId: 'stat', duration: 2.4, texts: ['87 %', 'de clients fidèles'], menu };
    const adPrompt = buildArtDirectorPrompt(sheet, 'swiss', adScene);
    const adIn = estimateTokens(adPrompt.system + adPrompt.user);
    check(`directeur artistique ≈ ${adIn} tokens en entrée (≤ 380)`, adIn <= 380);
    check('directeur artistique : « layout: b / word: … » compris', parseArtDirector('layout: b\nword: 87', adScene).layout === menu[1]);
    check('directeur artistique : une lettre seule suffit', parseArtDirector(' a) ', adScene).layout === menu[0]);
    check('directeur artistique : identifiant inventé ignoré', parseArtDirector('layout: hologram3d', adScene).layout === undefined);
    const hookScene = { index: 0, count: 6, sceneId: 'hook', texts: ['Le bissap pressé chaque matin'], menu: layoutMenu({ sceneId: 'hook', slots: { title: 'Le bissap pressé chaque matin' } }, { direction: 'kinetic' }) };
    check('directeur artistique : le mot mis en valeur retrouvé dans le titre', parseArtDirector('**Layout**: A\n**Word**: "Pressé"', hookScene).emphasis === 2, JSON.stringify(parseArtDirector('**Layout**: A\n**Word**: "Pressé"', hookScene)));

    // Les menus respectent la DA, pour toutes les directions et tous les styles du catalogue.
    let leaks = 0;
    let thin = 0;
    for (const style of Object.keys(ART_TRANSITION_EXCLUDES)) {
      const art = motionFromArtDirection({ styleId: style } as any);
      for (const dir of DIRECTION_IDS) {
        const tm = transitionMenu(dir, { excluded: art.excludedTransitions });
        if (tm.some((t) => art.excludedTransitions.includes(t.id))) leaks++;
        if (tm.length < 3) thin++;
        for (const sc of ['hook', 'statement', 'benefits', 'stat', 'cta']) {
          const lm = layoutMenu({ sceneId: sc, slots: { title: 'Trois mots forts ici', sub: 'Un détail', b1: 'Un', b2: 'Deux', value: '87 %', label: 'clients', action: 'Commander' } }, { direction: dir, excluded: art.excludedLayouts });
          if (lm.some((l) => art.excludedLayouts.includes(l))) leaks++;
        }
      }
    }
    check('menus de transitions et de mises en page : jamais une option exclue par la DA', leaks === 0, `${leaks} fuite(s)`);
    check('menu de transitions : au moins 3 choix pour chaque direction × DA', thin === 0, `${thin} menu(s) trop court(s)`);
    const recentHeavy = transitionMenu('kinetic', { recent: [['whip', 'zoomThrough', 'whip', 'stripes']] });
    check('menu de transitions : celles de la vidéo précédente reculent', recentHeavy[0].id !== 'whip' && recentHeavy.findIndex((t) => t.id === 'whip') > 1, recentHeavy.map((t) => t.id).join(','));

    // Plan de mouvement avec le catalogue : pas de répétition, plafond par transition.
    const ids = ['hook', 'statement', 'benefits', 'stat', 'kinetic', 'quote', 'cta', 'logo'];
    let repeats = 0;
    let overCap = 0;
    const seen = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) {
      const dir = DIRECTION_IDS[seed % DIRECTION_IDS.length];
      const plan = planMotion(ids, dir, seed * 31, { transitions: transitionMenu(dir) });
      const cuts = plan.map((m) => m.transition).filter(Boolean) as string[];
      cuts.forEach((c, i) => {
        seen.add(c);
        if (i > 0 && c === cuts[i - 1]) repeats++;
      });
      const counts = new Map<string, number>();
      cuts.slice(0, -1).forEach((c) => counts.set(c, (counts.get(c) || 0) + 1));
      if ([...counts.values()].some((n) => n > Math.ceil(cuts.length / 3) + 1)) overCap++;
    }
    check('30 films : jamais deux fois la même transition de suite, aucune transition sur-utilisée', repeats === 0 && overCap === 0, `${repeats} répétition(s), ${overCap} excès`);
    check(`30 films : ${seen.size} transitions différentes utilisées (≥ 12 sur 17)`, seen.size >= 12, [...seen].join(','));

    // Mises en page du film : choix de l'agent gardés s'ils sont valides, sinon le graphe.
    const film: LayoutScene[] = [
      { sceneId: 'hook', slots: { title: 'Le bissap pressé chaque matin' } },
      { sceneId: 'statement', slots: { title: 'Rien d’autre que des fleurs', sub: 'Et un peu de menthe' } },
      { sceneId: 'benefits', slots: { title: 'Pourquoi nous', b1: 'Frais', b2: 'Local', b3: 'Livré' } },
      { sceneId: 'stat', slots: { value: '87 %', label: 'de clients fidèles' } },
      { sceneId: 'footage', slots: { title: 'À Dakar' }, video: 'clip.mp4' },
      { sceneId: 'cta', slots: { title: 'Commandez aujourd’hui', action: 'Commander' } },
      { sceneId: 'logo', slots: {} },
    ];
    const layouts = assignLayouts(film, { direction: 'kinetic', seed: 7, chosen: { 0: 'wordStack', 1: 'wordStack', 2: 'hologram', 3: 'bigNumber' } });
    check('mises en page : choix valides gardés (pile de mots, grand chiffre), répétition et invention remplacées', layouts[0] === 'wordStack' && layouts[1] !== 'wordStack' && layouts[2] !== ('hologram' as any) && !!layouts[2] && layouts[3] === 'bigNumber', layouts.join(','));
    check('mises en page : clip et signature gardent leur composition', layouts[4] === undefined && layouts[6] === undefined);
    let consecutive = 0;
    let classicHeavy = 0;
    const used = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const dir = DIRECTION_IDS[seed % DIRECTION_IDS.length];
      const l = assignLayouts(film, { direction: dir, seed: seed * 17 });
      l.forEach((x, i) => {
        if (x) used.add(x);
        if (x && i > 0 && x === l[i - 1]) consecutive++;
      });
      if (l.filter((x) => x === 'classic').length > 2) classicHeavy++;
    }
    check('40 films : jamais deux fois la même mise en page de suite, « classic » minoritaire', consecutive === 0 && classicHeavy === 0, `${consecutive} répétition(s), ${classicHeavy} film(s) trop classiques`);
    check(`40 films : ${used.size} mises en page différentes utilisées (≥ 10 sur 15)`, used.size >= 10, [...used].join(','));

    // Animateur.
    const animIn: AnimatorInput = {
      sheet,
      direction: 'kinetic',
      rhythm: 'staccato',
      scenes: film.map((f) => ({ sceneId: f.sceneId, duration: 2, title: f.slots.title })),
      transitions: transitionMenu('kinetic'),
      techniques: DIRECTIONS.kinetic.headline,
      cameras: ['push', 'drift', 'tilt'],
      entrances: ['spring', 'pop', 'skew'],
      logos: ['assemble', 'morph', 'draw'],
    };
    const ap = buildAnimatorPrompt(animIn);
    const apIn = estimateTokens(ap.system + ap.user);
    check(`animateur ≈ ${apIn} tokens en entrée (≤ 700)`, apIn <= 700);
    const ids2 = animIn.transitions.map((t) => t.id);
    const anim = parseAnimator(`cuts: 2=a, 3=c, 4=${ids2[1]}, 9=a, 5=teleport\ntitles: 1=${DIRECTIONS.kinetic.headline[0]}, 2=explode\ncamera: tilt\nentrance: b\nlogo: fireworks`, animIn);
    check('animateur : coupes par lettre ou identifiant, hors bornes et inventions ignorées', anim.cuts[1] === ids2[0] && anim.cuts[2] === ids2[2] && anim.cuts[3] === ids2[1] && !(8 in anim.cuts) && !(4 in anim.cuts), JSON.stringify(anim.cuts));
    check('animateur : entrée, caméra et famille validées, logo inventé refusé', anim.titles[0] === DIRECTIONS.kinetic.headline[0] && !(1 in anim.titles) && anim.camera === 'tilt' && anim.entrance === 'pop' && !anim.logo, JSON.stringify({ t: anim.titles, c: anim.camera, e: anim.entrance, l: anim.logo }));
    const animJson = parseAnimator(JSON.stringify({ cuts: { 2: 'b', 3: 'a' }, camera: 'drift' }), animIn);
    check('animateur : réponse JSON comprise', animJson.cuts[1] === ids2[1] && animJson.cuts[2] === ids2[0] && animJson.camera === 'drift', JSON.stringify(animJson));
    const silent = await runAnimator(async () => '', animIn);
    const broken = await runAnimator(async () => {
      throw new Error('quota');
    }, animIn);
    check('animateur : réponse vide ou modèle en panne → repli du graphe, sans erreur', silent.run.source === 'graph' && broken.run.source === 'graph' && !Object.keys(broken.choice.cuts).length);

    // Sound designer.
    const tracks = [
      { id: 't1', title: 'Sad Piano Tears', artist: 'Anon', moods: ['sad'], bpm: 70, durationSec: 120 },
      { id: 't2', title: 'Afro Sunrise', artist: 'Kora Lab', moods: ['upbeat', 'afro'], bpm: 108, durationSec: 150 },
      { id: 't3', title: 'Corporate Light', artist: 'Studio', moods: ['corporate'], bpm: 96, durationSec: 140 },
    ];
    const soundIn = { sheet, request: MESSAGE, rhythm: 'steady', mood: 'afro', durationSec: 15, tracks };
    const sp = buildSoundPrompt(soundIn);
    check(`sound designer ≈ ${estimateTokens(sp.system + sp.user)} tokens en entrée (≤ 380)`, estimateTokens(sp.system + sp.user) <= 380);
    const sound = parseSound('track: b\nsfx: punchy', soundIn);
    check('sound designer : piste par lettre, intensité comprise', sound.trackId === 't2' && sound.intensity === 'punchy', JSON.stringify(sound));
    check('sound designer : piste inventée ignorée', parseSound('track: z\nsfx: loud!!', soundIn).trackId === undefined);

    // Critique.
    const critIn: CriticInput = {
      sheet,
      direction: 'kinetic',
      rhythm: 'staccato',
      scenes: film.map((f, i) => ({ sceneId: f.sceneId, duration: 2, layout: layouts[i], transition: i ? ids2[i % ids2.length] : undefined, technique: 'maskUp', title: f.slots.title, layouts: layoutMenu(f, { direction: 'kinetic' }, 5) })),
      transitions: ids2,
      techniques: DIRECTIONS.kinetic.headline,
      warnings: [],
    };
    const cp = buildCriticPrompt(critIn);
    check(`critique ≈ ${estimateTokens(cp.system + cp.user)} tokens en entrée (≤ 750)`, estimateTokens(cp.system + cp.user) <= 750);
    const fixes = parseCritic(`1.layout=${critIn.scenes[0].layouts[1]}\n3.cut=${ids2[0]}\n1.cut=${ids2[0]}\n2.title=${DIRECTIONS.kinetic.headline[1]}\n4.layout=hologram\n7.title=${DIRECTIONS.kinetic.headline[0]}\nok`, critIn);
    check('critique : corrections valides gardées ; coupe de la 1re scène, signature et inventions refusées', fixes.length === 3 && fixes.every((f) => !(f.index === 0 && f.field === 'cut') && f.index !== 6), JSON.stringify(fixes));
    check('critique : « ok » = aucune correction', parseCritic('ok', critIn).length === 0);

    // Cran Max : réglages bornés du directeur artistique, corrections de taille et de tempo du critique.
    const tuned = { ...adScene, tune: { surfaces: ['light', 'primary', 'tint'] } };
    const tunedPrompt = buildArtDirectorPrompt(sheet, 'swiss', tuned);
    check('cran Max : le prompt du directeur artistique demande taille, alignement, surface (menu), tempo, décor', /scale:/.test(tunedPrompt.system) && /surface: one of light \| primary \| tint/.test(tunedPrompt.system) && /tempo:/.test(tunedPrompt.system));
    const t1 = parseArtDirector('layout: a\nscale: 1.6\nalign: Center\nsurface: b\ntempo: lively\ndecor: yes', tuned).tuning;
    check('cran Max : taille ramenée dans ses bornes (1,6 → 1,25), surface par lettre, tempo et décor compris', t1?.scale === 1.25 && t1?.align === 'center' && t1?.surface === 'primary' && t1?.tempo === 'lively' && t1?.decor === true, JSON.stringify(t1));
    const t2 = parseArtDirector('layout: a\nsurface: neon-pink\nscale: huge', tuned).tuning;
    check('cran Max : surface hors du menu de la DA et taille illisible refusées', !t2?.surface && t2?.scale === undefined, JSON.stringify(t2));
    check('sous Max : aucun réglage lu, même si le modèle en propose', parseArtDirector('layout: a\nscale: 1.2\nsurface: a', adScene).tuning === undefined);
    const tuningFixes = parseCritic('2.scale=1.4\n3.tempo=calm\n4.tempo=furious', { ...critIn, tuning: true });
    check('cran Max : le critique corrige taille (bornée) et tempo (menu)', tuningFixes.some((f) => f.field === 'scale' && f.value === '1.25') && tuningFixes.some((f) => f.field === 'tempo' && f.value === 'calm') && !tuningFixes.some((f) => f.value === 'furious'), JSON.stringify(tuningFixes));
    check('sous Max : le critique ne touche ni taille ni tempo', parseCritic('2.scale=1.1\n3.tempo=calm', critIn).length === 0);
  }

  console.log(failures ? `\n✗ ${failures} vérification(s) en échec.` : '\n✓ Direction créative : bornée, robuste, variée.');
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

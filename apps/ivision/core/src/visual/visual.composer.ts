/**
 * LA COMPOSITION D'UN VISUEL — flyer, publication, story, bannière, page A4.
 *
 * Le même compositeur pour IDEM (module Communication, charte graphique) et pour iVision, en trois temps :
 *
 *  1. les MOTS — le rédacteur (tous crans) remplit des cases bornées et contrôlées : un fait absent de la
 *     demande (date, lieu, prix, format) n'apparaît jamais (`visual.copy.ts`) ;
 *  2. la PHOTO — celle de l'utilisateur, celles de la marque classées par la vision, sinon une photo de
 *     banque ou une image générée VÉRIFIÉES : une photo hors sujet est pire que pas de photo
 *     (`visual.images.ts`, `image.sourcing.ts`) ;
 *  3. la PAGE — le moteur de génération graphique (@idem/graphic-engine) la compose, la mesure et la
 *     répare : ses motifs de visuels, la charte de la marque (couleurs, polices, logo, motifs), sa jauge
 *     de créativité (le code choisit aux crans Low et Medium, un directeur artistique à partir de High,
 *     un arbre d'auteur au cran Ultra). L'IA n'écrit jamais de HTML.
 *
 * Aucune écriture ici : l'appelant décide de ce qu'il persiste.
 */
import {
  brandFromIdem,
  engineHost,
  BrandInput,
  DirectionInput,
  FORMATS,
  FormatId,
  memoryEnabled,
  pageDocument,
  ReferenceComposition,
  renderSingle,
  screenshot,
  sectionHtml,
  SectionOutput,
  SectionSpec,
  visualContent,
  VisualCopy,
} from '@idem/graphic-engine';
import axios from 'axios';
import sharp from 'sharp';
import logger from '../runtime/logger';
import { coreHost } from '../runtime/host';
import { CreativityLevel, normalizeCreativity } from '../creativity/levels';
import { AgentCall, CreativeOrchestrator } from '../creativity/orchestrator';
import type { ReferenceImage } from '../reference/reference.analyzer';
import { imageSourcingService, ImageSourcingPreferences, SourcedImage } from './image.sourcing';
import { copyTask, CopyBrief, inferCopyIntent, reformulateBriefTask, WrittenCopy } from './visual.copy';
import { classifyImage, describePhoto, rankByRelevance, VisualPhoto } from './visual.images';
import { FlyerFormat, VisualAuditReport, VisualBrandContext, VisualContent, VisualIntent, VisualMeta } from './visual.model';
import { chooseVisualConcept, ConceptChoice, conceptText, VisualConcept } from './visual.concept';
import { cutout, treatPhoto, vectorizeImage } from '../../../../../packages/design-tools/src';
import { safeFetch } from '../render/safe-fetch';

export interface PromptMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Les modèles de l'hôte. */
export interface VisualPorts {
  /** Brief d'image et retouches (`imageBrief`), au modèle que l'hôte associe à chacun. */
  runPrompt?: (feature: 'flyer' | 'imageBrief', messages: PromptMessage[]) => Promise<string>;
  /** Les agents : le rédacteur, puis — selon le cran — ceux du moteur graphique. */
  agentCall?: AgentCall;
}

/** La photo d'un visuel, gardée avec lui : la retouche la recompose sans la rechercher. */
export interface VisualPhotoRef {
  url: string;
  focal?: { x: number; y: number };
  subject?: string;
}

export interface ComposedVisual {
  html: string;
  parsed: Partial<VisualMeta> & {
    /** La composition retenue par le moteur graphique. */
    layout: string;
    /** Les mots du visuel, case par case : la retouche les reprend. */
    copy: WrittenCopy;
    photo?: VisualPhotoRef;
    /** La graine de la composition : une retouche de texte garde la même mise en page. */
    seed: string;
    /** L'arbre de la page (vérité du rendu) : une retouche le modifie et le REJOUE, sans recomposer. */
    spec: SectionSpec;
    imageUnavailable?: 'payment' | 'rejected';
  };
  sourced: SourcedImage | null;
  intent: VisualIntent;
  /** Visuel photographié après mesure et réparation. */
  png: Buffer;
  audit: VisualAuditReport;
  /** L'idée retenue (étape concept), quand elle a eu lieu. */
  concept?: ConceptChoice;
  /**
   * Les autres compositions écrites pour ce visuel (déjà payées), de la mieux mesurée à la moins bien : proposées au
   * client, qui choisit. Absentes quand une seule variante a été écrite.
   */
  alternatives?: Array<{ html: string; spec: SectionSpec; png: Buffer; score: number }>;
  /** Le score de la composition retenue (quand plusieurs ont été mesurées). */
  score?: number;
}

/** Le format du moteur graphique de chaque format de visuel. */
export const VISUAL_FORMAT: Record<FlyerFormat, FormatId> = {
  square: 'flyer-square',
  story: 'flyer-story',
  banner: 'flyer-banner',
  post: 'flyer-post',
  a4: 'flyer-a4',
};

/** Les dimensions de chaque format (px) — celles des toiles du moteur. */
export const VISUAL_SIZE: Record<FlyerFormat, { width: number; height: number }> = {
  square: { width: FORMATS['flyer-square'].width, height: FORMATS['flyer-square'].height },
  story: { width: FORMATS['flyer-story'].width, height: FORMATS['flyer-story'].height },
  banner: { width: FORMATS['flyer-banner'].width, height: FORMATS['flyer-banner'].height },
  post: { width: FORMATS['flyer-post'].width, height: FORMATS['flyer-post'].height },
  a4: { width: FORMATS['flyer-a4'].width, height: FORMATS['flyer-a4'].height },
};

/**
 * Compose un visuel — IDEM (calendrier, atelier, charte) et iVision (conversation).
 */
export async function composeVisual(
  ports: VisualPorts,
  userId: string,
  projectId: string,
  content: VisualContent,
  context: VisualBrandContext,
  format: FlyerFormat,
  tag: string,
  seedKey: string,
  /** Réglages de sourcing d'un appelant hors module (la charte graphique). */
  sourcing?: ImageSourcingPreferences,
  /** Composition typographique, sans photo (demandé). */
  skipImage?: boolean,
  creative: {
    creativity?: CreativityLevel;
    /** Gardé pour compatibilité : la variété vient désormais de la mémoire de diversité du moteur. */
    recentLayouts?: string[];
    /**
     * Une image modèle (iVision) : sa présence ou non de photo, sa structure et son allure, lues par les agents ;
     * son adresse (`url`) sert au contrôle de ressemblance après le rendu.
     */
    reference?: Pick<ReferenceImage, 'layout' | 'structure' | 'hasPhoto' | 'description' | 'zones' | 'style'> & { url?: string };
    /** La photo de l'utilisateur (iVision) : posée à la place d'une photo de banque ou générée. */
    image?: { url: string };
    /** Les images de la marque (site, projet, imports) : seules les vraies photos sont gardées. */
    brandPhotos?: string[];
    /** Fond sombre admis (demande explicite, ou la marque fait elle-même des visuels sombres). */
    allowDark?: boolean;
    /** Retour sur la version précédente : le rédacteur cherche plus frappant, le moteur une autre composition. */
    feedback?: string;
    avoid?: { template?: string; scheme?: string }[];
    /** L'avancement réel, pour l'interface (iVision : la liste des étapes du chat). */
    onStage?: (stage: string, state: 'running' | 'done') => void;
    /**
     * DÉCLINER un visuel déjà fait dans un autre format : mêmes mots, même image, même idée ; seule la composition
     * s'adapte à la nouvelle toile (l'auteur part du code du visuel d'origine). Aucun concept, aucun rédacteur.
     */
    adaptFrom?: { spec: SectionSpec; copy: WrittenCopy; photo?: VisualPhotoRef; concept?: string; format: FlyerFormat };
  } = {}
): Promise<ComposedVisual> {
  const started = Date.now();
  const level = normalizeCreativity(creative.creativity);
  const stage = (name: string, state: 'running' | 'done') => {
    try {
      creative.onStage?.(name, state);
    } catch {
      /* l'interface ne bloque jamais la composition */
    }
  };
  const orch = new CreativeOrchestrator({ level, call: ports.agentCall, timeoutMs: { agents: 45_000, critic: 60_000 } });
  const message = [content.title, content.hook].filter(Boolean).join(' — ');
  const copyIntent = inferCopyIntent(`${message} ${content.description || ''}`);
  const scopes = memoryScopesOf(context, userId, projectId);

  // La DÉCLINAISON d'un visuel déjà fait (autre format) : la même idée, recomposée pour la nouvelle toile.
  if (creative.adaptFrom) {
    const from = creative.adaptFrom;
    stage('design', 'running');
    const instruction = `Adapt this exact visual to the new ${format} canvas (it was made for ${from.format}): keep its idea, words, image, colours and hierarchy; recompose the proportions and positions for the new canvas so it reads as the same campaign.`;
    const adapted = await renderVisual(context, format, from.copy, from.photo, { level, seed: `${seedKey}:adapt`, userId, projectId, allowDark: creative.allowDark, revise: { spec: from.spec, instruction }, ...(from.concept ? { concept: from.concept } : {}), ...scopes });
    stage('design', 'done');
    if (!adapted.png) throw new Error('visual_render_failed');
    return {
      html: sectionHtml(adapted),
      parsed: { layout: adapted.spec.pattern.id, copy: from.copy, ...(from.photo ? { photo: from.photo } : {}), seed: `${seedKey}:adapt`, spec: adapted.spec, concept: from.concept || adapted.spec.pattern.id, marketingText: { headline: from.copy.headline, subheadline: from.copy.sub, body: from.copy.facts.map((f) => f.text).join(' · ') }, creativity: level, agents: orch.traces },
      sourced: null,
      intent: inferVisualIntent(content),
      png: adapted.png,
      audit: auditOf(adapted),
    };
  }

  // 0. La reformulation — transparente (même chargement) : la demande, souvent brève, devient un brief
  // détaillé et professionnel ; un mot de style (« grandiose », « épuré »…) en est extrait comme direction
  // pour la page plutôt que laissé dans le texte, où le rédacteur le recopierait tel quel.
  stage('copy', 'running');
  const rawAsk = [message, content.description].filter(Boolean).join(' ').trim();
  const reformulated = rawAsk ? (await orch.run(reformulateBriefTask(rawAsk, context.language || 'fr'))).value : { brief: rawAsk, styleKeywords: [] };
  const brief: CopyBrief = {
    message: reformulated.brief || rawAsk,
    details: reformulated.brief || rawAsk,
    brandName: context.brandName,
    businessType: context.businessType,
    valueProposition: context.valueProposition,
    tone: context.tone,
    language: context.language || 'fr',
  };

  // 0 bis. L'IDÉE du visuel (plan qualité créative) : quatre pistes, la plus nouvelle retenue par le code ; les mots,
  // l'image et la page la suivent. Pas d'idée propre quand le client donne un MODÈLE à reproduire.
  stage('concept', 'running');
  const previous = creative.reference ? { ideas: [] as string[], axes: [] as string[] } : await recentIdeas(scopes);
  const chosen = creative.reference
    ? null
    : await chooseVisualConcept(ports.agentCall, {
        request: rawAsk || message,
        brand: context.brandName,
        business: context.businessType,
        tone: context.tone,
        format,
        language: context.language || 'fr',
        previous: previous.ideas,
        hasUserPhoto: !!creative.image?.url,
        level,
        seed: `${projectId}|${seedKey}`,
        country: context.country,
        usedAxes: previous.axes,
      }).catch(() => null);
  const concept: VisualConcept | undefined = chosen?.concept;
  stage('concept', 'done');
  if (concept) brief.details = `${brief.details}\n\nVISUAL IDEA (the words must serve it): ${conceptText(concept)}`;

  // 1. Les mots.
  let copyRun = await orch.run(copyTask(brief, copyIntent, creative.feedback));
  // Les mots font le visuel : un modèle muet (délai, panne) a droit à un second essai.
  if (copyRun.source === 'graph' && orch.traces[orch.traces.length - 1]?.reason === 'failed') {
    copyRun = await orch.run({ ...copyTask(brief, copyIntent, creative.feedback), key: 'posterCopywriter:retry' });
  }
  const copy = copyRun.value;
  stage('copy', 'done');

  // 2. La photo.
  stage('photo', 'running');
  // Le sujet jugé par la vision : la scène voulue par le rédacteur, puis le message.
  // L'image que l'IDÉE demande, sinon la scène voulue par le rédacteur, puis le message.
  const subject = `${concept?.imageSubject ? `${concept.imageSubject}. ` : copy.photo ? `${copy.photo.idea}. ` : ''}${copy.headline}. ${message}`.slice(0, 300);
  const highUp = level === 'high' || level === 'ultra';
  const noImage = (skipImage || concept?.image === 'none') && !creative.image?.url;
  const chosenPhoto = noImage
    ? { photo: undefined, sourced: null, unavailable: undefined }
    : await choosePhoto({ userId, projectId, tag, context, format, copy, subject, sourcing, userPhoto: creative.image?.url, brandPhotos: creative.brandPhotos, preferGenerated: highUp || concept?.image === 'illustration', scene: concept?.imageSubject || copy.photo?.idea });
  const { sourced, unavailable } = chosenPhoto;
  // L'image FAÇONNÉE par l'idée : illustration vectorielle aux couleurs de la marque, sujet détouré, traitement.
  const shaped = concept && chosenPhoto.photo ? await shapeImage(chosenPhoto.photo, concept, context, tag).catch((error) => (logger.warn('visual.image_shaping_failed', { event: 'visual.image_shaping_failed', role: concept.image, error: (error as Error)?.message }), null)) : null;
  const photo = shaped?.photo ?? chosenPhoto.photo;
  stage('photo', 'done');

  // 3. La page, écrite par l'auteur du moteur graphique (HTML Tailwind). Un retour (« autre chose ») est un
  // nouveau tirage du modèle ; la mémoire des bibles de la marque l'écarte de ce qui a déjà été fait.
  stage('design', 'running');
  const seed = creative.feedback || creative.avoid?.length ? `${seedKey}:retake:${Date.now().toString(36)}` : seedKey;
  // Le MODÈLE de l'utilisateur : sa composition (description et zones) est donnée à l'auteur, qui la reproduit
  // avec la marque, les mots et la photo — à tous les crans.
  const reference = creative.reference?.description
    ? { description: creative.reference.description, ...(creative.reference.zones?.length ? { zones: creative.reference.zones } : {}), ...(creative.reference.style ? { style: creative.reference.style } : {}) }
    : undefined;
  // Un modèle sombre est un choix de l'utilisateur : son fond est repris.
  const allowDark = creative.allowDark || creative.reference?.style?.background === 'dark';
  const renderOptions = {
    ...(reference ? { reference } : {}),
    level,
    seed,
    userId,
    projectId,
    allowDark,
    imageColors: sourced?.analysis?.dominantColors,
    ...(reformulated.styleKeywords.length ? { keywords: reformulated.styleKeywords } : {}),
    ...(concept ? { concept: `${conceptText(concept)}${shaped?.note ? ` ${shaped.note}` : ''}`, ...(chosen?.axis ? { axisId: chosen.axis } : {}) } : {}),
    // Une idée « expressive » : une police d'accroche pour le titre seul, qui contraste avec celles de la marque.
    ...scopes,
  };
  let out = await renderVisual(context, format, copy, photo, renderOptions);
  stage('design', 'done');

  // La RESSEMBLANCE au modèle : la vision compare le modèle et le rendu côte à côte ; s'ils divergent, l'auteur
  // reçoit les écarts précis et corrige une fois (même mots, même photo). Borné : un contrôle, une retouche.
  if (reference && creative.reference?.url && level !== 'low' && out.png) {
    stage('match', 'running');
    const verdict = await compareToReference(creative.reference.url, out.png).catch((error) => {
      logger.warn('visual.reference_check_failed', { event: 'visual.reference_check_failed', error: (error as Error)?.message });
      return null;
    });
    if (verdict && verdict.score < 7 && verdict.differences.length) {
      const instruction = `Make the layout match the client's model exactly. Fix these differences: ${verdict.differences.map((d, i) => `${i + 1}. ${d}`).join(' ')}`;
      const fixed = await renderVisual(context, format, copy, photo, { ...renderOptions, revise: { spec: out.spec, instruction } }).catch((error) => {
        logger.warn('visual.reference_fix_failed', { event: 'visual.reference_fix_failed', error: (error as Error)?.message });
        return null;
      });
      if (fixed?.png) out = fixed;
    }
    logger.info('visual.reference_checked', { event: 'visual.reference_checked', brandId: projectId, score: verdict?.score, differences: verdict?.differences.length ?? 0, fixed: !!verdict && verdict.score < 7 });
    stage('match', 'done');
  }

  const audit = auditOf(out);
  logger.info('visual.composed', {
    event: 'visual.composed',
    brandId: projectId,
    creativity: level,
    format,
    pattern: out.spec.pattern.id,
    image: photo ? sourced?.source ?? 'brand' : 'none',
    ...(unavailable ? { imageUnavailable: unavailable } : {}),
    photoIdea: copy.photo?.idea,
    score: audit.score,
    blocking: audit.blocking,
    agentCalls: out.result.usage.agentCalls + orch.traces.filter((t) => t.source === 'llm').length,
    ms: Date.now() - started,
  });
  if (!out.png) throw new Error('visual_render_failed');
  const alternatives = (out.alternatives ?? []).filter((a) => a.png).map((a) => ({ html: sectionHtml({ result: a.result }), spec: a.spec, png: a.png!, score: a.score }));
  return {
    ...(chosen ? { concept: chosen } : {}),
    ...(alternatives.length ? { alternatives } : {}),
    ...(out.score !== undefined ? { score: out.score } : {}),
    html: sectionHtml(out),
    parsed: {
      layout: out.spec.pattern.id,
      copy,
      ...(photo ? { photo } : {}),
      seed,
      spec: out.spec,
      concept: out.spec.pattern.id,
      marketingText: { headline: copy.headline, subheadline: copy.sub, body: copy.facts.map((f) => f.text).join(' · ') },
      creativity: level,
      agents: orch.traces,
      // Pourquoi le visuel n'a pas d'image, quand il n'en a pas : fournisseur sans crédit, ou images hors sujet.
      ...(unavailable ? { imageUnavailable: unavailable } : {}),
    },
    sourced,
    intent: inferVisualIntent(content),
    png: out.png,
    audit,
  };
}

/**
 * Le modèle et le rendu, côte à côte, jugés par la vision sur la COMPOSITION seule (les couleurs, les mots et
 * la photo diffèrent volontairement) : une note sur 10 et les écarts, écrits comme des consignes de retouche.
 */
export async function compareToReference(referenceUrl: string, rendered: Buffer): Promise<{ score: number; differences: string[] } | null> {
  const analyze = coreHost().analyzeImage;
  if (!analyze) return null;
  const res = await axios.get<ArrayBuffer>(referenceUrl, { responseType: 'arraybuffer', timeout: 20_000, maxContentLength: 25 * 1024 * 1024 });
  const height = 640;
  const [left, right] = await Promise.all([
    sharp(Buffer.from(res.data)).resize({ height }).jpeg().toBuffer({ resolveWithObject: true }),
    sharp(rendered).resize({ height }).jpeg().toBuffer({ resolveWithObject: true }),
  ]);
  const gap = 32;
  const sheet = await sharp({ create: { width: left.info.width + gap + right.info.width, height, channels: 3, background: '#808080' } })
    .composite([
      { input: left.data, left: 0, top: 0 },
      { input: right.data, left: left.info.width + gap, top: 0 },
    ])
    .jpeg({ quality: 82 })
    .toBuffer();
  const instruction = [
    "LEFT: the client's model. RIGHT: our reproduction for another brand — its colours, words and photo differ ON PURPOSE.",
    'Judge ONLY the composition: same zones at the same places and proportions, same hierarchy, same alignment, same headline scale and case, same colour blocks and shapes, same photo placement and crop, no missing or extra elements.',
    'Answer ONLY JSON: {"score": 0-10 (10 = same composition), "differences": ["one concrete fix for RIGHT, e.g. move the headline to the top-left and make it twice as large", … at most 5, empty if none]}',
  ].join('\n');
  const raw = await analyze(sheet.toString('base64'), 'image/jpeg', instruction, { maxOutputTokens: 600, temperature: 0.1, purpose: 'reference' });
  const match = String(raw || '').replace(/```[a-z]*\n?/gi, '').match(/\{[\s\S]*\}/);
  if (!match) return null;
  const json = JSON.parse(match[0]) as { score?: unknown; differences?: unknown };
  const score = Math.max(0, Math.min(10, Number(json.score)));
  if (!Number.isFinite(score)) return null;
  const differences = (Array.isArray(json.differences) ? json.differences : [])
    .filter((d): d is string => typeof d === 'string' && d.trim().length > 3)
    .map((d) => d.trim().slice(0, 240))
    .slice(0, 5);
  return { score, differences };
}

/**
 * La PAGE d'un visuel : ses mots et sa photo, composés par le moteur graphique sur la charte de la marque.
 * Sert la composition et la retouche (mêmes mots retouchés, même photo, même graine).
 */
export async function renderVisual(
  context: VisualBrandContext,
  format: FlyerFormat,
  copy: WrittenCopy,
  photo: VisualPhotoRef | undefined,
  o: { level: CreativityLevel; seed: string; userId?: string; projectId?: string; allowDark?: boolean; imageColors?: string[]; keywords?: string[]; reference?: ReferenceComposition; replay?: SectionSpec; revise?: { spec: SectionSpec; instruction: string }; concept?: string; axisId?: string; memoryScopes?: Array<{ documentType: string; key: string }>; country?: string }
): Promise<SectionOutput> {
  const { brand, direction } = engineBrand(context);
  const content = visualContent({
    id: 'visual',
    copy: engineCopy(copy),
    image: photo ? { url: photo.url, alt: photo.subject || copy.headline, ...(photo.focal ? { focal: photo.focal } : {}) } : null,
  });
  if (!content) throw new Error('visual_content_empty');
  return renderSingle({
    documentType: 'flyer',
    format: VISUAL_FORMAT[format] ?? VISUAL_FORMAT.square,
    brand,
    direction: o.keywords?.length ? { ...direction, keywords: [...o.keywords, ...(direction.keywords ?? [])].slice(0, 10) } : direction,
    creativity: o.level,
    seed: o.seed,
    content,
    png: true,
    allowDark: o.allowDark,
    imageColors: o.imageColors?.length ? o.imageColors : undefined,
    locale: (context.language || 'fr').slice(0, 5),
    user: { userId: o.userId, projectId: o.projectId },
    memoryScope: o.projectId ? { documentType: 'flyer', key: o.projectId } : undefined,
    ...(o.memoryScopes?.length ? { memoryScopes: o.memoryScopes } : {}),
    ...(o.country ? { country: o.country } : {}),
    ...(o.concept ? { concept: o.concept } : {}),
    ...(o.axisId ? { axisId: o.axisId } : {}),
    ...(o.reference ? { reference: o.reference } : {}),
    ...(o.replay ? { replay: o.replay } : {}),
    ...(o.revise ? { revise: o.revise } : {}),
  });
}

/** Une photo pour un visuel déjà composé (retouche « change la photo ») : mêmes sources et mêmes contrôles. */
export async function findPhoto(req: { userId: string; projectId: string; tag: string; context: VisualBrandContext; format: FlyerFormat; copy: WrittenCopy; subject: string; userPhoto?: string; preferGenerated?: boolean }): Promise<{ photo?: VisualPhotoRef; sourced: SourcedImage | null }> {
  const { photo, sourced } = await choosePhoto(req);
  return { photo, sourced };
}

/**
 * Le PNG d'un visuel ENREGISTRÉ (après une retouche dans l'éditeur partagé). Une page du moteur porte
 * ses styles et ses polices : elle est photographiée telle quelle, à ses cotes. Les visuels plus
 * anciens restent lisibles : un document complet est photographié tel quel, un fragment écrit en
 * classes Tailwind l'est avec Tailwind et les polices de la marque.
 */
export async function renderVisualHtml(html: string, format: FlyerFormat, fonts: { primaryFont?: string; secondaryFont?: string; url?: string } = {}): Promise<Buffer> {
  const size = VISUAL_SIZE[format] ?? VISUAL_SIZE.square;
  if (/class="ge-page[\s"]/.test(html)) return screenshot(pageDocument(html), size);
  if (/^\s*(<!doctype|<html[\s>])/i.test(html)) return screenshot(html, size);
  const families = [fonts.primaryFont, fonts.secondaryFont].filter((f): f is string => Boolean(f && f.trim()));
  const links = [
    ...(fonts.url && /^https?:\/\//.test(fonts.url) ? [`<link rel="stylesheet" href="${escapeHtml(fonts.url)}">`] : []),
    ...families.map((f) => `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@400;600;700;800&display=swap">`),
  ].join('');
  const body = fonts.secondaryFont || fonts.primaryFont || 'Inter';
  const legacy = `<!doctype html><html><head><meta charset="utf-8">${links}<script src="https://cdn.tailwindcss.com"></script><style>html,body{margin:0;padding:0}body{font-family:'${body.replace(/'/g, '')}',system-ui,sans-serif;width:${size.width}px;height:${size.height}px;overflow:hidden}</style></head><body>${html}</body></html>`;
  return screenshot(legacy, size);
}

// ─── La marque, les mots, la photo ─────────────────────────────────────────────

/** La marque d'un visuel telle que le moteur la lit : couleurs, polices, déclinaisons du logo, direction. */
function engineBrand(context: VisualBrandContext): { brand: BrandInput; direction: DirectionInput } {
  const b = context.branding;
  const svgLogo = b.logoSvg && b.logoSvg.includes('<svg') ? `data:image/svg+xml;base64,${Buffer.from(b.logoSvg).toString('base64')}` : undefined;
  const css = b.fontUrl && /^https?:\/\//.test(b.fontUrl) ? b.fontUrl : undefined;
  return brandFromIdem({
    name: context.brandName,
    branding: {
      colors: { colors: { primary: b.primary, secondary: b.secondary, accent: b.accent, background: b.background, text: b.text } },
      typography: {
        primaryFont: b.primaryFont,
        secondaryFont: b.secondaryFont,
        ...(css ? { primary: { cssUrl: css }, secondary: { cssUrl: css } } : {}),
      },
      artDirection: context.artDirection ?? null,
      ...(b.patterns?.length ? { patterns: { items: b.patterns } } : {}),
    },
    logos: {
      primary: b.logoUrls?.primary || svgLogo,
      withTextLight: b.logoUrls?.withText?.light,
      withTextDark: b.logoUrls?.withText?.dark,
      withTextMono: b.logoUrls?.withText?.mono,
      iconLight: b.logoUrls?.iconOnly?.light,
      iconDark: b.logoUrls?.iconOnly?.dark,
      iconMono: b.logoUrls?.iconOnly?.mono,
    },
  });
}

/** Les cases du rédacteur, dans le contrat du moteur (un fait se montre par son texte). */
function engineCopy(copy: WrittenCopy): VisualCopy {
  return {
    headline: copy.headline,
    ...(copy.sub ? { subhead: copy.sub } : {}),
    ...(copy.offer ? { offer: copy.offer } : {}),
    ...(copy.facts.length ? { facts: copy.facts.slice(0, 5).map((f) => ({ text: f.text })) } : {}),
    ...(copy.quote ? { quote: copy.quote } : {}),
  };
}

/**
 * Le brief d'image (banque ou génération), sans texte dans l'image. Le THÈME donné au modèle d'image est
 * une poignée de MOTS-CLÉS, jamais la phrase même du titre : un modèle d'image qui sait écrire lit une
 * phrase complète comme un texte À RENDRE.
 */
function imageBriefFor(copy: WrittenCopy, context: VisualBrandContext, format: FlyerFormat, subject: string) {
  const orientation = format === 'story' || format === 'post' || format === 'a4' ? ('portrait' as const) : format === 'banner' ? ('landscape' as const) : ('square' as const);
  // La scène décrite par le rédacteur (concrète, en anglais) ; à défaut, les mots du message.
  const theme = copy.photo?.idea || subject.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w.length > 3).slice(0, 8).join(' ') || context.businessType;
  return {
    searchQuery: copy.photo?.query || `${copy.headline} ${context.businessType}`.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w.length > 3).slice(0, 5).join(' ') || context.businessType,
    generationPrompt: `Authentic editorial photograph for ${context.brandName} (${context.businessType}). Scene: ${theme}. Natural light, real people and places, African context when people appear, shallow depth of field, generous calm empty area on one side reserved for a graphic overlay added separately afterwards. ${context.artDirection?.imagePromptModifier || ''}`.slice(0, 900),
    negativePrompt: 'distorted faces, extra fingers, oversaturated HDR, collage, frame, border',
    orientation,
  };
}

/**
 * La photo : celle de l'utilisateur, celles de la marque (classées par la vision, seules les vraies
 * photos), sinon banque puis génération — chacune VÉRIFIÉE contre le message.
 */
async function choosePhoto(req: {
  userId: string;
  projectId: string;
  tag: string;
  context: VisualBrandContext;
  format: FlyerFormat;
  copy: WrittenCopy;
  subject: string;
  sourcing?: ImageSourcingPreferences;
  userPhoto?: string;
  brandPhotos?: string[];
  /** La génération passe avant la banque (crans High et au-delà). */
  preferGenerated?: boolean;
  /** La scène voulue, en anglais (l'idée retenue, sinon celle du rédacteur) : une des recherches de la banque. */
  scene?: string;
}): Promise<{ photo?: VisualPhotoRef; sourced: SourcedImage | null; unavailable?: 'payment' | 'rejected' }> {
  const ctx = req.context;
  let image: VisualPhoto | undefined;
  let sourced: SourcedImage | null = null;
  if (req.userPhoto) image = (await describePhoto(req.userPhoto, 'user')) || undefined;
  if (!image && req.brandPhotos?.length) {
    const kinds = await Promise.all(req.brandPhotos.slice(0, 12).map((u) => classifyImage(u)));
    const photos = kinds.filter((k) => k.kind === 'photo').map((k) => k.url);
    if (photos.length) {
      const ranked = await rankByRelevance(photos, req.subject, { name: ctx.brandName, business: ctx.businessType });
      const best = ranked.find((r) => r.score >= 6);
      if (best) {
        const described = await describePhoto(best.url, 'brand');
        if (described) image = { ...described, subject: kinds.find((k) => k.url === best.url)?.subject };
      }
      logger.info('visual.brand_photos', { event: 'visual.brand_photos', candidates: photos.length, best: ranked[0]?.score });
    }
  }
  let unavailable: 'payment' | 'rejected' | undefined;
  if (!image) {
    // Banque ou génération, VÉRIFIÉE : une photo hors sujet est pire que pas de photo. Aux crans High et au-delà
    // (et pour une illustration), l'image faite POUR la scène passe d'abord ; sinon la banque d'abord.
    // PEXELS EST LE REPLI de la génération : si le modèle d'image échoue (crédits, délai, refus, image écrite), la
    // banque prend le relais — plusieurs recherches, plusieurs photos chacune, la plus pertinente retenue.
    const brief = imageBriefFor(req.copy, ctx, req.format, req.subject);
    const generate = async (): Promise<boolean> => {
      try {
        const found = await imageSourcingService.generatedImage({ ...brief, preferGenerated: true }, { userId: req.userId, projectId: req.projectId, tag: req.tag, ...req.sourcing });
        const [check] = await rankByRelevance([found.url], req.subject, { name: ctx.brandName, business: ctx.businessType });
        // Une image générée d'après la scène est admise un cran plus bas (4/10) : elle a été faite pour elle.
        if (check.score >= 4) {
          image = (await describePhoto(found.url, 'generated')) || undefined;
          if (image) image.subject = found.analysis?.subject || undefined;
          sourced = found;
          return !!image;
        }
        unavailable = 'rejected';
        logger.info('visual.image_rejected', { event: 'visual.image_rejected', source: 'generated', score: check.score, reason: check.reason });
      } catch (error: any) {
        const payment = /\b402\b|insufficient credits/i.test(String(error?.message || ''));
        if (payment) unavailable = 'payment';
        logger.warn(payment ? 'visual.generation_blocked' : 'visual.generation_failed', { event: payment ? 'visual.generation_blocked' : 'visual.generation_failed', ...(payment ? { reason: 'payment' } : {}), error: String(error?.message || error).slice(0, 300) });
      }
      return false;
    };
    const stock = async (): Promise<boolean> => {
      const picked = await stockPhoto({ queries: stockQueries(req.copy, ctx, req.scene), orientation: brief.orientation, subject: req.subject, brand: { name: ctx.brandName, business: ctx.businessType } }).catch((error) => {
        logger.warn('visual.stock_failed', { event: 'visual.stock_failed', error: String((error as Error)?.message || error).slice(0, 300) });
        return null;
      });
      if (!picked) return false;
      image = (await describePhoto(picked.url, 'stock')) || undefined;
      if (!image) return false;
      sourced = { url: picked.url, source: 'stock', attribution: picked.attribution, analysis: { subject: picked.query, mood: '', dominantColors: [], luminance: 'mixed' } };
      return true;
    };
    const order = req.preferGenerated ? [generate, stock] : [stock, generate];
    for (const step of order) if (await step()) break;
    if (!image && !unavailable) unavailable = 'rejected';
  }
  if (image && !sourced) {
    sourced = { url: image.url, source: 'upload', attribution: { provider: 'other', author: ctx.brandName }, analysis: { subject: image.subject || '', mood: '', dominantColors: [], luminance: 'mixed' } };
  }
  return { photo: image ? { url: image.url, focal: image.focal, ...(image.subject ? { subject: image.subject } : {}) } : undefined, sourced, ...(image ? {} : unavailable ? { unavailable } : {}) };
}

/** Les portées de mémoire d'un visuel : l'utilisateur et le secteur (avec le pays), en plus du projet. */
function memoryScopesOf(context: VisualBrandContext, userId: string, projectId: string): { memoryScopes: Array<{ documentType: string; key: string }>; country?: string } {
  const sector = (context.businessType || '').trim().toLowerCase().slice(0, 60);
  return {
    memoryScopes: [...(userId ? [{ documentType: 'flyer', key: `user:${userId}` }] : []), ...(sector ? [{ documentType: 'flyer', key: `sector:${sector}:${(context.country || '').toLowerCase()}` }] : [])].filter((s) => s.key !== `user:${projectId}`),
    ...(context.country ? { country: context.country } : {}),
  };
}

/** Les idées et les axes déjà servis (projet, utilisateur, secteur), les plus récents d'abord. */
async function recentIdeas(scopes: { memoryScopes: Array<{ documentType: string; key: string }> }): Promise<{ ideas: string[]; axes: string[] }> {
  const host = engineHost();
  if (!host.recentFingerprints || !memoryEnabled()) return { ideas: [], axes: [] };
  const lists = await Promise.all(scopes.memoryScopes.map((s) => host.recentFingerprints!(s).catch(() => [] as string[])));
  const all = lists.flatMap((l) => [...l].reverse());
  return { ideas: [...new Set(all.filter((r) => r.startsWith('idea:')).map((r) => r.slice(5)))].slice(0, 10), axes: [...new Set(all.filter((r) => r.startsWith('axis:')).map((r) => r.slice(5)))].reverse() };
}

/** Les recherches de la banque, de la plus précise à la plus large : les mots du rédacteur, la scène, le métier. */
export function stockQueries(copy: WrittenCopy, context: VisualBrandContext, scene?: string): string[] {
  const words = (text: string | undefined, n: number) => (text ?? '').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w.toLowerCase())).slice(0, n).join(' ');
  const list = [copy.photo?.query, words(scene, 4), words(copy.photo?.idea, 4), words(context.businessType, 3)].map((q) => (q ?? '').trim()).filter(Boolean);
  return [...new Set(list.map((q) => q.toLowerCase()))].slice(0, 3);
}
const STOP = new Set(['the', 'and', 'with', 'for', 'from', 'into', 'onto', 'over', 'near', 'while', 'their', 'his', 'her', 'its', 'des', 'les', 'une', 'pour', 'avec', 'dans', 'sur']);

/**
 * La photo de la banque (Pexels) la plus pertinente : jusqu'à 4 photos par recherche, classées par la vision ; la
 * première recherche qui donne une photo à 5/10 ou plus l'emporte, sinon la meilleure de toutes si elle atteint 4/10.
 */
export async function stockPhoto(o: { queries: string[]; orientation?: 'portrait' | 'landscape' | 'square'; subject: string; brand: { name: string; business?: string } }): Promise<{ url: string; attribution: SourcedImage['attribution']; query: string } | null> {
  let best: { url: string; attribution: SourcedImage['attribution']; query: string; score: number } | null = null;
  for (const query of o.queries) {
    const photos = await imageSourcingService.pexelsPhotos(query, o.orientation, 4);
    if (!photos.length) continue;
    const ranked = await rankByRelevance(photos.map((p) => p.mediumUrl), o.subject, o.brand);
    const top = ranked[0];
    const photo = photos.find((p) => p.mediumUrl === top?.url);
    logger.info('visual.stock_ranked', { event: 'visual.stock_ranked', query, candidates: photos.length, best: top?.score, reason: top?.reason });
    if (photo && top && (!best || top.score > best.score)) best = { url: photo.url, attribution: photo.attribution, query, score: top.score };
    if (best && best.score >= 5) break;
  }
  return best && best.score >= 4 ? best : null;
}

async function imageBytes(url: string): Promise<Buffer> {
  const data = url.match(/^data:[^;,]+;base64,(.+)$/);
  if (data) return Buffer.from(data[1], 'base64');
  return (await safeFetch(url, { maxBytes: 25 * 1024 * 1024, timeoutMs: 45_000, accept: ['image/'] })).buffer;
}

/** Dépose une image façonnée (stockage de l'hôte, sinon en ligne) et rend son adresse. */
async function storeImage(content: Buffer, name: string, contentType: string, tag: string): Promise<string> {
  const storage = coreHost().storage;
  if (storage) return (await storage.uploadFile(content, name, `visuals/shaped/${tag.replace(/[^\w-]+/g, '-').slice(0, 80)}`, contentType)).downloadURL;
  return `data:${contentType};base64,${content.toString('base64')}`;
}

/**
 * L'image façonnée par l'idée (plan qualité créative) : illustration vectorielle dans la palette de la marque,
 * sujet détouré (sur fond transparent), ou photo traitée (duotone, teinte, monochrome). Ce que l'auteur doit en savoir
 * est rendu dans `note` (anglais) ; une étape impossible garde l'image d'origine.
 */
async function shapeImage(photo: VisualPhotoRef, concept: VisualConcept, context: VisualBrandContext, tag: string): Promise<{ photo: VisualPhotoRef; note?: string } | null> {
  const b = context.branding;
  const palette = [b.primary, b.secondary, b.accent, b.background || '#ffffff', b.text || '#111111'].filter((c): c is string => !!c && /^#[0-9a-f]{3,8}$/i.test(c));
  const stamp = Date.now().toString(36);
  if (concept.image === 'illustration') {
    const vec = await vectorizeImage({ image: await imageBytes(photo.url), palette, detail: 0.35 });
    const url = await storeImage(Buffer.from(vec.svg), `illustration-${stamp}.svg`, 'image/svg+xml', tag);
    return { photo: { ...photo, url }, note: 'The image is a flat vector illustration in the brand colours: show it whole and large, never cropped tight.' };
  }
  if (concept.image === 'cutout') {
    const cut = await cutout(await imageBytes(photo.url));
    if (!cut || cut.coverage < 0.04 || cut.coverage > 0.92) return null;
    const url = await storeImage(cut.png, `cutout-${stamp}.png`, 'image/png', tag);
    return { photo: { ...photo, url, focal: { x: cut.box.x + cut.box.w / 2, y: cut.box.y + cut.box.h / 2 } }, note: 'The image is a subject CUT OUT of its background (transparent PNG): set it on a brand colour field, large, with object-contain — never in a frame or a card.' };
  }
  if (concept.treatment !== 'natural') {
    const treated = await treatPhoto(await imageBytes(photo.url), concept.treatment, { dark: b.secondary || b.primary, light: b.accent || b.background || '#f5f1e8', tint: b.primary });
    const url = await storeImage(treated, `photo-${concept.treatment}-${stamp}.jpg`, 'image/jpeg', tag);
    return { photo: { ...photo, url }, note: `The photo has a ${concept.treatment} treatment in the brand colours.` };
  }
  return null;
}

/** Le rapport d'un visuel : les constats techniques (aucune note esthétique) et les corrections d'affichage. */
function auditOf(out: SectionOutput): VisualAuditReport {
  const r = out.result;
  return {
    findings: r.issues.map((issue) => ({ rule: issue.code, severity: issue.severity === 'blocking' ? 'error' : 'warning', message: issue.message, count: 1, repaired: false })),
    repaired: r.repairs.map((repair) => repair.code),
    score: 100,
    blocking: r.issues.some((issue) => issue.severity === 'blocking'),
  };
}

// ─── Utilitaires partagés ──────────────────────────────────────────────────────

/**
 * L'intention de communication d'un contenu (le TON du visuel : atmosphère, fait, fête…). Elle n'arbitre
 * plus d'appel à l'action : aucun visuel n'en porte. Heuristique multilingue, `awareness` par défaut.
 */
export function inferVisualIntent(content: { intent?: VisualIntent; title?: string; hook?: string; description?: string; callToAction?: string }): VisualIntent {
  if (content.intent) return content.intent;
  const haystack = [content.title, content.hook, content.description, content.callToAction].filter(Boolean).join(' ').toLowerCase();
  const has = (words: string[]) => words.some((w) => haystack.includes(w));
  if (has(['recrut', 'hiring', "we're hiring", 'join our', 'join the team', 'postul', 'emploi', 'nous recrutons', 'career', 'carrière', "offre d'emploi"])) return 'recruitment';
  if (has(['promo', 'sale', 'discount', 'offre', 'réduction', 'deal', 'shop now', 'buy', 'order now', 'commande', 'soldes', '% off', '-50', 'code promo'])) return 'promotion';
  if (has(['launch', 'lance', 'nouveau', 'new ', 'introducing', 'annonce', 'announce', 'disponible', 'now available', 'sortie'])) return 'announcement';
  if (has(['fête', 'célèbr', 'celebrat', 'anniversa', 'happy ', 'joyeux', 'congrat', 'félicit', 'merci', 'thank you', 'holiday'])) return 'celebration';
  return 'awareness';
}

export function escapeHtml(raw: string): string {
  return raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

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
  BrandInput,
  DirectionInput,
  FORMATS,
  FormatId,
  pageDocument,
  renderSingle,
  screenshot,
  sectionHtml,
  SectionOutput,
  visualContent,
  VisualCopy,
} from '@idem/graphic-engine';
import logger from '../runtime/logger';
import { CreativityLevel } from '../creativity/levels';
import { AgentCall, CreativeOrchestrator } from '../creativity/orchestrator';
import type { ReferenceImage } from '../reference/reference.analyzer';
import { imageSourcingService, ImageSourcingPreferences, SourcedImage } from './image.sourcing';
import { copyTask, CopyBrief, inferCopyIntent, WrittenCopy } from './visual.copy';
import { classifyImage, describePhoto, rankByRelevance, VisualPhoto } from './visual.images';
import { FlyerFormat, VisualAuditReport, VisualBrandContext, VisualContent, VisualIntent, VisualMeta } from './visual.model';

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
  };
  sourced: SourcedImage | null;
  intent: VisualIntent;
  /** Visuel photographié après mesure et réparation. */
  png: Buffer;
  audit: VisualAuditReport;
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
    /** Une image modèle (iVision) : sa présence ou non de photo, et sa structure, lue par les agents. */
    reference?: Pick<ReferenceImage, 'layout' | 'structure' | 'hasPhoto' | 'description'>;
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
  } = {}
): Promise<ComposedVisual> {
  const started = Date.now();
  const level = creative.creativity || 'medium';
  const stage = (name: string, state: 'running' | 'done') => {
    try {
      creative.onStage?.(name, state);
    } catch {
      /* l'interface ne bloque jamais la composition */
    }
  };
  const orch = new CreativeOrchestrator({ level, call: ports.agentCall, timeoutMs: { agents: 45_000, critic: 60_000 } });
  const message = [content.title, content.hook].filter(Boolean).join(' — ');
  const brief: CopyBrief = {
    message,
    details: content.description,
    brandName: context.brandName,
    businessType: context.businessType,
    valueProposition: context.valueProposition,
    tone: context.tone,
    language: context.language || 'fr',
  };
  const copyIntent = inferCopyIntent(`${message} ${content.description || ''}`);

  // 1. Les mots.
  stage('copy', 'running');
  let copyRun = await orch.run(copyTask(brief, copyIntent, creative.feedback));
  // Les mots font le visuel : un modèle muet (délai, panne) a droit à un second essai.
  if (copyRun.source === 'graph' && orch.traces[orch.traces.length - 1]?.reason === 'failed') {
    copyRun = await orch.run({ ...copyTask(brief, copyIntent, creative.feedback), key: 'posterCopywriter:retry' });
  }
  const copy = copyRun.value;
  stage('copy', 'done');

  // 2. La photo.
  stage('photo', 'running');
  const subject = `${copy.headline}. ${message}`.slice(0, 260);
  const { photo, sourced } =
    skipImage && !creative.image?.url
      ? { photo: undefined, sourced: null }
      : await choosePhoto({ userId, projectId, tag, context, format, copy, subject, sourcing, userPhoto: creative.image?.url, brandPhotos: creative.brandPhotos });
  stage('photo', 'done');

  // 3. La page, composée par le moteur graphique. Un retour (« autre chose ») change la graine : le
  // moteur explore alors une autre composition, sa mémoire écartant celles déjà montrées à la marque.
  stage('design', 'running');
  const seed = creative.feedback || creative.avoid?.length ? `${seedKey}:retake:${Date.now().toString(36)}` : seedKey;
  const keywords = creative.reference?.description ? [creative.reference.description.slice(0, 48)] : undefined;
  const out = await renderVisual(context, format, copy, photo, {
    level,
    seed,
    userId,
    projectId,
    allowDark: creative.allowDark,
    imageColors: sourced?.analysis?.dominantColors,
    keywords,
  });
  stage('design', 'done');

  const audit = auditOf(out);
  logger.info('visual.composed', {
    event: 'visual.composed',
    brandId: projectId,
    creativity: level,
    format,
    pattern: out.spec.pattern.id,
    image: photo ? sourced?.source ?? 'brand' : 'none',
    score: audit.score,
    blocking: audit.blocking,
    agentCalls: out.result.usage.agentCalls + orch.traces.filter((t) => t.source === 'llm').length,
    ms: Date.now() - started,
  });
  if (!out.png) throw new Error('visual_render_failed');
  return {
    html: sectionHtml(out),
    parsed: {
      layout: out.spec.pattern.id,
      copy,
      ...(photo ? { photo } : {}),
      seed,
      concept: out.spec.pattern.id,
      marketingText: { headline: copy.headline, subheadline: copy.sub, body: copy.facts.map((f) => f.text).join(' · ') },
      creativity: level,
      agents: orch.traces,
    },
    sourced,
    intent: inferVisualIntent(content),
    png: out.png,
    audit,
  };
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
  o: { level: CreativityLevel; seed: string; userId?: string; projectId?: string; allowDark?: boolean; imageColors?: string[]; keywords?: string[] }
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
  });
}

/**
 * Le PNG d'un visuel ENREGISTRÉ (après une retouche dans l'éditeur partagé). Une page du moteur porte
 * ses styles et ses polices : elle est photographiée telle quelle, à ses cotes. Les visuels plus
 * anciens restent lisibles : un document complet est photographié tel quel, un fragment écrit en
 * classes Tailwind l'est avec Tailwind et les polices de la marque.
 */
export async function renderVisualHtml(html: string, format: FlyerFormat, fonts: { primaryFont?: string; secondaryFont?: string; url?: string } = {}): Promise<Buffer> {
  const size = VISUAL_SIZE[format] ?? VISUAL_SIZE.square;
  if (/class="ge-page"/.test(html)) return screenshot(pageDocument(html), size);
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
    ...(copy.kicker ? { kicker: copy.kicker } : {}),
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
  const theme = subject.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w.length > 3).slice(0, 8).join(' ') || context.businessType;
  return {
    searchQuery: `${copy.headline} ${context.businessType}`.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w.length > 3).slice(0, 5).join(' ') || context.businessType,
    generationPrompt: `Authentic editorial photograph for ${context.brandName} (${context.businessType}). Theme: ${theme}. Natural light, real people and places, African context when people appear, shallow depth of field, generous calm empty area on one side reserved for a graphic overlay added separately afterwards. ${context.artDirection?.imagePromptModifier || ''}`.slice(0, 900),
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
}): Promise<{ photo?: VisualPhotoRef; sourced: SourcedImage | null }> {
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
  if (!image) {
    // Banque ou génération, VÉRIFIÉE : une photo hors sujet est pire que pas de photo.
    for (const preferGenerated of [false, true]) {
      try {
        const found = await imageSourcingService.sourceImage(
          { ...imageBriefFor(req.copy, ctx, req.format, req.subject), preferGenerated },
          { userId: req.userId, projectId: req.projectId, tag: req.tag, ...req.sourcing, ...(preferGenerated ? { preferStock: false } : {}) }
        );
        const [check] = await rankByRelevance([found.url], req.subject, { name: ctx.brandName, business: ctx.businessType });
        if (check.score >= 5) {
          image = (await describePhoto(found.url, found.source === 'generated' ? 'generated' : 'stock')) || undefined;
          if (image) image.subject = found.analysis?.subject || undefined;
          sourced = found;
          break;
        }
        logger.info('visual.image_rejected', { event: 'visual.image_rejected', source: found.source, score: check.score, reason: check.reason });
      } catch (error) {
        logger.warn('visual.sourcing_failed', { event: 'visual.sourcing_failed', error });
      }
    }
  }
  if (image && !sourced) {
    sourced = { url: image.url, source: 'upload', attribution: { provider: 'other', author: ctx.brandName }, analysis: { subject: image.subject || '', mood: '', dominantColors: [], luminance: 'mixed' } };
  }
  return { photo: image ? { url: image.url, focal: image.focal, ...(image.subject ? { subject: image.subject } : {}) } : undefined, sourced };
}

/** Le rapport d'un visuel : ce que la mesure a constaté et ce que le code a réparé. */
function auditOf(out: SectionOutput): VisualAuditReport {
  const r = out.result;
  return {
    findings: r.issues.map((issue) => ({ rule: issue.code, severity: issue.severity === 'blocking' ? 'error' : 'warning', message: issue.message, count: 1, repaired: false })),
    repaired: r.repairs.map((repair) => repair.code),
    score: Math.max(0, Math.min(100, Math.round(out.trace.quality ?? 100))),
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

/** Toutes les adresses connues du logo de la marque, dédoublonnées. */
export function knownLogoUrls(context: VisualBrandContext): string[] {
  const logos = context.branding.logoUrls;
  if (!logos) return [];
  const raw = [logos.primary, logos.withText?.light, logos.withText?.dark, logos.withText?.mono, logos.iconOnly?.light, logos.iconOnly?.dark, logos.iconOnly?.mono].filter(
    (u): u is string => typeof u === 'string' && u.trim().length > 0
  );
  return [...new Set(raw)];
}

export function escapeHtml(raw: string): string {
  return raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

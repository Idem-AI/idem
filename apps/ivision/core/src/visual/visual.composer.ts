/**
 * LA COMPOSITION D'UN VISUEL — flyer, publication, bannière, page A4.
 *
 * Le même compositeur pour IDEM (module Communication, charte graphique) et pour iVision :
 *
 *   1. graine de design (bornée par la direction artistique) et grille de composition ;
 *   2. brief d'image (par l'IA dès High, sinon depuis le contenu), image de banque ou générée ;
 *   3. composition : de Low à High, le CODE compose (12 compositions, `flyer.layouts.ts`) et les
 *      agents choisissent mots, structure et composition ; au cran Max, l'IA écrit le HTML dans la
 *      grille ; en Ultra, un agent concept décide de l'idée, deux compositions sont écrites et la
 *      meilleure au contrôle mesuré est gardée ;
 *   4. passes déterministes (logo réel, typographie de la charte, aucun bouton, règles de design)
 *      et rendu MESURÉ (zone de sécurité, texte rogné, contraste sur les pixels, fond perdu).
 *
 * L'hôte fournit les modèles (`VisualPorts`) : dans IDEM, le service de prompts et le runtime
 * d'agents ; dans iVision, la passerelle interne de l'API IDEM.
 */
import crypto from 'crypto';
import logger from '../runtime/logger';
import { atLeast, CreativityLevel } from '../creativity/levels';
import { AgentCall, CreativeOrchestrator } from '../creativity/orchestrator';
import { brandSheet } from '../creativity/agent-io';
import { FLYER_LAYOUTS, FlyerLayoutId, flyerLayoutMenu, FlyerStructure, pickFlyerLayout, renderFlyerLayout } from './flyer.layouts';
import type { ReferenceImage } from '../reference/reference.analyzer';
import { artDirectorTask, conceptTask, copywriterTask, heuristicFlyerCopy, structureTask } from './flyer.agents';
import { imageSourcingService, ImageBrief, ImageSourcingPreferences, SourcedImage } from './image.sourcing';
import { flyerRenderService, minLogoWidthFor, LogoDeclensionSet, FORMAT_DIMENSIONS } from './flyer.render';
import { brandFontsHref } from '../design/google-fonts';
import { buildArtDirectionBlock, buildImageNegativePrompt, buildImageStyleModifier } from '../brand/art-direction.util';
import { ANTI_SLOP_BLOCK } from '../design/antiSlop.prompt';
import { DesignSeed, buildDesignSeed, describeSeed } from '../design/designSeed';
import { buildCompositionGrid, CompositionGrid, describeCompositionGrid, describeImageNeed } from '../design/compositionGrid';
import { VisualAuditReport } from '../design/visualAudit';
import { enforceDesignRules } from '../design/slopLint';
import { sanitizeSectionHtml } from '../render/sanitize-html';
import { AGENT_FLYER_GENERATION_PROMPT } from './prompts/flyer-generation.prompt';
import { AGENT_IMAGE_BRIEF_PROMPT } from './prompts/image-brief.prompt';
import { FlyerFormat, VisualBrandContext, VisualContent, VisualIntent, VisualMeta } from './visual.model';

export interface PromptMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Les modèles de l'hôte. */
export interface VisualPorts {
  /** Composition HTML (`flyer`) et brief d'image (`imageBrief`), au modèle que l'hôte associe à chacun. */
  runPrompt: (feature: 'flyer' | 'imageBrief', messages: PromptMessage[]) => Promise<string>;
  /** Les agents de la composition (rédaction, structure, composition, concept). */
  agentCall?: AgentCall;
}

export interface ComposedVisual {
  html: string;
  parsed: Partial<VisualMeta>;
  sourced: SourcedImage | null;
  intent: VisualIntent;
  /** Visuel photographié après contrôle de composition. */
  png: Buffer;
  audit: VisualAuditReport;
}

/**
 * Compose un visuel : brief d'image, image (banque ou génération), puis
 * composition HTML à la charte et passes déterministes.
 *
 * Extrait de `generateFlyer` pour servir aussi la charte graphique, qui montre
 * des publications composées par CE pipeline — les visuels qu'on promet dans
 * la charte doivent être ceux que le module communication produira ensuite.
 * Aucune écriture ici : l'appelant décide de ce qu'il persiste.
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
  /**
   * Composition 100 % typographique, sans photo.
   *
   * Ce n'est pas une dégradation : un prix, une date ou une phrase forte se
   * portent mieux sans image — et le prompt de composition sait déjà traiter ce
   * cas (`IMAGE_URL` reçoit alors une consigne explicite). L'atelier l'expose à
   * l'utilisateur (« sans photo »), et cela économise au passage l'appel de
   * brief d'image ET l'appel de sourcing.
   */
  skipImage?: boolean,
  /**
   * La jauge de créativité. Low → High : le CODE compose (flyerLayouts.ts), l'IA écrit les
   * mots puis choisit structure et composition selon le cran. Max : l'IA écrit le HTML dans la
   * grille (pipeline historique, défaut des appelants internes). Ultra : un agent concept
   * décide de l'idée, deux compositions sont écrites, rendues, et la meilleure est gardée.
   */
  creative: {
    creativity?: CreativityLevel;
    recentLayouts?: string[];
    /**
     * Une image modèle (iVision) : sa structure et sa composition sont reprises — mise en page
     * du code la plus proche (Low → High), description donnée au compositeur (Max, Ultra).
     * Ses textes et ses photos ne le sont jamais : ce sont ceux de la marque.
     */
    reference?: Pick<ReferenceImage, 'layout' | 'structure' | 'hasPhoto' | 'description'>;
    /** La photo de l'utilisateur (iVision) : posée à la place d'une photo de banque ou générée. */
    image?: { url: string };
  } = {}
): Promise<{
  html: string;
  parsed: Partial<VisualMeta>;
  sourced: SourcedImage | null;
  intent: VisualIntent;
  /** Visuel photographié après contrôle de composition. */
  png: Buffer;
  audit: VisualAuditReport;
}> {
  const creativity: CreativityLevel = creative.creativity || 'max';
  // ---- Step 5a: grille de composition -------------------------------------
  // La graine est tirée AVANT le brief d'image : c'est elle qui décide de
  // l'axe de la césure 62/38, donc de la zone que la photo doit laisser libre.
  // Tant qu'elle était tirée après, on demandait une image « avec de l'espace
  // pour le texte » sans savoir de quel côté, et le brief ne servait à rien.
  const seed = generateDesignSeed(context, seedKey);
  const dims = FORMAT_DIMENSIONS[format] || FORMAT_DIMENSIONS.square;
  const grid = buildCompositionGrid(
    { width: dims.width, height: dims.height, print: format === 'a4' },
    seed,
    {
      primary: context.branding.primary,
      secondary: context.branding.secondary,
      accent: context.branding.accent,
      background: context.branding.background,
      text: context.branding.text,
    }
  );

  // ---- Step 5b/5c: image brief puis sourcing — sautés si « sans photo » ---
  let sourced: SourcedImage | null = null;
  if (!skipImage && creative.image?.url) {
    // Sa photo, lue par la vision (sujet, couleurs, zone libre) : la composition s'y accorde.
    const brief = heuristicImageBrief(content, context, format);
    sourced = { url: creative.image.url, source: 'upload', attribution: { provider: 'other', author: context.brandName }, analysis: await imageSourcingService.analyzeImage(creative.image.url, brief) };
  } else if (!skipImage) {
    // Le choix de l'image est confié à l'IA dès High ; en dessous, le brief vient du contenu.
    const brief = atLeast(creativity, 'high') ? await buildImageBrief(ports, userId, content, context, format, grid) : heuristicImageBrief(content, context, format);
    try {
      sourced = await imageSourcingService.sourceImage(brief, {
        userId,
        projectId,
        tag,
        ...sourcing,
      });
    } catch (err: any) {
      logger.warn('Flyer image sourcing failed, falling back to text-only flyer', {
        error: err?.message,
      });
    }
  }

  // ---- Step 5d: composition (copy + HTML coherent with the image) --------
  const intent = inferVisualIntent(content);
  const sheet = brandSheet({
    brandName: context.brandName,
    businessType: context.businessType,
    tone: context.tone,
    palette: { primary: context.branding.primary, secondary: context.branding.secondary, accent: context.branding.accent, background: context.branding.background, text: context.branding.text },
    fonts: { display: context.branding.primaryFont || 'Archivo', body: context.branding.secondaryFont || context.branding.primaryFont || 'Inter' },
    art: context.artDirection,
  });
  const orchestrator = new CreativeOrchestrator({ level: creativity, call: ports.agentCall });
  const render = async (candidate: string, meta: Partial<VisualMeta>) => {
    let finalHtml = ensureLogoPresence(candidate, context, format);
    finalHtml = applyDesignLint(finalHtml, context, `visuel/${format}`, sourced?.analysis.dominantColors || []);
    const out = await flyerRenderService.renderFlyer(
      finalHtml,
      format,
      { url: context.branding.fontUrl, primaryFont: context.branding.primaryFont, secondaryFont: context.branding.secondaryFont },
      logoDeclensions(context, meta.logoUsed),
      {
        grid,
        palette: { primary: context.branding.primary, secondary: context.branding.secondary, accent: context.branding.accent, background: context.branding.background, text: context.branding.text },
        label: `visuel/${format}`,
      }
    );
    return { html: out.html ? sanitizeSectionHtml(out.html) : finalHtml, parsed: meta, sourced, intent, png: out.png, audit: out.audit };
  };

  // Crans Low → High : le CODE compose, les agents décident selon le cran.
  if (!atLeast(creativity, 'max')) {
    const brief = { title: content.title, hook: content.hook, description: content.description, intent, language: context.language };
    const copy = (await orchestrator.run(copywriterTask(sheet, brief))).value;
    const hasImage = !!sourced?.url;
    // Une citation (avis, témoignage) se reconnaît à ses guillemets ou à son vocabulaire.
    const quoteLike = /^[«"“]|t[ée]moign|avis client|nos clients disent|review/i.test(`${content.hook || ''} ${content.title}`);
    const structures: FlyerStructure[] = [...(hasImage ? ['photo' as const] : []), 'type', ...(copy.detail ? ['fact' as const] : []), ...(quoteLike ? ['quote' as const] : [])];
    const fallbackStructure: FlyerStructure = quoteLike ? 'quote' : hasImage ? 'photo' : copy.detail ? 'fact' : 'type';
    const referenced = creative.reference && structures.includes(creative.reference.structure) ? creative.reference.structure : undefined;
    const structure = referenced || (await orchestrator.run(structureTask(sheet, copy, structures, fallbackStructure))).value;
    const styleId = context.artDirection?.styleId;
    const seedNumber = parseInt(crypto.createHash('sha1').update(seedKey).digest('hex').slice(0, 8), 16);
    const menu = flyerLayoutMenu(structure, { styleId, recent: creative.recentLayouts });
    const chosen = (await orchestrator.run(artDirectorTask(sheet, copy, menu, pickFlyerLayout(structure, seedNumber, { styleId, recent: creative.recentLayouts })))).value;
    // La composition du modèle passe avant le choix de l'agent, si elle porte cette structure.
    const refLayout = creative.reference?.layout as FlyerLayoutId | undefined;
    const decided = refLayout && FLYER_LAYOUTS[refLayout]?.structures.includes(structure) ? { ...chosen, layout: refLayout } : chosen;
    const logos = context.branding.logoUrls;
    const codeHtml = renderFlyerLayout(decided.layout, {
      copy,
      brandName: context.brandName,
      palette: { primary: context.branding.primary, secondary: context.branding.secondary, accent: context.branding.accent, background: context.branding.background, text: context.branding.text },
      logo: { onLight: logos?.withText?.light || logos?.primary, onDark: logos?.withText?.dark || logos?.primary },
      image: sourced?.url,
      width: dims.width,
      height: dims.height,
      grid,
      emphasis: decided.emphasis,
    });
    return render(codeHtml, {
      concept: `${structure} · ${decided.layout}`,
      layoutNotes: FLYER_LAYOUTS[decided.layout].summary,
      marketingText: { headline: copy.headline, subheadline: copy.sub, body: [copy.kicker, copy.detail].filter(Boolean).join(' · ') },
      layout: decided.layout,
      creativity,
      agents: orchestrator.traces,
    } as Partial<VisualMeta>);
  }

  // Cran Ultra : l'idée de composition est décidée d'abord, par un agent concept.
  const ultraConcept = atLeast(creativity, 'ultra')
    ? (await orchestrator.run(conceptTask(sheet, heuristicFlyerCopy({ title: content.title, hook: content.hook, description: content.description }), !!sourced?.url))).value
    : null;
  // Un SEUL passage de substitution, piloté par une table exhaustive : les
  // remplacements en cascade laissaient passer des marqueurs non résolus
  // ({{DESIGN_SEED.archetype}}, {{IMAGE_DOMINANT_COLORS}}…) que le modèle
  // recevait littéralement — au mieux du bruit, au pire une consigne illisible
  // là où on croyait lui donner la charte.
  const systemPrompt = applyPlaceholders(
    AGENT_FLYER_GENERATION_PROMPT,
    buildFlyerPlaceholders(context, seed, intent, format, sourced, grid)
  );

  // Strip the heavy inline SVG markup before sending branding to the LLM: it
  // bloats the payload and tempts the model into pasting raw SVG. The resolved
  // logoUrls remain available (both in the prompt and here).
  const { logoSvg, ...brandingForLlm } = context.branding;

  const userPayload: Record<string, unknown> = {
    BRAND: {
      name: context.brandName,
      tone: context.tone,
      branding: brandingForLlm, // Detailed branding including logoUrls (no raw SVG)
      colors: brandingForLlm, // Legacy path for color placeholders
    },
    VISUAL_INTENT: intent,
    DESIGN_SEED: seed,
    CONTENT_IDEA: {
      title: content.title,
      hook: content.hook,
      description: content.description,
      format: content.format,
      channel: content.channel,
      intent,
      // `callToAction` n'est VOLONTAIREMENT pas transmis : c'est le texte de la
      // légende du post, pas un élément du visuel. Tant qu'on l'envoyait ici,
      // le modèle le prenait pour une consigne de composition et dessinait un
      // bouton sur chaque visuel — d'autant plus que la valeur par défaut du
      // calendrier est « Learn more ». Le visuel ne porte aucun CTA.
      hashtags: content.hashtags,
    },
    FORMAT: format,
    ...(ultraConcept ? { CREATIVE_DIRECTION: ultraConcept } : {}),
    ...(creative.reference
      ? { REFERENCE_COMPOSITION: `${creative.reference.description} — reproduce this composition (placement, hierarchy, proportions) with THIS brand's colours, fonts, texts and image; never copy the reference's texts.` }
      : {}),
  };
  if (sourced) {
    userPayload.IMAGE_URL = sourced.url;
    userPayload.IMAGE_SUBJECT = sourced.analysis.subject;
    userPayload.IMAGE_MOOD = sourced.analysis.mood;
    userPayload.IMAGE_DOMINANT_COLORS = sourced.analysis.dominantColors;
    userPayload.IMAGE_LUMINANCE = sourced.analysis.luminance;
    userPayload.IMAGE_COMPOSITION = sourced.analysis.composition;
    userPayload.IMAGE_DETECTED_TEXT = sourced.analysis.detectedText;
  }

  const messages: PromptMessage[] = [
    {
      role: 'system',
      content: ultraConcept
        ? `${systemPrompt}\n\nCREATIVE_DIRECTION (in the user payload) is the composition chosen by the creative director: follow its idea, make its focal point dominant and let its brand colour lead. Do not fall back to a stock layout.`
        : systemPrompt,
    },
    { role: 'user', content: JSON.stringify(userPayload, null, 2) },
  ];

  const compose = () => ports.runPrompt('flyer', messages);
  // Cran Ultra : deux compositions écrites EN PARALLÈLE (la seconde ne coûte pas d'attente).
  const [raw, secondRaw] = await Promise.all([compose(), atLeast(creativity, 'ultra') ? compose().catch(() => '') : Promise.resolve('')]);
  // Le balisage voyage désormais dans un bloc <html>, pas dans une chaîne
  // JSON : une page de Tailwind porte des centaines de guillemets doubles, et
  // c'est leur échappement qui perdait la génération entière. Les métadonnées
  // (concept, texte marketing) restent en JSON — elles n'ont pas ce problème.
  const parsed = parseFlyerResponse(raw);

  const toHtml = (candidate: Partial<VisualMeta>) =>
    typeof candidate.html === 'string' && candidate.html.trim().length > 0
      ? enforceBrandTypography(stripCtaButtons(candidate.html), context)
      : fallbackFlyerHtml(content, context, format, sourced?.url);

  // ---- Step 5e: contrôle de composition MESURÉ ---------------------------
  // Le visuel est monté dans un navigateur, mesuré et réparé (zone de
  // sécurité, texte rogné, alignement, hiérarchie, contraste réel sur les
  // pixels rendus, fond perdu), puis photographié. Ce que les passes
  // précédentes ne peuvent pas voir — elles lisent une chaîne, pas une page —
  // est attrapé ici, et le balisage renvoyé est celui qui a produit l'image.
  const first = await render(toHtml(parsed), { ...parsed, creativity });
  if (!atLeast(creativity, 'ultra')) return first;
  // Cran Ultra : une seconde composition, écrite et rendue ; la meilleure au contrôle mesuré est gardée.
  try {
    if (!secondRaw) return first;
    const secondParsed = parseFlyerResponse(secondRaw);
    const second = await render(toHtml(secondParsed), { ...secondParsed, creativity });
    const better = (a: typeof first, b: typeof first) => (a.audit.blocking !== b.audit.blocking ? (a.audit.blocking ? b : a) : b.audit.score > a.audit.score ? b : a);
    const best = better(first, second);
    return { ...best, parsed: { ...best.parsed, agents: orchestrator.traces } as Partial<VisualMeta> };
  } catch (err: any) {
    logger.warn('[Communication] Seconde composition Ultra en échec, la première est gardée', { error: err?.message });
    return first;
  }
}

/**
 * Table des déclinaisons de logo attendue par le rendu.
 *
 * Le rendu doit pouvoir RECONNAÎTRE le logo posé par le modèle (pour le
 * remonter au seuil de lisibilité) et le REMPLACER par la bonne polarité si
 * le contraste mesuré sous lui est insuffisant : il lui faut donc l'URL
 * utilisée ET toutes les déclinaisons disponibles.
 */
export function logoDeclensions(context: VisualBrandContext, used?: unknown): LogoDeclensionSet {
  const logos = context.branding.logoUrls;
  return {
    used: typeof used === 'string' ? used : undefined,
    primary: logos?.primary,
    withText: logos?.withText
      ? {
          lightBackground: logos.withText.light,
          darkBackground: logos.withText.dark,
          monochrome: logos.withText.mono,
        }
      : undefined,
    iconOnly: logos?.iconOnly
      ? {
          lightBackground: logos.iconOnly.light,
          darkBackground: logos.iconOnly.dark,
          monochrome: logos.iconOnly.mono,
        }
      : undefined,
  };
}

/**
 * Infer the communication purpose of a content idea so the visual composer
 * knows which TONE to hold (atmospheric, factual, celebratory…). It no longer
 * arbitrates a CTA: no visual carries one. Heuristic + multilingual keyword
 * scan, defaulting to 'awareness'.
 */
export function inferVisualIntent(content: {
  intent?: VisualIntent;
  title?: string;
  hook?: string;
  description?: string;
  callToAction?: string;
}): VisualIntent {
  if (content.intent) return content.intent;
  const haystack = [content.title, content.hook, content.description, content.callToAction]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const has = (words: string[]) => words.some((w) => haystack.includes(w));
  if (has(['recrut', 'hiring', 'we\'re hiring', 'join our', 'join the team', 'postul', 'emploi', 'nous recrutons', 'career', 'carrière', 'offre d\'emploi']))
    return 'recruitment';
  if (has(['promo', 'sale', 'discount', 'offre', 'réduction', 'deal', 'shop now', 'buy', 'order now', 'commande', 'soldes', '% off', '-50', 'code promo']))
    return 'promotion';
  if (has(['launch', 'lance', 'nouveau', 'new ', 'introducing', 'annonce', 'announce', 'disponible', 'now available', 'sortie']))
    return 'announcement';
  if (has(['fête', 'célèbr', 'celebrat', 'anniversa', 'happy ', 'joyeux', 'congrat', 'félicit', 'merci', 'thank you', 'holiday']))
    return 'celebration';
  return 'awareness';
}

/**
 * Table de substitution du prompt de composition.
 *
 * Elle porte la CHARTE (hex exacts, familles typographiques, déclinaisons de
 * logo réelles) : ce sont des valeurs, pas des chemins symboliques — le modèle
 * ne doit jamais avoir à deviner une couleur ni à inventer une URL. Toute
 * valeur manquante reçoit un repli explicite plutôt que de laisser un trou.
 */
function buildFlyerPlaceholders(
  context: VisualBrandContext,
  seed: DesignSeed,
  intent: VisualIntent,
  format: FlyerFormat,
  sourced: SourcedImage | null,
  grid: CompositionGrid
): Record<string, string> {
  const branding = context.branding;
  const logos = branding.logoUrls;
  const primaryLogo = logos?.primary || '';
  const pickLogo = (url?: string) => (url && url.trim()) || primaryLogo || '(no logo available)';

  return {
    BRAND_NAME: context.brandName,
    BRAND_PRIMARY: branding.primary,
    BRAND_SECONDARY: branding.secondary,
    // Sans accent défini, renvoyer la primaire plutôt qu'un vide : le modèle
    // comblerait un trou de palette par une couleur de son cru.
    BRAND_ACCENT: branding.accent || branding.primary,
    BRAND_BACKGROUND: branding.background || '#ffffff',
    BRAND_TEXT: branding.text || '#0f172a',
    BRAND_PRIMARY_FONT: branding.primaryFont || 'Archivo',
    BRAND_SECONDARY_FONT: branding.secondaryFont || branding.primaryFont || 'IBM Plex Sans',
    // `branding.fontUrl` vient de `typography.url`, qui est un slug : le
    // transmettre tel quel faisait recopier au modèle un <link> mort, et le
    // visuel sortait dans la police système. On construit l'URL réelle.
    BRAND_FONT_URL: brandFontsHref(
      { url: branding.fontUrl, primaryFont: branding.primaryFont, secondaryFont: branding.secondaryFont },
      'https://fonts.googleapis.com/css2?family=Archivo:wght@100..900&display=swap'
    ),

    LOGO_PRIMARY: primaryLogo || '(no logo available)',
    LOGO_WITHTEXT_LIGHT: pickLogo(logos?.withText?.light),
    LOGO_WITHTEXT_DARK: pickLogo(logos?.withText?.dark),
    LOGO_WITHTEXT_MONO: pickLogo(logos?.withText?.mono),
    LOGO_ICON_LIGHT: pickLogo(logos?.iconOnly?.light),
    LOGO_ICON_DARK: pickLogo(logos?.iconOnly?.dark),
    LOGO_ICON_MONO: pickLogo(logos?.iconOnly?.mono),
    // Même seuil que celui appliqué à la mesure au moment du rendu : le
    // modèle est prévenu de la règle qui sera de toute façon imposée.
    LOGO_MIN_WIDTH: String(minLogoWidthFor(format)),

    format,
    VISUAL_INTENT: intent,

    // La direction artistique et la graine sont DÉVELOPPÉES en consignes.
    // Transmettre {"archetype":"D"} revenait à ne rien transmettre : le
    // modèle ignore ce que « D » recouvre, et composait au jugé.
    ART_DIRECTION:
      buildArtDirectionBlock(context.artDirection, { medium: 'poster' }) ||
      '(no art direction defined for this brand — compose from the charter alone)',
    SEED_DIRECTIVES: describeSeed(seed),
    // Le squelette de la composition, en pixels. C'est la seule partie du
    // prompt qui soit VÉRIFIABLE au pixel près après coup : chacun de ces
    // nombres a son contrôle dans `visualAudit.ts`.
    COMPOSITION_GRID: describeCompositionGrid(grid),
    ANTI_SLOP: ANTI_SLOP_BLOCK,
    // Traitement d'image de la marque, à appliquer à la photo de fond.
    AD_IMAGE_TREATMENT:
      buildImageStyleModifier(context.artDirection) ||
      'no mandated treatment — stay consistent with the charter',

    DESIGN_SEED: JSON.stringify(seed, null, 2),
    'DESIGN_SEED.archetype': seed.archetype,
    'DESIGN_SEED.colorStrategy': seed.colorStrategy,
    'DESIGN_SEED.typographyMood': seed.typographyMood,
    'DESIGN_SEED.layoutTension': seed.layoutTension,
    'DESIGN_SEED.spacingMultiplier': String(seed.spacingMultiplier),

    IMAGE_URL: sourced?.url || '(no image — build a purely typographic composition)',
    IMAGE_DOMINANT_COLORS: sourced?.analysis.dominantColors?.join(', ') || 'unknown',
    IMAGE_LUMINANCE: sourced?.analysis.luminance || 'mixed',
    IMAGE_COMPOSITION: sourced?.analysis.composition || 'balanced',
    IMAGE_DETECTED_TEXT: sourced?.analysis.detectedText || 'none',
  };
}

/**
 * Substitue les `{{MARQUEURS}}` d'un prompt en un seul passage.
 *
 * Un marqueur absent de la table est laissé tel quel ET signalé : un `{{…}}`
 * qui atteint le modèle est un réglage qu'on croyait transmis et qui ne l'est
 * pas — le genre de bug qui ne casse rien et dégrade tout.
 */
export function applyPlaceholders(template: string, values: Record<string, string>): string {
  const missing = new Set<string>();
  const rendered = template.replace(/\{\{([A-Za-z0-9_.]+)\}\}/g, (match, key: string) => {
    if (key in values) return values[key];
    missing.add(key);
    return match;
  });
  if (missing.size) {
    logger.warn('[Communication] Unresolved placeholders in the flyer prompt', {
      placeholders: [...missing],
    });
  }
  return rendered;
}

/**
 * Lit la réponse du compositeur de visuel : un bloc <meta> JSON et un bloc
 * <html> brut.
 *
 * Le repli sur l'ancien contrat (tout en JSON, balisage échappé) est
 * volontaire et durable : les réponses en cache ont été produites sous
 * l'ancien format, et un modèle de repli peut très bien répondre à l'ancienne.
 * Aucune des deux formes ne doit perdre un visuel.
 */
export function parseFlyerResponse(raw: string): Partial<VisualMeta> {
  const htmlBlock = raw.match(/<html>([\s\S]*?)<\/html>/i);
  const metaBlock = raw.match(/<meta>([\s\S]*?)<\/meta>/i);

  if (htmlBlock) {
    const meta = metaBlock ? (safeJson<Partial<VisualMeta>>(metaBlock[1]) ?? {}) : {};
    return { ...meta, html: htmlBlock[1].trim() };
  }

  // Ancien contrat : tout dans un objet JSON.
  return safeJson<Partial<VisualMeta>>(raw) ?? {};
}

function safeJson<T>(raw: string): T | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/^```(json)?\s*/i, '')
    .replace(/```$/g, '')
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    // Try to recover the first {...} or [...] block.
    const match = cleaned.match(/[\[{][\s\S]*[\]}]/);
    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch {
        /* ignore */
      }
    }
    logger.warn('CommunicationService: failed to parse JSON output', {
      preview: cleaned.slice(0, 200),
    });
    return null;
  }
}

export function fallbackFlyerHtml(
  content: VisualContent,
  context: VisualBrandContext,
  format: FlyerFormat,
  imageUrl?: string
): string {
  const size =
    format === 'story'
      ? 'w-[1080px] h-[1920px]'
      : format === 'banner'
        ? 'w-[1200px] h-[630px]'
        : format === 'post'
          ? 'w-[1200px] h-[1500px]'
          : format === 'a4'
            ? 'w-[1240px] h-[1754px]'
            : 'w-[1080px] h-[1080px]';
  const primary = context.branding.primary || '#0ea5e9';
  const secondary = context.branding.secondary || '#0f172a';
  const text = context.branding.text || '#ffffff';
  const bgImage = imageUrl
    ? `<img src="${imageUrl}" class="absolute inset-0 w-full h-full object-cover" /><div class="absolute inset-0 bg-gradient-to-t from-[${secondary}]/90 via-[${secondary}]/40 to-transparent"></div>`
    : '';
  // Pied de page : signature de marque typographique, jamais un bouton — ce
  // repli servait auparavant une pastille contenant le callToAction, ce qui
  // reproduisait dans le fallback le défaut qu'on corrige côté modèle.
  return `<div class="${size} relative overflow-hidden flex flex-col justify-between p-16 bg-[${secondary}] text-[${text}]">${bgImage}<div class="relative text-xs uppercase tracking-[0.3em] opacity-70">${context.brandName}</div><div class="relative flex-1 flex flex-col justify-end gap-6"><div class="text-6xl font-black leading-[1.05] max-w-[80%]">${escapeHtml(content.title)}</div><div class="text-lg max-w-[75%] opacity-90">${escapeHtml(content.description || "")}</div></div><div class="relative flex items-end justify-between border-t border-[${text}]/25 pt-6"><div class="text-xs uppercase tracking-[0.35em] opacity-80">${escapeHtml(context.brandName)}</div><div class="h-[4px] w-28 bg-[${primary}]"></div></div></div>`;
}

/**
 * Ramène la typographie du visuel dans la charte.
 *
 * Le harnais de rendu lie `font-primary`/`font-secondary` aux polices de la
 * marque, mais rien n'empêchait le modèle d'écrire `font-['Anton']` ou un
 * `font-family` en style inline — et d'ajouter le <link> Google Fonts qui va
 * avec. Le visuel sortait alors typographié dans une police que la marque
 * n'utilise nulle part ailleurs.
 *
 * On réécrit donc les familles arbitraires vers les classes de la charte
 * (`font-primary` par défaut : une police choisie à la main sert quasi
 * toujours un titre) et on retire les imports de polices étrangères, devenus
 * inutiles — celui de la marque est injecté par le rendu, pas par le modèle.
 *
 * Les COULEURS ne sont volontairement pas normalisées ici : remplacer un hex
 * hors palette demanderait de deviner l'intention (accent ? traitement de la
 * photo ? dégradé ?), et une substitution mécanique abîmerait la composition
 * plus sûrement qu'une teinte approximative. C'est la charte du prompt qui
 * les tient.
 */
export function enforceBrandTypography(html: string, context: VisualBrandContext): string {
  if (!html) return html;

  // L'identité d'une URL Google Fonts est dans sa QUERY (`family=…`), pas dans
  // son chemin : comparer les chemins revient à trouver toutes ces URLs
  // identiques, et à laisser passer les polices étrangères.
  const familiesOf = (url: string): string[] =>
    [...url.replace(/&amp;/g, '&').matchAll(/family=([^&:]+)/gi)].map((m) =>
      decodeURIComponent(m[1]).replace(/\+/g, ' ').trim().toLowerCase()
    );
  const brandFamilies = new Set(familiesOf(context.branding.fontUrl || ''));

  // Le `font-family` inline est traité DANS l'attribut style, pour ne pas
  // s'arrêter au premier guillemet d'une famille citée (`'Bebas Neue'`).
  const rewriteStyleAttributes = (input: string, quote: '"' | "'"): string => {
    const pattern = new RegExp(`style\\s*=\\s*${quote}([^${quote}]*)${quote}`, 'gi');
    return input.replace(pattern, (match, body: string) => {
      if (!/font-family/i.test(body)) return match;
      const fixed = body.replace(/font-family\s*:[^;]*/gi, 'font-family: var(--font-primary)');
      return `style=${quote}${fixed}${quote}`;
    });
  };

  let normalised = html
    // font-['Anton'] / font-["Anton"] → police d'affichage de la marque.
    .replace(/\bfont-\[(?:'[^']*'|"[^"]*")\]/g, 'font-primary')
    // Familles génériques de Tailwind : hors charte elles aussi.
    .replace(/\bfont-(?:sans|serif|mono)\b/g, 'font-secondary');
  normalised = rewriteStyleAttributes(normalised, '"');
  normalised = rewriteStyleAttributes(normalised, "'");
  // Imports de polices tierces ajoutés par le modèle. Celui de la marque est
  // injecté par le harnais de rendu : rien n'est perdu à les retirer.
  normalised = normalised.replace(
    /<link\b[^>]*href\s*=\s*["']([^"']*fonts\.googleapis\.com[^"']*)["'][^>]*>/gi,
    (tag, href: string) => {
      const families = familiesOf(String(href));
      const isBrand = families.length > 0 && families.every((f) => brandFamilies.has(f));
      return isBrand ? tag : '';
    }
  );

  if (normalised !== html) {
    logger.info('[Communication] Typographie du visuel réalignée sur la charte');
  }
  return normalised;
}

/**
 * Toutes les URLs de déclinaisons connues pour la marque, dédoublonnées.
 */
export function knownLogoUrls(context: VisualBrandContext): string[] {
  const logos = context.branding.logoUrls;
  if (!logos) return [];
  const raw = [
    logos.primary,
    logos.withText?.light,
    logos.withText?.dark,
    logos.withText?.mono,
    logos.iconOnly?.light,
    logos.iconOnly?.dark,
    logos.iconOnly?.mono,
  ].filter((u): u is string => typeof u === 'string' && u.trim().length > 0);
  return [...new Set(raw)];
}

/**
 * Filet déterministe contre le bouton d'appel à l'action.
 *
 * Le prompt l'interdit et la légende n'est plus transmise au compositeur,
 * mais une consigne textuelle ne garantit rien : le visuel part à
 * l'impression ou en publication sans relecture, il faut donc une règle qui
 * ne dépende pas du bon vouloir du modèle.
 *
 * Portée assumée : on ne supprime que ce qui EST un bouton par nature
 * (`<button>`, `role="button"`). Une pastille construite en <div>/<span>
 * n'est pas identifiable sans moteur de rendu — il faudrait comparer les
 * styles calculés — et reste couverte par le seul prompt.
 */
export function stripCtaButtons(html: string): string {
  if (!html) return html;
  const cleaned = html
    // Un <button> ne peut pas en contenir un autre : le non-greedy est sûr.
    .replace(/<button\b[^>]*>[\s\S]*?<\/button>/gi, '')
    // Idem pour <a> (imbrication interdite en HTML).
    .replace(/<a\b[^>]*\brole\s*=\s*["']button["'][^>]*>[\s\S]*?<\/a>/gi, '');
  if (cleaned !== html) {
    logger.warn(
      '[Communication] CTA button removed from the generated visual — the model ignored the no-button rule'
    );
  }
  return cleaned;
}

/**
 * Garantit qu'un logo RÉEL figure dans le HTML du visuel.
 *
 * Le prompt l'exige déjà, et le rendu sait ensuite corriger sa taille et sa
 * polarité — mais uniquement s'il y a quelque chose à corriger. Deux échecs
 * silencieux restaient possibles : le modèle omet le logo, ou il écrit une
 * URL inventée (un chemin symbolique du type « BRAND.logoUrls.primary », ou
 * une URL plausible qui n'existe pas). Dans les deux cas le visuel sortait
 * sans signature, et aucune mesure au rendu ne pouvait le rattraper.
 *
 * On corrige donc en amont, sur la chaîne HTML — qui est aussi ce que
 * l'éditeur WYSIWYG affichera.
 */
export function ensureLogoPresence(
  html: string,
  context: VisualBrandContext,
  format: FlyerFormat
): string {
  const urls = knownLogoUrls(context);
  if (!urls.length || !html) return html;

  const stripQuery = (value: string) => value.split('?')[0];
  const known = urls.map(stripQuery);
  if (known.some((url) => html.includes(url))) return html;

  // Déclinaison par défaut : la version « avec texte » sur fond clair, ou le
  // logo primaire. La polarité définitive est arbitrée au rendu, par mesure
  // du contraste réel sous le logo.
  const fallbackUrl =
    context.branding.logoUrls?.withText?.light || context.branding.logoUrls?.primary || urls[0];
  const minWidth = minLogoWidthFor(format);
  const brand = escapeHtml(context.brandName || 'la marque');

  // 1. Une balise <img> se présente comme le logo mais pointe ailleurs :
  //    c'est l'URL inventée. On la corrige plutôt que d'ajouter un doublon.
  const looksLikeLogo = /<img\b[^>]*(?:alt=["'][^"']*logo|class=["'][^"']*logo|src=["'][^"']*logo)[^>]*>/i;
  const match = html.match(looksLikeLogo);
  if (match) {
    const repaired = match[0].replace(/src=["'][^"']*["']/i, `src="${fallbackUrl}"`);
    logger.warn('[Communication] URL de logo invalide remplacée par une déclinaison réelle', {
      format,
    });
    return html.replace(match[0], repaired);
  }

  // 2. Aucun logo du tout : on en pose un, dans un angle, à la taille
  //    minimale lisible. Une signature imparfaitement placée vaut mieux qu'un
  //    visuel de marque anonyme — et l'utilisateur peut la déplacer dans
  //    l'éditeur.
  const badge = `<img src="${fallbackUrl}" alt="logo ${brand}" class="absolute" style="left:5%;bottom:5%;width:${minWidth}px;height:auto;opacity:1;" />`;
  const lastClose = html.lastIndexOf('</div>');
  logger.warn('[Communication] Aucun logo dans le visuel généré : signature ajoutée', {
    format,
    minWidth,
  });
  return lastClose === -1
    ? `${html}${badge}`
    : `${html.slice(0, lastClose)}${badge}${html.slice(lastClose)}`;
}

/**
 * Passe déterministe anti-générique sur le HTML d'un visuel.
 *
 * Corrige ce qui a une bonne réponse unique (couleur hors charte, police
 * écrite en dur, titre en dégradé, image sans alt), journalise le reste. Ne
 * recompose jamais : la mise en page reste celle que le modèle a produite.
 */
export function applyDesignLint(
  html: string,
  context: VisualBrandContext,
  label: string,
  /**
   * Teintes dominantes de la photo. Elles sont LÉGITIMES sur un visuel (elles
   * pilotent le duotone, le voile, le filtre) : sans cette liste, la
   * correction les ramènerait à la couleur de charte la plus proche et
   * détruirait les stratégies IMAGE_EXTRACTED et SPLIT_COMPLEMENTARY.
   */
  imageColors: string[] = []
): string {
  if (!html) return html;
  const options = {
    palette: {
      primary: context.branding.primary,
      secondary: context.branding.secondary,
      accent: context.branding.accent,
      background: context.branding.background,
      text: context.branding.text,
    },
    fonts: [context.branding.primaryFont, context.branding.secondaryFont].filter(
      (f): f is string => !!f
    ),
    extraAllowedColors: imageColors,
    expectedLogoUrls: knownLogoUrls(context),
    styleId: context.artDirection?.styleId,
    label,
  };
  // Réparation déterministe (deux passes) PUIS constat de ce qui résiste.
  // Le verdict du linter était auparavant calculé puis jeté.
  return enforceDesignRules(html, options).html;
}

/**
 * Tiny LLM call to decide what to search / generate. Returns sensible
 * defaults if parsing fails so the pipeline never blocks on this step.
 */
async function buildImageBrief(
  ports: VisualPorts,
  userId: string,
  content: VisualContent,
  context: VisualBrandContext,
  format: FlyerFormat,
  /**
   * Grille du visuel. Elle dit OÙ le texte va tomber : sans elle, le brief
   * demandait « une image avec de l'espace pour le texte » sans savoir de
   * quel côté, et la photo revenait avec son sujet précisément là où le
   * titre devait se poser.
   */
  grid?: CompositionGrid
): Promise<ImageBrief> {
  const orientation: 'portrait' | 'landscape' | 'square' =
    format === 'banner' ? 'landscape' : format === 'square' ? 'square' : 'portrait';

  try {
    // Le brief d'image décide de 70 % de la surface du visuel : il doit
    // connaître la direction artistique, sans quoi il ramène la photo de
    // banque d'images par défaut, étrangère au reste de la marque.
    const imageryDirection = context.artDirection
      ? [
          `Medium: ${context.artDirection.imagery?.medium || 'photography'}`,
          `Brand subjects: ${context.artDirection.imagery?.subjects || ''}`,
          `Treatment: ${context.artDirection.imagery?.treatment || ''}`,
          `Lighting: ${context.artDirection.imagery?.lighting || ''}`,
          `Framing: ${context.artDirection.imagery?.framing || ''}`,
          `Render modifier (English, reuse it in generationPrompt): ${buildImageStyleModifier(context.artDirection)}`,
        ]
          .filter((line) => line.split(':').slice(1).join(':').trim())
          .join('\n')
      : 'No art direction defined: pick a restrained image, consistent with the charter, and avoid generic illustration imagery.';

    const messages: PromptMessage[] = [
      {
        role: 'system',
        content: AGENT_IMAGE_BRIEF_PROMPT.replace('{{AD_IMAGERY}}', imageryDirection).replace(
          '{{COMPOSITION_NEED}}',
          grid ? describeImageNeed(grid) : 'The text may land anywhere: keep one calm, uncluttered zone.'
        ),
      },
      {
        role: 'user',
        content: JSON.stringify({
          BRAND: {
            businessType: context.businessType,
            tone: context.tone,
            keywords: context.keywords,
          },
          CONTENT: {
            title: content.title,
            hook: content.hook,
            description: content.description,
            format: content.format,
          },
          FORMAT: format,
        }),
      },
    ];
    const raw = await ports.runPrompt('imageBrief', messages);
    const parsed = safeJson<Partial<ImageBrief>>(raw) ?? {};
    return {
      searchQuery:
        (parsed.searchQuery && parsed.searchQuery.trim()) ||
        fallbackSearchQuery(content, context),
      generationPrompt:
        (parsed.generationPrompt && parsed.generationPrompt.trim()) ||
        fallbackGenerationPrompt(content, context),
      // Prompt négatif : celui décidé par l'agent, complété par celui du style
      // retenu. Les deux visent la même chose — écarter les tics de rendu qui
      // signent une image générée.
      negativePrompt: [
        (parsed as any).negativePrompt,
        buildImageNegativePrompt(context.artDirection),
      ]
        .filter(Boolean)
        .join(', '),
      preferGenerated: !!parsed.preferGenerated,
      orientation: (parsed.orientation as ImageBrief['orientation']) || orientation,
    };
  } catch (err: any) {
    logger.warn('buildImageBrief failed, using heuristic brief', { error: err?.message });
    return {
      searchQuery: fallbackSearchQuery(content, context),
      generationPrompt: fallbackGenerationPrompt(content, context),
      negativePrompt: buildImageNegativePrompt(context.artDirection),
      orientation,
    };
  }
}

/** Brief d'image sans modèle (crans Low et Medium) : la recherche vient du contenu et de la DA. */
function heuristicImageBrief(content: VisualContent, context: VisualBrandContext, format: FlyerFormat): ImageBrief {
  return {
    searchQuery: fallbackSearchQuery(content, context),
    generationPrompt: fallbackGenerationPrompt(content, context),
    negativePrompt: buildImageNegativePrompt(context.artDirection),
    orientation: format === 'banner' ? 'landscape' : format === 'square' ? 'square' : 'portrait',
  };
}

function fallbackSearchQuery(content: VisualContent, context: VisualBrandContext): string {
  const base = [content.title, ...(context.keywords || []).slice(0, 2)].filter(Boolean).join(' ');
  return base.replace(/[^a-zA-Z0-9 ]+/g, '').slice(0, 60) || context.businessType || 'business';
}

/**
 * Repli quand l'agent de brief échoue.
 *
 * Il porte le style de la marque plutôt qu'un « photorealistic editorial »
 * générique : un repli qui ignore la direction artistique produit exactement
 * l'image que le module cherche à éviter, et il sert justement dans les cas
 * dégradés, où personne ne repasse derrière.
 */
function fallbackGenerationPrompt(content: VisualContent, context: VisualBrandContext): string {
  const style = buildImageStyleModifier(context.artDirection);
  return (
    `Photograph for a ${context.businessType} brand. ` +
    `Subject relates to: ${content.title}. ` +
    `Mood: ${context.tone}. ` +
    (style ? `Render: ${style}. ` : 'Soft natural lighting, restrained color grading. ') +
    `Clean composition with generous negative space in the upper third for overlay text. ` +
    `No on-image typography, no logos, no watermarks, no staged corporate stock scene.`
  );
}

export function escapeHtml(raw: string): string {
  return (raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Graine de composition d'un visuel.
 *
 * Le tirage était libre : deux visuels de la même marque pouvaient sortir en
 * « néon sur fond noir » puis en « luxe minimal », sans parenté. Il est
 * désormais borné par le style de la direction artistique (cf.
 * design/designSeed.ts) — la variété d'un post à l'autre reste entière, mais
 * à l'intérieur de l'univers de la marque.
 *
 * La clé d'entropie est l'IDENTITÉ DU VISUEL, pas l'horloge : deux visuels
 * d'une même marque diffèrent bien entre eux (clés différentes), mais LE MÊME
 * visuel regénéré retrouve sa composition.
 *
 * Sans clé, le tirage était aléatoire à chaque appel — donc non reproductible.
 * Le cache Redis (`generateAIKey`) n'inclut pas la graine : la version servie
 * pouvait donc ne plus correspondre à celle qui avait été composée, et un
 * simple rafraîchissement changeait la mise en page sous les yeux de
 * l'utilisateur.
 */
function generateDesignSeed(
  context: VisualBrandContext,
  entropyKey?: string
): DesignSeed {
  return buildDesignSeed(context.artDirection?.styleId, entropyKey);
}

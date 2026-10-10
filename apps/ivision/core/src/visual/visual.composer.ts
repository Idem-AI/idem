/**
 * LA COMPOSITION D'UN VISUEL — flyer, publication, bannière, page A4.
 *
 * Le même compositeur pour IDEM (module Communication, charte graphique) et pour iVision.
 * Il délègue au moteur d'affiches (`poster/`) : des gabarits DESSINÉS PAR LE CODE (aucun HTML
 * écrit par l'IA, à aucun cran), des mots bornés écrits par l'IA, une photo choisie (celle de
 * l'utilisateur, de la marque, puis vérifiée par la vision), un rendu MESURÉ (texte ajusté,
 * débordements et chevauchements refusés). La jauge de créativité décide qui choisit la
 * composition : les règles (Low, Medium), un directeur artistique (High, Max), un critique
 * visuel qui compare les rendus (Ultra).
 *
 * Restent ici les passes utilisées par l'édition des visuels d'IDEM (logo, typographie, boutons).
 */
import logger from '../runtime/logger';
import { CreativityLevel } from '../creativity/levels';
import { AgentCall } from '../creativity/orchestrator';
import type { ReferenceImage } from '../reference/reference.analyzer';
import { ImageSourcingPreferences, SourcedImage } from './image.sourcing';
import { composePoster } from './poster/poster.compose';
import { minLogoWidthFor } from './flyer.render';
import { VisualAuditReport } from '../design/visualAudit';
import { enforceDesignRules } from '../design/slopLint';
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
 * Compose un visuel — IDEM (calendrier, atelier, charte) et iVision (conversation).
 *
 * Le visuel est DESSINÉ PAR LE CODE (`poster/`) : une composition éprouvée, la palette de la
 * charte avec contraste vérifié, des textes ajustés au millimètre, le logo là où il se lit, la
 * photo choisie pour sa pertinence. L'IA écrit les mots et, selon le cran, choisit et juge
 * les compositions — elle n'écrit jamais de HTML (c'est ce qui rendait les crans Max et Ultra
 * confus : texte coupé, éléments empilés, décor sans fonction).
 *
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
  /** Composition typographique, sans photo (demandé). */
  skipImage?: boolean,
  creative: {
    creativity?: CreativityLevel;
    recentLayouts?: string[];
    /**
     * Une image modèle (iVision) : sa structure oriente le choix de la composition. Ses textes
     * et ses photos ne sont jamais repris : ce sont ceux de la marque.
     */
    reference?: Pick<ReferenceImage, 'layout' | 'structure' | 'hasPhoto' | 'description'>;
    /** La photo de l'utilisateur (iVision) : posée à la place d'une photo de banque ou générée. */
    image?: { url: string };
    /** Les images de la marque (site, projet, imports) : seules les vraies photos sont gardées. */
    brandPhotos?: string[];
    /** Fond sombre admis (demande explicite, ou la marque fait elle-même des visuels sombres). */
    allowDark?: boolean;
    /** Retour sur la version précédente, et ce qu'elle était (pour proposer autre chose). */
    feedback?: string;
    avoid?: { template?: string; scheme?: string }[];
    /** L'avancement réel, pour l'interface (iVision : la liste des étapes du chat). */
    onStage?: (stage: string, state: 'running' | 'done') => void;
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
  const result = await composePoster(
    { agentCall: ports.agentCall },
    {
      userId,
      brandId: projectId,
      content,
      context,
      format,
      tag,
      seedKey,
      creativity: creative.creativity || 'medium',
      recentLayouts: creative.recentLayouts,
      photoUrl: creative.image?.url,
      brandPhotos: creative.brandPhotos,
      skipImage: skipImage && !creative.image?.url,
      sourcing,
      allowDark: creative.allowDark,
      feedback: creative.feedback,
      avoid: creative.avoid,
      reference: creative.reference,
      onStage: creative.onStage,
    }
  );
  return { html: result.html, parsed: result.parsed, sourced: result.sourced, intent: inferVisualIntent(content), png: result.png, audit: result.audit };
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

export function escapeHtml(raw: string): string {
  return (raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Orchestrateur de site vitrine : le code dirige, le modèle rédige.
 *
 * L'ancienne voie confiait le site entier à un seul appel : plan, contenus,
 * référencement, dans une réponse de plusieurs milliers de jetons. Un modèle
 * moyen s'y perdait de trois façons, toutes observées :
 *
 *   - il recopiait son prompt (titres, tableaux, « Signature move » en boucle) ;
 *   - il s'arrêtait après trois sections, et le site restait incomplet ;
 *   - il imprimait le plan dans la conversation au lieu de l'écrire.
 *
 * Ici, chaque section est une tâche à part : un appel court, une forme JSON
 * étroite, une vérification, un nouvel essai (puis un autre modèle) si la
 * réponse ne tient pas. Le plan, la navigation, le pied de page, les offres,
 * l'équipe, le contact et le référencement sont écrits par le code à partir de
 * ce que le projet sait déjà. Le résultat est diffusé comme un artefact
 * ordinaire : le client l'applique, le compositeur assemble les pages, l'aperçu
 * démarre.
 */

import type { Response } from 'express';
import { formatDataStreamPart, generateText } from 'ai';
import { ProjectModel } from '../types/project.js';
import { DesignSystem, forgeDesignSystem } from '../design/tokenForge.js';
import { sectionDefaults } from '../scaffold/sections.js';
import { isLightSurface, normalizeHex } from '../design/charter.js';
import { getFallbackModelKeys, resolveModelCredentials } from '../config/modelConfig.js';
import { getOpenAIModel } from '../services/aiService.js';
import { reportUsage } from '../utils/tokens.js';
import { ChatLogger } from '../utils/logger.js';
import { fetchBrandAsset } from '../utils/brandAsset.js';
import { isTransientModelError, ResilientStream, shouldTryNextModel } from '../utils/resilientStream.js';
import { detectSiteLanguage, readSiteFacts, renderFacts, SiteFacts } from './siteFacts.js';
import {
  buildSitePlan,
  describeDestination,
  PlannedPage,
  PlannedSection,
  seedOf,
  SitePlan,
  wordsFor,
} from './sitePlan.js';
import { cleanText, readJsonObject, SECTION_SPECS, validateSection } from './sectionSpecs.js';
import { createFactGuard, FactCheck, stripSentences } from './factGuard.js';

/** Version du contrat écrit dans `idem.plan.json` : le client s'en sert pour reconnaître ces sites. */
export const SITE_ORIGIN = 'idem-site';

/** Sections rédigées en même temps : assez pour aller vite, pas assez pour saturer un fournisseur. */
const CONCURRENCY = 3;
/** Essais par section, tous modèles confondus. */
const MAX_ATTEMPTS = 3;
/** Au-delà, l'appel est abandonné et le modèle suivant prend la main. */
const CALL_TIMEOUT_MS = 45_000;
/** Un signe de vie régulier : certains relais coupent un flux muet. */
const KEEPALIVE_MS = 12_000;

export interface SiteBuildInput {
  projectData: ProjectModel;
  language: string;
  /** La demande telle qu'écrite (brief de l'atelier ou message de l'utilisateur). */
  request: string;
  model: string;
  userId: string | null;
}

/** L'orchestrateur prend-il ce tour ? */
export function shouldOrchestrateSite(options: {
  target: string;
  scaffoldVersion?: string;
  isFirstTurn: boolean;
  projectData?: ProjectModel;
  outOfBand?: string;
}): boolean {
  if ((process.env.SITE_ORCHESTRATOR ?? 'on').toLowerCase() === 'off') return false;
  return (
    options.target === 'site' &&
    !!options.scaffoldVersion &&
    options.isFirstTurn &&
    !!options.projectData &&
    !options.outOfBand?.trim()
  );
}

/* -------------------------------------------------------------------------- */
/*  Appels au modèle                                                           */
/* -------------------------------------------------------------------------- */

interface CallOutcome<T> {
  value: T | null;
  model?: string;
  attempts: number;
  /** Tous les essais ont échoué côté fournisseur (saturation, réseau), aucun sur le contenu. */
  providerDown: boolean;
  /** La réponse retenue a été récupérée en retirant des phrases non vérifiées. */
  salvaged?: boolean;
}

/**
 * Le jugement d'une réponse : acceptée, ou refusée avec ce qu'il faut dire au
 * modèle pour l'essai suivant — et, s'il y a lieu, de quoi la récupérer quand
 * les essais sont épuisés.
 */
export type Verdict<T> = { value: T } | { problem: string; salvage?: () => T | null };

const SHAPE_REMINDER =
  'Votre réponse précédente était inutilisable. Renvoyez UNIQUEMENT l’objet JSON demandé, complet, avec toutes ses clés, sans texte autour ni bloc de code.';

/** Après deux pannes dans la même construction, un modèle cède sa place pour la suite. */
const FAILURES_BEFORE_DEMOTION = 2;

/**
 * Appelle les modèles de la chaîne de repli jusqu'à obtenir une réponse qui
 * passe la vérification.
 *
 * Une panne (503, délai dépassé) fait passer la section au modèle suivant. Un
 * modèle qui tombe deux fois est écarté pour le reste de la construction : les
 * sections suivantes ne repassent pas par lui pour rien. Une seule panne ne
 * suffit pas — elle est souvent passagère, et changer de modèle en cours de
 * site change aussi sa voix.
 */
class ModelCaller {
  private readonly chain: string[];
  private readonly failures = new Map<string, number>();
  promptTokens = 0;
  completionTokens = 0;

  constructor(
    preferred: string,
    private readonly userId: string | null,
    private readonly signal: AbortSignal
  ) {
    this.chain = getFallbackModelKeys(preferred);
  }

  private order(): string[] {
    const available = this.chain.filter(
      (model) => (this.failures.get(model) ?? 0) < FAILURES_BEFORE_DEMOTION
    );
    return available.length ? available : this.chain;
  }

  async json<T>(
    label: string,
    system: string,
    prompt: string,
    judge: (raw: unknown) => Verdict<T>,
    maxTokens = 1400
  ): Promise<CallOutcome<T>> {
    let attempts = 0;
    let providerErrors = 0;
    let reminder = '';
    let salvage: { run: () => T | null; model: string } | undefined;

    const order = this.order();

    for (const [index, model] of order.entries()) {
      // Le premier modèle a droit à un second essai sur le contenu ; les
      // suivants, à un seul. Trois essais au total, jamais davantage.
      const tries = index === 0 ? 2 : 1;

      for (let attempt = 0; attempt < tries && attempts < MAX_ATTEMPTS; attempt++) {
        if (this.signal.aborted) return { value: null, attempts, providerDown: false };
        attempts += 1;

        const controller = new AbortController();
        const abort = () => controller.abort();
        this.signal.addEventListener('abort', abort, { once: true });
        const timer = setTimeout(abort, CALL_TIMEOUT_MS);
        const started = Date.now();

        try {
          const { apiKey, apiUrl } = resolveModelCredentials(model);
          const result = await generateText({
            model: getOpenAIModel(apiUrl, apiKey, model),
            system,
            prompt: reminder ? `${prompt}\n\n${reminder}` : prompt,
            maxTokens,
            temperature: 0.7,
            maxRetries: 0,
            abortSignal: controller.signal,
          });

          this.promptTokens += result.usage?.promptTokens ?? 0;
          this.completionTokens += result.usage?.completionTokens ?? 0;
          reportUsage({
            model,
            mode: 'builder-site',
            promptTokens: result.usage?.promptTokens,
            completionTokens: result.usage?.completionTokens,
            finishReason: result.finishReason,
            userId: this.userId,
          });

          const verdict = judge(readJsonObject(result.text));
          if ('value' in verdict) {
            ChatLogger.info('SITE_SECTION', `${label} rédigée`, {
              model,
              attempts,
              ms: Date.now() - started,
            });
            return { value: verdict.value, model, attempts, providerDown: false };
          }

          ChatLogger.warn('SITE_SECTION', `${label} : réponse refusée`, {
            model,
            attempt: attempts,
            problem: verdict.problem.slice(0, 200),
            preview: result.text.slice(0, 160),
          });
          reminder = verdict.problem;
          if (verdict.salvage) salvage = { run: verdict.salvage, model };
        } catch (error) {
          if (this.signal.aborted) return { value: null, attempts, providerDown: false };
          providerErrors += 1;
          ChatLogger.warn('SITE_SECTION', `${label} : ${model} en échec`, {
            transient: isTransientModelError(error),
            message: error instanceof Error ? error.message.slice(0, 200) : String(error),
          });
          // Saturation, modèle retiré, délai dépassé : le suivant de la chaîne
          // pour cette section, et un échec de plus au compte de ce modèle.
          if (shouldTryNextModel(error) || controller.signal.aborted) {
            this.failures.set(model, (this.failures.get(model) ?? 0) + 1);
          }
          break;
        } finally {
          clearTimeout(timer);
          this.signal.removeEventListener('abort', abort);
        }
      }

      if (attempts >= MAX_ATTEMPTS) break;
    }

    // Essais épuisés sur une réponse presque bonne : on garde ce qui est
    // vérifié plutôt que de perdre la section entière.
    const recovered = salvage?.run() ?? null;
    if (recovered !== null) {
      ChatLogger.info('SITE_SECTION', `${label} récupérée (phrases non vérifiées retirées)`, {
        model: salvage!.model,
        attempts,
      });
      return { value: recovered, model: salvage!.model, attempts, providerDown: false, salvaged: true };
    }

    return { value: null, attempts, providerDown: attempts > 0 && providerErrors === attempts };
  }
}

/** Ce que l'on dit au modèle quand sa réponse affirme ce que les faits ne disent pas. */
function inventedReminder(problems: string[], language: string): string {
  const list = problems.map((problem) => `« ${problem} »`).join(', ');
  return `Votre réponse précédente contenait des éléments qui ne viennent pas des faits du projet${
    language === 'fr' ? ', ou qui ne sont pas en français' : ''
  } : ${list}. Réécrivez-la sans eux, sans les remplacer par d'autres affirmations (nombre, délai, horaire, lieu). Renvoyez UNIQUEMENT l’objet JSON demandé.`;
}

/** Le juge d'une section : la forme d'abord, puis les faits. */
function sectionJudge(
  section: PlannedSection,
  facts: SiteFacts,
  check: FactCheck,
  language: string
): (raw: unknown) => Verdict<Record<string, unknown>> {
  const validate = (raw: unknown) => validateSection(section.spec!, raw, section.links ?? {}, facts.offers);

  return (raw) => {
    const value = validate(raw);
    if (!value) return { problem: SHAPE_REMINDER };

    const invented = check(value);
    if (!invented.length) return { value };

    return {
      problem: inventedReminder(invented, language),
      salvage: () => {
        const stripped = validate(stripSentences(value, invented));
        return stripped && !check(stripped).length ? stripped : null;
      },
    };
  };
}

/* -------------------------------------------------------------------------- */
/*  Consignes                                                                  */
/* -------------------------------------------------------------------------- */

function systemPrompt(language: string): string {
  const fr = language === 'fr';
  return [
    "Tu rédiges le texte d'UNE section d'un site vitrine, sous la forme d'un objet JSON.",
    '',
    'Règles :',
    `- ${fr ? 'Tout le texte est en français, sans aucun mot anglais.' : 'Write every text value in English, even though these instructions are in French.'}`,
    '- Écris pour la clientèle de ce projet, avec ses mots. Chaque phrase est propre à ce projet : aucune ne pourrait servir telle quelle à une autre entreprise.',
    "- N'invente aucun chiffre, prix, délai, horaire, jour d'ouverture, quartier ou zone desservie, nom de client, avis, récompense, partenaire, garantie ni certification. Seuls les faits fournis peuvent être affirmés ; ce qu'ils ne disent pas, tu ne l'écris pas.",
    "- Le site n'a ni formulaire, ni compte client, ni paiement en ligne : n'en parle jamais comme s'ils existaient. On prend contact par les seuls moyens listés dans les faits.",
    "- Pas de tiret cadratin, pas d'emoji, pas de superlatif creux (« révolutionnaire », « innovant », « solution complète »).",
    '- Réponds UNIQUEMENT par l’objet JSON, sans bloc de code, sans phrase avant ou après.',
  ].join('\n');
}

function sectionPrompt(
  facts: SiteFacts,
  factsText: string,
  request: string,
  page: PlannedPage,
  section: PlannedSection,
  siblings: PlannedSection[],
  language: string
): string {
  const spec = SECTION_SPECS[section.spec!];
  const parts = [`# Le projet\n${factsText}`];

  const brief = request.trim().slice(0, 1200);
  if (brief && brief !== facts.description) {
    parts.push(`# Ce que l'utilisateur a demandé (contexte)\n${brief}`);
  }

  parts.push(
    `# Section à écrire\nPage : ${page.label}\nRôle : ${spec.purpose}\nTâche : ${section.angle ?? spec.purpose}`
  );

  const others = siblings
    .filter((other) => other !== section && other.angle)
    .map((other) => `- ${other.angle}`);
  if (others.length) {
    parts.push(`# Les autres sections de cette page (ne les répète pas)\n${others.join('\n')}`);
  }

  const buttons = Object.entries(section.links ?? {})
    .filter(([, href]) => !!href)
    .map(([slot, href]) => `- "${slot}" mène à ${describeDestination(href!, facts, language)}.`);
  if (buttons.length) {
    parts.push(`# Boutons (le libellé doit annoncer exactement cette destination)\n${buttons.join('\n')}`);
  }

  if (section.spec === 'Pricing') {
    parts.push(
      `# Les offres (noms et prix réels, dans cet ordre)\n${facts.offers
        .map((offer, index) => `${index + 1}. ${offer.name} · ${offer.price}${offer.notes ? ` · notes : ${offer.notes}` : ''}`)
        .join('\n')}`
    );
  }

  parts.push(`# Forme exacte de la réponse\n${spec.shape}`);
  return parts.join('\n\n');
}

/* -------------------------------------------------------------------------- */
/*  Sections écrites par le code                                               */
/* -------------------------------------------------------------------------- */

function codeSection(section: PlannedSection, facts: SiteFacts, language: string): Record<string, unknown> | null {
  const fr = language === 'fr';

  if (section.component === 'Team') {
    if (!facts.team.length) return null;
    return {
      title: fr ? `L'équipe derrière ${facts.name}` : `The team behind ${facts.name}`,
      items: facts.team.map((member) => ({
        name: member.name,
        role: member.role,
        ...(member.bio ? { bio: member.bio } : {}),
        ...(member.photo ? { photo: member.photo } : {}),
      })),
    };
  }

  if (section.component === 'Contact') {
    if (!facts.channels.length) return null;
    return {
      title: fr ? `Joindre ${facts.name}` : `Reach ${facts.name}`,
      description: fr
        ? 'Choisissez le moyen qui vous convient : nous vous répondons directement.'
        : 'Pick whichever channel suits you: we answer you directly.',
      channels: facts.channels,
    };
  }

  return null;
}

/** Le repli d'une section indispensable, quand aucun modèle n'a donné de réponse valable. */
function fallbackSection(
  section: PlannedSection,
  page: PlannedPage,
  facts: SiteFacts,
  language: string
): Record<string, unknown> | null {
  const w = wordsFor(language);
  const fr = language === 'fr';
  const firstSentence = (facts.description.match(/^[^.!?]+[.!?]?/)?.[0] ?? facts.description).trim();
  const button = (href?: string) =>
    href
      ? {
          label: href === w.paths.offers || href === '#tarifs' ? w.seeOffers : href === '#atouts' ? (fr ? 'Découvrir' : 'Discover') : w.contactCta,
          href,
        }
      : undefined;

  if (section.spec === 'Hero') {
    const primaryCta = button(section.links?.primaryCta);
    return {
      eyebrow: [facts.city, facts.country].filter(Boolean).join(', '),
      title: facts.name,
      description: firstSentence,
      ...(primaryCta ? { primaryCta } : {}),
    };
  }

  if (section.spec === 'Header') {
    return { eyebrow: facts.name, title: page.label, description: '' };
  }

  if (section.spec === 'Cta') {
    const primaryCta = button(section.links?.primaryCta);
    return {
      title: fr ? `Envie d'en savoir plus sur ${facts.name} ?` : `Want to know more about ${facts.name}?`,
      description: firstSentence,
      ...(primaryCta ? { primaryCta } : {}),
    };
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/*  Motif de la charte                                                         */
/* -------------------------------------------------------------------------- */

interface BrandPattern {
  svg: string;
  ground: string;
  tile: number;
}

/**
 * Un motif de la charte sur fond clair, déposé dans le projet.
 *
 * C'est le visuel du site quand il n'a pas de photo : un panneau du motif de
 * la marque, et non un rectangle vide — le défaut le plus visible d'une page
 * générée. Fond clair seulement : les sites restent sur des surfaces claires.
 */
async function resolveBrandPattern(projectData: ProjectModel): Promise<BrandPattern | null> {
  const branding = (projectData.analysisResultModel?.branding ?? {}) as Record<string, any>;
  const items: any[] = Array.isArray(branding.patterns?.items) ? branding.patterns.items : [];

  for (const item of items) {
    const ground = normalizeHex(item?.ground);
    if (!ground || !isLightSurface(ground) || typeof item?.url !== 'string') continue;

    const asset = await fetchBrandAsset(item.url).catch(() => null);
    const svg = asset?.text?.trim();
    if (!svg || !/^(<\?xml[\s\S]*?\?>\s*)?<svg[\s>]/i.test(svg)) continue;

    const tile = Math.min(320, Math.max(48, Number(item.tile) || 160));
    return { svg, ground, tile };
  }

  return null;
}

function brandPatternComponent(pattern: BrandPattern): string {
  return `/**
 * Le motif de la charte, en panneau. La tuile est déposée par IDEM dans
 * \`public/brand/pattern.svg\` : c'est celle que montre la charte graphique.
 */
export default function BrandPattern({ className = '' }) {
  return (
    <div
      aria-hidden="true"
      className={\`aspect-[4/3] w-full \${className}\`}
      style={{
        backgroundColor: '${pattern.ground}',
        backgroundImage: 'url(/brand/pattern.svg)',
        backgroundSize: '${pattern.tile}px ${pattern.tile}px',
      }}
    />
  );
}
`;
}

/* -------------------------------------------------------------------------- */
/*  Référencement                                                              */
/* -------------------------------------------------------------------------- */

const BUSINESS_TYPES = [
  'LocalBusiness',
  'Restaurant',
  'FoodEstablishment',
  'Store',
  'ProfessionalService',
  'HealthAndBeautyBusiness',
  'MedicalBusiness',
  'EducationalOrganization',
  'LodgingBusiness',
  'AutomotiveBusiness',
  'SportsActivityLocation',
  'TravelAgency',
  'Organization',
];

interface SeoPlan {
  title: string;
  description: string;
  keywords: string[];
  businessType: string;
  pages: Record<string, { title: string; description: string }>;
}

/** Coupe sur un mot entier, sans laisser de ponctuation pendante. */
function clip(value: string, max: number): string {
  if (value.length <= max) return value;
  const cut = value.slice(0, max + 1);
  const space = cut.lastIndexOf(' ');
  return cut.slice(0, space > max * 0.6 ? space : max).replace(/[\s,;:.·|-]+$/, '');
}

function readSeo(raw: unknown, plan: SitePlan): SeoPlan | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, any>;

  const title = clip(cleanText(data.title, 200), 62);
  const description = clip(cleanText(data.description, 400), 165);
  const keywords = (Array.isArray(data.keywords) ? data.keywords : [])
    .map((item: unknown) => cleanText(item, 60).toLowerCase())
    .filter(Boolean)
    .filter((item: string, index: number, all: string[]) => all.indexOf(item) === index)
    .slice(0, 10);

  if (title.length < 10 || description.length < 50 || keywords.length < 3) return null;

  const pages: SeoPlan['pages'] = {};
  for (const entry of Array.isArray(data.pages) ? data.pages : []) {
    const path = typeof entry?.path === 'string' ? entry.path.trim() : '';
    const page = plan.pages.find((item) => item.path === path || item.path === `${path.replace(/\/$/, '')}/`);
    const pageTitle = clip(cleanText(entry?.title, 200), 62);
    const pageDescription = clip(cleanText(entry?.description, 400), 165);
    if (page && pageTitle && pageDescription) pages[page.path] = { title: pageTitle, description: pageDescription };
  }

  return {
    title,
    description,
    keywords,
    businessType: BUSINESS_TYPES.includes(data.businessType) ? data.businessType : '',
    pages,
  };
}

function seoPrompt(factsText: string, plan: SitePlan, written: Map<string, Record<string, unknown>>): string {
  const pages = plan.pages.map((page) => {
    const head = written.get(page.sections[0]?.content) ?? {};
    const summary = [head.title, head.description].filter(Boolean).join(' : ');
    return `- ${page.path} (${page.label})${summary ? ` : ${summary}` : ''}`;
  });

  return `# Le projet
${factsText}

# Les pages du site
${pages.join('\n')}

# Tâche
Le référencement du site : ce que les moteurs de recherche affichent, et les mots que tapent les clients.

# Forme exacte de la réponse
{
  "title": "titre de l'accueil, 45 à 60 caractères : ce que propose le projet, et où",
  "description": "140 à 160 caractères : la phrase qui donne envie de cliquer dans une liste de résultats",
  "keywords": ["6 à 10 expressions que les clients tapent réellement, avec la ville si l'activité est locale"],
  "businessType": "un type parmi : ${BUSINESS_TYPES.join(', ')}",
  "pages": [ { "path": "l'adresse exacte d'une page intérieure ci-dessus", "title": "45 à 60 caractères", "description": "140 à 160 caractères" } ]
}`;
}

function fallbackSeo(facts: SiteFacts, plan: SitePlan, written: Map<string, Record<string, unknown>>): SeoPlan {
  const hero = written.get('home-hero') ?? {};
  const place = facts.city ? ` ${facts.city}` : '';
  const keywords = [facts.name, ...facts.offers.map((offer) => offer.name)]
    .map((item) => `${item}${place}`.toLowerCase())
    .filter((item, index, all) => all.indexOf(item) === index)
    .slice(0, 8);

  const pages: SeoPlan['pages'] = {};
  for (const page of plan.pages.slice(1)) {
    const head = written.get(page.sections[0]?.content) ?? {};
    pages[page.path] = {
      title: clip(`${page.label} | ${facts.name}`, 62),
      description: clip(String(head.description || head.title || facts.description || facts.name), 165),
    };
  }

  return {
    title: clip(hero.title ? `${facts.name} | ${hero.title}` : facts.name, 62),
    description: clip(String(hero.description || facts.description || facts.name), 165),
    keywords: keywords.length >= 3 ? keywords : [...keywords, facts.name.toLowerCase()].slice(0, 3),
    businessType: facts.city || facts.phone ? 'LocalBusiness' : 'Organization',
    pages,
  };
}

function renderSeoModule(facts: SiteFacts, seo: SeoPlan, system: DesignSystem, language: string): string {
  const business = {
    type: seo.businessType,
    city: facts.city,
    country: facts.country,
    phone: facts.phone,
    email: facts.email,
  };

  return `/**
 * Référencement du site. Ces valeurs partent dans le HTML de chaque page.
 */
const seo = {
  name: ${JSON.stringify(facts.name)},
  // Titre de la page d'accueil. Moins de 60 caractères.
  title: ${JSON.stringify(seo.title)},
  // Ce que montre un résultat de recherche. 150 à 160 caractères.
  description: ${JSON.stringify(seo.description)},
  language: ${JSON.stringify(language)},
  themeColor: ${JSON.stringify(system.colors.brand['600'])},
  // Adresse publique, renseignée à la mise en ligne.
  url: '',
  // Mots que vos clients tapent réellement.
  keywords: [${seo.keywords.map((keyword) => JSON.stringify(keyword)).join(', ')}],
  // Fiche d'établissement pour les moteurs de recherche.
  business: { ${Object.entries(business)
    .map(([key, value]) => `${key}: ${JSON.stringify(value ?? '')}`)
    .join(', ')} },
};

export default seo;
`.replace(/</g, '\\u003c');
}

/* -------------------------------------------------------------------------- */
/*  Écriture                                                                   */
/* -------------------------------------------------------------------------- */

/** Un module de contenu : des données, jamais de JSX. `<` échappé : aucune balise ne peut s'y glisser. */
function contentModule(label: string, data: Record<string, unknown>): string {
  return `// ${label}, rédigé par IDEM. Pour le changer, demandez-le dans la conversation.
export default ${JSON.stringify(data, null, 2).replace(/</g, '\\u003c')};
`;
}

class SiteStream {
  private keepalive?: NodeJS.Timeout;

  constructor(private readonly res: Response) {}

  open(model: string) {
    this.res.writeHead(200, {
      'content-type': 'text/plain; charset=utf-8',
      'x-vercel-ai-data-stream': 'v1',
      'x-idem-model': model,
    });
    this.keepalive = setInterval(() => {
      this.res.write(formatDataStreamPart('data', [{ type: 'progress' }]));
    }, KEEPALIVE_MS);
  }

  text(chunk: string) {
    this.res.write(formatDataStreamPart('text', chunk));
  }

  file(path: string, content: string) {
    this.text(`<boltAction type="file" filePath="${path}">\n${content}</boltAction>\n`);
  }

  command(type: 'shell' | 'start', command: string) {
    this.text(`<boltAction type="${type}">\n${command}\n</boltAction>\n`);
  }

  close(usage: { promptTokens: number; completionTokens: number }, error?: string) {
    if (this.keepalive) clearInterval(this.keepalive);
    if (error) this.res.write(formatDataStreamPart('error', error));
    this.res.write(formatDataStreamPart('finish_message', { finishReason: error ? 'error' : 'stop', usage }));
    this.res.end();
  }
}

/** Ce que le plan écrit dans `idem.plan.json` pour une section présente. */
function planEntry(section: PlannedSection, hasPattern: boolean) {
  return {
    component: section.component,
    content: section.content,
    ...(section.anchor ? { anchor: section.anchor } : {}),
    ...(section.variant ? { variant: section.variant } : {}),
    ...(section.visual && hasPattern
      ? { visual: { component: 'BrandPattern', import: '../sections/BrandPattern.jsx' } }
      : {}),
  };
}

/** Le nom d'une section tel qu'on le dirait, pour l'en-tête de son fichier de contenu. */
const SECTION_NOUNS: Record<string, [string, string]> = {
  Hero: ["l'ouverture", 'opening'],
  Features: ['les points forts', 'highlights'],
  Split: ['un argument développé', 'feature story'],
  Steps: ['les étapes', 'steps'],
  Pricing: ['les offres', 'offers'],
  Team: ["l'équipe", 'team'],
  Faq: ['les questions fréquentes', 'FAQ'],
  Contact: ['le contact', 'contact'],
  Cta: ["la relance", 'call to action'],
};

function contentLabel(page: PlannedPage, section: PlannedSection, language: string): string {
  const [fr, en] = SECTION_NOUNS[section.component] ?? [section.component, section.component];
  return language === 'fr' ? `${page.label} : ${fr}` : `${page.label}: ${en}`;
}

/* -------------------------------------------------------------------------- */
/*  Point d'entrée                                                             */
/* -------------------------------------------------------------------------- */

export function createSiteBuildStream(input: SiteBuildInput): ResilientStream {
  return {
    async pipeDataStreamToResponse(res: Response): Promise<void> {
      const startedAt = Date.now();
      const { projectData, request, model, userId } = input;
      const language = detectSiteLanguage(
        [request, projectData.description, (projectData as { longDescription?: string }).longDescription]
          .filter(Boolean)
          .join('\n'),
        input.language
      );

      const abort = new AbortController();
      res.on('close', () => {
        if (!res.writableEnded) abort.abort();
      });

      const system = forgeDesignSystem(projectData);
      const facts = readSiteFacts(projectData, language);
      const factsText = renderFacts(facts, language);
      const pattern = await resolveBrandPattern(projectData).catch(() => null);

      const plan = buildSitePlan(facts, {
        language,
        hasPattern: !!pattern,
        heroVariant: sectionDefaults(system.direction).hero,
        seed: seedOf(projectData.id || projectData.name || 'idem'),
      });

      ChatLogger.info('SITE_PLAN', 'Plan du site décidé par le code', {
        mode: plan.mode,
        pages: plan.pages.map((page) => `${page.path} (${page.sections.length})`),
        offers: facts.offers.length,
        team: facts.team.length,
        channels: facts.channels.length,
        pattern: !!pattern,
      });

      // La rédaction peut être confiée à un autre modèle du catalogue que celui
      // du code (`SITE_WRITER_MODEL`) : un modèle de code écrit un français
      // correct, pas toujours soigné. Sans la variable, le modèle choisi.
      const writer = process.env.SITE_WRITER_MODEL?.trim();
      const caller = new ModelCaller(
        writer && getFallbackModelKeys(writer).includes(writer) ? writer : model,
        userId,
        abort.signal
      );
      const systemText = systemPrompt(language);
      // Seules sources autorisées pour un nombre, un délai, un jour ou un lieu :
      // les faits du projet et la demande de l'utilisateur.
      const check = createFactGuard(`${factsText}\n${request}`, language);
      const written = new Map<string, Record<string, unknown>>();
      // Sections confiées au modèle et restées sans réponse valable.
      let missed = 0;

      const writeOne = async (page: PlannedPage, section: PlannedSection) => {
        if (!section.spec) {
          const data = codeSection(section, facts, language);
          if (data) written.set(section.content, data);
          return { section, page, data, providerDown: false };
        }

        const outcome = await caller.json(
          `${page.key}/${section.content}`,
          systemText,
          sectionPrompt(facts, factsText, request, page, section, page.sections, language),
          sectionJudge(section, facts, check, language),
          section.spec === 'Faq' ? 1800 : 1400
        );

        let data: Record<string, unknown> | null = outcome.value;
        if (!data) missed += 1;
        if (!data && section.essential) data = fallbackSection(section, page, facts, language);
        if (data && section.reversed) data = { ...data, reversed: true };
        // Sous l'en-tête d'une page qui dit déjà de quoi elle parle, un second
        // titre répéterait le premier (« Nos offres » sous « Nos offres »).
        if (data && section.untitled) {
          const { title: _title, intro: _intro, ...rest } = data;
          data = rest;
        }
        if (data) written.set(section.content, data);
        return { section, page, data, providerDown: outcome.providerDown && !outcome.value };
      };

      // L'accroche d'abord, avant d'écrire quoi que ce soit : si aucun modèle
      // ne répond, on peut encore renvoyer une vraie erreur (rien n'est parti,
      // aucun fichier n'est touché).
      const home = plan.pages[0];
      const heroResult = await writeOne(home, home.sections[0]);

      if (abort.signal.aborted) return;

      if (heroResult.providerDown) {
        const message =
          language === 'fr'
            ? "Le fournisseur IA est momentanément saturé. Aucun fichier n'a été modifié : relancez la génération dans quelques instants."
            : 'The AI provider is temporarily overloaded. No file was changed: please start the generation again in a moment.';
        ChatLogger.error('SITE_BUILD', 'Aucun modèle disponible pour la première section');
        if (!res.headersSent) res.status(503).send(message);
        return;
      }

      const stream = new SiteStream(res);
      stream.open(model);

      const fr = language === 'fr';
      stream.text(
        fr
          ? `Je rédige le site de ${facts.name}, section par section, avec les couleurs, les polices et le logo de sa charte.\n\n`
          : `I'm writing the ${facts.name} website section by section, with its brand colours, fonts and logo.\n\n`
      );
      stream.text(`<boltArtifact id="idem-site" title="${facts.name.replace(/["<>]/g, '')}">\n`);

      if (pattern) {
        stream.file('public/brand/pattern.svg', `${pattern.svg}\n`);
        stream.file('src/sections/BrandPattern.jsx', brandPatternComponent(pattern));
      }

      if (heroResult.data) {
        stream.file(`src/content/${home.sections[0].content}.js`, contentModule(contentLabel(home, home.sections[0], language), heroResult.data));
      }

      // Les autres sections, trois à la fois, écrites dès qu'elles sont prêtes.
      const queue = plan.pages.flatMap((page) =>
        page.sections.filter((section) => section !== home.sections[0]).map((section) => ({ page, section }))
      );

      let cursor = 0;
      const worker = async () => {
        while (cursor < queue.length && !abort.signal.aborted) {
          const { page, section } = queue[cursor++];
          const result = await writeOne(page, section);
          if (result.data && !abort.signal.aborted) {
            stream.file(`src/content/${section.content}.js`, contentModule(contentLabel(page, section, language), result.data));
          }
        }
      };
      await Promise.all(Array.from({ length: CONCURRENCY }, worker));

      if (abort.signal.aborted) return;

      // Navigation et pied de page : par le code, d'après les pages réellement
      // écrites. Un lien vers une page abandonnée serait un lien mort.
      const hero: Record<string, unknown> = written.get('home-hero') ?? {};
      stream.file(
        'src/content/nav.js',
        contentModule(fr ? 'Navigation' : 'Navigation', {
          links: plan.nav.links,
          ...(plan.nav.cta ? { cta: plan.nav.cta } : {}),
        })
      );

      // Le pied de page montre les coordonnées elles-mêmes, pas seulement
      // « Téléphone » ou « E-mail » : c'est là qu'on vient les chercher.
      const contactLinks = facts.channels
        .filter((channel) => channel.href)
        .map((channel) => ({
          label: channel.href!.startsWith('https://wa.me/') ? channel.label : channel.value,
          href: channel.href!,
        }));
      stream.file(
        'src/content/footer.js',
        contentModule(fr ? 'Pied de page' : 'Footer', {
          tagline: clip(String(hero.description || facts.description || ''), 180),
          columns: [
            { title: plan.mode === 'multi' ? 'Pages' : fr ? 'Sur cette page' : 'On this page', links: plan.footerLinks },
            ...(contactLinks.length ? [{ title: fr ? 'Contact' : 'Contact', links: contactLinks }] : []),
          ],
          legal: `© ${new Date().getFullYear()} ${facts.name}`,
        })
      );

      // Référencement : un appel court, avec un repli écrit par le code.
      const seoOutcome = await caller.json(
        'seo',
        systemText.replace("d'UNE section d'un site vitrine", "le référencement d'un site vitrine"),
        seoPrompt(factsText, plan, written),
        (raw): Verdict<SeoPlan> => {
          const value = readSeo(raw, plan);
          if (!value) return { problem: SHAPE_REMINDER };
          const invented = check(value);
          return invented.length ? { problem: inventedReminder(invented, language) } : { value };
        },
        900
      );
      const fallback = fallbackSeo(facts, plan, written);
      const seo = seoOutcome.value
        ? {
            ...seoOutcome.value,
            businessType: seoOutcome.value.businessType || fallback.businessType,
            pages: { ...fallback.pages, ...seoOutcome.value.pages },
          }
        : fallback;

      stream.file('src/seo.js', renderSeoModule(facts, seo, system, language));

      // Le plan en dernier : il ne cite que les sections réellement écrites.
      const pagesOut = plan.pages
        .map((page) => {
          const sections = page.sections.filter((section) => written.has(section.content));
          if (!sections.length) return null;
          const meta = page.path === '/' ? { title: seo.title, description: seo.description } : seo.pages[page.path];
          return {
            path: page.path,
            title: meta?.title ?? clip(`${page.label} | ${facts.name}`, 62),
            description: meta?.description ?? seo.description,
            sections: [
              { component: 'Nav', content: 'nav' },
              ...sections.map((section) => planEntry(section, !!pattern)),
              { component: 'Footer', content: 'footer' },
            ],
          };
        })
        .filter(Boolean);

      stream.file(
        'idem.plan.json',
        `${JSON.stringify({ origin: SITE_ORIGIN, mode: plan.mode, language, pages: pagesOut }, null, 2)}\n`
      );

      stream.command('shell', 'npm install');
      stream.command('start', 'npm run dev');
      stream.text('</boltArtifact>\n');

      // Ce qui manque se dit, en clair. Une section abandonnée n'apparaît pas
      // vide sur le site : elle n'y est pas, et la conversation l'explique.
      if (missed > 0) {
        stream.text(
          fr
            ? `\n${missed === 1 ? "Une section n'a pas pu être rédigée" : `${missed} sections n'ont pas pu être rédigées`} : le modèle n'a pas donné de réponse exploitable. Le site fonctionne sans elle${missed === 1 ? '' : 's'} ; demandez-la${missed === 1 ? '' : 's'} dans la conversation pour l${missed === 1 ? 'a' : 'es'} ajouter.\n`
            : `\n${missed === 1 ? 'One section' : `${missed} sections`} could not be written: the model gave no usable answer. The site works without ${missed === 1 ? 'it' : 'them'}; ask for ${missed === 1 ? 'it' : 'them'} in the conversation to add ${missed === 1 ? 'it' : 'them'}.\n`
        );
      }

      const planned = queue.length + 1;
      const done = written.size;
      ChatLogger.success('SITE_BUILD', 'Site rédigé', {
        sections: `${done}/${planned}`,
        pages: pagesOut.length,
        seo: seoOutcome.value ? 'modèle' : 'repli',
        promptTokens: caller.promptTokens,
        completionTokens: caller.completionTokens,
        seconds: Math.round((Date.now() - startedAt) / 1000),
      });

      stream.close({ promptTokens: caller.promptTokens, completionTokens: caller.completionTokens });
    },
  };
}

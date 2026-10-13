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
import { formatDataStreamPart } from 'ai';
import { ProjectModel } from '../types/project.js';
import { DesignSystem, forgeDesignSystem } from '../design/tokenForge.js';
import { sectionDefaults } from '../scaffold/sections.js';
import { isLightSurface, normalizeHex } from '../design/charter.js';
import { getFallbackModelKeys } from '../config/modelConfig.js';
import { ChatLogger } from '../utils/logger.js';
import { fetchBrandAsset } from '../utils/brandAsset.js';
import { ResilientStream } from '../utils/resilientStream.js';
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
import { cleanText, SECTION_SPECS, validateSection } from './sectionSpecs.js';
import { ModelCaller, SHAPE_REMINDER, Verdict } from './modelCaller.js';
import { createFactGuard, FactCheck, stripSentences } from './factGuard.js';
import { directLayout, normalizeLayout, styleFamily } from './layoutDirector.js';
import { architectSite } from './siteArchitect.js';
import { buildSectionKit, SITE_KIT_DEPENDENCIES } from '../scaffold/sections.js';
import { createApiMediaClient, MediaClient } from './media/mediaClient.js';
import { directMedia, mediaSlots } from './media/mediaDirector.js';
import { createLimiter, MediaAsset, produceMedia } from './media/mediaPipeline.js';

/** Version du contrat écrit dans `idem.plan.json` : le client s'en sert pour reconnaître ces sites. */
export const SITE_ORIGIN = 'idem-site';

/** Sections rédigées en même temps : assez pour aller vite, pas assez pour saturer un fournisseur. */
const CONCURRENCY = 4;
/** Un signe de vie régulier : certains relais coupent un flux muet. */
const KEEPALIVE_MS = 12_000;

export interface SiteBuildInput {
  projectData: ProjectModel;
  language: string;
  /** La demande telle qu'écrite (brief de l'atelier ou message de l'utilisateur). */
  request: string;
  model: string;
  userId: string | null;
  /** La session de l'utilisateur, relayée à l'API IDEM pour les médias (génération, stock, crédits). */
  credentials?: Record<string, string>;
  /** Un client de médias déjà construit (bancs d'essai) ; sinon celui de l'API IDEM. */
  mediaClient?: MediaClient;
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
  language: string,
  pages: PlannedPage[] = []
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
    .map(([slot, href]) => `- "${slot}" mène à ${describeDestination(href!, facts, language, pages)}.`);
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

/** La première phrase entière, si elle tient ; sinon une coupe propre. */
function firstSentence(value: string, max: number): string {
  const sentence = value.match(/^.+?[.!?](?=\s|$)/)?.[0] ?? value;
  return sentence.length <= max ? sentence.trim() : clip(sentence, max);
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

  /** Une ligne d'état dans la conversation, sans effet sur le projet. */
  note(text: string) {
    this.text(`<boltAction type="note">${text.replace(/[<>]/g, '')}</boltAction>\n`);
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
/**
 * Ce que le plan écrit dans `idem.plan.json` pour une section présente. La
 * disposition, le fond et le média vivent dans le module de contenu (des
 * données) : le plan ne dit que quoi, où, et sous quelle ancre.
 */
function planEntry(section: PlannedSection) {
  return {
    component: section.component,
    content: section.content,
    ...(section.anchor ? { anchor: section.anchor } : {}),
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

      const seed = seedOf(projectData.id || projectData.name || 'idem');
      // Le plan est conçu plus bas par l'architecte ; celui-ci, décidé par le
      // code, ne sert que si l'agent échoue.
      let plan: SitePlan = buildSitePlan(facts, {
        language,
        hasPattern: !!pattern,
        heroVariant: sectionDefaults(system.direction).hero,
        seed,
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
          sectionPrompt(facts, factsText, request, page, section, page.sections, language, plan.pages),
          sectionJudge(section, facts, check, language),
          section.spec === 'Faq' ? 1800 : 1400
        );

        let data: Record<string, unknown> | null = outcome.value;
        if (!data && !section.inserted) missed += 1;
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

      // La conversation s'ouvre tout de suite : la conception prend une
      // vingtaine de secondes, et l'utilisateur doit voir que ça travaille.
      const stream = new SiteStream(res);
      stream.open(model);

      const fr = language === 'fr';
      stream.text(
        fr
          ? `Je conçois le site de ${facts.name} : ses pages, puis chaque section, avec les couleurs, les polices et le logo de sa charte.\n\n`
          : `I'm designing the ${facts.name} website: its pages, then each section, with its brand colours, fonts and logo.\n\n`
      );
      stream.text(`<boltArtifact id="idem-site" title="${facts.name.replace(/["<>]/g, '')}">\n`);
      stream.note(fr ? 'Je conçois les pages du site et leur composition' : 'Designing the site pages and their layout');

      // L'architecte conçoit le site ; sans réponse exploitable, le plan de repli.
      const architected = await architectSite({
        facts,
        system,
        family: styleFamily(system),
        caller,
        language,
        request,
      });
      if (abort.signal.aborted) return;
      if (architected) plan = architected.plan;
      const navStyle = architected?.navStyle ?? 'bar';
      const footerStyle = architected?.footerStyle ?? 'columns';

      ChatLogger.info('SITE_PLAN', architected ? 'Plan conçu par l’architecte' : 'Plan de repli décidé par le code', {
        pages: plan.pages.map((page) => `${page.path} (${page.sections.length})`),
        offers: facts.offers.length,
        team: facts.team.length,
        channels: facts.channels.length,
        pattern: !!pattern,
      });
      stream.note(
        fr
          ? `Le site aura ${plan.pages.length} pages : ${plan.pages.map((page) => page.label).join(', ')}`
          : `The site will have ${plan.pages.length} pages: ${plan.pages.map((page) => page.label).join(', ')}`
      );

      // L'accroche d'abord : si aucun modèle ne répond, on s'arrête là. Les
      // dispositions de l'architecte sont vérifiées en même temps ; sans lui,
      // l'agent de mise en page les choisit.
      const home = plan.pages[0];
      const heroSection = home.sections[0];
      const [heroResult, layout] = await Promise.all([
        writeOne(home, heroSection),
        architected
          ? Promise.resolve({ family: normalizeLayout(plan, system, seed), fromAgent: true })
          : directLayout({ plan, facts, system, caller, seed, language }),
      ]);

      if (abort.signal.aborted) return;

      if (heroResult.providerDown) {
        ChatLogger.error('SITE_BUILD', 'Aucun modèle disponible pour la première section');
        stream.text('</boltArtifact>\n');
        stream.close(
          { promptTokens: caller.promptTokens, completionTokens: caller.completionTokens },
          fr
            ? "Le fournisseur IA est momentanément saturé. Aucun fichier du site n'a été écrit : relancez la génération dans quelques instants."
            : 'The AI provider is temporarily overloaded. No site file was written: please start the generation again in a moment.'
        );
        return;
      }

      // Le kit de sections, réécrit à chaque site : les dispositions choisies
      // doivent exister dans l'espace de travail, même ouvert avant elles.
      for (const [path, content] of Object.entries(buildSectionKit(sectionDefaults(system.direction)))) {
        stream.file(path, content);
      }
      if (pattern) stream.file('public/brand/pattern.svg', `${pattern.svg}\n`);

      // L'intensité des effets suit le style de la charte : apparitions
      // marquées et faisceau pour un style expressif, discrètes sinon.
      const fx = layout.family === 'expressive' ? 'lively' : 'calm';
      const texture = layout.family === 'structured' ? 'grid' : 'dots';
      stream.file(
        'src/sections/fx.js',
        `// Intensité des effets, réglée d'après le style de la charte (${layout.family}).\nexport const FX = '${fx}';\nexport const TEXTURE = '${texture}';\n`
      );

      // Les visuels : l'agent décide, le pipeline produit pendant que les
      // sections s'écrivent. Une section qui en attend un n'est émise qu'avec lui.
      const mediaEnabled = (process.env.SITE_MEDIA ?? 'on').toLowerCase() !== 'off';
      const client =
        input.mediaClient ??
        createApiMediaClient({ credentials: input.credentials ?? {}, projectId: projectData.id, signal: abort.signal });
      const slots = mediaEnabled ? mediaSlots(plan) : [];
      const mediaBySection = new Map<string, Promise<MediaAsset[]>>();

      if (slots.length) {
        stream.note(fr ? 'Je choisis les visuels de chaque section' : 'Choosing the visuals for each section');
        const decisions = await directMedia({
          slots,
          facts,
          system,
          family: layout.family,
          caller,
          language,
          hasPattern: !!pattern,
          maxGenerated: Number(process.env.SITE_MEDIA_MAX_GENERATED ?? 4),
          allowVideo: (process.env.SITE_MEDIA_VIDEO ?? 'on').toLowerCase() !== 'off',
        });
        const limit = createLimiter(2);
        const context = {
          client,
          caller,
          facts,
          system,
          language,
          pattern: pattern ? { src: '/brand/pattern.svg', ground: pattern.ground, tile: pattern.tile } : null,
          note: (text: string) => {
            if (!abort.signal.aborted) stream.note(text);
          },
          writeFile: (path: string, content: string) => {
            if (!abort.signal.aborted) stream.file(path, content);
          },
          limit,
        };
        for (const slot of slots) {
          const decision = decisions.find((item) => item.slot === slot.id);
          if (!decision) continue;
          mediaBySection.set(
            slot.id,
            produceMedia(slot, decision, context).catch((error) => {
              ChatLogger.warn('SITE_MEDIA', `${slot.id} : échec inattendu`, { message: (error as Error).message });
              return [];
            })
          );
        }
      }

      /** Le texte et le visuel d'une section réunis, puis écrits. */
      const emit = async (page: PlannedPage, section: PlannedSection, data: Record<string, unknown> | null) => {
        if (!data) return;
        const media = (await mediaBySection.get(section.content)) ?? [];
        if (abort.signal.aborted) return;

        const merged: Record<string, unknown> = { ...data };
        if (section.variant) merged.variant = section.variant;
        if (section.tone && section.tone !== 'plain') merged.tone = section.tone;
        if (section.component === 'Gallery') {
          if (media.length < 3) {
            written.delete(section.content);
            return;
          }
          merged.images = media.slice(0, 4);
        } else if (media.length) {
          merged.media = media[0];
        } else if (section.component === 'Showcase') {
          // Une vitrine sans image n'a rien à montrer.
          written.delete(section.content);
          return;
        }
        written.set(section.content, merged);
        stream.file(`src/content/${section.content}.js`, contentModule(contentLabel(page, section, language), merged));
      };

      // Les sections, trois à la fois pour le texte ; chacune part dès que son
      // texte et son visuel sont prêts.
      const writeLimit = createLimiter(CONCURRENCY);
      const emissions: Promise<void>[] = [emit(home, heroSection, heroResult.data)];
      for (const page of plan.pages) {
        for (const section of page.sections) {
          if (section === heroSection) continue;
          emissions.push(
            writeLimit(() => (abort.signal.aborted ? Promise.resolve(null) : writeOne(page, section).then((result) => result.data))).then(
              (data) => emit(page, section, data)
            )
          );
        }
      }
      await Promise.all(emissions);

      if (abort.signal.aborted) return;

      // Le bandeau défilant : rempli par le code, avec ce qui est déjà écrit
      // (les offres, sinon les points forts, sinon les étapes).
      for (const page of plan.pages) {
        for (const section of page.sections.filter((item) => item.component === 'Band')) {
          const titlesOf = (content: string) =>
            ((written.get(content)?.items as Array<{ title?: string }> | undefined) ?? [])
              .map((item) => item.title)
              .filter((title): title is string => !!title);
          const candidates = [
            facts.offers.map((offer) => offer.name),
            titlesOf('home-features'),
            titlesOf('home-steps'),
          ];
          const items = candidates.find((list) => list.length >= 3);
          if (!items) continue;
          const data = { items: items.slice(0, 8), ...(section.tone && section.tone !== 'plain' ? { tone: section.tone } : {}) };
          written.set(section.content, data);
          stream.file(`src/content/${section.content}.js`, contentModule(contentLabel(page, section, language), data));
        }
      }

      // Navigation et pied de page : par le code, d'après les pages réellement
      // écrites. Un lien vers une page abandonnée serait un lien mort.
      const hero: Record<string, unknown> = written.get('home-hero') ?? {};
      stream.file(
        'src/content/nav.js',
        contentModule(fr ? 'Navigation' : 'Navigation', {
          variant: navStyle,
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
          variant: footerStyle,
          name: facts.name,
          tagline: firstSentence(String(hero.description || facts.description || ''), 180),
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
              ...sections.map((section) => planEntry(section)),
              { component: 'Footer', content: 'footer' },
            ],
          };
        })
        .filter(Boolean);

      stream.file(
        'idem.plan.json',
        `${JSON.stringify(
          {
            origin: SITE_ORIGIN,
            mode: plan.mode,
            language,
            // Ce que le kit utilise réellement, pour qui reprendra le site.
            uses: ['motion', 'shadcn/ui (accordion, Radix)', 'magic-ui (marquee, border-beam, patterns)'],
            pages: pagesOut,
          },
          null,
          2
        )}\n`
      );

      // Nommées explicitement : un espace de travail ouvert avant que le kit ne
      // s'en serve a un package.json qui ne les connaît pas.
      stream.command('shell', `npm install ${Object.keys(SITE_KIT_DEPENDENCIES).join(' ')}`);
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

      const planned = plan.pages.reduce((total, page) => total + page.sections.length, 0);
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

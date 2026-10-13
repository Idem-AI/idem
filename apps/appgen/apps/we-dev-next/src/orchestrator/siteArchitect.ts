/**
 * L'agent architecte : il conçoit le site, pages et sections, pour CE projet.
 *
 * Le plan était décidé par le code : toujours Accueil, Offres, À propos,
 * Contact, et le même enchaînement de sections sur l'accueil. L'agent de mise
 * en page ne choisissait que des variantes à l'intérieur de ce gabarit — d'où
 * des sites qui avaient tous la même structure.
 *
 * L'architecte reçoit les faits du projet et tout l'outillage — les types de
 * section du kit et leurs dispositions, les fonds, les vitrines, galeries et
 * bandeaux, les styles de navigation et de pied de page — et dessine
 * l'arborescence comme le ferait un concepteur : un restaurant a un Menu et
 * des Événements, une blanchisserie ses Services et ses Zones. Le code ne fait
 * que vérifier et réparer : une section qui exige des faits absents est
 * retirée, chaque page commence par son ouverture et finit par une relance,
 * les liens des boutons sont posés par lui. Si l'agent échoue, l'ancien plan
 * reste le filet.
 */

import { DesignSystem } from '../design/tokenForge.js';
import { ChatLogger } from '../utils/logger.js';
import { menuFor, StyleFamily } from './layoutDirector.js';
import { ModelCaller, SHAPE_REMINDER, Verdict } from './modelCaller.js';
import { cleanText, SpecName } from './sectionSpecs.js';
import { SiteFacts } from './siteFacts.js';
import { KitComponent, NavLink, PlannedPage, PlannedSection, SitePlan, wordsFor } from './sitePlan.js';
import { CtaLinks } from './sectionSpecs.js';

/** Ce que l'architecte peut poser, et ce que chaque type de section raconte. */
const SECTION_MENU: Record<string, { use: string; needs?: 'offers' | 'team' | 'channels' }> = {
  Hero: { use: "ouverture de l'accueil : la promesse, l'action principale" },
  Header: { use: "ouverture d'une page intérieure : de quoi parle la page" },
  Features: { use: 'des points forts, services ou caractéristiques, chacun expliqué' },
  Split: { use: 'un sujet développé à fond, avec son visuel (un service, une méthode, un lieu, une histoire)' },
  Steps: { use: 'un déroulé, du premier contact au résultat' },
  Pricing: { use: 'les offres avec leurs prix RÉELS', needs: 'offers' },
  Team: { use: "l'équipe réelle", needs: 'team' },
  Faq: { use: 'les questions avant de se décider' },
  Contact: { use: 'les moyens de contact réels', needs: 'channels' },
  Showcase: { use: 'un grand visuel commenté (photo ou vidéo)' },
  Statement: { use: 'une phrase forte en très grand' },
  Gallery: { use: 'trois ou quatre photos de ce que fait le projet' },
  Band: { use: 'un bandeau qui fait défiler les offres ou les points forts' },
  Cta: { use: "la relance de fin de page" },
};

const NAV_STYLES = ['bar', 'centered', 'split'] as const;
const FOOTER_STYLES = ['columns', 'statement'] as const;

/** Les dossiers que le site ne peut pas prendre pour adresse. */
const RESERVED = new Set(['src', 'public', 'assets', 'dist', 'scripts', 'node_modules', 'media', 'brand', 'index']);

const MAX_PAGES = 7;
const MAX_SECTIONS = 10;

export interface ArchitectedSite {
  plan: SitePlan;
  navStyle: (typeof NAV_STYLES)[number];
  footerStyle: (typeof FOOTER_STYLES)[number];
}

/** Une adresse propre : minuscules, sans accents, tirets. */
function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30)
    .replace(/-+$/, '');
}

function available(facts: SiteFacts): Record<'offers' | 'team' | 'channels', boolean> {
  return { offers: facts.offers.length > 0, team: facts.team.length > 0, channels: facts.channels.length > 0 };
}

function prompt(facts: SiteFacts, system: DesignSystem, family: StyleFamily, language: string, request: string): string {
  const has = available(facts);
  const place = [facts.city, facts.country].filter(Boolean).join(', ');
  const menu = Object.entries(SECTION_MENU)
    .filter(([, entry]) => !entry.needs || has[entry.needs])
    .map(([type, entry]) => {
      const variants = menuFor(type === 'Header' ? 'Hero' : type, family);
      return `- ${type} : ${entry.use}${variants.length ? ` · dispositions : ${variants.join(', ')}` : ''}`;
    })
    .join('\n');

  return `# Le projet
${facts.name} : ${facts.description}
${facts.story ? `Histoire : ${facts.story.slice(0, 600)}\n` : ''}${facts.audience ? `Clientèle : ${facts.audience}\n` : ''}${place ? `Lieu : ${place}\n` : ''}${
    facts.offers.length ? `Offres (prix réels) : ${facts.offers.map((offer) => `${offer.name} (${offer.price})`).join(', ')}\n` : 'Aucune offre chiffrée connue.\n'
  }${facts.team.length ? `Équipe : ${facts.team.map((member) => `${member.name}, ${member.role}`).join(' ; ')}\n` : ''}${
    facts.channels.length ? `Contact : ${facts.channels.map((channel) => channel.label).join(', ')}\n` : ''
  }${facts.background ? `Contexte : ${facts.background.slice(0, 700)}\n` : ''}${request.trim() ? `\nCe que l'utilisateur a demandé : ${request.trim().slice(0, 900)}\n` : ''}
# La charte
Style : ${system.direction.name}. Rythme : ${system.direction.cadence}. Signature : ${system.direction.signature}.

# Les outils : les sections que tu peux poser
${menu}

Fonds possibles pour chaque section : "plain", "tinted" (teinté de la marque), "raised" (en relief). Tous clairs.
Navigation : "bar" (barre classique), "centered" (logo au centre, liens dessous), "split" (liens à gauche, logo au centre, action à droite).
Pied de page : "columns" (colonnes de liens), "statement" (le nom en très grand, puis les liens).

# Ta tâche
Conçois le site vitrine COMPLET de ce projet, comme un concepteur qui le connaît : ses pages, et pour chaque page ses sections, dans l'ordre.

- 4 à 7 pages. L'accueil, puis des pages propres à CE métier, nommées avec les mots de sa propre clientèle : demande-toi ce qu'un client de ce projet vient chercher, et fais-en des pages. Aucune structure toute faite, aucun nom de page générique recopié d'un autre site : deux projets différents n'ont pas les mêmes pages.
- L'accueil : 6 à 10 sections. Chaque page intérieure : 3 à 7 sections, avec une vraie matière (pas une page d'une seule section).
- L'accueil commence par Hero ; chaque autre page par Header. Chaque page finit par Cta, sauf la page de contact qui peut finir par Contact.
- Pour chaque section : son type, sa disposition (dans SA liste), son fond, et un "brief" : ce que la section dit précisément, différent de toutes les autres sections du site.
- Varie : pas deux sections de même type à la suite, pas deux fonds teintés à la suite, des dispositions différentes d'une page à l'autre. Une page a un rythme : un moment ample, des moments denses, des respirations.
- N'invente rien : les prix, l'équipe et les coordonnées viennent des faits ci-dessus. Ne crée AUCUNE page qui exigerait des faits absents : zones ou quartiers desservis, horaires, références clients, témoignages, chiffres, partenaires. Une page doit pouvoir être remplie avec ce que tu sais.
- Une même section ne revient pas de page en page : la FAQ sur une ou deux pages au plus ; les tarifs, le bandeau, la phrase forte et le contact une seule fois sur tout le site (les tarifs sur la page où le client choisit).

# Forme exacte de la réponse
{
  "navigation": "bar|centered|split",
  "footer": "columns|statement",
  "pages": [
    {
      "slug": "adresse-courte (vide pour l'accueil)",
      "label": "nom dans le menu (1 à 3 mots)",
      "sections": [ { "type": "Hero", "variant": "...", "tone": "plain|tinted|raised", "brief": "..." } ]
    }
  ]
}

Écris les labels et les briefs ${language === 'fr' ? 'en français' : 'in English'}.`;
}

interface RawSection {
  type?: unknown;
  variant?: unknown;
  tone?: unknown;
  brief?: unknown;
}

interface RawPage {
  slug?: unknown;
  label?: unknown;
  sections?: RawSection[];
}

interface Answer {
  navigation?: unknown;
  footer?: unknown;
  pages: RawPage[];
}

function readAnswer(raw: unknown): Answer | null {
  const data = raw as Answer | null;
  if (!data || !Array.isArray(data.pages) || data.pages.length < 3) return null;
  const sections = data.pages.reduce((total, page) => total + (Array.isArray(page?.sections) ? page.sections.length : 0), 0);
  return sections >= 12 ? data : null;
}

const TYPE_TO_COMPONENT: Record<string, { component: KitComponent; spec?: SpecName }> = {
  Hero: { component: 'Hero', spec: 'Hero' },
  Header: { component: 'Hero', spec: 'Header' },
  Features: { component: 'Features', spec: 'Features' },
  Split: { component: 'Split', spec: 'Split' },
  Steps: { component: 'Steps', spec: 'Steps' },
  Pricing: { component: 'Pricing', spec: 'Pricing' },
  Team: { component: 'Team' },
  Faq: { component: 'Faq', spec: 'Faq' },
  Contact: { component: 'Contact' },
  Showcase: { component: 'Showcase', spec: 'Showcase' },
  Statement: { component: 'Statement', spec: 'Statement' },
  Gallery: { component: 'Gallery', spec: 'Gallery' },
  Band: { component: 'Band' },
  Cta: { component: 'Cta', spec: 'Cta' },
};

/** Transforme la réponse en plan, en réparant ce qui enfreint les règles. */
function toPlan(answer: Answer, facts: SiteFacts, language: string): ArchitectedSite | null {
  const w = wordsFor(language);
  const has = available(facts);
  const used = new Set<string>();
  const pages: PlannedPage[] = [];
  const siteCounts = new Map<string, number>();
  const rawPages = answer.pages.slice(0, MAX_PAGES);

  // Les sections uniques du site vont sur la page qui leur ressemble : les
  // tarifs sur une page menu, carte ou tarifs plutôt que sur l'accueil ; le
  // contact sur la page Contact quand il y en a une.
  const nameOf = (page: RawPage) => slugify(`${String(page?.slug ?? '')} ${String(page?.label ?? '')}`);
  const holders = (type: string) =>
    rawPages.map((page, index) => ((page?.sections ?? []).some((section) => section?.type === type) ? index : -1)).filter((index) => index >= 0);
  const hostOf = (type: string, pattern: RegExp, claim: boolean): number => {
    const named = rawPages.findIndex((page, index) => index > 0 && pattern.test(nameOf(page)));
    if (claim && named > 0) return named;
    const found = holders(type);
    return found.find((index) => index > 0 && pattern.test(nameOf(rawPages[index]))) ?? found.find((index) => index > 0) ?? found[0] ?? -1;
  };
  const pricingHost = hostOf('Pricing', /tarif|prix|menu|carte|offre|formule|price|plan/, false);
  const contactHost = has.channels ? hostOf('Contact', /contact|joindre|ecrire/, true) : -1;

  for (const [pageIndex, raw] of rawPages.entries()) {
    const home = pageIndex === 0;
    let slug = home ? '' : slugify(typeof raw?.slug === 'string' && raw.slug ? raw.slug : String(raw?.label ?? ''));
    if (!home) {
      if (!slug || RESERVED.has(slug)) slug = `${slug || 'page'}-${pageIndex}`;
      while (used.has(slug)) slug = `${slug}-${pageIndex}`;
      used.add(slug);
    }
    const key = home ? 'home' : slug;
    const label = cleanText(raw?.label, 28) || (home ? w.home : slug.replace(/-/g, ' '));

    const sections: PlannedSection[] = [];
    const counts = new Map<string, number>();
    for (const item of (Array.isArray(raw?.sections) ? raw.sections : []).slice(0, MAX_SECTIONS)) {
      let type = typeof item?.type === 'string' ? item.type.trim() : '';
      if (type === 'Hero' && !home) type = 'Header';
      if (type === 'Header' && home) type = 'Hero';
      const entry = SECTION_MENU[type];
      const target = TYPE_TO_COMPONENT[type];
      if (!entry || !target) continue;
      if (entry.needs && !has[entry.needs]) continue;
      // Une seule ouverture par page ; une seule fois par page les sections
      // de faits et les ornements ; certaines une seule fois sur tout le site.
      if ((type === 'Hero' || type === 'Header') && sections.length) continue;
      if (['Pricing', 'Team', 'Contact', 'Band', 'Statement', 'Gallery', 'Faq', 'Steps', 'Showcase'].includes(type) && counts.get(type)) continue;
      if (type === 'Pricing' && pageIndex !== pricingHost) continue;
      if (type === 'Contact' && pageIndex !== contactHost) continue;
      if (['Band', 'Statement', 'Contact', 'Pricing'].includes(type) && siteCounts.get(type)) continue;
      if (type === 'Faq' && (siteCounts.get('Faq') ?? 0) >= 2) continue;
      if (type === 'Gallery' && (siteCounts.get('Gallery') ?? 0) >= 2) continue;
      siteCounts.set(type, (siteCounts.get(type) ?? 0) + 1);

      const count = (counts.get(type) ?? 0) + 1;
      counts.set(type, count);
      const brief = cleanText(item?.brief, 320);
      const tone = item?.tone === 'tinted' || item?.tone === 'raised' ? item.tone : 'plain';

      sections.push({
        content: `${key}-${type.toLowerCase()}${count > 1 ? `-${count}` : ''}`,
        component: target.component,
        spec: target.spec,
        angle: brief || entry.use,
        variant: typeof item?.variant === 'string' ? item.variant : undefined,
        tone,
        anchor: type === 'Pricing' ? 'tarifs' : type === 'Contact' ? 'contact' : type === 'Faq' ? 'questions' : undefined,
        essential: type === 'Hero' || type === 'Header' || type === 'Cta',
        // Deux arguments de suite sur une page : le second inverse ses colonnes.
        reversed: type === 'Split' && count % 2 === 0,
      });
    }

    // L'ouverture d'abord, toujours.
    if (!sections.length || (sections[0].component !== 'Hero')) {
      sections.unshift({
        content: `${key}-${home ? 'hero' : 'header'}`,
        component: 'Hero',
        spec: home ? 'Hero' : 'Header',
        angle: home ? `La promesse de ${facts.name}.` : `La page « ${label} » de ${facts.name}.`,
        tone: 'plain',
        essential: true,
      });
    }
    // La page Contact sans section Contact (l'architecte l'a mise ailleurs) : on l'y pose.
    if (pageIndex === contactHost && !sections.some((section) => section.component === 'Contact')) {
      sections.splice(1, 0, { content: `${key}-contact`, component: 'Contact', anchor: 'contact', tone: 'plain' });
    }
    // Un tarif juste sous l'en-tête ne répète pas son titre.
    if (sections[1]?.component === 'Pricing' && !home) sections[1].untitled = true;

    pages.push({ key, path: home ? '/' : `/${slug}/`, label, sections });
  }

  // Les faits doivent apparaître : des offres, une équipe ou des coordonnées
  // connues qui ne seraient sur aucune page.
  const anywhere = (component: KitComponent) => pages.some((page) => page.sections.some((section) => section.component === component));
  const insertBeforeEnd = (page: PlannedPage, section: PlannedSection) => {
    const last = page.sections[page.sections.length - 1];
    const index = last && (last.component === 'Cta' || last.component === 'Contact') ? page.sections.length - 1 : page.sections.length;
    page.sections.splice(index, 0, section);
  };
  if (has.offers && !anywhere('Pricing')) {
    insertBeforeEnd(pages[0], { content: 'home-pricing', component: 'Pricing', spec: 'Pricing', anchor: 'tarifs', angle: 'Les offres et leurs prix réels.' });
  }
  if (has.team && !anywhere('Team')) {
    const about = pages.find((page) => /propos|equipe|team|about|histoire|atelier|nous/.test(page.key)) ?? pages[pages.length - 1];
    insertBeforeEnd(about, { content: `${about.key}-team`, component: 'Team', anchor: 'equipe' });
  }
  if (has.channels && !anywhere('Contact')) {
    pages.push({
      key: 'contact',
      path: '/contact/',
      label: w.contact,
      sections: [
        { content: 'contact-header', component: 'Hero', spec: 'Header', angle: `Comment joindre ${facts.name}.`, tone: 'plain', essential: true },
        { content: 'contact-contact', component: 'Contact', anchor: 'contact' },
      ],
    });
  }

  // Chaque page finit par une relance (ou par le contact).
  for (const page of pages) {
    const last = page.sections[page.sections.length - 1];
    if (last.component !== 'Cta' && last.component !== 'Contact') {
      page.sections.push({
        content: `${page.key}-cta-end`,
        component: 'Cta',
        spec: 'Cta',
        angle: `Inviter à passer à l'action depuis la page « ${page.label} ».`,
        tone: 'plain',
        essential: true,
      });
    }
  }

  if (pages.length < 3) return null;

  const navStyle = NAV_STYLES.includes(answer.navigation as never) ? (answer.navigation as ArchitectedSite['navStyle']) : 'bar';
  const footerStyle = FOOTER_STYLES.includes(answer.footer as never) ? (answer.footer as ArchitectedSite['footerStyle']) : 'columns';

  return { plan: wireSite(pages, facts, language), navStyle, footerStyle };
}

/**
 * Les liens d'un site quelconque : où mènent les boutons, la navigation et le
 * pied de page. Le modèle n'écrit jamais une adresse.
 */
export function wireSite(pages: PlannedPage[], facts: SiteFacts, language: string): SitePlan {
  const w = wordsFor(language);
  // Une page intérieure dédiée plutôt que l'accueil, quand il y en a une.
  const pageWith = (component: KitComponent) => {
    const holders = pages.filter((page) => page.sections.some((section) => section.component === component));
    return holders.find((page) => page.path !== '/') ?? holders[0];
  };

  const contactPage = pageWith('Contact');
  const offersPage = pageWith('Pricing');
  const direct =
    facts.channels.find((channel) => channel.href?.startsWith('https://wa.me/'))?.href ??
    facts.channels.find((channel) => channel.href?.startsWith('tel:'))?.href ??
    facts.channels.find((channel) => channel.href?.startsWith('mailto:'))?.href;

  const hrefOf = (page: PlannedPage | undefined, anchor: string) =>
    page ? (page.path === '/' ? `/#${anchor}` : page.path) : undefined;
  const contact = hrefOf(contactPage, 'contact') ?? direct;
  const offers = hrefOf(offersPage, 'tarifs');

  for (const page of pages) {
    const here = (href?: string) => !!href && (href === page.path || (page.path === '/' && href.startsWith('/#')));
    const other = (href?: string) => (href && !here(href) ? href : undefined);
    const nextPage = pages.find((candidate) => candidate !== page && candidate.path !== '/')?.path;

    for (const section of page.sections) {
      let links: CtaLinks = {};
      if (section.spec === 'Hero') {
        const primary = other(contact) ?? other(offers) ?? nextPage;
        const secondary = [other(offers), nextPage].find((href) => href && href !== primary);
        links = { ...(primary ? { primaryCta: primary } : {}), ...(secondary ? { secondaryCta: secondary } : {}) };
      } else if (section.component === 'Cta') {
        const primary = other(contact) ?? other(offers) ?? (page.path !== '/' ? '/' : nextPage);
        const secondary = other(offers) && other(offers) !== primary ? other(offers) : undefined;
        links = { ...(primary ? { primaryCta: primary } : {}), ...(secondary ? { secondaryCta: secondary } : {}) };
      } else if (section.component === 'Pricing' && contact) {
        links = { cta: other(contact) ?? contact };
      }
      section.links = links;
    }
  }

  const inner = pages.filter((page) => page.path !== '/');
  const navLinks: NavLink[] = [
    { label: w.home, href: '/' },
    ...inner.filter((page) => page !== contactPage).slice(0, 5).map((page) => ({ label: page.label, href: page.path })),
  ];
  const navCta: NavLink | undefined = contactPage
    ? { label: w.contactCta, href: hrefOf(contactPage, 'contact')! }
    : offersPage
      ? { label: w.seeOffers, href: hrefOf(offersPage, 'tarifs')! }
      : undefined;

  return {
    mode: 'multi',
    pages,
    nav: { links: navLinks, cta: navCta },
    footerLinks: pages.map((page) => ({ label: page.label, href: page.path })),
  };
}

/** Conçoit le site. `null` si l'agent ne rend rien d'exploitable : l'ancien plan prend le relais. */
export async function architectSite(options: {
  facts: SiteFacts;
  system: DesignSystem;
  family: StyleFamily;
  caller: ModelCaller;
  language: string;
  request: string;
}): Promise<ArchitectedSite | null> {
  const { facts, system, family, caller, language, request } = options;
  try {
    const outcome = await caller.json(
      'architect',
      "Tu es concepteur de sites vitrines. Tu dessines l'arborescence et la composition de chaque page avec les outils fournis. Réponds UNIQUEMENT par l'objet JSON demandé.",
      prompt(facts, system, family, language, request),
      (raw): Verdict<ArchitectedSite> => {
        const answer = readAnswer(raw);
        if (!answer) {
          return {
            problem: `${SHAPE_REMINDER} Il faut au moins 4 pages et des pages remplies (au moins 3 sections chacune).`,
          };
        }
        const site = toPlan(answer, facts, language);
        return site ? { value: site } : { problem: SHAPE_REMINDER };
      },
      4000
    );
    if (outcome.value) {
      ChatLogger.info('SITE_ARCHITECT', 'Site conçu par l’agent', {
        nav: outcome.value.navStyle,
        footer: outcome.value.footerStyle,
        pages: outcome.value.plan.pages.map((page) => `${page.path} ${page.label} (${page.sections.map((section) => section.spec === 'Header' ? 'Header' : section.component).join(' ')})`),
      });
    }
    return outcome.value;
  } catch (error) {
    ChatLogger.warn('SITE_ARCHITECT', 'Architecte indisponible, plan de repli', {
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

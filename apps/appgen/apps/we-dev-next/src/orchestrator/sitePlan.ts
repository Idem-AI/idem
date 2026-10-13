/**
 * Le plan d'un site vitrine, décidé par le code à partir des faits du projet.
 *
 * Confier le plan au modèle donnait deux échecs réguliers : un plan imprimé
 * dans la conversation au lieu d'être écrit, et des sites à quatre sections
 * dont la moitié sans contenu. Or la structure d'un site vitrine se déduit de
 * ce que l'on sait du projet :
 *
 *   - des offres avec des prix → une page (ou une section) Tarifs ;
 *   - une équipe, une histoire → une page À propos ;
 *   - un téléphone, un e-mail, une adresse → une page Contact.
 *
 * Deux de ces pages justifiées, et le site devient multi-pages ; sinon, une
 * page unique avec une navigation par ancres. La longueur ne dépend donc plus
 * de l'humeur du modèle : elle dépend de ce que le projet a à dire.
 *
 * Chaque section porte ici sa tâche (ce qu'elle doit développer), son ancre, et
 * la destination de ses boutons. Le modèle n'aura plus qu'à écrire des mots.
 */

import { SiteFacts } from './siteFacts.js';
import { CtaLinks, SpecName } from './sectionSpecs.js';

export type KitComponent =
  | 'Nav'
  | 'Hero'
  | 'Features'
  | 'Split'
  | 'Steps'
  | 'Pricing'
  | 'Team'
  | 'Faq'
  | 'Contact'
  | 'Cta'
  | 'Showcase'
  | 'Statement'
  | 'Gallery'
  | 'Band'
  | 'Footer';

export interface PlannedSection {
  /** Nom du module de contenu (`src/content/<content>.js`), unique sur le site. */
  content: string;
  component: KitComponent;
  /** Rédigée par un modèle selon cette spécification ; absente = écrite par le code. */
  spec?: SpecName;
  /** Ce que la section doit développer, dit au modèle. */
  angle?: string;
  /** `id` de la section, cible de la navigation interne. */
  anchor?: string;
  variant?: string;
  /** Reçoit le motif de la charte comme visuel. */
  visual?: boolean;
  reversed?: boolean;
  /** Destination de chaque bouton, posée par le code. */
  links?: CtaLinks;
  /** Sans elle la page n'a pas de sens : repli écrit par le code si le modèle échoue. */
  essential?: boolean;
  /** Affichée sans titre : l'en-tête de la page juste au-dessus dit déjà de quoi elle parle. */
  untitled?: boolean;
  /** Fond de la section, choisi par l'agent de mise en page (toujours clair). */
  tone?: 'plain' | 'tinted' | 'raised';
  /** Ajoutée par l'agent de mise en page (vitrine, phrase forte, galerie). */
  inserted?: boolean;
}

/** `home`, ou l'adresse d'une page intérieure (`menu`, `nos-services`…). */
export type PageKey = string;

export interface PlannedPage {
  key: PageKey;
  /** Adresse publique, barre finale comprise (`/offres/`) : sans elle, le serveur de dev renvoie l'accueil. */
  path: string;
  label: string;
  sections: PlannedSection[];
}

export interface NavLink {
  label: string;
  href: string;
}

export interface SitePlan {
  mode: 'single' | 'multi';
  pages: PlannedPage[];
  nav: { links: NavLink[]; cta?: NavLink };
  footerLinks: NavLink[];
}

export interface PlanOptions {
  language: string;
  /** Un motif de la charte est disponible comme visuel. */
  hasPattern: boolean;
  /** Variante de hero décidée par la direction artistique. */
  heroVariant: 'split' | 'centered' | 'editorial';
  /** Graine stable du projet : deux projets n'ont pas la même page d'accueil. */
  seed: number;
}

const WORDS = {
  fr: {
    home: 'Accueil',
    offers: 'Offres',
    about: 'À propos',
    contact: 'Contact',
    contactCta: 'Nous contacter',
    seeOffers: 'Voir les offres',
    features: 'Atouts',
    steps: 'Comment ça marche',
    pricing: 'Tarifs',
    team: 'Équipe',
    faq: 'Questions',
    paths: { offers: '/offres/', about: '/a-propos/', contact: '/contact/' },
  },
  en: {
    home: 'Home',
    offers: 'Offers',
    about: 'About',
    contact: 'Contact',
    contactCta: 'Contact us',
    seeOffers: 'See the offers',
    features: 'Highlights',
    steps: 'How it works',
    pricing: 'Pricing',
    team: 'Team',
    faq: 'FAQ',
    paths: { offers: '/offers/', about: '/about/', contact: '/contact/' },
  },
};

export const wordsFor = (language: string) => (language === 'fr' ? WORDS.fr : WORDS.en);

/** Graine stable tirée d'un texte (l'identifiant du projet). */
export function seedOf(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function buildSitePlan(facts: SiteFacts, options: PlanOptions): SitePlan {
  const w = wordsFor(options.language);
  const name = facts.name;

  const hasOffers = facts.offers.length > 0;
  const hasTeam = facts.team.length > 0;
  const hasContact = facts.channels.length > 0;
  const hasStory = hasTeam || facts.story.length >= 200;

  // Deux pages intérieures justifiées par les faits : le site a de quoi les
  // remplir, il devient multi-pages.
  const justified = [hasOffers, hasStory, hasContact].filter(Boolean).length;
  const mode: SitePlan['mode'] = justified >= 2 ? 'multi' : 'single';
  const multi = mode === 'multi';

  const pages = {
    offers: multi && hasOffers,
    about: multi && hasStory,
    contact: multi && hasContact,
  };

  // Où mènent les boutons. Un lien direct (téléphone, e-mail) quand le site n'a
  // ni page ni section Contact : un bouton doit toujours aboutir quelque part.
  const directContact =
    facts.channels.find((channel) => channel.href?.startsWith('https://wa.me/'))?.href ??
    facts.channels.find((channel) => channel.href?.startsWith('tel:'))?.href ??
    facts.channels.find((channel) => channel.href?.startsWith('mailto:'))?.href;

  const to = {
    contact: pages.contact ? w.paths.contact : hasContact ? '#contact' : directContact,
    offers: pages.offers ? w.paths.offers : hasOffers ? '#tarifs' : undefined,
    about: pages.about ? w.paths.about : undefined,
    features: '#atouts',
  };

  const heroSecondary = to.contact ? to.offers ?? to.about ?? (multi ? undefined : to.features) : undefined;
  const heroLinks: CtaLinks = {
    primaryCta: to.contact ?? to.offers ?? to.features,
    ...(heroSecondary ? { secondaryCta: heroSecondary } : {}),
  };

  const ctaLinks = (except?: string): CtaLinks => {
    const primary = to.contact ?? to.offers;
    if (!primary || primary === except) return {};
    const secondary = primary === to.contact && to.offers && to.offers !== except ? to.offers : undefined;
    return { primaryCta: primary, ...(secondary ? { secondaryCta: secondary } : {}) };
  };

  const heroVisual = options.hasPattern && options.heroVariant !== 'centered';

  /* ----------------------------- Accueil ----------------------------- */

  const hero: PlannedSection = {
    content: 'home-hero',
    component: 'Hero',
    spec: 'Hero',
    angle: `La promesse de ${name} : ce que le visiteur obtient, et pour qui c'est fait.`,
    links: heroLinks,
    visual: heroVisual,
    essential: true,
  };
  const features: PlannedSection = {
    content: 'home-features',
    component: 'Features',
    spec: 'Features',
    anchor: 'atouts',
    angle: `Les points forts de ${name} : ce qui le distingue aux yeux de sa clientèle.`,
  };
  const splitA: PlannedSection = {
    content: 'home-split-a',
    component: 'Split',
    spec: 'Split',
    anchor: 'offre',
    angle:
      "Le cœur de l'offre : ce que l'on obtient concrètement, et comment cela se passe pour le client.",
    visual: options.hasPattern,
  };
  const steps: PlannedSection = {
    content: 'home-steps',
    component: 'Steps',
    spec: 'Steps',
    anchor: 'etapes',
    angle: "Le parcours d'un client, du premier contact au résultat.",
  };
  const splitB: PlannedSection = {
    content: 'home-split-b',
    component: 'Split',
    spec: 'Split',
    anchor: 'pour-qui',
    angle: `À qui s'adresse ${name}, et ce que cela change pour ces personnes au quotidien.`,
    reversed: true,
  };
  const faq: PlannedSection = {
    content: 'home-faq',
    component: 'Faq',
    spec: 'Faq',
    anchor: 'questions',
    angle:
      "Les questions qu'un client se pose avant de se décider. Quand la réponse dépend d'un détail que les faits ne donnent pas (délai, zone, moyen de paiement), dites qu'il se précise au contact plutôt que de l'inventer.",
  };

  const homeSections: PlannedSection[] = [hero];

  // Deux ordres d'accueil, choisis par la graine du projet : les sites ne se
  // ressemblent pas tous, sans qu'aucun ordre soit bancal.
  if (options.seed % 2 === 0) homeSections.push(features, splitA, steps, splitB);
  else homeSections.push(splitA, features, splitB, steps);

  if (!multi && hasOffers) {
    homeSections.push({
      content: 'home-pricing',
      component: 'Pricing',
      spec: 'Pricing',
      anchor: 'tarifs',
      angle: 'Les offres et leurs prix réels, pour choisir.',
      links: to.contact ? { cta: to.contact } : {},
    });
  }
  if (!multi && hasTeam) {
    homeSections.push({ content: 'home-team', component: 'Team', anchor: 'equipe' });
  }

  homeSections.push(faq);

  if (!multi && hasContact) {
    homeSections.push({ content: 'home-contact', component: 'Contact', anchor: 'contact' });
  }

  homeSections.push({
    content: 'home-cta',
    component: 'Cta',
    spec: 'Cta',
    anchor: 'commencer',
    angle: `Inviter à passer à l'action maintenant avec ${name}.`,
    links: ctaLinks(),
    essential: true,
  });

  const planned: PlannedPage[] = [{ key: 'home', path: '/', label: w.home, sections: homeSections }];

  /* -------------------------- Pages intérieures -------------------------- */

  const header = (key: PageKey, angle: string): PlannedSection => ({
    content: `${key}-header`,
    component: 'Hero',
    spec: 'Header',
    angle,
    variant: 'centered',
    essential: true,
  });

  if (pages.offers) {
    planned.push({
      key: 'offers',
      path: w.paths.offers,
      label: w.offers,
      sections: [
        header('offers', `La page des offres de ${name} : choisir la formule qui convient.`),
        {
          content: 'offers-pricing',
          component: 'Pricing',
          spec: 'Pricing',
          anchor: 'tarifs',
          angle: 'Les offres et leurs prix réels, pour choisir.',
          links: to.contact ? { cta: to.contact } : {},
          untitled: true,
        },
        {
          content: 'offers-split',
          component: 'Split',
          spec: 'Split',
          anchor: 'deroulement',
          angle:
            "Comment se déroule une prestation, de la commande à la livraison ou au service rendu, sans inventer de délai ni de chiffre.",
          visual: options.hasPattern,
          links: to.contact ? { cta: to.contact } : {},
        },
        {
          content: 'offers-cta',
          component: 'Cta',
          spec: 'Cta',
          angle: "Inviter à choisir une offre et à prendre contact.",
          links: ctaLinks(w.paths.offers),
        },
      ],
    });
  }

  if (pages.about) {
    const about: PlannedSection[] = [
      header('about', `Qui est derrière ${name}, et pourquoi ce projet existe.`),
      {
        content: 'about-story',
        component: 'Split',
        spec: 'Split',
        anchor: 'histoire',
        angle: `L'histoire et la mission de ${name} : d'où vient le projet, le besoin qu'il comble.`,
        visual: options.hasPattern,
      },
    ];
    if (hasTeam) about.push({ content: 'about-team', component: 'Team', anchor: 'equipe' });
    about.push(
      {
        content: 'about-values',
        component: 'Features',
        spec: 'Features',
        anchor: 'engagements',
        variant: 'rows',
        angle: `Ce qui guide ${name} dans sa façon de travailler, tiré de son histoire et de son offre. Aucune promesse chiffrée, aucun délai, aucune garantie que les faits ne donnent pas.`,
      },
      {
        content: 'about-cta',
        component: 'Cta',
        spec: 'Cta',
        angle: `Inviter à travailler avec ${name}.`,
        links: ctaLinks(),
      }
    );
    planned.push({ key: 'about', path: w.paths.about, label: w.about, sections: about });
  }

  if (pages.contact) {
    planned.push({
      key: 'contact',
      path: w.paths.contact,
      label: w.contact,
      sections: [
        header(
          'contact',
          `Comment joindre ${name}. Le site n'a pas de formulaire : on prend contact par les moyens listés dans les faits, et seulement eux. Aucun délai de réponse ni horaire n'est donné.`
        ),
        { content: 'contact-channels', component: 'Contact', anchor: 'contact' },
      ],
    });
  }

  /* ----------------------------- Navigation ----------------------------- */

  let navLinks: NavLink[];
  let navCta: NavLink | undefined;
  let footerLinks: NavLink[];

  if (multi) {
    const inner = planned.filter((page) => page.key !== 'home');
    const contactPage = inner.find((page) => page.key === 'contact');
    navLinks = [
      { label: w.home, href: '/' },
      ...inner.filter((page) => page.key !== 'contact').map((page) => ({ label: page.label, href: page.path })),
    ];
    navCta = contactPage
      ? { label: w.contactCta, href: contactPage.path }
      : to.offers
        ? { label: w.seeOffers, href: to.offers }
        : undefined;
    footerLinks = planned.map((page) => ({ label: page.label, href: page.path }));
  } else {
    const anchors: Array<[string, string]> = [
      ['atouts', w.features],
      ['etapes', w.steps],
      ['tarifs', w.pricing],
      ['equipe', w.team],
      ['questions', w.faq],
    ];
    const present = new Set(homeSections.map((section) => section.anchor));
    navLinks = anchors
      .filter(([anchor]) => present.has(anchor))
      .map(([anchor, label]) => ({ label, href: `#${anchor}` }));
    navCta = present.has('contact')
      ? { label: w.contactCta, href: '#contact' }
      : present.has('tarifs')
        ? { label: w.seeOffers, href: '#tarifs' }
        : undefined;
    footerLinks = [...navLinks, ...(navCta && navCta.href === '#contact' ? [{ label: w.contact, href: '#contact' }] : [])];
  }

  return { mode, pages: planned, nav: { links: navLinks, cta: navCta }, footerLinks };
}

/**
 * La destination d'un bouton, dite au modèle pour que le libellé y corresponde
 * (« Réserver » mène au contact, « Voir les tarifs » aux offres).
 */
export function describeDestination(href: string, facts: SiteFacts, language: string, pages: PlannedPage[] = []): string {
  const w = wordsFor(language);
  const channels = facts.channels.map((channel) => channel.label.toLowerCase()).join(', ');
  const page = pages.find((candidate) => candidate.path === href || (candidate.path === '/' && href.startsWith('/#')));
  if (page) {
    if (page.sections.some((section) => section.component === 'Contact') && (href === page.path || href === '/#contact')) {
      return `la page « ${page.label} », pour prendre contact (${channels})`;
    }
    if (page.sections.some((section) => section.component === 'Pricing') && (href === page.path || href === '/#tarifs')) {
      return `la page « ${page.label} », avec les offres et leurs prix`;
    }
    return page.path === '/' ? "la page d'accueil" : `la page « ${page.label} »`;
  }

  if (href === w.paths.contact || href === '#contact') return `la prise de contact (${channels})`;
  if (href === w.paths.offers || href === '#tarifs') return 'les offres et leurs prix';
  if (href === w.paths.about) return "la page qui présente l'équipe et l'histoire du projet";
  if (href === '#atouts') return 'les points forts, plus bas sur la page';
  if (href.startsWith('https://wa.me/')) return 'une conversation WhatsApp';
  if (href.startsWith('tel:')) return 'un appel téléphonique';
  if (href.startsWith('mailto:')) return 'un e-mail';
  return 'la suite du site';
}

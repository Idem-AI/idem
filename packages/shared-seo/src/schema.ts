import {
  IDEM,
  PROMISE,
  PROMISE_LONG,
  SERVICES,
  WORKFLOW,
  type EcosystemService,
  type SeoLocale,
  type ServiceId,
} from './ecosystem';
import { OG_IMAGE_SIZE, ogImageUrl } from './og';

/**
 * Les graphes JSON-LD de l'écosystème.
 *
 * Ce qui fait comprendre aux moteurs que des applications servies sur des
 * domaines différents sont les services d'un même produit, ce sont des
 * identifiants (`@id`) STABLES, écrits à l'identique sur tous les domaines :
 *
 *   https://idem.africa/#organization   l'entreprise
 *   https://idem.africa/#website        le site principal
 *   https://idem.africa/#platform       IDEM, le produit (hasPart → services)
 *   https://idem.africa/#workflow       le parcours, étapes ordonnées
 *   https://<service>/#app              chaque service (isPartOf → #platform)
 *   https://<service>/#website          chaque sous-domaine (isPartOf → #website)
 *
 * Chaque page publie le graphe complet : où qu'un robot entre, il voit la même
 * entreprise, le même produit, et la place de la page dans le parcours.
 */

export const ORGANIZATION_ID = `${IDEM.url}/#organization`;
export const WEBSITE_ID = `${IDEM.url}/#website`;
export const PLATFORM_ID = `${IDEM.url}/#platform`;
export const WORKFLOW_ID = `${IDEM.url}/#workflow`;

export const serviceId = (id: ServiceId): string => `${SERVICES[id].url}/#app`;
export const serviceSiteId = (id: ServiceId): string => `${SERVICES[id].url}/#website`;

const ref = (id: string) => ({ '@id': id });

const LANGS = ['fr', 'en'];

type JsonLdNode = Record<string, unknown>;

export function organizationNode(locale: SeoLocale): JsonLdNode {
  return {
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: IDEM.name,
    legalName: IDEM.legalName,
    url: IDEM.url,
    logo: {
      '@type': 'ImageObject',
      '@id': `${IDEM.url}/#logo`,
      url: IDEM.logo,
      width: 512,
      height: 512,
      caption: IDEM.name,
    },
    image: ref(`${IDEM.url}/#logo`),
    slogan: PROMISE[locale],
    description: PROMISE_LONG[locale],
    foundingDate: IDEM.foundingDate,
    foundingLocation: {
      '@type': 'Place',
      address: { '@type': 'PostalAddress', addressCountry: IDEM.foundingCountry },
    },
    email: IDEM.email,
    sameAs: [...IDEM.sameAs],
  };
}

export function websiteNode(locale: SeoLocale): JsonLdNode {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    url: IDEM.url,
    name: IDEM.name,
    alternateName: `IDEM — ${PROMISE[locale]}`,
    description: PROMISE_LONG[locale],
    inLanguage: LANGS,
    publisher: ref(ORGANIZATION_ID),
    about: ref(PLATFORM_ID),
  };
}

export function platformNode(locale: SeoLocale): JsonLdNode {
  return {
    '@type': 'SoftwareApplication',
    '@id': PLATFORM_ID,
    name: IDEM.name,
    url: IDEM.url,
    description: PROMISE_LONG[locale],
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    inLanguage: LANGS,
    image: ogImageUrl('home', locale),
    license: 'https://www.apache.org/licenses/LICENSE-2.0',
    publisher: ref(ORGANIZATION_ID),
    hasPart: WORKFLOW.map((s) => ref(serviceId(s.id))),
    featureList: WORKFLOW.map((s) => `${s.role[locale]} — ${s.name}`),
  };
}

export function serviceNode(service: EcosystemService, locale: SeoLocale): JsonLdNode {
  return {
    '@type': 'SoftwareApplication',
    '@id': serviceId(service.id),
    name: service.name,
    alternateName: `${service.name} by IDEM`,
    url: service.url,
    description: service.description[locale],
    applicationCategory: service.category,
    operatingSystem: 'Web',
    inLanguage: LANGS,
    image: ogImageUrl(service.id, locale),
    featureList: [...service.features[locale]],
    isPartOf: ref(PLATFORM_ID),
    publisher: ref(ORGANIZATION_ID),
    creator: ref(ORGANIZATION_ID),
    // L'étape du parcours à laquelle le service appartient.
    position: service.step,
  };
}

export function workflowNode(locale: SeoLocale): JsonLdNode {
  return {
    '@type': 'ItemList',
    '@id': WORKFLOW_ID,
    name: PROMISE[locale],
    description:
      locale === 'fr'
        ? 'Le parcours IDEM, de l’idée au business rentable et en ligne.'
        : 'The IDEM journey, from idea to a profitable business online.',
    itemListOrder: 'https://schema.org/ItemListOrderAscending',
    numberOfItems: WORKFLOW.length,
    itemListElement: WORKFLOW.map((s) => ({
      '@type': 'ListItem',
      position: s.step,
      name: `${s.role[locale]} — ${s.name}`,
      item: ref(serviceId(s.id)),
    })),
  };
}

/** Le site propre à un service (son sous-domaine), rattaché au site IDEM. */
export function serviceSiteNode(service: EcosystemService, locale: SeoLocale): JsonLdNode {
  return {
    '@type': 'WebSite',
    '@id': serviceSiteId(service.id),
    url: service.url,
    name: service.name,
    description: service.description[locale],
    inLanguage: LANGS,
    publisher: ref(ORGANIZATION_ID),
    isPartOf: ref(WEBSITE_ID),
    about: ref(serviceId(service.id)),
  };
}

/** Les nœuds communs à toutes les pages : organisation, produit, services, parcours. */
export function ecosystemNodes(locale: SeoLocale): JsonLdNode[] {
  return [
    organizationNode(locale),
    websiteNode(locale),
    platformNode(locale),
    ...WORKFLOW.map((s) => serviceNode(s, locale)),
    workflowNode(locale),
  ];
}

export interface FaqEntry {
  question: string;
  answer: string;
}

export interface Breadcrumb {
  name: string;
  url: string;
}

export interface PageGraphInput {
  locale: SeoLocale;
  /** URL canonique de la page. */
  url: string;
  title: string;
  description: string;
  /** Image de partage de la page. */
  image: string;
  /** Le sujet de la page : un service, ou IDEM tout entier. */
  about?: ServiceId | 'platform';
  /** Le site qui sert la page : le landing (`idem`) ou le sous-domaine d'un service. */
  site?: 'idem' | ServiceId;
  pageType?: 'WebPage' | 'AboutPage' | 'ContactPage' | 'CollectionPage';
  breadcrumbs?: readonly Breadcrumb[];
  faq?: readonly FaqEntry[];
  imageAlt?: string;
}

/** Le graphe complet d'une page. */
export function buildPageGraph(input: PageGraphInput): JsonLdNode {
  const site = input.site ?? 'idem';
  const about = input.about ?? 'platform';
  const aboutRef = ref(about === 'platform' ? PLATFORM_ID : serviceId(about));
  const pageId = `${input.url}#webpage`;
  const graph: JsonLdNode[] = ecosystemNodes(input.locale);

  if (site !== 'idem') graph.push(serviceSiteNode(SERVICES[site], input.locale));

  const types: string[] = [input.pageType ?? 'WebPage'];
  if (input.faq?.length) types.push('FAQPage');

  const page: JsonLdNode = {
    '@type': types.length === 1 ? types[0] : types,
    '@id': pageId,
    url: input.url,
    name: input.title,
    description: input.description,
    inLanguage: input.locale,
    isPartOf: ref(site === 'idem' ? WEBSITE_ID : serviceSiteId(site)),
    about: aboutRef,
    publisher: ref(ORGANIZATION_ID),
    primaryImageOfPage: {
      '@type': 'ImageObject',
      url: input.image,
      width: OG_IMAGE_SIZE.width,
      height: OG_IMAGE_SIZE.height,
      ...(input.imageAlt ? { caption: input.imageAlt } : {}),
    },
  };

  if (input.breadcrumbs?.length) {
    const breadcrumbId = `${input.url}#breadcrumb`;
    page['breadcrumb'] = ref(breadcrumbId);
    graph.push({
      '@type': 'BreadcrumbList',
      '@id': breadcrumbId,
      itemListElement: input.breadcrumbs.map((b, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: b.name,
        item: b.url,
      })),
    });
  }

  if (input.faq?.length) {
    page['mainEntity'] = input.faq.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    }));
  }

  graph.push(page);
  return { '@context': 'https://schema.org', '@graph': graph };
}

/**
 * Le JSON-LD prêt à poser dans un `<script type="application/ld+json">` :
 * `</` est échappé pour qu'aucun texte ne puisse refermer la balise.
 */
export function jsonLdString(graph: JsonLdNode, indent?: number): string {
  return JSON.stringify(graph, null, indent).replace(/<\//g, '<\\/');
}

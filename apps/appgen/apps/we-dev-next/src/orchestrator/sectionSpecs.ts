/**
 * Ce que chaque section rédigée par un modèle doit contenir, et comment juger
 * ce qu'il rend.
 *
 * C'est la clé de la fragmentation : une tâche par section, chacune avec un
 * contrat étroit (des champs nommés, des bornes) que l'on peut VÉRIFIER. Un
 * petit modèle à qui l'on demande « l'objet JSON d'une section Questions, avec
 * ces clés » réussit ; le même modèle à qui l'on demandait le site entier se
 * mettait à recopier son propre prompt.
 *
 * Les liens ne sont jamais demandés au modèle. Il inventait des ancres
 * (`#signup`) qui ne menaient nulle part ; c'est le plan qui sait où mène
 * chaque bouton, et le code qui pose l'adresse. Le modèle n'écrit que le
 * libellé, en sachant où il conduit.
 *
 * Les formes correspondent aux propriétés lues par le kit
 * (`scaffold/sections.ts`). Les modifier l'une sans l'autre casse le rendu.
 */

export type SpecName =
  | 'Hero'
  | 'Header'
  | 'Features'
  | 'Split'
  | 'Steps'
  | 'Pricing'
  | 'Faq'
  | 'Cta'
  | 'Showcase'
  | 'Statement'
  | 'Gallery';

export interface SectionSpec {
  /** Ce que la section fait sur la page, dit au modèle. */
  purpose: string;
  /** La forme attendue, montrée au modèle telle quelle. */
  shape: string;
  /** Champs d'un bouton : seuls ceux dont le plan a fixé la destination restent. */
  ctas: Array<'primaryCta' | 'secondaryCta' | 'cta'>;
}

export const SECTION_SPECS: Record<SpecName, SectionSpec> = {
  Hero: {
    purpose: "L'ouverture du site : ce que fait ce projet, pour qui, et l'action principale.",
    shape: `{
  "eyebrow": "3 à 6 mots qui situent (lieu, clientèle ou métier)",
  "title": "la promesse en une phrase de 6 à 12 mots, concrète et propre à ce projet",
  "description": "1 à 2 phrases : ce que l'on obtient, comment",
  "primaryCta": { "label": "verbe + objet, 2 à 4 mots" },
  "secondaryCta": { "label": "2 à 4 mots" }
}`,
    ctas: ['primaryCta', 'secondaryCta'],
  },
  Header: {
    purpose: "L'en-tête d'une page intérieure du site : de quoi parle la page, en une promesse.",
    shape: `{
  "eyebrow": "1 à 3 mots, le nom de la page",
  "title": "6 à 12 mots",
  "description": "1 à 2 phrases"
}`,
    ctas: [],
  },
  Features: {
    purpose: 'Des points forts : chacun nommé, avec une raison concrète.',
    shape: `{
  "title": "titre de section, 4 à 9 mots",
  "intro": "une phrase",
  "items": [ { "title": "2 à 5 mots", "description": "1 à 2 phrases concrètes" } ]
}
"items" contient 3 à 6 éléments.`,
    ctas: [],
  },
  Split: {
    purpose: 'Un argument développé : un thème, expliqué en profondeur, avec ses points clés.',
    shape: `{
  "eyebrow": "1 à 3 mots",
  "title": "6 à 12 mots",
  "description": "2 à 3 phrases",
  "bullets": ["3 à 5 points courts"],
  "cta": { "label": "2 à 4 mots" }
}`,
    ctas: ['cta'],
  },
  Steps: {
    purpose: 'Le déroulé : comment on passe du premier contact au résultat, étape par étape.',
    shape: `{
  "title": "titre de section",
  "items": [ { "title": "2 à 5 mots", "description": "1 à 2 phrases" } ]
}
"items" contient 3 ou 4 étapes, dans l'ordre.`,
    ctas: [],
  },
  Pricing: {
    purpose: 'Les offres et leurs prix, pour que le visiteur choisisse.',
    shape: `{
  "title": "titre de section",
  "intro": "une phrase",
  "plans": [ { "name": "le nom exact de l'offre", "description": "une phrase : à qui elle convient", "features": ["ce que comprend l'offre, SEULEMENT d'après ses notes ; liste vide sinon"], "cta": { "label": "2 à 4 mots" } } ]
}
Une entrée par offre fournie, dans le même ordre. Les prix sont posés par le code : ne les écrivez pas.`,
    ctas: [],
  },
  Faq: {
    purpose: 'Les questions que se pose un visiteur avant de se décider, avec des réponses nettes.',
    shape: `{
  "title": "titre de section",
  "items": [ { "question": "une vraie question de client", "answer": "1 à 3 phrases" } ]
}
"items" contient 4 à 7 questions.`,
    ctas: [],
  },
  Showcase: {
    purpose: "Une vitrine : un grand visuel et la phrase qui dit ce qu'il montre.",
    shape: `{
  "eyebrow": "1 à 3 mots",
  "title": "5 à 10 mots, ce que montre le visuel",
  "description": "1 à 2 phrases"
}`,
    ctas: [],
  },
  Statement: {
    purpose: 'Une phrase forte, affichée en grand : la conviction du projet, tirée de son histoire.',
    shape: `{
  "statement": "une seule phrase de 8 à 22 mots, sans guillemets",
  "signature": "qui la porte : le nom du projet, ou « Fondatrice, <nom du projet> » si les faits nomment la personne"
}`,
    ctas: [],
  },
  Gallery: {
    purpose: "Une galerie d'images : ce que fait le projet, montré plutôt que dit.",
    shape: `{
  "title": "3 à 7 mots",
  "intro": "une phrase"
}`,
    ctas: [],
  },
  Cta: {
    purpose: "La relance de fin de page : une dernière raison d'agir, et l'action.",
    shape: `{
  "title": "6 à 12 mots",
  "description": "une phrase",
  "primaryCta": { "label": "verbe + objet, 2 à 4 mots" },
  "secondaryCta": { "label": "2 à 4 mots" }
}`,
    ctas: ['primaryCta', 'secondaryCta'],
  },
};

/* -------------------------------------------------------------------------- */
/*  Vérification                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Texte de remplissage : la réponse entière est refusée, on réessaie.
 *
 * Testé sur les TEXTES de la réponse, jamais sur son JSON : une liste courte
 * (`["Livraison","Retrait"]`) ressemblerait sinon à un gabarit `[Nom]`.
 */
const PLACEHOLDER =
  /lorem|ipsum|dolor sit|\bfeature (one|two|1|2)\b|\bexample\.com\b|\bexemple\.com\b|\bxxx\b|\[[^\]]{1,40}\]|\{\{/i;

/** Tous les textes d'une réponse, à n'importe quelle profondeur. */
function textsOf(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => textsOf(item, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((item) => textsOf(item, out));
  return out;
}

/**
 * Un texte propre : espaces normalisés, tirets cadratins remplacés (la règle de
 * rédaction des livrables IDEM), guillemets d'ouverture et de fermeture ôtés.
 */
export const cleanText = (value: unknown, max = 400): string =>
  typeof value === 'string'
    ? value
        .replace(/\s*[—–]\s*/g, ', ')
        .replace(/\s+/g, ' ')
        .replace(/^["“«]\s*|\s*["”»]$/g, '')
        .trim()
        .slice(0, max)
        // Typographie française : espace insécable avant « : ; ! ? » et dans
        // les guillemets. Sans elle, un deux-points se retrouvait seul en
        // début de ligne dans les titres (« … livraison / : un service… »).
        .replace(/ ([:;!?»])/g, '\u00a0$1')
        .replace(/« /g, '«\u00a0')
    : '';

const needs = (...values: string[]) => values.every(Boolean);

function list<T>(value: unknown, map: (item: any) => T | null, min: number, max: number): T[] | null {
  if (!Array.isArray(value)) return null;
  const items = value.map(map).filter((item): item is T => item !== null).slice(0, max);
  return items.length >= min ? items : null;
}

/** Destination des boutons, fixée par le plan. Une case vide = pas de bouton. */
export type CtaLinks = Partial<Record<'primaryCta' | 'secondaryCta' | 'cta', string>>;

function withCtas(
  name: SpecName,
  data: Record<string, any>,
  links: CtaLinks,
  out: Record<string, unknown>
): Record<string, unknown> {
  for (const slot of SECTION_SPECS[name].ctas) {
    const href = links[slot];
    const label = cleanText(data?.[slot]?.label ?? (typeof data?.[slot] === 'string' ? data[slot] : ''), 40);
    if (href && label) out[slot] = { label, href };
  }
  return out;
}

/** Une offre telle que le code l'affiche : nom et prix réels. */
export interface OfferFact {
  name: string;
  price: string;
}

/**
 * Juge et nettoie la réponse d'un modèle pour une section.
 *
 * Rend l'objet prêt à écrire, ou `null` quand la réponse est inutilisable : on
 * réessaie alors, puis la section est retirée plutôt que remplie de vide.
 */
export function validateSection(
  name: SpecName,
  raw: unknown,
  links: CtaLinks,
  offers: OfferFact[] = []
): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const data = raw as Record<string, any>;

  // Aucun texte de remplissage ne passe, nulle part dans l'objet.
  if (textsOf(data).some((value) => PLACEHOLDER.test(value))) return null;

  switch (name) {
    case 'Hero':
    case 'Header': {
      const title = cleanText(data.title, 140);
      const description = cleanText(data.description, 320);
      if (!needs(title, description)) return null;
      const out = withCtas(name, data, links, { eyebrow: cleanText(data.eyebrow, 60), title, description });
      // Un hero sans action ne remplit pas son rôle : on réessaie.
      if (name === 'Hero' && links.primaryCta && !out.primaryCta) return null;
      return out;
    }
    case 'Features':
    case 'Steps': {
      const items = list(
        data.items,
        (item) =>
          needs(cleanText(item?.title), cleanText(item?.description))
            ? { title: cleanText(item.title, 80), description: cleanText(item.description, 320) }
            : null,
        3,
        name === 'Steps' ? 4 : 6
      );
      const title = cleanText(data.title, 120);
      if (!title || !items) return null;
      return { title, ...(name === 'Features' ? { intro: cleanText(data.intro, 240) } : {}), items };
    }
    case 'Split': {
      const title = cleanText(data.title, 140);
      const description = cleanText(data.description, 480);
      const bullets = list(data.bullets, (item) => cleanText(item, 160) || null, 2, 5);
      if (!needs(title, description) || !bullets) return null;
      return withCtas(name, data, links, { eyebrow: cleanText(data.eyebrow, 40), title, description, bullets });
    }
    case 'Pricing': {
      if (!offers.length) return null;
      const written: any[] = Array.isArray(data.plans) ? data.plans : [];
      const plans = offers.map((offer, index) => {
        // Le modèle peut réordonner ou renommer : on retrouve son texte par le
        // nom, sinon par la position. Le nom et le prix restent ceux des faits.
        const match =
          written.find((plan) => cleanText(plan?.name).toLowerCase() === offer.name.toLowerCase()) ??
          written[index] ??
          {};
        const features = (Array.isArray(match?.features) ? match.features : [])
          .map((item: unknown) => cleanText(item, 120))
          .filter(Boolean)
          .slice(0, 6);
        const label = cleanText(match?.cta?.label ?? '', 40);
        return {
          name: offer.name,
          price: offer.price,
          description: cleanText(match?.description, 240),
          features,
          ...(links.cta && label ? { cta: { label, href: links.cta } } : {}),
          // Mettre en avant l'offre du milieu quand il y en a trois : c'est la
          // lecture attendue, et ce n'est pas une affirmation.
          featured: offers.length === 3 && index === 1,
        };
      });
      const title = cleanText(data.title, 120);
      if (!title) return null;
      return { title, intro: cleanText(data.intro, 240), plans };
    }
    case 'Faq': {
      const items = list(
        data.items,
        (item) =>
          needs(cleanText(item?.question), cleanText(item?.answer))
            ? { question: cleanText(item.question, 200), answer: cleanText(item.answer, 600) }
            : null,
        3,
        7
      );
      const title = cleanText(data.title, 120);
      if (!title || !items) return null;
      return { title, items };
    }
    case 'Showcase': {
      const title = cleanText(data.title, 120);
      if (!title) return null;
      return { eyebrow: cleanText(data.eyebrow, 40), title, description: cleanText(data.description, 320) };
    }
    case 'Statement': {
      const statement = cleanText(data.statement, 200);
      const words = statement.split(' ').length;
      if (!statement || words < 6 || words > 30) return null;
      return { statement, signature: cleanText(data.signature, 80) };
    }
    case 'Gallery': {
      const title = cleanText(data.title, 100);
      if (!title) return null;
      return { title, intro: cleanText(data.intro, 240) };
    }
    case 'Cta': {
      const title = cleanText(data.title, 140);
      if (!title) return null;
      const out = withCtas(name, data, links, { title, description: cleanText(data.description, 240) });
      if (links.primaryCta && !out.primaryCta) return null;
      return out;
    }
  }

  return null;
}

/**
 * Lit le premier objet JSON d'une réponse de modèle.
 *
 * Les modèles l'entourent volontiers d'un bloc de code ou d'une phrase, et
 * laissent parfois une virgule finale. On ne leur reproche rien de tout cela.
 */
export function readJsonObject(text: string): unknown {
  if (!text) return null;

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const source = fenced ? fenced[1] : text;

  const start = source.indexOf('{');
  const end = source.lastIndexOf('}');
  if (start === -1 || end <= start) return null;

  const candidate = source.slice(start, end + 1);

  for (const attempt of [candidate, candidate.replace(/,\s*([}\]])/g, '$1')]) {
    try {
      return JSON.parse(attempt);
    } catch {
      // Essai suivant.
    }
  }

  return null;
}

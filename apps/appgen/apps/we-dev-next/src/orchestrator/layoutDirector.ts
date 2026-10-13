/**
 * L'agent de mise en page : la disposition de chaque section, son fond, et ce
 * que la page gagne à montrer en plus.
 *
 * Avant lui, chaque site prenait la variante par défaut de chaque section : le
 * même hero, la même grille, la même FAQ, dans le même ordre. Deux projets
 * différents donnaient deux pages identiques à la couleur près.
 *
 * L'agent choisit maintenant dans des MENUS — les dispositions que le kit sait
 * dessiner, filtrées par le style de la charte (un style suisse n'a pas droit à
 * une grille bento) — et le code vérifie tout : une disposition hors menu, deux
 * fonds teintés de suite, deux formes identiques côte à côte, une insertion
 * mal placée sont corrigés. Sans réponse valable, un tirage au sort stable par
 * projet, dans les mêmes menus, garantit la variété.
 */

import { DesignSystem } from '../design/tokenForge.js';
import { KIT_TONES, KIT_VARIANTS, KitSection, KitTone, sectionDefaults } from '../scaffold/sections.js';
import { ChatLogger } from '../utils/logger.js';
import { ModelCaller, SHAPE_REMINDER, Verdict } from './modelCaller.js';
import { SiteFacts } from './siteFacts.js';
import { PlannedPage, PlannedSection, SitePlan } from './sitePlan.js';

export type StyleFamily = 'structured' | 'expressive' | 'soft';

const FAMILY_BY_STYLE: Record<string, StyleFamily> = {
  swiss: 'structured',
  editorial: 'structured',
  victorian: 'structured',
  minimalism: 'structured',
  'pixel-art': 'structured',
  retro: 'structured',
  'pop-art': 'expressive',
  y2k: 'expressive',
  maximalism: 'expressive',
  graffiti: 'expressive',
  'collage-art': 'expressive',
  'vector-art': 'expressive',
  clay: 'expressive',
  aurora: 'expressive',
  glassmorphism: 'expressive',
  futuristic: 'expressive',
  cyberpunk: 'expressive',
  handwritten: 'soft',
  bohemian: 'soft',
  surreal: 'soft',
};

/** La famille d'un style de charte ; une direction tirée au sort (sans charte) passe pour structurée. */
export function styleFamily(system: DesignSystem): StyleFamily {
  const id = system.direction.id.replace(/^charter-/, '');
  return FAMILY_BY_STYLE[id] ?? (/brutal|drenched|bold/.test(id) ? 'expressive' : 'structured');
}

/** Ce que chaque famille de styles autorise, dans l'ordre de préférence. */
const MENUS: Record<StyleFamily, Partial<Record<KitSection, string[]>>> = {
  structured: {
    Hero: ['split', 'editorial', 'stacked', 'fullbleed'],
    Features: ['rows', 'numbered', 'sticky', 'cards'],
    Split: ['balanced', 'wide'],
    Steps: ['columns', 'timeline'],
    Pricing: ['table', 'cards'],
    Faq: ['split', 'stacked', 'grid'],
    Cta: ['band', 'minimal', 'split'],
    Contact: ['split', 'cards'],
    Showcase: ['wide', 'overlap'],
    Statement: ['rule', 'centered'],
    Gallery: ['row', 'mosaic'],
  },
  expressive: {
    Hero: ['centered', 'fullbleed', 'split', 'stacked'],
    Features: ['bento', 'cards', 'numbered'],
    Split: ['inset', 'wide', 'balanced'],
    Steps: ['cards', 'columns'],
    Pricing: ['cards', 'table'],
    Faq: ['grid', 'split'],
    Cta: ['band', 'split'],
    Contact: ['cards', 'split'],
    Showcase: ['overlap', 'wide'],
    Statement: ['centered', 'rule'],
    Gallery: ['mosaic', 'row'],
  },
  soft: {
    Hero: ['centered', 'stacked', 'split'],
    Features: ['cards', 'rows', 'sticky'],
    Split: ['inset', 'balanced'],
    Steps: ['timeline', 'cards'],
    Pricing: ['cards'],
    Faq: ['stacked', 'split'],
    Cta: ['minimal', 'band'],
    Contact: ['cards', 'split'],
    Showcase: ['wide', 'overlap'],
    Statement: ['centered'],
    Gallery: ['row', 'mosaic'],
  },
};

export function menuFor(component: string, family: StyleFamily): string[] {
  const all = (KIT_VARIANTS as Record<string, readonly string[]>)[component];
  if (!all) return [];
  const allowed = MENUS[family][component as KitSection];
  return allowed?.length ? allowed.filter((variant) => all.includes(variant)) : [...all];
}

/** Sections que l'agent peut ajouter, et où. */
const INSERTABLE = ['Statement', 'Showcase', 'Gallery', 'Band'] as const;
type Insertable = (typeof INSERTABLE)[number];
const MAX_INSERTS_PER_PAGE = 2;

/** Les sections de récit de l'accueil, que l'agent peut réordonner. */
const STORY = ['home-features', 'home-split-a', 'home-steps', 'home-split-b'];

/** Un générateur pseudo-aléatoire stable, pour un tirage reproductible par projet. */
function random(seed: number): () => number {
  let state = seed || 1;
  return () => {
    state = (Math.imul(state ^ (state >>> 15), 2246822507) + 0x9e3779b9) >>> 0;
    state = Math.imul(state ^ (state >>> 13), 3266489909) >>> 0;
    return ((state ^ (state >>> 16)) >>> 0) / 4294967296;
  };
}

/** Les sections de contenu d'une page (le cadre, nav et pied, n'est pas dans le plan). */
const bodyOf = (page: PlannedPage) => page.sections;

interface LayoutAnswer {
  sections: Record<string, { variant?: string; tone?: string }>;
  inserts: Array<{ after: string; component: string }>;
  homeOrder?: string[];
}

function readAnswer(raw: unknown): LayoutAnswer | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, any>;
  const sections = data.sections && typeof data.sections === 'object' ? data.sections : null;
  if (!sections) return null;
  return {
    sections,
    inserts: Array.isArray(data.inserts) ? data.inserts : [],
    homeOrder: Array.isArray(data.homeOrder) ? data.homeOrder.filter((item: unknown) => typeof item === 'string') : undefined,
  };
}

function prompt(plan: SitePlan, facts: SiteFacts, system: DesignSystem, family: StyleFamily): string {
  const pages = plan.pages
    .map((page) => {
      const rows = bodyOf(page).map((section) => {
        const menu = menuFor(section.component, family);
        return `  - ${section.content} · ${section.component}${section.angle ? ` · ${section.angle.slice(0, 110)}` : ''}${
          menu.length ? ` · dispositions : ${menu.join(', ')}` : ''
        }`;
      });
      return `Page ${page.path} (${page.label})\n${rows.join('\n')}`;
    })
    .join('\n\n');

  return `# Le projet
${facts.name} : ${facts.description}
${facts.audience ? `Clientèle : ${facts.audience}\n` : ''}${facts.city ? `Lieu : ${[facts.city, facts.country].filter(Boolean).join(', ')}\n` : ''}
# La direction artistique de sa charte
${system.direction.name}. Rythme : ${system.direction.cadence}. Signature : ${system.direction.signature}.

# Les pages et leurs sections, dans l'ordre
${pages}

# Ta tâche
Donne à chaque section une disposition (dans SA liste, rien d'autre) et un fond : "plain" (uni), "tinted" (teinté de la couleur de marque, très clair) ou "raised" (légèrement en relief). Tous les fonds sont clairs.

Une page réussie a un rythme : un moment ample (ouverture, vitrine, phrase forte), des moments denses (listes, grilles), des respirations. Deux sections voisines n'ont ni la même forme ni le même fond teinté. Choisis selon le métier et la clientèle, pas au hasard : un restaurant ou un artisan se montrent (galerie, vitrine, ouverture plein cadre), un cabinet ou un service s'expliquent (listes numérotées, frise, phrase forte).

Tu peux ajouter jusqu'à deux sections par page, parmi : "Statement" (une phrase forte en grand), "Showcase" (un grand visuel commenté), "Gallery" (trois images, seulement si le projet a quelque chose de concret à montrer : lieux, produits, plats, réalisations), "Band" (un bandeau qui fait défiler les offres ou les points forts en grand, pour un style vivant). Indique après quelle section.

Sur l'accueil, tu peux réordonner ces sections de récit : ${STORY.filter((name) => plan.pages[0].sections.some((section) => section.content === name)).join(', ')}.

# Forme exacte de la réponse
{
  "sections": { "<content>": { "variant": "<une disposition de sa liste>", "tone": "plain|tinted|raised" } },
  "inserts": [ { "after": "<content>", "component": "Statement|Showcase|Gallery|Band" } ],
  "homeOrder": ["<content des sections de récit, dans le nouvel ordre>"]
}`;
}

/**
 * Applique une mise en page au plan, réponse de l'agent ou tirage au sort, en
 * corrigeant tout ce qui enfreint les règles. Modifie le plan sur place.
 */
function applyLayout(
  plan: SitePlan,
  answer: LayoutAnswer | null,
  family: StyleFamily,
  system: DesignSystem,
  seed: number,
  angles: Record<Insertable, (facts: SiteFacts) => string>,
  facts: SiteFacts
): void {
  const pick = random(seed);
  const choose = <T>(list: readonly T[]): T => list[Math.floor(pick() * list.length) % list.length];
  const defaults = sectionDefaults(system.direction);

  // 1. L'ordre du récit de l'accueil.
  const home = plan.pages[0];
  const story = home.sections.filter((section) => STORY.includes(section.content));
  const wanted = answer?.homeOrder?.filter((name) => story.some((section) => section.content === name));
  if (wanted && wanted.length === story.length && new Set(wanted).size === story.length) {
    const slots = home.sections
      .map((section, index) => (STORY.includes(section.content) ? index : -1))
      .filter((index) => index >= 0);
    wanted.forEach((name, order) => {
      home.sections[slots[order]] = story.find((section) => section.content === name)!;
    });
  }

  // 2. Les insertions.
  let statementUsed = false;
  let galleryUsed = false;
  for (const page of plan.pages) {
    const requested = (answer?.inserts ?? []).filter((insert) => page.sections.some((section) => section.content === insert.after));
    const fallback: Array<{ after: string; component: string }> = [];
    if (!answer && page.key === 'home') {
      // Tirage : une phrase forte après le premier argument, une fois sur deux ;
      // une vitrine pour les styles qui se montrent.
      const firstStory = page.sections.find((section) => STORY.includes(section.content));
      if (firstStory && pick() < 0.55) fallback.push({ after: firstStory.content, component: 'Statement' });
      const lastStory = [...page.sections].reverse().find((section) => STORY.includes(section.content));
      if (lastStory && family !== 'structured' && pick() < 0.6) fallback.push({ after: lastStory.content, component: 'Showcase' });
      if (family === 'expressive' && pick() < 0.5) fallback.push({ after: page.sections[0].content, component: 'Band' });
    }

    let added = 0;
    for (const insert of answer ? requested : fallback) {
      if (added >= MAX_INSERTS_PER_PAGE) break;
      if (!INSERTABLE.includes(insert.component as Insertable)) continue;
      const component = insert.component as Insertable;
      if (component === 'Statement' && statementUsed) continue;
      if (component === 'Gallery' && galleryUsed) continue;
      if (component === 'Band' && (page.key !== 'home' || family === 'structured')) continue;

      const index = page.sections.findIndex((section) => section.content === insert.after);
      // Jamais avant l'ouverture ni après la relance finale, jamais deux insertions collées.
      if (index < 0 || index >= page.sections.length - 1) continue;
      if (page.sections[index].inserted || page.sections[index + 1]?.inserted) continue;

      const content = `${page.key}-${component.toLowerCase()}`;
      if (page.sections.some((section) => section.content === content)) continue;

      page.sections.splice(index + 1, 0, {
        content,
        component,
        // Le bandeau est rempli par le code (offres, points forts) : pas de rédaction.
        spec: component === 'Band' ? undefined : component,
        angle: angles[component](facts),
        anchor: component === 'Gallery' ? 'images' : undefined,
        inserted: true,
      });
      added += 1;
      if (component === 'Statement') statementUsed = true;
      if (component === 'Gallery') galleryUsed = true;
    }
  }

  // 3. Dispositions et fonds, page par page, avec les règles de voisinage.
  for (const page of plan.pages) {
    let previous: PlannedSection | undefined;
    for (const [index, section] of page.sections.entries()) {
      const menu = menuFor(section.component, family);
      const asked = answer?.sections?.[section.content];

      if (menu.length) {
        // Un en-tête de page intérieure sans choix reste centré : c'est sa forme la plus sûre.
        if (section.spec === 'Header' && !(asked?.variant && menu.includes(asked.variant))) {
          section.variant = 'centered';
        } else {
          let variant = asked?.variant && menu.includes(asked.variant) ? asked.variant : undefined;
          if (!variant) {
            const fallback =
              section.component === 'Hero'
                ? defaults.hero
                : section.component === 'Features'
                  ? defaults.features
                  : section.component === 'Pricing'
                    ? defaults.pricing
                    : undefined;
            // Sans réponse : la variante de la direction une fois sur deux, sinon un tirage.
            variant = !answer && fallback && menu.includes(fallback) && pick() < 0.5 ? fallback : choose(menu);
          }
          // Deux sections voisines de même forme : la seconde change.
          if (previous && previous.component === section.component && previous.variant === variant && menu.length > 1) {
            variant = menu.find((candidate) => candidate !== variant) ?? variant;
          }
          section.variant = variant;
        }
      }

      let tone: KitTone =
        asked?.tone && (KIT_TONES as readonly string[]).includes(asked.tone)
          ? (asked.tone as KitTone)
          : !answer
            ? index % 2 === 1 && pick() < 0.7
              ? choose(['tinted', 'raised'] as const)
              : 'plain'
            : 'plain';
      // L'ouverture et la relance gardent leur propre fond ; deux fonds non unis
      // identiques ne se suivent pas.
      if (index === 0 || section.component === 'Cta') tone = 'plain';
      if (previous && tone !== 'plain' && previous.tone === tone) tone = 'plain';
      section.tone = tone;

      previous = section;
    }
  }
}

/**
 * Vérifie une mise en page déjà choisie (par l'architecte) : dispositions dans
 * les menus, voisinages, fonds. Aucune insertion, aucun appel au modèle.
 */
export function normalizeLayout(plan: SitePlan, system: DesignSystem, seed: number): StyleFamily {
  const family = styleFamily(system);
  const sections: LayoutAnswer['sections'] = {};
  for (const page of plan.pages) {
    for (const section of page.sections) sections[section.content] = { variant: section.variant, tone: section.tone };
  }
  const none = () => '';
  applyLayout(plan, { sections, inserts: [] }, family, system, seed, { Statement: none, Showcase: none, Gallery: none, Band: none }, {} as SiteFacts);
  return family;
}

/**
 * Décide la mise en page du site. Ne lève jamais : sans réponse valable de
 * l'agent, le tirage au sort prend le relais.
 */
export async function directLayout(options: {
  plan: SitePlan;
  facts: SiteFacts;
  system: DesignSystem;
  caller: ModelCaller;
  seed: number;
  language: string;
}): Promise<{ family: StyleFamily; fromAgent: boolean }> {
  const { plan, facts, system, caller, seed } = options;
  const family = styleFamily(system);

  const angles: Record<Insertable, (facts: SiteFacts) => string> = {
    Statement: (f) => `Une phrase forte qui dit la conviction de ${f.name}, tirée de son histoire et de ce qu'il apporte à sa clientèle.`,
    Showcase: (f) => `Mettre en scène, en un grand visuel, le moment le plus parlant de l'expérience ${f.name}.`,
    Gallery: (f) => `Montrer en images ce que fait ${f.name} : les lieux, les produits ou les réalisations.`,
    Band: (f) => `Faire défiler les offres ou les points forts de ${f.name}.`,
  };

  let answer: LayoutAnswer | null = null;
  try {
    const outcome = await caller.json(
      'layout',
      "Tu es directeur artistique. Tu choisis la mise en page d'un site vitrine dans des menus fixés. Réponds UNIQUEMENT par l'objet JSON demandé, sans texte autour.",
      prompt(plan, facts, system, family),
      (raw): Verdict<LayoutAnswer> => {
        const value = readAnswer(raw);
        return value ? { value } : { problem: SHAPE_REMINDER };
      },
      1600
    );
    answer = outcome.value;
  } catch (error) {
    ChatLogger.warn('SITE_LAYOUT', 'Agent de mise en page indisponible, tirage au sort', {
      message: error instanceof Error ? error.message : String(error),
    });
  }

  applyLayout(plan, answer, family, system, seed, angles, facts);

  ChatLogger.info('SITE_LAYOUT', answer ? 'Mise en page choisie par l’agent' : 'Mise en page tirée au sort', {
    family,
    pages: plan.pages.map((page) =>
      page.sections.map((section) => `${section.component}:${section.variant ?? '-'}/${section.tone ?? 'plain'}`).join(' ')
    ),
  });

  return { family, fromAgent: !!answer };
}

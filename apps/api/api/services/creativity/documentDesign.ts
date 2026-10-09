/**
 * LA DIRECTION ARTISTIQUE DES DOCUMENTS (business plan, pitch deck) selon la jauge de créativité.
 *
 * Le moteur de documents décide aujourd'hui tout par une graine (`design/designSeed.ts`) : la
 * famille de mise en page du document, l'archétype de chaque page, sa densité, la place de
 * l'image. La jauge confie ces décisions aux agents, cran par cran, toujours DANS l'espace que
 * le style de la direction artistique autorise :
 *
 *   low     la graine décide (comportement historique)
 *   medium  un agent choisit la famille du document parmi celles du style
 *   high    + un directeur artistique par page choisit son archétype (jamais celui de la voisine)
 *   max     + il règle la densité, la tension et la place de l'image ; un critique relit le rythme
 *   ultra   + le contenu validé de chaque page part au COMPOSITEUR, qui en écrit le HTML ;
 *            fidélité, rendu mesuré et règles de design contrôlés, le gabarit en repli
 *            (`SectionTemplate.compose`, creativity/pageComposer.ts)
 */
import { CreativityLevel, SavedDocumentDesign, atLeast } from '../../models/creativity.model';
import { ARCHETYPE_CATALOG, CONTENT_DENSITY_CATALOG, LAYOUT_TENSION_CATALOG, styleSpaceOf } from '../design/designSeed';
import { familiesForStyle } from '../design/layoutFamilies';
import { agentLines, menuLines, pickOption } from './agent-io';
import { AgentCall, AgentTrace, CreativeOrchestrator } from './orchestrator';

export interface PageDesign {
  archetype?: string;
  imagePosition?: string;
  contentDensity?: string;
  layoutTension?: string;
}

export interface DocumentDesignPlan {
  level: CreativityLevel;
  /** Famille de mise en page choisie (Medium+), sinon celle de la graine. */
  family?: string;
  /** Réglages par page (High+), par nom de section. */
  pages: Record<string, PageDesign>;
  /** Cran Ultra : les pages sont composées par le compositeur, le gabarit en repli. */
  freeCompose: boolean;
  traces: AgentTrace[];
}

export interface DocumentDesignInput {
  level: CreativityLevel;
  call?: AgentCall;
  /** Fiche de la marque (creativity/agent-io.ts#brandSheet). */
  sheet: string;
  styleId?: string | null;
  /** « business plan », « pitch deck ». */
  document: string;
  /** Les pages, dans l'ordre, avec ce qu'elles disent (pour choisir leur mise en page). */
  pages: { name: string; brief?: string }[];
  /** L'archétype que la graine donnerait à chaque page (repli, et point de départ du menu). */
  seedArchetypes: Record<string, string>;
}

/** Une ligne de catalogue, réduite à sa première phrase (les menus restent courts). */
const firstSentence = (text: string) => text.split(/(?<=[.—])\s/)[0].slice(0, 140);

export async function planDocumentDesign(input: DocumentDesignInput): Promise<DocumentDesignPlan> {
  const orchestrator = new CreativeOrchestrator({ level: input.level, call: input.call });
  const plan: DocumentDesignPlan = { level: input.level, pages: {}, freeCompose: atLeast(input.level, 'ultra'), traces: orchestrator.traces };
  const space = styleSpaceOf(input.styleId);

  // Medium : la famille du document (sa grammaire : ouvertures, pieds, dessin des blocs).
  const families = familiesForStyle(input.styleId);
  const familyIds = families.map((f) => f.id);
  const family = await orchestrator.run<string | undefined>({
    role: 'documentFamily',
    minLevel: 'medium',
    prompt: () =>
      families.length < 2
        ? null
        : {
            system: `You choose the layout family of a whole ${input.document}, true to the brand charter and its art direction. Output ONLY: family: the letter of one option.`,
            user: [input.sheet, `PAGES: ${input.pages.map((p) => p.name).join(', ')}`, 'FAMILIES:', ...menuLines(familyIds, (id) => firstSentence(families.find((f) => f.id === id)?.description || id))].join('\n'),
          },
    parse: (raw) => pickOption(agentLines(raw).family || raw.trim(), familyIds),
    fallback: () => undefined,
  });
  if (family.value) plan.family = family.value;

  // High : un directeur artistique par page, en parallèle ; Max : il règle aussi la page.
  const tune = atLeast(input.level, 'max');
  const archetypes = space.archetypes.filter((a) => ARCHETYPE_CATALOG[a]);
  const results = await orchestrator.all(
    input.pages.map((page, i) => {
      const neighbours = [input.pages[i - 1], input.pages[i + 1]].filter(Boolean).map((p) => input.seedArchetypes[p!.name]);
      const own = input.seedArchetypes[page.name];
      const menu = [own, ...archetypes.filter((a) => a !== own && !neighbours.includes(a))].filter(Boolean).slice(0, 5);
      return {
        role: 'pageDirector',
        key: `pageDirector:${i + 1}`,
        minLevel: 'high' as const,
        prompt: () =>
          menu.length < 2
            ? null
            : {
                system: [
                  `You are the art director of ONE page of a ${input.document}, true to the brand charter and its art direction. Output ONLY these lines:`,
                  'layout: the letter of one option from LAYOUTS',
                  ...(tune
                    ? [
                        `density: one of ${space.contentDensities.join(' | ')}`,
                        `tension: one of ${space.layoutTensions.join(' | ')}`,
                        `image: one of ${space.imagePositions.slice(0, 6).join(' | ')}`,
                      ]
                    : []),
                ].join('\n'),
                user: [input.sheet, `PAGE ${i + 1} of ${input.pages.length}: ${page.name}${page.brief ? ` — ${page.brief.slice(0, 220)}` : ''}`, 'LAYOUTS:', ...menuLines(menu, (id) => firstSentence(ARCHETYPE_CATALOG[id]))].join('\n'),
              },
        parse: (raw: string): PageDesign | undefined => {
          const l = agentLines(raw);
          const archetype = pickOption(l.layout || l.archetype || (/^\W*[a-p]\W*$/i.test(raw.trim()) ? raw.trim() : undefined), menu);
          if (!archetype) return undefined;
          const out: PageDesign = { archetype };
          if (tune) {
            const density = space.contentDensities.find((d) => d.toLowerCase() === (l.density || '').toLowerCase().replace(/\s+/g, '_'));
            const tension = space.layoutTensions.find((t) => t.toLowerCase() === (l.tension || '').toLowerCase().replace(/\s+/g, '_'));
            const image = space.imagePositions.find((p) => p.toLowerCase() === (l.image || '').toLowerCase().replace(/\s+/g, '_'));
            if (density && CONTENT_DENSITY_CATALOG[density]) out.contentDensity = density;
            if (tension && LAYOUT_TENSION_CATALOG[tension]) out.layoutTension = tension;
            if (image) out.imagePosition = image;
          }
          return out;
        },
        fallback: (): PageDesign => ({}),
      };
    }),
    4
  );
  input.pages.forEach((page, i) => {
    if (results[i].source === 'llm') plan.pages[page.name] = results[i].value;
  });

  // Les choix des pages, revalidés pour le document : jamais deux pages voisines au même archétype.
  const final: (string | undefined)[] = input.pages.map((p) => plan.pages[p.name]?.archetype || input.seedArchetypes[p.name]);
  for (let i = 1; i < final.length; i++) {
    if (final[i] && final[i] === final[i - 1] && plan.pages[input.pages[i].name]?.archetype) {
      const seed = input.seedArchetypes[input.pages[i].name];
      const replacement = seed !== final[i - 1] ? seed : archetypes.find((a) => a !== final[i - 1] && a !== final[i + 1]);
      plan.pages[input.pages[i].name] = { ...plan.pages[input.pages[i].name], archetype: replacement };
      final[i] = replacement;
    }
  }

  // Max : un critique relit le rythme du document (au plus trois échanges d'archétype).
  if (tune) {
    const critic = await orchestrator.run<{ index: number; archetype: string }[]>({
      role: 'documentCritic',
      minLevel: 'max',
      profile: 'critic',
      prompt: () => ({
        system: [
          `You review the page rhythm of a ${input.document}: variety, a strong opening, calm reading pages, a memorable close — true to the brand art direction.`,
          'Propose at most 3 fixes, one per line, ONLY as: N.layout=ID (ID from LAYOUTS). If nothing needs fixing, answer: ok',
        ].join('\n'),
        user: [input.sheet, 'PAGES:', ...input.pages.map((p, i) => `${i + 1}. ${p.name}: ${final[i]}`), `LAYOUTS: ${archetypes.map((a) => `${a} (${firstSentence(ARCHETYPE_CATALOG[a]).split(' — ')[0]})`).join(', ')}`].join('\n'),
      }),
      parse: (raw) => {
        if (/^\W*ok\W*$/i.test(raw.trim())) return [];
        const fixes = [...raw.matchAll(/(\d{1,2})\s*\.\s*(?:layout|archetype)\s*[=:]\s*([A-Za-z])\b/g)]
          .map((m) => ({ index: Number(m[1]) - 1, archetype: m[2].toUpperCase() }))
          .filter((f) => f.index >= 0 && f.index < input.pages.length && archetypes.includes(f.archetype) && f.archetype !== final[f.index - 1] && f.archetype !== final[f.index + 1])
          .slice(0, 3);
        return fixes.length || /ok/i.test(raw) ? fixes : undefined;
      },
      fallback: () => [],
    });
    for (const fix of critic.value) {
      const name = input.pages[fix.index].name;
      plan.pages[name] = { ...plan.pages[name], archetype: fix.archetype };
      final[fix.index] = fix.archetype;
    }
  }
  return plan;
}

/** Ce qu'on enregistre avec le document : les décisions, pas les traces. */
export const savedDesignOf = (plan: DocumentDesignPlan): SavedDocumentDesign => ({ level: plan.level, ...(plan.family ? { family: plan.family } : {}), pages: plan.pages });

/**
 * Reprise ou régénération ciblée : des pages du document sont gardées, elles ont été composées
 * avec une direction ; les pages refaites la reprennent, sans nouvel appel aux agents (un
 * document sans direction enregistrée a été composé par la graine, qui reste la règle). Le
 * compositeur, lui, suit le cran de la demande.
 */
export function resumedDesignPlan(saved: SavedDocumentDesign | undefined, level: CreativityLevel): DocumentDesignPlan {
  return { level, ...(saved?.family ? { family: saved.family } : {}), pages: saved?.pages ?? {}, freeCompose: atLeast(level, 'ultra'), traces: [] };
}

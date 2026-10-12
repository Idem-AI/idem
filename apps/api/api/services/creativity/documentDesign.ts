/**
 * LA DIRECTION ARTISTIQUE DES DOCUMENTS (business plan, pitch deck) selon la jauge de créativité.
 *
 * Le moteur de documents décide aujourd'hui tout par une graine (`design/designSeed.ts`) : la
 * famille de mise en page du document, l'archétype de chaque page, sa densité, la place de
 * l'image. La jauge confie ces décisions aux agents, cran par cran, toujours DANS l'espace que
 * le style de la direction artistique autorise :
 *
 *   low     le CODE choisit, dans l'espace de configuration (`layoutPresets.ts`) : la meilleure
 *           mise en page pour le livrable et le style, sans un jeton
 *   medium  le code tire parmi les cinq meilleures (variété), et un agent choisit la famille
 *   high    + un directeur artistique par page choisit SA mise en page dans un menu de DIX
 *             et le DÉCOR de la page dans le menu du kit graphique (le code le pose sur les seules
 *             pages qui respirent ; en dessous de High, c'est le code qui le choisit, sans jeton)
 *   max     + il règle la densité, la tension et la place de l'image ; un critique relit le rythme ;
 *             et le COMPOSITEUR écrit les pages (deux essais) — le gabarit dirigé reste le plancher
 *   ultra     le compositeur écrit les pages avec quatre essais, un rendu mesuré PUIS RÉPARÉ et la
 *             latitude la plus large (`SectionTemplate.compose`, creativity/pageComposer.ts)
 *
 * ── CE QUI A ÉTÉ RETIRÉ ──────────────────────────────────────────────────────
 * Le classement des mises en page ne dépendait que du NUMÉRO de page : trois projets d'un même
 * style recevaient le même classement, donc les mêmes menus, donc des documents jumeaux. La clé
 * du livrable (`docKey`) entre maintenant dans le classement, et la largeur de l'espace présenté
 * monte avec le cran (`spread`, `menuWidth`).
 */
import { CreativityLevel, SavedDocumentDesign, atLeast } from '../../models/creativity.model';
import { ARCHETYPE_CATALOG, CONTENT_DENSITY_CATALOG, LAYOUT_TENSION_CATALOG, styleSpaceOf } from '../design/designSeed';
import { familiesForStyle } from '../design/layoutFamilies';
import { pageDecorMenu, pageDecorSummary, rankPageDecors } from '../../../../ivision/core/src/design/pageDecor';
import { applyPreset, PRESET_BY_ID, presetMenu, rankPresets, type LayoutDeliverable } from '../../../../ivision/core/src/design/layoutPresets';
import { agentLines, menuLines, pickOption } from './agent-io';
import { AgentCall, AgentTrace, CreativeOrchestrator } from './orchestrator';

export interface PageDesign {
  /** La mise en page retenue dans l'espace de configuration (`layoutPresets.ts`). */
  preset?: string;
  archetype?: string;
  imagePosition?: string;
  contentDensity?: string;
  layoutTension?: string;
  /** Décor du kit graphique (`design/pageDecor.ts`), posé seulement si la page respire. */
  decor?: string;
}

export interface DocumentDesignPlan {
  level: CreativityLevel;
  /** Famille de mise en page choisie (Medium+), sinon celle de la graine. */
  family?: string;
  /** Réglages par page (High+), par nom de section. */
  pages: Record<string, PageDesign>;
  /** Crans Max et Ultra : les pages sont composées par le compositeur, le gabarit en repli. */
  freeCompose: boolean;
  /** Essais accordés au compositeur (Max : 2, Ultra : 4) ; 0 en dessous. */
  composeAttempts: number;
  traces: AgentTrace[];
}

/**
 * CE QUE LE CRAN CONFIE AU MODÈLE, en trois nombres.
 *
 *   spread      la dispersion du classement des mises en page (l'espace réellement parcouru)
 *   menuWidth   la largeur du menu présenté au directeur artistique de chaque page
 *   attempts    les essais du compositeur de pages (0 : le gabarit dirigé rend la page)
 */
export function delegationOf(level: CreativityLevel): { spread: number; menuWidth: number; attempts: number } {
  switch (level) {
    case 'low':
      return { spread: 0.6, menuWidth: 0, attempts: 0 };
    case 'medium':
      return { spread: 1.1, menuWidth: 0, attempts: 0 };
    case 'high':
      return { spread: 1.5, menuWidth: 10, attempts: 0 };
    case 'max':
      return { spread: 1.9, menuWidth: 14, attempts: 2 };
    default:
      return { spread: 2.4, menuWidth: 16, attempts: 4 };
  }
}

export interface DocumentDesignInput {
  level: CreativityLevel;
  call?: AgentCall;
  /** Fiche de la marque (creativity/agent-io.ts#brandSheet). */
  sheet: string;
  styleId?: string | null;
  /** Les « à éviter » de la direction artistique : ils écartent des décors du menu. */
  donts?: string[];
  /**
   * CLÉ DU LIVRABLE (projet + document). Elle sème TOUT le classement : sans elle, deux projets
   * du même style recevaient la même suite de mises en page et le même décor — c'est-à-dire deux
   * documents jumeaux. Les appelants passent leur `designKey`.
   */
  docKey?: string;
  /** « business plan », « pitch deck ». */
  document: string;
  /** Le livrable, tel que l'espace des mises en page le nomme. */
  deliverable?: LayoutDeliverable;
  /** Les pages, dans l'ordre, avec ce qu'elles disent (pour choisir leur mise en page). */
  pages: { name: string; brief?: string }[];
  /** L'archétype que la graine donnerait à chaque page (repli, et point de départ du menu). */
  seedArchetypes: Record<string, string>;
}

/** Une ligne de catalogue, réduite à sa première phrase (les menus restent courts). */
const firstSentence = (text: string) => text.split(/(?<=[.—])\s/)[0].slice(0, 140);

/** Un index dans `[0, count)`, tiré d'une clé (FNV-1a) : stable pour un projet, autre pour le voisin. */
function hashIndex(key: string, count: number): number {
  if (count <= 1) return 0;
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0;
  }
  return (h >>> 8) % count;
}

export async function planDocumentDesign(input: DocumentDesignInput): Promise<DocumentDesignPlan> {
  const orchestrator = new CreativeOrchestrator({ level: input.level, call: input.call });
  const delegation = delegationOf(input.level);
  const plan: DocumentDesignPlan = {
    level: input.level,
    pages: {},
    freeCompose: delegation.attempts > 0,
    composeAttempts: delegation.attempts,
    traces: orchestrator.traces,
  };
  const space = styleSpaceOf(input.styleId);
  // La clé du livrable : elle sème le classement des mises en page ET celui des décors.
  const docKey = input.docKey || input.document;

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
  // ── LOW ET MEDIUM : LE CODE CHOISIT, SANS UN JETON ────────────────────────
  //
  // L'espace de configuration (`layoutPresets.ts`) est classé par livrable, par style et par ce
  // qui a déjà servi : deux pages voisines n'ont donc ni la même grammaire ni la même
  // architecture. À Low on prend la première, à Medium une des trois premières (variété).
  const deliverable: LayoutDeliverable = input.deliverable || 'business plan';
  const codePicked: string[] = [];
  input.pages.forEach((page, i) => {
    const ranked = rankPresets({ deliverable, styleId: input.styleId, seed: i + 1, used: codePicked, key: docKey, spread: delegation.spread });
    // Low prend la meilleure ; au-delà, un tirage parmi les cinq meilleures — tiré sur la CLÉ du
    // livrable, pas sur le numéro de page : c'est ce qui distingue deux projets l'un de l'autre.
    const width = input.level === 'low' ? 1 : Math.min(5, ranked.length);
    const pick = ranked[width <= 1 ? 0 : hashIndex(`${docKey}:pick:${page.name}`, width)];
    if (!pick) return;
    codePicked.push(pick.id);
    plan.pages[page.name] = { preset: pick.id, archetype: pick.archetype };
  });

  // ── LES MENUS SONT DISTRIBUÉS AVANT LES AGENTS ───────────────────────────
  //
  // Les pages sont dirigées EN PARALLÈLE : si chacune classait les mises en page de son côté,
  // elles recevraient toutes le même menu et choisiraient toutes la même — c'est exactement ce
  // qu'on observait (six pages, une seule mise en page). Les menus sont donc distribués ici,
  // séquentiellement et sans un jeton : ce qu'une page se voit proposer, la suivante ne l'a plus
  // en tête de liste.
  const dealt: string[] = [];
  const menus: { id: string; line: string }[][] = input.pages.map((_, i) => {
    const ranked = rankPresets({ deliverable, styleId: input.styleId, seed: i + 1, used: dealt, key: docKey, spread: delegation.spread });
    const menu = presetMenu(ranked, Math.max(6, delegation.menuWidth));
    // Seules les deux premières sont réservées : le menu garde du choix, la répétition recule.
    dealt.push(...menu.slice(0, 2).map((m) => m.id));
    return menu;
  });

  const usedPresets: string[] = [...codePicked];
  const results = await orchestrator.all(
    input.pages.map((page, i) => {
      const neighbours = [input.pages[i - 1], input.pages[i + 1]].filter(Boolean).map((p) => input.seedArchetypes[p!.name]);
      const own = input.seedArchetypes[page.name];
      const menu = [own, ...archetypes.filter((a) => a !== own && !neighbours.includes(a))].filter(Boolean).slice(0, 5);
      // Les mises en page de l'espace de configuration, classées pour CETTE page : la direction
      // artistique d'abord, puis ce qui n'a pas encore servi dans le document.
      const presets = menus[i];
      // Le menu des décors de CETTE page : le code les classe (style, « à éviter », graine), le
      // directeur artistique en nomme un. Il ne sera posé que si la page respire.
      const decors = pageDecorMenu(rankPageDecors({ styleId: input.styleId, donts: input.donts, docKey, pageName: page.name }));
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
                  'decor: the letter of one option from DECOR (the code draws it, and only on a page that has room for it — a dense page gets none whatever you choose)',
                  ...(tune
                    ? [
                        `density: one of ${space.contentDensities.join(' | ')}`,
                        `tension: one of ${space.layoutTensions.join(' | ')}`,
                        `image: one of ${space.imagePositions.slice(0, 6).join(' | ')}`,
                      ]
                    : []),
                ].join('\n'),
                user: [input.sheet, `PAGE ${i + 1} of ${input.pages.length}: ${page.name}${page.brief ? ` — ${page.brief.slice(0, 220)}` : ''}`, 'LAYOUTS:', ...menuLines(menu, (id) => firstSentence(ARCHETYPE_CATALOG[id])), 'DECOR:', ...menuLines(decors, pageDecorSummary)].join('\n'),
              },
        parse: (raw: string): PageDesign | undefined => {
          const l = agentLines(raw);
          // Le directeur artistique nomme une MISE EN PAGE (famille + architecture), pas un
          // archétype nu : c'est ce qui fait qu'une page de plan ne ressemble pas à la suivante.
          const presetId = pickOption(l.layout || l.preset || (/^\W*[a-f]\W*$/i.test(raw.trim()) ? raw.trim() : undefined), presets.map((p) => p.id));
          const preset = presetId ? PRESET_BY_ID.get(presetId) : undefined;
          const archetype = preset?.archetype || pickOption(l.archetype, menu);
          if (!archetype) return undefined;
          if (presetId) usedPresets.push(presetId);
          const out: PageDesign = { archetype, ...(presetId ? { preset: presetId } : {}) };
          const decor = pickOption(l.decor || l.decoration, decors);
          if (decor) out.decor = decor;
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
    if (results[i].source === 'llm') plan.pages[page.name] = { ...plan.pages[page.name], ...results[i].value };
  });

  // Deux pages ne gardent pas la même mise en page : la seconde prend la suivante de SON menu.
  const takenPresets = new Set<string>();
  input.pages.forEach((page, i) => {
    const chosen = plan.pages[page.name]?.preset;
    if (!chosen) return;
    if (!takenPresets.has(chosen)) {
      takenPresets.add(chosen);
      return;
    }
    const free = menus[i].find((m) => !takenPresets.has(m.id));
    if (!free) return;
    takenPresets.add(free.id);
    plan.pages[page.name] = { ...plan.pages[page.name], preset: free.id, archetype: PRESET_BY_ID.get(free.id)?.archetype || plan.pages[page.name]?.archetype };
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
  const delegation = delegationOf(level);
  return {
    level,
    ...(saved?.family ? { family: saved.family } : {}),
    pages: saved?.pages ?? {},
    freeCompose: delegation.attempts > 0,
    composeAttempts: delegation.attempts,
    traces: [],
  };
}

/**
 * L'ESPACE DE CONFIGURATION DES MISES EN PAGE — un seul endroit pour les déclarer, les lire et
 * les étendre.
 *
 * Le moteur sait déjà composer : 60 FAMILLES (`layoutFamilies.ts` — la grammaire d'un document :
 * en-têtes, filets, tableaux, chiffres) × 18 ARCHÉTYPES (`designSeed.ts` — l'architecture d'une
 * page) × tension × densité. Plus de mille compositions, donc, mais invisibles : rien ne disait
 * lesquelles conviennent à un business plan, à une diapositive, à une page de charte ou à une
 * carte ; rien ne permettait d'en ajouter sans ouvrir un fichier de trois mille lignes.
 *
 * Un PRÉRÉGLAGE est cette combinaison, NOMMÉE : « rapport-annuel × D (grille suisse), dense ».
 * Il porte un identifiant stable, une ligne que les agents lisent, les livrables où il a du sens,
 * et ce que le kit a le droit d'y poser. Les agents n'y choisissent jamais une mise en page
 * « libre » : ils choisissent DANS cette liste, filtrée par le livrable et la direction artistique.
 *
 * ── AJOUTER DES MISES EN PAGE ────────────────────────────────────────────────
 * Une ligne dans `CURATED` suffit : une famille, les archétypes qui lui vont, les livrables. Le
 * reste (identifiant, libellé, résumé lu par l'agent) est dérivé. Une famille nouvelle dans
 * `layoutFamilies.ts` entre ici en une ligne et donne aussitôt ses mises en page.
 */
import { ARCHETYPE_CATALOG, CONTENT_DENSITY_CATALOG, LAYOUT_TENSION_CATALOG } from './designSeed';
import { LAYOUT_FAMILIES } from './layoutFamilies';

const FAMILY_BY_ID = new Map(LAYOUT_FAMILIES.map((f) => [f.id, f]));

export type LayoutDeliverable = 'business plan' | 'pitch deck' | 'brand guidelines' | 'business card';

/** Ce que le kit a le droit de poser sur une page de ce préréglage. */
export interface PresetKitPolicy {
  /** Le décor de la charte (motif déposé) : jamais sur une page dense. */
  decor: boolean;
  /** Les blocs riches du registre (`ui.*`) : combien, au plus. */
  richBlocks: number;
  /** Les schémas (Mermaid) ont-ils leur place sur ce genre de page ? */
  diagrams: boolean;
}

/** Pour une carte de visite : ses deux faces et sa texture, au lieu d'une famille et d'un archétype. */
export interface CardComposition {
  front: string;
  back: string;
  pattern: string;
  surface: 'primary' | 'secondary' | 'accent';
}

export interface LayoutPreset {
  /** `bp.rapport-annuel.D` — stable, c'est ce que l'agent nomme et ce qu'on enregistre. */
  id: string;
  label: string;
  /** Une ligne, en anglais : c'est ce que l'agent lit dans son menu. */
  summary: string;
  deliverables: LayoutDeliverable[];
  family: string;
  archetype: string;
  tension?: string;
  density?: string;
  kit: PresetKitPolicy;
  /** Les styles de direction artistique auxquels il convient le mieux (vide : tous). */
  styles?: string[];
  /** Carte de visite : la composition de ses deux faces (la famille et l'archétype n'y servent pas). */
  card?: CardComposition;
}

/**
 * LA TABLE DE CURATION — la seule chose à modifier pour ajouter des mises en page.
 *
 * Chaque ligne dit : cette famille, avec ces architectures de page, pour ces livrables. Les
 * paires sont choisies, pas combinatoires : une grille suisse convient à un plan et à un deck,
 * pas à une carte de visite ; une affiche convient à une ouverture, pas à une page de tableaux.
 */
interface CuratedRow {
  family: string;
  archetypes: string[];
  deliverables: LayoutDeliverable[];
  /** Décor et blocs riches, par défaut pour toute la ligne. */
  kit?: Partial<PresetKitPolicy>;
  tension?: string;
  density?: string;
}

/** Les architectures de page, par usage — elles servent à écrire la table sans se répéter. */
const EDITORIAL = ['A', 'E', 'G', 'N', 'R', 'O'];
const STRUCTURAL = ['D', 'M', 'Q', 'P', 'N'];
const DATA = ['L', 'D', 'N', 'G'];
const STATEMENT = ['C', 'B', 'E', 'O', 'M'];
const VISUAL = ['A', 'B', 'F', 'H', 'J', 'K'];

export const CURATED: CuratedRow[] = [
  // ── Business plan : il se lit longtemps, il doit rester clair et varié ────
  { family: 'rapport-annuel', archetypes: [...EDITORIAL, ...DATA], deliverables: ['business plan'], kit: { richBlocks: 2 } },
  { family: 'grand-livre', archetypes: [...DATA, 'P', 'M'], deliverables: ['business plan'], kit: { richBlocks: 2, decor: false } },
  { family: 'dossier-technique', archetypes: [...STRUCTURAL, 'L'], deliverables: ['business plan'] },
  { family: 'grille-modulaire', archetypes: [...STRUCTURAL, ...EDITORIAL], deliverables: ['business plan', 'pitch deck'] },
  { family: 'monographie', archetypes: [...EDITORIAL, 'E', 'P'], deliverables: ['business plan'] },
  { family: 'atlas', archetypes: [...VISUAL, 'N'], deliverables: ['business plan', 'pitch deck'] },
  { family: 'tableau-de-bord', archetypes: [...DATA, 'Q'], deliverables: ['business plan', 'pitch deck'], kit: { richBlocks: 3 } },
  { family: 'cahier', archetypes: [...EDITORIAL, 'M'], deliverables: ['business plan'] },
  { family: 'brochure', archetypes: [...EDITORIAL, ...VISUAL], deliverables: ['business plan', 'pitch deck'] },
  { family: 'revue', archetypes: [...EDITORIAL, 'C'], deliverables: ['business plan'] },
  { family: 'gazette', archetypes: ['G', 'N', 'R', 'O'], deliverables: ['business plan'] },
  { family: 'almanach', archetypes: [...DATA, 'P'], deliverables: ['business plan'] },
  { family: 'carnet', archetypes: [...EDITORIAL, 'E'], deliverables: ['business plan'], kit: { richBlocks: 1 } },
  { family: 'catalogue', archetypes: [...STRUCTURAL, 'A'], deliverables: ['business plan', 'brand guidelines'] },

  // ── Pitch deck : une diapositive, une idée, et elle se voit de loin ───────
  { family: 'affiche', archetypes: [...STATEMENT, ...VISUAL], deliverables: ['pitch deck'], kit: { decor: true, richBlocks: 1 } },
  { family: 'manifeste', archetypes: [...STATEMENT], deliverables: ['pitch deck'], kit: { richBlocks: 0 } },
  { family: 'planche', archetypes: [...VISUAL, 'L'], deliverables: ['pitch deck'] },
  { family: 'programme', archetypes: ['M', 'Q', 'O', 'N'], deliverables: ['pitch deck'] },
  { family: 'terminal', archetypes: [...DATA, 'I'], deliverables: ['pitch deck'], kit: { decor: false } },
  { family: 'fanzine', archetypes: ['H', 'C', 'K', 'B'], deliverables: ['pitch deck'] },

  { family: 'livre-blanc', archetypes: [...EDITORIAL, 'L'], deliverables: ['business plan'] },
  { family: 'rapport-financier', archetypes: [...DATA, 'P', 'M'], deliverables: ['business plan'], kit: { decor: false } },
  { family: 'rapport-impact', archetypes: [...EDITORIAL, ...DATA], deliverables: ['business plan', 'pitch deck'] },
  { family: 'annuaire', archetypes: [...STRUCTURAL], deliverables: ['business plan'] },
  { family: 'bulletin', archetypes: ['G', 'N', 'R'], deliverables: ['business plan'] },
  { family: 'colonnes', archetypes: ['N', 'R', 'G', 'A'], deliverables: ['business plan'] },

  // ── Pitch deck (suite) : chaque diapositive porte une idée ───────────────
  { family: 'vitrine', archetypes: [...VISUAL, ...STATEMENT], deliverables: ['pitch deck'] },
  { family: 'epure', archetypes: ['E', 'C', 'O', 'M'], deliverables: ['pitch deck'] },
  { family: 'fresque', archetypes: [...VISUAL, 'B'], deliverables: ['pitch deck'] },
  { family: 'panneau-expo', archetypes: [...STATEMENT, 'P'], deliverables: ['pitch deck'] },
  { family: 'storyboard', archetypes: ['H', 'N', 'G', 'F'], deliverables: ['pitch deck'] },
  { family: 'salle-de-controle', archetypes: [...DATA, 'I'], deliverables: ['pitch deck'], kit: { richBlocks: 3 } },
  { family: 'carton', archetypes: [...STATEMENT], deliverables: ['pitch deck'] },

  // ── Charte graphique : elle MONTRE la marque, le décor y est un spécimen ──
  { family: 'planche', archetypes: ['P', 'E', 'A', 'J'], deliverables: ['brand guidelines'], kit: { decor: false, richBlocks: 1, diagrams: false } },
  { family: 'monographie', archetypes: ['E', 'A', 'P', 'O'], deliverables: ['brand guidelines'], kit: { decor: false, diagrams: false } },
  { family: 'catalogue', archetypes: ['D', 'N', 'P'], deliverables: ['brand guidelines'], kit: { decor: false, diagrams: false } },
  { family: 'affiche', archetypes: ['C', 'B', 'E'], deliverables: ['brand guidelines'], kit: { decor: false, richBlocks: 0, diagrams: false } },
  { family: 'cartel', archetypes: ['P', 'E', 'N', 'O', 'A'], deliverables: ['brand guidelines'], kit: { decor: false, diagrams: false } },
  { family: 'herbier', archetypes: ['P', 'D', 'N', 'E'], deliverables: ['brand guidelines'], kit: { decor: false, diagrams: false } },
  { family: 'portfolio', archetypes: [...VISUAL, 'E', 'P'], deliverables: ['brand guidelines'], kit: { decor: false, diagrams: false } },
  { family: 'notice', archetypes: [...STRUCTURAL, 'G'], deliverables: ['brand guidelines'], kit: { decor: false, diagrams: false } },
  { family: 'mode-emploi', archetypes: [...STRUCTURAL, 'O'], deliverables: ['brand guidelines'], kit: { decor: false, diagrams: false } },
  { family: 'composition-typo', archetypes: ['C', 'E', 'P', 'R', 'O'], deliverables: ['brand guidelines'], kit: { decor: false, richBlocks: 0, diagrams: false } },
  { family: 'signaletique', archetypes: ['M', 'Q', 'D', 'P'], deliverables: ['brand guidelines'], kit: { decor: false, diagrams: false } },
  { family: 'coffret', archetypes: ['E', 'A', 'J', 'P'], deliverables: ['brand guidelines'], kit: { decor: false, diagrams: false } },
  { family: 'manuel', archetypes: [...STRUCTURAL, ...EDITORIAL], deliverables: ['brand guidelines'], kit: { decor: false, diagrams: false } },
  { family: 'fiche-produit', archetypes: ['D', 'N', 'P', 'L'], deliverables: ['brand guidelines'], kit: { decor: false, diagrams: false } },
  { family: 'relief', archetypes: ['J', 'F', 'E', 'A'], deliverables: ['brand guidelines'], kit: { decor: false, diagrams: false } },
  { family: 'planisphere', archetypes: ['E', 'A', 'P'], deliverables: ['brand guidelines'], kit: { decor: false, diagrams: false } },
  { family: 'catalogue-raisonne', archetypes: ['P', 'D', 'N', 'E', 'A'], deliverables: ['brand guidelines'], kit: { decor: false, diagrams: false } },
  { family: 'dossier-de-presse', archetypes: [...EDITORIAL], deliverables: ['brand guidelines'], kit: { decor: false, diagrams: false } },
  { family: 'magazine-mode', archetypes: [...VISUAL, 'E'], deliverables: ['brand guidelines'], kit: { decor: false, diagrams: false } },
  { family: 'chronique', archetypes: [...EDITORIAL, 'M'], deliverables: ['brand guidelines'], kit: { decor: false, diagrams: false } },
];

/**
 * LA TABLE DES CARTES DE VISITE — recto × verso × texture.
 *
 * Une carte n'a ni famille ni archétype : elle a deux faces et une matière. Le vocabulaire est
 * celui de `businessCardLayouts.ts` ; une face nouvelle y entre, et ses cartes apparaissent ici.
 */
const CARD_FRONTS = ['logoCenter', 'patternField', 'monogram', 'logoCornerName', 'bandBottom', 'splitColor'] as const;
const CARD_BACKS = ['contactsList', 'contactsColumns', 'centered', 'accentBar', 'logoOnly'] as const;
const CARD_PATTERNS = ['weave', 'stripes', 'contours', 'dots', 'arcs', 'grid'] as const;
/** Les paires de faces qui se tiennent : une face de marque appelle un verso de contacts. */
const CARD_PAIRS: [string, string][] = [
  ['logoCenter', 'contactsList'], ['logoCenter', 'contactsColumns'], ['logoCenter', 'accentBar'], ['logoCenter', 'centered'],
  ['patternField', 'contactsList'], ['patternField', 'contactsColumns'], ['patternField', 'accentBar'], ['patternField', 'centered'],
  ['monogram', 'contactsList'], ['monogram', 'centered'], ['monogram', 'accentBar'],
  ['logoCornerName', 'contactsList'], ['logoCornerName', 'contactsColumns'], ['logoCornerName', 'centered'],
  ['bandBottom', 'contactsList'], ['bandBottom', 'accentBar'],
  ['splitColor', 'logoOnly'], ['splitColor', 'contactsColumns'],
];

function cardPresets(): LayoutPreset[] {
  const out: LayoutPreset[] = [];
  const surfaces: CardComposition['surface'][] = ['primary', 'secondary', 'accent'];
  for (const [front, back] of CARD_PAIRS) {
    // La texture ne vaut que pour les faces qui en portent une ; ailleurs, une seule déclinaison.
    const patterns = front === 'patternField' ? CARD_PATTERNS : [CARD_PATTERNS[0]];
    for (const pattern of patterns) {
      for (const surface of surfaces) {
        out.push({
          id: `card.${front}-${back}${front === 'patternField' ? `.${pattern}` : ''}.${surface}`,
          label: `${front} / ${back} · ${surface}`,
          summary: `front ${front}, back ${back}, brand face in ${surface}${front === 'patternField' ? `, ${pattern} texture` : ''}`,
          deliverables: ['business card'],
          family: 'carton',
          archetype: 'E',
          kit: { decor: false, richBlocks: 0, diagrams: false },
          card: { front, back, pattern, surface },
        });
      }
    }
  }
  return out;
}

/** Le résumé que l'agent lit : l'architecture de la page, puis la grammaire du document. */
function summaryOf(family: string, archetype: string): string {
  const arch = (ARCHETYPE_CATALOG[archetype] || '').split('—').slice(1).join('—').trim() || ARCHETYPE_CATALOG[archetype] || archetype;
  const fam = FAMILY_BY_ID.get(family);
  const head = arch.split(/\.\s/)[0];
  return `${head}. ${fam ? fam.brief.split(/\.\s/)[0] : family}.`;
}

const DEFAULT_KIT: PresetKitPolicy = { decor: true, richBlocks: 2, diagrams: true };

function buildPresets(): LayoutPreset[] {
  const out: LayoutPreset[] = [];
  const seen = new Set<string>();
  for (const row of CURATED) {
    const family = FAMILY_BY_ID.get(row.family);
    for (const archetype of row.archetypes) {
      if (!ARCHETYPE_CATALOG[archetype]) continue;
      for (const deliverable of row.deliverables) {
        const prefix = deliverable === 'business plan' ? 'bp' : deliverable === 'pitch deck' ? 'deck' : deliverable === 'brand guidelines' ? 'brand' : 'card';
        const id = `${prefix}.${row.family}.${archetype}`;
        if (seen.has(id)) continue;
        seen.add(id);
        out.push({
          id,
          label: `${family?.name || row.family} · ${archetype}`,
          summary: summaryOf(row.family, archetype),
          deliverables: [deliverable],
          family: row.family,
          archetype,
          ...(row.tension ? { tension: row.tension } : {}),
          ...(row.density ? { density: row.density } : {}),
          kit: { ...DEFAULT_KIT, ...row.kit },
          ...(family?.fits?.length ? { styles: family.fits as string[] } : {}),
        });
      }
    }
  }
  return out;
}

export const LAYOUT_PRESETS: LayoutPreset[] = [...buildPresets(), ...cardPresets()];
export const PRESET_BY_ID = new Map(LAYOUT_PRESETS.map((p) => [p.id, p]));

/** Les mises en page d'un livrable, et combien il y en a. */
export const presetsFor = (deliverable: LayoutDeliverable): LayoutPreset[] => LAYOUT_PRESETS.filter((p) => p.deliverables.includes(deliverable));

/**
 * Les mises en page classées pour CETTE page : la direction artistique d'abord, puis la graine,
 * puis ce qui n'a pas encore servi dans le document (deux pages voisines ne se ressemblent pas).
 */
export function rankPresets(input: { deliverable: LayoutDeliverable; styleId?: string | null; seed: number; used?: string[] }): LayoutPreset[] {
  const style = String(input.styleId || '').toLowerCase();
  const used = input.used || [];
  const usedFamilies = used.map((id) => PRESET_BY_ID.get(id)?.family).filter(Boolean);
  return presetsFor(input.deliverable)
    .map((p, i) => {
      let weight = p.styles?.length ? (p.styles.includes(style) ? 1.4 : 0.2) : 0.8;
      // Ce qui a déjà servi recule : la variété est tenue par le code, pas espérée du modèle.
      weight -= used.includes(p.id) ? 2 : 0;
      weight -= usedFamilies.filter((f) => f === p.family).length * 0.35;
      weight -= used[used.length - 1] && PRESET_BY_ID.get(used[used.length - 1])?.archetype === p.archetype ? 0.8 : 0;
      weight += (((input.seed + i * 2654435761) >>> 0) % 1000) / 1000 * 0.5;
      return { p, weight };
    })
    .sort((a, b) => b.weight - a.weight)
    .map((x) => x.p);
}

/** Le menu de l'agent : court, une ligne par mise en page. */
export const presetMenu = (presets: LayoutPreset[], count = 6) => presets.slice(0, count).map((p) => ({ id: p.id, line: `${p.label} — ${p.summary}` }));

/** La graine d'une page, une fois le préréglage appliqué. */
export function applyPreset<T extends { family: string; archetype: string; layoutTension: string; contentDensity: string }>(seed: T, preset: LayoutPreset | undefined): T {
  if (!preset) return seed;
  return {
    ...seed,
    family: preset.family,
    archetype: preset.archetype,
    ...(preset.tension && LAYOUT_TENSION_CATALOG[preset.tension] ? { layoutTension: preset.tension } : {}),
    ...(preset.density && CONTENT_DENSITY_CATALOG[preset.density] ? { contentDensity: preset.density } : {}),
  };
}

/** Ce que l'espace contient, par livrable — lu par les contrôles et par la documentation. */
export function presetCoverage(): Record<LayoutDeliverable, number> {
  return {
    'business plan': presetsFor('business plan').length,
    'pitch deck': presetsFor('pitch deck').length,
    'brand guidelines': presetsFor('brand guidelines').length,
    'business card': presetsFor('business card').length,
  };
}

export { LAYOUT_FAMILIES };

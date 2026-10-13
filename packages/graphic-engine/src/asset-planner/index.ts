/**
 * Le PLANIFICATEUR DE MÉDIAS — avant de composer, savoir ce que la page doit MONTRER, ce qui existe déjà et
 * ce qu'il faut aller chercher ou créer.
 *
 *   1. PLAN     `planAssets` : de l'intention de la page (sa stratégie visuelle, l'image qu'elle appelle) et
 *               de son contenu (les points sans image) → des besoins (`AssetRequirement`), sans réseau ;
 *   2. RÉSOLUTION `resolveAssets` : chaque besoin essaie ses sources dans l'ordre fixe — fournis par
 *               l'utilisateur, ressources du projet, captures réelles, génération, banque d'images, composition
 *               native — chez les fournisseurs que l'HÔTE a branchés. Le moteur ne connaît aucune API : un
 *               fournisseur se remplace (banque, modèle auto-hébergé) sans toucher au directeur créatif ;
 *   3. POSE     `applyAssets` : la figure ajoutée à la section, l'icône ou le média posé sur son point — et,
 *               faute de média, le repli DIT : la stratégie de la page change (une page « pleine image » sans
 *               image redevient éditoriale), jamais une fausse image.
 *
 * Une capture de produit n'est jamais générée ni prise dans une banque : on ne fabrique pas une interface.
 * La génération est réservée aux crans qui la paient (High et au-delà) et plafonnée par document.
 */
import type { CreativityLevel, DocumentType } from '../contracts/common';
import type { Block, SectionContent } from '../contracts/content-model';
import { ASSET_SOURCE_ORDER, AssetRequirement, AssetSource, ResolvedAsset, VisualStrategy } from '../contracts/slide-intent';
import { searchIcons } from '../capability-registry/local/icons';
import type { FormatDef } from '../design-system/formats';
import { atLeast } from '../orchestrator/policies';

export interface AssetContext {
  level: CreativityLevel;
  documentType: DocumentType;
  locale?: string;
  userId?: string;
  projectId?: string;
  /** Le nom et le style de la marque : une image générée suit la direction artistique. */
  brandName?: string;
  styleId?: string;
  keywords?: string[];
}

/** Un fournisseur de médias, branché par l'hôte pour UNE source. `null` : rien trouvé (on passe au suivant). */
export interface AssetProvider {
  resolve(requirement: AssetRequirement, ctx: AssetContext): Promise<Omit<ResolvedAsset, 'assetId' | 'source'> | null>;
}

export type AssetProviders = Partial<Record<AssetSource, AssetProvider>>;

/** Combien d'images un document peut FAIRE GÉNÉRER, par cran : la génération coûte, elle se paie à High+. */
export const GENERATION_CAP: Record<CreativityLevel, number> = { low: 0, medium: 0, high: 3, max: 5, ultra: 8 };

const IMAGE_SOURCES: AssetSource[] = ['user', 'project', 'generated', 'stock'];

// ── 1. Le plan ──────────────────────────────────────────────────────────────────────────────

/** Les besoins de médias d'une section, d'après son intention. Une section sans intention n'en a aucun. */
export function planAssets(section: SectionContent, format: Pick<FormatDef, 'width' | 'height'>): AssetRequirement[] {
  const intent = section.intent;
  if (!intent) return [];
  const out: AssetRequirement[] = [];
  const hasFigure = section.blocks.some((b) => b.kind === 'figure');
  const purpose = (intent.keyMessage ?? section.title).slice(0, 240);
  const subject = (intent.image?.subject ?? section.title).slice(0, 240);
  const page = Math.round((format.width / format.height) * 100) / 100;
  const image = (role: AssetRequirement['role'], aspectRatio: number, safeArea: AssetRequirement['safeArea'], sources: AssetSource[], fallback: AssetRequirement['fallback']): AssetRequirement => ({
    assetId: `${section.id}.${role}`.slice(0, 96),
    role,
    purpose,
    subject,
    ...(intent.image?.framing ? { framing: intent.image.framing } : {}),
    ...(intent.image?.mood ? { mood: intent.image.mood } : {}),
    aspectRatio,
    safeArea,
    sources,
    fallback,
    target: {},
  });

  switch (intent.visualStrategy) {
    case 'full-bleed':
    case 'collage':
      if (!hasFigure) out.push(image('photo', page, 'left', IMAGE_SOURCES, 'downgrade'));
      break;
    case 'product-capture':
      // Une capture vient du produit, ou n'est pas : ni génération, ni banque.
      if (!hasFigure) out.push(image('product-capture', 1.6, 'none', ['user', 'project', 'capture'], 'downgrade'));
      break;
    case 'illustration':
      if (!hasFigure && intent.image) out.push(image('illustration', 1.4, 'none', IMAGE_SOURCES, 'skip'));
      break;
    default:
      break;
  }

  // Chaque point sans image reçoit son icône (composition native, sans réseau ni coût).
  for (const block of section.blocks) {
    if (block.kind !== 'points') continue;
    block.items.forEach((item, i) => {
      if (item.icon || item.media) return;
      out.push({ assetId: `${block.id}.${i}.icon`.slice(0, 96), role: 'icon', purpose: item.label.slice(0, 240), subject: (item.visual ?? item.label).slice(0, 240), aspectRatio: 1, safeArea: 'none', sources: ['native'], fallback: 'skip', target: { blockId: block.id, item: i } });
    });
  }
  return out;
}

// ── 2. La résolution ────────────────────────────────────────────────────────────────────────

/**
 * Les mots courants d'un livrable d'entreprise vers les icônes qui les montrent. La recherche par nom de
 * fichier trouve le reste (« coffee », « truck », « school »).
 */
const ICON_SYNONYMS: Record<string, string> = {
  money: 'cash', price: 'tag', cost: 'receipt', revenue: 'coin', profit: 'trending-up', growth: 'trending-up', decline: 'trending-down',
  customer: 'user', customers: 'users', people: 'users', team: 'users-group', women: 'woman', farmer: 'plant', farmers: 'plant', farm: 'plant-2',
  time: 'clock', delay: 'hourglass', speed: 'bolt', quality: 'rosette', trust: 'shield-check', security: 'lock', risk: 'alert-triangle',
  phone: 'device-mobile', mobile: 'device-mobile', app: 'apps', website: 'world-www', internet: 'world', data: 'database', ai: 'sparkles',
  shop: 'building-store', store: 'building-store', market: 'building-store', factory: 'building-factory', office: 'building', city: 'building-skyscraper',
  delivery: 'truck-delivery', transport: 'truck', logistics: 'truck', export: 'ship', import: 'package-import', product: 'package', stock: 'packages',
  school: 'school', training: 'school', education: 'book', health: 'heart-rate-monitor', water: 'droplet', energy: 'bolt', solar: 'solar-panel',
  partner: 'heart-handshake', partnership: 'heart-handshake', contract: 'file-certificate', law: 'scale', bank: 'building-bank', loan: 'building-bank',
  idea: 'bulb', vision: 'eye', goal: 'target', target: 'target', map: 'map-2', location: 'map-pin', search: 'search', chart: 'chart-bar', payment: 'credit-card',
};

/** L'icône locale d'un mot-clé (« coffee beans », « delivery truck »), ou `null`. */
export function iconFor(subject: string): string | null {
  const words = subject
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1);
  const whole = words.join('-');
  if (whole && searchIcons(whole).includes(whole)) return whole;
  for (const w of [...words].sort((a, b) => b.length - a.length)) {
    if (ICON_SYNONYMS[w]) return ICON_SYNONYMS[w];
    const exact = searchIcons(w);
    if (exact.includes(w)) return w;
    if (exact.length) return exact[0];
  }
  return null;
}

/** Le fournisseur NATIF du moteur : les icônes locales (Tabler, Lucide), sans réseau. */
export const nativeProvider: AssetProvider = {
  async resolve(req) {
    if (req.role !== 'icon') return null;
    const icon = iconFor(req.subject) ?? iconFor(req.purpose);
    return icon ? { icon, provenance: { provider: 'tabler', license: 'MIT' } } : null;
  },
};

export interface AssetResolution {
  resolved: ResolvedAsset[];
  missing: AssetRequirement[];
  /** Ce qui a été essayé, pour la trace : `assetId ← source (fournisseur)` ou `assetId ✗`. */
  log: string[];
  generated: number;
}

/**
 * Essaie chaque besoin chez les fournisseurs de ses sources, dans l'ordre fixe. Un fournisseur qui échoue
 * (réseau, quota) passe la main au suivant ; il ne fait jamais échouer la page.
 */
export async function resolveAssets(requirements: AssetRequirement[], providers: AssetProviders, ctx: AssetContext, o: { generationLeft: number }): Promise<AssetResolution> {
  const all: AssetProviders = { native: nativeProvider, ...providers };
  const out: AssetResolution = { resolved: [], missing: [], log: [], generated: 0 };
  for (const req of requirements) {
    let hit: ResolvedAsset | null = null;
    const sources = ASSET_SOURCE_ORDER.filter((s) => req.sources.includes(s));
    for (const source of sources) {
      if (source === 'generated' && (!atLeast(ctx.level, 'high') || out.generated >= o.generationLeft)) continue;
      const provider = all[source];
      if (!provider) continue;
      try {
        const found = await provider.resolve(req, ctx);
        if (found && (found.url || found.icon)) {
          hit = { assetId: req.assetId, source, ...found };
          if (source === 'generated') out.generated += 1;
          break;
        }
      } catch {
        // Un fournisseur en panne n'arrête rien : la source suivante est essayée.
      }
    }
    if (hit) {
      out.resolved.push(hit);
      out.log.push(`${req.assetId} ← ${hit.source} (${hit.provenance.provider})`);
    } else {
      out.missing.push(req);
      out.log.push(`${req.assetId} ✗`);
    }
  }
  return out;
}

// ── 3. La pose ──────────────────────────────────────────────────────────────────────────────

/** La stratégie qui remplace une stratégie privée de son média : les points illustrés s'il y en a, sinon l'éditorial. */
const downgrade = (section: SectionContent): VisualStrategy => (section.blocks.some((b) => b.kind === 'points') ? 'illustration' : 'editorial');

/** Les médias posés dans la section ; les besoins restés sans média appliquent leur repli. */
export function applyAssets(section: SectionContent, resolution: Pick<AssetResolution, 'resolved' | 'missing'>, requirements: AssetRequirement[]): { section: SectionContent; notes: string[] } {
  const notes: string[] = [];
  const byId = new Map(requirements.map((r) => [r.assetId, r]));
  let blocks: Block[] = section.blocks.map((b) => (b.kind === 'points' ? { ...b, items: b.items.map((i) => ({ ...i })) } : b));
  const figures: Block[] = [];
  for (const asset of resolution.resolved) {
    const req = byId.get(asset.assetId);
    if (!req) continue;
    if (req.target.blockId !== undefined && req.target.item !== undefined) {
      const block = blocks.find((b) => b.id === req.target.blockId);
      const item = block && block.kind === 'points' ? block.items[req.target.item] : undefined;
      if (!item) continue;
      if (asset.icon) item.icon = asset.icon;
      else if (asset.url) item.media = { url: asset.url, alt: (asset.alt ?? item.label).slice(0, 200) };
      continue;
    }
    if (!asset.url) continue;
    figures.push({ id: `asset-${figures.length + 1}`, kind: 'figure', origin: 'system', url: asset.url, alt: (asset.alt ?? req.subject).slice(0, 200), ...(asset.focal ? { focal: asset.focal } : {}) });
  }
  // La figure vient après les mots qu'elle illustre : l'ordre de lecture reste celui du rédacteur.
  blocks = [...blocks, ...figures];
  let intent = section.intent;
  for (const req of resolution.missing) {
    if (req.fallback !== 'downgrade' || !intent) continue;
    const next = downgrade(section);
    notes.push(`${req.assetId} introuvable : stratégie « ${intent.visualStrategy} » → « ${next} »`);
    intent = { ...intent, visualStrategy: next };
  }
  return { section: { ...section, blocks, ...(intent ? { intent } : {}) }, notes };
}

/**
 * LE REGISTRE DES RESSOURCES D'UN PROJET — commun aux documents (deck, business plan) et aux vidéos.
 *
 * Chaque livrable obtient des médias : une photo générée pour le deck, un clip pour une vidéo, la capture
 * du site lue au scan, les photos importées. Avant, chacun les refaisait. Le registre les réunit :
 *
 *   inscrites   ce que les générateurs ont fait générer ou trouvé en banque (gardé par l'hôte) ;
 *   dérivées    ce que la marque possède déjà — ses captures (site, produit), ses photos, les fonds de ses
 *               visuels, les médias de ses vidéos — relues à chaque appel, jamais recopiées.
 *
 * Le moteur graphique (`resolveAssets`) et le sourcing vidéo (`sourceShots`) y cherchent AVANT de générer,
 * et y inscrivent ce qu'ils produisent. Le contrat (`AssetRecord`) est celui de @idem/graphic-engine.
 */
import type { AssetRecord, AssetRegistry } from '@idem/graphic-engine';
import type { VideoBrandContext } from '../video/video.store';

/** Le stockage clé → ressources de l'hôte (Redis chez IDEM, MongoDB chez iVision). */
export interface AssetRecordStore {
  get(projectId: string): Promise<AssetRecord[]>;
  set(projectId: string, records: AssetRecord[]): Promise<void>;
}

/** Au-delà, les plus anciennes inscriptions cèdent la place. */
export const MAX_RECORDS = 200;

const clip = (value: string | undefined, max: number): string => String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);

/** Ce que la marque possède déjà, au format du registre. */
export function recordsFromBrand(brand: Pick<VideoBrandContext, 'visuals' | 'videos' | 'media'>): AssetRecord[] {
  const out: AssetRecord[] = [];
  for (const m of brand.media || []) {
    const note = clip(m.note, 240) || (m.kind === 'screen' ? 'screenshot of the brand website or product' : 'photo of the brand');
    const screen = m.kind === 'screen' || /^screenshot/i.test(note);
    out.push({ id: `brand:${m.url}`.slice(0, 120), url: m.url, kind: 'image', role: screen ? 'product-capture' : 'photo', source: screen ? 'capture' : 'user', subject: note.replace(/^(screenshot|photo)\s*:\s*/i, '') || note, origin: screen ? 'capture' : 'upload', provenance: { provider: screen ? 'capture' : 'import' } });
  }
  for (const v of brand.visuals || []) {
    const anyV = v as { backgroundImageUrl?: string; photo?: { subject?: string }; imageAnalysis?: { subject?: string }; imageSource?: string; copy?: { headline?: string } };
    if (!anyV.backgroundImageUrl) continue;
    const subject = clip(anyV.photo?.subject || anyV.imageAnalysis?.subject || anyV.copy?.headline, 240);
    if (!subject) continue;
    out.push({ id: `visual:${anyV.backgroundImageUrl}`.slice(0, 120), url: anyV.backgroundImageUrl, kind: 'image', role: 'photo', source: anyV.imageSource === 'stock' ? 'stock' : anyV.imageSource === 'upload' ? 'user' : 'generated', subject, origin: 'visual', provenance: { provider: anyV.imageSource || 'visual' } });
  }
  for (const video of brand.videos || []) {
    for (const m of video.media || []) {
      if ((m.kind !== 'image' && m.kind !== 'video') || !m.name) continue;
      const source = m.origin === 'upload' ? 'user' : m.origin === 'pexels' ? 'stock' : m.origin === 'generated' ? 'generated' : null;
      if (!source) continue;
      out.push({ id: `video:${m.id}`.slice(0, 120), url: m.url, kind: m.kind, role: m.kind === 'video' ? 'clip' : 'photo', source, subject: clip(m.name, 240), ...(m.width ? { width: m.width } : {}), ...(m.height ? { height: m.height } : {}), origin: 'video', provenance: { provider: m.origin, ...(m.credit ? { attribution: clip(m.credit, 160) } : {}), ...(m.sourceUrl ? { sourceUrl: m.sourceUrl } : {}) } });
    }
  }
  return out;
}

/**
 * Le registre d'un hôte : ses inscriptions (`store`) et ce que la marque possède (`loadBrand`). Une même
 * adresse n'y figure qu'une fois ; l'inscription la plus récente l'emporte.
 */
export function createAssetRegistry(o: { store: AssetRecordStore; loadBrand: (userId: string, projectId: string) => Promise<Pick<VideoBrandContext, 'visuals' | 'videos' | 'media'> | null> }): AssetRegistry {
  return {
    async list(ctx) {
      if (!ctx.projectId) return [];
      const [stored, brand] = await Promise.all([o.store.get(ctx.projectId).catch(() => [] as AssetRecord[]), ctx.userId ? o.loadBrand(ctx.userId, ctx.projectId).catch(() => null) : Promise.resolve(null)]);
      const byUrl = new Map<string, AssetRecord>();
      for (const r of [...(brand ? recordsFromBrand(brand) : []), ...stored]) byUrl.set(r.url, r);
      return [...byUrl.values()];
    },
    async remember(ctx, records) {
      if (!ctx.projectId || !records.length) return;
      const stored = await o.store.get(ctx.projectId).catch(() => [] as AssetRecord[]);
      const urls = new Set(records.map((r) => r.url));
      await o.store.set(ctx.projectId, [...stored.filter((r) => !urls.has(r.url)), ...records].slice(-MAX_RECORDS));
    },
  };
}

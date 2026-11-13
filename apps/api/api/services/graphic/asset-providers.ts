/**
 * Les FOURNISSEURS DE MÉDIAS d'IDEM pour le planificateur du moteur graphique (@idem/graphic-engine).
 *
 * Le moteur décide de ce que la page doit montrer et de l'ordre des sources ; ici, chaque source est
 * branchée sur ce qu'IDEM sait déjà faire, sans nouveau circuit :
 *  · `generated` — le service de sourcing des visuels : image sans texte (consigne positive, relue par la
 *    vision, second essai si elle en voit), stockée dans le dossier du projet. Le moteur ne l'appelle
 *    qu'aux crans High et au-delà, dans un plafond par document ;
 *  · `stock`     — la banque Pexels du même service : le REPLI d'une génération qui échoue (le moteur ordonne).
 *
 * Les sources `user`, `project` et `capture` sont servies par le REGISTRE des ressources du projet
 * (`asset-registry.ts`, commun aux documents et aux vidéos) : imports, captures du site, médias des visuels et
 * des vidéos. Sans capture, une page qui en exige une retombe sur ses points illustrés (le repli est tracé) —
 * jamais une fausse interface.
 */
import type { AssetContext, AssetProvider, AssetProviders, AssetRequirement } from '@idem/graphic-engine';
import logger from '../../config/logger';
import { imageSourcingService, ImageBrief } from '../Communication/imageSourcing.service';

const orientationOf = (ratio: number): ImageBrief['orientation'] => (ratio > 1.15 ? 'landscape' : ratio < 0.87 ? 'portrait' : 'square');

const SAFE_AREA: Record<AssetRequirement['safeArea'], string> = {
  left: 'Keep the left third calm and uncluttered (a text panel will sit there).',
  right: 'Keep the right third calm and uncluttered (a text panel will sit there).',
  top: 'Keep the top third calm and uncluttered.',
  bottom: 'Keep the bottom third calm and uncluttered.',
  none: '',
};

/** Le brief d'une image : ce qu'elle montre, son cadrage, son ambiance, la direction artistique, la zone calme. */
export function imageBrief(req: AssetRequirement, ctx: AssetContext): ImageBrief {
  // Le traitement de l'image de la CHARTE commande (médium, traitement, lumière) : une marque en aplats vectoriels
  // ne reçoit pas de photographie. Sans charte, le rôle du besoin décide.
  const kind = ctx.imagery ? 'An image' : req.role === 'illustration' ? 'An editorial illustration' : 'A documentary photograph';
  const style = [ctx.styleId ? `${ctx.styleId} art direction` : '', ...(ctx.keywords ?? []).slice(0, 4)].filter(Boolean).join(', ');
  return {
    searchQuery: req.subject.slice(0, 80),
    generationPrompt: [`${kind}: ${req.subject}.`, ctx.imagery ? `The brand's image treatment, to follow strictly: ${ctx.imagery}.` : '', req.framing ? `Framing: ${req.framing}.` : '', req.mood ? `Mood: ${req.mood}.` : '', style ? `Style: ${style}.` : '', 'Professional, clean, no text in the image.', SAFE_AREA[req.safeArea]].filter(Boolean).join(' '),
    orientation: orientationOf(req.aspectRatio),
    preferGenerated: true,
  };
}

const IMAGE_ROLES = new Set<AssetRequirement['role']>(['photo', 'illustration']);

const generated: AssetProvider = {
  async resolve(req, ctx) {
    if (!IMAGE_ROLES.has(req.role) || !ctx.userId || !ctx.projectId) return null;
    const image = await imageSourcingService.generatedImage(imageBrief(req, ctx), { userId: ctx.userId, projectId: ctx.projectId, tag: req.assetId.replace(/[^a-z0-9-]/gi, '-').slice(0, 40), folder: `graphic/${ctx.documentType}` });
    return { url: image.url, alt: req.subject.slice(0, 200), provenance: { provider: image.attribution.provider, ...(image.attribution.author ? { model: image.attribution.author.slice(0, 120) } : {}) } };
  },
};

/**
 * La recherche de la banque : les mots porteurs du sujet (une banque d'images comprend « market women vegetables »,
 * pas une phrase entière), du plus précis au plus large.
 */
const STOP = new Set(['the', 'and', 'with', 'for', 'from', 'into', 'over', 'their', 'that', 'this', 'des', 'les', 'une', 'pour', 'avec', 'dans', 'sur', 'qui', 'que', 'aux', 'par']);
export function stockQueries(subject: string): string[] {
  const words = subject.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w.toLowerCase()));
  return [...new Set([words.slice(0, 5).join(' '), words.slice(0, 3).join(' ')].filter(Boolean))];
}

/** La banque Pexels : le repli d'une image que la génération n'a pas pu faire (ou la source d'une charte photographique). */
const stock: AssetProvider = {
  async resolve(req) {
    if (!IMAGE_ROLES.has(req.role)) return null;
    let image: Awaited<ReturnType<typeof imageSourcingService.stockImage>> = null;
    for (const searchQuery of stockQueries(req.subject)) {
      image = await imageSourcingService.stockImage({ ...imageBrief(req, { level: 'medium', documentType: 'pitch-deck' }), searchQuery, preferGenerated: false });
      if (image) break;
    }
    if (!image) return null;
    return {
      url: image.url,
      alt: req.subject.slice(0, 200),
      provenance: { provider: image.attribution.provider, license: 'Pexels License', ...(image.attribution.author ? { attribution: `Photo : ${image.attribution.author}`.slice(0, 160) } : {}), ...(image.attribution.sourceUrl ? { sourceUrl: image.attribution.sourceUrl } : {}) },
    };
  },
};

/** Un fournisseur qui journalise son échec avant de passer la main à la source suivante. */
const logged = (source: string, provider: AssetProvider): AssetProvider => ({
  async resolve(req, ctx) {
    try {
      return await provider.resolve(req, ctx);
    } catch (error: any) {
      logger.warn('graphic.asset_provider_failed', { event: 'graphic.asset_provider_failed', source, assetId: req.assetId, error: error?.message });
      return null;
    }
  },
});

export const IDEM_ASSET_PROVIDERS: AssetProviders = {
  generated: logged('generated', generated),
  stock: logged('stock', stock),
};

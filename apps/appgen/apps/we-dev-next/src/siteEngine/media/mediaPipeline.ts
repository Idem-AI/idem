/**
 * L'exécution des décisions de l'agent média, avec leurs replis.
 *
 *   video            Veo → clip Pexels → photo
 *   photo            Pexels → Gemini (ou l'inverse si l'agent veut une scène précise)
 *   illustration     dessin SVG du modèle → Gemini → photo Pexels
 *   illustration-3d  Gemini → photo Pexels → dessin SVG
 *   pattern          motif de la charte
 *
 * Un emplacement obligatoire qui reste vide prend le motif de la charte. Un
 * refus de crédits (402), une panne, un délai dépassé : c'est le même repli,
 * jamais un site en échec. Chaque étape longue s'annonce dans la conversation.
 */

import { ChatLogger } from '../../utils/logger.js';
import { ModelCaller } from '../modelCaller.js';
import { SiteFacts } from '../siteFacts.js';
import { Aspect, MediaClient, StockItem } from './mediaClient.js';
import { AssetDecision, MediaSlot, MediaStyle, writeGenerationPrompt } from './mediaDirector.js';
import { composeSpot, pickIcons, SpotLayout } from './spotIllustration.js';

/** Un média tel que l'écrit un module de contenu, et que rend `Media.jsx`. */
export interface MediaAsset {
  kind: 'image' | 'drawing' | 'video' | 'pattern';
  src: string;
  alt?: string;
  poster?: string;
  ground?: string;
  tile?: number;
  /** D'où il vient : utile à qui reprendra le site, jamais affiché. */
  origin: 'pexels' | 'gemini' | 'veo' | 'svg' | 'pattern';
  credit?: string;
}

export interface PipelineContext {
  client: MediaClient;
  caller: ModelCaller;
  facts: SiteFacts;
  style: MediaStyle;
  language: string;
  pattern: { src: string; ground: string; tile: number } | null;
  /** Une ligne d'état dans la conversation. */
  note(text: string): void;
  /** Un fichier texte déposé dans le projet (les dessins SVG). */
  writeFile(path: string, content: string): void;
  /** Les générations payantes passent une à une ou deux à deux, pas toutes à la fois. */
  limit<T>(task: () => Promise<T>): Promise<T>;
}

const orientationOf = (aspect: Aspect): 'landscape' | 'portrait' | 'square' =>
  aspect === '3:4' ? 'portrait' : aspect === '1:1' ? 'square' : 'landscape';

function where(slot: MediaSlot, fr: boolean): string {
  if (slot.role === 'hero') return fr ? `l'ouverture de la page ${slot.pageLabel}` : `the ${slot.pageLabel} opening`;
  if (slot.role === 'showcase') return fr ? 'la vitrine' : 'the showcase';
  if (slot.role === 'gallery') return fr ? 'la galerie' : 'the gallery';
  return fr ? `une section de la page ${slot.pageLabel}` : `a section of the ${slot.pageLabel} page`;
}

/** Une petite file : au plus `size` tâches à la fois. */
export function createLimiter(size: number): <T>(task: () => Promise<T>) => Promise<T> {
  let running = 0;
  const waiting: Array<() => void> = [];
  return async <T>(task: () => Promise<T>): Promise<T> => {
    if (running >= size) await new Promise<void>((resolve) => waiting.push(resolve));
    running += 1;
    try {
      return await task();
    } finally {
      running -= 1;
      waiting.shift()?.();
    }
  };
}

export async function produceMedia(slot: MediaSlot, decision: AssetDecision, ctx: PipelineContext): Promise<MediaAsset[]> {
  const fr = ctx.language === 'fr';
  const place = where(slot, fr);
  // La recherche se fait dans la langue de la requête, pas dans celle du site.
  const locale = decision.queryLanguage === 'fr' ? 'fr-FR' : 'en-US';
  const alt = decision.alt || ctx.facts.name;
  const tag = slot.id;

  const fail = (step: string, error: unknown) =>
    ChatLogger.warn('SITE_MEDIA', `${slot.id} : ${step} sans résultat`, {
      message: error instanceof Error ? error.message.slice(0, 200) : String(error),
    });

  const fromStock = (items: StockItem[], kind: 'image' | 'video'): MediaAsset[] =>
    items.map((item) => ({
      kind,
      src: item.url,
      alt: kind === 'image' ? alt : undefined,
      ...(item.poster ? { poster: item.poster } : {}),
      origin: 'pexels' as const,
      ...(item.author ? { credit: `${item.author} (Pexels)` } : {}),
    }));

  const stockPhotos = async (query: string): Promise<MediaAsset[]> => {
    if (!query) return [];
    try {
      const items = await ctx.client.stock(query, 'photo', orientationOf(slot.aspect), slot.count, locale);
      return items.length >= slot.count ? fromStock(items, 'image') : [];
    } catch (error) {
      fail('Pexels', error);
      return [];
    }
  };

  const generateImage = async (kind: 'photo' | 'illustration' | 'illustration-3d'): Promise<MediaAsset[]> => {
    if (!ctx.client.available) return [];
    try {
      const prompt = await writeGenerationPrompt({ caller: ctx.caller, decision, slot, kind, facts: ctx.facts, style: ctx.style });
      const image = await ctx.limit(() => ctx.client.generateImage(prompt, slot.aspect, tag));
      return [{ kind: kind === 'illustration' ? 'drawing' : 'image', src: image.url, alt, origin: 'gemini', credit: image.model }];
    } catch (error) {
      fail('génération d’image', error);
      return [];
    }
  };

  /**
   * L'illustration composée par le code : les icônes choisies par l'agent,
   * mises en scène aux couleurs de la charte. Toujours nette, jamais abstraite.
   */
  const drawSvg = async (): Promise<MediaAsset[]> => {
    try {
      const text = `${slot.brief} ${decision.subject}`.toLowerCase();
      const layout: SpotLayout = /étape|etape|step|processus|process|démarche|demarche|fonctionne|parcours|comment/.test(text)
        ? 'flow'
        : slot.role === 'hero'
          ? 'halo'
          : /service|offre|réserv|reserv|catalogue|liste|tarif|formule|commande|suivi/.test(text)
            ? 'panel'
            : slot.id.length % 2 === 0
              ? 'halo'
              : 'panel';
      const svg = composeSpot({
        icons: pickIcons(decision.icons ?? [], `${decision.subject} ${slot.brief}`),
        palette: ctx.style.palette,
        ground: ctx.style.ground,
        aspect: slot.aspect,
        layout,
        seed: slot.id,
      });
      const path = `public/media/${slot.id}.svg`;
      ctx.writeFile(path, `${svg}\n`);
      return [{ kind: 'drawing', src: `/media/${slot.id}.svg`, alt, origin: 'svg' }];
    } catch (error) {
      fail('illustration composée', error);
      return [];
    }
  };

  const patternAsset = (): MediaAsset[] =>
    ctx.pattern ? [{ kind: 'pattern', src: ctx.pattern.src, ground: ctx.pattern.ground, tile: ctx.pattern.tile, origin: 'pattern' }] : [];

  let assets: MediaAsset[] = [];

  switch (decision.kind) {
    case 'video': {
      if (ctx.client.available) {
        ctx.note(fr ? `Je génère la vidéo de ${place} (une à deux minutes)` : `Generating the video for ${place} (one to two minutes)`);
        try {
          const prompt = await writeGenerationPrompt({ caller: ctx.caller, decision, slot, kind: 'video', facts: ctx.facts, style: ctx.style });
          const clip = await ctx.limit(() => ctx.client.generateVideo(prompt, tag));
          assets = [{ kind: 'video', src: clip.url, origin: 'veo', credit: clip.model }];
        } catch (error) {
          fail('génération vidéo', error);
          ctx.note(fr ? 'La vidéo générée n’a pas abouti : je cherche un clip sur Pexels' : 'The generated video failed: looking for a clip on Pexels');
          try {
            assets = fromStock(await ctx.client.stock(decision.query, 'video', 'landscape', 1, locale), 'video');
          } catch (stockError) {
            fail('Pexels vidéo', stockError);
          }
        }
      }
      if (!assets.length) assets = await stockPhotos(decision.query);
      break;
    }

    case 'photo': {
      if (slot.role === 'gallery') ctx.note(fr ? 'Je choisis les photos de la galerie' : 'Choosing the gallery photos');
      else ctx.note(fr ? `Je cherche une photo pour ${place}` : `Finding a photo for ${place}`);
      const generateFirst = decision.source === 'generate' && slot.count === 1;
      assets = generateFirst ? await generateImage('photo') : await stockPhotos(decision.query);
      if (!assets.length && slot.count === 1) assets = generateFirst ? await stockPhotos(decision.query) : await generateImage('photo');
      // Une galerie sans trois photos pour la requête précise : une requête plus large.
      if (!assets.length && slot.count > 1) assets = await stockPhotos(decision.query.split(' ').slice(0, 2).join(' '));
      break;
    }

    case 'illustration': {
      ctx.note(fr ? `Je compose une illustration pour ${place}` : `Composing an illustration for ${place}`);
      assets = await drawSvg();
      if (!assets.length) assets = await generateImage('illustration');
      if (!assets.length) assets = await stockPhotos(decision.query);
      break;
    }

    case 'illustration-3d': {
      ctx.note(fr ? `Je génère une illustration 3D pour ${place}` : `Generating a 3D illustration for ${place}`);
      assets = await generateImage('illustration-3d');
      if (!assets.length) assets = await stockPhotos(/\b3d\b/i.test(decision.query) ? decision.query : `${decision.query} 3d`);
      if (!assets.length) assets = await drawSvg();
      break;
    }

    case 'pattern':
      assets = patternAsset();
      break;

    case 'none':
      break;
  }

  if (!assets.length && slot.required && slot.role !== 'gallery') assets = patternAsset();

  ChatLogger.info('SITE_MEDIA', `${slot.id} : ${assets.length ? assets.map((asset) => asset.origin).join(', ') : 'aucun média'}`, {
    decided: decision.kind,
  });
  return assets;
}

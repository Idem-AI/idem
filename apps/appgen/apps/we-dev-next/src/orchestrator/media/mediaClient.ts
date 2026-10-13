/**
 * Les médias passent par l'API IDEM (`/appgen/media/*`), au nom de l'utilisateur.
 *
 * Ce serveur n'a ni clé de modèle d'image, ni stockage, ni portefeuille : l'API
 * génère (Gemini, Veo), dépose le fichier à une adresse publique durable,
 * facture au barème iCode et rembourse un échec ; elle interroge aussi Pexels.
 * La session de l'utilisateur est relayée telle quelle, comme pour la
 * facturation de la génération elle-même.
 */

export type Aspect = '16:9' | '4:3' | '1:1' | '3:4';

export interface StockItem {
  url: string;
  poster?: string;
  alt?: string;
  author?: string;
  sourceUrl?: string;
}

export interface MediaClient {
  /** Faux sans session à relayer : tout appel échouerait, les replis sans réseau prennent la main. */
  readonly available: boolean;
  generateImage(prompt: string, aspect: Aspect, tag: string): Promise<{ url: string; model?: string }>;
  generateVideo(prompt: string, tag: string): Promise<{ url: string; model?: string }>;
  stock(
    query: string,
    kind: 'photo' | 'video',
    orientation: 'landscape' | 'portrait' | 'square',
    count?: number,
    locale?: string
  ): Promise<StockItem[]>;
}

/** Une erreur de l'API, avec son statut : 402 (crédits) n'est pas une panne, c'est un repli. */
export class MediaError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
  }
}

const IMAGE_TIMEOUT_MS = 120_000;
const VIDEO_TIMEOUT_MS = Number(process.env.SITE_MEDIA_VIDEO_TIMEOUT_MS ?? 200_000);
const STOCK_TIMEOUT_MS = 15_000;

export function createApiMediaClient(options: {
  credentials: Record<string, string>;
  projectId?: string;
  signal?: AbortSignal;
}): MediaClient {
  const base = (process.env.IDEM_API_URL || 'http://localhost:3001').replace(/\/+$/, '');
  const available = Boolean(options.credentials.Authorization || options.credentials.Cookie);

  async function post<T>(path: string, body: Record<string, unknown>, timeoutMs: number): Promise<T> {
    if (!available) throw new MediaError('no_credentials');
    const controller = new AbortController();
    const abort = () => controller.abort();
    options.signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, timeoutMs);
    try {
      const response = await fetch(`${base}/appgen/media/${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...options.credentials },
        body: JSON.stringify({ ...body, projectId: options.projectId }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new MediaError(`${path} ${response.status} ${detail.slice(0, 160)}`, response.status);
      }
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof MediaError) throw error;
      throw new MediaError(controller.signal.aborted ? `${path} timeout` : `${path} ${(error as Error).message}`);
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', abort);
    }
  }

  return {
    available,
    generateImage: (prompt, aspect, tag) => post('image', { prompt, aspect, tag }, IMAGE_TIMEOUT_MS),
    generateVideo: (prompt, tag) => post('video', { prompt, aspect: '16:9', tag }, VIDEO_TIMEOUT_MS),
    stock: async (query, kind, orientation, count = 1, locale) => {
      try {
        const answer = await post<{ items: StockItem[] }>('stock', { query, kind, orientation, count, locale }, STOCK_TIMEOUT_MS);
        return (answer.items ?? []).filter((item) => /^https:\/\//.test(item.url));
      } catch (error) {
        if (error instanceof MediaError && error.status === 404) return [];
        throw error;
      }
    },
  };
}

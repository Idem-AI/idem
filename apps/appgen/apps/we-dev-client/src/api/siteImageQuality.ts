/**
 * La netteté des images d'une refonte (API IDEM, `/appgen/site-images/*`) :
 *
 *   assess   lesquelles paraîtront floues à leur place dans le site (mesure par le code, gratuite) ;
 *   enhance  les améliorer, sur accord de l'utilisateur — flux SSE lu jusqu'au bout, JAMAIS relancé tout seul :
 *            une coupure est une erreur affichée (le bouton « Réessayer » reprend ce qui reste).
 */
const IDEM_API = process.env.REACT_APP_IDEM_API_BASE_URL || 'http://localhost:3001';

export interface ImageSlot {
  /** Adresse stockée de l'image (celle écrite dans le code du site). */
  url: string;
  displayWidth: number;
  displayHeight: number;
}

export interface FlaggedImage {
  url: string;
  width: number;
  height: number;
  issues: ('small' | 'blurry' | 'blocky')[];
  targetWidth: number;
}

export type EnhanceEvent =
  | { type: 'start'; total: number }
  | { type: 'image'; url: string; status: 'done'; enhancedUrl: string; method: 'model' | 'sharp'; width: number; height: number; ms: number }
  | { type: 'image'; url: string; status: 'skipped'; reason: string }
  | { type: 'done'; improved: number; skipped: number }
  | { type: 'error'; error: string };

function headers(): Record<string, string> {
  const token = localStorage.getItem('token');
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export async function assessSiteImages(projectId: string, images: ImageSlot[]): Promise<FlaggedImage[]> {
  const response = await fetch(`${IDEM_API}/appgen/site-images/assess`, {
    method: 'POST',
    credentials: 'include',
    headers: headers(),
    body: JSON.stringify({ projectId, images }),
  });
  if (!response.ok) return [];
  const data = (await response.json().catch(() => null)) as { images?: FlaggedImage[] } | null;
  return Array.isArray(data?.images) ? data!.images : [];
}

/** Améliore les images ; chaque événement est rendu dès qu'il arrive. Rejette si le flux se coupe avant `done`. */
export async function enhanceSiteImages(projectId: string, images: ImageSlot[], onEvent: (event: EnhanceEvent) => void, signal?: AbortSignal): Promise<void> {
  const response = await fetch(`${IDEM_API}/appgen/site-images/enhance`, {
    method: 'POST',
    credentials: 'include',
    headers: headers(),
    body: JSON.stringify({ projectId, images }),
    signal,
  });
  if (!response.ok || !response.body) throw new Error(`enhance_${response.status}`);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finished = false;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let cut = buffer.indexOf('\n\n');
    while (cut !== -1) {
      const block = buffer.slice(0, cut);
      buffer = buffer.slice(cut + 2);
      cut = buffer.indexOf('\n\n');
      // `: ping` (battement) et lignes `event:` ignorées : le type est dans les données.
      const data = block
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim())
        .join('');
      if (!data) continue;
      try {
        const event = JSON.parse(data) as EnhanceEvent;
        onEvent(event);
        if (event.type === 'done') finished = true;
        if (event.type === 'error') throw new Error(event.error);
      } catch (error) {
        if (error instanceof SyntaxError) continue;
        throw error;
      }
    }
  }
  if (!finished) throw new Error('enhance_interrupted');
}

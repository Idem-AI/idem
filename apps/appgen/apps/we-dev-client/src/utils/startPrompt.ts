/**
 * LA DEMANDE QUI OUVRE L'ATELIER — écrite sur la page d'accueil (ou arrivée par `?prompt=`, ou mise de côté avant
 * la connexion), elle part dès que le chat est prêt, par le même chemin qu'une saisie dans le chat (commandes « / »
 * comprises).
 *
 * Elle était passée par l'adresse puis par un événement émis 500 ms plus tard, à l'aveugle : le chat n'était pas
 * encore monté, la demande se perdait, et ne partait qu'à l'actualisation suivante (elle était restée dans
 * l'adresse). Ici, elle attend le chat, et elle est consommée une seule fois : une actualisation ne la renvoie pas.
 */
let pending: string | null = null;
const listeners = new Set<() => void>();

export function setStartPrompt(text: string | null | undefined): void {
  const value = text?.trim();
  if (!value) return;
  pending = value;
  listeners.forEach((listener) => listener());
}

export const hasStartPrompt = (): boolean => pending !== null;

/** La demande, retirée : la prendre, c'est l'envoyer. */
export function takeStartPrompt(): string | null {
  const value = pending;
  pending = null;
  return value;
}

/** Prévenu quand une demande arrive alors que le chat est déjà ouvert. */
export function onStartPrompt(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** `?prompt=` d'un lien : lu une fois, retiré de l'adresse (une actualisation ne le rejoue pas). */
export function consumePromptParam(): string | null {
  const url = new URL(window.location.href);
  const raw = url.searchParams.get('prompt');
  if (raw === null) return null;
  url.searchParams.delete('prompt');
  window.history.replaceState({}, '', url.toString());
  try {
    // Certains liens l'encodaient deux fois.
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

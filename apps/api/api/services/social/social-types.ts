/** Réseaux où IDEM publie réellement (API officielles). Les autres canaux se publient à la main. */
export const PUBLISH_NETWORKS = ['linkedin', 'facebook', 'instagram', 'x'] as const;
export type PublishNetwork = (typeof PUBLISH_NETWORKS)[number];

export interface PublishPayload {
  caption: string;
  hashtags: string[];
  mediaKind: 'image' | 'video';
  /** Fichier à publier (image), lu en base pour l'utilisateur. */
  buffer?: Buffer;
  mimeType?: string;
  /** Adresse publique du média, quand le réseau la demande. */
  publicUrl?: string;
}

export interface PublishOutcome {
  externalId?: string;
  externalUrl?: string;
}

/** Texte final d'un post : légende + hashtags, jamais dupliqués. */
export function fullText(payload: Pick<PublishPayload, 'caption' | 'hashtags'>): string {
  const tags = payload.hashtags.map((t) => `#${t.replace(/^#/, '')}`).filter((t) => !payload.caption.includes(t));
  return [payload.caption, tags.join(' ')].filter(Boolean).join('\n\n');
}

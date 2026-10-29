/**
 * L'adresse d'un site dans un texte (argument de `/redesign`, réponse à « Quelle est l'adresse de votre site ? »,
 * adresse rendue par l'agent qui lit la demande). Ce n'est PAS la détection d'une refonte : décider qu'une demande
 * en est une revient à l'agent (`commands/intent.ts`). Ici, seulement lire et normaliser une adresse.
 */

export interface RedesignIntent {
  /** L'adresse telle qu'écrite, normalisée en https. */
  url: string;
  host: string;
}

/** Extensions de fichiers qu'un modèle de nom de domaine prendrait pour un TLD. */
const FILE_EXT = /\.(html?|tsx?|jsx?|css|scss|json|md|png|jpe?g|svg|gif|webp|pdf|zip|txt|csv|xml|ya?ml|env|lock|py|php)$/i;

/** La première adresse de site du texte (avec ou sans https://), jamais un e-mail ni un nom de fichier. */
export function findSiteUrl(text: string): RedesignIntent | null {
  const candidates = [
    ...Array.from(String(text || '').matchAll(/https?:\/\/[^\s<>"'`)\]]+/gi)).map((m) => m[0]),
    ...Array.from(String(text || '').matchAll(/(?<![@\w.\/-])(?:www\.)?[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,12}(?:\/[^\s<>"'`)\]]*)?/gi)).map((m) => m[0]),
  ];
  for (const raw of candidates) {
    const cleaned = raw.replace(/[.,;:!?»)]+$/, '');
    const withScheme = /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;
    try {
      const url = new URL(withScheme);
      if (!/\./.test(url.hostname) || FILE_EXT.test(url.hostname) || /^\d+(\.\d+){3}$/.test(url.hostname)) continue;
      if (url.hostname === 'localhost' || url.hostname.endsWith('.local')) continue;
      url.hash = '';
      return { url: url.toString(), host: url.hostname.replace(/^www\./, '') };
    } catch {
      continue;
    }
  }
  return null;
}

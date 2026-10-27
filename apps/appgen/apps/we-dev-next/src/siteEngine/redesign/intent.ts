/**
 * « Refais mon site https://… » — reconnaître la demande de refonte dans le message, sans modèle.
 *
 * Il n'y a aucun champ « adresse du site » dans iCode : l'utilisateur le dit en parlant. Deux conditions,
 * toutes deux nécessaires : une adresse de site dans le message, et un verbe de refonte (refaire, moderniser,
 * améliorer, redesign…). Une adresse seule (« inspire-toi de https://… ») n'est pas une refonte, et un verbe
 * seul (« refais le menu ») est une retouche.
 */

export interface RedesignIntent {
  /** L'adresse telle qu'écrite, normalisée en https. */
  url: string;
  host: string;
}

/** Ce que voudrait dire « refaire / améliorer mon site », en français et en anglais, sans accents. */
const REDESIGN =
  /\b(refont\w*|refondr\w*|refai\w*|refaire|refais|refait\w*|reconstrui\w*|reconcevoir|moderni[sz]\w*|relook\w*|rafraichi\w*|rajeuni\w*|redesign\w*|re-design\w*|revamp\w*|remake|rebuild\w*|redo|makeover|rework\w*|nouvelle version|nouveau design|plus moderne|more modern|plus pro\b|ameliore\w*|improve\w*|(fais|faites|faire|make)\s+(mieux|better)|remplac\w+\s+(mon|notre|le)\s+site|replace\s+(my|our|the)\s+(web)?site)/;

/** Extensions de fichiers qu'un modèle de nom de domaine prendrait pour un TLD. */
const FILE_EXT = /\.(html?|tsx?|jsx?|css|scss|json|md|png|jpe?g|svg|gif|webp|pdf|zip|txt|csv|xml|ya?ml|env|lock|py|php)$/i;

const strip = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** La première adresse de site du message (avec ou sans https://), jamais un e-mail ni un nom de fichier. */
export function findSiteUrl(text: string): RedesignIntent | null {
  const candidates = [
    ...Array.from(text.matchAll(/https?:\/\/[^\s<>"'`)\]]+/gi)).map((m) => m[0]),
    ...Array.from(text.matchAll(/(?<![@\w.\/-])(?:www\.)?[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,12}(?:\/[^\s<>"'`)\]]*)?/gi)).map((m) => m[0]),
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

/** La demande est-elle une refonte d'un site existant ? */
export function detectRedesign(text: string): RedesignIntent | null {
  if (!text || text.length > 4000) return null;
  const site = findSiteUrl(text);
  if (!site) return null;
  // Le verbe est cherché hors de l'adresse : « refonte-digitale.com » ne demande rien.
  const words = strip(text.replace(/https?:\/\/\S+/gi, ' ').replace(site.host, ' '));
  return REDESIGN.test(words) ? site : null;
}

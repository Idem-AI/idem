/**
 * LES POLICES INTERDITES (demande du 22/11/2026 : « en aucun cas je ne veux voir la police Bricolage Grotesque »).
 *
 * Une police de cette liste n'est jamais proposée, jamais retenue, jamais chargée ni écrite dans un site, un visuel
 * ou un livrable. Là où elle arrive quand même (un modèle qui la propose, un site qui l'emploie, un projet enregistré
 * avant l'interdiction), le code la remplace par sa voisine :
 *
 *   à la génération      `resolveTypographySources` (API, toutes les typographies de l'IA)
 *   à la lecture         `projectService.getUserProjectById` / `getAllUserProjects` (API), `readFonts` (iCode)
 *   au chargement        `brandFontLinks` / `brandFontsHref` / `buildGoogleFontsHref` (rendus API et iVision)
 *
 * Aucune dépendance : importé par `typography.ts` comme par `design/google-fonts.ts`.
 */
export const BANNED_FONTS: Record<string, string> = {
  'bricolage grotesque': 'Epilogue',
};

export const isBannedFont = (family?: string | null): boolean => String(family || '').trim().toLowerCase() in BANNED_FONTS;

/** La police elle-même, ou sa remplaçante si elle est interdite. */
export const replaceBannedFont = (family: string): string => BANNED_FONTS[String(family || '').trim().toLowerCase()] ?? family;

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Une valeur (typographie, police de marque, réglage de design) sans police interdite : les noms ET les adresses
 * (« Bricolage+Grotesque » des feuilles Google, « bricolage-grotesque » de Fontsource) sont réécrits. Même objet
 * rendu tel quel quand il n'en contient aucune.
 */
export function withoutBannedFonts<T>(value: T): T {
  if (value === null || value === undefined) return value;
  const text = JSON.stringify(value);
  if (!/bricolage/i.test(text)) return value;
  let out = text;
  for (const [banned, replacement] of Object.entries(BANNED_FONTS)) {
    const words = banned.split(' ');
    for (const sep of [' ', '+', '%20', '-', '_']) {
      const pattern = new RegExp(escape(words.join(sep)), 'gi');
      const target = sep === '-' || sep === '_' ? replacement.toLowerCase().split(' ').join(sep) : replacement.split(' ').join(sep);
      out = out.replace(pattern, target);
    }
  }
  return JSON.parse(out) as T;
}

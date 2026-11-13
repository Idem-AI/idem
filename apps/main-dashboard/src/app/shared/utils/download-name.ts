/**
 * LE NOM D'UN FICHIER TÉLÉCHARGÉ — le projet d'abord, puis ce que c'est, puis quand.
 *
 * Les livrables sortaient sous des noms fixes (« business-plan.pdf », « pitch-deck.pdf », « document.pdf ») :
 * trois business plans de trois projets arrivaient dans le même dossier sous le même nom, et le navigateur les
 * numérotait (« business-plan (1).pdf »). Impossible de savoir de quel projet venait lequel, ni lequel était le
 * plus récent. Un nom porte donc toujours le NOM DU PROJET, le TYPE du livrable, et l'horodatage.
 *
 *   agrilink-business-plan-banque-2026-11-05-1432.pdf
 */

/** Un fragment de nom de fichier : sans accent, en minuscules, séparé par des tirets. */
export function slugify(value: string | null | undefined, fallback = ''): string {
  return (
    (value ?? '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || fallback
  );
}

/** L'horodatage local, lisible et triable : `2026-11-05-1432`. */
export function fileStamp(at: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${at.getFullYear()}-${p(at.getMonth() + 1)}-${p(at.getDate())}-${p(at.getHours())}${p(at.getMinutes())}`;
}

export interface DownloadNameParts {
  /** Le nom du projet — la première chose qu'on lit dans le dossier de téléchargement. */
  project?: string | null;
  /** Ce que le fichier EST : « business plan », « pitch deck — investisseurs », « charte graphique ». */
  label?: string | null;
  /** Une précision facultative : la face d'une carte, le format d'un visuel, « modifiable ». */
  suffix?: string | null;
  /** L'extension, avec ou sans point. */
  ext: string;
}

/**
 * Le nom complet. Les parties vides sont ignorées ; un nom reste produit même sans projet connu (le livrable
 * doit se télécharger quoi qu'il arrive), et l'horodatage suffit alors à distinguer deux fichiers.
 */
export function downloadName(parts: DownloadNameParts): string {
  const ext = parts.ext.replace(/^\./, '');
  const stem = [slugify(parts.project), slugify(parts.label), slugify(parts.suffix)].filter(Boolean).join('-');
  return `${stem || 'document'}-${fileStamp()}.${ext}`;
}

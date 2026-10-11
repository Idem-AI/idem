/**
 * Les fichiers du starter, et ce que l'atelier en fait.
 *
 * Un fichier verrouillé est posé par le code (configuration Vite / PostCSS /
 * Tailwind, `index.html`, point d'entrée, trousse de composants, socle du
 * backend…). Trois conséquences, toutes ici :
 *
 * 1. Il ne part pas dans le contexte envoyé au modèle — le serveur sait déjà
 *    ce qu'il contient, le renvoyer serait payer deux fois.
 * 2. Une action `file` du modèle sur ce chemin est ignorée. Le prompt le dit,
 *    mais un modèle finit toujours par réécrire `package.json` « au cas où », et
 *    sa version est au mieux équivalente, au pire amputée de la moitié de la
 *    palette.
 * 3. L'atelier annonce la version du socle au serveur à chaque message (état
 *    React, côté conversation), et le serveur adapte le contrat de build.
 *
 * État volontairement en module : l'espace de travail n'a qu'un socle à la
 * fois, et tout le code d'écriture de fichiers doit pouvoir le consulter sans
 * traverser React.
 */

let lockedPaths = new Set<string>();

export function registerScaffold(paths: string[], version: string): void {
  lockedPaths = new Set(paths);
  console.log(`[scaffold] socle v${version} : ${paths.length} fichiers verrouillés`);
}

/** À appeler quand l'espace de travail est vidé : le socle n'y est plus. */
export function clearScaffold(): void {
  lockedPaths = new Set();
}

export const isScaffoldLocked = (path: string): boolean =>
  lockedPaths.has(path.replace(/^\.?\//, ''));

/** Retire les fichiers du socle d'un ensemble (contexte modèle, versions…). */
export function withoutScaffold<T>(files: Record<string, T>): Record<string, T> {
  if (!lockedPaths.size) return files;

  return Object.fromEntries(
    Object.entries(files).filter(([path]) => !isScaffoldLocked(path))
  ) as Record<string, T>;
}

/**
 * Signature laissée par le socle en tête de `tailwind.config.js`
 * (`scaffold/shared.ts`, `SCAFFOLD_SIGNATURE`).
 *
 * Elle sert à reconnaître un projet déjà généré sur un socle d'après son code,
 * et non d'après un marqueur local : rouvert depuis une autre machine, le
 * projet garde ainsi son verrou au lieu de laisser le modèle réécrire sa charte.
 */
const SCAFFOLD_SIGNATURE = 'posée par IDEM';

export function hasScaffoldSignature(files: Record<string, string>): boolean {
  const config = files['tailwind.config.js'] ?? files['frontend/tailwind.config.js'] ?? '';
  return config.includes(SCAFFOLD_SIGNATURE);
}

/**
 * Les fichiers du socle que le linter a besoin de voir : la charte (pour
 * reconnaître une palette forgée) et le document (pour le script d'amorçage).
 * Le reste du socle n'a pas à être relu à chaque passe qualité.
 */
export const LINT_RELEVANT_SCAFFOLD_PATHS = [
  'tailwind.config.js',
  'index.html',
  'frontend/tailwind.config.js',
  'frontend/index.html',
];

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
let mountedVersion: string | null = null;

export function registerScaffold(paths: string[], version: string): void {
  lockedPaths = new Set(paths);
  mountedVersion = version;
  console.log(`[scaffold] socle v${version} : ${paths.length} fichiers verrouillés`);
}

/** À appeler quand l'espace de travail est vidé : le socle n'y est plus. */
export function clearScaffold(): void {
  lockedPaths = new Set();
  mountedVersion = null;
  resetScaffoldGate();
}

/** Version du socle monté, ou `null` : ce que l'on annonce au serveur. */
export const mountedScaffoldVersion = (): string | null => mountedVersion;

/**
 * La porte du socle.
 *
 * Sept chemins envoient un message au modèle (saisie, lancement automatique
 * depuis le tableau de bord, « Corriger », reprise…). Aucun ne devait partir
 * avant que le socle soit monté — or le montage attend une réponse du serveur :
 * un lancement automatique la devançait, le montage était annulé, et le modèle
 * écrivait sa propre configuration (avec des classes inventées comme
 * `font-figtree`, qui font tomber PostCSS).
 *
 * Plutôt que de surveiller chaque chemin, tous passent par un seul `append`
 * qui attend cette porte. Elle s'ouvre quand le montage est réglé — réussi,
 * inutile ou échoué — et, en dernier recours, après un délai : un serveur muet
 * ne doit pas bloquer la génération, il la ramène au contrat complet.
 */
const GATE_TIMEOUT_MS = 8000;

let gateOpen = false;
let gateWaiters: Array<() => void> = [];

function resetScaffoldGate(): void {
  gateOpen = false;
}

/** Le montage est réglé, quelle qu'en soit l'issue : les envois peuvent partir. */
export function settleScaffold(): void {
  gateOpen = true;
  const waiters = gateWaiters;
  gateWaiters = [];
  waiters.forEach((release) => release());
}

export function waitForScaffold(): Promise<void> {
  if (gateOpen) return Promise.resolve();

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      console.warn('[scaffold] porte forcée après délai, contrat complet conservé');
      settleScaffold();
    }, GATE_TIMEOUT_MS);

    gateWaiters.push(() => {
      clearTimeout(timer);
      resolve();
    });
  });
}

/** Les chemins verrouillés, pour les signaler aux outils qui jugent le code. */
export const lockedScaffoldPaths = (): string[] => Array.from(lockedPaths);

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

/**
 * L'espace de travail ne contient-il que le socle ?
 *
 * Le socle pose une page d'attente portant `idem:placeholder`. Dès que le
 * produit est écrit — par le modèle ou par le compositeur — le marqueur
 * disparaît avec elle. C'est donc un repère exact, et pas une estimation à
 * partir du nombre de fichiers.
 *
 * Sert à l'aperçu : tant qu'il n'y a que le socle, « Exécuter » n'a rien à
 * montrer, et le bouton doit proposer de générer.
 */
export function isStarterOnly(files: Record<string, string>): boolean {
  const app =
    files['src/app/page.jsx'] ?? files['src/App.jsx'] ?? files['frontend/src/App.jsx'];
  return typeof app === 'string' && app.includes('idem:placeholder');
}

/**
 * Un fichier parti en boucle.
 *
 * Un modèle qui se répète produit des fichiers entiers de lignes identiques —
 * on a vu une feuille de style de 2 Ko réécrite en 400 Ko de `.text-[inherit]`
 * recopié des centaines de fois. C'est illisible, c'est inutilisable, et ça
 * remplace du travail valable sans que rien ne s'y oppose.
 *
 * On refuse donc l'écriture plutôt que d'accepter n'importe quoi. Le test est
 * volontairement grossier : un fichier légitime n'est jamais à la fois énorme
 * et composé en majorité de lignes qui se répètent.
 */
const MAX_GENERATED_CHARS = 150_000;
const LOOP_MIN_LINES = 120;
const LOOP_UNIQUE_RATIO = 0.25;

export function looksDegenerate(content: string): boolean {
  if (typeof content !== 'string') return false;
  if (content.length > MAX_GENERATED_CHARS) return true;

  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < LOOP_MIN_LINES) return false;

  const unique = new Set(lines).size;
  return unique / lines.length < LOOP_UNIQUE_RATIO;
}

/**
 * Les sites vitrines générés par le moteur de design system du serveur
 * (`we-dev-next/src/siteEngine`).
 *
 * Ces sites portent leur version de template dans
 * `src/design-system/design-system-version.json`. L'atelier s'en sert pour :
 *
 * - ne lancer après génération ni revue de design, ni relance, ni réécriture :
 *   le résultat affiché est celui qui a été produit ;
 * - ne jamais remettre à jour leur template à la réouverture : un site garde la
 *   version avec laquelle il a été généré (une migration se demande).
 */

export const SITE_ENGINE_ID = 'idem-site-engine';
const VERSION_FILE = 'src/design-system/design-system-version.json';

export function isEngineSite(files: Record<string, string>): boolean {
  try {
    return JSON.parse(files[VERSION_FILE] ?? '{}')?.generator === SITE_ENGINE_ID;
  } catch {
    return false;
  }
}

/**
 * Site vitrine produit côté serveur : par le moteur actuel, ou par l'ancien
 * orchestrateur (`idem.plan.json` d'origine `idem-site`), dont les projets
 * existants restent ouvrables.
 */
export function isGeneratedSite(files: Record<string, string>): boolean {
  if (isEngineSite(files)) return true;
  try {
    return JSON.parse(files['idem.plan.json'] ?? '{}')?.origin === 'idem-site';
  } catch {
    return false;
  }
}

/** Les chemins qu'un fichier répondu en prose peut prendre. */
const RECOVERABLE = /^(?:src\/[\w.-]+(?:\/[\w.-]+)*)$/;

/**
 * Du code répondu en prose — un bloc annoncé par son chemin — plutôt qu'en
 * actions de fichier. Sans ce rattrapage, le tour serait entièrement perdu.
 */
export function extractFilesFromText(text: string): Record<string, string> {
  const files: Record<string, string> = {};
  if (!text || !text.includes('```')) return files;

  const fence = /```[a-z]*\s*\n([\s\S]*?)```/g;

  for (const match of Array.from(text.matchAll(fence))) {
    const body = match[1];
    const before = text.slice(Math.max(0, match.index! - 160), match.index!);

    // Le chemin annoncé juste avant le bloc, ou en première ligne du bloc.
    const heading = before.match(/([\w./-]+\.(?:json|jsx|tsx|css|js|ts))(?![\w])[^\n]*\n*$/);
    const inside = body.match(/^\s*(?:\/\/|\/\*|#)\s*([\w./-]+\.(?:json|jsx|tsx|css|js|ts))(?![\w])/);

    const path = (inside?.[1] ?? heading?.[1] ?? '').replace(/^\.?\//, '');
    if (!path || !RECOVERABLE.test(path)) continue;

    // La ligne de chemin en tête du bloc n'appartient pas au fichier.
    const content = inside ? body.replace(/^[^\n]*\n/, '') : body;
    if (content.trim()) files[path] = content.replace(/\s*$/, '\n');
  }

  return files;
}

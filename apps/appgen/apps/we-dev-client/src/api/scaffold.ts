/**
 * Starter préconfiguré, servi par le serveur AppGen.
 *
 * L'espace de travail le monte avant la première génération : le projet
 * démarre déjà (Vite, Tailwind, charte du projet, trousse de composants), et le
 * modèle n'écrit plus que le produit. Les fichiers du starter sont verrouillés
 * — ils ne partent pas dans le contexte et une réécriture est ignorée.
 *
 * Comme la forge de jetons, c'est du calcul pur côté serveur : aucun appel de
 * modèle, donc aucun crédit consommé.
 */

export interface Scaffold {
  version: string;
  target: 'site' | 'web-app' | 'mobile-app';
  files: Record<string, string>;
  locked: string[];
  commands: { install: string; start: string };
  /**
   * Les arbres `node_modules` de la cible et leur empreinte. L'atelier demande
   * le plan complet plus tôt (il ne dépend que de la cible, pas du projet) ;
   * ceci sert à vérifier qu'il a bien préchargé la bonne cible, ce qu'un lien
   * sans paramètre `product` ne permet pas de savoir à l'avance.
   */
  deps?: {
    fingerprint: string;
    trees: Array<{ id: string; dir: string; mountPoint: string; fingerprint: string }>;
  };
}

const apiBase = () => process.env.REACT_APP_BASE_URL || '';

export async function fetchScaffold(
  projectData: unknown,
  options: { product?: string | null; platform?: string | null; language?: string } = {},
  signal?: AbortSignal
): Promise<Scaffold> {
  const response = await fetch(`${apiBase()}/api/scaffold`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectData,
      product: options.product ?? undefined,
      platform: options.platform ?? undefined,
      language: options.language,
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Scaffold request failed: ${response.status}`);
  }

  return (await response.json()) as Scaffold;
}

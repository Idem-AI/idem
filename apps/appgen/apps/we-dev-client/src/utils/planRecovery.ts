/**
 * Rattrapages autour du plan de page.
 *
 * Deux choses qu'un petit modèle fait, et qui laissaient l'aperçu vide sans la
 * moindre explication :
 *
 * 1. il répond le plan **en texte**, au lieu de l'écrire dans une action de
 *    fichier. Rien n'est alors enregistré, et la page reste celle du socle ;
 * 2. il écrit le plan, puis s'arrête — sans les contenus que le plan annonce.
 *    Chaque section sans contenu étant retirée, la page sort vide.
 *
 * Le premier cas se répare sans modèle : le plan est là, il suffit de le
 * ranger. Le second demande un tour de plus, mais un tour minuscule et précis :
 * on ne redemande pas la page, seulement les modules qui manquent.
 */

/** Une forme de plan reconnaissable : des sections avec un composant nommé. */
const looksLikePlan = (value: unknown): boolean => {
  const plan = value as { sections?: unknown };
  return (
    !!plan &&
    typeof plan === 'object' &&
    Array.isArray(plan.sections) &&
    plan.sections.length > 0 &&
    plan.sections.every(
      (section) => !!section && typeof section === 'object' && 'component' in (section as object)
    )
  );
};

/**
 * Extrait un plan d'un message répondu en texte.
 *
 * On balaie les objets JSON du message — bloc de code ou non — et on garde le
 * premier qui a la forme d'un plan. Un simple `JSON.parse` du message entier ne
 * suffirait pas : le modèle l'entoure presque toujours d'une phrase.
 */
export function extractPlanFromText(text: string): string | null {
  if (!text || !text.includes('"sections"')) return null;

  const candidates: string[] = [];

  // Blocs de code d'abord : c'est la forme la plus fréquente.
  for (const match of Array.from(text.matchAll(/```(?:json)?\s*([\s\S]*?)```/g))) {
    candidates.push(match[1]);
  }

  // Puis le premier objet accolade-à-accolade du message brut.
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end > start) candidates.push(text.slice(start, end + 1));

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate.trim());
      if (looksLikePlan(parsed)) return `${JSON.stringify(parsed, null, 2)}\n`;
    } catch {
      // Candidat non valide : on passe au suivant.
    }
  }

  return null;
}

export interface MissingContent {
  /** Nom du module attendu (`hero`), sans chemin ni extension. */
  name: string;
  /** Section du kit qui l'utilise, pour rappeler les propriétés attendues. */
  component: string;
}

/** Les modules de contenu annoncés par le plan et absents de l'espace de travail. */
export function missingContentModules(files: Record<string, string>): MissingContent[] {
  const raw = files['idem.plan.json'];
  if (typeof raw !== 'string') return [];

  let plan: { sections?: Array<{ component?: string; content?: string }> };
  try {
    plan = JSON.parse(raw);
  } catch {
    return [];
  }

  const missing: MissingContent[] = [];
  const seen = new Set<string>();

  for (const section of plan.sections ?? []) {
    const name = section?.content;
    const component = section?.component;
    if (!name || !component || seen.has(name)) continue;
    if (!/^[a-z0-9][a-z0-9-]*$/i.test(name)) continue;
    if (files[`src/content/${name}.js`] !== undefined) continue;

    seen.add(name);
    missing.push({ name, component });
  }

  return missing;
}

/** Propriétés attendues par section, pour que la relance soit sans ambiguïté. */
const SHAPES: Record<string, string> = {
  Nav: 'logo (texte), links: [{ label, href }], cta: { label, href }',
  Hero: 'eyebrow, title, description, primaryCta: { label, href }, secondaryCta',
  Features: 'title, intro, items: [{ title, description }]',
  Steps: 'title, items: [{ title, description }]',
  Testimonials: 'title, items: [{ quote, name, role }]',
  Pricing:
    'title, intro, plans: [{ name, price, period, description, features: [], cta: { label, href }, featured }]',
  Faq: 'title, items: [{ question, answer }]',
  Cta: 'title, description, primaryCta, secondaryCta',
  Footer: 'logo, tagline, columns: [{ title, links: [{ label, href }] }], legal',
};

/**
 * La demande envoyée hors conversation : seulement les modules qui manquent.
 *
 * Volontairement étroite. Redemander la page entière, c'est rejouer le tour qui
 * vient d'échouer ; demander huit objets de données nommés, avec leurs clés,
 * est à la portée du modèle qui vient de produire le plan.
 */
export function buildContentRequest(missing: MissingContent[]): string {
  const lines = missing.map(
    ({ name, component }) =>
      `- \`src/content/${name}.js\` pour <${component}> → ${SHAPES[component] ?? 'les propriétés de cette section'}`
  );

  return `Le plan de page est enregistré, mais ses modules de contenu manquent. Écrivez UNIQUEMENT ces fichiers, rien d'autre :

${lines.join('\n')}

Chaque fichier est un module de données : \`export default { … };\` — des chaînes, des nombres, des tableaux. Aucun JSX, aucun import, aucun commentaire. Le texte est celui de ce produit : lieux réels, prix réels, pas de « Lorem ipsum » ni de « Fonctionnalité 1 ».

Répondez par un <boltArtifact> contenant seulement ces actions de fichier.`;
}

/**
 * Récupère des fichiers écrits en prose plutôt qu'en actions.
 *
 * Le modèle répond régulièrement par un bloc de code précédé du chemin —
 * « // src/content/footer.js » — au lieu d'une action `file`. Le contrat le dit
 * pourtant ; un petit modèle l'oublie quand même, et le tour entier est perdu.
 *
 * On ne récupère que ce qui est sans ambiguïté : un chemin dans `src/` ou un
 * `idem.plan.json`, annoncé juste avant ou juste après l'ouverture du bloc. Un
 * extrait de code sans chemin reste un extrait, pas un fichier.
 */
const RECOVERABLE = /^(?:src\/[\w.-]+(?:\/[\w.-]+)*|idem\.plan\.json)$/;

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

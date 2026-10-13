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

  type Section = { component?: string; content?: string };
  let plan: { sections?: Section[]; pages?: Array<{ sections?: Section[] }> };
  try {
    plan = JSON.parse(raw);
  } catch {
    return [];
  }

  const missing: MissingContent[] = [];
  const seen = new Set<string>();

  // Un plan multi-pages range ses sections par page : sans les lire, ses
  // contenus manquants passaient inaperçus et les sections disparaissaient.
  const sections = [
    ...(plan.sections ?? []),
    ...(plan.pages ?? []).flatMap((page) => page?.sections ?? []),
  ];

  for (const section of sections) {
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

/**
 * Le référencement est-il encore à faire ?
 *
 * `src/seo.js` est posé par le socle avec ce que le code sait déjà — le nom, la
 * description du projet. Ce qu'il ne peut pas deviner, c'est le vocabulaire des
 * clients : les mots qu'ils tapent, la promesse en une phrase, la fiche
 * d'établissement. Tant que ces champs sont vides, l'étape reste à faire.
 */
export function seoNeedsFilling(files: Record<string, string>): boolean {
  const seo = files['src/seo.js'];
  if (typeof seo !== 'string') return false;

  const hasKeywords = /keywords:\s*\[\s*['"]/.test(seo);
  return !hasKeywords;
}

/**
 * La demande de référencement, envoyée hors conversation.
 *
 * Un seul fichier à écrire, des champs nommés, et la liste réelle des pages du
 * site pour que les descriptions collent à ce qui existe.
 */
export function buildSeoRequest(files: Record<string, string>): string {
  const pages: string[] = [];

  try {
    const plan = JSON.parse(files['idem.plan.json'] ?? '{}') as {
      pages?: Array<{ path?: string; title?: string }>;
    };
    for (const page of plan.pages ?? []) {
      if (page?.path) pages.push(`${page.path}${page.title ? ` (${page.title})` : ''}`);
    }
  } catch {
    // Plan illisible : on demande le référencement du site, sans détail de page.
  }

  return `Le site est généré. Il reste le référencement. Écrivez UN SEUL fichier, \`idem.seo.json\`, avec exactement ces clés :

{
  "title": "titre de la page d'accueil, moins de 60 caractères, ce que vend ce produit et où",
  "description": "150 à 160 caractères, la phrase qui donne envie de cliquer dans une liste de résultats",
  "keywords": ["6 à 10 expressions que vos clients tapent réellement, avec la ville si c'est local"],
  "business": { "type": "", "city": "", "country": "", "phone": "", "email": "" }
}

\`business\` se remplit à partir du contenu déjà écrit sur le site ; laissez les chaînes vides si l'information n'y est pas. N'inventez ni chiffre, ni récompense, ni compte social.${
    pages.length ? `\n\nLes pages du site : ${pages.join(', ')}.` : ''
  }

Répondez par un <boltArtifact> contenant la seule action de fichier \`idem.seo.json\`. Aucun autre fichier, aucun commentaire.`;
}

/** Le référencement tel que le modèle le fournit : des données, pas du code. */
export interface SeoAnswer {
  title?: string;
  description?: string;
  keywords?: string[];
  business?: { type?: string; city?: string; country?: string; phone?: string; email?: string };
}

/**
 * Reconnaît une réponse de référencement dans un objet JSON.
 *
 * Le modèle répond souvent en dehors de toute action de fichier, et parfois
 * avec la forme de Next (`openGraph`, `twitter`, `alternates`) plutôt que celle
 * demandée. On accepte les deux : ce qui compte est le titre, la description et
 * les mots-clés, le reste est déjà posé par le socle.
 */
export function readSeoAnswer(value: unknown): SeoAnswer | null {
  if (!value || typeof value !== 'object') return null;

  const raw = value as Record<string, any>;
  const og = (raw.openGraph ?? {}) as Record<string, any>;

  const title = typeof raw.title === 'string' ? raw.title : og.title;
  const description = typeof raw.description === 'string' ? raw.description : og.description;
  const keywords = Array.isArray(raw.keywords)
    ? raw.keywords.filter((item: unknown): item is string => typeof item === 'string')
    : [];

  if (typeof title !== 'string' && typeof description !== 'string' && !keywords.length) {
    return null;
  }

  return {
    title: typeof title === 'string' ? title.trim() : undefined,
    description: typeof description === 'string' ? description.trim() : undefined,
    keywords: keywords.map((item) => item.trim()).filter(Boolean),
    business: typeof raw.business === 'object' && raw.business ? raw.business : undefined,
  };
}

/** Cherche la réponse de référencement dans un message, bloc de code ou non. */
export function extractSeoFromText(text: string): SeoAnswer | null {
  if (!text || !text.includes('{')) return null;

  const candidates: string[] = [];
  for (const match of Array.from(text.matchAll(/```(?:json)?\s*([\s\S]*?)```/g))) {
    candidates.push(match[1]);
  }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end > start) candidates.push(text.slice(start, end + 1));

  for (const candidate of candidates) {
    try {
      const answer = readSeoAnswer(JSON.parse(candidate.trim()));
      if (answer) return answer;
    } catch {
      // Candidat non valide : au suivant.
    }
  }

  return null;
}

/**
 * Réécrit `src/seo.js` avec les valeurs fournies.
 *
 * Le fichier reste écrit par le code : sa forme est lue par `layout.jsx`, et une
 * accolade mal placée du modèle suffirait à faire tomber le site entier. Le
 * modèle apporte les mots, pas la syntaxe.
 */
export function applySeoAnswer(current: string, answer: SeoAnswer): string {
  const quote = (value: string) => JSON.stringify(value);

  const replaceField = (source: string, key: string, rendered: string): string => {
    const pattern = new RegExp(`(\\n  ${key}:\\s*)(?:'(?:[^'\\\\]|\\\\.)*'|"(?:[^"\\\\]|\\\\.)*"|\\[[^\\]]*\\]|\\{[^}]*\\})`);
    return pattern.test(source) ? source.replace(pattern, `$1${rendered}`) : source;
  };

  let next = current;

  if (answer.title) next = replaceField(next, 'title', quote(answer.title));
  if (answer.description) next = replaceField(next, 'description', quote(answer.description));

  if (answer.keywords?.length) {
    const list = `[${answer.keywords.map(quote).join(', ')}]`;
    next = replaceField(next, 'keywords', list);
  }

  if (answer.business) {
    const business = ['type', 'city', 'country', 'phone', 'email']
      .map((field) => `${field}: ${quote(String((answer.business as any)?.[field] ?? '').trim())}`)
      .join(', ');
    next = replaceField(next, 'business', `{ ${business} }`);
  }

  return next;
}

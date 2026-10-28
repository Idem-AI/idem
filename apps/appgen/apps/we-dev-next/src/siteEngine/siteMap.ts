/**
 * LA CARTOGRAPHIE D'UN SITE — de quoi savoir OÙ faire une retouche sans tout relire, calculée par le code (zéro
 * jeton) à partir des fichiers du site.
 *
 *   pages        chaque page (adresse, nom) et ses sections dans l'ordre d'affichage
 *   sections     ce que chacune montre (son rôle prévu par l'architecte, ses titres et textes, ses images) et
 *                les données du site qu'elle lit (`site.navigation`, `site.contact`, `media[…]`)
 *   en-tête      et pied de page, de la même façon
 *   données      `src/site/data.ts` : le menu, l'action principale, les coordonnées, le nom, la description —
 *                ce qu'aucun composant ne contient en dur (un menu en double se corrige ICI, pas dans l'en-tête)
 *   apparence    les polices et couleurs du design system
 *
 * Chaque partie modifiable porte un identifiant stable (`home/Hero`, `SiteHeader`, `data.navigation`, `theme`) :
 * l'agent d'aiguillage lit la carte et la demande, et répond par ces identifiants.
 */
import { DESIGN_SYSTEM_PATHS } from './template.js';
import { pagesFileOf } from './project.js';
import { siteLanguagesOf } from './i18n.js';

export interface MapComponent {
  /** `home/Hero`, `SiteHeader`, `SiteFooter`. */
  id: string;
  path: string;
  name: string;
  page?: string;
  /** Le rôle prévu par l'architecte (manifeste), quand il est connu. */
  role?: string;
  texts: string[];
  images: number;
  /** Les données du site lues par le composant : `site.navigation`, `media["home-hero"]`… */
  reads: string[];
}

export interface MapPage {
  key: string;
  path: string;
  label: string;
  sections: MapComponent[];
}

/** Les champs de `src/site/data.ts` qu'une retouche peut changer. */
export const DATA_FIELDS = ['navigation', 'primaryAction', 'contact', 'name', 'description'] as const;
export type DataField = (typeof DATA_FIELDS)[number];

export interface SiteMap {
  languages: string[];
  pages: MapPage[];
  header?: MapComponent;
  footer?: MapComponent;
  data: Partial<Record<DataField, unknown>>;
  theme: string;
}

const DATA_PATH = 'src/site/data.ts';

/** Les valeurs de `src/site/data.ts` (le littéral passé à `localize`), ou `null`. */
export function readSiteData(code: string | undefined): Record<string, unknown> | null {
  const match = String(code ?? '').match(/localize\(([\s\S]*)\);\s*(?:\n|$)/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** `src/site/data.ts` avec de nouvelles valeurs, le reste du module inchangé. */
export function writeSiteData(code: string, data: Record<string, unknown>): string {
  const literal = JSON.stringify(data, null, 2).replace(/</g, '\\u003c');
  return code.replace(/localize\(([\s\S]*)\);(\s*(?:\n|$))/, () => `localize(${literal});\n`);
}

/** Les textes visibles d'un composant : ceux passés à `t()`, puis le texte JSX en clair. */
function textsOf(code: string): string[] {
  const out: string[] = [];
  for (const match of code.matchAll(/\bt\(\s*"((?:[^"\\]|\\.)*)"/g)) {
    try {
      out.push(JSON.parse(`"${match[1]}"`));
    } catch {
      out.push(match[1]);
    }
  }
  // Le texte entre balises, pas le code après une flèche (`=> …`) ni une expression.
  for (const match of code.matchAll(/(?<![=-])>\s*([^<>{}\n();=]*[A-Za-zÀ-ÿ][^<>{}\n();=]{3,})\s*</g)) out.push(match[1].trim());
  return [...new Set(out.map((text) => text.replace(/\s+/g, ' ').trim()).filter((text) => text.length >= 3))];
}

function readsOf(code: string): string[] {
  const reads = new Set<string>();
  for (const match of code.matchAll(/\bsite\.(\w+)/g)) reads.add(`site.${match[1]}`);
  for (const match of code.matchAll(/\bmedia\[\s*['"]([^'"]+)['"]\s*\]/g)) reads.add(`media["${match[1]}"]`);
  if (/LanguageSwitcher/.test(code)) reads.add('LanguageSwitcher');
  if (/BrandMark/.test(code)) reads.add('logo');
  return [...reads];
}

function componentOf(id: string, path: string, code: string, page?: string, role?: string): MapComponent {
  return {
    id,
    path,
    name: path.match(/(\w+)\.tsx$/)?.[1] ?? id,
    page,
    role,
    texts: textsOf(code),
    images: (code.match(/<(Media|img)\b/g) ?? []).length,
    reads: readsOf(code),
  };
}

/** Le rôle de chaque section selon le manifeste (`.idem/manifest.json`), par chemin de fichier. */
function rolesFromManifest(files: Record<string, string>): Map<string, string> {
  const roles = new Map<string, string>();
  try {
    const saved = JSON.parse(files['.idem/manifest.json'] ?? files['idem.manifest.json'] ?? '');
    for (const page of saved?.manifest?.pages ?? []) {
      for (const section of page.sections ?? []) {
        if (section.component) roles.set(`src/sections/${page.key}/${section.component}.tsx`, String(section.brief ?? section.id ?? '').slice(0, 160));
      }
    }
  } catch {
    /* pas de manifeste : les textes suffisent */
  }
  return roles;
}

export function buildSiteMap(files: Record<string, string>): SiteMap {
  const roles = rolesFromManifest(files);
  const languages = siteLanguagesOf(files)?.languages ?? [];
  const main = languages[0];

  // Les pages de la langue principale, dans l'ordre de la liste.
  let listed: Array<{ path: string; module: string; lang?: string; title?: string }> = [];
  try {
    listed = (JSON.parse(pagesFileOf(files) ?? '{}').pages ?? []).filter((page: { lang?: string }) => !page.lang || !main || page.lang === main);
  } catch {
    listed = [];
  }
  const keys = listed.length
    ? listed.map((page) => ({ key: page.module.replace(/^src\/pages\//, '').replace(/\.tsx$/, ''), path: page.path, title: page.title ?? '' }))
    : Object.keys(files)
        .filter((path) => /^src\/pages\/[^/]+\.tsx$/.test(path))
        .map((path) => ({ key: path.replace(/^src\/pages\//, '').replace(/\.tsx$/, ''), path: '', title: '' }));

  const data = readSiteData(files[DATA_PATH]) ?? {};
  const labelOf = (path: string) => (Array.isArray(data.pages) ? (data.pages as Array<{ label?: string; href?: string }>).find((page) => page.href === path)?.label : undefined);

  const pages: MapPage[] = keys.map(({ key, path, title }) => {
    const pageCode = files[`src/pages/${key}.tsx`] ?? '';
    // Les sections dans l'ordre où la page les affiche (sinon, celles de son dossier).
    const ordered = Array.from(pageCode.matchAll(/<SectionBoundary name="(\w+)">/g)).map((m) => m[1]);
    const inFolder = Object.keys(files)
      .filter((p) => p.startsWith(`src/sections/${key}/`) && p.endsWith('.tsx'))
      .map((p) => p.match(/(\w+)\.tsx$/)![1]);
    const names = [...ordered, ...inFolder.filter((name) => !ordered.includes(name))];
    return {
      key,
      path,
      label: labelOf(path) || title.split(/\s[-|–]\s/)[0] || key,
      sections: names
        .map((name) => `src/sections/${key}/${name}.tsx`)
        .filter((p) => typeof files[p] === 'string')
        .map((p) => componentOf(`${key}/${p.match(/(\w+)\.tsx$/)![1]}`, p, files[p], key, roles.get(p))),
    };
  });

  const headerPath = 'src/components/site/SiteHeader.tsx';
  const footerPath = 'src/components/site/SiteFooter.tsx';

  let theme = '';
  try {
    const config = JSON.parse(files[DESIGN_SYSTEM_PATHS.source] ?? '{}');
    const typo = config.tokens?.typography ?? {};
    const colors = config.tokens?.colors ?? {};
    theme = [typo.headingFont && `titres en ${typo.headingFont}`, typo.bodyFont && `texte en ${typo.bodyFont}`, colors.primary && `couleur principale ${colors.primary}`, config.tokens?.radius?.base && `arrondis ${config.tokens.radius.base}`]
      .filter(Boolean)
      .join(', ');
  } catch {
    theme = '';
  }

  return {
    languages,
    pages,
    header: typeof files[headerPath] === 'string' ? componentOf('SiteHeader', headerPath, files[headerPath], undefined, 'en-tête de toutes les pages : logo, menu, action principale') : undefined,
    footer: typeof files[footerPath] === 'string' ? componentOf('SiteFooter', footerPath, files[footerPath], undefined, 'pied de toutes les pages') : undefined,
    data: Object.fromEntries(DATA_FIELDS.filter((field) => field in data).map((field) => [field, data[field]])),
    theme,
  };
}

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

function describeComponent(component: MapComponent): string {
  const parts = [
    component.role ? `rôle : ${clip(component.role, 100)}` : '',
    component.texts.length ? `textes : ${component.texts.slice(0, 3).map((text) => `« ${clip(text, 60)} »`).join(' ')}` : '',
    component.images ? `${component.images} image(s)` : '',
    component.reads.length ? `lit ${component.reads.join(', ')}` : '',
  ].filter(Boolean);
  return `[${component.id}] ${parts.join(' — ')}`;
}

function describeData(field: DataField, value: unknown): string {
  if (field === 'navigation' && Array.isArray(value)) {
    return `[data.navigation] le menu principal (affiché par l'en-tête et le pied de page) : ${value.map((item: { label?: string; href?: string }) => `${item.label} → ${item.href}`).join(' · ') || '(vide)'}`;
  }
  if (field === 'primaryAction') {
    const action = value as { label?: string; href?: string } | null;
    return `[data.primaryAction] le bouton d'action principal : ${action ? `${action.label} → ${action.href}` : '(aucun)'}`;
  }
  if (field === 'contact') {
    const contact = (value ?? {}) as { phone?: string; email?: string; channels?: Array<{ label?: string; value?: string }> };
    return `[data.contact] les coordonnées : ${[contact.phone && `tél. ${contact.phone}`, contact.email && `e-mail ${contact.email}`, ...(contact.channels ?? []).map((c) => `${c.label} ${c.value}`)].filter(Boolean).join(', ') || '(aucune)'}`;
  }
  return `[data.${field}] ${clip(String(value ?? ''), 160)}`;
}

/** La carte en texte, pour l'agent d'aiguillage (quelques milliers de caractères pour un site entier). */
export function renderSiteMap(map: SiteMap): string {
  const lines: string[] = ['# Carte du site'];
  if (map.languages.length) lines.push(`Langues : ${map.languages.join(', ')} (la première est la principale)`);
  if (map.theme) lines.push(`[theme] l'apparence de tout le site (design system) : ${map.theme}`);
  lines.push('', '## Données du site (src/site/data.ts) — partagées par plusieurs composants');
  for (const field of DATA_FIELDS) if (field in map.data) lines.push(`- ${describeData(field, map.data[field])}`);
  lines.push('', '## Sur toutes les pages');
  if (map.header) lines.push(`- ${describeComponent(map.header)}`);
  if (map.footer) lines.push(`- ${describeComponent(map.footer)}`);
  for (const page of map.pages) {
    lines.push('', `## Page « ${page.label} » ${page.path ? `(${page.path}) ` : ''}[page:${page.key}]`);
    page.sections.forEach((section, index) => lines.push(`${index + 1}. ${describeComponent(section)}`));
  }
  return lines.join('\n');
}

/** Tous les identifiants modifiables de la carte. */
export function mapIds(map: SiteMap): { components: Map<string, MapComponent>; data: DataField[]; pages: string[] } {
  const components = new Map<string, MapComponent>();
  for (const component of [map.header, map.footer, ...map.pages.flatMap((page) => page.sections)]) if (component) components.set(component.id, component);
  return { components, data: DATA_FIELDS.filter((field) => field in map.data), pages: map.pages.map((page) => page.key) };
}

/**
 * UNE SECTION REMISE EN FORME AVEC LE CATALOGUE — « présente les services en cartes », « change la mise en page du
 * haut de la page », « un autre style pour les témoignages ».
 *
 * Le catalogue d'idem-templates reste la source des mises en page : la section garde ses textes (relus, adaptés au
 * schéma de la nouvelle composition, la demande appliquée), ses visuels et son ancre, et prend un autre gabarit.
 *
 *   1. un appel JSON : la variante choisie parmi celles de la composition visée, et les textes dans son schéma ;
 *   2. le code assemble, vérifie (montage avec les données du site) et passe aux variantes suivantes si besoin ;
 *   3. rien ne passe : `null`, et l'appelant retouche le code directement.
 */
import { ChatLogger } from '../utils/logger.js';
import { ReviewContext, reviewComponent } from './authoring.js';
import { LAYOUTS, LayoutId, ManifestSection } from './manifest.js';
import { ModelCaller, Verdict } from './modelCaller.js';
import { readSavedDesign } from './plan.js';
import { assembleSection, type ActionValue } from './sectionCatalog/assemble.js';
import { fitContent, rankVariants, seedOf } from './sectionCatalog/compose.js';
import { copySystemPrompt, describeFields, readCopy, type SectionContent } from './sectionCatalog/copy.js';
import { sectionCatalog } from './sectionCatalog/registry.js';
import type { LoadedSectionCatalog, SectionNode } from './sectionCatalog/types.js';
import type { MapComponent, SiteMap } from './siteMap.js';

/** La section telle que le manifeste l'a prévue (composition, ancre), ou ce que le code en lit. */
export function sectionPlanOf(files: Record<string, string>, component: MapComponent): ManifestSection {
  const saved = readSavedDesign(files);
  const planned = saved?.manifest.pages.find((page) => page.key === component.page)?.sections.find((section) => section.component === component.name);
  if (planned) return planned;
  const code = files[component.path] ?? '';
  const id = code.match(/<Section\b[^>]*\bid="([^"]+)"/)?.[1] ?? component.name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  return { id, component: component.name, brief: component.role ?? '', visual: component.images ? 'photo' : 'none' };
}

/** Les visuels qu'affiche la section (`media["home-hero"]`, `media["home-hero-2"]`…) : la nouvelle mise en page les garde. */
export function mediaKeysOf(code: string): string[] {
  return [...new Set(Array.from(String(code).matchAll(/\bmedia\[\s*['"]([^'"]+)['"]\s*\]/g)).map((m) => m[1]))];
}

/** Les compositions du catalogue, une ligne chacune, pour l'agent d'aiguillage. */
export function layoutMenuOf(catalog: LoadedSectionCatalog | null, fr: boolean): string {
  const ids = catalog?.kinds.size ? [...catalog.kinds.keys()] : Object.keys(LAYOUTS);
  return ids
    .map((id) => {
      const kind = catalog?.kinds.get(id);
      const text = kind?.doc.summary || (LAYOUTS as unknown as Record<string, readonly string[]>)[id]?.[fr ? 0 : 1] || '';
      return `- ${id} : ${text.slice(0, 110)}`;
    })
    .join('\n');
}

export async function loadCatalog(): Promise<LoadedSectionCatalog | null> {
  try {
    const catalog = await sectionCatalog();
    return catalog.sections.length ? catalog : null;
  } catch (error) {
    ChatLogger.warn('SITE_EDIT', 'Catalogue iCode indisponible pour la retouche', { message: (error as Error).message });
    return null;
  }
}

export interface RestyleInput {
  caller: ModelCaller;
  catalog: LoadedSectionCatalog;
  request: string;
  change: string;
  /** La composition voulue ; absente = la même, dans une autre variante. */
  layout?: string;
  component: MapComponent;
  map: SiteMap;
  files: Record<string, string>;
  review: ReviewContext;
  language: string;
  fr: boolean;
}

/** La section dans une autre mise en page du catalogue, ou `null` (aucune variante ne convient : retouche du code). */
export async function restyleSection(input: RestyleInput): Promise<{ code: string; variant: string; reply: string } | null> {
  const { caller, catalog, component, files, review, map, fr } = input;
  const before = files[component.path];
  if (typeof before !== 'string') return null;
  const plan = sectionPlanOf(files, component);
  const layout = input.layout && catalog.kinds.has(input.layout) ? input.layout : plan.layout && catalog.kinds.has(plan.layout) ? plan.layout : undefined;
  if (!layout) return null;
  const kind = catalog.kinds.get(layout)!;
  const mediaKeys = mediaKeysOf(before);
  const page = map.pages.find((p) => p.key === component.page);
  const opening = page?.sections[0]?.id === component.id;
  const variants = rankVariants(catalog, layout, mediaKeys.length, new Map(), seedOf(`${component.id}:${input.change}`)).filter((node) => fitsVisuals(node, mediaKeys.length));
  if (!variants.length) return null;

  // Les destinations d'un bouton : les pages du site et les ancres de la page.
  const targets = [...map.pages.map((p) => p.path).filter(Boolean), ...(page?.sections ?? []).map((s) => `#${sectionPlanOf(files, s).id}`)];
  const contactPath = map.pages.find((p) => /contact/i.test(p.key))?.path;
  const resolveHref = (action: ActionValue): string | null => {
    const target = action.target ?? '';
    if (targets.includes(target)) return target === page?.path ? null : target;
    return contactPath ?? targets[0] ?? null;
  };

  const task = { section: { ...plan, layout: layout as LayoutId }, kind, visuals: mediaKeys.length };
  const menu = variants.map((node) => `- ${node.id} : ${node.doc.title}${node.doc.summary ? ` — ${node.doc.summary.slice(0, 120)}` : ''}`).join('\n');
  const prompt = `# La demande de l'utilisateur
${input.request.slice(0, 1200)}${input.change && input.change !== input.request ? `\n\n# Ce qu'il faut faire de cette section\n${input.change.slice(0, 600)}` : ''}

# Les textes actuels de la section (à reprendre : rien d'inventé, la demande appliquée)
${component.texts.map((text) => `- ${text}`).join('\n') || '(aucun)'}

# La nouvelle composition : ${kind.doc.title}
${kind.doc.summary}

# Les variantes possibles (choisis celle qui répond le mieux à la demande)
${menu}

# Destinations permises d'une action (« target »)
${targets.map((t) => `- ${t}`).join('\n')}

# Réponse
{ "variant": "<un identifiant ci-dessus>", "sections": { "${plan.id}": {
${describeFields(kind.fields, '    ')}
} }, "reply": "<une phrase courte pour l'utilisateur, ${fr ? 'en français' : 'in English'}, qui dit ce qui a changé>" }`;

  const outcome = await caller.json<{ variant: string; content: SectionContent; reply: string }>(
    `restyle:${component.id}`,
    copySystemPrompt(input.language),
    prompt,
    (raw): Verdict<{ variant: string; content: SectionContent; reply: string }> => {
      const o = (raw ?? {}) as { variant?: unknown; reply?: unknown };
      const read = readCopy(raw, [task], targets);
      const content = read.sections[plan.id];
      if (!content) return { problem: `Les textes de la section ne suivent pas le schéma : ${(read.problems[plan.id] ?? []).slice(0, 4).join(' · ')}` };
      const invented = review.check(content);
      if (invented.length) return { problem: `N'ajoute aucun fait absent des textes actuels ou de la demande : ${invented.slice(0, 4).join(', ')}.` };
      return { value: { variant: String(o.variant ?? ''), content, reply: typeof o.reply === 'string' ? o.reply : '' } };
    },
    2600
  );
  if (!outcome.value) return null;

  const { content, variant, reply } = outcome.value;
  // La variante choisie d'abord, puis les autres : la première qui s'affiche sans faute l'emporte.
  const ordered = [...variants.filter((node) => node.id === variant), ...variants.filter((node) => node.id !== variant)];
  for (const node of ordered) {
    const fitted = fitContent(node, content, mediaKeys.length);
    if (!fitted) continue;
    let code: string;
    try {
      code = assembleSection(node.template, { component: component.name, id: plan.id, opening, content: fitted, mediaKeys, resolveHref });
    } catch {
      continue;
    }
    const checked = await reviewComponent(code, review, { path: component.path });
    if (checked.problems.length || checked.empty || checked.invented.length) continue;
    if (normalized(checked.code) === normalized(before)) continue;
    ChatLogger.info('SITE_EDIT', 'Section remise en forme depuis le catalogue', { section: component.id, layout, variant: node.id });
    return { code: checked.code, variant: node.id, reply };
  }
  ChatLogger.warn('SITE_EDIT', 'Aucune variante du catalogue ne convient à la retouche', { section: component.id, layout });
  return null;
}

function fitsVisuals(node: SectionNode, visuals: number): boolean {
  if (node.visual === 'required') return visuals > 0;
  return true;
}

const normalized = (code: string) => code.replace(/\s+/g, ' ').trim();

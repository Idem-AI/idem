/**
 * Validation des contrats, SANS modèle et SANS HTML.
 *
 * Deux niveaux, à ne pas confondre :
 *  1. la FORME (zod) : chaque clé, chaque jeton, chaque borne ;
 *  2. la COHÉRENCE (ici) : les références existent, chaque bloc est posé une fois, l'arbre reste
 *     raisonnable, le plan correspond au contenu.
 *
 * Les constats sont formulés en phrases corrigeables (« "columns" doit contenir au moins 2
 * éléments ») : un agent qui lit le refus sait quoi réparer sans qu'on lui redonne tout le contrat.
 */
import type { z } from 'zod/v4';
import { Issue } from './common';
import { Block, ContentModel, SectionContent } from './content-model';
import { DesignSpec, Node, NodeT } from './design-spec';
import { RenderResult } from './render-result';

export interface Report<T> {
  ok: boolean;
  value?: T;
  issues: Issue[];
}

const issue = (code: string, message: string, path?: string, fix?: string, severity: Issue['severity'] = 'blocking'): Issue => ({
  code,
  severity,
  message,
  ...(path ? { path } : {}),
  ...(fix ? { fix } : {}),
});

const pathOf = (path: ReadonlyArray<PropertyKey>): string => path.map(String).join('.');

/** Traduit les constats de zod en constats corrigeables. */
export function zodIssues(error: z.ZodError): Issue[] {
  return error.issues.slice(0, 40).map((raw) => {
    const path = pathOf(raw.path);
    const where = path ? `« ${path} » ` : '';
    const info = raw as unknown as Record<string, unknown>;
    switch (raw.code) {
      case 'too_big':
        return issue('too_big', `${where}dépasse la limite (${String(info.maximum)}).`, path, `raccourcir ou retirer des éléments (max ${String(info.maximum)})`);
      case 'too_small':
        return issue('too_small', `${where}est trop court (minimum ${String(info.minimum)}).`, path, `fournir au moins ${String(info.minimum)}`);
      case 'unrecognized_keys':
        return issue('unknown_key', `${where}contient des clés inconnues : ${(info.keys as string[] | undefined)?.join(', ') ?? '?'}.`, path, 'retirer ces clés');
      case 'invalid_type':
        return issue('invalid_type', `${where}n'a pas le bon type (attendu : ${String(info.expected)}).`, path, `donner un ${String(info.expected)}`);
      case 'invalid_union':
        return issue('invalid_union', `${where}ne correspond à aucune forme admise${info.discriminator ? ` (champ « ${String(info.discriminator)} »)` : ''}.`, path, 'utiliser un type connu du contrat');
      default:
        return issue(String(raw.code), `${where}${raw.message}`, path);
    }
  });
}

// ── ContentModel ───────────────────────────────────────────────────────────────────────────

export function validateContent(raw: unknown): Report<ContentModel> {
  const parsed = ContentModel.safeParse(raw);
  if (!parsed.success) return { ok: false, issues: zodIssues(parsed.error) };
  const content = parsed.data;
  const issues: Issue[] = [];
  const sectionIds = new Set<string>();
  for (const section of content.sections) {
    if (sectionIds.has(section.id)) issues.push(issue('duplicate_section', `La section « ${section.id} » apparaît deux fois.`, `sections.${section.id}`, 'donner un identifiant unique'));
    sectionIds.add(section.id);
    const blockIds = new Set<string>();
    for (const block of section.blocks) {
      if (blockIds.has(block.id)) issues.push(issue('duplicate_block', `Le bloc « ${block.id} » apparaît deux fois dans « ${section.id} ».`, `sections.${section.id}.blocks`, 'donner un identifiant unique'));
      blockIds.add(block.id);
    }
  }
  return { ok: issues.length === 0, value: content, issues };
}

export function validateSectionContent(raw: unknown): Report<SectionContent> {
  const parsed = SectionContent.safeParse(raw);
  return parsed.success ? { ok: true, value: parsed.data, issues: [] } : { ok: false, issues: zodIssues(parsed.error) };
}

export function validateBlock(raw: unknown): Report<Block> {
  const parsed = Block.safeParse(raw);
  return parsed.success ? { ok: true, value: parsed.data, issues: [] } : { ok: false, issues: zodIssues(parsed.error) };
}

// ── DesignSpec ─────────────────────────────────────────────────────────────────────────────

export const LIMITS = { maxDepth: 9, maxNodesPerSection: 220 } as const;

export interface TreeStats {
  nodes: number;
  depth: number;
  blockRefs: string[];
  textRefs: string[];
  /** Blocs posés par une image (`image.ref`) : une photo est un bloc `figure`. */
  imageRefs: string[];
  ids: string[];
}

export function walk(node: NodeT, visit: (node: NodeT, depth: number) => void, depth = 1): void {
  visit(node, depth);
  if ('children' in node) for (const child of node.children) walk(child, visit, depth + 1);
  if (node.t === 'layer') for (const item of node.items) walk(item.node, visit, depth + 1);
}

export function treeStats(root: NodeT): TreeStats {
  const stats: TreeStats = { nodes: 0, depth: 0, blockRefs: [], textRefs: [], imageRefs: [], ids: [] };
  walk(root, (node, depth) => {
    stats.nodes += 1;
    stats.depth = Math.max(stats.depth, depth);
    if ('id' in node && node.id) stats.ids.push(node.id);
    if (node.t === 'block') stats.blockRefs.push(node.ref);
    if (node.t === 'text' && node.ref) stats.textRefs.push(node.ref);
    if (node.t === 'image' && node.ref) stats.imageRefs.push(node.ref);
  });
  return stats;
}

/** Les décors d'une section comptent aussi (une photo plein cadre est un décor qui pose un bloc). */
function sectionStats(section: { root: NodeT; decor?: Array<{ node: NodeT }> }): TreeStats {
  const stats = treeStats(section.root);
  for (const item of section.decor ?? []) {
    const d = treeStats(item.node);
    stats.blockRefs.push(...d.blockRefs);
    stats.textRefs.push(...d.textRefs);
    stats.imageRefs.push(...d.imageRefs);
    stats.ids.push(...d.ids);
  }
  return stats;
}

/** Les références de texte admises : `title`, `kicker`, `lede` et `<idBloc>[.chemin]`. */
export function textRefResolves(ref: string, section: SectionContent): boolean {
  if (ref === 'title') return true;
  if (ref === 'kicker') return Boolean(section.kicker);
  if (ref === 'lede') return Boolean(section.lede);
  const [id] = ref.split('.');
  return section.blocks.some((b) => b.id === id);
}

export interface SpecContext {
  content?: ContentModel;
  /** Les identifiants de composants et de motifs connus (le registre). Absent : non vérifié. */
  knownComponents?: ReadonlySet<string>;
  knownPatterns?: ReadonlySet<string>;
}

export function validateDesignSpec(raw: unknown, context: SpecContext = {}): Report<DesignSpec> {
  const parsed = DesignSpec.safeParse(raw);
  if (!parsed.success) return { ok: false, issues: zodIssues(parsed.error) };
  const spec = parsed.data;
  const issues: Issue[] = [];
  const seen = new Set<string>();

  for (const section of spec.sections) {
    const at = `sections.${section.ref}`;
    if (seen.has(section.ref)) issues.push(issue('duplicate_section_spec', `Deux plans pour la section « ${section.ref} ».`, at, 'garder un seul plan par section'));
    seen.add(section.ref);

    const stats = sectionStats(section);
    if (stats.depth > LIMITS.maxDepth) issues.push(issue('tree_too_deep', `L'arbre de « ${section.ref} » a ${stats.depth} niveaux (max ${LIMITS.maxDepth}).`, at, 'aplatir : fusionner des conteneurs imbriqués'));
    if (stats.nodes > LIMITS.maxNodesPerSection) issues.push(issue('tree_too_big', `L'arbre de « ${section.ref} » a ${stats.nodes} nœuds (max ${LIMITS.maxNodesPerSection}).`, at, 'retirer des décors'));
    const dup = stats.ids.find((id, i) => stats.ids.indexOf(id) !== i);
    if (dup) issues.push(issue('duplicate_node_id', `L'identifiant de nœud « ${dup} » est employé deux fois dans « ${section.ref} ».`, at, 'identifiants uniques'));
    if (context.knownPatterns && !context.knownPatterns.has(section.pattern.id)) issues.push(issue('unknown_pattern', `Le motif « ${section.pattern.id} » n'existe pas dans le registre.`, `${at}.pattern`, 'choisir un motif du menu'));

    if (context.knownComponents) {
      walk(section.root, (node) => {
        if (node.t === 'block' && node.component && !context.knownComponents!.has(node.component)) {
          issues.push(issue('unknown_component', `Le composant « ${node.component} » n'existe pas dans le registre.`, at, 'choisir un composant du menu'));
        }
      });
    }

    const content = context.content?.sections.find((s) => s.id === section.ref);
    if (context.content && !content) {
      issues.push(issue('unknown_section', `Le plan vise la section « ${section.ref} », absente du contenu.`, at, 'viser une section du contenu'));
      continue;
    }
    if (content) {
      const ids = new Set(content.blocks.map((b) => b.id));
      for (const ref of [...stats.blockRefs, ...stats.imageRefs]) if (!ids.has(ref)) issues.push(issue('unknown_block', `Le plan pose le bloc « ${ref} », absent de la section « ${section.ref} ».`, at, `blocs disponibles : ${[...ids].join(', ') || '(aucun)'}`));
      for (const ref of stats.textRefs) if (!textRefResolves(ref, content)) issues.push(issue('unknown_text_ref', `La référence de texte « ${ref} » ne désigne rien dans « ${section.ref} ».`, at, 'title, kicker, lede ou <idBloc>'));
      // Un bloc est POSÉ par un nœud `block`, par une image (photo), ou champ par champ par des textes
      // (une couverture, une carte, un visuel lisent leurs champs un à un).
      const placed = new Set([...stats.blockRefs, ...stats.imageRefs, ...stats.textRefs.filter((r) => r.includes('.')).map((r) => r.split('.')[0])]);
      const counts = new Map<string, number>();
      for (const ref of stats.blockRefs) counts.set(ref, (counts.get(ref) ?? 0) + 1);
      for (const block of content.blocks) {
        if (!placed.has(block.id)) issues.push(issue('block_not_placed', `Le bloc « ${block.id} » (${block.kind}) n'est posé nulle part dans « ${section.ref} » : du contenu serait perdu.`, at, `poser le bloc « ${block.id} »`));
        else if ((counts.get(block.id) ?? 0) > 1) issues.push(issue('block_placed_twice', `Le bloc « ${block.id} » est posé ${counts.get(block.id)} fois dans « ${section.ref} ».`, at, 'un bloc se pose une seule fois'));
      }
    }
  }

  if (context.content) {
    for (const section of context.content.sections) if (!seen.has(section.id)) issues.push(issue('section_without_plan', `La section « ${section.id} » n'a pas de plan.`, `sections.${section.id}`, 'composer cette section', 'advisory'));
  }
  return { ok: !issues.some((i) => i.severity === 'blocking'), value: spec, issues };
}

export function validateNode(raw: unknown): Report<NodeT> {
  const parsed = Node.safeParse(raw);
  if (!parsed.success) return { ok: false, issues: zodIssues(parsed.error) };
  const stats = treeStats(parsed.data);
  const issues: Issue[] = [];
  if (stats.depth > LIMITS.maxDepth) issues.push(issue('tree_too_deep', `L'arbre a ${stats.depth} niveaux (max ${LIMITS.maxDepth}).`));
  if (stats.nodes > LIMITS.maxNodesPerSection) issues.push(issue('tree_too_big', `L'arbre a ${stats.nodes} nœuds (max ${LIMITS.maxNodesPerSection}).`));
  return { ok: issues.length === 0, value: parsed.data, issues };
}

export function validateRenderResult(raw: unknown): Report<RenderResult> {
  const parsed = RenderResult.safeParse(raw);
  return parsed.success ? { ok: true, value: parsed.data, issues: [] } : { ok: false, issues: zodIssues(parsed.error) };
}

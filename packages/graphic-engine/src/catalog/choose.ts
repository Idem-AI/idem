/**
 * LE CHOIX PAR LE MODÈLE — une petite tâche : lire une liste courte de gabarits DOCUMENTÉS et mettre à jour leur
 * configuration (lequel, quels réglages, quel composant par unité, miroir, réglages continus). Aucune ligne de HTML,
 * aucun mot de contenu : une réponse JSON de quelques dizaines de jetons, vérifiée par le code (identifiants connus
 * seulement, valeurs ramenées dans leurs bornes). Une réponse illisible laisse le choix du code.
 *
 * C'est assez petit pour un modèle open-weight léger (échelle `catalog`).
 */
import type { CreativityLevel } from '../contracts/common';
import type { SectionContent } from '../contracts/content-model';
import { catalogEffortFor } from '../foundation/effort';
import type { PageUnit } from './assemble';
import type { BrandTraits, Candidate } from './graph';
import type { ComponentNode, LoadedCatalog, NodeVar, PageConfig, SkinNode } from './types';

export interface ChooseContext {
  deliverable: string;
  brandLine: string;
  language?: string;
  traits: BrandTraits;
  plan?: string;
  layoutNote?: string;
  reference?: string;
}

const docLine = (d: { title: string; summary: string; use?: string; avoid?: string }) => `${d.title} — ${d.summary}${d.use ? ` Use: ${d.use}` : ''}${d.avoid ? ` Avoid: ${d.avoid}` : ''}`;
const varLine = (v: NodeVar) => `${v.name} ∈ {${v.options.map((o) => o.id).join('|')}}${v.doc ? ` (${v.doc})` : ''}`;

export function chooseSystem(deliverable: string): string {
  return [
    `You are the art director of ${deliverable}. Each page is built from a CATALOG of documented templates: you pick one and set its options so the page serves its content and the brand art direction.`,
    'Rules: use only the ids given; prefer what makes the message clearest; never pick a template whose "Avoid" matches the page; vary from the neighbouring pages.',
    'Answer ONLY JSON, no prose.',
  ].join('\n');
}

function unitsLine(units: PageUnit[]): string {
  return units.map((u) => (u.kind === 'header' ? 'header' : `${u.id}:${u.kind}${u.items > 1 ? `×${u.items}` : ''}`)).join(', ');
}

/** La demande d'UNE page : candidats documentés, réglages, et (High, Ultra) composants par unité et réglages continus. */
export function chooseUser(cat: LoadedCatalog, ctx: ChooseContext, p: { section: SectionContent; units: PageUnit[]; candidates: Candidate[]; level: CreativityLevel; componentOptions?: Map<string, ComponentNode[]>; skin?: SkinNode; current?: PageConfig; instruction?: string }): string {
  const effort = catalogEffortFor(p.level);
  const picks = Math.min(effort.picks, p.candidates.length);
  const lines: string[] = [
    `BRAND: ${ctx.brandLine}${ctx.traits.moods.length ? ` · moods: ${ctx.traits.moods.join(', ')}` : ''}${ctx.traits.density ? ` · density: ${ctx.traits.density}` : ''}`,
    ctx.language ? `BRAND VISUAL LANGUAGE: ${ctx.language.replace(/\s+/g, ' ').slice(0, 600)}` : '',
    ctx.plan ? `THIS PAGE IN THE DOCUMENT PLAN: ${ctx.plan.slice(0, 300)}` : '',
    ctx.reference ? `THE CLIENT'S MODEL COMPOSITION: ${ctx.reference.slice(0, 400)}` : '',
    ctx.layoutNote ? `THE CLIENT ASKS: ${ctx.layoutNote.slice(0, 300)}` : '',
    `PAGE: ${p.section.role ?? 'page'} — "${p.section.title.slice(0, 120)}"${p.section.intent?.keyMessage ? ` — must convey: ${p.section.intent.keyMessage.slice(0, 200)}` : ''}`,
    `CONTENT UNITS: ${unitsLine(p.units)}`,
    'TEMPLATES:',
    ...p.candidates.map((c) => {
      const node = c.gabarit ?? c.layout;
      const vars = [...(p.skin?.vars ?? []), ...Object.values(c.config.components).flatMap((id) => (cat.nodes.get(id) as ComponentNode | undefined)?.vars ?? [])];
      const params = effort.assembly === 'mixed' ? (c.layout.params ?? []).map((x) => `${x.name} ${x.min}–${x.max}`) : [];
      return `${c.ref}. ${docLine(node.doc)}${c.layout.mirrorable ? ' [mirror ok]' : ''}${vars.length && effort.assembly !== 'gabarit' ? ` | options: ${vars.map(varLine).join('; ')}` : ''}${params.length ? ` | params: ${params.join(', ')}` : ''}`;
    }),
  ];
  if (p.componentOptions?.size) {
    lines.push('COMPONENTS PER UNIT (optional, else the default):');
    for (const [unit, comps] of p.componentOptions) if (comps.length > 1) lines.push(`- ${unit}: ${comps.map((c) => `${c.id} (${c.doc.title})`).join(' | ')}`);
  }
  if (p.current) lines.push(`CURRENT CONFIG: ${JSON.stringify(p.current)}`, `CLIENT'S REQUEST FOR THIS PAGE: ${String(p.instruction ?? '').slice(0, 400)}`);
  const one = `{"pick":"A","vars":{"name":"option"},"mirror":false${p.componentOptions?.size ? ',"components":{"unit":"component-id"}' : ''}${effort.assembly === 'mixed' ? ',"params":{"split":6}' : ''}}`;
  lines.push(picks > 1 ? `ANSWER: {"picks":[${one}, …]} — ${picks} different picks, best first.` : `ANSWER: ${one}`);
  return lines.filter(Boolean).join('\n');
}

/**
 * La réponse du modèle → des configurations VÉRIFIÉES : un candidat connu, des réglages et composants permis, des
 * réglages continus dans leurs bornes. Le reste de la configuration est celui du candidat (choix du code).
 */
export function parseChoices(raw: string, cat: LoadedCatalog, candidates: Candidate[], o: { componentOptions?: Map<string, ComponentNode[]>; skin?: SkinNode; params?: boolean }): Candidate[] {
  const match = String(raw || '').replace(/```[a-z]*\n?/gi, '').match(/\{[\s\S]*\}/);
  if (!match) return [];
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return [];
  }
  const list = (Array.isArray(json.picks) ? json.picks : [json]) as Array<Record<string, unknown>>;
  const out: Candidate[] = [];
  for (const pick of list.slice(0, 4)) {
    const ref = String(pick?.pick ?? '').trim().toUpperCase().slice(0, 2);
    const base = candidates.find((c) => c.ref === ref || c.gabarit?.id === pick?.pick || c.layout.id === pick?.pick);
    if (!base) continue;
    const config: PageConfig = { ...base.config, components: { ...base.config.components }, vars: { ...base.config.vars }, params: { ...base.config.params } };
    // Composants : seulement ceux proposés pour l'unité.
    const comps = (pick.components && typeof pick.components === 'object' ? pick.components : {}) as Record<string, unknown>;
    for (const [unit, id] of Object.entries(comps)) if (o.componentOptions?.get(unit)?.some((c) => c.id === id)) config.components[unit] = String(id);
    // Réglages : seulement les options déclarées par l'habillage et les composants retenus.
    const declared = [...(o.skin?.vars ?? []), ...Object.values(config.components).flatMap((id) => (cat.nodes.get(id) as ComponentNode | undefined)?.vars ?? [])];
    const vars = (pick.vars && typeof pick.vars === 'object' ? pick.vars : {}) as Record<string, unknown>;
    for (const [name, value] of Object.entries(vars)) if (declared.some((v) => v.name === name && v.options.some((x) => x.id === value))) config.vars[name] = String(value);
    if (typeof pick.mirror === 'boolean') config.mirror = base.layout.mirrorable ? pick.mirror : false;
    if (o.params && pick.params && typeof pick.params === 'object') {
      for (const p of base.layout.params ?? []) {
        const v = Number((pick.params as Record<string, unknown>)[p.name]);
        if (Number.isFinite(v)) config.params[p.name] = Math.min(p.max, Math.max(p.min, v));
      }
    }
    out.push({ ...base, config });
  }
  return out;
}

/** L'HABILLAGE du document (High, Ultra) : un choix parmi quelques habillages documentés, une fois par document. */
export function skinUser(ctx: ChooseContext, skins: SkinNode[]): string {
  return [
    `BRAND: ${ctx.brandLine}${ctx.traits.moods.length ? ` · moods: ${ctx.traits.moods.join(', ')}` : ''}`,
    ctx.language ? `BRAND VISUAL LANGUAGE: ${ctx.language.replace(/\s+/g, ' ').slice(0, 600)}` : '',
    'Pick the visual treatment (typography, rules, panels) of the whole document — the same on every page:',
    ...skins.map((s, i) => `${String.fromCharCode(65 + i)}. ${docLine(s.doc)}`),
    'ANSWER: {"pick":"A"}',
  ]
    .filter(Boolean)
    .join('\n');
}

export function parseSkin(raw: string, skins: SkinNode[]): SkinNode | undefined {
  const m = String(raw || '').match(/"pick"\s*:\s*"([A-Za-z0-9._-]+)"/);
  if (!m) return undefined;
  const v = m[1];
  return v.length <= 2 ? skins[v.toUpperCase().charCodeAt(0) - 65] : skins.find((s) => s.id === v);
}

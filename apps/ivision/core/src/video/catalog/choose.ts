/**
 * LE CHOIX PAR LE MODÈLE — une petite tâche pour TOUT le film en un appel (rôle `video.template`) : le thème parmi
 * quelques-uns, puis pour chaque scène un candidat de sa liste courte, et (crans hauts) l'animation de ses rôles, sa
 * transition d'entrée et son rythme. Aucune ligne de code, aucun mot de contenu : une réponse JSON vérifiée par le code
 * (identifiants connus, cibles compatibles, bornes). Une réponse illisible laisse le choix du code.
 *
 * Le cran règle la profondeur (`VIDEO_CATALOG_EFFORT`) ; il choisit aussi le modèle (échelle `catalog` de l'hôte).
 */
import type { CreativityLevel } from '../../creativity/levels';
import type { SceneCandidate } from './graph';
import type { AnimationNode, AnimRole, LoadedVideoCatalog, SceneConfig, ThemeNode, TransitionNode } from './types';
import { ROLE_TARGET } from './types';

export interface VideoCatalogEffort {
  /** `code` : le code choisit seul (0 jeton) ; `model` : le modèle choisit dans la liste courte. */
  chooser: 'code' | 'model';
  shortlist: number;
  /** Les thèmes proposés au modèle (1 : le code le choisit). */
  themes: number;
  /** Le modèle choisit aussi l'animation de chaque rôle et la transition d'entrée. */
  motion: boolean;
  /** Le modèle règle aussi le rythme de chaque scène (`pace`). */
  params: boolean;
}

export const VIDEO_CATALOG_EFFORT: Record<CreativityLevel, VideoCatalogEffort> = {
  low: { chooser: 'code', shortlist: 4, themes: 1, motion: false, params: false },
  medium: { chooser: 'model', shortlist: 4, themes: 1, motion: false, params: false },
  high: { chooser: 'model', shortlist: 6, themes: 3, motion: true, params: false },
  ultra: { chooser: 'model', shortlist: 8, themes: 4, motion: true, params: true },
};
export const videoEffortFor = (level: CreativityLevel): VideoCatalogEffort => VIDEO_CATALOG_EFFORT[level] ?? VIDEO_CATALOG_EFFORT.medium;

export interface ChooseScene {
  key: string;
  role?: string;
  energy: number;
  duration: number;
  /** « title 42 signes, body 80, items 3, media image » : la forme, jamais les mots. */
  shape: string;
  candidates: SceneCandidate[];
  /** Les rôles animables de chaque candidat (pour proposer les animations). */
  roles: Record<string, AnimRole[]>;
}

const docLine = (d: { title: string; summary: string; use?: string; avoid?: string }) => `${d.title} — ${d.summary}${d.use ? ` Use: ${d.use}` : ''}${d.avoid ? ` Avoid: ${d.avoid}` : ''}`;

export function chooseSystem(): string {
  return [
    'You are the motion director of a short brand film. Every scene is built from a CATALOG of documented scene templates, animations and transitions; you pick, you never write code or text.',
    'Rules: use only the letters and ids given; one theme for the whole film; vary the templates from scene to scene; match the energy of each scene; keep at most two kinds of transitions in the film; never bounce, never decorate for its own sake.',
    'Answer ONLY JSON, no prose.',
  ].join('\n');
}

export function chooseUser(cat: LoadedVideoCatalog, o: { brandLine: string; film: { title: string; concept: string; style?: string }; themes: ThemeNode[]; scenes: ChooseScene[]; effort: VideoCatalogEffort; revise?: { key: string; current: SceneConfig; instruction: string } }): string {
  const anims = [...cat.nodes.values()].filter((n): n is AnimationNode => n.kind === 'animation' && !n.id.startsWith('builtin.'));
  const trans = [...cat.nodes.values()].filter((n): n is TransitionNode => n.kind === 'transition' && !n.id.startsWith('builtin.'));
  const lines: string[] = [
    `BRAND: ${o.brandLine}`,
    `FILM: ${o.film.title.slice(0, 120)} — ${o.film.concept.slice(0, 400)}${o.film.style && o.film.style !== 'auto' ? ` · requested style: ${o.film.style}` : ''}`,
  ];
  if (o.themes.length > 1) {
    lines.push('THEMES (one for the whole film):');
    o.themes.forEach((t, i) => lines.push(`${String.fromCharCode(65 + i)}. ${docLine(t.doc)}`));
  }
  if (o.effort.motion) {
    lines.push(`ANIMATIONS (id: what it does · for): ${anims.map((a) => `${a.id}: ${a.doc.title} · ${a.targets.join('/')}`).join(' | ')}`);
    lines.push(`TRANSITIONS (how a scene ENTERS): ${trans.map((t) => `${t.id}: ${t.doc.title}`).join(' | ')}`);
  }
  lines.push('SCENES:');
  for (const s of o.scenes) {
    lines.push(`${s.key} (${s.role ?? 'scene'}, energy ${s.energy}, ${s.duration.toFixed(1)} s) — ${s.shape}`);
    for (const c of s.candidates) lines.push(`  ${c.ref}. ${docLine((c.gabarit ?? c.layout).doc)}${o.effort.motion ? ` [roles: ${(s.roles[c.ref] ?? []).join(', ')}]` : ''}`);
  }
  if (o.revise) lines.push(`CURRENT CONFIG OF ${o.revise.key}: ${JSON.stringify(o.revise.current)}`, `CLIENT'S REQUEST FOR ${o.revise.key}: ${o.revise.instruction.slice(0, 600)}`);
  const scene = `{"scene":"${o.scenes[0]?.key ?? 's1'}","pick":"A"${o.effort.motion ? ',"animations":{"title":"anim.x"},"transition":"trans.y"' : ''}${o.effort.params ? ',"pace":1.0' : ''}}`;
  lines.push(`ANSWER: {${o.themes.length > 1 && !o.revise ? '"theme":"A",' : ''}"scenes":[${scene}, …]}${o.revise ? ` — only ${o.revise.key}` : ' — one entry per scene, in order'}`);
  return lines.join('\n');
}

export interface ParsedChoice {
  theme?: ThemeNode;
  scenes: Map<string, SceneCandidate>;
}

/** La réponse → des configurations VÉRIFIÉES (le reste de la configuration est celui du candidat). */
export function parseChoices(raw: string, cat: LoadedVideoCatalog, o: { themes: ThemeNode[]; scenes: ChooseScene[]; effort: VideoCatalogEffort }): ParsedChoice | null {
  const match = String(raw || '').replace(/```[a-z]*\n?/gi, '').match(/\{[\s\S]*\}/);
  if (!match) return null;
  let json: { theme?: unknown; scenes?: unknown };
  try {
    json = JSON.parse(match[0]);
  } catch {
    return null;
  }
  const out: ParsedChoice = { scenes: new Map() };
  const t = String(json.theme ?? '').trim();
  if (t) out.theme = t.length <= 2 ? o.themes[t.toUpperCase().charCodeAt(0) - 65] : o.themes.find((x) => x.id === t);
  const list = Array.isArray(json.scenes) ? (json.scenes as Array<Record<string, unknown>>) : [];
  for (const [i, pick] of list.entries()) {
    const scene = o.scenes.find((s) => s.key === pick?.scene) ?? o.scenes[i];
    if (!scene) continue;
    const ref = String(pick?.pick ?? '').trim().toUpperCase();
    const base = scene.candidates.find((c) => c.ref === ref || c.gabarit?.id === pick?.pick || c.layout.id === pick?.pick);
    if (!base) continue;
    const config: SceneConfig = { ...base.config, animations: { ...base.config.animations }, ...(base.config.vars ? { vars: { ...base.config.vars } } : {}) };
    if (o.effort.motion) {
      const roles = scene.roles[base.ref] ?? [];
      const anims = (pick.animations && typeof pick.animations === 'object' ? pick.animations : {}) as Record<string, unknown>;
      for (const [role, id] of Object.entries(anims)) {
        const a = cat.nodes.get(String(id));
        if (a?.kind === 'animation' && roles.includes(role as AnimRole) && a.targets.includes(ROLE_TARGET[role as AnimRole])) config.animations[role as AnimRole] = a.id;
      }
      const tr = cat.nodes.get(String(pick.transition ?? ''));
      if (tr?.kind === 'transition') config.transition = tr.id;
    }
    if (o.effort.params) {
      const pace = Number(pick.pace);
      if (Number.isFinite(pace)) config.params = { pace: Math.min(1.25, Math.max(0.8, pace)) };
    }
    out.scenes.set(scene.key, { ...base, config });
  }
  return out.scenes.size || out.theme ? out : null;
}

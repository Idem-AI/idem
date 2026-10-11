/**
 * LES CORRECTIONS CIBLÉES — modifier une couche, un paramètre, une lettre ou une proportion
 * sans toucher à ce qui est déjà satisfaisant.
 *
 * Un patch est une liste d'opérations courtes sur le Logo IR. Il est écrit par l'agent (quelques
 * dizaines de tokens au lieu de redessiner le logo), ou par l'auto-amélioration (sans token).
 * Le document corrigé repasse toujours par le schéma : un patch ne peut pas produire un logo
 * invalide, et une opération qui vise une couche inconnue est refusée avec un message clair.
 */
import { z } from 'zod';
import { getGenerator } from '../render/generators';
import { ColorRef, CompositionSchema, HexColor, LayerSchema, LogoDocumentSchema, StrokeSchema, TextEffectSchema, TransformSchema, walkLayers } from './logo.schema';
import type { LogoDocument, LogoLayer } from './logo.schema';

const Param = z.union([z.number(), z.string(), z.boolean()]);

export const PatchOpSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('palette'), ink: HexColor.optional(), ink2: HexColor.optional(), accent: HexColor.optional() }),
  z.object({
    op: z.literal('layer'),
    id: z.string(),
    fill: z.union([ColorRef, z.literal('none')]).optional(),
    hidden: z.boolean().optional(),
    opacity: z.number().optional(),
    stroke: StrokeSchema.optional(),
    transform: TransformSchema.optional(),
    params: z.record(Param).optional(),
    seed: z.number().optional(),
  }),
  z.object({
    op: z.literal('text'),
    id: z.string(),
    content: z.string().optional(),
    case: z.enum(['none', 'upper', 'lower', 'title']).optional(),
    tracking: z.number().optional(),
    weight: z.number().optional(),
    size: z.number().optional(),
    fill: z.union([ColorRef, z.literal('none')]).optional(),
    effects: z.array(TextEffectSchema).optional(),
  }),
  z.object({ op: z.literal('generator'), id: z.string(), generator: z.string(), params: z.record(Param).optional() }),
  z.object({ op: z.literal('composition'), ...CompositionSchema.partial().shape }),
  z.object({ op: z.literal('remove'), id: z.string() }),
  z.object({ op: z.literal('add'), layer: z.unknown() }),
]);
export type PatchOp = z.infer<typeof PatchOpSchema>;

export interface PatchResult {
  ok: boolean;
  doc?: LogoDocument;
  applied: number;
  errors: string[];
}

function findIn(layers: LogoLayer[], id: string): LogoLayer | undefined {
  let found: LogoLayer | undefined;
  walkLayers(layers, (l) => {
    if (!found && l.id === id) found = l;
  });
  return found;
}

function removeFrom(layers: LogoLayer[], id: string): boolean {
  const index = layers.findIndex((l) => l.id === id);
  if (index >= 0) {
    layers.splice(index, 1);
    return true;
  }
  for (const layer of layers) {
    if (layer.kind === 'boolean' && removeFrom(layer.operands, id)) return true;
    if (layer.kind === 'group' && removeFrom(layer.children, id)) return true;
  }
  return false;
}

/** Applique les opérations ; les invalides sont écartées (et signalées), les valides appliquées. */
export function applyPatch(doc: LogoDocument, ops: unknown[]): PatchResult {
  const work = JSON.parse(JSON.stringify(doc)) as LogoDocument;
  const errors: string[] = [];
  let applied = 0;

  ops.slice(0, 24).forEach((raw, i) => {
    const parsed = PatchOpSchema.safeParse(raw);
    if (!parsed.success) {
      errors.push(`opération ${i + 1} : ${parsed.error.issues[0]?.message ?? 'illisible'}`);
      return;
    }
    const op = parsed.data;
    const need = (id: string) => {
      const layer = findIn(work.layers, id);
      if (!layer) errors.push(`opération ${i + 1} : couche « ${id} » introuvable`);
      return layer;
    };
    switch (op.op) {
      case 'palette':
        if (op.ink) work.palette.ink = op.ink;
        if (op.ink2) work.palette.ink2 = op.ink2;
        if (op.accent) work.palette.accent = op.accent;
        applied++;
        break;
      case 'layer': {
        const layer = need(op.id);
        if (!layer) return;
        if (op.fill !== undefined) layer.fill = op.fill;
        if (op.hidden !== undefined) layer.hidden = op.hidden;
        if (op.opacity !== undefined) layer.opacity = Math.min(1, Math.max(0.1, op.opacity));
        if (op.stroke) layer.stroke = op.stroke;
        if (op.transform) layer.transform = { ...(layer.transform ?? {}), ...op.transform };
        if (op.params) {
          if (layer.kind !== 'generator') {
            errors.push(`opération ${i + 1} : « params » ne s'applique qu'à un générateur (« ${op.id} » est ${layer.kind})`);
            return;
          }
          layer.params = { ...layer.params, ...op.params };
        }
        if (op.seed !== undefined && layer.kind === 'generator') layer.seed = Math.round(op.seed);
        applied++;
        break;
      }
      case 'text': {
        const layer = need(op.id);
        if (!layer) return;
        if (layer.kind !== 'text') {
          errors.push(`opération ${i + 1} : « ${op.id} » n'est pas une couche de texte`);
          return;
        }
        if (op.content !== undefined) layer.content = op.content.slice(0, 48);
        if (op.case) layer.case = op.case;
        if (op.tracking !== undefined) layer.tracking = Math.min(0.6, Math.max(-0.1, op.tracking));
        if (op.weight !== undefined) layer.font = { ...layer.font, weight: Math.min(900, Math.max(100, Math.round(op.weight / 100) * 100)) };
        if (op.size !== undefined) layer.size = Math.min(80, Math.max(2, op.size));
        if (op.fill !== undefined) layer.fill = op.fill;
        if (op.effects) layer.effects = op.effects.slice(0, 3);
        applied++;
        break;
      }
      case 'generator': {
        const layer = need(op.id);
        if (!layer) return;
        if (layer.kind !== 'generator') {
          errors.push(`opération ${i + 1} : « ${op.id} » n'est pas un générateur`);
          return;
        }
        if (!getGenerator(op.generator)) {
          errors.push(`opération ${i + 1} : générateur « ${op.generator} » inconnu`);
          return;
        }
        layer.generator = op.generator;
        layer.params = op.params ?? {};
        applied++;
        break;
      }
      case 'composition': {
        const { op: _op, ...rest } = op;
        void _op;
        work.composition = { ...work.composition, ...Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)) } as LogoDocument['composition'];
        applied++;
        break;
      }
      case 'remove': {
        if (work.layers.length <= 1 && work.layers[0]?.id === op.id) {
          errors.push(`opération ${i + 1} : impossible de retirer la dernière couche`);
          return;
        }
        if (!removeFrom(work.layers, op.id)) errors.push(`opération ${i + 1} : couche « ${op.id} » introuvable`);
        else applied++;
        break;
      }
      case 'add': {
        const layer = LayerSchema.safeParse(op.layer);
        if (!layer.success) {
          errors.push(`opération ${i + 1} : couche à ajouter invalide (${layer.error.issues[0]?.message})`);
          return;
        }
        if (findIn(work.layers, layer.data.id)) {
          errors.push(`opération ${i + 1} : l'identifiant « ${layer.data.id} » existe déjà`);
          return;
        }
        work.layers.push(layer.data);
        applied++;
        break;
      }
    }
  });

  const valid = LogoDocumentSchema.safeParse(work);
  if (!valid.success) return { ok: false, applied: 0, errors: [...errors, ...valid.error.issues.slice(0, 3).map((x) => `${x.path.join('.')} : ${x.message}`)] };
  return { ok: applied > 0, doc: valid.data, applied, errors };
}

/**
 * LE SCHÉMA JSON DE L'INTENTION — pour les sorties structurées (`response_format: json_schema`, `strict`).
 *
 * Construit PAR SCÈNE : les clés de texte et les rangs de média autorisés sont des énumérations (le modèle ne peut pas
 * inventer un texte ni citer un média absent). En mode strict, chaque propriété est requise : une propriété facultative
 * accepte `null` (retiré à la lecture, `validate.ts`). Les relations sont des objets `{ a, rel, b }`.
 */
import { DIRECTION_IDS } from '../design/types';
import { SCENE_ROLES } from '../design/film';
import { TYPE_LEVELS } from '../dsl/types';
import { BACKGROUNDS, ELEMENT_KINDS, LAYOUT_KINDS, RELATIONS, SHAPE_KINDS, VERBS } from './types';

const nullable = (schema: Record<string, unknown>) => ({ anyOf: [schema, { type: 'null' }] });
const strEnum = (values: readonly string[]) => ({ type: 'string', enum: [...values] });

export interface IntentSchemaContext {
  texts: string[];
  media: number;
}

/** Le schéma strict de l'intention d'une scène. */
export function intentJsonSchema(ctx: IntentSchemaContext): Record<string, unknown> {
  const textKeys = ctx.texts.map((k) => `$${k}`);
  const textRef = textKeys.length ? nullable(strEnum(textKeys)) : { type: 'null' };
  const mediaRef = ctx.media > 0 ? nullable({ type: 'integer', enum: Array.from({ length: ctx.media }, (_, i) => i) }) : { type: 'null' };
  const element = {
    type: 'object',
    additionalProperties: false,
    required: ['id', 'kind', 'text', 'items', 'media', 'level', 'rank', 'crop', 'shape', 'color', 'icon', 'device', 'emphasis'],
    properties: {
      id: { type: 'string', description: 'short id, letters/digits/-' },
      kind: strEnum(ELEMENT_KINDS),
      text: textRef,
      items: textKeys.length ? nullable({ type: 'array', items: strEnum(textKeys) }) : { type: 'null' },
      media: mediaRef,
      level: nullable(strEnum(TYPE_LEVELS)),
      rank: { type: 'integer', enum: [1, 2, 3] },
      crop: nullable(strEnum(['subject', 'fill', 'fit'])),
      shape: nullable(strEnum(SHAPE_KINDS)),
      color: nullable({ type: 'string' }),
      icon: nullable({ type: 'string' }),
      device: nullable(strEnum(['phone', 'laptop', 'browser'])),
      emphasis: nullable({ type: 'integer' }),
    },
  };
  const beat = {
    type: 'object',
    additionalProperties: false,
    required: ['verb', 'target', 'style', 'from', 'intensity', 'sync', 'after', 'with'],
    properties: {
      verb: strEnum(VERBS),
      target: { type: 'string' },
      style: nullable(strEnum(['words', 'letters', 'line', 'items'])),
      from: nullable(strEnum(['left', 'right', 'top', 'bottom', 'center'])),
      intensity: nullable(strEnum(['soft', 'normal', 'strong'])),
      sync: nullable(strEnum(['downbeat', 'beat', 'voice', 'none'])),
      after: nullable({ type: 'string' }),
      with: nullable({ type: 'string' }),
    },
  };
  return {
    type: 'object',
    additionalProperties: false,
    required: ['role', 'energy', 'layout', 'background', 'elements', 'relations', 'beats', 'camera'],
    properties: {
      role: nullable(strEnum(SCENE_ROLES)),
      energy: nullable({ type: 'integer', enum: [1, 2, 3, 4, 5] }),
      layout: strEnum(LAYOUT_KINDS),
      background: nullable(strEnum(BACKGROUNDS)),
      elements: { type: 'array', items: element },
      relations: nullable({ type: 'array', items: { type: 'object', additionalProperties: false, required: ['a', 'rel', 'b'], properties: { a: { type: 'string' }, rel: strEnum(RELATIONS), b: { type: 'string' } } } }),
      beats: { type: 'array', items: beat },
      camera: nullable({ type: 'object', additionalProperties: false, required: ['move', 'target'], properties: { move: strEnum(['none', 'push', 'pull', 'pan']), target: nullable({ type: 'string' }) } }),
    },
  };
}

/** Le schéma strict du choix de direction du directeur (premier et second choix, énergie par scène). */
export function directionJsonSchema(scenes: number): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['direction', 'alternative', 'energy'],
    properties: {
      direction: strEnum(DIRECTION_IDS),
      alternative: strEnum(DIRECTION_IDS),
      energy: { type: 'array', items: { type: 'integer', enum: [1, 2, 3, 4, 5] }, minItems: scenes, maxItems: scenes },
    },
  };
}

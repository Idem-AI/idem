/**
 * Le registre des motifs de composition. Les familles s'inscrivent elles-mêmes (`library.ts`) ; le registre
 * se charge à la première demande.
 */
import type { SectionRole } from '../../contracts/content-model';
import type { FormatFamily } from '../formats';
import type { PatternDef } from './types';

const BY_ID = new Map<string, PatternDef>();
let loaded = false;

function ensureLoaded(): void {
  if (loaded) return;
  loaded = true;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('./library');
}

export function registerPattern(def: PatternDef): PatternDef {
  if (BY_ID.has(def.id)) throw new Error(`graphic-engine: motif « ${def.id} » déjà inscrit`);
  BY_ID.set(def.id, def);
  return def;
}

export function patternById(id: string): PatternDef | undefined {
  ensureLoaded();
  return BY_ID.get(id);
}

/** Les motifs d'une famille de toiles, pour un rôle de section (la couverture et la face de carte ont les leurs). */
export function patternsFor(family: FormatFamily, role?: SectionRole): PatternDef[] {
  ensureLoaded();
  return [...BY_ID.values()].filter((p) => {
    if (p.family !== family) return false;
    if (p.roles) return role !== undefined && p.roles.includes(role);
    return role !== 'cover' && role !== 'card-face';
  });
}

export function allPatterns(): PatternDef[] {
  ensureLoaded();
  return [...BY_ID.values()];
}

/**
 * Le registre des composants : un identifiant → un composant, et pour chaque type de bloc son composant
 * par défaut. Les composants s'y inscrivent eux-mêmes (`library.ts`) ; le registre se charge à la
 * première demande, ce qui rend l'ordre des imports indifférent.
 */
import type { Block, BlockKind } from '../../contracts/content-model';
import type { ComponentDef } from './types';

const BY_ID = new Map<string, ComponentDef<any>>();
const DEFAULT_BY_KIND = new Map<BlockKind, string>();
let loaded = false;

function ensureLoaded(): void {
  if (loaded) return;
  loaded = true;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('./library');
}

export function registerComponent<B extends Block>(def: ComponentDef<B>, options: { default?: boolean } = {}): ComponentDef<B> {
  if (BY_ID.has(def.id)) throw new Error(`graphic-engine: composant « ${def.id} » déjà inscrit`);
  BY_ID.set(def.id, def as ComponentDef<any>);
  for (const kind of def.kinds) if (options.default || !DEFAULT_BY_KIND.has(kind)) DEFAULT_BY_KIND.set(kind, def.id);
  return def;
}

/** Le composant demandé s'il accepte ce bloc, sinon celui du type de bloc. */
export function componentFor(kind: BlockKind, id?: string): ComponentDef<any> | undefined {
  ensureLoaded();
  const wanted = id ? BY_ID.get(id) : undefined;
  if (wanted && wanted.kinds.includes(kind)) return wanted;
  const fallback = DEFAULT_BY_KIND.get(kind);
  return fallback ? BY_ID.get(fallback) : undefined;
}

export function componentsFor(kind: BlockKind): ComponentDef<any>[] {
  ensureLoaded();
  return [...BY_ID.values()].filter((c) => c.kinds.includes(kind));
}

export function allComponents(): ComponentDef<any>[] {
  ensureLoaded();
  return [...BY_ID.values()];
}

export function componentById(id: string): ComponentDef<any> | undefined {
  ensureLoaded();
  return BY_ID.get(id);
}

/**
 * LES VARIANTES — version principale, monochrome, inversée, symbole seul, nom seul, dynamique.
 *
 * Toutes se réécrivent depuis la MÊME scène (formes déjà construites), sans appel de modèle :
 * la géométrie est strictement identique d'une variante à l'autre, seules les couleurs, la mise
 * en page ou les retouches de couche changent. Un « logo dynamique » est un système de
 * variantes liées au concept de base : mêmes couches, paramètres ou couleurs retouchés.
 */
import type { LogoDocument, LogoVariant } from '../ir/logo.schema';
import { applyOverrides, LogoSession, RenderSpec, RenderedLogo } from './build';

export interface VariantOutput {
  id: string;
  kind: LogoVariant['kind'];
  label: string;
  background: 'light' | 'dark' | 'any';
  svg: string;
  width: number;
  height: number;
}

const MONO_DARK_INK = '#111111';
const MONO_LIGHT_INK = '#ffffff';

function specFor(variant: LogoVariant): RenderSpec | null {
  switch (variant.kind) {
    case 'primary':
      return {};
    case 'monochrome':
      return { mode: 'mono', monoColor: variant.color ?? (variant.background === 'dark' ? MONO_LIGHT_INK : MONO_DARK_INK) };
    case 'inverted':
      return { mode: 'inverted' };
    case 'symbol':
      return { layout: 'symbol-only', mode: variant.background === 'dark' ? 'inverted' : undefined };
    case 'wordmark':
      return { layout: 'wordmark-only' };
    case 'dynamic':
      return {};
  }
}

/** Écrit chaque variante déclarée par le document ; une variante impossible (pas de symbole…) est écartée. */
export function renderVariants(session: LogoSession, variants: LogoVariant[] = session.doc.variants): VariantOutput[] {
  const out: VariantOutput[] = [];
  for (const variant of variants) {
    const spec = specFor(variant);
    if (!spec) continue;
    let target = session;
    if (variant.kind === 'dynamic' && variant.overrides) target = session.withDocument(applyOverrides(session.doc, variant.overrides));
    const rendered: RenderedLogo | null = target.render({ ...spec, title: `${session.doc.brief.brandName} — ${variant.label ?? variant.kind}` });
    if (!rendered) continue;
    // « Symbole seul » d'un logo sans symbole : ce n'est pas une variante, c'est un doublon.
    if (variant.kind === 'symbol' && rendered.layout !== 'symbol-only') continue;
    if (variant.kind === 'wordmark' && rendered.layout !== 'wordmark-only') continue;
    out.push({
      id: variant.id,
      kind: variant.kind,
      label: variant.label ?? labelOf(variant.kind),
      background: variant.background ?? (variant.kind === 'inverted' ? 'dark' : 'light'),
      svg: rendered.svg,
      width: rendered.width,
      height: rendered.height,
    });
  }
  return out;
}

const labelOf = (kind: LogoVariant['kind']) =>
  ({ primary: 'Principale', monochrome: 'Monochrome', inverted: 'Inversée (fond sombre)', symbol: 'Symbole seul', wordmark: 'Nom seul', dynamic: 'Dynamique' })[kind];

/** Les variantes que tout logo reçoit, qu'il les déclare ou non. */
export function ensureStandardVariants(doc: LogoDocument): LogoVariant[] {
  const have = new Set(doc.variants.map((v) => v.kind));
  const extra: LogoVariant[] = [];
  if (!have.has('primary')) extra.push({ id: 'primary', kind: 'primary', background: 'light' });
  if (!have.has('monochrome')) extra.push({ id: 'monochrome', kind: 'monochrome', background: 'light' });
  if (!have.has('inverted')) extra.push({ id: 'inverted', kind: 'inverted', background: 'dark' });
  if (!have.has('symbol')) extra.push({ id: 'symbol', kind: 'symbol' });
  return [...doc.variants, ...extra];
}

/**
 * Les déclinaisons au format attendu par IDEM (`LogoVariations`) : « avec texte » et « icône
 * seule », chacune en fond clair, fond sombre et monochrome — produites par le code, sans IA.
 */
export interface IdemVariationSet {
  lightBackground: string;
  darkBackground: string;
  monochrome: string;
}

export function idemVariations(session: LogoSession): { withText: IdemVariationSet; iconOnly: IdemVariationSet; iconSvg: string | null } | null {
  const full = (layout?: RenderSpec['layout']) => {
    const light = session.render({ layout });
    const dark = session.render({ layout, mode: 'inverted' });
    const mono = session.render({ layout, mode: 'mono', monoColor: MONO_DARK_INK });
    return light && dark && mono ? { lightBackground: light.svg, darkBackground: dark.svg, monochrome: mono.svg } : null;
  };
  const withText = full();
  if (!withText) return null;
  const symbolOnly = session.render({ layout: 'symbol-only' });
  const hasSymbol = !!symbolOnly && symbolOnly.layout === 'symbol-only';
  const iconOnly = (hasSymbol ? full('symbol-only') : null) ?? withText;
  return { withText, iconOnly, iconSvg: hasSymbol ? symbolOnly!.svg : null };
}

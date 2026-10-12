/**
 * Les outils des composants : composer un texte d'un rôle, une puce de couleur, un libellé traduit,
 * un nombre aux usages de la langue. Un composant n'écrit jamais une taille, une couleur ou une police
 * en dur : il passe par ici, donc par les jetons.
 */
import type { NodeT, TextRoleToken, TextSizeToken } from '../../contracts/design-spec';
import { mixHex } from '../../foundation/color';
import { css } from '../../foundation/html';
import type { CompileContext, Env, InkSpec } from '../../html-css-compiler/context';
import { inkHex } from '../../html-css-compiler/context';
import { renderText } from '../../html-css-compiler/text';

type TextNode = Extract<NodeT, { t: 'text' }>;
type TextOpts = Partial<Omit<TextNode, 't' | 'role' | 'text'>>;

/** Un texte d'un rôle donné (le texte vient du contenu : jamais inventé ici). */
export function txt(ctx: CompileContext, env: Env, role: TextRoleToken, text: string | undefined, opts: TextOpts = {}): string {
  if (!text || !String(text).trim()) return '';
  return renderText({ t: 'text', role, text, ...opts } as Extract<NodeT, { t: 'text' }>, ctx, env);
}

export const px = (ctx: CompileContext, size: TextSizeToken): number => ctx.tokens.size[size];
export const gapPx = (ctx: CompileContext, token: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'): number => ctx.tokens.space[token];

export function ink(ctx: CompileContext, env: Env, spec: InkSpec, large = false): string {
  return inkHex(spec, ctx, env.surface, large);
}

/** Un filet discret sur ce fond. */
export function ruleColor(ctx: CompileContext, env: Env, strength: 'soft' | 'strong' = 'soft'): string {
  if (env.surface === ctx.look.ground) return strength === 'soft' ? ctx.look.rule : mixHex(ctx.look.ground, ctx.look.ink, 0.45);
  return mixHex(env.surface, inkHex('ink', ctx, env.surface), strength === 'soft' ? 0.18 : 0.45);
}

export const box = (decl: Parameters<typeof css>[0]): string => css({ 'box-sizing': 'border-box', ...decl });

/** Libellés écrits par le moteur lui-même (jamais par un modèle), en français ou en anglais. */
const LABELS = {
  fr: {
    assumption: 'Hypothèse',
    basis: 'Fondement',
    sources: 'Sources',
    strengths: 'Forces',
    weaknesses: 'Faiblesses',
    opportunities: 'Opportunités',
    threats: 'Menaces',
    likelihood: 'Probabilité',
    impact: 'Impact',
    low: 'Faible',
    medium: 'Moyen',
    high: 'Élevé',
    mitigation: 'Parade',
    needs: 'Besoins',
    traits: 'Profil',
    step: 'Étape',
    other: 'Autres',
    do: 'À faire',
    dont: 'À éviter',
    partners: 'Partenaires clés',
    activities: 'Activités clés',
    resources: 'Ressources clés',
    value: 'Proposition de valeur',
    relations: 'Relations clients',
    channels: 'Canaux',
    segments: 'Segments de clients',
    costs: 'Structure de coûts',
    revenues: 'Sources de revenus',
    page: 'Page',
  },
  en: {
    assumption: 'Assumption',
    basis: 'Basis',
    sources: 'Sources',
    strengths: 'Strengths',
    weaknesses: 'Weaknesses',
    opportunities: 'Opportunities',
    threats: 'Threats',
    likelihood: 'Likelihood',
    impact: 'Impact',
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    mitigation: 'Mitigation',
    needs: 'Needs',
    traits: 'Profile',
    step: 'Step',
    other: 'Other',
    do: 'Do',
    dont: 'Avoid',
    partners: 'Key partners',
    activities: 'Key activities',
    resources: 'Key resources',
    value: 'Value proposition',
    relations: 'Customer relationships',
    channels: 'Channels',
    segments: 'Customer segments',
    costs: 'Cost structure',
    revenues: 'Revenue streams',
    page: 'Page',
  },
} as const;

export type LabelKey = keyof (typeof LABELS)['fr'];

export function label(ctx: CompileContext, key: LabelKey): string {
  return (ctx.locale.toLowerCase().startsWith('fr') ? LABELS.fr : LABELS.en)[key];
}

/** Un nombre aux usages de la langue : séparateurs, décimales, unités compactes (k, M, Md). */
export function formatNumber(value: number, locale: string, options: { compact?: boolean; unit?: string; digits?: number } = {}): string {
  const fr = locale.toLowerCase().startsWith('fr');
  const abs = Math.abs(value);
  let scaled = value;
  let suffix = '';
  if (options.compact) {
    if (abs >= 1e9) {
      scaled = value / 1e9;
      suffix = fr ? ' Md' : 'B';
    } else if (abs >= 1e6) {
      scaled = value / 1e6;
      suffix = fr ? ' M' : 'M';
    } else if (abs >= 1e4) {
      scaled = value / 1e3;
      suffix = fr ? ' k' : 'k';
    }
  }
  const digits = options.digits ?? (Math.abs(scaled) >= 100 || Number.isInteger(scaled) ? 0 : Math.abs(scaled) >= 10 ? 1 : 2);
  const [int, dec] = Math.abs(scaled).toFixed(digits).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, fr ? ' ' : ',');
  const decimal = dec && Number(dec) !== 0 ? `${fr ? ',' : '.'}${dec.replace(/0+$/, '')}` : '';
  const sign = value < 0 ? '−' : '';
  const unit = options.unit ? (/^%$/.test(options.unit) ? (fr ? ' %' : '%') : `${fr ? ' ' : ' '}${options.unit}`) : '';
  return `${sign}${grouped}${decimal}${suffix}${unit}`;
}

/** Une valeur est-elle « numérique » (pour aligner une colonne de tableau à droite) ? */
export function looksNumeric(value: string): boolean {
  const v = value.replace(/[\s  ]/g, '');
  return /^[−\-+]?[\d.,]+(%|k|K|M|Md|Mds|B|bn)?([A-Z]{3}|FCFA|F|€|\$)?$/.test(v) || /^[−\-+]?\d[\d.,]*\s?(%|FCFA|XAF|XOF|€|\$|k|M|Md)$/.test(value.trim());
}

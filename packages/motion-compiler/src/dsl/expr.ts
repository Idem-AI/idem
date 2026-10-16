/**
 * LES EXPRESSIONS DU LANGAGE — une longueur ou un instant écrit comme un petit calcul.
 *
 *   longueurs (u)  W, H     largeur, hauteur de l'image
 *                  L, R, T, B   bords de la zone sûre (gauche, droite, haut, bas ; L et T sont négatifs)
 *                  SW, SH   largeur, hauteur de la zone sûre
 *   répétition     i (rang 0…), n (nombre de copies), v (valeur de `data`)
 *   instants (s)   D (durée de la scène), V (début de la voix off, 0 sans voix), VE (fin de la voix)
 *
 * Opérateurs : + - * / et parenthèses ; fonctions min(a, b), max(a, b), abs(a), sin(deg), cos(deg).
 * Pourcentages : `30%` = 30 % de la largeur de l'image (x, w), de sa hauteur (y, h), du petit côté ailleurs.
 * Format : `pick(vertical, horizontal)` ou `pick(vertical, carré, horizontal)` — un seul programme pour tous
 * les formats de la vidéo (story, portrait → vertical ; carré ; paysage → horizontal).
 * Rien d'autre n'est accepté : l'expression est traduite en TypeScript sûr (aucun nom libre).
 */

export type ExprKind = 'length' | 'time';

const LENGTH_VARS: Record<string, string> = { W: 'W', H: 'H', L: 'L', R: 'R', T: 'T', B: 'B', SW: 'SW', SH: 'SH' };
const TIME_VARS: Record<string, string> = { D: 'D', V: 'V', VE: 'VE' };
const FUNCS: Record<string, { arity: number | number[]; code: (args: string[]) => string }> = {
  pick: { arity: [2, 3], code: (a) => (a.length === 2 ? `(TALL ? ${a[0]} : ${a[1]})` : `(TALL ? ${a[0]} : SQUARE ? ${a[1]} : ${a[2]})`) },
  min: { arity: 2, code: (a) => `Math.min(${a[0]}, ${a[1]})` },
  max: { arity: 2, code: (a) => `Math.max(${a[0]}, ${a[1]})` },
  abs: { arity: 1, code: (a) => `Math.abs(${a[0]})` },
  sin: { arity: 1, code: (a) => `Math.sin((${a[0]}) * Math.PI / 180)` },
  cos: { arity: 1, code: (a) => `Math.cos((${a[0]}) * Math.PI / 180)` },
};

export class ExprError extends Error {}

/** Les constantes d'une copie de répétition (remplacées par leur valeur). */
export interface ExprScope {
  i?: number;
  n?: number;
  v?: number;
}

type Token = { t: 'num'; v: number } | { t: 'pct'; v: number } | { t: 'id'; v: string } | { t: 'op'; v: string };

/** L'axe d'une longueur : un pourcentage s'y rapporte (x → largeur, y → hauteur, sinon le petit côté). */
export type Axis = 'x' | 'y' | 'u';

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let k = 0;
  while (k < src.length) {
    const c = src[k];
    if (/\s/.test(c)) {
      k++;
      continue;
    }
    const num = /^(\d+\.?\d*|\.\d+)/.exec(src.slice(k));
    if (num) {
      k += num[1].length;
      if (src[k] === '%') {
        out.push({ t: 'pct', v: Number(num[1]) });
        k++;
      } else out.push({ t: 'num', v: Number(num[1]) });
      continue;
    }
    const id = /^[A-Za-z_]\w*/.exec(src.slice(k));
    if (id) {
      out.push({ t: 'id', v: id[0] });
      k += id[0].length;
      continue;
    }
    if ('+-*/(),'.includes(c)) {
      out.push({ t: 'op', v: c });
      k++;
      continue;
    }
    throw new ExprError(`caractère inattendu « ${c} »`);
  }
  return out;
}

/** Traduit une expression en code TypeScript (unités du langage : u pour les longueurs, s pour les instants). */
export function exprCode(value: unknown, kind: ExprKind, scope: ExprScope = {}, axis: Axis = 'u'): string {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new ExprError('nombre invalide');
    return String(round(value));
  }
  if (typeof value !== 'string') throw new ExprError(`attendu un nombre ou une expression, reçu ${JSON.stringify(value)}`);
  const tokens = tokenize(value);
  if (!tokens.length) throw new ExprError('expression vide');
  let p = 0;
  const vars = kind === 'length' ? LENGTH_VARS : TIME_VARS;
  const peek = () => tokens[p];
  const eat = (op: string) => {
    const tk = tokens[p];
    if (!tk || tk.t !== 'op' || tk.v !== op) throw new ExprError(`« ${op} » attendu`);
    p++;
  };
  const primary = (): string => {
    const tk = tokens[p++];
    if (!tk) throw new ExprError('expression incomplète');
    if (tk.t === 'num') return String(tk.v);
    if (tk.t === 'pct') {
      if (kind === 'time') throw new ExprError('pas de pourcentage pour un instant (D*0.5 = la moitié de la scène)');
      return axis === 'x' ? `(${tk.v} * W / 100)` : axis === 'y' ? `(${tk.v} * H / 100)` : String(tk.v);
    }
    if (tk.t === 'op' && tk.v === '(') {
      const inner = sum();
      eat(')');
      return `(${inner})`;
    }
    if (tk.t === 'op' && (tk.v === '-' || tk.v === '+')) return `${tk.v === '-' ? '-' : ''}${primary()}`;
    if (tk.t === 'id') {
      const fn = FUNCS[tk.v];
      if (fn) {
        eat('(');
        const args = [sum()];
        while (peek()?.t === 'op' && peek()!.v === ',') {
          p++;
          args.push(sum());
        }
        eat(')');
        const arity = Array.isArray(fn.arity) ? fn.arity : [fn.arity];
        if (!arity.includes(args.length)) throw new ExprError(`${tk.v}() prend ${arity.join(' ou ')} argument(s)`);
        return fn.code(args);
      }
      if (tk.v in scope && scope[tk.v as keyof ExprScope] !== undefined) return `(${round(scope[tk.v as keyof ExprScope]!)})`;
      if (vars[tk.v]) return vars[tk.v];
      if (['i', 'n', 'v'].includes(tk.v)) throw new ExprError(`« ${tk.v} » n'existe que dans l'item d'une répétition`);
      throw new ExprError(`variable inconnue « ${tk.v} » (${kind === 'length' ? 'W H L R T B SW SH, i n v dans une répétition' : 'D V VE'})`);
    }
    throw new ExprError(`« ${tk.v} » inattendu`);
  };
  const product = (): string => {
    let left = primary();
    while (peek()?.t === 'op' && (peek()!.v === '*' || peek()!.v === '/')) {
      const op = (tokens[p++] as { v: string }).v;
      left = `${left} ${op} ${primary()}`;
    }
    return left;
  };
  const sum = (): string => {
    let left = product();
    while (peek()?.t === 'op' && (peek()!.v === '+' || peek()!.v === '-')) {
      const op = (tokens[p++] as { v: string }).v;
      left = `${left} ${op} ${product()}`;
    }
    return left;
  };
  const code = sum();
  if (p < tokens.length) throw new ExprError(`« ${(tokens[p] as { v: unknown }).v} » en trop`);
  return code;
}

/** Une valeur relative (`"+=6"`, `"-=10"`) : son signe et son expression. */
export function relative(value: unknown): { sign: 1 | -1; expr: string } | null {
  if (typeof value !== 'string') return null;
  const m = /^\s*([+-])=\s*(.+)$/.exec(value);
  return m ? { sign: m[1] === '-' ? -1 : 1, expr: m[2] } : null;
}

/** Vérifie une expression sans la traduire (message lisible, ou null). */
export function exprError(value: unknown, kind: ExprKind, scope: ExprScope = {}, axis: Axis = 'u'): string | null {
  try {
    exprCode(value, kind, scope, axis);
    return null;
  } catch (error) {
    return (error as Error).message;
  }
}

/** La valeur numérique d'une expression constante (sans variable), sinon null. */
export function constValue(value: unknown, scope: ExprScope = {}): number | null {
  if (typeof value === 'number') return value;
  try {
    const code = exprCode(value, 'length', scope);
    if (/[A-Za-z]/.test(code.replace(/Math\.\w+/g, ''))) return null;
    if (/TALL|SQUARE/.test(code)) return null;
    // Le code ne contient que des nombres, des opérateurs et Math.* : il s'évalue sans risque.
    return Number(Function(`"use strict"; return (${code});`)());
  } catch {
    return null;
  }
}

export const round = (n: number) => Math.round(n * 1000) / 1000;

/**
 * LES MACROS DU LANGAGE — des raccourcis développés en nœuds simples AVANT la validation, pour que le compilateur
 * n'ait rien de nouveau à traduire :
 *
 *   device   un cadre d'appareil dessiné en code (téléphone, ordinateur portable, fenêtre de navigateur) autour d'un
 *            média de la scène — formes neutres, sans marque déposée ;
 *   icon     une icône du catalogue (Lucide, Tabler : résolue par le moteur) devient un tracé `path`, mis à l'échelle
 *            et centré (`scalePath`).
 */

type Num = number | string;

const mul = (v: Num | undefined, k: number, fallback: number): Num => {
  if (v === undefined) return Math.round(fallback * k * 100) / 100;
  if (typeof v === 'number') return Math.round(v * k * 100) / 100;
  return `(${v})*${k}`;
};

/** Un cadre d'appareil → un groupe (cadre, écran, détails), l'identifiant et la transformation du cadre conservés. */
/** L'écran d'un appareil porte l'identifiant `<appareil>_screen` : le verbe `focus` y zoome (effet « point »). */
export const screenIdOf = (id: string) => `${id}_screen`;
const screenId = (id: unknown) => (typeof id === 'string' && id ? { id: screenIdOf(id) } : {});

export function expandDevice(n: { id?: string; kind: 'phone' | 'laptop' | 'browser'; media: number; w?: Num; color?: string; [k: string]: unknown }): Record<string, unknown> {
  const { type: _t, kind, media, w, color, id, ...rest } = n as Record<string, unknown> & { kind: 'phone' | 'laptop' | 'browser'; media: number; w?: Num; color?: string; id?: string };
  const frame = color || 'black';
  const width = w ?? (kind === 'phone' ? 34 : 70);
  if (kind === 'phone') {
    const h = mul(width, 2.08, 34);
    return {
      ...(id ? { id } : {}),
      ...rest,
      type: 'group',
      children: [
        { type: 'rect', w: width, h, radius: mul(width, 0.16, 34), fill: frame, shadow: { color: 'black/28', blur: 5, y: 2 } },
        { ...screenId(id), type: 'image', media, w: mul(width, 0.9, 34), h: mul(width, 1.96, 34), radius: mul(width, 0.12, 34), fit: 'cover' },
        { type: 'rect', y: `-(${typeof h === 'number' ? h : `(${h})`})/2+${typeof width === 'number' ? Math.round(width * 0.06 * 100) / 100 : `(${width})*0.06`}`, w: mul(width, 0.28, 34), h: mul(width, 0.05, 34), radius: mul(width, 0.03, 34), fill: frame },
      ],
    };
  }
  if (kind === 'laptop') {
    const h = mul(width, 0.64, 70);
    return {
      ...(id ? { id } : {}),
      ...rest,
      type: 'group',
      children: [
        { type: 'rect', w: width, h, radius: mul(width, 0.025, 70), fill: frame, shadow: { color: 'black/25', blur: 5, y: 2 } },
        { ...screenId(id), type: 'image', media, w: mul(width, 0.94, 70), h: mul(width, 0.57, 70), radius: mul(width, 0.008, 70), fit: 'cover' },
        { type: 'rect', y: typeof h === 'number' ? Math.round((h / 2 + (typeof width === 'number' ? width * 0.018 : 1)) * 100) / 100 : `(${h})/2+(${width})*0.018`, w: mul(width, 1.12, 70), h: mul(width, 0.035, 70), radius: mul(width, 0.02, 70), fill: frame },
      ],
    };
  }
  // Fenêtre de navigateur : barre de titre et trois points, l'écran dessous.
  const bar = mul(width, 0.06, 70);
  const h = mul(width, 0.62, 70);
  const top = typeof h === 'number' ? -h / 2 : `-(${h})/2`;
  const dot = (k: number) => ({ type: 'circle', x: typeof width === 'number' ? Math.round((-width / 2 + width * (0.035 + k * 0.03)) * 100) / 100 : `-(${width})/2+(${width})*${0.035 + k * 0.03}`, y: typeof top === 'number' && typeof bar === 'number' ? Math.round((top + bar / 2) * 100) / 100 : `${top}+(${bar})/2`, size: mul(width, 0.016, 70), fill: 'line' });
  return {
    ...(id ? { id } : {}),
    ...rest,
    type: 'group',
    children: [
      { type: 'rect', w: width, h, radius: mul(width, 0.02, 70), fill: 'surface', stroke: 'line', lineWidth: 0.25, shadow: { color: 'black/18', blur: 6, y: 2 } },
      { ...screenId(id), type: 'image', media, y: typeof bar === 'number' ? Math.round((bar / 2) * 100) / 100 : `(${bar})/2`, w: mul(width, 0.985, 70), h: mul(width, 0.555, 70), fit: 'cover' },
      dot(0),
      dot(1),
      dot(2),
    ],
  };
}

const ARITY: Record<string, number> = { M: 2, L: 2, T: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, A: 7, Z: 0 };

/** Met un tracé SVG à l'échelle `k` puis le translate de (dx, dy) — absolus et relatifs, arcs compris. */
export function scalePath(d: string, k: number, dx = 0, dy = 0): string {
  const tokens = String(d).match(/[MmLlHhVvCcSsQqTtAaZz]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) || [];
  const r = (v: number) => String(Math.round(v * 1000) / 1000);
  const out: string[] = [];
  let i = 0;
  let cmd = '';
  while (i < tokens.length) {
    const t = tokens[i];
    if (/^[A-Za-z]$/.test(t)) {
      cmd = t;
      out.push(t);
      i++;
      if (cmd.toUpperCase() === 'Z') continue;
    }
    const C = cmd.toUpperCase();
    const n = ARITY[C] ?? 0;
    if (!n) {
      i++;
      continue;
    }
    const args = tokens.slice(i, i + n).map(Number);
    if (args.length < n || args.some((a) => !Number.isFinite(a))) break;
    i += n;
    const abs = cmd === C;
    const X = (v: number) => r(v * k + (abs ? dx : 0));
    const Y = (v: number) => r(v * k + (abs ? dy : 0));
    if (C === 'H') out.push(X(args[0]));
    else if (C === 'V') out.push(Y(args[0]));
    else if (C === 'A') out.push(r(args[0] * k), r(args[1] * k), r(args[2]), String(args[3] ? 1 : 0), String(args[4] ? 1 : 0), X(args[5]), Y(args[6]));
    else for (let j = 0; j < n; j += 2) out.push(X(args[j]), Y(args[j + 1]));
    // Un M implicitement suivi de paires : les suivantes sont des L (même casse).
    if (C === 'M') cmd = abs ? 'L' : 'l';
  }
  return out.join(' ').replace(/ ([A-Za-z]) /g, ' $1 ');
}

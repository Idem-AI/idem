/**
 * L'ASSEMBLEUR — un gabarit du catalogue iCode + le contenu rédigé → un composant TSX ordinaire, que le reste du moteur
 * traite comme s'il avait été écrit à la main (vérification, montage jsdom, `t()`, retouches ciblées d'iCode).
 *
 * Le mini-langage des gabarits (le même que `idem-templates/README.md`) :
 *   [[Component]] [[id]] [[h]] [[h2]] [[reveal]] [[revealItem]]       le nom, l'ancre, les niveaux de titre, les apparitions
 *   {{champ}} {{champ.sous}} {{.sous}} {{.}}                           les textes (échappés pour JSX par le code)
 *   [[each liste]]…[[/each]]  [[i]] [[i1]] [[n]] [[span]] [[mkey]]     les répétitions (`gallery` = les visuels prêts)
 *   [[ifi0]]…[[/ifi0]]  [[ifnoti0]]…[[/ifnoti0]]                       le premier élément, ou les autres
 *   [[if f]]…[[else]]…[[/if]]  [[ifnot f]]…[[/if]]  [[if .f]]          les conditions (`media`, `cta`, un champ, un sous-champ)
 *   [[media class="…"]]  [[href action]]                               le visuel de la section, la destination d'une action
 *
 * Aucun texte n'est écrit par le gabarit : un champ vide fait tomber son bloc conditionnel, jamais une balise vide.
 */

export interface ActionValue {
  label: string;
  target?: string;
}

export interface AssembleInput {
  component: string;
  id: string;
  /** La section ouvre la page : son titre est le h1 et elle s'affiche sans attendre d'apparition. */
  opening: boolean;
  /** Le contenu validé (champs du schéma de la composition). */
  content: Record<string, unknown>;
  /** Les clés des visuels prêts dans `media`, la principale en tête. */
  mediaKeys: string[];
  /** Une action → son adresse (`/contact/`, `#offres`, `https://wa.me/…`), ou null si elle ne mène nulle part. */
  resolveHref: (action: ActionValue) => string | null;
}

type Node =
  | { t: 'text'; v: string }
  | { t: 'leaf'; v: string }
  | { t: 'block'; kind: 'if' | 'ifnot' | 'each' | 'ifi0' | 'ifnoti0'; arg: string; body: Node[]; alt: Node[] };

const TAG = /\[\[([^\]]*(?:\[[^\]]*\][^\]]*)*)\]\]/g;

function parse(tpl: string): Node[] {
  const root: Node[] = [];
  const stack: Array<{ node: Extract<Node, { t: 'block' }>; inAlt: boolean }> = [];
  const push = (n: Node) => {
    const top = stack[stack.length - 1];
    (top ? (top.inAlt ? top.node.alt : top.node.body) : root).push(n);
  };
  let last = 0;
  for (const m of tpl.matchAll(TAG)) {
    if (m.index! > last) push({ t: 'text', v: tpl.slice(last, m.index) });
    last = m.index! + m[0].length;
    const tag = m[1].trim();
    const open = tag.match(/^(ifnot|if|each) (\.?[a-zA-Z]+)$/) ?? (tag === 'ifi0' || tag === 'ifnoti0' ? [tag, tag, ''] : null);
    if (open) {
      const node: Extract<Node, { t: 'block' }> = { t: 'block', kind: open[1] as 'if', arg: open[2], body: [], alt: [] };
      push(node);
      stack.push({ node, inAlt: false });
    } else if (tag === 'else') {
      const top = stack[stack.length - 1];
      if (!top || (top.node.kind !== 'if' && top.node.kind !== 'ifnot')) throw new Error('[[else]] hors d’une condition');
      top.inAlt = true;
    } else if (/^\/(if|each|ifi0|ifnoti0)$/.test(tag)) {
      const top = stack.pop();
      const want = tag.slice(1);
      if (!top || (want === 'if' ? top.node.kind !== 'if' && top.node.kind !== 'ifnot' : top.node.kind !== want)) throw new Error(`[[${tag}]] sans ouverture`);
    } else push({ t: 'leaf', v: tag });
  }
  if (last < tpl.length) push({ t: 'text', v: tpl.slice(last) });
  if (stack.length) throw new Error(`[[${stack[stack.length - 1].node.kind}]] jamais fermé`);
  return root;
}

/** Un texte affiché en JSX : les caractères qui feraient du code deviennent des entités (le texte reste lisible par `t()`). */
export function jsxText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\{/g, '&#123;')
    .replace(/\}/g, '&#125;')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Une valeur affichable ? (une chaîne non vide, une liste non vide, une action qui mène quelque part) */
function present(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.values(value as Record<string, unknown>).some(present);
  return true;
}

interface Scope {
  item?: unknown;
  index?: number;
  count?: number;
}

const two = (n: number) => String(n).padStart(2, '0');

/**
 * `[[span]]` : la largeur d'une tuile dans une mosaïque de 6 colonnes, selon le nombre de tuiles — chaque rangée est
 * pleine (jamais de trou en fin de grille) et la première tuile est la plus large. Classes écrites en entier : Tailwind
 * les trouve dans le fichier.
 */
const SPANS: Record<number, number[]> = { 1: [6], 2: [4, 2], 3: [4, 2, 6], 4: [4, 2, 2, 4], 5: [3, 3, 2, 2, 2], 6: [4, 2, 2, 4, 3, 3] };
const SPAN_CLASS: Record<number, string> = { 2: 'md:col-span-2', 3: 'md:col-span-3', 4: 'md:col-span-4', 6: 'md:col-span-6' };
function spanOf(index: number, count: number): string {
  const row = SPANS[Math.min(Math.max(count, 1), 6)];
  return SPAN_CLASS[row[index] ?? 2];
}

export function assembleSection(tpl: string, input: AssembleInput): string {
  const tree = parse(tpl);
  const { content, mediaKeys, opening } = input;
  const hrefs = new Map<string, string | null>();
  const hrefOf = (field: string): string | null => {
    if (!hrefs.has(field)) {
      const action = content[field] as ActionValue | undefined;
      hrefs.set(field, action && typeof action === 'object' && action.label?.trim() ? input.resolveHref(action) : null);
    }
    return hrefs.get(field)!;
  };
  const truthy = (arg: string, scope: Scope): boolean => {
    if (arg === 'media') return mediaKeys.length > 0;
    if (arg.startsWith('.')) return present((scope.item as Record<string, unknown> | undefined)?.[arg.slice(1)]);
    const value = content[arg];
    if (value && typeof value === 'object' && !Array.isArray(value) && 'label' in (value as object)) return hrefOf(arg) !== null;
    return present(value);
  };
  const textOf = (expr: string, scope: Scope): string => {
    let value: unknown;
    if (expr === '.') value = scope.item;
    else if (expr.startsWith('.')) value = (scope.item as Record<string, unknown> | undefined)?.[expr.slice(1)];
    else {
      const [field, sub] = expr.split('.');
      value = content[field];
      if (sub) value = (value as Record<string, unknown> | undefined)?.[sub];
    }
    return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
  };
  const reveal = opening
    ? ' initial={false}'
    : ' initial={{ opacity: 0, y: m.distance }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-10% 0px" }} transition={{ duration: m.duration, ease: m.ease }}';
  const revealItem = (i: number) =>
    opening
      ? ' initial={false}'
      : ` initial={{ opacity: 0, y: m.distance }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-10% 0px" }} transition={{ duration: m.duration, ease: m.ease, delay: ${i} * m.stagger }}`;

  const leaf = (tag: string, scope: Scope): string => {
    if (tag === 'Component') return input.component;
    if (tag === 'id') return input.id;
    if (tag === 'h') return opening ? '1' : '2';
    if (tag === 'h2') return opening ? '2' : '3';
    if (tag === 'reveal') return reveal;
    if (tag === 'revealItem') return revealItem(scope.index ?? 0);
    if (tag === 'i') return String(scope.index ?? 0);
    if (tag === 'i1') return String((scope.index ?? 0) + 1);
    if (tag === 'n') return two((scope.index ?? 0) + 1);
    if (tag === 'span') return spanOf(scope.index ?? 0, scope.count ?? 1);
    if (tag === 'mkey') return String(scope.item ?? '');
    const href = tag.match(/^href ([a-zA-Z]+)$/);
    if (href) return JSON.stringify(hrefOf(href[1]) ?? '#');
    const media = tag.match(/^media(?: class="([^"]*)")?$/);
    if (media) {
      if (!mediaKeys.length) return '';
      return `<Media asset={media[${JSON.stringify(mediaKeys[0])}]}${media[1] ? ` className="${media[1]}"` : ''}${opening ? ' priority' : ''} />`;
    }
    throw new Error(`jeton inconnu [[${tag}]]`);
  };

  const text = (raw: string, scope: Scope): string =>
    raw
      // Un attribut : une chaîne JS (`placeholder={"…"}`), jamais du texte JSX.
      .replace(/="\{\{\s*([.a-zA-Z]+)\s*\}\}"/g, (_m, expr: string) => `={${JSON.stringify(textOf(expr, scope).trim())}}`)
      .replace(/\{\{\s*([.a-zA-Z]+)\s*\}\}/g, (_m, expr: string) => jsxText(textOf(expr, scope)));

  const render = (nodes: Node[], scope: Scope): string =>
    nodes
      .map((n) => {
        if (n.t === 'text') return text(n.v, scope);
        if (n.t === 'leaf') return leaf(n.v, scope);
        if (n.kind === 'ifi0') return scope.index === 0 ? render(n.body, scope) : '';
        if (n.kind === 'ifnoti0') return scope.index !== 0 ? render(n.body, scope) : '';
        if (n.kind === 'if' || n.kind === 'ifnot') {
          const yes = truthy(n.arg, scope) === (n.kind === 'if');
          return render(yes ? n.body : n.alt, scope);
        }
        const list = n.arg === 'gallery' ? mediaKeys : ((content[n.arg] as unknown[] | undefined) ?? []).filter(present);
        return list.map((item, index) => render(n.body, { item, index, count: list.length })).join('\n');
      })
      .join('');

  return tidy(render(tree, {}));
}

/** Les restes d'assemblage : lignes vides en série, classes doublement espacées. */
function tidy(code: string): string {
  return code
    .replace(/className="([^"]*)"/g, (_m, cls: string) => `className="${cls.replace(/\s+/g, ' ').trim()}"`)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .concat('\n');
}

/** Les en-têtes et pieds de page ne lisent que `site` : rien à remplir. */
export function assembleShell(tpl: string): string {
  if (/\[\[|\{\{/.test(tpl)) throw new Error('un en-tête ou un pied de page ne porte aucun jeton');
  return tpl.trim().concat('\n');
}

/**
 * LA RETOUCHE RELUE AVANT D'ÊTRE MONTRÉE — « est-ce bien ce que la personne a demandé, et rien d'autre ? »
 *
 * Les garde-fous du code (police, couleurs, montage, faits inventés) vérifient la FORME d'une retouche ; aucun ne dit
 * si elle répond à la demande. Or c'est l'échec que voient les utilisateurs : un élément sans rapport ajouté, le bon
 * changement fait au mauvais endroit, une demande à moitié faite. Les travaux sur l'édition de code par modèle le
 * mesurent (« over-editing », « ExcessCode » de CanItEdit, taux d'oubli de FronTalk, ramené près de zéro par une
 * relecture critique du code) ; la parade est la même partout : localiser, modifier peu, puis RELIRE le changement.
 *
 * Ici, un agent reçoit la demande et SEULEMENT les lignes changées (un diff compact, quelques centaines de jetons —
 * jamais les fichiers entiers), et répond : fait / pas fait, ce qui manque, ce qui n'a rien à voir. Une retouche
 * jugée incomplète ou débordante repart une seule fois vers son fichier, avec ce retour. Sans réponse du juge (panne,
 * compte bloqué), la retouche passe : la relecture améliore, elle ne bloque jamais.
 */
import { ModelCaller } from './modelCaller.js';

/** Les lignes changées entre deux versions d'un fichier, avec `context` lignes autour, au format diff unifié. */
export function lineDiff(before: string, after: string, context = 2, maxLines = 120): { text: string; added: number; removed: number } {
  const a = before.split('\n');
  const b = after.split('\n');
  // Préfixe et suffixe communs retirés d'abord : une retouche ne touche qu'un passage, le reste est identique.
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;
  const midA = a.slice(head, a.length - tail);
  const midB = b.slice(head, b.length - tail);
  // Plus longue sous-suite commune sur le milieu (petit : quelques dizaines de lignes au plus d'ordinaire).
  const ops: Array<{ kind: ' ' | '-' | '+'; line: string }> = [];
  if (midA.length * midB.length <= 4_000_000) {
    const n = midA.length;
    const m = midB.length;
    const lcs: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) lcs[i][j] = midA[i] === midB[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    let i = 0;
    let j = 0;
    while (i < n || j < m) {
      if (i < n && j < m && midA[i] === midB[j]) {
        ops.push({ kind: ' ', line: midA[i] });
        i++;
        j++;
      } else if (j < m && (i === n || lcs[i][j + 1] >= lcs[i + 1][j])) ops.push({ kind: '+', line: midB[j++] });
      else ops.push({ kind: '-', line: midA[i++] });
    }
  } else {
    for (const line of midA) ops.push({ kind: '-', line });
    for (const line of midB) ops.push({ kind: '+', line });
  }
  const all = [...a.slice(Math.max(0, head - context), head).map((line) => ({ kind: ' ' as const, line })), ...ops, ...a.slice(a.length - tail, a.length - tail + context).map((line) => ({ kind: ' ' as const, line }))];
  // Les longues plages inchangées au milieu sont réduites à leurs bords.
  const out: string[] = [];
  let run: string[] = [];
  const flush = (last: boolean) => {
    if (run.length > context * 2 + 1 && !last) out.push(...run.slice(0, context), '  …', ...run.slice(-context));
    else out.push(...run);
    run = [];
  };
  for (const op of all) {
    if (op.kind === ' ') run.push(`  ${op.line}`);
    else {
      flush(false);
      out.push(`${op.kind} ${op.line}`);
    }
  }
  flush(true);
  const added = ops.filter((op) => op.kind === '+').length;
  const removed = ops.filter((op) => op.kind === '-').length;
  const text = out.length > maxLines ? [...out.slice(0, maxLines), `  … (${out.length - maxLines} lignes de plus)`].join('\n') : out.join('\n');
  return { text: text.replace(/\s+$/gm, ''), added, removed };
}

export interface EditReview {
  /** La demande est faite, visiblement. */
  done: boolean;
  /** Ce qui manque encore, en une phrase (vide si rien). */
  missing: string;
  /** Les changements sans rapport avec la demande, fichier par fichier. */
  unrelated: Array<{ path: string; what: string }>;
}

/**
 * Le juge de la retouche : la demande, ce que l'aiguillage attendait de voir, et les diffs. Une réponse JSON courte
 * (≤ 200 jetons). `null` : pas de réponse exploitable — la retouche passe telle quelle.
 */
export async function reviewEdit(
  caller: ModelCaller,
  request: string,
  recent: string,
  expected: string[],
  diffs: Array<{ path: string; label: string; diff: string }>
): Promise<EditReview | null> {
  if (!diffs.length) return null;
  const paths = new Set(diffs.map((d) => d.path));
  const outcome = await caller.json<EditReview>(
    'edit:verify',
    [
      'You review a change made to a live website, BEFORE the person sees it. You get the request and ONLY the lines that changed (unified diff: "-" removed, "+" added).',
      'Judge two things, strictly but fairly:',
      '1. done: does the change do what the person asked, fully and visibly? A text asked for must be there word for word; a colour, size or position asked for must be visible in the classes or styles.',
      '2. unrelated: is anything changed that the request does not call for (another text rewritten, an element added or removed elsewhere, a layout changed when only a colour was asked)? Changes needed to carry out the request are related.',
      'Do not judge taste or code style. Answer with JSON only.',
    ].join('\n'),
    [
      `# The request\n${request.slice(0, 1200)}`,
      recent ? `\n# Recent conversation (context for "it", "again", "that")\n${recent.slice(0, 800)}` : '',
      expected.length ? `\n# What should be visible once done (from the planner)\n${expected.map((e) => `- ${e}`).join('\n')}` : '',
      ...diffs.map((d) => `\n# ${d.label} (${d.path})\n\`\`\`diff\n${d.diff}\n\`\`\``),
      `\n# Answer\n{"done": true|false, "missing": "<what is still missing, one sentence, empty if done>", "unrelated": [{"path": "<file>", "what": "<the unrelated change to undo>"}]}`,
    ].join('\n'),
    (raw) => {
      const o = (raw ?? {}) as { done?: unknown; missing?: unknown; unrelated?: unknown };
      if (typeof o.done !== 'boolean') return { problem: 'Answer {"done": true|false, "missing": "…", "unrelated": […]}.' };
      const unrelated = (Array.isArray(o.unrelated) ? o.unrelated : [])
        .map((u) => ({ path: String((u as { path?: unknown })?.path ?? ''), what: String((u as { what?: unknown })?.what ?? '').trim() }))
        .filter((u) => u.what && paths.has(u.path))
        .slice(0, 4);
      return { value: { done: o.done, missing: typeof o.missing === 'string' ? o.missing.trim().slice(0, 300) : '', unrelated } };
    },
    220
  );
  return outcome.value ?? null;
}

/** Les mots de la personne, repliés (casse, accents, ponctuation, espaces) : pour vérifier qu'une citation y est. */
export function foldWords(text: string): string {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’'`´"«»“”]/g, ' ')
    .replace(/[^\p{L}\p{N}#]+/gu, ' ')
    .trim();
}

/**
 * La citation est-elle VRAIMENT dans la demande (ou les derniers échanges) ? Un fait exact, vérifié mot pour mot :
 * l'aiguillage doit dire quels mots de la personne chaque partie touchée sert. Une partie que rien dans ses mots
 * n'appelle est celle qui produit « des éléments sans rapport ».
 */
export function grounded(quote: string | undefined, said: string): boolean {
  const q = foldWords(quote ?? '');
  if (q.length < 2) return false;
  return foldWords(said).includes(q);
}

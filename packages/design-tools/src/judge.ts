/**
 * LE JUGE VISUEL — cinq questions FERMÉES sur la capture, posées à un modèle de vision (OpenRouter, rôle de l'hôte).
 *
 * Pas de note esthétique ni de critique libre : des oui/non vérifiables (texte coupé, deux foyers, zone vide, contraste,
 * logo), dont chaque « oui » est un défaut. Le score sert seulement à DÉPARTAGER des variantes et à dire au modèle ce
 * qui ne va pas ; il ne réécrit jamais une page. Un modèle de vision absent ou en panne : la réponse est neutre.
 */

export type VisionPort = (base64: string, mimeType: string, instruction: string) => Promise<string>;

export interface JudgeQuestion {
  id: 'cut' | 'focal' | 'empty' | 'contrast' | 'logo';
  /** La question (anglais), formulée pour qu'un « yes » soit un défaut. */
  text: string;
  /** Le défaut dit à l'auteur, quand la réponse est « yes ». */
  fault: string;
}

export const JUDGE_QUESTIONS: JudgeQuestion[] = [
  { id: 'cut', text: 'Is any text cut off by an edge, or overlapping another element?', fault: 'a text is cut off or overlaps another element' },
  { id: 'focal', text: 'Do two or more elements compete equally to be the main focal point?', fault: 'two elements compete for attention: make one clearly dominant' },
  { id: 'empty', text: 'Is there a large area that looks empty, unfinished or like a placeholder?', fault: 'an area looks empty or unfinished' },
  { id: 'contrast', text: 'Is any text hard to read because of low contrast with its background?', fault: 'a text has too little contrast with its background' },
  { id: 'logo', text: 'Is the brand logo missing, tiny, distorted or unreadable?', fault: 'the logo is missing, too small or unreadable' },
];

export interface JudgeVerdict {
  /** 0 → tous les défauts, 1 → aucun. */
  score: number;
  answers: Partial<Record<JudgeQuestion['id'], boolean>>;
  faults: string[];
  /** Le juge n'a pas répondu (modèle absent, panne, réponse illisible). */
  unavailable?: boolean;
}

export function judgeInstruction(questions: JudgeQuestion[] = JUDGE_QUESTIONS): string {
  return [
    'You check a rendered design (a page, a slide, a visual). Answer each question with yes or no only — no explanation.',
    'Answer with exactly one line per question: "<number>: yes" or "<number>: no".',
    ...questions.map((q, i) => `${i + 1}. ${q.text}`),
  ].join('\n');
}

export function parseVerdict(raw: string, questions: JudgeQuestion[] = JUDGE_QUESTIONS): JudgeVerdict {
  const answers: JudgeVerdict['answers'] = {};
  for (const m of (raw || '').matchAll(/^\s*\**\s*(\d)\s*[:.)-]\s*\**\s*(yes|no|oui|non)\b/gim)) {
    const q = questions[Number(m[1]) - 1];
    if (q) answers[q.id] = /^(yes|oui)$/i.test(m[2]);
  }
  const known = questions.filter((q) => answers[q.id] !== undefined);
  if (known.length < Math.ceil(questions.length / 2)) return { score: 0.5, answers, faults: [], unavailable: true };
  const faults = known.filter((q) => answers[q.id]).map((q) => q.fault);
  return { score: Math.round((1 - faults.length / known.length) * 1000) / 1000, answers, faults };
}

/** Pose les questions sur une capture PNG. Jamais d'exception : une panne rend un verdict neutre. */
export async function judgeImage(vision: VisionPort | undefined, png: Buffer, questions: JudgeQuestion[] = JUDGE_QUESTIONS): Promise<JudgeVerdict> {
  if (!vision) return { score: 0.5, answers: {}, faults: [], unavailable: true };
  try {
    const raw = await vision(png.toString('base64'), 'image/png', judgeInstruction(questions));
    return parseVerdict(raw, questions);
  } catch {
    return { score: 0.5, answers: {}, faults: [], unavailable: true };
  }
}

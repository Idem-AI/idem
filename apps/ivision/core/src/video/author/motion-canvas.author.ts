/**
 * L'AUTEUR MOTION CANVAS — écrit le code d'UNE scène, à partir de sa fiche.
 *
 *   1. le contexte est compilé (référence d'API, exemples, fiche, bible) ;
 *   2. un appel de modèle (rôle `video.author`) ;
 *   3. le code est extrait de la réponse et compilé — vérification TECHNIQUE seulement.
 *
 * Le code rendu par le modèle est gardé TEL QUEL : jamais réécrit, jamais « réparé », jamais
 * remplacé par une composition de secours. S'il ne compile pas, la scène porte son erreur et
 * l'utilisateur peut demander une correction (`fix`), qui est un nouvel appel volontaire.
 * Seule une réponse SANS code (panne, délai, réponse vide) est redemandée une fois.
 */
import { callFilmModel, FilmCallContext } from '../agents';
import { compileScene } from '../rendering/compiler';
import { AuthorContext, buildAuthorPrompt, extractCode } from './context-builder';

export interface AuthoredScene {
  key: string;
  code?: string;
  error?: { stage: 'author' | 'compile'; message: string };
  tokens: { input: number; output: number };
  ms: number;
  attempts: number;
}

export async function authorScene(ctx: FilmCallContext, context: AuthorContext): Promise<AuthoredScene> {
  const { system, user } = buildAuthorPrompt(context);
  const tokens = { input: 0, output: 0 };
  let ms = 0;
  let attempts = 0;
  let code: string | null = null;
  let failure = '';
  for (; attempts < 2 && !code; ) {
    attempts++;
    const run = await callFilmModel(ctx, 'video.author', system, user, (raw) => extractCode(raw) !== null);
    tokens.input += run.tokens.input;
    tokens.output += run.tokens.output;
    ms += run.ms;
    code = extractCode(run.raw);
    if (!code) failure = run.failure || 'the answer contains no code block with `export default`';
    if (run.failure === 'no_model') break;
  }
  if (!code) return { key: context.scene.key, error: { stage: 'author', message: failure }, tokens, ms, attempts };
  const compiled = await compileScene(code);
  return { key: context.scene.key, code, ...(compiled.ok ? {} : { error: { stage: 'compile' as const, message: compiled.error || 'compilation failed' } }), tokens, ms, attempts };
}

/** Plusieurs scènes, `concurrency` à la fois (l'ordre des résultats suit celui des fiches). */
export async function authorScenes(ctx: FilmCallContext, contexts: AuthorContext[], concurrency = 4, onDone?: (scene: AuthoredScene, done: number) => void): Promise<AuthoredScene[]> {
  const out = new Array<AuthoredScene>(contexts.length);
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < contexts.length) {
      const i = next++;
      out[i] = await authorScene(ctx, contexts[i]);
      onDone?.(out[i], ++done);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, contexts.length) }, worker));
  return out;
}

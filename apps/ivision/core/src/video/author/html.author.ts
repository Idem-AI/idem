/**
 * L'AUTEUR DES SCÈNES HTML (rendu HyperFrames) — une scène = un fragment HTML Tailwind + son animation.
 *
 * Même contexte que l'auteur Motion Canvas (`AuthorContext` : le film, la marque, la scène, ses voisines, sa voix), un
 * autre langage : celui que les petits modèles écrivent le mieux. Aucun gabarit : la composition est libre. Le code
 * pose les textes exacts et les médias (clés), contrôle le fragment et le script (`rendering/hyperframes/lint.ts`), et
 * renvoie les défauts à l'auteur — deux corrections au plus (corriger, puis réécrire plus simplement).
 */
import { callFilmModel, FilmCallContext } from '../agents';
import type { AuthorContext } from './program.author';
import { COMPOSITION } from '../rendering/formats';
import { lintScene } from '../rendering/hyperframes/lint';
import type { AnimationLib } from '../rendering/hyperframes/composition';

export interface HtmlAuthored {
  key: string;
  html?: string;
  script?: string;
  animation: AnimationLib;
  error?: string;
  tokens: { input: number; output: number };
  ms: number;
  attempts: number;
}

const GSAP_RULES = [
  'ANIMATION — GSAP 3 (all plugins are free). Your js block is the BODY of `function (tl, root, D, gsap)`:',
  '- `tl` is this scene’s timeline (time 0 = the scene starts); `root` is the scene element; `D` is the scene duration in seconds.',
  '- Put EVERY motion on `tl` with explicit positions: tl.fromTo(root.querySelector(".x"), { … }, { …, duration: 0.6 }, 0.2). Prefer fromTo; animate transforms and opacity (x, y, scale, rotation, opacity, clipPath).',
  '- Keep the motion alive until D (a slow drift, a hold); the last 0.3 s may hand over to the next scene.',
].join('\n');

const ANIME_RULES = [
  'ANIMATION — Anime.js 4. Your js block is the BODY of `function (anime, root, D)` and must RETURN a timeline:',
  '- `const t = anime.createTimeline({ autoplay: false, defaults: { ease: "outExpo" } });` then t.add(root.querySelector(".x"), { opacity: [0, 1], translateY: [40, 0], duration: 600 }, 200); … `return t;`',
  '- Times are in MILLISECONDS; D is the scene duration in seconds (D * 1000 ms). Animate transforms and opacity.',
].join('\n');

export function htmlAuthorSystem(animation: AnimationLib): string {
  return [
    'You are a senior motion designer. You build ONE scene of a short brand film as an HTML fragment styled with Tailwind CSS, animated by a short script. The film is rendered frame by frame by HyperFrames (headless Chrome).',
    'Design like a studio: one focal element, strong hierarchy, generous space, the brand colours and fonts, motion with intent (no random bouncing, no gratuitous effects). Light grounds unless the film bible says otherwise.',
    'HTML RULES:',
    '- One root <div class="relative h-full w-full overflow-hidden …"> that fills the scene canvas. Position with Tailwind (absolute, flex, grid, arbitrary values like left-[12%] or text-[96px]).',
    '- Brand classes: bg-brand-primary, bg-brand-secondary, bg-brand-accent, bg-ground, text-ink, text-muted, text-on-brand, font-display, font-body (plus every Tailwind utility).',
    '- Every visible word comes from a key: {{text.<key>}} for each text of the scene (all of them, exactly once each). Never write a word yourself.',
    '- Images and clips: <img src="{{media.<id>}}" class="… object-cover"> or <video src="{{media.<id>}}" muted playsinline class="…"></video>; the logo: <img src="{{logo}}" class="…">. No other address.',
    '- Give the elements you animate a class (e.g. class="title …") so the script can select them inside root.',
    '- No <script>, no <style>, no inline event handler, no external resource.',
    animation === 'anime' ? ANIME_RULES : GSAP_RULES,
    'FORBIDDEN in the script: network, timers (setTimeout, setInterval, requestAnimationFrame), Math.random, Date, playing or pausing media, writing HTML.',
    'Answer with exactly two blocks: ```html …``` then ```js …```.',
  ].join('\n');
}

export function htmlAuthorUser(c: AuthorContext, animation: AnimationLib): string {
  const s = c.scene;
  const size = COMPOSITION[c.formats[0]] ?? COMPOSITION.story;
  return [
    `FILM: ${c.film.title} — ${c.film.concept}`,
    c.film.bible ? `FILM BIBLE (apply it):\n${c.film.bible}` : '',
    `BRAND: ${c.brand.name} · colours primary ${c.brand.colors.primary}, secondary ${c.brand.colors.secondary}, accent ${c.brand.colors.accent}, background ${c.brand.colors.background}, text ${c.brand.colors.text} · fonts display "${c.brand.fonts.display}", body "${c.brand.fonts.body}"${c.brand.logo ? ' · a logo is available ({{logo}})' : ''}`,
    c.art ? `ART DIRECTION OF THE BRAND:\n${c.art.slice(0, 1200)}` : '',
    `CANVAS: ${size.width} × ${size.height} px${c.formats.length > 1 ? ` (the same scene is also rendered in: ${c.formats.slice(1).join(', ')} — keep it responsive with % and flex)` : ''}`,
    `SCENE ${s.index + 1} OF ${s.count} (${s.key}) — ${s.duration.toFixed(2)} s`,
    `PURPOSE: ${s.purpose}`,
    `WHAT WE SEE: ${s.visual}`,
    `HOW IT MOVES: ${s.motion}`,
    s.transition ? `HOW IT ENTERS: ${s.transition}` : '',
    c.previous ? `PREVIOUS SCENE: ${c.previous.visual}` : '',
    c.next ? `NEXT SCENE: ${c.next.visual}` : '',
    `TEXTS (keys → exact texts):\n${Object.entries(s.texts).map(([k, v]) => `{{text.${k}}} = ${JSON.stringify(v)}`).join('\n') || '(none)'}`,
    `MEDIA:\n${s.media.map((m) => `{{media.${m.id}}} — ${m.kind}${m.width ? ` ${m.width}×${m.height}` : ''}${m.note ? ` — ${m.note.slice(0, 160)}` : ''}`).join('\n') || '(none: build the scene with type, shapes and colour)'}`,
    s.voice ? `VOICE-OVER during the scene (from ${s.voice.at.toFixed(1)} s, ${s.voice.duration.toFixed(1)} s): "${s.voice.text.slice(0, 300)}" — time the key reveals with it.` : '',
    s.beat ? `MUSIC: ${s.beat.bpm} BPM, first beat at ${s.beat.first.toFixed(2)} s — land the main hits on beats.` : '',
    c.revise ? `THE CLIENT ASKS FOR THIS CHANGE: ${c.revise.instruction.slice(0, 800)}` : '',
    c.repair ? `THIS SCENE FAILED WHEN PLAYED: ${c.repair.error.slice(0, 400)}${c.repair.history.length ? `\nEARLIER FAILURES: ${c.repair.history.slice(-2).join(' | ').slice(0, 300)}` : ''}` : '',
    `Animation library: ${animation === 'anime' ? 'Anime.js' : 'GSAP'}.`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function parseHtmlScene(raw: string): { html: string; script: string } | null {
  const html = raw.match(/```html\s*\n([\s\S]*?)```/i)?.[1]?.trim();
  const script = raw.match(/```(?:js|javascript)\s*\n([\s\S]*?)```/i)?.[1]?.trim();
  return html && script ? { html, script } : null;
}

/** Écrit une scène, la contrôle, et la corrige deux fois au plus. Jamais d'exception. */
export async function authorHtmlScene(call: FilmCallContext, c: AuthorContext, animation: AnimationLib, previous?: { html: string; script: string }): Promise<HtmlAuthored> {
  const system = htmlAuthorSystem(animation);
  const base = htmlAuthorUser(c, animation);
  const textKeys = Object.keys(c.scene.texts);
  const mediaIds = c.scene.media.map((m) => m.id);
  const out: HtmlAuthored = { key: c.scene.key, animation, tokens: { input: 0, output: 0 }, ms: 0, attempts: 0 };
  let user = previous && (c.revise || c.repair) ? `${base}\n\nCURRENT SCENE:\n\`\`\`html\n${previous.html.slice(0, 10000)}\n\`\`\`\n\`\`\`js\n${previous.script.slice(0, 6000)}\n\`\`\`\n${c.revise ? 'Rewrite the scene applying the change; keep the rest.' : 'Fix the cause of the failure and return both blocks.'}` : base;
  let lastErrors: string[] = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    const run = await callFilmModel(call, 'video.html-author', system, user, (raw) => parseHtmlScene(raw) !== null);
    out.attempts++;
    out.tokens.input += run.tokens.input;
    out.tokens.output += run.tokens.output;
    out.ms += run.ms;
    const parsed = run.raw ? parseHtmlScene(run.raw) : null;
    if (!parsed) {
      lastErrors = [run.failure ? `no answer (${run.failure})` : 'the answer did not contain an ```html block and a ```js block'];
      if (run.failure === 'no_model') break;
    } else {
      lastErrors = lintScene({ html: parsed.html, script: parsed.script, animation, textKeys, mediaIds });
      if (!lastErrors.length) return { ...out, html: parsed.html, script: parsed.script };
      // La correction : d'abord corriger ce qui est dit, puis réécrire plus simplement.
      user =
        attempt === 0
          ? `${base}\n\nYOUR SCENE:\n\`\`\`html\n${parsed.html.slice(0, 10000)}\n\`\`\`\n\`\`\`js\n${parsed.script.slice(0, 6000)}\n\`\`\`\nTHE CODE REFUSED IT:\n${lastErrors.map((e) => `- ${e}`).join('\n')}\nFix exactly these points and return both blocks.`
          : `${base}\n\nEarlier versions were refused (${lastErrors.slice(0, 3).join('; ')}). Write the scene again, simpler: fewer elements, a few clear tweens.`;
    }
  }
  return { ...out, error: lastErrors.join(' · ').slice(0, 400) || 'author_failed' };
}

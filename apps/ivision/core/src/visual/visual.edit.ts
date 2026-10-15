/**
 * LA RETOUCHE D'UN VISUEL — « change le prix en 4 500 F », « agrandis le titre », « enlève le sous-titre »,
 * « mets le logo en bas », « ajoute notre numéro ».
 *
 * Le visuel retouché est LE MÊME visuel. Le modèle de rédaction lit ses mots et la consigne, et rend : les mots
 * après la retouche, ce qu'il faut faire de la photo, et — si la consigne touche à la FORME — cette consigne de
 * mise en forme, en clair. Puis :
 *  · seuls les mots ou la photo changent : la page gardée (le code Tailwind de l'auteur) est REJOUÉE avec eux,
 *    sans modèle ;
 *  · la forme change : l'auteur du moteur graphique reçoit son code et la consigne, et réécrit la page ;
 *  · une autre mise en page est demandée (ou la page gardée date de l'ancien moteur) : la page est réécrite.
 *
 * Le même code pour IDEM (module Communication) et iVision (conversation).
 */
import { isAuthoredSpec, sectionHtml, SectionOutput, SectionSpec } from '@idem/graphic-engine';
import logger from '../runtime/logger';
import type { CreativityLevel } from '../creativity/levels';
import { findPhoto, renderVisual, VisualPhotoRef } from './visual.composer';
import { parseVisualEdit, WrittenCopy } from './visual.copy';
import { describePhoto } from './visual.images';
import type { FlyerFormat, VisualBrandContext } from './visual.model';

export interface VisualEditPorts {
  /** Le modèle de rédaction de l'hôte (étage « writing »). */
  text: (system: string, user: string) => Promise<string>;
}

export interface VisualEditInput {
  instruction: string;
  language: string;
  context: VisualBrandContext;
  format: FlyerFormat;
  level: CreativityLevel;
  copy: WrittenCopy;
  photo?: VisualPhotoRef;
  /** La page gardée avec le visuel (code de l'auteur) ; absente ou de l'ancien moteur : la page est réécrite. */
  spec?: SectionSpec;
  seed: string;
  userId: string;
  projectId: string;
  tag: string;
  /** Une photo jointe à la retouche : elle remplace celle du visuel. */
  newPhotoUrl?: string;
  imageColors?: string[];
  allowDark?: boolean;
}

export interface VisualEditResult {
  /** `edited` : même page, retouchée ; `recomposed` : nouvelle mise en page ; `new-request` : ce n'est pas une retouche. */
  outcome: 'edited' | 'recomposed' | 'new-request' | 'not-understood';
  out?: SectionOutput;
  html?: string;
  png?: Buffer;
  copy: WrittenCopy;
  photo?: VisualPhotoRef;
  seed: string;
  spec?: SectionSpec;
  /** La réponse à l'utilisateur (sa langue) : ce qui a changé, et ce qui n'a pas pu l'être. */
  reply: string;
  applied: string[];
  rejected: string[];
}

export function visualRetouchPrompt(i: Pick<VisualEditInput, 'instruction' | 'language' | 'context' | 'copy' | 'photo'>): { system: string; user: string } {
  const lang = i.language.startsWith('fr') ? 'French' : i.language.startsWith('en') ? 'English' : i.language;
  return {
    system: [
      `You RETOUCH one existing social-media visual of the brand "${i.context.brandName}". The user wants THIS visual changed, not a new one: change ONLY what is asked, everything else stays exactly as it is.`,
      'You get its WORDS (JSON). Answer with ONE JSON object:',
      '{"newRequest": true ONLY if the message asks for a different visual about another subject (not a change of this one),',
      ' "words": {"kicker": string|null, "headline": string, "sub": string|null, "facts": [{"kind": "date|time|place|price|contact|other", "text": string}], "offer": string|null, "quote": {"text": string, "author": string|null}|null} — ALL the words after the change (unchanged ones copied as they are),',
      ' "design": "the change of FORM asked (size, position, colour, emphasis, logo place, background…), in English, precise — or null when only words or the photo change",',
      ' "photo": "keep|remove|replace", "photoIdea": "english description of the new photo scene, only when replace",',
      ' "layout": "keep" — "change" only if the user asks for another layout, composition or version,',
      ` "reply": "one short sentence in ${lang} telling what you changed"}`,
      "RULES: a fact (price, phone, date, address) only if the user gives it; colours are the brand's own — \"in red\" becomes the closest brand colour (say so in the reply when the brand has none). The brand logo always stays on the visual.",
    ].join('\n'),
    user: [`WORDS: ${JSON.stringify(i.copy)}`, `PHOTO: ${i.photo ? `yes (${(i.photo.subject || '').slice(0, 120)})` : 'none'}`, `USER: ${i.instruction.slice(0, 800)}`].join('\n'),
  };
}

function parseJson(raw: string): Record<string, unknown> | null {
  const m = String(raw || '').replace(/```[a-z]*\n?/gi, '').match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}

/** Retouche un visuel : la même page modifiée, ou une nouvelle mise en page quand elle est demandée. */
export async function editVisual(ports: VisualEditPorts, i: VisualEditInput): Promise<VisualEditResult> {
  const base: VisualEditResult = { outcome: 'not-understood', copy: i.copy, photo: i.photo, seed: i.seed, spec: i.spec, reply: '', applied: [], rejected: [] };
  const prompt = visualRetouchPrompt(i);
  let json: Record<string, unknown> | null = null;
  try {
    json = parseJson(await ports.text(prompt.system, prompt.user));
  } catch (error) {
    logger.warn('visual.retouch_failed', { event: 'visual.retouch_failed', error });
  }
  if (!json) return base;
  if (json.newRequest === true) return { ...base, outcome: 'new-request' };

  // Les mots, CONTRÔLÉS (un fait ou un chiffre absent des mots d'avant et de l'instruction est retiré).
  const words = json.words && typeof json.words === 'object' ? json.words : {};
  const edit = parseVisualEdit(JSON.stringify({ ...(words as object), photo: json.photo === 'remove' ? 'remove' : 'keep', layout: json.layout }), i.copy, { instruction: i.instruction, language: i.language, brandName: i.context.brandName });
  const copy = edit?.copy ?? i.copy;

  // La photo : celle jointe, retirée, remplacée (mêmes sources et contrôles qu'à la création), ou gardée.
  let photo = i.photo;
  if (i.newPhotoUrl) {
    const joined = await describePhoto(i.newPhotoUrl, 'user').catch(() => null);
    if (joined) photo = { url: joined.url, focal: joined.focal };
  }
  else if (json.photo === 'remove') photo = undefined;
  else if (json.photo === 'replace') {
    const idea = typeof json.photoIdea === 'string' && json.photoIdea.trim() ? json.photoIdea.trim().slice(0, 240) : copy.headline;
    const found = await findPhoto({ userId: i.userId, projectId: i.projectId, tag: i.tag, context: i.context, format: i.format, copy: { ...copy, photo: { idea, query: idea.split(/\s+/).slice(0, 4).join(' ') } }, subject: `${idea}. ${copy.headline}`, preferGenerated: i.level === 'high' || i.level === 'ultra' }).catch(() => ({ photo: undefined }));
    photo = found.photo ?? photo;
  }
  const reply = typeof json.reply === 'string' ? json.reply.trim().slice(0, 400) : '';
  const design = typeof json.design === 'string' && json.design.trim() && json.design.trim().toLowerCase() !== 'null' ? json.design.trim().slice(0, 800) : '';
  const render = (o: { seed: string; replay?: SectionSpec; revise?: { spec: SectionSpec; instruction: string } }) =>
    renderVisual(i.context, i.format, copy, photo, { level: i.level, seed: o.seed, userId: i.userId, projectId: i.projectId, allowDark: i.allowDark, imageColors: i.imageColors, ...(o.replay ? { replay: o.replay } : {}), ...(o.revise ? { revise: o.revise } : {}) });
  const done = (outcome: VisualEditResult['outcome'], out: SectionOutput, seed: string, extra: Partial<VisualEditResult> = {}): VisualEditResult => ({ ...base, outcome, out, html: sectionHtml(out), png: out.png, copy, photo, seed, spec: out.spec, reply, ...extra });

  // Une autre mise en page, demandée — ou une page de l'ancien moteur, qui ne se rejoue plus : réécrite.
  if (json.layout === 'change' || !isAuthoredSpec(i.spec)) {
    const seed = `${i.seed}:edit:${Date.now().toString(36)}`;
    return done('recomposed', await render({ seed }), seed, design ? { applied: [design] } : {});
  }
  // La forme change : l'auteur réécrit SA page avec la consigne.
  if (design) {
    logger.info('visual.retouch_design', { event: 'visual.retouch_design', design: design.slice(0, 160) });
    return done('edited', await render({ seed: i.seed, revise: { spec: i.spec, instruction: design } }), i.seed, { applied: [design] });
  }
  // Les mots ou la photo seulement : la même page, rejouée sans modèle.
  return done('edited', await render({ seed: i.seed, replay: i.spec }), i.seed);
}

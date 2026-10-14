/**
 * LA RETOUCHE D'UN VISUEL — « change le prix en 4 500 F », « agrandis le titre », « enlève le sous-titre »,
 * « mets le logo en bas », « ajoute notre numéro ».
 *
 * Le visuel retouché est LE MÊME visuel : le modèle lit ses mots et l'arbre de sa page (chaque nœud numéroté),
 * et ne renvoie que les CHANGEMENTS — les mots modifiés et des opérations ciblées sur l'arbre. Le code les
 * applique, rapproche l'arbre des nouveaux mots (un champ ajouté se pose à côté de ses voisins, le logo reste),
 * puis le moteur graphique REJOUE la page : même composition, mêmes positions, mesurée et réparée. Le modèle
 * n'écrit jamais de HTML, ni de couleur hors de la charte.
 *
 * Une autre mise en page n'est faite que si l'utilisateur la demande (« une autre version », « change la
 * composition ») — ou si la page retouchée ne tient plus, ce qui est dit.
 *
 * Le même code pour IDEM (module Communication) et iVision (conversation).
 */
import { applySpecOps, sectionHtml, SectionOutput, SectionSpec, settleTree, specOutline, SpecOp } from '@idem/graphic-engine';
import logger from '../runtime/logger';
import type { CreativityLevel } from '../creativity/levels';
import { findPhoto, renderVisual, VisualPhotoRef, visualSection } from './visual.composer';
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
  /** L'arbre de la page gardé avec le visuel ; absent (visuel ancien) : la page est recomposée. */
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

const TOKENS = 'ink: ink|muted|faint|heading|kicker|emphasis|brand|accent|on-brand|on-accent|inverse · surface: ground|raised|sunken|brand|brand-soft|accent|accent-soft|ink|inverse · space: none|2xs|xs|sm|md|lg|xl|2xl|3xl · text size: xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl';

export function visualRetouchPrompt(i: Pick<VisualEditInput, 'instruction' | 'language' | 'context' | 'copy' | 'photo' | 'spec'>): { system: string; user: string } {
  const lang = i.language.startsWith('fr') ? 'French' : i.language.startsWith('en') ? 'English' : i.language;
  const b = i.context.branding;
  return {
    system: [
      `You RETOUCH one existing social-media visual of the brand "${i.context.brandName}". The user wants THIS visual changed, not a new one: change ONLY what is asked, everything else stays exactly as it is.`,
      'You get its WORDS (JSON) and its PAGE TREE (JSON; every node carries an id in "#"). A text node shows which word it displays with "ref": "title" is the headline; "b1.headline", "b1.kicker", "b1.subhead", "b1.offer", "b1.facts.0.text"… are the fields of the words block (b1); the figure block (b2) is the photo; a "block" node draws a whole block.',
      'Answer with ONE JSON object:',
      '{"newRequest": true ONLY if the message asks for a different visual about another subject (not a change of this one),',
      ' "words": {"kicker": string|null, "headline": string, "sub": string|null, "facts": [{"kind": "date|time|place|price|contact|other", "text": string}], "offer": string|null, "quote": {"text": string, "author": string|null}|null} — ALL the words after the change (unchanged ones copied as they are),',
      ' "ops": [ tree operations, [] when only words change ],',
      ' "photo": "keep|remove|replace", "photoIdea": "english description of the new photo scene, only when replace",',
      ' "layout": "keep" — "change" only if the user asks for another layout, composition or version,',
      ` "reply": "one short sentence in ${lang} telling what you changed"}`,
      'TREE OPERATIONS:',
      '- {"op":"set","id":"n4","props":{…}} — text: size, weight (100-900), caps none|upper|lower, align start|center|end, ink, emphasis underline|outline|null, tracking tight|normal|wide|wider, maxLines; containers: surface, pad, gap, radius none|sm|md|lg|pill, align, justify; logo: height sm|md|lg|xl, variant auto|light|dark|mono|icon; image: overlay none|scrim-bottom|scrim-top|scrim-full|tint-brand, radius, fit; pattern/shape: opacity; a node inside a "layer" moves or resizes with "at": {"x","y","w","h"} in % of the canvas.',
      '- {"op":"remove","id":"n7"}',
      '- {"op":"move","id":"n3","before":"n1"} (or "after") — reorder inside a container',
      '- {"op":"add","parent":"n2","index":0,"node":{…}} — a logo {"t":"logo","height":"md"}, a rule {"t":"rule"}, a field of the words {"t":"text","role":"small","ref":"b1.facts.1.text"}, a brand motif {"t":"pattern","index":0,"opacity":0.2}; inside a layer give "at" too.',
      `TOKENS: ${TOKENS}`,
      'RULES: never write words in the tree (texts are refs to the words); colours are the brand\'s tokens only — "in red" becomes the closest brand colour (say so in the reply when the brand has none); a fact (price, phone, date, address) only if the user gives it; a new field of the words is placed with an "add" next to the related text, unless the words block is drawn whole by a "block" node. The brand logo always stays on the visual.',
    ].join('\n'),
    user: [
      `BRAND COLOURS: primary ${b.primary}, secondary ${b.secondary}${b.accent ? `, accent ${b.accent}` : ''}.`,
      `WORDS: ${JSON.stringify(i.copy)}`,
      `PHOTO: ${i.photo ? `yes (${(i.photo.subject || '').slice(0, 120)})` : 'none'}`,
      i.spec ? `PAGE TREE: ${specOutline(i.spec).slice(0, 14_000)}` : 'PAGE TREE: unavailable (words only)',
      `USER: ${i.instruction.slice(0, 800)}`,
    ].join('\n'),
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
    const found = await findPhoto({ userId: i.userId, projectId: i.projectId, tag: i.tag, context: i.context, format: i.format, copy: { ...copy, photo: { idea, query: idea.split(/\s+/).slice(0, 4).join(' ') } }, subject: `${idea}. ${copy.headline}`, preferGenerated: i.level === 'high' || i.level === 'max' || i.level === 'ultra' }).catch(() => ({ photo: undefined }));
    photo = found.photo ?? photo;
  }
  const reply = typeof json.reply === 'string' ? json.reply.trim().slice(0, 400) : '';
  const render = (o: { seed: string; replay?: SectionSpec }) => renderVisual(i.context, i.format, copy, photo, { level: i.level, seed: o.seed, userId: i.userId, projectId: i.projectId, allowDark: i.allowDark, imageColors: i.imageColors, ...(o.replay ? { replay: o.replay } : {}) });
  const blocking = (out: SectionOutput) => out.result.issues.some((x) => x.severity === 'blocking');
  const done = (outcome: VisualEditResult['outcome'], out: SectionOutput, seed: string, extra: Partial<VisualEditResult> = {}): VisualEditResult => ({ ...base, outcome, out, html: sectionHtml(out), png: out.png, copy, photo, seed, spec: out.spec, reply, ...extra });

  // Une autre mise en page, demandée (ou impossible à rejouer : visuel d'avant la retouche ciblée).
  if (json.layout === 'change' || !i.spec) {
    const seed = `${i.seed}:edit:${Date.now().toString(36)}`;
    return done('recomposed', await render({ seed }), seed);
  }

  // La MÊME page : l'arbre retouché, rapproché des nouveaux mots, rejoué.
  const ops = (Array.isArray(json.ops) ? json.ops : []).filter((o): o is SpecOp => !!o && typeof o === 'object' && typeof (o as SpecOp).op === 'string');
  const patched = applySpecOps(i.spec, ops);
  const section = visualSection(copy, photo);
  if (!section) return base;
  const settled = settleTree(patched.root, patched.decor, section, { requireLogo: true });
  const replay: SectionSpec = { ...i.spec, root: settled.root, ...(settled.decor.length ? { decor: settled.decor } : { decor: undefined }) };
  let out = await render({ seed: i.seed, replay });
  if (!blocking(out)) return done('edited', out, i.seed, { applied: patched.applied, rejected: patched.rejected });

  // La page retouchée ne tient plus (texte trop long pour sa place…) : les mots seuls sur l'arbre d'avant, sinon
  // une nouvelle composition — et la réponse le dit.
  if (patched.applied.length) {
    const words = settleTree(i.spec.root, i.spec.decor ?? [], section, { requireLogo: true });
    out = await render({ seed: i.seed, replay: { ...i.spec, root: words.root, ...(words.decor.length ? { decor: words.decor } : { decor: undefined }) } });
    if (!blocking(out)) return done('edited', out, i.seed, { applied: [], rejected: [...patched.applied, ...patched.rejected] });
  }
  const seed = `${i.seed}:edit:${Date.now().toString(36)}`;
  logger.info('visual.retouch_recomposed', { event: 'visual.retouch_recomposed', issues: out.result.issues.filter((x) => x.severity === 'blocking').map((x) => x.code) });
  return done('recomposed', await render({ seed }), seed, { applied: patched.applied, rejected: patched.rejected });
}

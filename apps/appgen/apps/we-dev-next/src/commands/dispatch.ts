/**
 * L'AIGUILLAGE DES DÉROULÉS — appelé par `/api/chat` avant toute facturation, il décide si le message relève
 * d'un déroulé d'iCode, et lequel :
 *
 *   1. une RÉPONSE cliquée (`answers`) reprend le déroulé qui a posé la question ;
 *   2. une COMMANDE tapée (« /redesign monsite.com ») lance le sien ;
 *   3. sinon l'AGENT lit la demande (`intent.ts`) : refonte, charte, mise en ligne, nom, communication — ou rien.
 *
 * `null` : la demande suit son chemin habituel (construction, retouche). Les questions sont gratuites ; chaque
 * déroulé facture lui-même, au moment où il génère vraiment.
 */
import { ChoicesAnswer, createTextStream, INTERNAL_MARK } from './choices.js';
import { analyzeIntent, INTENT_THRESHOLD } from './intent.js';
import { COMMANDS, looksLikeCommand, parseCommand } from './registry.js';
import { CommandContext, hasCharter, Responder } from './types.js';
import { startCharter, runCharter } from './workflows/charter.js';
import { startConfirm } from './workflows/confirm.js';
import { runRedesign, runRedesignColors, startRedesign } from './workflows/redesign.js';
import { runSite, startSite } from './workflows/site.js';

export interface DispatchInput extends CommandContext {
  answers?: ChoicesAnswer;
  /** La conversation a-t-elle déjà un site construit ? (l'agent en tient compte) */
  hasSite: boolean;
  product: 'site' | 'app' | null;
}

function helpText(fr: boolean): string {
  const lines = COMMANDS.map((c) => `- \`/${c.name}${c.args ? ` <${c.args[fr ? 'fr' : 'en']}>` : ''}\` : ${c.label[fr ? 'fr' : 'en']}`);
  return `${fr ? 'Voici ce que vous pouvez lancer d’un « / » :' : 'Here is what you can start with a “/”:'}\n\n${lines.join('\n')}`;
}

export async function dispatch(input: DispatchInput): Promise<Responder | null> {
  const { fr } = input;

  // 1. Une réponse aux choix posés.
  const answer = input.answers;
  if (answer && typeof answer.purpose === 'string') {
    const values = answer.values && typeof answer.values === 'object' ? answer.values : {};
    const clean: ChoicesAnswer = { ...answer, values: Object.fromEntries(Object.entries(values).map(([k, v]) => [k, String(v ?? '').slice(0, 2000)])) };
    if (answer.purpose === 'redesign') return runRedesign(input, clean);
    if (answer.purpose === 'redesign-colors') return runRedesignColors(input, clean);
    if (answer.purpose === 'site') return runSite(input, clean);
    if (answer.purpose === 'charter') return runCharter(input, clean);
    // « Non, continuer » : la demande d'origine, sans repasser par l'agent.
    if (answer.purpose === 'passthrough') return null;
    return null;
  }

  const text = input.text.trim();
  if (!text || text.startsWith(INTERNAL_MARK)) return null;

  // 2. Une commande tapée.
  const parsed = parseCommand(text);
  if (parsed) {
    const { command, args } = parsed;
    if (command.name === 'redesign') return startRedesign(input, { url: args || null, original: args ? text : undefined });
    if (command.name === 'site') return startSite(input, args);
    if (command.name === 'charter') return startCharter(input);
    // Une commande de l'atelier arrivée jusqu'ici (ancien atelier) : on dit comment la lancer.
    if (command.name === 'help') return createTextStream(helpText(fr));
    return createTextStream(
      fr ? `\`/${command.name}\` se lance depuis la barre de saisie : tapez « / » et choisissez-la dans la liste.` : `\`/${command.name}\` runs from the input bar: type “/” and pick it from the list.`
    );
  }
  if (looksLikeCommand(text)) return createTextStream(`${fr ? 'Je ne connais pas cette commande.' : 'I don’t know this command.'}\n\n${helpText(fr)}`);

  // 3. L'agent lit la demande.
  const intent = await analyzeIntent({
    text,
    userId: input.userId,
    language: fr ? 'fr' : 'en',
    context: { hasProject: !!input.projectData?.id, hasSite: input.hasSite, hasCharter: hasCharter(input.projectData), product: input.product },
  });
  if (intent.intent === 'none' || intent.confidence < INTENT_THRESHOLD) return null;
  if (intent.intent === 'redesign') return startRedesign(input, { url: intent.url ?? null, original: text });
  if (intent.intent === 'charter') return input.projectData?.id && !hasCharter(input.projectData) ? startCharter(input) : null;
  return startConfirm(input, intent.intent);
}

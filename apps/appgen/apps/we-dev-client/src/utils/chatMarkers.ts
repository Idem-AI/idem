/**
 * Les marques que le serveur laisse dans une réponse, pour l'atelier et pas pour l'utilisateur :
 *
 *   idem:choices   des choix à cliquer (`we-dev-next/src/commands/choices.ts`)
 *   idem:project   le projet IDEM créé pendant la réponse : l'atelier s'y rattache
 *   idem:journey   un geste à signaler à la boucle IDEM (site généré, refait…), qui propose la suite
 *   idem:open      un bouton qui mène à une page d'IDEM (la charte du projet…)
 *
 * Ce sont des commentaires HTML portant du JSON. Ils sont retirés du texte affiché.
 */
import type { JourneyDestination, JourneyEventType } from '@idem/shared-journey';

export interface ChoiceOption {
  value: string;
  label: string;
  description?: string;
  recommended?: boolean;
  clientAction?: 'publish' | 'domain' | 'communication';
  passthrough?: boolean;
  dismiss?: boolean;
}

export interface ChoiceQuestion {
  id: string;
  question: string;
  help?: string;
  kind?: 'choice' | 'text';
  options?: ChoiceOption[];
  placeholder?: string;
  allowOther?: boolean;
}

export interface ChatChoices {
  purpose: string;
  questions: ChoiceQuestion[];
  consent?: boolean;
  context?: Record<string, string | boolean | undefined>;
  prepare?: 'site-reset';
  submitLabel?: string;
}

const pattern = (name: string) => new RegExp(`<!--\\s*idem:${name}\\s+(\\{[\\s\\S]*?\\})\\s*-->`, 'g');
const ANY = /<!--\s*idem:(choices|project|journey|open)\s+\{[\s\S]*?\}\s*-->/g;

function read<T>(text: string, name: string): T[] {
  const out: T[] = [];
  for (const match of Array.from(String(text || '').matchAll(pattern(name)))) {
    try {
      out.push(JSON.parse(match[1]) as T);
    } catch {
      /* marque illisible : ignorée */
    }
  }
  return out;
}

export function readChoices(text: string): ChatChoices | null {
  const choices = read<ChatChoices>(text, 'choices')[0];
  return choices && typeof choices.purpose === 'string' && Array.isArray(choices.questions) && choices.questions.length ? choices : null;
}

export function readProject(text: string): { id: string; name?: string } | null {
  const project = read<{ id?: string; name?: string }>(text, 'project')[0];
  return project?.id && /^[\w.-]{1,128}$/.test(project.id) ? { id: project.id, name: project.name } : null;
}

export function readJourney(text: string): { event: JourneyEventType; projectId?: string }[] {
  return read<{ event?: JourneyEventType; projectId?: string }>(text, 'journey').filter((item): item is { event: JourneyEventType; projectId?: string } => typeof item.event === 'string');
}

export function readOpen(text: string): { destination: JourneyDestination; projectId?: string; label: string }[] {
  return read<{ destination?: JourneyDestination; projectId?: string; label?: string }>(text, 'open').filter(
    (item): item is { destination: JourneyDestination; projectId?: string; label: string } => typeof item.destination === 'string' && typeof item.label === 'string'
  );
}

/** Le texte tel que l'utilisateur doit le lire. */
export function withoutMarkers(text: string): string {
  return String(text || '')
    .replace(ANY, '')
    .replace(/<!--\s*idem:(choices|project|journey|open)[\s\S]*$/, '');
}

/**
 * Les marques que le serveur laisse dans une réponse, pour l'atelier et pas pour l'utilisateur :
 *
 *   idem:ask       une question à cliquer (refonte d'un site : charte d'abord, ou refonte directe)
 *   idem:project   le projet IDEM créé pendant la réponse : l'atelier s'y rattache
 *   idem:journey   un geste à signaler à la boucle IDEM (site généré, refait…), qui propose la suite
 *
 * Ce sont des commentaires HTML portant du JSON (voir `we-dev-next/src/siteEngine/redesign/ask.ts`). Ils sont
 * retirés du texte affiché.
 */
import type { JourneyEventType } from '@idem/shared-journey';

export interface ChatAsk {
  purpose: 'redesign';
  url: string;
  host: string;
  question: string;
  options: { value: 'direct' | 'identity'; label: string; description: string; recommended?: boolean }[];
  consent: boolean;
}

const pattern = (name: string) => new RegExp(`<!--\\s*idem:${name}\\s+(\\{[\\s\\S]*?\\})\\s*-->`, 'g');
const ANY = /<!--\s*idem:(ask|project|journey)\s+\{[\s\S]*?\}\s*-->/g;

function read<T>(text: string, name: string): T[] {
  const out: T[] = [];
  for (const match of Array.from(text.matchAll(pattern(name)))) {
    try {
      out.push(JSON.parse(match[1]) as T);
    } catch {
      /* marque illisible : ignorée */
    }
  }
  return out;
}

export function readAsk(text: string): ChatAsk | null {
  const ask = read<ChatAsk>(text, 'ask')[0];
  return ask && ask.purpose === 'redesign' && typeof ask.url === 'string' && Array.isArray(ask.options) ? ask : null;
}

export function readProject(text: string): { id: string; name?: string } | null {
  const project = read<{ id?: string; name?: string }>(text, 'project')[0];
  return project?.id && /^[\w.-]{1,128}$/.test(project.id) ? { id: project.id, name: project.name } : null;
}

export function readJourney(text: string): { event: JourneyEventType; projectId?: string }[] {
  return read<{ event?: JourneyEventType; projectId?: string }>(text, 'journey').filter((item): item is { event: JourneyEventType; projectId?: string } => typeof item.event === 'string');
}

/** Le texte tel que l'utilisateur doit le lire. */
export function withoutMarkers(text: string): string {
  return text.replace(ANY, '').replace(/<!--\s*idem:(ask|project|journey)[\s\S]*$/, '');
}

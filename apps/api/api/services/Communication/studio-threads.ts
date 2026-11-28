/**
 * Les conversations de l'atelier — fonctions pures, sans base ni modèle d'IA.
 *
 * Un projet a désormais PLUSIEURS conversations (`studioThreads`). L'ancien fil unique
 * (`studio`) n'est pas migré par un script : il est lu comme la conversation `main`, et
 * déplacé dans la liste au premier écrit (`CommunicationService.patchStudioThreads`).
 */
import type {
  CommunicationModel,
  StudioMessage,
  StudioThread,
  StudioThreadSummary,
} from '../../models/communication.model';

/** L'id de l'ancien fil unique, devenu une conversation comme les autres. */
export const LEGACY_THREAD_ID = 'main';

/** Au-delà, les plus anciennes conversations sont oubliées (le document du projet a une taille bornée). */
export const MAX_THREADS = 40;

const TITLE_LENGTH = 60;

/** Les conversations du modèle, la plus récente en premier, l'ancien fil compris. */
export function studioThreadsOf(model: CommunicationModel | null | undefined): StudioThread[] {
  const threads = [...(model?.studioThreads ?? [])];
  const legacy = model?.studio?.messages ?? [];
  if (legacy.length && !threads.some((thread) => thread.id === LEGACY_THREAD_ID)) {
    const first = legacy[0]?.createdAt ? new Date(legacy[0].createdAt) : new Date();
    threads.push({
      id: LEGACY_THREAD_ID,
      title: threadTitle(legacy.find((message) => message.role === 'user')?.content || ''),
      messages: legacy,
      createdAt: first,
      updatedAt: model?.studio?.updatedAt ? new Date(model.studio.updatedAt) : first,
    });
  }
  return threads.sort((a, b) => time(b.updatedAt) - time(a.updatedAt));
}

/** Le titre d'une conversation : sa première demande, raccourcie au mot près. */
export function threadTitle(content: string): string {
  const clean = (content || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= TITLE_LENGTH) return clean;
  const cut = clean.slice(0, TITLE_LENGTH);
  const space = cut.lastIndexOf(' ');
  return `${(space > 30 ? cut.slice(0, space) : cut).replace(/[\s,.;:!?-]+$/, '')}…`;
}

export function threadSummary(thread: StudioThread): StudioThreadSummary {
  const cover = [...thread.messages]
    .reverse()
    .find((message: StudioMessage) => message.visualIds?.length)?.visualIds?.[0];
  return {
    id: thread.id,
    title: thread.title,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    messageCount: thread.messages.length,
    ...(cover ? { coverVisualId: cover } : {}),
  };
}

function time(value: Date | string | undefined): number {
  const t = value ? new Date(value).getTime() : 0;
  return Number.isFinite(t) ? t : 0;
}

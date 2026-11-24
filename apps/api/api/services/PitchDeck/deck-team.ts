/**
 * L'ÉQUIPE RÉELLE DU PROJET sur la slide « Team » (24/11/2026).
 *
 * Le projet connaît ses membres (`project.teamMembers` : nom, rôle, bio, photo) ; la slide les inventait en texte seul.
 * Le code pose désormais un bloc `points` d'une personne par point : « Nom », le rôle en détail (court), et sa PHOTO
 * quand elle existe (`media`) — les gabarits « équipe » du catalogue la mettent en grand (portraits, médaillons,
 * capsules). Sans photo, l'icône d'une personne prend la place. Le rédacteur n'écrit plus que le titre et les notes.
 *
 * MODULE PUR.
 */
import type { BlockDraft } from '@idem/graphic-engine';
import type { TeamMember } from '../../models/project.model';

/** Une adresse d'image utilisable telle quelle par le moteur. */
const usable = (url?: string): url is string => !!url && /^(https?:\/\/|data:image\/(png|jpe?g|webp|gif|svg\+xml);)/i.test(url.trim());

const clip = (text: string, max: number) => (text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`);

/** Les membres de l'équipe en bloc `points` (6 au plus, ceux qui ont une photo d'abord), ou `null` s'il n'y en a pas. */
export function deckTeamBlock(members: TeamMember[] | undefined): BlockDraft | null {
  const named = (members ?? []).filter((m) => m?.name?.trim());
  if (!named.length) return null;
  const ordered = [...named.filter((m) => usable(m.pictureUrl)), ...named.filter((m) => !usable(m.pictureUrl))].slice(0, 6);
  // Un bloc `points` en exige deux : une équipe d'une personne reste posée par le rédacteur.
  if (ordered.length < 2) return null;
  return {
    kind: 'points',
    items: ordered.map((m) => ({
      label: clip(m.name.trim(), 80),
      ...(m.role?.trim() ? { detail: clip(m.role.trim(), 160) } : {}),
      visual: 'person portrait',
      ...(usable(m.pictureUrl) ? { media: { url: m.pictureUrl.trim(), alt: clip(`${m.name.trim()}${m.role ? `, ${m.role.trim()}` : ''}`, 200) } } : { icon: 'user' }),
    })),
  } as BlockDraft;
}

/** Ce que le rédacteur ne doit plus écrire quand l'équipe est posée par le code. */
export const TEAM_ALREADY_ON_SLIDE = `<already_on_the_slide>The real TEAM (each member's name, role and photo) is already placed on this slide by the engine, from the project's data. Do NOT write a points block, cards or a list of people: they would duplicate it. Write only the TITLE (why these people, for this problem — one assertion of 10 words or fewer) and the "notes" (each person's one relevant prior experience, and the gap in the team, in the speaker's words).</already_on_the_slide>`;

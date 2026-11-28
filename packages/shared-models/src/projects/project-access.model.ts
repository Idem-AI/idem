/**
 * Les accès d'une équipe à un projet.
 *
 * Un projet a un propriétaire — celui qui l'a créé — et peut avoir des membres.
 * Chaque membre reçoit, pour chaque ESPACE du projet (business plan, site
 * internet, communication…), un des trois niveaux :
 *
 *   none   il ne voit pas l'espace : ni dans le menu, ni par son adresse ;
 *   read   il le consulte et télécharge, sans rien changer ni générer ;
 *   write  il le modifie et génère, comme le propriétaire.
 *
 * Ce fichier est la seule définition : l'API en déduit ce qu'elle laisse
 * passer, le tableau de bord ce qu'il affiche, iCode et le simulateur ce
 * qu'ils ouvrent. Un espace ajouté ici apparaît partout à la fois.
 *
 * Ce qui reste au propriétaire seul, quoi qu'on donne : l'équipe elle-même,
 * les informations du projet, sa suppression.
 */

export const PROJECT_SPACES = [
  'branding',
  'businessPlan',
  'pitchDeck',
  'finance',
  'legal',
  'communication',
  'website',
  'deployment',
  'simulation',
  'advisor',
] as const;

export type ProjectSpace = (typeof PROJECT_SPACES)[number];

export const ACCESS_LEVELS = ['none', 'read', 'write'] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];

export type ProjectPermissions = Record<ProjectSpace, AccessLevel>;

/** Rang d'un niveau : `write` comprend `read`. */
const LEVEL_RANK: Record<AccessLevel, number> = { none: 0, read: 1, write: 2 };

export function isProjectSpace(value: unknown): value is ProjectSpace {
  return typeof value === 'string' && (PROJECT_SPACES as readonly string[]).includes(value);
}

export function isAccessLevel(value: unknown): value is AccessLevel {
  return typeof value === 'string' && (ACCESS_LEVELS as readonly string[]).includes(value);
}

/** Tous les espaces au même niveau. */
export function uniformPermissions(level: AccessLevel): ProjectPermissions {
  return Object.fromEntries(PROJECT_SPACES.map((space) => [space, level])) as ProjectPermissions;
}

/**
 * Nettoie des permissions reçues du réseau : un espace inconnu est ignoré, un
 * espace absent ou un niveau inconnu vaut `none`. On n'accorde jamais par défaut.
 */
export function normalizePermissions(input: unknown): ProjectPermissions {
  const source = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const out = uniformPermissions('none');
  for (const space of PROJECT_SPACES) {
    const level = source[space];
    if (isAccessLevel(level)) out[space] = level;
  }
  return out;
}

export function hasLevel(granted: AccessLevel | undefined, required: AccessLevel): boolean {
  return LEVEL_RANK[granted ?? 'none'] >= LEVEL_RANK[required];
}

// ─── Rôles prêts à l'emploi ─────────────────────────────────────────────────
//
// La plupart des propriétaires ne veulent pas régler dix lignes : ils pensent
// « mon associé », « la personne qui fait ma communication ». Ces rôles sont
// des raccourcis vers un réglage ; « Sur mesure » ouvre le réglage lui-même.

export const ROLE_PRESETS = ['partner', 'viewer', 'marketing', 'web', 'finance'] as const;
export type RolePreset = (typeof ROLE_PRESETS)[number];

/** Le rôle d'un membre : un raccourci, un groupe du projet, ou un réglage à lui. */
export type MemberRoleKey = RolePreset | 'group' | 'custom';

export function isRolePreset(value: unknown): value is RolePreset {
  return typeof value === 'string' && (ROLE_PRESETS as readonly string[]).includes(value);
}

export const ROLE_PRESET_PERMISSIONS: Record<RolePreset, ProjectPermissions> = {
  // Associé : tout, comme le propriétaire (sauf l'équipe et la suppression).
  partner: uniformPermissions('write'),
  // Observateur : un investisseur, un mentor — il regarde, il ne touche à rien.
  viewer: uniformPermissions('read'),
  // Communication : publications, visuels, vidéos, avec la charte sous les yeux.
  marketing: {
    ...uniformPermissions('none'),
    communication: 'write',
    branding: 'read',
    website: 'read',
  },
  // Site internet : le site, sa mise en ligne et son adresse.
  web: {
    ...uniformPermissions('none'),
    website: 'write',
    deployment: 'write',
    branding: 'read',
  },
  // Finances : les chiffres et les documents qui les portent.
  finance: {
    ...uniformPermissions('none'),
    businessPlan: 'write',
    finance: 'write',
    pitchDeck: 'write',
    simulation: 'write',
    legal: 'read',
  },
};

// ─── Ce que voient les interfaces ───────────────────────────────────────────

export type ProjectRole = 'owner' | 'member';

/** Les droits de l'utilisateur connecté sur un projet. */
export interface ProjectAccess {
  role: ProjectRole;
  permissions: ProjectPermissions;
  /** Nom du propriétaire, affiché sur un projet partagé (« Partagé par Awa »). */
  ownerName?: string;
  /** Rôle du membre, pour l'afficher (« Communication », nom de son groupe…). */
  roleKey?: MemberRoleKey;
  groupName?: string;
}

export const OWNER_ACCESS: ProjectAccess = { role: 'owner', permissions: uniformPermissions('write') };

export function canAccess(
  access: ProjectAccess | null | undefined,
  space: ProjectSpace,
  level: AccessLevel = 'read',
): boolean {
  if (!access) return false;
  if (access.role === 'owner') return true;
  return hasLevel(access.permissions?.[space], level);
}

/** Un membre qui ne voit aucun espace n'a, en pratique, pas accès au projet. */
export function hasAnySpace(permissions: ProjectPermissions): boolean {
  return PROJECT_SPACES.some((space) => permissions[space] !== 'none');
}

// ─── Équipe : ce que la page « Équipe » manipule ────────────────────────────

export type MemberStatus = 'pending' | 'active' | 'declined';

export interface ProjectMemberView {
  id: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  status: MemberStatus;
  roleKey: MemberRoleKey;
  groupId?: string | null;
  /** Permissions EFFECTIVES (celles du groupe si le membre en a un). */
  permissions: ProjectPermissions;
  invitedAt: string;
  respondedAt?: string | null;
}

export interface ProjectGroupView {
  id: string;
  name: string;
  permissions: ProjectPermissions;
  memberCount: number;
}

export interface ProjectTeamView {
  projectId: string;
  projectName: string;
  owner: { uid: string; email?: string; displayName?: string; photoURL?: string };
  members: ProjectMemberView[];
  groups: ProjectGroupView[];
}

/** Une invitation reçue, telle que la voit la personne invitée. */
export interface ReceivedInvitationView {
  token: string;
  projectId: string;
  projectName: string;
  invitedBy: { displayName?: string; email?: string };
  roleKey: MemberRoleKey;
  groupName?: string;
  permissions: ProjectPermissions;
  invitedAt: string;
  status: MemberStatus | 'expired' | 'revoked';
}

/** Ce qu'on envoie pour inviter ou changer les droits d'un membre. */
export interface MemberRoleInput {
  roleKey: MemberRoleKey;
  groupId?: string | null;
  /** Seulement pour `custom`. */
  permissions?: Partial<ProjectPermissions>;
}

/** Codes d'erreur de l'équipe, traduits par les interfaces. */
export type TeamErrorCode =
  | 'no_account'
  | 'invalid_email'
  | 'self_invite'
  | 'already_member'
  | 'already_invited'
  | 'not_owner'
  | 'member_not_found'
  | 'group_not_found'
  | 'invalid_role'
  | 'empty_permissions'
  | 'invitation_not_found'
  | 'invitation_expired'
  | 'invitation_wrong_account'
  | 'team_full'
  | 'invalid_name';

/** Une invitation tient 14 jours ; après, on en renvoie une. */
export const INVITATION_TTL_DAYS = 14;
/** Garde-fou : une équipe n'a pas vocation à compter des centaines de comptes. */
export const MAX_PROJECT_MEMBERS = 50;
export const MAX_PROJECT_GROUPS = 20;

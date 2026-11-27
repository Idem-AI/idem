import { Response } from 'express';
import logger from '../config/logger';
import { CustomRequest } from '../interfaces/express.interface';
import { findProjectOwner, resolveProjectAccess } from '../services/team/project-access.service';
import {
  AccessLevel,
  ProjectSpace,
  canAccess,
} from '../../../../packages/shared-models/src/projects/project-access.model';

/**
 * Le contrôle d'accès des membres d'une équipe, appelé par `authenticate`.
 *
 * Pour toute requête qui désigne un projet :
 *
 *   - le propriétaire passe, rien ne change ;
 *   - un membre passe si l'espace visé lui est ouvert au niveau demandé, et la
 *     requête continue AU NOM DU PROPRIÉTAIRE (`req.user.uid`) : les services,
 *     qui lisent tous `users/<uid>/…`, trouvent le projet sans rien savoir des
 *     équipes. Qui a réellement agi reste dans `req.actor` et dans les traces ;
 *   - sinon : 404, comme pour un projet qui n'existe pas. Un membre en lecture
 *     seule qui tente de modifier reçoit 403 `read_only`, pour que l'écran
 *     puisse le lui dire au lieu de faire croire à une panne.
 *
 * Conséquence voulue : ce qu'un membre génère sur le projet est débité du
 * portefeuille du propriétaire — c'est son projet, et c'est lui qui a ouvert
 * l'espace en écriture.
 */

type Target = { space: ProjectSpace } | { space: 'project' } | { space: 'owner' };

export interface Rule {
  /** Motif sur `baseUrl + route.path`, ex. `/project/businessPlans/:projectId/sections`. */
  pattern: RegExp;
  target: Target;
  /** Méthodes concernées ; toutes si absent. */
  methods?: string[];
}

const S = (space: ProjectSpace): Target => ({ space });
const PROJECT: Target = { space: 'project' };
const OWNER: Target = { space: 'owner' };

/**
 * L'ordre compte : la première règle qui correspond l'emporte.
 * Une route qui désigne un projet sans figurer ici est refusée aux membres :
 * un espace oublié reste fermé plutôt qu'ouvert à tous.
 */
const RULES: Rule[] = [
  // Projet lui-même : tout membre le lit ; le modifier ou le supprimer reste au propriétaire.
  { pattern: /^\/projects\/delete\//, target: OWNER },
  { pattern: /^\/projects\/:projectId\/branding\/completion$/, target: PROJECT },
  { pattern: /^\/projects\/:projectId\/app-deployment/, target: S('deployment') },
  { pattern: /^\/projects\/:projectId\/(generation|code|chat-session|zip|github)/, target: S('website') },
  // Supprimer le projet : propriétaire. Le modifier (PUT) sert à l'identité
  // visuelle (logo, couleurs, polices posés sur le projet) : même espace.
  { pattern: /^\/projects\/:projectId$/, methods: ['DELETE'], target: OWNER },
  { pattern: /^\/projects\/:projectId$/, methods: ['PUT', 'PATCH'], target: S('branding') },
  { pattern: /^\/projects\/:projectId$/, target: PROJECT },

  // Espaces du tableau de bord.
  { pattern: /^\/project\/(brandings|business-cards)\b/, target: S('branding') },
  { pattern: /^\/project\/businessPlans\b/, target: S('businessPlan') },
  { pattern: /^\/project\/pitchDecks\b/, target: S('pitchDeck') },
  { pattern: /^\/project\/finance\b/, target: S('finance') },
  { pattern: /^\/project\/legalDocs\b/, target: S('legal') },
  { pattern: /^\/project\/communication\b/, target: S('communication') },
  { pattern: /^\/project\/simulations\b/, target: S('simulation') },
  { pattern: /^\/project\/advisor\b/, target: S('advisor') },
  { pattern: /^\/project\/deployments?\b/, target: S('deployment') },
  { pattern: /^\/project\/(developments|diagrams)\b/, target: S('website') },
  // Contexte, historique, cohérence : lus par tous ; restaurer ou appliquer touche
  // plusieurs espaces à la fois, donc reste au propriétaire (voir `levelOf`).
  { pattern: /^\/project\/(context|history|coherence)\b/, target: PROJECT },
  { pattern: /^\/project\/project\/:projectId\/policy-status$/, target: PROJECT },
  { pattern: /^\/project\/finalize\//, target: OWNER },

  // iCode.
  { pattern: /^\/appgen\/brand-mark\//, target: PROJECT },
  { pattern: /^\/appgen\/(projects\/:projectId\/identity|site-import\/project|site-images|handoff)/, target: S('website') },
  { pattern: /^\/appgen\/media\//, target: S('website') },
  { pattern: /^\/github\/projects\/:projectId\/push$/, target: S('website') },
  { pattern: /^\/billing\/access\/appgen\//, target: S('website') },

  // Lectures transverses.
  { pattern: /^\/billing\/(creativity|projects\/:projectId\/ownership)/, target: PROJECT },
  { pattern: /^\/journey\/(events|next)$/, target: PROJECT },
  { pattern: /^\/api\/logo\b/, target: S('branding') },

  // Réservé au propriétaire.
  { pattern: /^\/cache\//, target: OWNER },
  { pattern: /^\/builders\/eligibility\//, target: OWNER },
];

/** Routes dont l'identifiant de projet arrive dans le corps ou la requête. */
const BODY_ROUTES = /^\/(appgen\/(handoff|site-images)|appgen\/media\/|journey\/(events|next)$|api\/logo|project\/(developments|deployments))/;

/** Lectures en GET qui, en réalité, génèrent (et coûtent) : elles demandent l'écriture. */
const GENERATING_GET = /\/generate|ai-fill-stream|logo-(concepts|variations)-stream|generate-stream/;

/** L'espace visé par une route (`baseUrl + route.path`), ou `null` si elle n'est pas répertoriée. */
export function targetOf(pattern: string, method = 'GET'): Rule | null {
  const verb = method.toUpperCase();
  return (
    RULES.find((candidate) => candidate.pattern.test(pattern) && (!candidate.methods || candidate.methods.includes(verb))) ?? null
  );
}

function routePattern(req: CustomRequest): string {
  const path = typeof req.route?.path === 'string' ? req.route.path : '';
  return `${req.baseUrl || ''}${path}`.replace(/\/+$/, '') || '/';
}

export function levelOf(method: string, pattern: string): AccessLevel {
  method = method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return GENERATING_GET.test(pattern) ? 'write' : 'read';
  }
  return 'write';
}

function projectIdOf(req: CustomRequest, pattern: string): string | null {
  const fromParams = req.params?.projectId;
  if (typeof fromParams === 'string' && fromParams) return fromParams;
  if (!BODY_ROUTES.test(pattern)) return null;
  const fromBody = (req.body as Record<string, unknown> | undefined)?.projectId;
  if (typeof fromBody === 'string' && fromBody) return fromBody;
  const fromQuery = req.query?.projectId;
  if (typeof fromQuery === 'string' && fromQuery) return fromQuery;
  return null;
}

function notFound(res: Response): void {
  res.status(404).json({ message: 'Project not found', error: 'project_not_found' });
}

/**
 * Renvoie `true` si la requête peut continuer, `false` si une réponse est déjà partie.
 */
export async function applyProjectAccess(req: CustomRequest, res: Response): Promise<boolean> {
  const uid = req.user?.uid;
  if (!uid) return true;
  // Les routes de l'équipe font leurs propres contrôles, au nom de la personne connectée.
  if (req.baseUrl === '/team') return true;

  const pattern = routePattern(req);
  const projectId = projectIdOf(req, pattern);
  if (!projectId) return true;

  const resolved = await resolveProjectAccess(projectId, uid);
  if (!resolved) {
    // Le projet existe peut-être, mais pas pour cette personne. Les identifiants
    // qui ne sont pas des projets IDEM (brouillons iCode…) continuent leur chemin.
    // Seulement pour un identifiant dans l'adresse : les routes qui le lisent dans
    // le corps vérifient elles-mêmes la propriété et répondent à leur façon.
    if (typeof req.params?.projectId === 'string' && (await findProjectOwner(projectId))) {
      notFound(res);
      return false;
    }
    return true;
  }

  const { access, project } = resolved;
  if (access.role === 'owner') return true;

  const rule = targetOf(pattern, req.method);
  const level = levelOf(req.method, pattern);
  let allowed = false;
  let readOnly = false;

  if (!rule) {
    logger.warn('project_access.unmapped_route', { event: 'project_access.unmapped_route', route: pattern, method: req.method });
  } else if (rule.target.space === 'owner') {
    allowed = false;
  } else if (rule.target.space === 'project') {
    // Tout membre lit le projet ; écrire au niveau du projet reste au propriétaire.
    allowed = level === 'read';
    readOnly = level === 'write';
  } else {
    allowed = canAccess(access, rule.target.space, level);
    readOnly = !allowed && level === 'write' && canAccess(access, rule.target.space, 'read');
  }

  if (!allowed) {
    logger.info('project_access.denied', {
      event: 'project_access.denied',
      projectId,
      route: pattern,
      method: req.method,
      level,
      readOnly,
    });
    if (readOnly) {
      res.status(403).json({
        error: 'read_only',
        message: 'Vous avez accès à cet espace en lecture seule.',
      });
    } else {
      notFound(res);
    }
    return false;
  }

  // Le membre agit au nom du propriétaire.
  req.actor = { uid, email: req.user?.email };
  req.projectAccess = access;
  req.user = { ...req.user!, uid: project.ownerId };
  return true;
}

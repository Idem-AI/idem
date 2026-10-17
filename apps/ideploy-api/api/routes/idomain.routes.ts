/**
 * PASSERELLE INTERNE D'iDOMAIN — `/internal/idomain/*`.
 *
 * iDomain vend et configure les noms de domaine ; iDeploy sert les applications. Quand un
 * utilisateur relie un domaine à son application, iDomain demande ici, au nom de cet utilisateur
 * IDEM (`idemUid`), ce qu'iDeploy sait déjà faire : l'IP du serveur, l'ajout du nom aux adresses
 * de l'application, la vérification du DNS public et du certificat. Rien n'est refait à côté :
 * mêmes contrôles (domaine déjà pris par une autre équipe, noms valides), même routage en direct.
 *
 * Accès : l'en-tête `x-idomain-key` (= `IDOMAIN_IDEPLOY_KEY`), clé dédiée. Chaque route vérifie
 * que l'utilisateur est membre de l'équipe qui possède l'application (404 sinon).
 */
import crypto from 'crypto';
import { NextFunction, Request, Response, Router } from 'express';
import pool from '../config/db.config';
import logger from '../config/logger';
import * as appService from '../services/application.service';
import * as deploymentService from '../services/deployment.service';
import { domainGuide } from '../services/domain-dns.service';
import { applyDomainsLive } from '../services/domain-options.service';
import { ROUTABLE } from '../services/routes-file.service';
import { getUserTeamIds } from '../services/user.service';
import { isDomainError } from '../utils/errors';
import { setTraceUser } from '../utils/trace.util';

const router = Router();

function requireIdomainKey(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.IDOMAIN_IDEPLOY_KEY;
  const provided = req.headers['x-idomain-key'];
  if (!expected) {
    logger.error('idomain.gateway_unconfigured', { event: 'idomain.gateway_unconfigured' });
    res.status(503).json({ error: 'gateway_unconfigured' });
    return;
  }
  const a = crypto.createHash('sha256').update(typeof provided === 'string' ? provided : '').digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  if (typeof provided !== 'string' || !crypto.timingSafeEqual(a, b)) {
    logger.warn('idomain.gateway_denied', { event: 'idomain.gateway_denied', path: req.path, ip: req.ip });
    res.status(403).json({ error: 'forbidden' });
    return;
  }
  next();
}

const HOST = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/;
const splitFqdn = (fqdn: string | null | undefined): string[] =>
  (fqdn ?? '')
    .split(',')
    .map((d) => d.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase())
    .filter(Boolean);

/** L'utilisateur iDeploy d'un uid IDEM, et ses équipes. Inconnu : aucune équipe, donc aucune application. */
async function teamsOf(idemUid: unknown): Promise<{ userId: number; teamIds: number[] } | null> {
  if (typeof idemUid !== 'string' || !idemUid || idemUid.length > 128) return null;
  const { rows } = await pool.query('SELECT id FROM users WHERE idem_uid = $1 LIMIT 1', [idemUid]);
  if (!rows[0]) return null;
  const userId = Number(rows[0].id);
  setTraceUser(userId);
  return { userId, teamIds: await getUserTeamIds(userId) };
}

/** L'application et l'équipe qui la possède, si l'utilisateur en est membre. */
async function accessibleApp(idemUid: unknown, uuid: string) {
  const who = await teamsOf(idemUid);
  if (!who) return null;
  for (const teamId of who.teamIds) {
    const app = await appService.getApplication(teamId, uuid);
    if (app) return { app, teamId };
  }
  return null;
}

const route =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response): void => {
    fn(req, res).catch((error: Error) => {
      if (isDomainError(error)) {
        res.status(error.status).json({ error: error.code, code: error.code, message: error.message });
        return;
      }
      logger.error('idomain.gateway_failed', { event: 'idomain.gateway_failed', path: req.path, error });
      if (!res.headersSent) res.status(500).json({ error: 'internal_error' });
    });
  };

router.use(requireIdomainKey);

/** Les applications de toutes les équipes de l'utilisateur. */
router.get(
  '/applications',
  route(async (req, res) => {
    const who = await teamsOf(req.query.idemUid);
    if (!who) {
      res.json({ applications: [] });
      return;
    }
    const lists = await Promise.all(who.teamIds.map((teamId) => appService.listApplications(teamId)));
    res.json({ applications: lists.flat().map((a) => ({ uuid: a.uuid, name: a.name, domains: splitFqdn(a.fqdn), status: a.status ?? null })) });
  })
);

/** Une application, et l'IP vers laquelle son domaine doit pointer. */
router.get(
  '/applications/:uuid',
  route(async (req, res) => {
    const found = await accessibleApp(req.query.idemUid, String(req.params.uuid));
    if (!found) {
      res.status(404).json({ error: 'application_not_found', message: 'Application introuvable.' });
      return;
    }
    const guide = await domainGuide(found.teamId, found.app.uuid, '').catch(() => null);
    res.json({ uuid: found.app.uuid, name: found.app.name, domains: splitFqdn(found.app.fqdn), status: found.app.status ?? null, serverIp: guide?.serverIp ?? null });
  })
);

/**
 * Ajoute des adresses à l'application. Mêmes contrôles qu'à l'écran (nom valide, pas déjà pris
 * par une autre équipe) ; routées en direct quand l'application le permet, sinon par une mise en
 * ligne lancée ici — l'utilisateur n'a rien à relancer.
 */
router.post(
  '/applications/:uuid/domains',
  route(async (req, res) => {
    const found = await accessibleApp(req.body?.idemUid, String(req.params.uuid));
    if (!found) {
      res.status(404).json({ error: 'application_not_found', message: 'Application introuvable.' });
      return;
    }
    const hosts: string[] = (Array.isArray(req.body?.hosts) ? req.body.hosts : []).map((h: unknown) => String(h).toLowerCase()).filter((h: string) => HOST.test(h)).slice(0, 4);
    if (!hosts.length) {
      res.status(422).json({ error: 'invalid_hosts', message: 'Aucun nom de domaine valide.' });
      return;
    }
    const current = splitFqdn(found.app.fqdn);
    const fresh = hosts.filter((h) => !current.includes(h));
    if (!fresh.length) {
      res.json({ domains: current, applied: true });
      return;
    }
    // Le domaine acheté devient l'adresse principale ; l'adresse IDEM reste en secours.
    const next = [...hosts, ...current.filter((h) => !hosts.includes(h))];
    const updated = await appService.updateApplication(found.teamId, found.app.uuid, { fqdn: next.map((h) => `https://${h}`).join(',') });
    const live = await applyDomainsLive(found.teamId, found.app.uuid).catch((error) => {
      logger.warn('idomain.domains_not_applied_live', { event: 'idomain.domains_not_applied_live', uuid: found.app.uuid, error });
      return { applied: false as const };
    });
    if (!live.applied) await deploymentService.createDeployment(found.app, found.teamId, {});
    logger.info('idomain.domains_attached', { event: 'idomain.domains_attached', uuid: found.app.uuid, hosts: fresh, live: live.applied });
    res.json({ domains: splitFqdn(updated?.fqdn), applied: live.applied });
  })
);

router.delete(
  '/applications/:uuid/domains',
  route(async (req, res) => {
    const found = await accessibleApp(req.body?.idemUid, String(req.params.uuid));
    if (!found) {
      res.status(404).json({ error: 'application_not_found', message: 'Application introuvable.' });
      return;
    }
    const hosts: string[] = (Array.isArray(req.body?.hosts) ? req.body.hosts : []).map((h: unknown) => String(h).toLowerCase());
    const remaining = splitFqdn(found.app.fqdn).filter((h) => !hosts.includes(h));
    // Une application garde toujours au moins une adresse.
    if (!remaining.length) {
      res.json({ domains: splitFqdn(found.app.fqdn) });
      return;
    }
    const updated = await appService.updateApplication(found.teamId, found.app.uuid, { fqdn: remaining.map((h) => `https://${h}`).join(',') });
    await applyDomainsLive(found.teamId, found.app.uuid).catch(() => undefined);
    res.json({ domains: splitFqdn(updated?.fqdn) });
  })
);

/** Ce que voit le monde pour chaque adresse : DNS public, puis certificat HTTPS. */
router.get(
  '/applications/:uuid/domains/status',
  route(async (req, res) => {
    const found = await accessibleApp(req.query.idemUid, String(req.params.uuid));
    if (!found) {
      res.status(404).json({ error: 'application_not_found', message: 'Application introuvable.' });
      return;
    }
    const hosts = String(req.query.hosts ?? '').slice(0, 2000);
    const guide = await domainGuide(found.teamId, found.app.uuid, hosts || undefined);
    // Un nom devenu joignable est routé tout de suite, sans attendre la vérification périodique.
    if (guide.domains.some((d) => ROUTABLE.has(d.status))) await applyDomainsLive(found.teamId, found.app.uuid).catch(() => undefined);
    res.json({ domains: guide.domains.map((d) => ({ host: d.host, dns: d.status, https: d.https.status, routed: ROUTABLE.has(d.status) })) });
  })
);

export default router;

/**
 * L'hébergement : iDeploy. C'est lui qui sert l'application derrière Traefik, sait sur quel
 * serveur elle tourne, vérifie le DNS public, route un domaine vérifié et obtient le certificat.
 * iDomain ne refait rien de cela : il demande, par la passerelle `/internal/idomain` d'iDeploy
 * (clé `IDOMAIN_IDEPLOY_KEY`), au nom de l'utilisateur IDEM dont il a vérifié la session.
 * iDeploy contrôle lui-même que cet utilisateur est membre de l'équipe de l'application.
 */
import axios, { AxiosError } from 'axios';
import { env } from '../config/env';
import logger from '../config/logger';
import { traceHeaders } from '../utils/trace.util';

export interface HostedApplication {
  uuid: string;
  name: string;
  /** Adresses servies, la première est la principale (`monapp.idem.africa`…). */
  domains: string[];
  status?: string | null;
}

export interface HostingTarget extends HostedApplication {
  /** L'adresse IP vers laquelle le domaine doit pointer (enregistrement A). */
  serverIp: string | null;
}

/** L'état d'une adresse vue par iDeploy : DNS public, puis HTTPS. */
export interface HostingDomainStatus {
  host: string;
  /** 'ok' | 'missing' | 'wrong_ip' | 'proxied' | 'ipv6_conflict' | 'taken' | 'automatic' */
  dns: string;
  https: 'valid' | 'invalid' | 'unreachable' | 'not_checked';
  routed: boolean;
}

export class HostingError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message);
    this.name = 'HostingError';
  }
}

async function call<T>(method: 'get' | 'post' | 'delete', path: string, data?: unknown): Promise<T> {
  try {
    const res = await axios.request<T>({
      method,
      url: `${env.ideployApiUrl}/internal/idomain${path}`,
      ...(method === 'get' ? { params: data } : { data }),
      timeout: 20_000,
      headers: { 'x-idomain-key': env.ideployKey, ...traceHeaders() },
    });
    return res.data;
  } catch (error) {
    const e = error as AxiosError<{ error?: string; code?: string; message?: string }>;
    const status = e.response?.status || 503;
    if (status >= 500) logger.error('ideploy.gateway_failed', { event: 'ideploy.gateway_failed', path, status, error: e });
    throw new HostingError(e.response?.data?.message || e.message, status, e.response?.data?.code || e.response?.data?.error);
  }
}

export const hosting = {
  /** Les applications des équipes dont l'utilisateur est membre. */
  applications: (idemUid: string) => call<{ applications: HostedApplication[] }>('get', '/applications', { idemUid }).then((r) => r.applications),
  /** Une application et l'IP de son serveur (404 si l'utilisateur n'y a pas accès). */
  target: (idemUid: string, appUuid: string) => call<HostingTarget>('get', `/applications/${encodeURIComponent(appUuid)}`, { idemUid }),
  /** Ajoute des adresses à l'application (iDeploy les route dès que leur DNS est bon). */
  attach: (idemUid: string, appUuid: string, hosts: string[]) => call<{ domains: string[]; applied: boolean }>('post', `/applications/${encodeURIComponent(appUuid)}/domains`, { idemUid, hosts }),
  detach: (idemUid: string, appUuid: string, hosts: string[]) => call<{ domains: string[] }>('delete', `/applications/${encodeURIComponent(appUuid)}/domains`, { idemUid, hosts }),
  /** DNS public et certificat de chaque adresse, lus par iDeploy. */
  status: (idemUid: string, appUuid: string, hosts: string[]) =>
    call<{ domains: HostingDomainStatus[] }>('get', `/applications/${encodeURIComponent(appUuid)}/domains/status`, { idemUid, hosts: hosts.join(',') }).then((r) => r.domains),
};

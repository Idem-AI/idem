/**
 * La configuration de l'API iDomain, lue une fois (après le chargement des secrets).
 * Ce qui est sensible vient d'Infisical (projet `idomain-api`), le reste du `.env`.
 */
const list = (v?: string) => (v || '').split(',').map((s) => s.trim()).filter(Boolean);
const url = (v: string | undefined, fallback: string) => (v || fallback).replace(/\/+$/, '');

export const env = {
  get port() {
    return parseInt(process.env.PORT || '3007', 10);
  },
  get nodeEnv() {
    return process.env.NODE_ENV || 'development';
  },
  get isProduction() {
    return env.nodeEnv === 'production';
  },
  /** L'API IDEM : identité (cookie `session`) et portefeuille (passerelle `/internal/idomain`). */
  get idemApiUrl() {
    return url(process.env.IDEM_API_URL, 'http://localhost:3001');
  },
  /** Clé partagée avec l'API IDEM, dans les deux sens (`x-idomain-key`). */
  get serviceKey() {
    return process.env.IDOMAIN_SERVICE_KEY || '';
  },
  /** L'API iDeploy : applications de l'utilisateur, rattachement des domaines (`/internal/idomain`). */
  get ideployApiUrl() {
    return url(process.env.IDEPLOY_API_URL, 'http://localhost:3002');
  },
  /** Clé partagée avec l'API iDeploy (`x-idomain-key`), distincte de celle d'IDEM. */
  get ideployKey() {
    return process.env.IDOMAIN_IDEPLOY_KEY || '';
  },
  /** Clé de la console d'administration (idem-admin, de serveur à serveur). */
  get adminKey() {
    return process.env.IDOMAIN_ADMIN_KEY || '';
  },
  /** Secret de signature des événements envoyés aux produits (HMAC-SHA256). */
  get webhookSecret() {
    return process.env.IDOMAIN_WEBHOOK_SECRET || '';
  },
  /** Où publier `domain.active`, `order.*` : `nom=url` séparés par des virgules. */
  get webhookTargets(): { name: string; url: string }[] {
    return list(process.env.IDOMAIN_WEBHOOK_TARGETS)
      .map((entry) => {
        const at = entry.indexOf('=');
        return at > 0 ? { name: entry.slice(0, at), url: entry.slice(at + 1) } : null;
      })
      .filter((t): t is { name: string; url: string } => !!t && /^https?:\/\//.test(t.url));
  },
  /** Front iDomain, iDeploy, iCode et tableau de bord : origines admises (CORS, cookies). */
  get allowedOrigins() {
    return list(process.env.IDOMAIN_ALLOWED_ORIGINS || 'http://localhost:4205,http://localhost:4202,http://localhost:4200,http://localhost:5173');
  },
  /** Adresses où un retour après achat (`returnUrl`) est accepté : les produits IDEM. */
  get returnHosts() {
    return list(process.env.IDOMAIN_RETURN_HOSTS || 'idem.africa,localhost,127.0.0.1');
  },
  get webUrl() {
    return url(process.env.IDOMAIN_WEB_URL, 'http://localhost:4205');
  },
  get dashboardUrl() {
    return url(process.env.IDEM_DASHBOARD_URL, 'http://localhost:4200');
  },
  /** Le connecteur simulé (développement, contrôles) : jamais en production. */
  get simulatedRegistrar() {
    return process.env.IDOMAIN_SIMULATED_REGISTRAR === 'true' && !env.isProduction;
  },
};

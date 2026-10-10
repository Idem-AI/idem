/**
 * La configuration de l'API iVision, lue une fois (après le chargement des secrets).
 * Ce qui est sensible vient d'Infisical (projet `ivision-api`), le reste du `.env`.
 */
const list = (v?: string) => (v || '').split(',').map((s) => s.trim()).filter(Boolean);

export const env = {
  get port() {
    return parseInt(process.env.PORT || '3006', 10);
  },
  get nodeEnv() {
    return process.env.NODE_ENV || 'development';
  },
  /** L'API IDEM : identité (cookie `session`), passerelle interne (modèles, crédits, projets). */
  get idemApiUrl() {
    return (process.env.IDEM_API_URL || 'http://localhost:3001').replace(/\/+$/, '');
  },
  /** Clé de service partagée avec l'API IDEM (routes `/internal/ivision`). */
  get serviceKey() {
    return process.env.IVISION_SERVICE_KEY || '';
  },
  /** URL publique de CETTE API (sons, aperçus, médias servis aux pages de rendu). */
  get publicUrl() {
    return (process.env.IVISION_API_URL || `http://localhost:${env.port}`).replace(/\/+$/, '');
  },
  /** Front iVision et tableau de bord IDEM : origines admises (CORS, cookies). */
  get allowedOrigins() {
    return list(process.env.IVISION_ALLOWED_ORIGINS || 'http://localhost:4204,http://localhost:4200');
  },
  get dashboardUrl() {
    return (process.env.IDEM_DASHBOARD_URL || 'http://localhost:4200').replace(/\/+$/, '');
  },
};

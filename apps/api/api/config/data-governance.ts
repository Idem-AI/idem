/**
 * Registre de gouvernance des données — SOURCE UNIQUE des règles de traitement.
 *
 * Ce fichier dit, pour chaque catégorie de données qu'IDEM traite : son niveau de
 * protection, pourquoi elle est traitée, combien de temps elle est gardée, et quels
 * sous-traitants peuvent la recevoir. Le code qui transmet des données hors d'IDEM
 * (`services/privacy/privacy-guard.ts`) le LIT : une règle se change ici, jamais
 * dans un module métier. La documentation lisible est `docs/PRIVACY.md` ;
 * `npm run check:privacy` vérifie que les deux et le code restent d'accord.
 *
 * Les bases légales sont des PROPOSITIONS techniques à faire valider par un juriste
 * (loi camerounaise n° 2024/017 du 23/12/2024, RGPD pour les utilisateurs européens).
 */

/** Niveau de protection interne (ce n'est pas une qualification juridique). */
export type Classification = 'L0' | 'L1' | 'L2' | 'L3';

export const CLASSIFICATION_RANK: Record<Classification, number> = { L0: 0, L1: 1, L2: 2, L3: 3 };

export const CLASSIFICATION_LABEL: Record<Classification, string> = {
  L0: 'Public — publié volontairement par l’utilisateur',
  L1: 'Interne — données techniques et préférences',
  L2: 'Confidentiel — idées, projets, business plans, stratégies, conversations',
  L3: 'Très sensible — secrets, identifiants, données de paiement',
};

/** Finalités. Toute transmission ou tout traitement en déclare UNE. */
export type Purpose =
  | 'SERVICE_DELIVERY'
  | 'ACCOUNT_SECURITY'
  | 'BILLING'
  | 'LEGAL_OBLIGATION'
  | 'PRODUCT_ANALYTICS'
  | 'PRODUCT_IMPROVEMENT'
  | 'AI_RESEARCH'
  | 'MARKETING';

export type LegalBasis = 'contract' | 'legal_obligation' | 'legitimate_interest' | 'consent';

export interface PurposeDefinition {
  label: string;
  /** Base légale proposée — à valider juridiquement. */
  legalBasis: LegalBasis;
  /** Un consentement distinct, retirable, est requis avant tout traitement. */
  requiresConsent: boolean;
  /** Niveau le plus élevé que cette finalité peut traiter. */
  maxClassification: Classification;
  /** État dans le code au moment de la rédaction. */
  status: 'active' | 'not_implemented';
}

export const PURPOSES: Record<Purpose, PurposeDefinition> = {
  SERVICE_DELIVERY: { label: 'Fournir le service demandé (générer, stocker, publier, déployer)', legalBasis: 'contract', requiresConsent: false, maxClassification: 'L2', status: 'active' },
  ACCOUNT_SECURITY: { label: 'Sécuriser les comptes (sessions, appareil, abus)', legalBasis: 'legitimate_interest', requiresConsent: false, maxClassification: 'L3', status: 'active' },
  BILLING: { label: 'Encaisser, créditer, rembourser', legalBasis: 'contract', requiresConsent: false, maxClassification: 'L3', status: 'active' },
  LEGAL_OBLIGATION: { label: 'Conserver les preuves comptables et de transaction', legalBasis: 'legal_obligation', requiresConsent: false, maxClassification: 'L3', status: 'active' },
  PRODUCT_ANALYTICS: { label: 'Mesurer l’usage des fonctions (métadonnées seulement, jamais le contenu)', legalBasis: 'legitimate_interest', requiresConsent: false, maxClassification: 'L1', status: 'active' },
  PRODUCT_IMPROVEMENT: { label: 'Améliorer IDEM à partir des retours volontaires', legalBasis: 'legitimate_interest', requiresConsent: false, maxClassification: 'L1', status: 'active' },
  // Aucun jeu d'entraînement n'est constitué à partir des projets (vérifié : idem-ml n'a aucune collecte).
  AI_RESEARCH: { label: 'Construire des jeux de données pour améliorer les modèles', legalBasis: 'consent', requiresConsent: true, maxClassification: 'L2', status: 'not_implemented' },
  MARKETING: { label: 'Envoyer des offres commerciales', legalBasis: 'consent', requiresConsent: true, maxClassification: 'L1', status: 'not_implemented' },
};

/** Catégories de données réellement stockées (collections Mongo / préfixes MinIO / journaux). */
export interface DataCategory {
  classification: Classification;
  purposes: Purpose[];
  /** Où la donnée vit. */
  stores: string[];
  /** Conservation EFFECTIVE aujourd'hui (pas la cible). */
  retentionToday: string;
  /** Conservation cible proposée. */
  retentionTarget: string;
}

export const DATA_CATEGORIES: Record<string, DataCategory> = {
  identity: { classification: 'L1', purposes: ['SERVICE_DELIVERY', 'ACCOUNT_SECURITY'], stores: ['mongo:users', 'supabase:auth.users'], retentionToday: 'compte + 180 j de grâce après la demande, puis effacement (data-lifecycle)', retentionTarget: 'compte + 180 j de grâce, puis effacement' },
  sessions: { classification: 'L3', purposes: ['ACCOUNT_SECURITY'], stores: ['mongo:refresh_tokens', 'redis:session'], retentionToday: 'expiration du jeton', retentionTarget: 'expiration du jeton' },
  projects: { classification: 'L2', purposes: ['SERVICE_DELIVERY'], stores: ['mongo:projects', 'mongo:project_revisions', 'minio:users/<uid>/projects/', 'minio:projects/<id>/'], retentionToday: 'archivé, puis effacé avec ses fichiers après PROJECT_PURGE_AFTER_DAYS (30 j, data-lifecycle)', retentionTarget: 'archivé 30 j puis effacé avec ses fichiers' },
  conversations: { classification: 'L2', purposes: ['SERVICE_DELIVERY'], stores: ['mongo:advisor/chat', 'mongo:communication'], retentionToday: 'indéfinie', retentionTarget: 'liée au projet' },
  ivision_brands: { classification: 'L2', purposes: ['SERVICE_DELIVERY'], stores: ['mongo:ivision_*', 'minio:users/<uid>/brands/'], retentionToday: 'indéfinie', retentionTarget: 'liée au compte' },
  deployments: { classification: 'L2', purposes: ['SERVICE_DELIVERY'], stores: ['postgres:ideploy', 'serveurs iDeploy'], retentionToday: 'tant que l’application existe', retentionTarget: 'liée à l’application' },
  ai_usage: { classification: 'L1', purposes: ['BILLING', 'PRODUCT_ANALYTICS'], stores: ['mongo:ai_usage_events'], retentionToday: 'indéfinie, détachée du compte et du projet à leur suppression (métadonnées seulement)', retentionTarget: '24 mois puis agrégat' },
  payments: { classification: 'L3', purposes: ['BILLING', 'LEGAL_OBLIGATION'], stores: ['mongo:payment_transactions', 'mongo:payment_events', 'mongo:billing_invoices', 'mongo:billing_subscriptions', 'mongo:credit_ledger', 'mongo:credit_balances', 'mongo:idomain_charges'], retentionToday: '10 ans ; à la suppression du compte, e-mail et téléphone retirés (data-lifecycle)', retentionTarget: '10 ans (obligation comptable), même après suppression du compte' },
  consents: { classification: 'L1', purposes: ['LEGAL_OBLIGATION'], stores: ['mongo:policy_acceptances', 'mongo:builder_applications'], retentionToday: 'indéfinie', retentionTarget: 'durée du compte + 5 ans (preuve)' },
  whatsapp: { classification: 'L1', purposes: ['SERVICE_DELIVERY'], stores: ['mongo:whatsapp_*'], retentionToday: 'tant que le lien existe', retentionTarget: 'supprimé au retrait du lien' },
  technical_logs: { classification: 'L1', purposes: ['ACCOUNT_SECURITY', 'SERVICE_DELIVERY'], stores: ['stdout→Loki', 'logs/*.log'], retentionToday: 'rotation par taille (fichiers) ; Loki selon sa config', retentionTarget: '30 j (Loki), 90 j pour les paiements' },
  admin_audit: { classification: 'L1', purposes: ['ACCOUNT_SECURITY', 'LEGAL_OBLIGATION'], stores: ['mongo:admin_audit_log'], retentionToday: '1 an (index TTL)', retentionTarget: '1 an' },
};

/**
 * Sous-traitants. `maxClassification` = le niveau le plus élevé qu'on accepte de leur
 * transmettre ; `transmission` = ce que le garde exige à chaque requête.
 */
export interface Processor {
  name: string;
  role: string;
  maxClassification: Classification;
  /** Hors de l'infrastructure IDEM (transfert à encadrer). */
  external: boolean;
  /** Ce qui est connu de leur conservation / entraînement. */
  retention: string;
  trainsOnData: 'no' | 'no_when_configured' | 'unknown';
  /** Garanties contractuelles obtenues (DPA). */
  contract: 'signed' | 'terms_only' | 'missing';
  lastVerified: string;
}

export const PROCESSORS: Record<string, Processor> = {
  openrouter: {
    name: 'OpenRouter (et ses hébergeurs finaux)',
    role: 'Passerelle de tous les modèles IA (texte, image, vidéo, voix)',
    maxClassification: 'L2',
    external: true,
    retention:
      "IDEM impose `provider.data_collection: 'deny'` à CHAQUE requête (privacy-guard) : seuls les hébergeurs qui ne conservent pas les requêtes sont éligibles. `OPENROUTER_ZDR=on` restreint en plus aux hébergeurs à conservation nulle.",
    trainsOnData: 'no_when_configured',
    contract: 'terms_only',
    lastVerified: '2026-11-18',
  },
  idem_selfhosted: { name: 'Serveurs IA IDEM (IDEM_SELFHOSTED_*)', role: 'Inférence auto-hébergée', maxClassification: 'L2', external: false, retention: 'Pas de journal de requêtes à activer côté vLLM', trainsOnData: 'no', contract: 'signed', lastVerified: '2026-11-18' },
  supabase_selfhosted: { name: 'Supabase GoTrue (auto-hébergé)', role: 'Authentification', maxClassification: 'L3', external: false, retention: 'Infrastructure IDEM', trainsOnData: 'no', contract: 'signed', lastVerified: '2026-11-18' },
  minio_selfhosted: { name: 'MinIO (auto-hébergé)', role: 'Fichiers des projets', maxClassification: 'L2', external: false, retention: 'Infrastructure IDEM', trainsOnData: 'no', contract: 'signed', lastVerified: '2026-11-18' },
  pawapay: { name: 'pawaPay', role: 'Paiements mobile money', maxClassification: 'L3', external: true, retention: 'Obligations réglementaires du prestataire de paiement', trainsOnData: 'no', contract: 'terms_only', lastVerified: '2026-11-18' },
  smtp: { name: 'Fournisseur SMTP (SMTP_HOST)', role: 'E-mails transactionnels', maxClassification: 'L1', external: true, retention: 'À vérifier auprès du fournisseur', trainsOnData: 'unknown', contract: 'missing', lastVerified: '2026-11-18' },
  meta_whatsapp: { name: 'Meta (WhatsApp Cloud API, Facebook)', role: 'Propositions par WhatsApp, publication sociale', maxClassification: 'L1', external: true, retention: 'Politique Meta', trainsOnData: 'unknown', contract: 'terms_only', lastVerified: '2026-11-18' },
  social_networks: { name: 'LinkedIn, X', role: 'Publication des visuels choisis par l’utilisateur', maxClassification: 'L0', external: true, retention: 'Contenu publié volontairement', trainsOnData: 'unknown', contract: 'terms_only', lastVerified: '2026-11-18' },
  github: { name: 'GitHub', role: 'Connexion de dépôts (à l’initiative de l’utilisateur)', maxClassification: 'L2', external: true, retention: 'Dépôts de l’utilisateur', trainsOnData: 'unknown', contract: 'terms_only', lastVerified: '2026-11-18' },
  pexels: { name: 'Pexels', role: 'Photos d’illustration (requête = mots-clés seulement)', maxClassification: 'L1', external: true, retention: 'Requêtes de recherche', trainsOnData: 'unknown', contract: 'terms_only', lastVerified: '2026-11-18' },
  domain_registrar: { name: 'Registraire de domaines (iDomain)', role: 'Achat de noms de domaine', maxClassification: 'L1', external: true, retention: 'Données WHOIS exigées par le registre', trainsOnData: 'no', contract: 'terms_only', lastVerified: '2026-11-18' },
  google_analytics: { name: 'Google Analytics 4 (landing seulement)', role: 'Mesure d’audience du site public', maxClassification: 'L1', external: true, retention: 'Selon réglage GA (à fixer à 2 mois)', trainsOnData: 'unknown', contract: 'terms_only', lastVerified: '2026-11-18' },
};

/** Le sous-traitant peut-il recevoir des données de ce niveau ? */
export function processorAccepts(processorId: string, classification: Classification): boolean {
  const processor = PROCESSORS[processorId];
  return !!processor && CLASSIFICATION_RANK[classification] <= CLASSIFICATION_RANK[processor.maxClassification];
}

/** La finalité peut-elle traiter des données de ce niveau, et sans consentement ? */
export function purposeAllows(purpose: Purpose, classification: Classification): boolean {
  const def = PURPOSES[purpose];
  return def.status === 'active' && !def.requiresConsent && CLASSIFICATION_RANK[classification] <= CLASSIFICATION_RANK[def.maxClassification];
}

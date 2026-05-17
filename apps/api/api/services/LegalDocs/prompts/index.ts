import { LegalDocumentType } from '../../../models/legalDocs.model';
import { LEGAL_DOC_SHARED_RULES } from './_shared.prompt';

/**
 * Returns the document-specific prompt body for a given legal document type.
 * Each prompt lists the mandatory articles/sections required for the document.
 */
export function getLegalDocPrompt(type: LegalDocumentType): string {
  const prompt = DOC_TYPE_SPECS[type];
  if (!prompt) {
    throw new Error(`Unsupported legal document type: ${type}`);
  }
  return `${prompt}\n\n${LEGAL_DOC_SHARED_RULES}\n\nPROJECT AND CONTEXT DATA:`;
}

const DOC_TYPE_SPECS: Record<LegalDocumentType, string> = {
  statuts_sarl: `
ROLE: Draft the STATUTS of a limited liability company (SARL / OHADA Uniform Act, adaptable to common law LLC).
MANDATORY ARTICLES:
- Preamble with founders identification
- Article 1 — FORME
- Article 2 — OBJET SOCIAL
- Article 3 — DÉNOMINATION SOCIALE
- Article 4 — SIÈGE SOCIAL
- Article 5 — DURÉE
- Article 6 — APPORTS
- Article 7 — CAPITAL SOCIAL
- Article 8 — PARTS SOCIALES
- Article 9 — CESSION DE PARTS
- Article 10 — GÉRANCE
- Article 11 — DÉCISIONS COLLECTIVES
- Article 12 — EXERCICE SOCIAL & COMPTES
- Article 13 — AFFECTATION DES RÉSULTATS
- Article 14 — DISSOLUTION & LIQUIDATION
- Article 15 — CONTESTATIONS
- Signature block for each associé
`,
  statuts_sas: `
ROLE: Draft the STATUTS of a simplified joint-stock company (SAS in France / equivalent in OHADA).
MANDATORY ARTICLES:
- Préambule
- Article 1 — FORME
- Article 2 — OBJET
- Article 3 — DÉNOMINATION
- Article 4 — SIÈGE
- Article 5 — DURÉE
- Article 6 — APPORTS
- Article 7 — CAPITAL SOCIAL & ACTIONS
- Article 8 — CESSION & TRANSMISSION DES ACTIONS
- Article 9 — PRÉSIDENT
- Article 10 — DÉCISIONS COLLECTIVES
- Article 11 — COMMISSAIRE AUX COMPTES
- Article 12 — EXERCICE SOCIAL
- Article 13 — AFFECTATION DES BÉNÉFICES
- Article 14 — DISSOLUTION
- Article 15 — LITIGES
- Signature block
`,
  pacte_associes: `
ROLE: Draft a SHAREHOLDERS AGREEMENT (pacte d’associés) covering governance and liquidity.
MANDATORY SECTIONS:
- Préambule & parties
- Durée du pacte
- Gouvernance (conseil, décisions réservées)
- Droit de préemption
- Droit de sortie conjointe (tag-along)
- Droit de sortie forcée (drag-along)
- Clause d’inaliénabilité temporaire
- Non-concurrence / Non-sollicitation
- Confidentialité
- Résolution des litiges (médiation puis arbitrage CCJA si OHADA)
- Durée, modification, signatures
`,
  cgu: `
ROLE: Draft TERMS OF USE (CGU) for an online platform.
MANDATORY SECTIONS:
- Objet
- Acceptation
- Description du Service
- Compte utilisateur (inscription, obligations, suspension)
- Propriété intellectuelle
- Données personnelles (renvoi à la Politique de Confidentialité)
- Responsabilité et exclusions
- Disponibilité, maintenance, évolutions
- Résiliation
- Loi applicable & juridiction
- Contact
`,
  cgv: `
ROLE: Draft TERMS OF SALE (CGV) for goods or services.
MANDATORY SECTIONS:
- Objet
- Commandes
- Prix & modalités de paiement (mobile money, carte, virement bancaire)
- Livraison / Exécution
- Droit de rétractation (si applicable selon le pays)
- Garanties
- Réclamations & SAV
- Responsabilité
- Force majeure
- Protection des données
- Loi applicable & juridiction compétente
`,
  privacy_policy: `
ROLE: Draft a PRIVACY POLICY compliant with local data protection regulations (RGPD EU when applicable, and African local laws: Loi n°2013-450 (Côte d’Ivoire), Loi n°2017-20 (Bénin), POPIA (Afrique du Sud), NDPR (Nigeria), etc.).
MANDATORY SECTIONS:
- Responsable de traitement
- Catégories de données collectées
- Finalités
- Bases légales
- Durées de conservation
- Destinataires
- Transferts hors du pays (et garanties)
- Droits des personnes (accès, rectification, suppression, opposition, portabilité)
- Cookies (si applicable)
- Sécurité
- Contact DPO / délégué
- Autorité de contrôle compétente
`,
  nda: `
ROLE: Draft a mutual NON-DISCLOSURE AGREEMENT (NDA).
MANDATORY SECTIONS:
- Parties
- Objet
- Définition des Informations Confidentielles
- Exclusions
- Obligations de confidentialité
- Durée de l’obligation (ex: 3 à 5 ans après la fin des échanges)
- Destruction / restitution
- Sanctions en cas de manquement
- Loi applicable & juridiction
- Signatures
`,
  employment_contract: `
ROLE: Draft an EMPLOYMENT CONTRACT (CDI par défaut).
MANDATORY SECTIONS:
- Parties (Employeur / Salarié)
- Engagement & date d’entrée
- Période d’essai
- Fonctions & responsabilités
- Lieu de travail
- Durée du travail
- Rémunération (salaire brut, primes, avantages)
- Congés payés
- Confidentialité
- Non-concurrence (si pertinent et loi locale autorise)
- Résiliation (préavis, indemnités)
- Loi applicable & juridiction
- Signatures
`,
  service_contract: `
ROLE: Draft a SERVICE CONTRACT (prestation B2B).
MANDATORY SECTIONS:
- Parties
- Objet & Périmètre (annexe descriptive si pertinent)
- Durée & reconduction
- Obligations du Prestataire
- Obligations du Client
- Prix & modalités de paiement
- Propriété intellectuelle sur les livrables
- Confidentialité
- Sous-traitance
- Responsabilité & plafonds
- Force majeure
- Résiliation (fautive, convenance, manquement)
- Loi applicable & juridiction
- Signatures
`,
  internal_regulations: `
ROLE: Draft INTERNAL REGULATIONS (règlement intérieur) for a company.
MANDATORY SECTIONS:
- Champ d’application
- Discipline générale
- Hygiène & sécurité au travail
- Usage des outils informatiques & télétravail
- Harcèlement & non-discrimination
- Procédure disciplinaire (entretien, sanctions)
- Respect de la confidentialité
- Date d’entrée en vigueur
- Modalités de révision
- Affichage / remise au salarié
`,
  legal_mentions: `
ROLE: Draft a LEGAL NOTICE (mentions légales) page for a website or service.
MANDATORY SECTIONS:
- Éditeur (dénomination, forme, capital, RCCM / SIRET, siège, représentant légal)
- Directeur de la publication
- Hébergeur (nom, adresse, contact) — indiquer [À COMPLÉTER] si non fourni
- Contact
- Propriété intellectuelle
- Données personnelles (renvoi à la politique de confidentialité)
- Cookies (renvoi)
- Loi applicable
`,
};

import { ProjectSectionKey } from '../../models/revision.model';

/**
 * Règles de cohérence entre sections d'un projet. Une règle lie deux sections
 * dont les contenus doivent rester alignés ; `contract` décrit à l'IA ce que
 * "cohérent" signifie pour cette paire (c'est le cahier des charges de l'audit).
 *
 * Pour ajouter une paire synchronisée (ex: branding ↔ landing), ajouter une
 * règle ici — la détection, les alertes et l'API suivent automatiquement.
 */
export interface CoherenceRule {
  id: string;
  sections: [ProjectSectionKey, ProjectSectionKey];
  /** Ce que signifie "cohérent" pour cette paire — injecté dans le prompt d'audit. */
  contract: string;
  /** Propose l'autofill Finance quand la section finance est vide/incomplète. */
  supportsFinanceAutofill: boolean;
}

export const COHERENCE_RULES: CoherenceRule[] = [
  {
    id: 'businessPlan-finance',
    sections: ['businessPlan', 'finance'],
    contract: [
      'Le business plan et les prévisions financières décrivent la MÊME réalité économique.',
      "- Le modèle de revenu du business plan (produits/services, prix, abonnements, commissions) doit se retrouver dans les produits et paramètres de revenus du module Finance.",
      '- Les montants (prix, budgets, investissements, financements) cités dans le business plan doivent correspondre aux valeurs du module Finance.',
      "- Les charges décrites dans le business plan (équipe, marketing, infrastructure) doivent avoir leur pendant dans les charges fixes/variables du module Finance.",
      "- Si le module Finance est vide ou très incomplet alors que le business plan définit un modèle économique, c'est une incohérence majeure (recommander l'autofill).",
    ].join('\n'),
    supportsFinanceAutofill: true,
  },
  {
    id: 'overview-businessPlan',
    sections: ['overview', 'businessPlan'],
    contract: [
      "La fiche projet (overview) et le business plan doivent raconter la même histoire :",
      '- même positionnement, même cible, même périmètre ;',
      "- les contraintes et le budget de la fiche projet ne doivent pas contredire le business plan.",
    ].join('\n'),
    supportsFinanceAutofill: false,
  },
];

export function rulesForSection(section: ProjectSectionKey): CoherenceRule[] {
  return COHERENCE_RULES.filter((r) => r.sections.includes(section));
}

export function getRule(ruleId: string): CoherenceRule | undefined {
  return COHERENCE_RULES.find((r) => r.id === ruleId);
}

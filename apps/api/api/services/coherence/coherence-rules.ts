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
      'The business plan and the financial projections describe the SAME economic reality.',
      '- The revenue model in the business plan (products, services, prices, subscriptions, commissions) must be reflected in the products and revenue parameters of the Finance module.',
      '- The amounts quoted in the business plan (prices, budgets, investments, funding) must match the values in the Finance module.',
      '- The charges described in the business plan (team, marketing, infrastructure) must have their counterpart in the fixed and variable charges of the Finance module.',
      '- If the Finance module is empty or very incomplete while the business plan defines an economic model, that is a major inconsistency (recommend the autofill).',
    ].join('\n'),
    supportsFinanceAutofill: true,
  },
  {
    id: 'overview-businessPlan',
    sections: ['overview', 'businessPlan'],
    contract: [
      'The project record (overview) and the business plan must tell the same story:',
      '- same positioning, same target, same scope;',
      '- the constraints and budget in the project record must not contradict the business plan.',
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

export type AdvisorMessageRole = 'user' | 'assistant' | 'system';

/**
 * Intent finance attaché à un message assistant lorsque le message demande
 * une confirmation à l'utilisateur (modification du module Finance).
 * Le frontend peut alors afficher des boutons "Confirmer / Annuler".
 */
export interface AdvisorPendingFinanceIntent {
  isFinanceIntent: true;
  kind: 'update_field' | 'add_line' | 'delete_line';
  section: string;
  target?: string | null;
  fieldPath?: string | null;
  value?: number | string | null;
  month?: number | null;
  year?: number | null;
}

export interface AdvisorMessage {
  id: string;
  role: AdvisorMessageRole;
  content: string;
  createdAt: Date;
  /** Présent uniquement sur les messages assistant en attente de confirmation finance */
  pendingFinanceIntent?: AdvisorPendingFinanceIntent;
  /** Présent lorsqu'une modification finance a été appliquée à la suite d'une confirmation */
  appliedFinanceIntent?: AdvisorPendingFinanceIntent;
}

/**
 * @openapi
 * components:
 *   schemas:
 *     AdvisorConversationModel:
 *       type: object
 *       properties:
 *         messages:
 *           type: array
 *           items:
 *             type: object
 *         updatedAt:
 *           type: string
 *           format: date-time
 */
export interface AdvisorConversationModel {
  messages: AdvisorMessage[];
  updatedAt?: Date;
}

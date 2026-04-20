export type AdvisorMessageRole = 'user' | 'assistant' | 'system';

export interface AdvisorMessage {
  id: string;
  role: AdvisorMessageRole;
  content: string;
  createdAt: Date;
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

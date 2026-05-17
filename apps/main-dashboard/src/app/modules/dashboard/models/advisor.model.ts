export type AdvisorMessageRole = 'user' | 'assistant' | 'system';

/** Intent finance attaché à un message en attente de confirmation utilisateur */
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
  createdAt: Date | string;
  pendingFinanceIntent?: AdvisorPendingFinanceIntent;
  appliedFinanceIntent?: AdvisorPendingFinanceIntent;
}

export interface AdvisorConversationModel {
  messages: AdvisorMessage[];
  updatedAt?: Date | string;
}

export interface AdvisorReplyResult {
  userMessage: AdvisorMessage;
  assistantMessage: AdvisorMessage;
  conversation: AdvisorConversationModel;
}

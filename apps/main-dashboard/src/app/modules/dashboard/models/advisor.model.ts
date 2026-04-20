export type AdvisorMessageRole = 'user' | 'assistant' | 'system';

export interface AdvisorMessage {
  id: string;
  role: AdvisorMessageRole;
  content: string;
  createdAt: Date | string;
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

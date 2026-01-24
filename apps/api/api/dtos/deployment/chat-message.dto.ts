export interface ChatMessageDto {
  sender: 'user' | 'ai';
  text: string;
}

export interface UpdateChatMessagesDto {
  messages: ChatMessageDto[];
}

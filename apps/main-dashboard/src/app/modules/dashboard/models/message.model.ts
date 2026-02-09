/**
 * Represents a chat message with content and metadata
 */
export interface Message {
  /**
   * Unique identifier for the message
   * @example "msg_1234abcd"
   */
  id: string;

  /**
   * When the message was created
   */
  createdAt?: Date;

  /**
   * The text content of the message
   * @example "Hello! How can I help you today?"
   */
  content: string;

  /**
   * The sender's role in the conversation
   */
  role: 'system' | 'user' | 'assistant';

  /**
   * Files or media attached to the message
   */
  attachments?: {
    /**
     * Type of attachment (image, document, etc.)
     * @example "image/png"
     */
    type: string;

    /**
     * URL or reference to the attachment
     * @example "https://example.com/file.png"
     */
    url: string;

    /**
     * Optional display name
     */
    name?: string;
  }[];

  /**
   * Additional structured data
   */
  metadata?: {
    [key: string]: unknown;
  };
}

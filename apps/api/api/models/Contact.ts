export interface Contact {
  id: string;
  name: string;
  email: string;
  company?: string;
  subject: string;
  message: string;
  status: 'new' | 'read' | 'replied' | 'closed';
  createdAt: Date;
  updatedAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

export interface CreateContactRequest {
  name: string;
  email: string;
  company?: string;
  subject: string;
  message: string;
}

export interface ContactResponse {
  success: boolean;
  message: string;
  contactId?: string;
}

export const CONTACT_SUBJECTS = [
  'general',
  'demo',
  'enterprise',
  'partnership',
  'support',
  'billing',
] as const;

export type ContactSubject = (typeof CONTACT_SUBJECTS)[number];

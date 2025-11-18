import { CreateContactRequest, CONTACT_SUBJECTS } from '../models/Contact';

export class ContactDto {
  name: string;
  email: string;
  company?: string;
  subject: string;
  message: string;

  constructor(data: CreateContactRequest) {
    this.name = data.name;
    this.email = data.email;
    this.company = data.company;
    this.subject = data.subject;
    this.message = data.message;
  }

  validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate name
    if (!this.name || this.name.trim().length < 2) {
      errors.push('Name must be at least 2 characters long');
    }
    if (this.name && this.name.length > 100) {
      errors.push('Name must be less than 100 characters');
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!this.email || !emailRegex.test(this.email)) {
      errors.push('Valid email address is required');
    }
    if (this.email && this.email.length > 255) {
      errors.push('Email must be less than 255 characters');
    }

    // Validate company (optional)
    if (this.company && this.company.length > 100) {
      errors.push('Company name must be less than 100 characters');
    }

    // Validate subject
    if (!this.subject || !CONTACT_SUBJECTS.includes(this.subject as any)) {
      errors.push(`Subject must be one of: ${CONTACT_SUBJECTS.join(', ')}`);
    }

    // Validate message
    if (!this.message || this.message.trim().length < 10) {
      errors.push('Message must be at least 10 characters long');
    }
    if (this.message && this.message.length > 5000) {
      errors.push('Message must be less than 5000 characters');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  sanitize(): ContactDto {
    return new ContactDto({
      name: this.name?.trim(),
      email: this.email?.trim().toLowerCase(),
      company: this.company?.trim() || undefined,
      subject: this.subject?.trim(),
      message: this.message?.trim(),
    });
  }
}

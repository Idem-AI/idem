import { v4 as uuidv4 } from 'uuid';
import { Contact, CreateContactRequest, ContactResponse } from '../models/Contact';
import { ContactDto } from '../dtos/ContactDto';
import { EmailService } from './EmailService';

export class ContactService {
  private emailService: EmailService;
  private contacts: Map<string, Contact> = new Map(); // In-memory storage for demo

  constructor() {
    this.emailService = new EmailService();
  }

  async createContact(
    data: CreateContactRequest,
    ipAddress?: string,
    userAgent?: string
  ): Promise<ContactResponse> {
    try {
      // Validate and sanitize input
      const contactDto = new ContactDto(data).sanitize();
      const validation = contactDto.validate();

      if (!validation.isValid) {
        return {
          success: false,
          message: `Validation failed: ${validation.errors.join(', ')}`,
        };
      }

      // Create contact object
      const contact: Contact = {
        id: uuidv4(),
        name: contactDto.name,
        email: contactDto.email,
        company: contactDto.company,
        subject: contactDto.subject,
        message: contactDto.message,
        status: 'new',
        createdAt: new Date(),
        updatedAt: new Date(),
        ipAddress,
        userAgent,
      };

      // Save to storage (in-memory for demo)
      this.contacts.set(contact.id, contact);

      // Send notification email to contact@idem.africa
      try {
        await this.emailService.sendContactNotification(contact);
        console.log(`✅ Notification email sent for contact ${contact.id}`);
      } catch (emailError) {
        console.error('❌ Failed to send notification email:', emailError);
        // Don't fail the entire request if email fails
      }

      // Send auto-reply to user
      try {
        await this.emailService.sendAutoReply(contact);
        console.log(`✅ Auto-reply sent to ${contact.email}`);
      } catch (emailError) {
        console.error('❌ Failed to send auto-reply:', emailError);
        // Don't fail the entire request if email fails
      }

      return {
        success: true,
        message: 'Message sent successfully! We will get back to you within 24 hours.',
        contactId: contact.id,
      };
    } catch (error) {
      console.error('❌ Error creating contact:', error);
      return {
        success: false,
        message: 'An error occurred while sending your message. Please try again later.',
      };
    }
  }

  async getContact(id: string): Promise<Contact | null> {
    return this.contacts.get(id) || null;
  }

  async getAllContacts(): Promise<Contact[]> {
    return Array.from(this.contacts.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  async updateContactStatus(id: string, status: Contact['status']): Promise<boolean> {
    const contact = this.contacts.get(id);
    if (!contact) return false;

    contact.status = status;
    contact.updatedAt = new Date();
    this.contacts.set(id, contact);
    return true;
  }

  // Rate limiting helper
  private static contactAttempts: Map<string, { count: number; lastAttempt: Date }> = new Map();

  static isRateLimited(ipAddress: string): boolean {
    const now = new Date();
    const attempts = this.contactAttempts.get(ipAddress);

    if (!attempts) {
      this.contactAttempts.set(ipAddress, { count: 1, lastAttempt: now });
      return false;
    }

    // Reset counter if more than 1 hour has passed
    if (now.getTime() - attempts.lastAttempt.getTime() > 60 * 60 * 1000) {
      this.contactAttempts.set(ipAddress, { count: 1, lastAttempt: now });
      return false;
    }

    // Allow max 5 attempts per hour
    if (attempts.count >= 5) {
      return true;
    }

    attempts.count++;
    attempts.lastAttempt = now;
    this.contactAttempts.set(ipAddress, attempts);
    return false;
  }
}

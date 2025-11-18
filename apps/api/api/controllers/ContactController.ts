import { Request, Response } from 'express';
import { ContactService } from '../services/ContactService';
import { CreateContactRequest } from '../models/Contact';

export class ContactController {
  private contactService: ContactService;

  constructor() {
    this.contactService = new ContactService();
  }

  /**
   * @swagger
   * /api/contact:
   *   post:
   *     summary: Submit a contact form
   *     tags: [Contact]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - name
   *               - email
   *               - subject
   *               - message
   *             properties:
   *               name:
   *                 type: string
   *                 minLength: 2
   *                 maxLength: 100
   *                 example: "John Doe"
   *               email:
   *                 type: string
   *                 format: email
   *                 maxLength: 255
   *                 example: "john@example.com"
   *               company:
   *                 type: string
   *                 maxLength: 100
   *                 example: "Acme Corp"
   *               subject:
   *                 type: string
   *                 enum: [general, demo, enterprise, partnership, support, billing]
   *                 example: "general"
   *               message:
   *                 type: string
   *                 minLength: 10
   *                 maxLength: 5000
   *                 example: "I'm interested in learning more about IDEM..."
   *     responses:
   *       200:
   *         description: Message sent successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 message:
   *                   type: string
   *                 contactId:
   *                   type: string
   *       400:
   *         description: Validation error
   *       429:
   *         description: Rate limit exceeded
   *       500:
   *         description: Server error
   */
  async createContact(req: Request, res: Response): Promise<void> {
    try {
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      // Check rate limiting
      if (ContactService.isRateLimited(ipAddress)) {
        res.status(429).json({
          success: false,
          message: 'Too many contact attempts. Please try again later.',
        });
        return;
      }

      const contactData: CreateContactRequest = {
        name: req.body.name,
        email: req.body.email,
        company: req.body.company,
        subject: req.body.subject,
        message: req.body.message,
      };

      const result = await this.contactService.createContact(contactData, ipAddress, userAgent);

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error('❌ Error in createContact:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }

  /**
   * @swagger
   * /api/contact/{id}:
   *   get:
   *     summary: Get a contact by ID (admin only)
   *     tags: [Contact]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Contact found
   *       404:
   *         description: Contact not found
   */
  async getContact(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const contact = await this.contactService.getContact(id);

      if (!contact) {
        res.status(404).json({
          success: false,
          message: 'Contact not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: contact,
      });
    } catch (error) {
      console.error('❌ Error in getContact:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }

  /**
   * @swagger
   * /api/contact:
   *   get:
   *     summary: Get all contacts (admin only)
   *     tags: [Contact]
   *     responses:
   *       200:
   *         description: List of contacts
   */
  async getAllContacts(req: Request, res: Response): Promise<void> {
    try {
      const contacts = await this.contactService.getAllContacts();

      res.status(200).json({
        success: true,
        data: contacts,
        count: contacts.length,
      });
    } catch (error) {
      console.error('❌ Error in getAllContacts:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }

  /**
   * @swagger
   * /api/contact/{id}/status:
   *   patch:
   *     summary: Update contact status (admin only)
   *     tags: [Contact]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               status:
   *                 type: string
   *                 enum: [new, read, replied, closed]
   *     responses:
   *       200:
   *         description: Status updated
   *       404:
   *         description: Contact not found
   */
  async updateContactStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const updated = await this.contactService.updateContactStatus(id, status);

      if (!updated) {
        res.status(404).json({
          success: false,
          message: 'Contact not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Contact status updated successfully',
      });
    } catch (error) {
      console.error('❌ Error in updateContactStatus:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }
}

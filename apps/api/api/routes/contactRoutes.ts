import { Router } from 'express';
import { ContactController } from '../controllers/ContactController';
import { requireAdminAccess } from '../middleware/super-user.middleware';
import { rateLimitByIP } from '../middleware/rate-limit.middleware';

const router = Router();
const contactController = new ContactController();

// Public route - Submit contact form (limité pour éviter le spam de masse)
router.post(
  '/',
  rateLimitByIP({ windowMs: 60 * 60 * 1000, maxRequests: 10, keyPrefix: 'ratelimit:contact' }),
  (req, res) => contactController.createContact(req, res)
);

// Admin routes : messages et coordonnées des visiteurs, jamais publics.
router.get('/', requireAdminAccess, (req, res) => contactController.getAllContacts(req, res));
router.get('/:id', requireAdminAccess, (req, res) => contactController.getContact(req, res));
router.patch('/:id/status', requireAdminAccess, (req, res) =>
  contactController.updateContactStatus(req, res)
);

export default router;

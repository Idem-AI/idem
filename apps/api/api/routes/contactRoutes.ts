import { Router } from 'express';
import { ContactController } from '../controllers/ContactController';

const router = Router();
const contactController = new ContactController();

// Public route - Submit contact form
router.post('/', (req, res) => contactController.createContact(req, res));

// Admin routes (would need authentication middleware in production)
router.get('/', (req, res) => contactController.getAllContacts(req, res));
router.get('/:id', (req, res) => contactController.getContact(req, res));
router.patch('/:id/status', (req, res) => contactController.updateContactStatus(req, res));

export default router;

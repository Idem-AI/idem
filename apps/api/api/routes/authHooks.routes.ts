import { Router } from 'express';
import { authSendEmailHookController } from '../controllers/authEmailHook.controller';

/**
 * Hooks appelés par le serveur d'authentification (GoTrue), signés
 * (Standard Webhooks). Montés avant la limite par IP : tous les appels
 * viennent de la même adresse, celle du serveur d'authentification.
 */
export const authHooksRoutes = Router();

authHooksRoutes.post('/send-email', authSendEmailHookController);

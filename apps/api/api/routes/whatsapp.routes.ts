import { Request, Response, Router } from 'express';
import whatsappController from '../controllers/whatsapp.controller';
import { authenticate } from '../services/auth.service';
import { verifyApiKey } from '../middleware/verifyApiKey';
import { rateLimitByIP, rateLimitByUser } from '../middleware/rate-limit.middleware';

/**
 * Publier depuis WhatsApp.
 *
 *  - `/whatsapp/webhook`  : Meta (signature HMAC du corps brut, jeton d'abonnement) ;
 *  - `/whatsapp/*`        : utilisateur connecté (liaison, réglages, historique) ;
 *  - `/social/*`          : connexion des réseaux sociaux (OAuth) ;
 *  - `/whatsapp/internal` : clé de service.
 */
export const whatsappRoutes = Router();
export const socialRoutes = Router();

const wrap = (fn: (req: any, res: Response) => Promise<void> | void) => (req: Request, res: Response) => {
  Promise.resolve(fn(req, res)).catch(() => {
    if (!res.headersSent) res.status(500).json({ error: 'internal_error' });
  });
};

const linkLimit = rateLimitByUser({ windowMs: 60_000, maxRequests: 5, keyPrefix: 'ratelimit:wa-link' });

// Webhook : limite par IP large (Meta envoie en rafale) ; la signature est le vrai contrôle.
whatsappRoutes.get('/webhook', rateLimitByIP({ windowMs: 60_000, maxRequests: 60, keyPrefix: 'ratelimit:wa-verify' }), whatsappController.verify);
whatsappRoutes.post('/webhook', rateLimitByIP({ windowMs: 60_000, maxRequests: 600, keyPrefix: 'ratelimit:wa-webhook' }), whatsappController.receive);

whatsappRoutes.get('/status', authenticate, wrap(whatsappController.status));
whatsappRoutes.post('/link', authenticate, linkLimit, wrap(whatsappController.startLink));
whatsappRoutes.delete('/link', authenticate, wrap(whatsappController.unlink));
whatsappRoutes.put('/settings', authenticate, wrap(whatsappController.updateSettings));
whatsappRoutes.get('/history', authenticate, wrap(whatsappController.history));
whatsappRoutes.post('/internal/run', verifyApiKey, wrap(whatsappController.internalRun));

socialRoutes.get('/accounts', authenticate, wrap(whatsappController.accounts));
socialRoutes.get('/:network/connect', authenticate, wrap(whatsappController.connect));
// Retour d'OAuth : pas de session (c'est le réseau qui redirige) ; l'état chiffré fait foi.
socialRoutes.get('/:network/callback', rateLimitByIP({ windowMs: 60_000, maxRequests: 30, keyPrefix: 'ratelimit:social-cb' }), wrap(whatsappController.callback));
socialRoutes.delete('/:network', authenticate, wrap(whatsappController.disconnect));

export default whatsappRoutes;

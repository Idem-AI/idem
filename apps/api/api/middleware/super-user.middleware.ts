import { NextFunction, Response } from 'express';
import { CustomRequest } from '../interfaces/express.interface';
import { isSuperUser } from '../utils/super-user.util';
import { verifyApiKey } from './verifyApiKey';
import { authenticate } from '../services/auth.service';

/**
 * Réserve une route aux super users (`ADMIN_EMAILS`).
 *
 * À placer après `authenticate`. L'email lu est celui du jeton vérifié, jamais
 * une valeur fournie par le client.
 */
export function requireSuperUser(req: CustomRequest, res: Response, next: NextFunction): void {
  const email = (req.user as { email?: string } | undefined)?.email;
  if (!req.user?.uid) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  // Une adresse non vérifiée ne prouve rien : n'importe qui peut créer un
  // compte e-mail/mot de passe avec l'adresse d'un administrateur.
  const verified = (req.user as { email_verified?: boolean } | undefined)?.email_verified === true;
  if (!email || !verified || !isSuperUser(email)) {
    res.status(403).json({ message: 'Forbidden: administrator only' });
    return;
  }
  next();
}

/**
 * Accès administrateur : clé interne (`X-API-Key`, panel d'administration
 * serveur à serveur) OU session d'un super user.
 */
export function requireAdminAccess(req: CustomRequest, res: Response, next: NextFunction): void {
  if (req.headers['x-api-key']) {
    verifyApiKey(req, res, next);
    return;
  }
  void authenticate(req, res, () => requireSuperUser(req, res, next));
}

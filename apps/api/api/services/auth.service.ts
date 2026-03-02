import { Response, NextFunction, CookieOptions } from 'express';
import { CustomRequest } from '../interfaces/express.interface';
import logger from '../config/logger';
import { refreshTokenService } from './refreshToken.service';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export const authenticateUser = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const sessionCookie = req.cookies.session;
  const refreshToken = req.cookies.refreshToken;
  const authHeader = req.headers.authorization;

  logger.info('Authenticating user', {
    hasSessionCookie: !!sessionCookie,
    hasRefreshToken: !!refreshToken,
    hasAuthHeader: !!authHeader,
  });

  // 1. Vérifier le session cookie JWT
  if (sessionCookie) {
    try {
      const decodedToken = jwt.verify(sessionCookie, JWT_SECRET) as any;
      req.user = decodedToken;
      logger.info(`User authenticated successfully via session cookie: ${decodedToken.uid}`);
      return next();
    } catch (error: any) {
      logger.warn('Session cookie verification failed', { error: error.message });

      // 2. Essayer de rafraîchir avec le refresh token
      if (refreshToken) {
        try {
          const validation = await refreshTokenService.validateRefreshToken(refreshToken);
          if (validation.isValid && validation.userId) {
            // Créer un nouveau session token
            const newSessionToken = jwt.sign(
              {
                uid: validation.userId,
                roles: ['user'],
              },
              JWT_SECRET,
              { expiresIn: '14d' }
            );

            const decodedToken = jwt.verify(newSessionToken, JWT_SECRET) as any;
            req.user = decodedToken;

            // Mettre à jour le cookie
            const expiresIn = 14 * 24 * 60 * 60 * 1000;
            const isProduction = process.env.NODE_ENV === 'production';
            const options: CookieOptions = {
              maxAge: expiresIn,
              httpOnly: true,
              secure: isProduction,
              sameSite: isProduction ? 'none' : 'lax',
              path: '/',
            };

            res.cookie('session', newSessionToken, options);
            logger.info(`Session refreshed automatically for user: ${validation.userId}`);
            return next();
          }
        } catch (refreshError: any) {
          logger.warn('Refresh token validation failed', { error: refreshError.message });
        }
      }
    }
  }

  // 3. Vérifier le Bearer token
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decodedToken = jwt.verify(token, JWT_SECRET) as any;
      req.user = decodedToken;
      logger.info(`User authenticated successfully via Bearer token: ${decodedToken.uid}`);
      return next();
    } catch (error: any) {
      logger.warn('Bearer token verification failed', { error: error.message });
    }
  }

  // Aucune méthode d'authentification valide
  logger.warn('Authentication failed: No valid credentials provided');
  res.status(401).json({
    success: false,
    message: 'Authentication required. Please login.',
  });
};

export const optionalAuth = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const sessionCookie = req.cookies.session;
  const authHeader = req.headers.authorization;

  if (sessionCookie) {
    try {
      const decodedToken = jwt.verify(sessionCookie, JWT_SECRET) as any;
      req.user = decodedToken;
      logger.info(`Optional auth: User identified as ${decodedToken.uid}`);
    } catch (error: any) {
      logger.debug('Optional auth: Session cookie invalid or expired');
    }
  } else if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decodedToken = jwt.verify(token, JWT_SECRET) as any;
      req.user = decodedToken;
      logger.info(`Optional auth: User identified via Bearer token as ${decodedToken.uid}`);
    } catch (error: any) {
      logger.debug('Optional auth: Bearer token invalid or expired');
    }
  }

  next();
};

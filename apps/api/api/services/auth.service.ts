import { Response, NextFunction, CookieOptions } from "express";
import admin from "firebase-admin";
import { CustomRequest } from "../interfaces/express.interface";
import logger from "../config/logger";
import { refreshTokenService } from "./refreshToken.service";

/**
 * Middleware to authenticate requests using Firebase Admin SDK.
 * It prioritizes session cookie authentication and falls back to Bearer token authentication.
 * If the token/cookie is valid, it attaches the decoded token (user information) to `req.user`.
 *
 * @param req - The custom request object, expected to extend Express's Request.
 * @param res - The response object from Express.
 * @param next - The next middleware function in the Express stack.
 */
export async function authenticate(
  req: CustomRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const sessionCookie = req.cookies.session;
  const authHeader = req.headers.authorization;

  // 1. Prioritize Session Cookie for authentication
  if (sessionCookie) {
    try {
      const decodedToken = await admin
        .auth()
        .verifySessionCookie(sessionCookie, true); // true checks for revocation
      req.user = decodedToken;
      logger.info(
        `User authenticated successfully via session cookie: ${decodedToken.uid}`
      );
      return next();
    } catch (error: any) {
      logger.error(`Error verifying session cookie: ${error.message}`, {
        stack: error.stack,
        details: error,
      });

      // Tenter de rafraîchir automatiquement le token si un refresh token est disponible
      const refreshToken = req.cookies.refreshToken;
      if (refreshToken) {
        try {
          const validation = await refreshTokenService.validateRefreshToken(
            refreshToken
          );
          if (validation.isValid && validation.userId) {
            // Créer un nouveau session cookie
            const customToken = await admin
              .auth()
              .createCustomToken(validation.userId);
            const expiresIn = 14 * 24 * 60 * 60 * 1000; // 14 jours
            const isProduction = process.env.NODE_ENV === "production";

            const newSessionCookie = await admin
              .auth()
              .createSessionCookie(customToken, { expiresIn });

            // Vérifier le nouveau cookie
            const decodedToken = await admin
              .auth()
              .verifySessionCookie(newSessionCookie, true);
            req.user = decodedToken;

            // Mettre à jour le cookie dans la réponse
            const options: CookieOptions = {
              maxAge: expiresIn,
              httpOnly: true,
              secure: isProduction,
              sameSite: isProduction ? "none" : "lax",
              path: "/",
            };
            res.cookie("session", newSessionCookie, options);

            logger.info(
              `Session cookie auto-refreshed for user: ${validation.userId}`
            );
            return next();
          }
        } catch (refreshError: any) {
          logger.error(`Error during auto-refresh: ${refreshError.message}`);
        }
      }

      // Si l'auto-refresh échoue, répondre avec une erreur
      res
        .status(403)
        .json({ message: "Forbidden: Invalid or expired session cookie" });
      return;
    }
  }

  // 2. Fallback to Bearer Token if no session cookie is present
  if (authHeader?.startsWith("Bearer ")) {
    const idToken = authHeader.split(" ")[1];
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      req.user = decodedToken;
      logger.info(
        `User authenticated successfully via Bearer token: ${decodedToken.uid}`
      );
      return next();
    } catch (error: any) {
      logger.error(`Error verifying Firebase ID token: ${error.message}`, {
        stack: error.stack,
        tokenUsed: idToken ? idToken.substring(0, 10) + "..." : "N/A",
        details: error,
      });
      res.status(403).json({ message: "Forbidden: Invalid or expired token" });
      return;
    }
  }

  // 3. If neither authentication method is successful
  logger.warn(
    "Authentication attempt failed: No session cookie or Bearer token provided."
  );
  res
    .status(401)
    .json({ message: "Unauthorized: No authentication credentials provided" });
}

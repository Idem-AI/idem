import { Request, Response, CookieOptions } from 'express';
import admin from 'firebase-admin';
import logger from '../config/logger'; // Assuming you have a Winston logger setup
import { userService } from '../services/user.service';
import { UserModel } from '../models/userModel';
import { refreshTokenService } from '../services/refreshToken.service';
import { CustomRequest } from '../interfaces/express.interface';
import { v4 as uuidv4 } from 'uuid';
import { safeEqual } from '../utils/safe-equal.util';
import { toPublicProfile } from '../utils/public-profile.util';
import RedisConnection from '../config/redis.config';
import {
  mintSessionCookie,
  refreshCookieOptions,
  SESSION_EXPIRES_IN,
  sessionCookieOptions,
} from '../services/sessionCookie.service';
export const sessionLoginController = async (req: Request, res: Response): Promise<void> => {
  const token = req.body.token;
  const user = req.body.user;

  if (!token || typeof token !== 'string') {
    logger.warn('Session login failed: No ID token provided.');
    res.status(400).send({ success: false, message: 'ID token is required.' });
    return;
  }

  // L'identité vient EXCLUSIVEMENT du jeton vérifié. `req.body.user` n'est
  // qu'une indication d'affichage : en tirer l'uid permettait d'ouvrir une
  // session (et un refresh token) au nom de n'importe quel autre compte.
  let decoded: admin.auth.DecodedIdToken;
  try {
    decoded = await admin.auth().verifyIdToken(token, true);
  } catch (error: any) {
    logger.warn(`Session login failed: invalid ID token (${error.message})`);
    res.status(401).send({ success: false, message: 'UNAUTHORIZED REQUEST!' });
    return;
  }

  if (!decoded.email) {
    res.status(400).send({ success: false, message: 'An email address is required.' });
    return;
  }

  logger.info('Attempting session login', { uid: decoded.uid });

  const userModel: UserModel = {
    uid: decoded.uid,
    email: decoded.email,
    subscription: 'free',
    createdAt: new Date(),
    lastLogin: new Date(),
    displayName:
      typeof user?.displayName === 'string' ? user.displayName : (decoded.name as string | undefined),
    photoURL:
      typeof user?.photoURL === 'string' ? user.photoURL : (decoded.picture as string | undefined),
    quota: {
      dailyUsage: 0,
      weeklyUsage: 0,
      dailyLimit: 0,
      weeklyLimit: 0,
      lastResetDaily: new Date().toISOString().split('T')[0],
      lastResetWeekly: new Date().toISOString().split('T')[0],
    },
    roles: ['user'],
  };
  const expiresIn = SESSION_EXPIRES_IN;

  try {
    const sessionCookie = await admin.auth().createSessionCookie(token, { expiresIn });

    res.cookie('session', sessionCookie, sessionCookieOptions());
    logger.info(`Session cookie created successfully for user ${userModel.uid}.`);
    const createdUser = await userService.createUser(userModel);
    if (!createdUser) {
      logger.warn(`User ${userModel.uid} not created.`);
      res.status(400).send({
        success: false,
        message: 'User not created.',
      });
      return;
    }

    // Générer un refresh token
    const deviceInfo = req.headers['user-agent'] || 'Unknown device';
    const ipAddress = req.ip || req.connection.remoteAddress || 'Unknown IP';

    const refreshTokenResult = await refreshTokenService.generateRefreshToken(
      userModel.uid,
      deviceInfo,
      ipAddress
    );

    res.cookie('refreshToken', refreshTokenResult.refreshToken, refreshCookieOptions());

    res.status(200).send({
      success: true,
      message: 'Session cookie created successfully.',
      // Le refresh token voyage uniquement en cookie httpOnly : le renvoyer
      // dans le corps le rendait lisible par n'importe quel script de la page.
      refreshTokenExpiresAt: refreshTokenResult.expiresAt,
    });
  } catch (error: any) {
    logger.error(`Error creating session cookie for user ${userModel.uid}:`, {
      errorMessage: error.message,
      errorStack: error.stack,
    });
    res.status(401).send({
      success: false,
      message: 'UNAUTHORIZED REQUEST! Error creating session cookie.',
    });
  }
};

/**
 * Contrôleur pour rafraîchir un token d'accès en utilisant un refresh token
 */
export const refreshTokenController = async (req: Request, res: Response): Promise<void> => {
  const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

  logger.info('Attempting to refresh access token', {
    hasRefreshToken: !!refreshToken,
    source: req.cookies.refreshToken ? 'cookie' : 'body',
  });

  if (!refreshToken) {
    logger.warn('Refresh token missing in request');
    res.status(400).send({
      success: false,
      message: 'Refresh token is required.',
    });
    return;
  }

  try {
    // Valider le refresh token
    const validation = await refreshTokenService.validateRefreshToken(refreshToken);

    if (!validation.isValid || !validation.userId) {
      logger.warn('Invalid refresh token provided');
      res.status(401).send({
        success: false,
        message: 'Invalid or expired refresh token.',
      });
      return;
    }

    // Le cookie `session` est justement expiré ici : on ne peut pas s'en servir
    // pour retrouver l'utilisateur, le refresh token suffit.
    const sessionCookie = await mintSessionCookie(validation.userId);
    res.cookie('session', sessionCookie, sessionCookieOptions());

    logger.info(`Access token refreshed successfully for user: ${validation.userId}`);

    res.status(200).send({
      success: true,
      message: 'Access token refreshed successfully.',
    });
  } catch (error: any) {
    logger.error('Error refreshing access token:', {
      errorMessage: error.message,
      errorStack: error.stack,
    });
    res.status(500).send({
      success: false,
      message: 'Internal server error during token refresh.',
    });
  }
};

/**
 * Contrôleur pour déconnecter un utilisateur (révoque le refresh token)
 */
export const logoutController = async (req: CustomRequest, res: Response): Promise<void> => {
  const userId = req.user?.uid;
  const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

  logger.info('Attempting user logout', {
    userId,
    hasRefreshToken: !!refreshToken,
  });

  if (!userId) {
    logger.warn('Logout attempt without authenticated user');
    res.status(401).send({
      success: false,
      message: 'User not authenticated.',
    });
    return;
  }

  try {
    // Révoquer le refresh token spécifique si fourni
    if (refreshToken) {
      await refreshTokenService.revokeRefreshToken(userId, refreshToken);
    }

    const isProduction = process.env.NODE_ENV === 'production';
    const clearOptions: CookieOptions = {
      path: '/',
      ...(isProduction && { domain: '.idem.africa' }),
    };

    // Supprimer les cookies
    res.clearCookie('session', clearOptions);
    res.clearCookie('refreshToken', clearOptions);

    logger.info(`User ${userId} logged out successfully`);

    res.status(200).send({
      success: true,
      message: 'Logged out successfully.',
    });
  } catch (error: any) {
    logger.error(`Error during logout for user ${userId}:`, {
      errorMessage: error.message,
      errorStack: error.stack,
    });
    res.status(500).send({
      success: false,
      message: 'Error during logout.',
    });
  }
};

/**
 * Contrôleur pour déconnecter un utilisateur de tous les appareils
 */
export const logoutAllController = async (req: CustomRequest, res: Response): Promise<void> => {
  const userId = req.user?.uid;

  logger.info('Attempting to logout user from all devices', { userId });

  if (!userId) {
    logger.warn('Logout all attempt without authenticated user');
    res.status(401).send({
      success: false,
      message: 'User not authenticated.',
    });
    return;
  }

  try {
    // Révoquer tous les refresh tokens
    await refreshTokenService.revokeAllRefreshTokens(userId);

    const isProduction = process.env.NODE_ENV === 'production';
    const clearOptions: CookieOptions = {
      path: '/',
      ...(isProduction && { domain: '.idem.africa' }),
    };

    // Supprimer les cookies de la session actuelle
    res.clearCookie('session', clearOptions);
    res.clearCookie('refreshToken', clearOptions);

    logger.info(`User ${userId} logged out from all devices successfully`);

    res.status(200).send({
      success: true,
      message: 'Logged out from all devices successfully.',
    });
  } catch (error: any) {
    logger.error(`Error during logout all for user ${userId}:`, {
      errorMessage: error.message,
      errorStack: error.stack,
    });
    res.status(500).send({
      success: false,
      message: 'Error during logout from all devices.',
    });
  }
};

/**
 * Contrôleur pour obtenir les informations des refresh tokens d'un utilisateur
 */
/**
 * Verify session cookie and return user data
 * This endpoint is used by Laravel to verify Firebase sessions
 */
export const verifySessionController = async (req: Request, res: Response): Promise<void> => {
  const sessionCookie = req.cookies.session || req.headers.authorization?.replace('Bearer ', '');

  logger.info('Verifying session for external service', {
    hasSessionCookie: !!sessionCookie,
    source: req.cookies.session ? 'cookie' : 'authorization header',
  });

  if (!sessionCookie) {
    logger.warn('Session verification failed: No session cookie provided');
    res.status(401).json({
      success: false,
      message: 'No session cookie provided',
    });
    return;
  }

  try {
    const profile = await userService.getUserProfile(sessionCookie);

    logger.info(`Session verified successfully for user: ${profile.uid}`);
    res.status(200).json({
      success: true,
      user: toPublicProfile(profile),
    });
  } catch (error: any) {
    logger.error('Session verification failed:', {
      errorMessage: error.message,
      errorStack: error.stack,
    });
    res.status(401).json({
      success: false,
      message: 'Invalid or expired session',
    });
  }
};

export const getRefreshTokensController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;

  logger.info('Getting refresh tokens info', { userId });

  if (!userId) {
    logger.warn('Get refresh tokens attempt without authenticated user');
    res.status(401).send({
      success: false,
      message: 'User not authenticated.',
    });
    return;
  }

  try {
    const refreshTokens = await refreshTokenService.getUserRefreshTokens(userId);

    logger.info(`Retrieved ${refreshTokens.length} refresh tokens for user: ${userId}`);

    res.status(200).send({
      success: true,
      refreshTokens,
    });
  } catch (error: any) {
    logger.error(`Error getting refresh tokens for user ${userId}:`, {
      errorMessage: error.message,
      errorStack: error.stack,
    });
    res.status(500).send({
      success: false,
      message: 'Error retrieving refresh tokens.',
    });
  }
};

const IDEPLOY_TOKEN_PREFIX = 'ideploy:token:';
const IDEPLOY_TOKEN_TTL = 5 * 60; // 5 minutes

/**
 * POST /auth/ideploy-token
 * Generates a short-lived one-time token for iDeploy SSO.
 * Called by main-dashboard after Firebase login when redirect=ideploy.
 */
export const generateIdeployTokenController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const uid = req.user?.uid;
  const email = req.user?.email;

  if (!uid) {
    res.status(401).json({ success: false, message: 'Unauthorized' });
    return;
  }

  try {
    const firebaseUser = await admin.auth().getUser(uid);
    const token = uuidv4();

    const payload = {
      uid,
      email: email || firebaseUser.email,
      displayName: firebaseUser.displayName || null,
      photoURL: firebaseUser.photoURL || null,
      createdAt: new Date().toISOString(),
    };

    const redis = RedisConnection.getInstance();
    await redis.set(
      `${IDEPLOY_TOKEN_PREFIX}${token}`,
      JSON.stringify(payload),
      'EX',
      IDEPLOY_TOKEN_TTL
    );

    logger.info('iDeploy SSO token generated', { uid });
    res.status(201).json({ success: true, token });
  } catch (error: any) {
    logger.error('Error generating iDeploy token:', { uid, message: error.message });
    res
      .status(500)
      .json({ success: false, message: 'Failed to generate token' });
  }
};

/**
 * POST /auth/ideploy-token/validate
 * Validates a one-time iDeploy SSO token and returns user data.
 * Called by iDeploy Laravel backend to verify the token.
 * Protected by IDEPLOY_SHARED_SECRET header.
 */
export const validateIdeployTokenController = async (
  req: Request,
  res: Response
): Promise<void> => {
  const sharedSecret = process.env.IDEPLOY_SHARED_SECRET;
  const providedSecret = req.headers['x-ideploy-secret'];

  // Fermé par défaut : sans secret configuré, n'importe qui aurait pu échanger
  // un jeton SSO intercepté contre l'identité de l'utilisateur.
  if (!sharedSecret) {
    logger.error('IDEPLOY_SHARED_SECRET is not configured: iDeploy SSO validation disabled');
    res.status(503).json({ success: false, message: 'SSO validation unavailable' });
    return;
  }
  if (typeof providedSecret !== 'string' || !safeEqual(providedSecret, sharedSecret)) {
    res.status(403).json({ success: false, message: 'Invalid secret' });
    return;
  }

  const { token } = req.body;
  if (!token || typeof token !== 'string') {
    res.status(400).json({ success: false, message: 'Token is required' });
    return;
  }

  try {
    const redis = RedisConnection.getInstance();
    const raw = await redis.get(`${IDEPLOY_TOKEN_PREFIX}${token}`);

    if (!raw) {
      res.status(401).json({ success: false, message: 'Token not found or expired' });
      return;
    }

    await redis.del(`${IDEPLOY_TOKEN_PREFIX}${token}`);
    const userData = JSON.parse(raw);

    logger.info('iDeploy SSO token validated', { uid: userData.uid });
    res.status(200).json({ success: true, user: userData });
  } catch (error: any) {
    logger.error('Error validating iDeploy token:', { message: error.message });
    res
      .status(500)
      .json({ success: false, message: 'Failed to validate token' });
  }
};

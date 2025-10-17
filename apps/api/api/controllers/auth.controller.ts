import { Request, Response, CookieOptions } from "express";
import admin from "firebase-admin";
import logger from "../config/logger"; // Assuming you have a Winston logger setup
import { userService } from "../services/user.service";
import { UserModel } from "../models/userModel";
import { refreshTokenService } from "../services/refreshToken.service";
import { CustomRequest } from "../interfaces/express.interface";
export const sessionLoginController = async (
  req: Request,
  res: Response
): Promise<void> => {
  const token = req.body.token;
  const user = req.body.user;

  logger.info(`Attempting session login for user associated with token`, {
    user,
    body: req.body,
  });

  if (!token) {
    logger.warn(
      `Session login failed: No ID token provided.`,
      { hasUser: !!user, userUid: user?.uid }
    );
    res.status(400).send({ success: false, message: "ID token is required." });
    return;
  }

  if (!user) {
    logger.warn("Session login failed: No user data provided.");
    res.status(400).send({ success: false, message: "User data is required." });
    return;
  }
  const userModel: UserModel = {
    uid: user.uid,
    email: user.email,
    subscription: "free",
    createdAt: new Date(),
    lastLogin: new Date(),
    displayName: user.displayName,
    photoURL: user.photoURL,
    quota: {
      dailyUsage: 0,
      weeklyUsage: 0,
      dailyLimit: 0,
      weeklyLimit: 0,
      lastResetDaily: new Date().toISOString().split("T")[0],
      lastResetWeekly: new Date().toISOString().split("T")[0],
    },
    roles: ["user"],
  };
  const expiresIn = 14 * 24 * 60 * 60 * 1000; // 14 Days
  const isProduction = process.env.NODE_ENV === "production";

  try {
    const sessionCookie = await admin
      .auth()
      .createSessionCookie(token, { expiresIn });

    const options: CookieOptions = {
      maxAge: expiresIn,
      httpOnly: true,
      // In production we must use Secure + SameSite=None for cross-site cookies
      secure: true,
      sameSite: ("none"),
      path: "/",
    };

    res.cookie("session", sessionCookie, options);
    logger.info(
      `Session cookie created successfully for user ${userModel.uid}.`
    );
    const createdUser = await userService.createUser(userModel);
    if (!createdUser) {
      logger.warn(`User ${userModel.uid} not created.`);
      res.status(400).send({
        success: false,
        message: "User not created.",
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

    // Configurer le cookie pour le refresh token
    const refreshTokenOptions: CookieOptions = {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 jours
      httpOnly: true,
      secure: isProduction,
      sameSite: (isProduction ? "none" : "lax"),
      path: "/",
    };

    res.cookie("refreshToken", refreshTokenResult.refreshToken, refreshTokenOptions);
    
    res
      .status(200)
      .send({ 
        success: true, 
        message: "Session cookie created successfully.",
        refreshToken: refreshTokenResult.refreshToken,
        refreshTokenExpiresAt: refreshTokenResult.expiresAt
      });
  } catch (error: any) {
    logger.error(`Error creating session cookie for user ${user.uid}:`, {
      errorMessage: error.message,
      errorStack: error.stack,
      idTokenProvided: !!token,
    });
    res.status(401).send({
      success: false,
      message: "UNAUTHORIZED REQUEST! Error creating session cookie.",
      error: error.message,
    });
  }
};

/**
 * Contrôleur pour rafraîchir un token d'accès en utilisant un refresh token
 */
export const refreshTokenController = async (
  req: Request,
  res: Response
): Promise<void> => {
  const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

  logger.info("Attempting to refresh access token", {
    hasRefreshToken: !!refreshToken,
    source: req.cookies.refreshToken ? 'cookie' : 'body'
  });

  if (!refreshToken) {
    logger.warn("Refresh token missing in request");
    res.status(400).send({
      success: false,
      message: "Refresh token is required."
    });
    return;
  }

  try {
    // Valider le refresh token
    const validation = await refreshTokenService.validateRefreshToken(refreshToken);
    
    if (!validation.isValid || !validation.userId) {
      logger.warn("Invalid refresh token provided");
      res.status(401).send({
        success: false,
        message: "Invalid or expired refresh token."
      });
      return;
    }

    // Récupérer l'utilisateur
    const user = await userService.getUserProfile(req.cookies.session || '');
    if (!user) {
      logger.warn(`User ${validation.userId} not found during token refresh`);
      res.status(404).send({
        success: false,
        message: "User not found."
      });
      return;
    }

    // Créer un nouveau session cookie Firebase
    const customToken = await admin.auth().createCustomToken(validation.userId);
    const expiresIn = 14 * 24 * 60 * 60 * 1000; // 14 jours
    const isProduction = process.env.NODE_ENV === "production";

    const sessionCookie = await admin.auth().createSessionCookie(customToken, { expiresIn });

    const options: CookieOptions = {
      maxAge: expiresIn,
      httpOnly: true,
      secure: isProduction,
      sameSite: (isProduction ? "none" : "lax"),
      path: "/",
    };

    res.cookie("session", sessionCookie, options);

    logger.info(`Access token refreshed successfully for user: ${validation.userId}`);
    
    res.status(200).send({
      success: true,
      message: "Access token refreshed successfully.",
      sessionCookie
    });

  } catch (error: any) {
    logger.error("Error refreshing access token:", {
      errorMessage: error.message,
      errorStack: error.stack,
    });
    res.status(500).send({
      success: false,
      message: "Internal server error during token refresh.",
      error: error.message,
    });
  }
};

/**
 * Contrôleur pour déconnecter un utilisateur (révoque le refresh token)
 */
export const logoutController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

  logger.info("Attempting user logout", {
    userId,
    hasRefreshToken: !!refreshToken
  });

  if (!userId) {
    logger.warn("Logout attempt without authenticated user");
    res.status(401).send({
      success: false,
      message: "User not authenticated."
    });
    return;
  }

  try {
    // Révoquer le refresh token spécifique si fourni
    if (refreshToken) {
      await refreshTokenService.revokeRefreshToken(userId, refreshToken);
    }

    // Supprimer les cookies
    res.clearCookie("session");
    res.clearCookie("refreshToken");

    logger.info(`User ${userId} logged out successfully`);
    
    res.status(200).send({
      success: true,
      message: "Logged out successfully."
    });

  } catch (error: any) {
    logger.error(`Error during logout for user ${userId}:`, {
      errorMessage: error.message,
      errorStack: error.stack,
    });
    res.status(500).send({
      success: false,
      message: "Error during logout.",
      error: error.message,
    });
  }
};

/**
 * Contrôleur pour déconnecter un utilisateur de tous les appareils
 */
export const logoutAllController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;

  logger.info("Attempting to logout user from all devices", { userId });

  if (!userId) {
    logger.warn("Logout all attempt without authenticated user");
    res.status(401).send({
      success: false,
      message: "User not authenticated."
    });
    return;
  }

  try {
    // Révoquer tous les refresh tokens
    await refreshTokenService.revokeAllRefreshTokens(userId);

    // Supprimer les cookies de la session actuelle
    res.clearCookie("session");
    res.clearCookie("refreshToken");

    logger.info(`User ${userId} logged out from all devices successfully`);
    
    res.status(200).send({
      success: true,
      message: "Logged out from all devices successfully."
    });

  } catch (error: any) {
    logger.error(`Error during logout all for user ${userId}:`, {
      errorMessage: error.message,
      errorStack: error.stack,
    });
    res.status(500).send({
      success: false,
      message: "Error during logout from all devices.",
      error: error.message,
    });
  }
};

/**
 * Contrôleur pour obtenir les informations des refresh tokens d'un utilisateur
 */
export const getRefreshTokensController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;

  logger.info("Getting refresh tokens info", { userId });

  if (!userId) {
    logger.warn("Get refresh tokens attempt without authenticated user");
    res.status(401).send({
      success: false,
      message: "User not authenticated."
    });
    return;
  }

  try {
    const refreshTokens = await refreshTokenService.getUserRefreshTokens(userId);

    logger.info(`Retrieved ${refreshTokens.length} refresh tokens for user: ${userId}`);
    
    res.status(200).send({
      success: true,
      refreshTokens
    });

  } catch (error: any) {
    logger.error(`Error getting refresh tokens for user ${userId}:`, {
      errorMessage: error.message,
      errorStack: error.stack,
    });
    res.status(500).send({
      success: false,
      message: "Error retrieving refresh tokens.",
      error: error.message,
    });
  }
};

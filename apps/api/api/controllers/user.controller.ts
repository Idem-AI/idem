import { Request, Response } from 'express';
import logger from '../config/logger';
import { userService } from '../services/user.service';
import { isSuperUser } from '../utils/super-user.util';
import { toPublicProfile } from '../utils/public-profile.util';
import {
  restoreSessionFromRefreshToken,
  verifySessionForRequest,
} from '../services/sessionCookie.service';
import {
  SUSPICIOUS_DEVICE_BODY,
  SuspiciousDeviceError,
} from '../services/identity/deviceCheck.service';
import { CustomRequest } from '../interfaces/express.interface';
import { OnboardingProfile, OnboardingUiMode } from '../models/userModel';

async function isSessionValid(req: Request, sessionCookie: string): Promise<boolean> {
  try {
    await verifySessionForRequest(req, sessionCookie);
    return true;
  } catch (error) {
    if (error instanceof SuspiciousDeviceError) throw error;
    return false;
  }
}

const UI_MODES: OnboardingUiMode[] = ['guided', 'chat', 'advanced'];
const ANSWER_KEYS = ['stage', 'clarity', 'workStyle', 'comfort'] as const;

/** Valeurs admises par question : tout le reste est rejeté. */
const ALLOWED_ANSWERS: Record<(typeof ANSWER_KEYS)[number], string[]> = {
  stage: ['idea', 'starting', 'running'],
  clarity: ['lost', 'partial', 'clear'],
  workStyle: ['stepByStep', 'conversation', 'autonomy'],
  comfort: ['beginner', 'intermediate', 'expert'],
};

export const profileController = async (req: Request, res: Response): Promise<void> => {
  let sessionCookie: string | undefined = req.cookies.session;
  let userIdForLogging = 'unknown';

  logger.info('Attempting to retrieve user profile.', {
    sessionCookieProvided: !!sessionCookie,
  });

  // Les applications satellites (AppGen, iDeploy, simulateur) ne lisent que ce
  // point d'entrée : une session expirée y est renouvelée depuis le refresh
  // token, sans renvoyer l'utilisateur au login.
  try {
    if (!sessionCookie || !(await isSessionValid(req, sessionCookie))) {
      sessionCookie = (await restoreSessionFromRefreshToken(req, res)) ?? sessionCookie;
    }
  } catch (error) {
    if (!(error instanceof SuspiciousDeviceError)) throw error;
    res.status(401).json(SUSPICIOUS_DEVICE_BODY);
    return;
  }

  if (!sessionCookie) {
    logger.warn('Profile retrieval failed: No session cookie provided.');
    res.status(401).json({ message: 'Unauthenticated: No session cookie provided.' });
    return;
  }

  try {
    const identity = await verifySessionForRequest(req, sessionCookie);
    const profile = await userService.getUserProfile(identity.uid);
    userIdForLogging = profile.uid;
    logger.info(
      `Successfully verified session cookie for user: ${userIdForLogging}. Retrieving profile.`,
      { userId: userIdForLogging }
    );
    // Les applications satellites lisent le statut ici plutôt que de dupliquer
    // `ADMIN_EMAILS` dans leur propre configuration.
    // Le statut super user exige une adresse vérifiée par le serveur
    // d'authentification : iDeploy en déduit un rôle d'administrateur d'instance.
    const emailVerified = profile.emailVerified === true;
    const superUser = emailVerified && isSuperUser(profile.email);
    res.status(200).json({
      ...toPublicProfile(profile),
      emailVerified,
      isSuperUser: superUser,
    });
  } catch (error: any) {
    logger.error('Error verifying session cookie or fetching user data:', {
      userId: userIdForLogging,
      errorMessage: error.message,
      errorStack: error.stack,
      sessionCookieProvided: !!sessionCookie,
    });
    res.status(401).json({
      message: 'Unauthenticated: Invalid or expired session.',
    });
  }
};


/**
 * Profil d'accueil de l'utilisateur connecté.
 * Répond `{ profile: null }` quand le sondage n'a jamais été rempli — c'est le
 * signal qui déclenche le sondage côté application.
 */
export const getOnboardingProfileController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  if (!userId) {
    res.status(401).json({ message: 'Unauthenticated.' });
    return;
  }

  try {
    const profile = await userService.getOnboardingProfile(userId);
    res.status(200).json({ profile });
  } catch (error: any) {
    logger.error('Error fetching onboarding profile:', {
      userId,
      errorMessage: error.message,
    });
    res.status(500).json({ message: 'Could not fetch the onboarding profile.' });
  }
};

/**
 * Enregistre les réponses du sondage. Les quatre réponses sont exigées :
 * le sondage est obligatoire, un profil partiel n'aurait aucune valeur.
 */
export const saveOnboardingProfileController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  if (!userId) {
    res.status(401).json({ message: 'Unauthenticated.' });
    return;
  }

  const body = req.body ?? {};
  const answers = body.answers ?? {};

  const invalid = ANSWER_KEYS.filter(
    (key) => typeof answers[key] !== 'string' || !ALLOWED_ANSWERS[key].includes(answers[key])
  );
  if (invalid.length > 0) {
    logger.warn('Onboarding survey rejected: missing or invalid answers', { userId, invalid });
    res.status(400).json({
      message: 'All four survey answers are required.',
      invalidFields: invalid,
    });
    return;
  }

  if (!UI_MODES.includes(body.recommendedMode) || !UI_MODES.includes(body.selectedMode)) {
    logger.warn('Onboarding survey rejected: unknown mode', {
      userId,
      recommendedMode: body.recommendedMode,
      selectedMode: body.selectedMode,
    });
    res.status(400).json({ message: 'Unknown interface mode.' });
    return;
  }

  const profile: OnboardingProfile = {
    version: 1,
    answers: {
      stage: answers.stage,
      clarity: answers.clarity,
      workStyle: answers.workStyle,
      comfort: answers.comfort,
    },
    recommendedMode: body.recommendedMode,
    selectedMode: body.selectedMode,
    completedAt: new Date(),
  };

  try {
    const saved = await userService.saveOnboardingProfile(userId, profile);
    res.status(200).json({ profile: saved });
  } catch (error: any) {
    logger.error('Error saving onboarding profile:', {
      userId,
      errorMessage: error.message,
    });
    res.status(500).json({ message: 'Could not save the onboarding profile.' });
  }
};


/** Visites guidées déjà vues par l'utilisateur connecté. */
export const getToursSeenController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  if (!userId) {
    res.status(401).json({ message: 'Unauthenticated.' });
    return;
  }

  try {
    res.status(200).json({ toursSeen: await userService.getToursSeen(userId) });
  } catch (error: any) {
    logger.error('Error fetching seen tours:', { userId, errorMessage: error.message });
    res.status(500).json({ message: 'Could not fetch the tours.' });
  }
};

/** Enregistre une demande de suppression de compte (délai de grâce : 180 j). */
export const requestAccountDeletionController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  if (!userId) {
    res.status(401).json({ message: 'Unauthenticated.' });
    return;
  }

  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  const details = typeof req.body?.details === 'string' ? req.body.details.trim() : undefined;

  const allowedReasons = [
    'not_useful',
    'too_expensive',
    'found_alternative',
    'privacy',
    'temporary',
    'other',
  ];

  if (!reason || !allowedReasons.includes(reason)) {
    res.status(400).json({ message: 'A valid reason is required.' });
    return;
  }

  if (reason === 'other' && (!details || details.length < 5)) {
    res.status(400).json({ message: 'Please provide more details for the "other" reason.' });
    return;
  }

  try {
    const request = await userService.requestAccountDeletion(userId, reason, details);
    logger.info(`Account deletion requested by user ${userId}`);
    res.status(200).json({ deletionRequest: request });
  } catch (error: any) {
    logger.error('Error scheduling account deletion:', {
      userId,
      errorMessage: error.message,
    });
    res.status(500).json({ message: 'Could not schedule account deletion.' });
  }
};

/** Annule une demande de suppression en cours. */
export const cancelAccountDeletionController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  if (!userId) {
    res.status(401).json({ message: 'Unauthenticated.' });
    return;
  }

  try {
    await userService.cancelAccountDeletion(userId);
    res.status(200).json({ message: 'Account deletion cancelled.' });
  } catch (error: any) {
    logger.error('Error cancelling account deletion:', {
      userId,
      errorMessage: error.message,
    });
    res.status(500).json({ message: 'Could not cancel account deletion.' });
  }
};

/** Marque une visite guidée comme vue pour l'utilisateur connecté. */
export const markTourSeenController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  if (!userId) {
    res.status(401).json({ message: 'Unauthenticated.' });
    return;
  }

  const tourId = typeof req.body?.tourId === 'string' ? req.body.tourId.trim() : '';
  // Identifiant contraint : il vient de l'application, pas de l'utilisateur.
  if (!tourId || tourId.length > 64 || !/^[a-z0-9:_-]+$/i.test(tourId)) {
    res.status(400).json({ message: 'A valid tourId is required.' });
    return;
  }

  try {
    const toursSeen = await userService.markTourSeen(userId, tourId);
    res.status(200).json({ toursSeen });
  } catch (error: any) {
    logger.error('Error marking tour as seen:', { userId, tourId, errorMessage: error.message });
    res.status(500).json({ message: 'Could not record the tour.' });
  }
};

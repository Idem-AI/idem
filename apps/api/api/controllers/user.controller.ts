import { Request, Response } from 'express';
import logger from '../config/logger';
import { userService } from '../services/user.service';
import { CustomRequest } from '../interfaces/express.interface';
import { OnboardingProfile, OnboardingUiMode } from '../models/userModel';

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
  const sessionCookie = req.cookies.session;
  let userIdForLogging = 'unknown';

  logger.info('Attempting to retrieve user profile.', {
    sessionCookieProvided: !!sessionCookie,
  });

  if (!sessionCookie) {
    logger.warn('Profile retrieval failed: No session cookie provided.');
    res.status(401).json({ message: 'Unauthenticated: No session cookie provided.' });
    return;
  }

  try {
    const profile = await userService.getUserProfile(sessionCookie);
    userIdForLogging = profile.uid;
    logger.info(
      `Successfully verified session cookie for user: ${userIdForLogging}. Retrieving profile.`,
      { userId: userIdForLogging }
    );
    res.status(200).json(profile);
  } catch (error: any) {
    logger.error('Error verifying session cookie or fetching user data:', {
      userId: userIdForLogging,
      errorMessage: error.message,
      errorStack: error.stack,
      sessionCookieProvided: !!sessionCookie,
    });
    res.status(401).json({
      message: 'Unauthenticated: Invalid or expired session.',
      error: error.message,
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

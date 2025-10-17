import { Request, Response } from "express";
import logger from "../config/logger";
import { userService } from "../services/user.service";

export const profileController = async (
  req: Request,
  res: Response
): Promise<void> => {
  const sessionCookie = req.cookies.session;
  let userIdForLogging = "unknown";

  logger.info("Attempting to retrieve user profile.", {
    sessionCookieProvided: !!sessionCookie,
  });

  if (!sessionCookie) {
    logger.warn("Profile retrieval failed: No session cookie provided.");
    res
      .status(401)
      .json({ message: "Unauthenticated: No session cookie provided." });
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
    logger.error("Error verifying session cookie or fetching user data:", {
      userId: userIdForLogging,
      errorMessage: error.message,
      errorStack: error.stack,
      sessionCookieProvided: !!sessionCookie,
    });
    res.status(401).json({
      message: "Unauthenticated: Invalid or expired session.",
      error: error.message,
    });
  }
};

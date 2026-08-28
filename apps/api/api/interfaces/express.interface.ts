import { Request } from 'express';
import admin from 'firebase-admin';

export interface CustomRequest extends Request {
  user?: admin.auth.DecodedIdToken;
  /** Resolved UI language ('en' | 'fr'), set by languageMiddleware. */
  language?: string;
  policyWarning?: {
    requiresFinalization: boolean;
    finalizeEndpoint: string;
  };
}

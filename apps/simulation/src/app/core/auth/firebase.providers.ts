import {
  EnvironmentProviders,
  InjectionToken,
  inject,
  makeEnvironmentProviders,
} from '@angular/core';
import { FirebaseApp, initializeApp } from 'firebase/app';
import { Auth, browserLocalPersistence, getAuth, setPersistence } from 'firebase/auth';

import { environment } from '@env';

/**
 * The Firebase app shared with the IDEM dashboard.
 *
 * `null` when no Firebase credentials are configured, which is the normal
 * state of a fresh checkout running on the demo dataset. Everything
 * downstream treats a null app as "authentication unavailable" rather than
 * crashing at bootstrap.
 */
export const FIREBASE_APP = new InjectionToken<FirebaseApp | null>('FIREBASE_APP');

/** Firebase Auth instance, or `null` when Firebase is not configured. */
export const FIREBASE_AUTH = new InjectionToken<Auth | null>('FIREBASE_AUTH');

/**
 * Placeholder values count as "not configured": a fresh checkout copies
 * .env.example verbatim, and booting Firebase with `your_api_key_here` fails
 * later, at sign-in, instead of here where the message is useful.
 */
function isConfigured(): boolean {
  const { apiKey, projectId } = environment.firebase;
  const filled = (value: string) => !!value && !value.startsWith('your_');
  return filled(apiKey) && filled(projectId);
}

export function provideFirebase(): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: FIREBASE_APP,
      useFactory: (): FirebaseApp | null => {
        if (!isConfigured()) {
          console.warn(
            '[auth] Firebase is not configured — sign-in is disabled. ' +
              'Copy .env.example to .env and fill in the IDEM Firebase credentials.',
          );
          return null;
        }
        return initializeApp(environment.firebase);
      },
    },
    {
      provide: FIREBASE_AUTH,
      useFactory: (): Auth | null => {
        const app = inject(FIREBASE_APP);
        if (!app) {
          return null;
        }
        const auth = getAuth(app);
        // Same persistence as the dashboard: the session survives a reload.
        void setPersistence(auth, browserLocalPersistence);
        return auth;
      },
    },
  ]);
}

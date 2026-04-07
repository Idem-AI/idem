import { useEffect, useCallback } from 'react';
import useUserStore from '@/stores/userSlice';
import useAppGenContextStore from '@/stores/appgenContextSlice';

const DASHBOARD_URL = process.env.REACT_APP_IDEM_MAIN_APP_URL || 'http://localhost:4200';
const APPGEN_URL = process.env.REACT_APP_BASE_URL || 'http://localhost:5173';
const PENDING_CONTEXT_KEY = 'appgen_pending_context';

export interface PendingContext {
  returnUrl: string;
  draftId?: string;
  intent?: string;
  timestamp: number;
}

/**
 * Saves the current AppGen context to localStorage before redirecting to login.
 * On return, the context is restored automatically.
 */
export function saveContextBeforeRedirect(intent?: string): void {
  const draft = useAppGenContextStore.getState().draft;
  const context: PendingContext = {
    returnUrl: window.location.href,
    draftId: draft?.id,
    intent: intent,
    timestamp: Date.now(),
  };
  localStorage.setItem(PENDING_CONTEXT_KEY, JSON.stringify(context));
}

/**
 * Retrieves and clears the pending context saved before login redirect.
 */
export function consumePendingContext(): PendingContext | null {
  try {
    const raw = localStorage.getItem(PENDING_CONTEXT_KEY);
    if (!raw) return null;
    const context: PendingContext = JSON.parse(raw);
    // Context valid for 30 minutes
    if (Date.now() - context.timestamp > 30 * 60 * 1000) {
      localStorage.removeItem(PENDING_CONTEXT_KEY);
      return null;
    }
    localStorage.removeItem(PENDING_CONTEXT_KEY);
    return context;
  } catch {
    return null;
  }
}

/**
 * Redirects to main-dashboard login page, passing AppGen return URL and context.
 */
export function redirectToLogin(intent?: string): void {
  saveContextBeforeRedirect(intent);
  const returnUrl = encodeURIComponent(window.location.href);
  window.location.href = `${DASHBOARD_URL}/login?returnUrl=${returnUrl}&from=appgen`;
}

const useAuth = () => {
  const { isAuthenticated, fetchUser, isLoading } = useUserStore();
  const { setPendingIntent, initDraft } = useAppGenContextStore();

  // On mount: check for pending context restored after login redirect
  useEffect(() => {
    const context = consumePendingContext();
    if (context?.intent) {
      setPendingIntent(context.intent);
    }
    // Ensure draft exists
    initDraft();
  }, []);

  const requireAuth = useCallback(
    (intent?: string, onAuthenticated?: () => void) => {
      if (isAuthenticated) {
        onAuthenticated?.();
        return true;
      }
      redirectToLogin(intent);
      return false;
    },
    [isAuthenticated]
  );

  return {
    isAuthenticated,
    isLoading,
    requireAuth,
    redirectToLogin,
  };
};

export default useAuth;

import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { startTour, type TourHandle, type TourStep } from '@idem/shared-tour';

/** Identifiant de la visite : préfixé par l'app, comme sur les autres produits Idem. */
const TOUR_ID = 'appgen:main';

/** Cache local : évite d'attendre le réseau quand la réponse est déjà connue. */
const STORAGE_KEY = 'idem_tours_seen_v1';

/** Le temps que la vue se peigne avant de mesurer les éléments à pointer. */
const START_DELAY_MS = 800;

/**
 * API IDEM globale : celle dont AppGen partage déjà la session.
 * Même variable que `src/api/persistence/db.ts`, pour ne pas multiplier les
 * sources de vérité sur l'adresse de l'API.
 */
const API_BASE_URL = process.env.REACT_APP_IDEM_API_BASE_URL || 'http://localhost:3001';
const TOURS_URL = `${API_BASE_URL}/auth/tours`;

/** Étapes de la visite : la cible est un `data-tour` posé dans les composants. */
const STEPS: Array<{
  key: string;
  target?: string;
  placement?: TourStep['placement'];
  celebrate?: boolean;
}> = [
  { key: 'welcome' },
  { key: 'chat', target: '[data-tour="appgen-chat"]', placement: 'right' },
  { key: 'preview', target: '[data-tour="appgen-preview"]', placement: 'left' },
  { key: 'header', target: '[data-tour="appgen-header"]', placement: 'bottom' },
  { key: 'done', celebrate: true },
];

function readLocal(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocal(ids: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Stockage indisponible : le compte reste la mémoire de référence
  }
}

/**
 * Visites vues d'après le compte IDEM, partagé par toutes les applications.
 * Une panne réseau renvoie une liste vide : mieux vaut reproposer la visite
 * que de la supprimer définitivement sur une erreur passagère.
 */
async function fetchSeen(): Promise<string[]> {
  try {
    const response = await fetch(TOURS_URL, { credentials: 'include' });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data?.toursSeen) ? data.toursSeen : [];
  } catch (error) {
    console.error('Tour: could not read the seen tours', error);
    return [];
  }
}

async function markSeen(): Promise<void> {
  const local = readLocal();
  if (!local.includes(TOUR_ID)) writeLocal([...local, TOUR_ID]);

  try {
    await fetch(TOURS_URL, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tourId: TOUR_ID }),
    });
  } catch (error) {
    console.error('Tour: could not record the tour', error);
  }
}

/**
 * Visite guidée de première utilisation d'AppGen.
 *
 * Elle s'appuie sur le moteur partagé `@idem/shared-tour`, commun à toutes les
 * applications Idem, et mémorise son passage sur le **compte** : changer de
 * navigateur ou de machine ne rejoue pas un didacticiel déjà suivi.
 *
 * @param enabled la vue principale est-elle affichée ? On ne pointe pas des
 * éléments qui n'existent pas encore.
 */
export function useTour(enabled: boolean): void {
  const { t } = useTranslation();
  const handle = useRef<TourHandle | null>(null);
  const started = useRef(false);

  useEffect(() => {
    // `started` est posé de façon synchrone : en mode strict React rejoue les
    // effets, et le minuteur seul ne suffit pas à empêcher un second lancement.
    if (!enabled || started.current || readLocal().includes(TOUR_ID)) return;
    started.current = true;

    let cancelled = false;
    let timer = 0;

    void (async () => {
      const seen = await fetchSeen();
      if (cancelled) return;

      if (seen.includes(TOUR_ID)) {
        writeLocal([...readLocal(), TOUR_ID]);
        return;
      }

      // Laisse la page se peindre : les positions se mesurent sur du réel.
      timer = window.setTimeout(() => {
        handle.current = startTour({
          id: TOUR_ID,
          steps: STEPS.map(({ key, ...rest }) => ({
            ...rest,
            title: t(`tour.steps.${key}.title`),
            body: t(`tour.steps.${key}.body`),
          })),
          labels: {
            next: t('tour.common.next'),
            back: t('tour.common.back'),
            skip: t('tour.common.skip'),
            finish: t('tour.common.finish'),
            stepOf: t('tour.common.stepOf'),
            dialogLabel: t('tour.common.dialogLabel'),
          },
          onFinish: () => {
            handle.current = null;
            // Vue jusqu'au bout ou passée : dans les deux cas on ne la repropose pas.
            void markSeen();
          },
        });
      }, START_DELAY_MS);
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      handle.current?.stop();
      handle.current = null;
      started.current = false;
    };
  }, [enabled, t]);
}

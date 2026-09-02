import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { startTour, type TourHandle, type TourStep } from '@idem/shared-tour';

/** Identifiant de la visite : préfixé par l'app, comme sur les autres produits Idem. */
const TOUR_ID = 'appgen:main';
const STORAGE_KEY = 'idem_tours_seen_v1';
/** Le temps que la vue se peigne avant de mesurer les éléments à pointer. */
const START_DELAY_MS = 800;

/** Étapes de la visite : la cible est un `data-tour` posé dans les composants. */
const STEPS: Array<{ key: string; target?: string; placement?: TourStep['placement']; celebrate?: boolean }> = [
  { key: 'welcome' },
  { key: 'chat', target: '[data-tour="appgen-chat"]', placement: 'right' },
  { key: 'preview', target: '[data-tour="appgen-preview"]', placement: 'left' },
  { key: 'header', target: '[data-tour="appgen-header"]', placement: 'bottom' },
  { key: 'done', celebrate: true },
];

function seen(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function markSeen(): void {
  const ids = seen();
  if (ids.includes(TOUR_ID)) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids, TOUR_ID]));
  } catch {
    // Stockage indisponible : la visite se reproposera, sans casse
  }
}

/**
 * Visite guidée de première utilisation d'AppGen.
 *
 * Elle s'appuie sur le moteur partagé `@idem/shared-tour`, commun à toutes les
 * applications Idem. La mémoire est locale à l'appareil : AppGen n'a pas de
 * profil d'accueil en base où l'inscrire.
 *
 * @param enabled la vue principale est-elle affichée ? On ne pointe pas des
 * éléments qui n'existent pas encore.
 */
export function useTour(enabled: boolean): void {
  const { t } = useTranslation();
  const handle = useRef<TourHandle | null>(null);

  useEffect(() => {
    if (!enabled || handle.current || seen().includes(TOUR_ID)) return;

    const timer = window.setTimeout(() => {
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
          markSeen();
        },
      });
    }, START_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
      handle.current?.stop();
      handle.current = null;
    };
  }, [enabled, t]);
}

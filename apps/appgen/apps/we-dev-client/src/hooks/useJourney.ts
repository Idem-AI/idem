import { useCallback, useEffect, useRef, useState } from 'react';
import { createJourneyClient, JourneyEventType, JourneyUrls, Recommendation } from '@idem/shared-journey';
import { eventEmitter } from '@/components/AiChat/utils/EventEmitter';
import { currentProduct } from '@/utils/product';

/**
 * La boucle IDEM dans iCode : chaque geste qui compte (site généré ou refait, application générée, mise en
 * ligne) est signalé à l'API, qui rend l'étape suivante — faire connaître le site, le mettre en ligne, lui
 * donner un nom… La carte s'affiche sous la conversation ; une seule à la fois.
 *
 * Les gestes arrivent par `journey:event` (en-tête, fenêtre de mise en ligne) ou par `record` (fin d'une
 * génération). À l'ouverture d'un projet, la carte du moment est redemandée : une refonte suivie d'un
 * rechargement retrouve sa proposition.
 */
export const journeyClient = createJourneyClient({
  apiUrl: process.env.REACT_APP_IDEM_API_BASE_URL || 'http://localhost:3001',
});

export const journeyUrls: JourneyUrls = {
  dashboard: process.env.REACT_APP_IDEM_MAIN_APP_URL || 'http://localhost:4200',
  icode: typeof window !== 'undefined' ? window.location.origin : '',
};

const place = () => (currentProduct() === 'app' ? 'app' : 'site') as 'app' | 'site';

export function useJourney(projectId: string | null, ready: boolean) {
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const asked = useRef<string | null>(null);

  const record = useCallback(
    async (type: JourneyEventType, forProject: string | null = projectId) => {
      const [next] = await journeyClient.record({ type, app: 'icode', projectId: forProject ?? undefined }, { place: place() });
      // Sans projet, la destination ne saurait pas quel projet ouvrir : pas de carte.
      if (next && next.projectId) setRecommendation(next);
    },
    [projectId]
  );

  // À l'ouverture d'un projet qui a déjà du travail : la proposition du moment, s'il y en a une.
  useEffect(() => {
    if (!projectId || !ready || asked.current === projectId) return;
    asked.current = projectId;
    void journeyClient.next({ app: 'icode', projectId, place: place() }).then(([next]) => {
      if (next) setRecommendation(next);
    });
  }, [projectId, ready]);

  useEffect(
    () =>
      eventEmitter.on('journey:event', (type: JourneyEventType) => {
        void record(type);
      }),
    [record]
  );

  return { recommendation, record, clear: () => setRecommendation(null) };
}

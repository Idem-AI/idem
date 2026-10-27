import { journeyLink } from '@idem/shared-journey';
import { ExternalLink } from 'lucide-react';
import { readOpen } from '@/utils/chatMarkers';
import { journeyUrls } from '@/hooks/useJourney';
import { waitForCodeSync } from '@/utils/codeSync';

/**
 * Les boutons qu'une réponse pose pour mener à une page d'IDEM (« Voir ma charte »), projet déjà sélectionné.
 * L'adresse est posée ici : seul l'atelier connaît celle du dashboard.
 */
export function OpenLinks({ content }: { content: string }) {
  const links = readOpen(content);
  if (!links.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {links.map((link) => {
        const href = journeyLink(link.destination, { urls: journeyUrls, projectId: link.projectId, from: 'icode' });
        return (
          <a
            key={`${link.destination}-${link.projectId}`}
            href={href}
            className="inner-button button-sm"
            onClick={async (event) => {
              // Le code part au stockage avant de quitter l'atelier.
              event.preventDefault();
              await waitForCodeSync();
              window.location.assign(href);
            }}
          >
            {link.label} <ExternalLink size={12} aria-hidden="true" />
          </a>
        );
      })}
    </div>
  );
}

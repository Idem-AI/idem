/**
 * Compression HTTP des réponses.
 *
 * Les réponses JSON de l'API — listes de projets, business plans, chartes,
 * catalogues — partaient en clair : sur un lien à bas débit, c'est la part
 * d'attente la plus coûteuse, pour un contenu qui se compresse typiquement à
 * un huitième de sa taille.
 *
 * LE POINT DÉLICAT : les flux SSE (`text/event-stream`). La compression met en
 * tampon pour avoir de quoi compresser ; appliquée à un flux, elle retiendrait
 * les événements au lieu de les livrer au fil de l'eau, et toutes les
 * générations suivies en direct se figeraient. Le filtre ci-dessous les exclut
 * explicitement — c'est la raison d'être de ce fichier plutôt qu'un
 * `app.use(compression())` nu.
 */
import compression from 'compression';
import type { Request, Response } from 'express';

/** Vrai si la réponse est un flux que la compression casserait. */
function isStream(res: Response): boolean {
  const type = String(res.getHeader('Content-Type') || '');
  if (type.includes('text/event-stream')) return true;
  // `X-Accel-Buffering: no` est la façon dont les contrôleurs demandent déjà
  // aux proxys de ne pas mettre en tampon : même intention, même exclusion.
  if (String(res.getHeader('X-Accel-Buffering') || '') === 'no') return true;
  return false;
}

export const compressionMiddleware = compression({
  // 1 Ko : en dessous, l'en-tête de compression coûte plus que ce qu'il gagne.
  threshold: 1024,
  filter: (req: Request, res: Response) => {
    if (isStream(res)) return false;
    // Échappatoire de diagnostic, convention de la bibliothèque.
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
});

import { inject } from '@angular/core';

import { CookieService } from './cookie.service';

/**
 * ADOPTION DU PROJET DÉSIGNÉ PAR L'ADRESSE — `?projectId=`.
 *
 * Le projet ouvert vit dans un cookie partagé entre les applications IDEM, et
 * ce cookie dit quel projet on consultait LA DERNIÈRE FOIS ici. Un lien entrant
 * d'une autre application parle, lui, d'un projet précis : « Compléter le
 * projet » depuis le simulateur mène au business plan D'UN projet donné. Sans
 * cette adoption, la page s'ouvrait bel et bien, mais sur le projet précédent —
 * l'utilisateur complétait un autre dossier que celui qu'on lui demandait.
 *
 * POSÉ AVANT LE ROUTAGE. Les pages lisent le cookie dans leur `ngOnInit` ; le
 * corriger après serait trop tard, et corriger APRÈS avoir chargé aurait déjà
 * coûté un appel réseau sur le mauvais projet.
 *
 * L'identifiant reste dans l'adresse : il n'a rien de secret, et recharger la
 * page doit rouvrir le même projet. Aucune vérification d'appartenance ici —
 * `CurrentProjectService` ramène la sélection sur un projet réel dès que la
 * liste arrive, et l'API refuse de toute façon un projet qui n'est pas à
 * l'utilisateur.
 */
export function adoptIncomingProject(): void {
  const cookies = inject(CookieService);

  let requested: string | null = null;
  try {
    requested = new URL(window.location.href).searchParams.get('projectId');
  } catch {
    // Adresse illisible : il n'y a rien à adopter.
    return;
  }

  const projectId = (requested ?? '').trim();
  // Un identifiant vaut une valeur de cookie : tout ce qui pourrait en refermer
  // une — point-virgule, espace, retour à la ligne — est écarté plutôt
  // qu'échappé, un identifiant de projet n'en contenant jamais.
  if (!projectId || projectId.length > 128 || /[^\w.-]/.test(projectId)) {
    return;
  }

  cookies.set('projectId', projectId);
}

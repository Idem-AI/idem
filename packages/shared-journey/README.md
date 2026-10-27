# @idem/shared-journey

La boucle IDEM : recommander l'application suivante au bon moment, pour que l'utilisateur ne quitte pas l'écosystème une fois un livrable fini (site refait → le faire connaître, site en ligne → un nom de domaine, charte → le site…).

## Les trois notions

| Notion | Ce que c'est | Où ça vit |
| --- | --- | --- |
| **Événement** | Ce que l'utilisateur vient de faire (`site.redesigned`, `video.created`…) | Signalé par l'application ou constaté par l'API |
| **Fait** | Ce que le projet a déjà (`charter`, `sitePublished`, `communication`…) | Lu sur la fiche du projet, ses mises en ligne et les événements |
| **Destination** | Où emmener ensuite (`communication`, `publish-site`, `domain`…) | Une page d'arrivée par destination, projet déjà sélectionné (`links.ts`) |

Une **règle** (`rules.ts`) relie des événements à une destination. Elle ne s'applique jamais si la destination est déjà atteinte, si ses prérequis manquent, ou si l'utilisateur l'a écartée récemment (14 jours, doublé à chaque refus, 90 jours au plus ; 30 jours après un clic ; une semaine après 6 affichages sans réaction). Un geste de moins de 24 h passe devant tout ; au-delà de 7 jours il ne déclenche plus rien, sauf sur une page qui demande la « prochaine étape » (`ambient`). Une seule carte à la fois.

Tout est calculé par le code, sans modèle : `npm run check:journey` à la racine (40 contrôles).

## L'API (`apps/api`, `/journey/*`)

- `POST /journey/events` `{ type, app, projectId?, place? }` → `{ recommendations }`
- `GET /journey/next?app=&projectId=&place=&ambient=1` → `{ recommendations }`
- `POST /journey/feedback` `{ id, action: shown|clicked|dismissed }`

Mémoire par utilisateur : `users/<uid>/journey/state` (80 derniers événements, retours sur les cartes). Les générations du dashboard (charte, business plan, présentation, documents juridiques, stratégie et calendrier, visuels, vidéos) signalent leur événement elles-mêmes (`journeyService.signal`) : aucun écran ne peut l'oublier.

## Brancher une application

React (iCode) :

```tsx
import { createJourneyClient } from '@idem/shared-journey';
import { JourneyCard } from '@idem/shared-journey/react';

const client = createJourneyClient({ apiUrl: IDEM_API_URL });
const [rec] = await client.record({ type: 'site.generated', app: 'icode', projectId }, { place: 'site' });
<JourneyCard recommendation={rec} urls={{ dashboard, icode }} from="icode" lang="fr" client={client} />
```

Angular (dashboard) : `<app-journey-next [projectId]="id" [ambient]="true" />` (enveloppe de `idem-journey-card`, passe par `HttpClient`).

`beforeOpen` laisse l'hôte finir ce qui doit l'être (enregistrer le code) ou ouvrir la destination sur place (la fenêtre de mise en ligne d'iCode) ; rendre `false` annule la navigation.

## Ajouter une règle

1. La règle dans `JOURNEY_RULES` (identifiant stable : il sert aux textes et à la mémoire).
2. Ses textes FR et EN dans `texts.ts` (titre, phrase de bénéfice, bouton).
3. Un cas dans `check.ts`.

Les mots restent simples : on « fait connaître son site », on ne « lance pas une stratégie omnicanale ».

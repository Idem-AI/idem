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

Angular : `idem-journey-card` (paquet), enveloppé par chaque application :

| Application | Où | Comment le projet est connu |
| --- | --- | --- |
| Dashboard | accueil du projet (`app-journey-next`, `ambient`) | cookie / `?projectId=` |
| iCode | sous la conversation (`useJourney`) | `?projectId=` |
| iVision web | sous le dernier livrable (`iv-journey-next`) | la marque rattachée à un projet IDEM ; la recommandation arrive avec le message (passerelle `/internal/ivision/journey/*`) |
| iDeploy web | page d'une application (`app-journey-next`) | `?appUuid=` : l'API retrouve le projet par la mise en ligne faite depuis iCode ; sinon aucune carte |

`beforeOpen` laisse l'hôte finir ce qui doit l'être (enregistrer le code) ou ouvrir la destination sur place (la fenêtre de mise en ligne d'iCode) ; rendre `false` annule la navigation.

## Où la carte s'affiche : dans le fil ET en haut au centre (25/11/2026)

Une recommandation s'affiche à deux endroits :

- **dans le fil**, à sa place habituelle (sous la conversation, sous le livrable, sur la page) ;
- **en haut au centre de l'écran**, flottante, comme l'« étape suivante » du dashboard. Elle apparaît une fois par session de navigateur (`journeyFloatFirstTime`).

Écarter l'une retire les deux.

- React : `<JourneyFloat … silent top="4.5rem" />`, rendue dans `document.body`.
- Angular : `<idem-journey-float … [silent]="true" />`, rattachée à `document.body`. Sous une surface en verre, une carte `fixed` serait rognée.
- Dashboard : la carte entre dans la pile de la mise en page (`JourneyFloatService`), jamais dans une deuxième pile.

`silent` évite de compter deux fois l'affichage.

Le rendu est la brique du design system : `.idem-float-stack` et `.idem-next` / `.idem-next--float` dans `@idem/shared-styles`. Chaque hôte place la pile par deux variables :

- `--idem-float-top` : sous sa barre du haut ;
- `--idem-float-center` : le centre du contenu, décalé de la barre latérale.

Les dessins suivent la DA : le trait à l'encre du texte, un seul détail en couleur primaire. La flèche et la croix sont écrites dans le paquet (`JOURNEY_ICONS`), aucune police d'icônes n'est exigée.

## Ajouter une règle

1. La règle dans `JOURNEY_RULES` (identifiant stable : il sert aux textes et à la mémoire).
2. Ses textes FR et EN dans `texts.ts` (titre, phrase de bénéfice, bouton).
3. Un cas dans `check.ts`.

Les mots restent simples : on « fait connaître son site », on ne « lance pas une stratégie omnicanale ».

# La jauge de créativité

Avant chaque génération, l'utilisateur règle la part de décisions confiée à l'IA (pour la vidéo : la puissance des modèles). Le réglage vaut pour six livrables : vidéo motion, visuels et flyers, carte de visite, pitch deck, business plan et identité visuelle.

Les cinq crans reprennent ceux de l'effort d'un modèle : **Low · Medium · High · Max · Ultra**.

## Le principe : une échelle de délégation

Chaque livrable se découpe en cinq couches de décision. Le cran fixe à partir de quelle couche l'IA décide. En dessous, c'est le code qui décide : graphe de capacités, gabarits, graine déterministe. Il le fait toujours à partir de la charte et de sa direction artistique (DA).

| Couche | Low | Medium | High | Max | Ultra |
|---|---|---|---|---|---|
| Contenu (textes) | IA | IA | IA | IA | IA |
| Structure (sections, scènes, slides) | code | **IA, menu** | IA, menu | IA, menu | IA |
| Choix de composition (par unité) | code | code | **IA, menu de 10** | IA, menu de 14 | IA |
| Paramètres de composition | code | code | code | **IA, bornes** | IA |
| Écriture de la composition | code | code | code | **IA, 2 essais** | **IA, 3 essais + 1 de finition** |
| Espace parcouru par le classement (`spread`) | 0,6 | 1,1 | 1,5 | 1,9 | 2,4 |
| Contrôle statique de la page | complet | complet | **plancher** | plancher | plancher |
| Règles de charte réécrites sur la page | oui | oui | **non** | non | non |
| La mesure du rendu peut refuser | — | — | oui | oui | **non, elle répare** |

Ce tableau est celui des documents. Depuis le plan directeur d'octobre 2026, **à partir de High, l'IA a
le contrôle de la conception** des documents (arbre de composition libre) ; Max et Ultra lui donnent plus
de moyens (révisions sur la critique visuelle), jamais plus de liberté. Aucun CSS libre à aucun cran, et
une mesure qui répare (voir « Visuels, cartes de visite et documents » plus bas). La vidéo suit une autre
règle depuis le 14 octobre 2026 : l'IA conçoit et écrit TOUTES les scènes, à tous les crans (ci-dessous).

### Deux règles qui décident si l'échelle existe vraiment

1. **Le classement est semé par le livrable.** Le classement des mises en page ne dépendait que du
   numéro de page : trois projets d'un même style recevaient la même suite de mises en page, puis
   les mêmes menus, puis des documents jumeaux. La clé du livrable (le `designKey` de l'appelant)
   sème le plan du document et le classement des compositions (`@idem/graphic-engine`,
   `composition-engine/plan.ts` et `compose.ts#rank`), et la direction artistique *penche* au lieu
   d'*éliminer* : une composition hors des affinités du style reste possible.
2. **Les contrôles DIMINUENT quand le cran monte.** Un contrôle qui refuse une unité la renvoie au
   rendu du cran inférieur : trop de contrôles, et le cran payé le plus cher rend exactement ce que
   rend le cran Medium. Et un contrôle de chaîne se trompe — un numéro de page pris pour un chiffre
   inventé, une phrase coupée par une incise prise pour une phrase absente, le mot « placeholder »
   dans un nom de classe pris pour un gabarit non rempli.

   Les crans Low et Medium ne font pas écrire de composition à l'IA : le contrôle statique complet
   y a tout son sens. **Au-dessus de Medium, il tombe au PLANCHER** : la sécurité (un script, une
   ressource extérieure) et le vide (une page qui n'est pas une page). Les règles de charte ne
   réécrivent plus la composition, et au cran Ultra la mesure du rendu **répare sans jamais
   refuser**. Ce qui est détecté par ailleurs n'est pas perdu : il repart au modèle comme CONSEIL,
   avec la critique, sans lui coûter son travail.

   Les bonnes pratiques sont donc **portées par le code et par la consigne d'écriture** (le contrat
   de l'arbre d'auteur du moteur graphique, `agents/creative-planner.ts`) — et non arbitrées après
   coup. Ce qui a une réponse déterministe (hauteur, contraste, corps minimal, décor sur un texte)
   est corrigé par le code, et la correction est écrite dans la trace.

   **Trois natures de contrôle, et les confondre est l'erreur** : le CONTRAT (ce dont le code a
   besoin pour construire et mesurer — sans lui il n'y a pas de rendu du tout), la SÉCURITÉ, et le
   JUGEMENT. Seules les deux premières gardent la main au-dessus de Medium. Un chiffre inventé reste
   bloquant partout : « -40 % » quand la promotion est à -30 % est une faute, pas un écart de goût.

Les bonnes pratiques valent à **tous** les crans, parce qu'elles sont dans le code, pas dans le prompt :

- **vidéo** : lisibilité, tenues, contraste, zones de sécurité, rythme ;
- **documents** : gabarits non remplis, troncature, devise ;
- **visuels et cartes** : texte rogné, fond perdu, contraste ;
- **logo** : validité du SVG.

Ce que la DA exclut n'est jamais proposé à un agent : les menus sont filtrés par le code.

## Prix

Une source unique, partagée par l'API et le tableau de bord : `packages/shared-models/src/creativity/creativity.ts`.

| Cran | Multiplicateur | Business plan (70) | Vidéo 15 s (120) |
|---|---|---|---|
| Low | ×1 | 70 | 120 |
| Medium (par défaut) | ×1 | 70 | 120 |
| High | ×1,25 | 88 | 150 |
| Max | ×1,5 | 105 | 180 |
| Ultra | ×2 | 140 | 240 |

`withCreativity()` (`api/middleware/billing.middleware.ts`) enveloppe le barème habituel de chaque route de génération : prix fixe, `firstThenRevision` ou périmètre de la vidéo. Il lit `creativity` dans le corps de la requête, ou dans l'URL pour les flux en GET, et inscrit le cran au relevé (`note: creativity:<cran>`).

Les révisions ne sont pas concernées. L'export d'une vidéo à un périmètre plus large applique le cran choisi à la création.

## L'orchestrateur (`api/services/creativity/orchestrator.ts`)

Un livrable déclare des **tâches étroites**. Chacune porte :

- `minLevel` : le cran à partir duquel l'IA décide ;
- un prompt court ;
- `parse`, qui lit **et** valide la réponse ;
- `fallback`, la décision du code ;
- éventuellement `samples` et `score`, pour tirer plusieurs réponses en parallèle et départager les candidats par le code, jamais par un juge IA. Seule exception, le logo (voir plus bas) : l'esthétique d'un symbole ne se mesure pas, un jury départage donc les brouillons qui ont passé `svgGate`.

L'orchestrateur garantit :

- qu'aucune tâche au-dessus du cran ne part chez le modèle ;
- qu'un agent en panne, lent, muet ou inventif cède la place au repli, sans jamais d'erreur ;
- qu'une réponse illisible fait monter le modèle d'un étage, une seule fois, via `agents/agent-runtime.ts#runAgent` ;
- le respect du budget du livrable, la trace de chaque agent (`agents[]`) et les événements de progression.

Trois profils de modèle sont définis dans `AI_CONFIG.creative` :

- `agents` : un choix dans un menu ;
- `critic` : une relecture qui propose au plus cinq corrections ;
- `coder` : l'écriture de la composition, au cran Ultra.

Les lecteurs de réponse sont communs (`creativity/agent-io.ts`) :

- lignes `clé: valeur` ;
- choix par lettre ou par identifiant ;
- JSON, gras, puces ;
- nombres bornés.

S'y ajoute la **fiche de marque** (`brandSheet`) : couleurs, polices, DA, à faire et à éviter.

## Vidéo motion

Depuis le 14 octobre 2026 (moteur Motion Canvas, [VIDEO_ENGINE.md](VIDEO_ENGINE.md)), **le cran de la vidéo
choisit la puissance des modèles** : les étapes (directeur, planificateur, auteur de chaque scène,
autocorrection) et leur contexte sont identiques à tous les crans.

| Cran | Conception (`video.concept`, `video.planner`, `video.reviser`) | Code des scènes (`video.author`) |
| --- | --- | --- |
| Low | `qwen/qwen3.5-9b` | `qwen/qwen3-coder-30b-a3b-instruct` |
| Medium (défaut) | `qwen/qwen3.5-27b` | `qwen/qwen3-coder-next` |
| High | `qwen/qwen3.5-122b-a10b` | `deepseek/deepseek-v4-flash` |
| Max | `qwen/qwen3.5-397b-a17b` | `qwen/qwen3-coder` (480B) |
| Ultra | `deepseek/deepseek-v4-pro` | `deepseek/deepseek-v4-pro` |

Les échelles sont dans `config/creative-roles.ts#MODEL_LADDERS` (rôles `video.concept`, `video.planner`,
`video.reviser` sur l'échelle « design », `video.author` sur l'échelle « code »). L'autocorrection des scènes
monte d'un cran pour changer d'approche ([MOTION_VIDEO.md](MOTION_VIDEO.md#lautocorrection-des-scènes)). Prix
inchangés.

## Visuels, cartes de visite et documents : le moteur graphique (`packages/graphic-engine`)

Business plan, pitch deck, charte graphique, cartes de visite et visuels (flyers, publications,
bannières) sont composés par **un seul moteur**, le paquet `@idem/graphic-engine` du monorepo, importé
par l'API IDEM, l'API iVision et le cœur iVision (jamais contacté par HTTP). Le modèle écrit le
CONTENU — des blocs typés : prose, chiffres-clés, tableau, graphique… — ; le moteur compose la page :
il classe des compositions éprouvées (motifs paramétrés), compile un HTML déterministe, le mesure et le
répare dans Chromium. La jauge ne rallonge pas les prompts : elle change **qui décide, ce qui est
exploré et ce qui est permis** (profils du moteur, `composition-engine/profiles.ts`).

| Cran | Qui compose | Ce que l'IA décide |
|---|---|---|
| Low | le code | les mots seulement ; le meilleur motif pour ce contenu, sans un appel, déterministe |
| Medium | le code | les mots ; un tirage parmi les trois meilleurs motifs distincts, semé par la clé du livrable |
| High | l'auteur (`graphic.director`) | un ARBRE inédit (calques superposés, images du contenu, icônes et points placés un à un, grilles, formes du kit) ; les compositions éprouvées ne sont que des **références**. Le directeur artistique choisit le repli dans un menu de six |
| Max | l'auteur | + le repli réglé (paramètres, tension, accent) ; la critique visuelle renvoie ses notes à l'auteur, **une révision** |
| Ultra | l'auteur | + l'exploration la plus large, **deux révisions** sur la critique |

Un arbre jugé faible est révisé par SON auteur — jamais remplacé en silence par un gabarit. Le repli sur
une composition éprouvée n'arrive que si l'arbre est invalide ou bloquant, et la trace le dit
(`author_fallback`). Budgets par page : High 10 000, Max 18 000, Ultra 28 000 jetons
(`orchestrator/policies.ts#budgetFor`).

**Strict à tous les crans** (ce qui rendrait une page fausse) : aucun contenu perdu (un bloc oublié par
l'arbre d'auteur est rajouté, un doublon ou un bloc inconnu écarté), aucun texte libre (l'arbre ne
désigne que des blocs et des références au contenu), aucun chiffre recopié par un modèle (les tableaux
financiers, nuanciers et références sont des blocs `origin: system`, posés par le code), aucune couleur
ni police hors charte (le compilateur écrit chaque style, aucun CSS libre), une surface claire sauf
demande explicite. **Au-dessus de Medium**, les contrôles de JUGEMENT (page un peu creuse, contraste
limite…) deviennent des conseils qui ne coûtent jamais sa page à l'IA.

**Réparer au lieu de refuser.** Le code répare d'abord, dans cet ordre : textes ajustés au pixel
(`fit_text`), diapositive trop vide agrandie (`fit_grow`), texte trop pâle ramené vers l'encre de la
charte sur son fond réel (`fix_contrast`), décor posé sur un texte retiré (`drop_decor`), mise à
l'échelle bornée (`fit_scale`), accent et tension retirés (`simplify_chrome`), composition suivante
(`next_candidate`). À partir de High, une **réparation ciblée** par l'agent (changer de composition,
densifier, retirer le décor, compacter un bloc) intervient seulement quand le code n'a pas su. La
meilleure tentative mesurée est gardée, et chaque réparation est écrite dans la trace (`graphic.trace`).

Un modèle en panne, une réponse illisible ou un arbre bloquant : la composition du code, jamais une
erreur — et la trace dit pourquoi (`refused`, `failed`).

### Visuels

Les mots et la photo viennent du cœur iVision (`apps/ivision/core/src/visual` : `visual.copy.ts` —
rédacteur validé, aucun format ni chiffre inventé ; `visual.images.ts` — la photo de l'utilisateur
d'abord, cadrée sur son sujet). La page est un `renderSingle` du moteur sur une toile `flyer-*`. Une
retouche écrite (« change le titre ») ne change que les MOTS : la réponse du modèle est un JSON validé,
la page est recomposée avec la même graine sauf si une autre mise en page est demandée.

### Carte de visite

Un GABARIT partagé entre les porteurs : six rectos et quatre versos, chaque champ sorti en `{{champ}}`
dans un élément `data-field` (aux cotes d'impression, 85 × 55 mm, zone de sécurité respectée). Le
plancher d'impression est de 8,5 px CSS (≈ 6,4 pt). À l'export (`businessCardRender.service.ts`) comme
dans l'aperçu du tableau de bord, une valeur réelle plus longue que son marqueur (nom composé, adresse)
fait céder la taille des champs, par pas et jamais sous le plancher (`FIELD_FIT`) ; un mot encore trop
long se coupe plutôt que de sortir de la carte. Une régénération propose une autre carte (graine neuve).

### Documents : business plan, pitch deck, charte graphique

Le rédacteur reçoit le **contrat de contenu** du moteur (`contentContract`, `WRITING_RULES`,
`volumeDirective`, et le plan de section : angle, points, blocs). Sa réponse passe par
`sectionFromModel` : une page HTML rendue par erreur est récupérée (le texte gardé, la forme jetée,
rien d'inventé), les blocs posés par le code passent en tête. Le **document graphique**
(`services/graphic/graphic.service.ts#openGraphicDocument`) porte ce qui est commun aux pages : la
charte, le plan (chaque page reçoit d'avance une composition distincte de ses voisines), la mémoire de
diversité (jamais la même composition sur deux pages voisines ; les documents récents du projet,
gardés 30 jours, sont évités) et le cran. La couverture est composée par le moteur ; ses mots
(sur-titre, promesse) sont écrits une fois par projet (`common/coverBrief.service.ts`).

### Reprise et régénération ciblée

Le cran est enregistré avec le document (`design.level` sur le business plan et le pitch deck,
`branding.charterDesign.level` pour la charte). Une page refaite rouvre le document avec la même clé
(`documentDesignKey`) et le même cran : elle retrouve le plan, donc la composition réservée à sa place,
et ne détonne pas parmi ses voisines.

## Identité visuelle

### Le logo (`services/logo-engine/`, doc : [LOGO_ENGINE.md](LOGO_ENGINE.md))

> **Depuis le moteur de logos, la table ci-dessous décrit l'ancien pipeline** (`BandIdentity/logoTemplates.ts`, `logoCreative.ts`), qui n'est plus que le repli (`LOGO_ENGINE=legacy`, ou moteur en échec). Le moteur garde la même échelle de crans mais change de méthode : le modèle ne dessine plus de SVG, il choisit et décrit (Logo IR) ; le code construit, mesure et corrige. Voir [LOGO_ENGINE.md](LOGO_ENGINE.md) §5.

**Le logo est toujours généré au cran Ultra, au prix habituel de la session** (60 crédits, 10 par relance) : pas de jauge sur ses écrans, le contrôleur impose `ultra` quel que soit le point d'entrée (tableau de bord, chat), et ses routes facturent sans multiplicateur (`branding.routes.ts#chargeLogoSession`). L'échelle ci-dessous reste celle du service.

| Cran | Ce que l'IA décide |
|---|---|
| Low | rien : trois logos **composés par le code**. Treize marques (monogrammes, orbite, barres, éclosion, tissage, feuilles…) et cinq wordmarks, aux couleurs de la charte, dans sa police de titre vectorisée, avec le rayon d'angle et les affinités de forme de la DA. |
| Medium | le dessin de chaque proposition en SVG, puis critique et révision (pipeline historique). |
| High | + le **directeur de création** : trois directions distinctes, une par proposition. |
| Max | + deux brouillons par proposition ; ceux qui passent `svgGate` sont départagés par le **jury**. |
| Ultra | + trois brouillons par proposition. |

Le Medium garde le dessin par l'IA : le logo est le cœur de l'identité, et le cran par défaut ne devait pas régresser.

Toutes les propositions passent par le même lockup : le nom est posé sur les vraies métriques de la police (`lockup/logoLockup.service.ts`).

`lockup/wordmark.util.ts#safePathData` écarte les coordonnées non finies qu'opentype.js produit sur certaines polices variables (le « a » de Fraunces). Elles arrêtaient le rendu du chemin et coupaient le nom (« Verd ι »), y compris pour les logos dessinés par l'IA.

### La charte

Elle suit l'échelle des documents : chaque page est composée par le moteur graphique au cran demandé.
Les pages rédigées (logo, déclinaisons, palette, typographie, motifs, règles d'usage) portent leurs
spécimens posés par le code (nuancier, polices, logos, motifs exacts) et le texte d'usage du rédacteur ;
les pages de démonstration (direction artistique, réseaux sociaux) sont entièrement posées par le code.
Les mises en situation restent des photographies.

Palettes et paires typographiques restent des propositions de l'IA parmi lesquelles l'utilisateur choisit. Leur étape n'est pas facturée à la session et ne porte pas de jauge.

## L'interface : le sélecteur de créativité

`shared/components/creativity-picker` : un bouton compact « ✦ Créativité · Medium ▾ » posé **à côté du bouton de génération**, comme le choix d'effort d'un modèle. Son menu liste les cinq crans, une ligne chacun sur ce que l'IA décide, et leur prix pour ce projet ; le bouton de génération affiche le prix du cran retenu (`creativityCost` pipe). Accessible : `aria-haspopup="menu"`, cases `menuitemradio`, flèches, Échap.

Où il se trouve :

- vidéo (pied du créateur, détail d'un contenu) — `kind="video"` : le menu y parle de la puissance des modèles ;
- visuel (détail d'un contenu) ;
- carte de visite (génération et régénération) ;
- business plan (rangée de boutons du formulaire, état vide) ;
- pitch deck (création, deck vide) ;
- charte (au-dessus du choix du format, qui lance la génération).

Pas de sélecteur pour le logo (toujours Ultra).

## Contrôles

- `npm run check:video` : le moteur Motion Canvas de bout en bout (création, retouches, export, avec modèles simulés) ; voir [VIDEO_ENGINE.md §11](VIDEO_ENGINE.md#11-contrôles).
- `npm run check:creativity` couvre :
  - les prix et la normalisation, l'orchestrateur ;
  - le moteur graphique au service de la jauge : un visuel rendu et mesuré à chaque cran (aucun appel à Low et Medium, le choix à High, le réglage à Max, l'arbre d'auteur à Ultra), le modèle en panne ou illisible ;
  - la carte de visite : gabarit à marqueurs, plancher d'impression, et de vraies valeurs longues qui tiennent dans la carte une fois interpolées ;
  - les documents (business plan, deck) : qui compose à chaque cran, Low déterministe, l'arbre d'auteur d'Ultra mesuré et son repli ;
  - les logos du code (deux polices, trois types, `svgGate`, aucun `NaN`), le directeur de création et le jury (ancien pipeline) ;
  - le moteur de logos : `npm run check:logo` (150 vérifications, sans réseau ni modèle).
- `npm run check:graphic` (ou `npm run check:graphic-engine` à la racine) : le moteur graphique lui-même — contrats, jetons et contrastes, palettes des graphiques, compilateur, motifs, diversité, profils de la jauge, agents simulés, registre de capacités, et un corpus rendu et mesuré dans Chromium (decks, business plan, charte, carte, visuel).

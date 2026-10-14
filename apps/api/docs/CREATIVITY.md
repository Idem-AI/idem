# La jauge de créativité

Avant chaque génération, l'utilisateur choisit un cran. Le réglage vaut pour six livrables : vidéo motion, visuels et flyers, carte de visite, pitch deck, business plan et identité visuelle.

Quatre crans : **Low · Medium · High · Ultra** (le cran Max a été retiré le 14 octobre 2026 ; une donnée enregistrée en « max » est lue comme High, `normalizeCreativity`).

## Le principe : le cran choisit la puissance du modèle

Depuis le 14 octobre 2026 (vidéo, puis livrables graphiques), **le cran ne change ni les étapes ni la liberté de l'IA** : à tous les crans, l'IA conçoit et écrit le livrable librement, avec le même contexte. Le cran choisit le MODÈLE qui le fait — plus il monte, plus le modèle est puissant — et le prix suit.

| Cran | Conception (échelle « design ») | Écriture du code (échelle « code ») |
| --- | --- | --- |
| Low | `qwen/qwen3.5-9b` | `qwen/qwen3-coder-30b-a3b-instruct` |
| Medium (défaut) | `qwen/qwen3.5-27b` | `qwen/qwen3-coder-next` |
| High | `qwen/qwen3.5-397b-a17b` | `qwen/qwen3-coder` (480B) |
| Ultra | `deepseek/deepseek-v4-pro` | `deepseek/deepseek-v4-pro` |

Les échelles sont dans `config/creative-roles.ts#MODEL_LADDERS`. Rôles sur l'échelle « design » : `video.concept`, `video.planner`, `video.reviser`, `graphic.director`. Sur l'échelle « code » : `video.author`, `graphic.author`. Un barreau se remplace sans code (`IDEM_LADDER_<ÉCHELLE>_<CRAN>`, modèle de la liste blanche), un rôle à un cran aussi (`IDEM_ROLE_<RÔLE>_MODEL_<CRAN>`).

**Aucune critique esthétique, aucune réécriture automatique, aucun gabarit de repli, à aucun cran.** La seule vérification est technique : le rendu s'affiche-t-il ? Ce qui ne s'affiche pas est corrigé dans des bornes strictes (une tentative à la fois, jamais deux fois la même approche, la réécriture passe au modèle du cran au-dessus), puis signalé s'il résiste.

Ce que garantit le code, à tous les crans, parce que c'est de l'exactitude et non du goût : les textes et chiffres du contenu (posés par le code, jamais recopiés par un modèle), les tableaux et graphiques (dessinés par le code), la charte (couleurs et polices de la marque), les cotes du support (formats d'impression, zones de sécurité données à l'auteur), une surface claire sauf demande explicite.

## Prix

Une source unique, partagée par l'API et le tableau de bord : `packages/shared-models/src/creativity/creativity.ts`.

| Cran | Multiplicateur | Business plan (70) | Vidéo 15 s (120) |
|---|---|---|---|
| Low | ×1 | 70 | 120 |
| Medium (par défaut) | ×1 | 70 | 120 |
| High | ×1,25 | 88 | 150 |
| Ultra | ×2 | 140 | 240 |

`withCreativity()` (`api/middleware/billing.middleware.ts`) enveloppe le barème habituel de chaque route de génération : prix fixe, `firstThenRevision` ou périmètre de la vidéo. Il lit `creativity` dans le corps de la requête, ou dans l'URL pour les flux en GET, et inscrit le cran au relevé (`note: creativity:<cran>`).

Les révisions ne sont pas concernées. L'export d'une vidéo à un périmètre plus large applique le cran choisi à la création.

## L'orchestrateur (`api/services/creativity/orchestrator.ts`)

Il sert encore les tâches étroites hors moteurs (rédaction des visuels, logo). Un livrable y déclare des **tâches étroites**. Chacune porte :

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
- `coder` : l'écriture d'un code long (Logo IR, pages, scènes).

Les lecteurs de réponse sont communs (`creativity/agent-io.ts`) :

- lignes `clé: valeur` ;
- choix par lettre ou par identifiant ;
- JSON, gras, puces ;
- nombres bornés.

S'y ajoute la **fiche de marque** (`brandSheet`) : couleurs, polices, DA, à faire et à éviter.

## Vidéo motion

Moteur Motion Canvas ([VIDEO_ENGINE.md](VIDEO_ENGINE.md)) : directeur, planificateur, auteur de chaque scène et autocorrection, identiques à tous les crans ; le cran choisit les modèles (tableau ci-dessus). L'autocorrection des scènes monte d'un cran pour changer d'approche ([MOTION_VIDEO.md](MOTION_VIDEO.md#lautocorrection-des-scènes)).

## Visuels, cartes de visite et documents : le moteur graphique (`packages/graphic-engine`)

Business plan, pitch deck, charte graphique, cartes de visite et visuels (flyers, publications, bannières) passent par **un seul moteur**, le paquet `@idem/graphic-engine` (doc : [README du paquet](../../../packages/graphic-engine/README.md)). Depuis le 14 octobre 2026, **l'IA écrit chaque page en HTML Tailwind** :

1. le rédacteur écrit le CONTENU (blocs typés : prose, chiffres-clés, tableau, graphique…), comme avant ;
2. le **directeur** (`graphic.director`) écrit le LANGAGE VISUEL de la marque une fois par charte (gardé : Redis chez IDEM, Mongo chez iVision, relu par tous les livrables), puis, pour un document de plusieurs pages, son PLAN : une idée et une ligne par page ;
3. l'**auteur** (`graphic.author`, une fois par page) écrit la page en classes Tailwind, librement — aucun gabarit, aucun menu de compositions — au niveau d'un document professionnel (aucune décoration gratuite), avec sa ligne du plan, celles de ses voisines et la documentation des seuls outils dont la page a besoin. Il place les textes par leurs clés (`{{title}}`, `{{b2.items.0.value}}`) et pose les primitives du code (`<idem-chart>`, `<idem-table>`, `<idem-logo>`, `<idem-icon>`, `<idem-pattern>`) ;
4. le code **assainit** (scripts, cadres, adresses étrangères retirés ; tout CSS natif — `<style>`, `style=""` — retiré et signalé), **remplit** (textes exacts, graphiques et tableaux dessinés), **compile Tailwind** avec le thème de la marque, puis demande à Chromium si la page **s'affiche** ;
5. une page qui ne s'affiche pas (réponse sans HTML, rien de visible, rendu impossible) est corrigée : corriger (même cran) › réécrire autrement (cran au-dessus) › version minimale (cran au-dessus). Ce qui résiste lève `GraphicRenderError` : la section est en échec, et c'est dit.

Mêmes étapes et même contexte à tous les crans ; seul le modèle change. Ce qui n'est PAS fait, à aucun cran : mesure de débordement, contraste recalculé, score, critique visuelle, révision sur critique, repli sur une composition du code.

La page gardée (`SectionSpec` v2) est le CODE de l'auteur, clés et primitives en place : une retouche de texte, de chiffre ou de photo le **rejoue sans modèle** ; une retouche écrite de forme (« titre plus grand ») le donne à l'auteur avec la consigne. Une page de l'ancien moteur (arbre v1) ne se rejoue plus : elle est réécrite.

### Visuels

Les mots et la photo viennent du cœur iVision (`apps/ivision/core/src/visual` : `visual.copy.ts` — rédacteur validé, aucun format ni chiffre inventé ; `visual.images.ts` — la photo de l'utilisateur d'abord ; son point d'intérêt est donné à l'auteur, avec la classe de recadrage). La page est un `renderSingle` du moteur sur une toile `flyer-*`. Une retouche (`visual.edit.ts`, la même pour IDEM et iVision) : les mots ou la photo seuls → rejeu sans modèle ; une forme demandée → l'auteur réécrit sa page avec la consigne ; une autre mise en page demandée → page réécrite.

### Carte de visite

Un GABARIT partagé entre les porteurs, écrit par l'auteur aux cotes d'impression (85 × 55 mm, zone de sécurité et corps minimal de 8,5 px donnés à l'auteur) : chaque champ sort en `{{champ}}` dans un élément `data-field`. À l'export (`businessCardRender.service.ts`) comme dans l'aperçu, une valeur réelle plus longue que son marqueur fait céder la taille des champs, par pas et jamais sous le plancher (`FIELD_FIT`). Une régénération écrit une autre carte.

### Documents : business plan, pitch deck, charte graphique

Le rédacteur reçoit le **contrat de contenu** du moteur (`contentContract`, `WRITING_RULES`, `volumeDirective`, le plan de section). Sa réponse passe par `sectionFromModel` ; les blocs posés par le code (tableaux financiers, spécimens de charte, références) passent en tête, exacts. Le **document graphique** (`services/graphic/graphic.service.ts#openGraphicDocument`) porte ce qui est commun aux pages : la charte, la bible (écrite une fois, partagée par les pages composées en parallèle), la description du projet donnée au directeur, et le cran. Les bibles déjà écrites pour la marque (30 jours) sont données au directeur pour faire autrement. Les pages d'un business plan s'allongent librement (A4, le paginateur du PDF coupe entre les blocs de premier niveau) ; les slides, pages de charte, cartes et visuels sont des toiles fixes.

Le pitch deck ne réécrit plus une slide « trop textuelle » et ne déplace plus de texte vers les notes : le budget de texte de chaque slide est donné au rédacteur comme une indication. La grille de contrôle des sections (`verifySection`) ne passe plus sur les pages du moteur.

### Reprise et régénération ciblée

Le cran est enregistré avec le document (`design.level` sur le business plan et le pitch deck, `branding.charterDesign.level` pour la charte) : une page refaite rouvre le document au même cran.

## Identité visuelle

### Le logo (`services/logo-engine/`, doc : [LOGO_ENGINE.md](LOGO_ENGINE.md))

> **Depuis le moteur de logos, la table ci-dessous décrit l'ancien pipeline** (`BandIdentity/logoTemplates.ts`, `logoCreative.ts`), qui n'est plus que le repli (`LOGO_ENGINE=legacy`, ou moteur en échec). Le moteur garde la même échelle de crans mais change de méthode : le modèle ne dessine plus de SVG, il choisit et décrit (Logo IR) ; le code construit, mesure et corrige. Voir [LOGO_ENGINE.md](LOGO_ENGINE.md) §5.

**Le logo est toujours généré au cran Ultra, au prix habituel de la session** (60 crédits, 10 par relance) : pas de jauge sur ses écrans, le contrôleur impose `ultra` quel que soit le point d'entrée (tableau de bord, chat), et ses routes facturent sans multiplicateur (`branding.routes.ts#chargeLogoSession`). L'échelle ci-dessous reste celle du service.

| Cran | Ce que l'IA décide |
|---|---|
| Low | rien : trois logos **composés par le code**. Treize marques (monogrammes, orbite, barres, éclosion, tissage, feuilles…) et cinq wordmarks, aux couleurs de la charte, dans sa police de titre vectorisée, avec le rayon d'angle et les affinités de forme de la DA. |
| Medium | le dessin de chaque proposition en SVG, puis critique et révision (pipeline historique). |
| High | + le **directeur de création** : trois directions distinctes, une par proposition. |
| Ultra | + trois brouillons par proposition ; ceux qui passent `svgGate` sont départagés par le **jury**. |

Le Medium garde le dessin par l'IA : le logo est le cœur de l'identité, et le cran par défaut ne devait pas régresser.

Toutes les propositions passent par le même lockup : le nom est posé sur les vraies métriques de la police (`lockup/logoLockup.service.ts`).

`lockup/wordmark.util.ts#safePathData` écarte les coordonnées non finies qu'opentype.js produit sur certaines polices variables (le « a » de Fraunces). Elles arrêtaient le rendu du chemin et coupaient le nom (« Verd ι »), y compris pour les logos dessinés par l'IA.

### La charte

Elle suit le moteur graphique : chaque page est écrite par l'auteur au cran demandé (le cran choisit le modèle). Les pages rédigées (logo, déclinaisons, palette, typographie, motifs, règles d'usage) portent leurs spécimens posés par le code (nuancier, polices, logos, motifs exacts : l'auteur les place par leurs clés) et le texte d'usage du rédacteur. Les mises en situation restent des photographies.

Palettes et paires typographiques restent des propositions de l'IA parmi lesquelles l'utilisateur choisit. Leur étape n'est pas facturée à la session et ne porte pas de jauge.

## L'interface : le sélecteur de créativité

`shared/components/creativity-picker` : un bouton compact « ✦ Créativité · Medium ▾ » posé **à côté du bouton de génération**, comme le choix d'effort d'un modèle. Son menu liste les quatre crans, une ligne chacun sur la puissance du modèle, et leur prix pour ce projet ; le bouton de génération affiche le prix du cran retenu (`creativityCost` pipe). Accessible : `aria-haspopup="menu"`, cases `menuitemradio`, flèches, Échap.

Où il se trouve :

- vidéo (pied du créateur, détail d'un contenu) — `kind="video"` : textes propres à la vidéo ;
- visuel (détail d'un contenu) ;
- carte de visite (génération et régénération) ;
- business plan (rangée de boutons du formulaire, état vide) ;
- pitch deck (création, deck vide) ;
- charte (au-dessus du choix du format, qui lance la génération).

Pas de sélecteur pour le logo (toujours Ultra).

## Contrôles

- `npm run check:roles` : quatre crans, échelles autorisées, chaque rôle sur son échelle, un ancien « max » lu comme High.
- `npm run check:video` : le moteur Motion Canvas de bout en bout ; voir [VIDEO_ENGINE.md §11](VIDEO_ENGINE.md#11-contrôles).
- `npm run check:creativity` : les prix et la normalisation, l'orchestrateur ; le moteur graphique au service de la jauge (même travail à tous les crans, cran transmis au modèle, correction bornée puis erreur dite, rejeu sans modèle, Tailwind seul) ; la carte de visite (marqueurs, valeurs longues) ; les logos du code et les agents du logo.
- `npm run check:logo` : le moteur de logos (150 vérifications, sans réseau ni modèle).
- `npm run check:graphic` : le moteur graphique lui-même (contrats, matière à plat, assainissement, Tailwind compilé, les neuf graphiques, flux complet avec un auteur simulé dans Chromium).
- `check:brand`, `check:bpquality`, `check:mockups` rendent de vraies pages avec un auteur SIMULÉ (`api/scripts/fakeGraphicAuthor.ts`) : ils contrôlent ce qui suit l'écriture (traduction de marque, pagination, mockups), jamais l'esthétique.

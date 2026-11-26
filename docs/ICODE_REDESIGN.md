# Refonte iCode — un site neuf, pas une copie rafraîchie

Mis en place le 21/11/2026, à la suite d'un retour d'usage. Le constat :

- le nouveau site gardait les mises en page, le découpage et les habitudes de l'ancien ;
- le design restait presque le même ;
- le logo n'apparaissait jamais dans l'en-tête ;
- refaire le même site un autre jour écrasait la refonte précédente.

La règle désormais : **le contenu reste, la forme est neuve**. Les faits, les photos, le logo, les couleurs et le caractère de la marque sont gardés. Tout le reste est refait : le découpage, l'ordre, les mises en page, l'exécution et la typographie.

## Causes trouvées

| Symptôme | Cause |
|---|---|
| Mêmes mises en page | L'architecte devait reprendre **chaque page et chaque section** de l'ancien site, une pour une, dans le même découpage. |
| Même parcours | Le **menu de l'ancien site** était recopié tel quel, quelle que soit la nouvelle architecture. |
| Même style | La consigne du directeur artistique disait « garde l'ADN… refais l'exécution ». Le relevé de l'ancien style (rayons, ombres, boutons) lui servait de modèle. |
| Même typographie | Les polices du site étaient verrouillées, même quand c'étaient Inter/Inter ou Noto Sans/Noto Sans. |
| Logo invisible | Le logo vectorisé gardait la toile vide de l'image d'origine : EKnumeriK faisait 10 px de haut dans un en-tête de 36 px. Une icône seule s'affichait sans le nom. |
| Refonte fusionnée | L'API rouvrait le projet déjà né de ce site (`projectForSite`). L'atelier enregistrait ensuite le code et la conversation dans le projet ouvert. |

## Ce qui a changé

### Architecture : le contenu reste, la forme change (`siteEngine/manifest.ts`, `redesign/brief.ts`)

- **Refonte complète** (« Tout », « Surtout les textes ») :
  - aucun contenu ne disparaît : chaque section d'origine est reprise dans `sources` ;
  - l'architecte peut regrouper, séparer, réordonner, fusionner des pages minces ou créer une page qui manquait.
- **« Surtout le design »** : les pages de l'ancien site restent des pages, et l'ancien menu est repris.
- **Forme d'avant** : le code devine la forme qu'avait chaque section (`oldShapeOf`, `redesign/inventory.ts`) : grille de cartes, liste, texte + image, galerie, bandeau, formulaire. L'architecte la voit dans le plan (« forme actuelle : … »).
- **Contrôle après l'architecte** : `departFromOld` remplace une composition qui reproduit la forme d'avant, sauf pour les ouvertures, les galeries et les formulaires. Par exemple, les cartes deviennent une mosaïque, des rangées ou des onglets ; un texte + image devient une mise en page éditoriale ou un visuel pleine largeur.
- **Gabarits** : une refonte prend au moins la gamme `high`. Le prix est le même à tous les crans.

### Design (`redesign/brief.ts`, API `siteProject.service.ts`)

- **Directeur artistique** : il reçoit l'ancien style comme ce dont il faut s'éloigner. Il garde le logo, les couleurs et le caractère de la marque, et choisit une autre exécution en suivant la personnalité du projet. Chaque refonte étant un nouveau projet, la personnalité change à chaque fois.
- **Typographie** (`redesignTypography`) :
  - une police de titre propre à la marque est gardée avec ses fichiers ; le texte courant reçoit l'accord éprouvé pensé pour elle s'il était par défaut ou identique au titre ;
  - une police de titre par défaut (`DEFAULT_FONTS` : Inter, Roboto, Open Sans, Poppins…) est remplacée par la typographie tirée du logo, sinon par la variante de même famille. Jamais par une autre police par défaut.
  - Le changement est annoncé dans la conversation (« Typographie améliorée : Inter → Manrope / Inter »).

### Logo dans l'en-tête (API `brandMark.service.ts`, `siteData.ts`)

**Il y a toujours une marque dans l'en-tête.** Le code, sans modèle, calcule la marque d'en-tête du projet et la range dans `branding.logo.header` :

- le logo est **rogné sur son encre** : le viewBox est recadré pour un SVG, l'image est rognée pour un PNG ;
- **logotype** (rapport ≥ 1,75, le nom est écrit dedans) : affiché seul ;
- **icône** (symbole, lockup empilé, favicon, nom écrit à côté sur l'ancien site) : l'icône **et** le nom du site ;
- **logo clair** sur transparent : une autre déclinaison est préférée ; à défaut, le logo est posé sur une pastille sombre ;
- **sans logo** : le nom du site.

Elle est calculée :

- à l'import d'une refonte ;
- au montage du socle (`/api/scaffold`, borné à 4 s) ;
- au début d'une refonte qui ne l'a pas encore.

Elle est recalculée quand le logo change (`from`) ou quand la règle change (`v`).

Route : `GET /appgen/brand-mark/:projectId`.

Le relevé du site note aussi `logo.nameBeside` : le nom écrit en texte à côté du logo dans l'ancien en-tête.

### Une refonte = une nouvelle session

- **API.** `createProjectFromSite` avec `withContent` ne rouvre plus jamais le projet né du même site. iVision, qui ne fait que lire la marque, rouvre toujours le même projet, sans doublon.
- **Serveur iCode** (`redesignTarget`, `commands/workflows/redesign.ts`). Le projet ouvert reçoit la refonte seulement s'il n'en porte pas déjà une :
  - un projet sans `siteSource` la reçoit ;
  - un projet né d'un site la reçoit si l'atelier est vierge.
  - Sinon, un nouveau projet naît, et l'accord aux politiques est demandé sur la carte.
- **Atelier** (`AiChat/chat/index.tsx`) :
  - il dit au serveur si l'espace était vierge (`context.workspace`) ;
  - il adopte le nouveau projet dès qu'il est annoncé ;
  - il n'écrit plus rien dans l'ancien projet (enregistrement toutes les 20 s, fin de réponse) ;
  - à la fin, il ouvre la conversation du nouveau projet. Elle commence à la réponse de la refonte, sous un nouvel identifiant. L'ancienne reste intacte dans son projet.

### Les images : regardées, choisies, sinon cherchées, sinon générées (25/11/2026)

Avant, chaque section reprenait les images de ses sections d'origine sans que personne ne les regarde. Une photo de plage dans l'ouverture d'un pressing restait dans l'ouverture.

1. **Le manifeste** (API, `SiteImport/siteImageReading.ts`). À la recopie, chaque image de contenu (60 au plus, 160 px au moins) est regardée par le modèle de vision. Il reçoit une vignette de 512 px et rend un JSON court : la description, la nature (photo, illustration, 3D, logo, icône, capture, texte, décor), les personnes, le texte incrusté, l'aspect de photo de banque et les défauts. La lecture reste objective : elle ne dit pas si l'image convient. Elle tourne dans sa propre file (8 à la fois), sans ralentir la recopie. Pour un nouveau projet, recopie et lecture partent dès la création du projet, pendant le logo, la typographie, la DA et les motifs. Elles sont donc cachées derrière des étapes qui existaient déjà. Une image non lue au bout de 25 s reste sans `vision`.
2. **Le choix** (iCode, `mediaDirector.ts`). L'agent média reçoit le manifeste (`siteImageLibrary`, sans les logos, icônes et captures) dans **le même appel** qu'avant. Pour chaque section, il retient l'image d'origine qui sert le projet, ou aucune. Il dit alors quoi chercher : photo, illustration ou 3D, avec le sujet et la requête. Le code borne ses choix (`castSiteImages`) :
   - une image ne sert qu'une fois ;
   - une image fait au moins 400 px ;
   - une ouverture veut une image en paysage, de 1 000 px au moins, nette, sans texte ni défaut (`opensWell`) ;
   - un choix refusé reprend le visuel décrit par l'agent.

   Sans réponse de l'agent, les images d'origine restent à leur place, avec les mêmes bornes.
3. **Ailleurs** (`mediaPipeline.ts`). Les banques configurées viennent d'abord (Pexels, Pixabay, Unsplash ; filtre illustration pour une illustration), puis la génération.
4. **Sans attente.** Une génération ne retient plus la section. Un visuel provisoire est rendu tout de suite :
   - une photo : une requête de banque plus large, sinon le motif ;
   - une illustration : le dessin composé par le code ;
   - une vidéo : une photo.

   La génération le remplace dans `media.ts` dès qu'elle arrive, par rechargement à chaud. Le nombre de visuels ne change pas, donc la section n'est pas recomposée. À la fin, les générations encore en cours sont attendues au plus 45 s après la dernière section (`LATE_MEDIA_GRACE_MS`), pendant la traduction et la charte. Au-delà, le provisoire reste.

Un relevé antérieur (sans `vision`) ou une vision indisponible : la règle d'avant s'applique (`siteImageLibrary` → `null`).

## Contrôles

- `npm run check:redesign` (apps/appgen/apps/we-dev-next) : 29 contrôles, sans réseau ni modèle. Ils couvrent les formes, le départ des formes d'avant, les règles des agents, la nouvelle session et la marque (TSX compilé).
- `npm run check:image-casting` (apps/appgen/apps/we-dev-next) : 28 contrôles à modèle simulé. Ils couvrent le manifeste, les bornes, l'agent, le repli, le provisoire remplacé et la lecture de la réponse de vision.
- `npm run check:brand-mark` (apps/api) : rognage, logotype/icône, logo clair, fond opaque. `-- <dossier>` mesure en plus les `.svg` d'un dossier et rend une planche à 36 px.

Pas encore vu sur une vraie refonte : aucun essai payant n'a été lancé. Il reste à vérifier dans l'atelier :

- le passage au nouveau projet et à sa conversation ;
- l'en-tête avec une icône + le nom ;
- la typographie annoncée.

### Chaque image avec son élément (26/11/2026)

Sur une page d'équipe refaite, les visages ne correspondaient plus aux noms. Cause générale : les sections du
catalogue qui illustrent une liste (équipe, projets, services, cartes, articles : 15 gabarits) posent le visuel n°i
sur l'élément n°i, alors que l'ordre des éléments vient du rédacteur et celui des visuels du relevé, du tri par
netteté et de l'agent média. Le relevé, lui, rangeait images et textes dans deux listes séparées : le lien « cette
photo ↔ ce nom » était perdu dès le départ, et aucune description visuelle ne peut le retrouver (un visage ne dit pas
son nom).

- **Relevé** (`site-crawler.ts`) : dans une section à plusieurs images, chaque image garde sa `caption` : sa
  `<figcaption>`, sinon le texte du plus grand bloc qui la contient sans contenir une autre image (la carte), 320 signes
  au plus.
- **Lecture** (`siteImageReading.ts`) : la légende est donnée au modèle de vision pour qu'il dise le rôle de l'image
  (« portrait du membre … ») ; les personnes sont décrites de façon à être distinguées.
- **Images liées** (`boundImages`, `redesign/inventory.ts`) : au moins deux images d'une section, chacune avec sa
  propre légende. Elles gardent l'ordre de l'ancien site (`bestFirst` ne les trie plus), restent dans le manifeste même
  trop petites pour être lues, sont réservées à leur emplacement (`boundImages` du `MediaSlot`) : l'agent média ne les
  déplace pas, ne les prête à aucune autre section, et le seuil de 400 px ne s'y applique pas.
- **Appariement** (`redesign/binding.ts`, `bindMediaToItems`) : une fois les textes rédigés, chaque image rejoint
  l'élément qui reprend un mot distinctif de sa légende (un mot partagé par deux légendes, comme « co-founder », ne
  compte qu'à moitié). Les éléments appariés passent en tête ; un élément sans image n'en reçoit qu'une sans légende ;
  une image légendée sans élément n'est posée nulle part. La section est recomposée si l'ordre a bougé, et ses visuels
  n'entrent dans `media.ts` qu'après (`heldForBinding`) : jamais, même un instant, une photo sous le mauvais nom.
- **Auteur de code** (section hors catalogue) : chaque visuel lui est donné avec sa légende, et la consigne de le poser
  dans la carte de cet élément-là.

Banc : `npm run check:image-binding` (we-dev-next, 27 vérifications, sans modèle).

### Relire le site d'origine, et ce que savent les agents (26/11/2026)

« Rescanne mon site » n'aboutissait pas : l'agent qui lit la demande ne connaissait que sept déroulés, la relecture
n'en faisait pas partie, et la demande tombait chez l'agent de retouche, qui a pour consigne de toujours modifier une
partie du site.

- **Catalogue des capacités** (`we-dev-next/src/commands/capabilities.ts`) : ce qu'iCode sait faire sur un projet,
  chaque capacité avec ce qu'elle fait, ce qu'elle n'est pas, quand elle est disponible et sa commande « / ». L'agent
  qui lit la demande (`intent.ts`, gratuit, avant toute facturation) reçoit les capacités disponibles dans le
  contexte ; l'agent de retouche (`edit.ts`) reçoit le catalogue entier. **Une capacité ajoutée à iCode s'écrit là** :
  les deux agents la connaissent aussitôt.
- **`/rescan`** (`commands/workflows/rescan.ts`) : relit le site d'origine DANS le projet ouvert (l'API relève toutes
  les pages, recopie les images avec leurs légendes, garde la marque du projet), puis refait le site. Une question
  (priorité : tout, design, textes) dit qu'une génération sera décomptée ; le client garde un point de restauration.
  Le site d'origine vient de `branding.siteSource`, sinon de `.idem/plan.json` (projet relu dans IDEM s'il n'est pas
  joint). Sans site d'origine : refonte ordinaire, adresse demandée.
- **Filet de la retouche** : une demande qui n'est pas une modification des fichiers (relire le site, traduire, mettre
  en ligne…) est nommée (`elsewhere`), avec sa commande ; rien n'est modifié. La retouche étant facturée avant
  l'aiguillage, c'est l'agent qui lit la demande qui doit la reconnaître d'abord.

Banc : `npm run check:commands` (85 vérifications, dont 11 sur la relecture et le catalogue).

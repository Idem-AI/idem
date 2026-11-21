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

## Contrôles

- `npm run check:redesign` (apps/appgen/apps/we-dev-next) : 29 contrôles, sans réseau ni modèle. Ils couvrent les formes, le départ des formes d'avant, les règles des agents, la nouvelle session et la marque (TSX compilé).
- `npm run check:brand-mark` (apps/api) : rognage, logotype/icône, logo clair, fond opaque. `-- <dossier>` mesure en plus les `.svg` d'un dossier et rend une planche à 36 px.

Pas encore vu sur une vraie refonte : aucun essai payant n'a été lancé. Il reste à vérifier dans l'atelier :

- le passage au nouveau projet et à sa conversation ;
- l'en-tête avec une icône + le nom ;
- la typographie annoncée.

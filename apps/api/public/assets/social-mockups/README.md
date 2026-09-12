# Bibliothèque de mockups de réseaux sociaux

Les pages « Bannières réseaux sociaux » et « Publications sociales » de la charte
graphique montrent la marque **dans l'interface réelle de chaque réseau**. Ces
interfaces sont des gabarits **HTML/CSS** versionnés ici : aucune image de base,
aucun modèle d'image. Le code y dépose ce qui appartient au projet (logo,
bannière, nom, promesse, visuels), puis Chrome en fait une capture.

## Pourquoi du HTML et pas des images

Un mockup en image oblige à poser le logo et les textes au pixel près, par-dessus
un contenu de démonstration qu'il faut d'abord effacer. En HTML, chaque élément
de marque est un emplacement nommé : on le remplit, la mise en page suit (un nom
long est tronqué proprement, une bannière garde son ratio), et on peut retoucher
un gabarit dans un éditeur de texte.

Les clones HTML trouvés en ligne (dépôts GitHub « instagram clone », gabarits
CodePen de cartes) ne couvraient qu'Instagram et des cartes génériques, avec des
interfaces datées et des dépendances (Bootstrap, Font Awesome). Les gabarits ont
donc été dessinés pour IDEM d'après les interfaces publiques de chaque réseau.

## Gabarits

| Fichier | Réseau | Type | Taille (px) | Emplacement de marque |
|---|---|---|---|---|
| `facebook-page.html` | Facebook | page | 1200 × 760 | couverture 940 × 348 |
| `linkedin-page.html` | LinkedIn | page entreprise | 1200 × 660 | couverture 748 × 128 |
| `x-profile.html` | X | profil | 1200 × 640 | en-tête 598 × 200 |
| `youtube-channel.html` | YouTube | chaîne | 1200 × 720 | bannière 1040 × 172, vignette 424 × 238 |
| `instagram-profile.html` | Instagram | profil | 1200 × 720 | 6 tuiles de grille |
| `instagram-post.html` | Instagram | publication | 400 × 720 | visuel 400 × 500 (4:5) |
| `linkedin-post.html` | LinkedIn | publication | 400 × 573 | visuel 386 × 386 (1:1) |
| `facebook-post.html` | Facebook | publication | 400 × 572 | visuel 388 × 388 (1:1) |
| `x-post.html` | X | publication | 440 × 315 | visuel 366 × 192 (1,9:1) |

Les tailles et formats sont déclarés dans `manifest.json` ; ils doivent rester
identiques au CSS du gabarit. Les visuels de publication ont exactement le
rapport des formats du générateur de visuels (`post` 1200 × 1500, `square`
1080 × 1080, `banner` 1200 × 630) : ils ne sont jamais recadrés.

## Marqueurs

`{{clé}}` reçoit un texte **échappé**. `{{{clé}}}` reçoit du **HTML produit par
le code**, jamais par un modèle.

| Marqueur | Contenu |
|---|---|
| `{{brandName}}` | nom de la marque |
| `{{handle}}` | identifiant de compte, sans `@` |
| `{{category}}` | secteur, deux ou trois mots |
| `{{bio}}` | présentation courte / promesse |
| `{{postText}}` | texte d'une publication |
| `{{caption}}`, `{{hashtags}}` | légende et mots-dièse (Instagram, X) |
| `{{title}}` | titre de la vidéo mise en avant (YouTube) |
| `{{avatarSrc}}`, `{{avatarGround}}` | logo de l'avatar et son fond contrasté |
| `{{mediaSrc}}` | visuel de la publication (data URI ou URL) |
| `{{{coverHtml}}}` | bannière composée à la taille de l'emplacement |
| `{{{mediaHtml}}}` | vignette composée (YouTube) |
| `{{{tiles}}}` | tuiles de la grille (Instagram) |
| `{{{fontLinks}}}` | liens Google Fonts des polices de la marque |

## Ajouter un réseau

1. Créer `templates/<id>.html` : document complet, `body` à la taille finale,
   polices d'interface chargées depuis Google Fonts, aucune ressource locale.
2. Déclarer l'entrée dans `manifest.json` (`kind`, taille, `cover` / `media`).
3. Lancer `npm run check:mockups` : chaque gabarit est rendu avec une marque de
   test, et le contrôle échoue si un marqueur reste sans valeur ou si le contenu
   déborde de la page.

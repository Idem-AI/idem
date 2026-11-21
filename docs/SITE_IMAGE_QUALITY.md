# Netteté des images d'une refonte (iCode)

*Mis en place le 21/11/2026. Plan d'origine : `PLAN-QUALITE-IMAGES-REFONTE-2026-11-21.md` (dossier IDEM AFRICA).*

Une refonte reprend les images de l'ancien site. Certaines paraissent floues dans le nouveau design. Il y a trois
raisons possibles :

- la page affichait une vignette alors que l'original existe ;
- l'image est trop petite pour sa nouvelle place ;
- le fichier lui-même est abîmé (flou, déjà agrandi, JPEG trop compressé).

Le système traite ces trois cas **sans IA payante** : aucun jeton, aucun fournisseur, aucun quota. Il ne retouche
une image **que si la mesure le demande et que l'utilisateur l'accepte**.

## Le parcours

1. **Relevé** (`apps/ivision/core/src/site/site-crawler.ts`) : pour chaque image, on prend la plus grande variante
   annoncée par la page (descripteurs `w`/`x` du `srcset`, `<source>` d'un `<picture>`), puis l'original derrière
   une vignette de plateforme (`originalImageUrl`). L'adresse vraiment affichée par la page est gardée en `fallback`.
2. **Recopie** (`hostInventory`, `apps/api/api/services/SiteImport/siteProject.service.ts`) : la grande variante
   est téléchargée, ou l'adresse de secours si elle n'existe pas. L'image est mesurée (`quality`) et ses dimensions
   réelles remplacent celles annoncées par la page. Journal : `site_import.image_quality` (images, signalées,
   variantes plus grandes obtenues).
3. **Placement** (`we-dev-next/src/siteEngine/orchestrator.ts`, `bestFirst`) : dans chaque section, la plus grande
   et la plus nette des images d'origine passe en tête. C'est celle que le design affiche en grand.
4. **Génération normale** : le site s'affiche avec les images telles quelles, sans délai ajouté.
5. **Relevé dans l'aperçu** : le point d'entrée des pages (`renderEntry`, `project.ts`) contient un pont actif
   seulement en développement (`import.meta.env.DEV`, absent du site publié). Il rapporte la taille affichée de
   chaque image (`MEASURE_IMAGES` → `IMAGES`) et entoure les images demandées (`HIGHLIGHT_IMAGES`).
6. **Évaluation** : `POST /appgen/site-images/assess` dit quelles images paraîtront floues **à leur place**. Le
   calcul compare la taille affichée × 2 (écran Retina) aux pixels du fichier, et ajoute les défauts propres au
   fichier. La mesure est faite en vue large (≥ 1 024 px), la plus exigeante.
7. **Bandeau** (`SiteImageQualityBanner.tsx`, au-dessus de l'aperçu, sans le couvrir) :
   « N images de votre site manquent de netteté », avec trois choix : **Améliorer les images** · Voir lesquelles ·
   Plus tard.
8. **Amélioration** : `POST /appgen/site-images/enhance` traite une image à la fois et renvoie un flux SSE
   (`start`, `image`, `done`), avec un battement toutes les 15 s et jamais de reconnexion. Chaque image améliorée
   est déposée **à côté** de l'originale (`…-hd-<stamp>.webp`), puis son adresse remplace l'ancienne dans le code ;
   l'aperçu se met à jour par Vite. **Revenir aux originales** rétablit les anciennes adresses : rien n'est supprimé.

Les images concernées sont seulement celles recopiées d'un ancien site (`users/<uid>/projects/<id>/site-assets/`).
L'API refuse toute autre adresse. Un site généré avant le 21/11/2026 n'a pas de pont, donc pas de bandeau.

## La mesure (`packages/design-tools/src/image-quality.ts`)

| Mesure | Calcul | Seuil |
|---|---|---|
| **Mollesse** | énergie du détail de bande moyenne (aller-retour à mi-taille) ÷ énergie du laplacien | > **0,40** → `blurry` |
| **Blocs JPEG** | écarts entre pixels sur la grille 8×8 ÷ écarts hors grille (JPEG seulement, à la taille du fichier) | > **1,45** → `blocky` |
| **Résolution utile** | pixels du fichier ÷ (taille affichée × 2) | < **0,75** → `small` |
| **Photo** | ≥ 125 teintes et < 52 % d'aplats sur une vignette | décide si le modèle est permis |

La netteté brute ne sert pas à juger : selon le sujet, elle va de 0,13 (produit net sur fond uni) à 1,25 (façade
nette). La mollesse, elle, dépend peu du sujet :

- photos Kodak nettes : 0,27 à 0,36 ;
- images agrandies ×2 : 0,42 à 0,55 ;
- images floues : 0,58 à 0,9.

Calage le 21/11/2026 sur 14 photos du jeu Kodak, deux portraits de l'équipe et des illustrations.

## L'amélioration (`packages/design-tools/src/upscale.ts`)

- **Palier sharp** (défaut léger, ou image non photographique) : agrandissement Lanczos 3, puis accentuation douce.
  Pour un JPEG compressé, les blocs sont d'abord adoucis et l'accentuation reste faible, car une accentuation forte
  les redessine. Durée : 0,3 à 0,4 s.
- **Palier modèle local** (photo, défaut fort, **aucun visage**) : Real-ESRGAN General x4v3, en export ONNX officiel
  de Qualcomm AI Hub (v0.67.0, licence BSD-3, 4,5 Mo, empreinte vérifiée). Il tourne dans `onnxruntime-web` en
  WebAssembly, dans un `worker_thread` pour que l'API ne se fige pas. L'image est découpée en tuiles de 128 px qui
  se recouvrent de 12 px et sont fondues aux coutures. Un seul calcul à la fois par processus, avec un budget de
  25 s par image ; s'il est dépassé ou si le calcul échoue, on repasse par sharp.
- **Visages** (`faces.ts`) : UltraFace RFB-320 (MIT, 1,2 Mo, environ 10 ms). Une image avec un visage ne passe
  jamais par le modèle, qui lisse les visages. Si le détecteur est indisponible, on suppose qu'il y a un visage.
- **Garde-fous** : une teinte moyenne qui bouge de plus de 6/255 fait rejeter le résultat (les photos ne sont
  jamais recolorées). Le résultat n'est gardé que s'il est plus net qu'un simple agrandissement (+5 %) ou, pour un
  JPEG compressé, s'il a perdu ses blocs.

Mesuré le 21/11/2026 sur un i9 de portable (4 fils) :

| Cas | Durée |
|---|---|
| 320 → 1 280 px, premier appel (chargement compris) | 5,5 s |
| 480 → 1 600 px | 12 s |
| JPEG qualité 10 | 8,5 s |
| Une tuile (4 fils) | 0,43 s |
| Une tuile (8 fils) | 0,27 s |

## Réglages

| Variable | Effet |
|---|---|
| `IDEM_UPSCALE_MODEL=off` | sharp seul, sans modèle |
| `IDEM_UPSCALE_THREADS` | fils du calcul (défaut 4) ; 8 si la machine le permet |
| `IDEM_UPSCALE_MODEL_URL` | archive du modèle servie par notre stockage (même empreinte exigée) |
| `IDEM_FACE_MODEL_URL` | détecteur de visages servi par notre stockage (même empreinte exigée) |
| `IDEM_DESIGN_TOOLS_OFFLINE=1` | aucun téléchargement : sharp seul, et visage supposé |
| `IDEM_DESIGN_MODELS_DIR` | dossier des modèles (partagé avec CLIP) |

Les fichiers des modèles sont téléchargés au premier usage. Le conteneur de l'API doit donc pouvoir joindre
`qaihub-public-assets.s3.us-west-2.amazonaws.com` et `github.com`, ou bien ces deux fichiers doivent être servis
depuis MinIO.

## Contrôle

`npm run check:image-quality` dans `packages/design-tools` lance 34 vérifications sur 3 photos Kodak versionnées
(`scripts/fixtures`). Ajouter `--model` pour inclure le palier modèle (téléchargement gratuit). Ce contrôle est à
relancer après tout changement de seuil.

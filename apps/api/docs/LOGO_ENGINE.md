# Le moteur de logos

`apps/api/api/services/logo-engine/` — un moteur TypeScript autonome (Node seul, ni React ni navigateur) qui génère les 11 catégories de logos et livre un vrai SVG vectoriel, vérifié.

Il repose sur ces principes : **une représentation intermédiaire structurée, des outils spécialisés, un rendu déterministe, une boucle de contrôle qualité, un modèle qui décide mais ne construit pas**.

Avant : le modèle dessinait le SVG (≈ 3 400 tokens de consigne + 3 500 de SVG par brouillon, trois brouillons au cran Ultra, plus critique et révision). Maintenant : le modèle choisit et décrit (quelques centaines de tokens) ; le code construit le SVG, le mesure et le corrige.

| | Ancien pipeline | Moteur |
|---|---|---|
| Medium | ≈ 28 700 tokens | ≈ 400 |
| Ultra | ≈ 77 300 tokens | ≈ 14 500 (dont la vision) |
| Low | 0 (13 marques fixes) | 0 (58 générateurs × paramètres × recettes) |
| Un logo | ~3 500 tokens de SVG, différent à chaque appel | ~100–400 tokens de Logo IR, rendu identique à chaque appel |

Chiffres estimés par `npm run check:logo` §13 (`estimateTokens`, modèle simulé).

## 1. Vue d'ensemble

```
brief + charte ──► planificateur ──► Logo IR ──► moteur graphique ──► SVG ──► validation ──► export
                     (sans token)       ▲        (Paper.js, OpenType.js,    (technique +      (SVG, variantes,
                                        │         SVGO, resvg-js)            visuelle)         PNG, logo.json)
                      agent (selon le cran) ◄────────── patch ciblé ◄──────────┘
                      directeur · auteur · jury · critique
```

```
logo-engine/
  ir/          logo.schema.ts (Zod) · patch.ts            le contrat, indépendant du modèle IA
  kernel/      geometry.ts (interface) · paper.kernel.ts   la géométrie, derrière une interface
               typography.ts · fontProviders.ts            OpenType.js, polices
               primitives.ts                               formes (arcs, polygones arrondis…)
  render/      layers.ts · text.ts · compose.ts            couches, typographie, composition
               generators/ (58)                            symboles : abstrait, figuratif, mascotte
               variants.ts · svg.ts · build.ts             variantes, SVG + SVGO, compilateur
  raster/      rasterizer.ts · measure.ts                  resvg-js (repli sharp), mesures de pixels
  validate/    technical.ts · visual.ts · assess.ts        validation, rapport qualité
               fingerprint.ts · autofix.ts                 empreintes, corrections sans token
  planner/     brief.ts · recipes.ts · planner.ts          exploration déterministe
  agent/       tasks.ts · agent.ts                         directeur, auteur, jury, critique
  export/      package.ts                                  livrable
  pipeline.ts  idem.service.ts  index.ts                   construire→mesurer→corriger · adaptateur IDEM · API
```

Les bibliothèques sont derrière des interfaces internes : `GeometryKernel` (Paper.js aujourd'hui), `FontProvider` (chargeur de polices d'IDEM, ou un fichier local), `Rasterizer` (resvg-js, sharp en repli), `AgentCall` (runtime d'agents d'IDEM). Remplacer l'une ne touche ni les générateurs, ni la composition, ni l'agent — `check:logo` §3 fait tourner le moteur sur un noyau de test.

Seul `idem.service.ts` connaît IDEM (projet, charte, runtime d'agents, vision).

## 2. Le Logo IR (`ir/logo.schema.ts`)

L'agent ne produit jamais un bloc de SVG libre : il décrit son intention.

```ts
interface LogoDocument {
  version: '1.0';
  brief:  { brandName, tagline?, industry, audience, personality[] };
  concept:{ type: 'wordmark' | 'lettermark' | 'letterform' | 'pictorial' | 'abstract' | 'mascot'
                | 'combination' | 'emblem' | 'dynamic' | 'minimal' | 'negative-space';
            rationale, motifs[], recipe? };
  canvas: { width, height | 'auto' };
  palette:{ ink, ink2?, accent? };
  composition: { layout, gap, symbolScale?, align, padding, taglineScale };
  layers: LogoLayer[];      // union discriminée : shape | text | generator | boolean | repeat | group
  variants: LogoVariant[];  // primary | monochrome | inverted | symbol | wordmark | dynamic (+ retouches de couche)
  meta: { seed, engine? };
}
```

- **Couleurs = rôles** (`ink`, `ink2`, `accent`, `paper`), jamais un hexadécimal dans une couche. `paper` est une **découpe** : le fond transparaît. C'est ce qui rend monochrome, inversé et palette de marque gratuits.
- **Géométrie** : rect, cercle, ellipse, polygone (arrondi), étoile, anneau, arc, superellipse, trait, polygone libre, tracé (`path`, réservé au cran Ultra) ; booléens `union / subtract / intersect / exclude` (masques, découpes, espace négatif) ; répétitions (rosace, miroirs, rangée, grille) ; groupes.
- **Typographie** : famille, graisse, interlettrage, casse, texte sur arc, dix effets (`dot`, `underline`, `bar`, `slice`, `ligature`, `dotReplace`, `swapRound`, `cutCorner`, `accentChar`, `italic`). Les lettres sont **toujours** converties en contours (aucun `<text>`).
- **Robustesse** : un nombre hors bornes est ramené dans ses bornes (jamais rejeté : 14 pétales → 12), les clés inconnues sont ignorées, les défauts posés. Seul est refusé ce qui est impossible à interpréter (type de couche inconnu, identifiant en double, couleur non hexadécimale, plus de 48 couches).
- Versionné (`version`), validable, sérialisable : `logo.json` rouvre le logo **à l'identique**.

Repère des couches symbole : boîte 0–100. Le moteur mesure l'encre réelle, recadre et espace : l'auteur n'a aucune coordonnée à donner pour le nom.

## 3. Le moteur graphique

**Noyau (`kernel/paper.kernel.ts`).** `paper-core` sans DOM : en Node, Paper démarre par défaut un jsdom et charge `node-canvas` (binaire natif qui entre en conflit avec libvips de sharp, 1 s de démarrage) ; on lui prête un `self` minimal le temps du chargement. Les opérations booléennes réessaient avec un décalage imperceptible quand des arêtes sont confondues. L'aire se calcule par contenance (l'aire signée de Paper annule deux croissants de sens opposés : une exclusion « vide » était jetée avant ce correctif).

**Typographie (`kernel/typography.ts`).** Glyphe par glyphe (cmap + crénage), jamais par le shaping d'opentype.js (qui lève sur certaines tables GSUB). On raisonne en **hauteur de capitale**. Police ou glyphe absent : refus clair, jamais de rectangle `.notdef` ni de `<text>` de repli.

**Composition (`render/compose.ts`).** Symbole à `symbolScale` × hauteur de capitale du nom, espace en fraction de la hauteur du symbole, nom centré sur la hauteur de capitale (pas sur l'encre : les jambages ne le décalent pas), lignes empilées, marge de sécurité, mise à l'échelle du canevas.

**Variantes (`render/variants.ts`).** Toutes sortent de la **même scène** (mêmes formes) : seules les couleurs, la mise en page ou les retouches de couche changent. Inversée : chaque couleur relevée jusqu'à 3,5:1 sur fond sombre. Un logo dynamique est un système de variantes liées (paramètre ou couleur retouchés).

**SVG (`render/svg.ts`).** Fichier autonome : `<svg xmlns viewBox>`, `<title>`/`<desc>`, des `<path>`. SVGO (`multipass`, précision 2). SVGO raccourcit `#ffffff` en `#fff` : toute comparaison de couleurs doit normaliser.

**Générateurs (`render/generators/`, catalogue : [LOGO_GENERATORS.md](LOGO_GENERATORS.md)).** 58 constructions géométriques paramétrées (module B : abstrait 16, figuratif 34 ; module D : 8 mascottes). Chacune déclare ses paramètres bornés et ses étiquettes de secteur (bilingues). Les découpes internes (yeux, nervures) creusent les formes du générateur **avant** que la couche ne reçoive sa couleur : une couche entière en `paper` reste une découpe pour son parent.

Ajouter un générateur : `register({ id, label, family, tags, tones, params, build })` dans le fichier de sa famille, `npm run docs:logo`, et `check:logo` le teste seul (40 tirages de paramètres, aucune erreur, aucune sortie de la boîte).

## 4. La validation

Un SVG valide n'est pas un bon logo : deux niveaux, tous deux **déterministes** ; le jugement d'un modèle multimodal vient en plus (cran Ultra), jamais à la place.

**Technique (`validate/technical.ts`)** — bloquant : XML mal formé, racine ou `xmlns` absents, `viewBox` invalide, balise interdite (`<text>`, `<image>`, `<script>`, `<style>`, `<foreignObject>`, `<use>`…), référence externe (`href`, `url()`, `data:`, `@import`), attribut d'événement, tracé non numérique, aucun tracé, rendu vide. Signalé : couleur hors palette, trop de tracés (80), trop lourd (40 Ko), trop de nœuds (2 400), fond opaque.

**Visuelle (`validate/visual.ts`)**

| Mesure | Seuil |
|---|---|
| Solidité de l'encre à 16 / 24 / 32 / 64 px (hauteur ; jusqu'à 4:1 pour un nom en ligne) | ≥ 70 % à 24 px |
| Contraste de la couleur dominante sur blanc | ≥ 3:1 (accents ≥ 1,5:1) |
| Variante inversée sur fond sombre | ≥ 3:1 |
| Symbole seul à 64 px | ≥ 6 % du canevas ; solide à 32 px |
| Équilibre (centre de masse), alignement symbole/nom, hiérarchie, respiration | écarts bornés |
| Typographie | ≤ 2 familles, ≤ 2 graisses |
| Simplicité par type (nœuds du symbole) | minimal 70 · abstrait/pictorial 260 · mascotte 340 · lettermark 520 · emblème 700… |
| Couleurs par type | minimal 2 · abstrait 3 · mascotte 4… |
| Symbole présent pour les types qui en exigent | **bloquant** |

Score 0–100 (bloquant −40, avertissement −7) ; **accepté** = aucun bloquant et score ≥ 78.

**Auto-amélioration (`validate/autofix.ts`).** Chaque défaut corrigeable a une correction exprimée en patch : encre assombrie jusqu'à 3,3:1, traits épaissis de 30 %, répétitions réduites de 25 %, espace ou échelle du symbole réglés, graisses unifiées… Deux tours au plus, on s'arrête au seuil, et une correction qui aggrave le score est abandonnée.

**Diversité (`validate/fingerprint.ts`).** Empreinte = catégorie, mise en page, motifs structurels (générateurs, effets, opérations) et grille 16 × 16 d'encre du symbole. Distance : forme 0,45 · motifs 0,35 · catégorie 0,12 · mise en page 0,08 (un logo retourné est le même logo). Seuils : trop proche < 0,22, distinct ≥ 0,40.

## 5. Le planificateur et l'agent

### Planificateur (sans token) — `planner/`

Il explore **catégorie × recette × générateur × paramètres × graine** :

1. *Brief* : mots-clés du secteur (poids ×2), de la marque, des valeurs et de la description, comparés aux étiquettes des générateurs (racines de 6 lettres : « logistique »/« logistics » se rejoignent) ; traits (luxe, ludique, tech, naturel, audace, calme, classique) qui règlent la typographie (casse, interlettrage, graisse) et les poids des catégories.
2. *Recettes* (`recipes.ts`) : plusieurs façons de construire chacune des 11 catégories ; un générateur est tiré par affinité + bruit proportionnel à l'exploration, ses paramètres sont tirés dans leurs bornes.
3. *Palette* : les encres de la charte, lisibles sur blanc, distinctes entre elles.
4. *Lot de candidats* → pipeline qualité → sélection : la meilleure, puis les plus éloignées des précédentes **et de la mémoire du projet** (empreintes des logos déjà montrés, conservées dans `LogoModel.engine.fingerprint`).

Même graine ⇒ mêmes propositions. Une relance (`fresh`) change la graine. C'est aussi le repli de l'agent : si l'IA est indisponible, le planificateur livre déjà des logos exploitables.

### Agent — `agent/`

La méthode change avec le cran de la jauge ; la qualité reste dans le code (voir [CREATIVITY.md](CREATIVITY.md)). Le logo est toujours généré au cran Ultra (décision produit).

| Cran | Ce que l'IA décide | Exploration | Tokens (estimés) |
|---|---|---|---|
| Low | rien : le planificateur | 15 % | 0 |
| Medium | **sélecteur** : choisit 3 propositions parmi 9 candidats déjà construits et mesurés | 35 % | ≈ 400 |
| High | + **directeur** : trois directions (catégorie, générateur, idée) tirées d'un menu filtré par le brief ; le code les construit | 50 % | ≈ 400 |
| Max | + **auteur** : écrit le Logo IR de chaque direction (2 brouillons), le **jury** départage (mesures à l'appui) | 65 % | ≈ 4 900 |
| Ultra | + 3 brouillons, dessin libre autorisé, **critique visuelle** (le modèle regarde le rendu et répond par un **patch**, 2 tours) | 80 % | ≈ 14 500 |

Garde-fous en code, à tous les crans :
- le modèle ne reçoit qu'un menu filtré, la signature d'UN générateur et un mémento de ~400 tokens ; jamais le catalogue ;
- ce qu'il écrit est validé par le schéma ; **la palette et le brief sont toujours ceux du code** ; un texte étranger à la marque (nom, initiales, accroche) est remplacé par son nom ; le dessin libre est refusé hors Ultra ;
- chaque brouillon, d'où qu'il vienne, repasse par le même pipeline qualité : aucun brouillon refusé par les mesures n'est montré ;
- une direction, un JSON ou un patch invalide est remplacé par la décision du planificateur ; un modèle muet, lent ou en erreur donne le même résultat que le cran Low ; l'agent ne lève jamais ;
- un patch du critique qui aggrave le score mesuré est refusé ; une vision indisponible n'empêche pas la livraison.

### Corrections ciblées — `ir/patch.ts`

On ne régénère jamais un logo pour corriger un détail. Un patch est une liste d'opérations courtes (`layer`, `text`, `generator`, `composition`, `palette`, `remove`, `add`) ; il est appliqué à une copie, revalidé par le schéma, et les opérations invalides sont refusées une à une (« couche `x` introuvable ») sans empêcher les valides. Les couches non visées gardent exactement leur géométrie (`check:logo` §9).

Utilisé par l'auto-amélioration (sans token), le critique (Ultra) et la **retouche demandée par l'utilisateur** dans le chat (« plus rond », « le nom en capitales » → quelques dizaines de tokens).

## 6. L'export — `export/package.ts`

```
logo.svg                       principal, autonome, fond transparent
logo-monochrome.svg            noir          logo-monochrome-white.svg  blanc
logo-inverted.svg              couleurs relevées pour fond sombre
logo-symbol.svg / -wordmark.svg  le symbole seul / le nom seul (quand ils existent)
logo-<variante>.svg            variantes dynamiques
previews/logo-{1024,512}-{light,dark}.png · previews/symbol-{256,64,32,24}.png
logo.json                      le Logo IR + le rapport qualité : rouvrir et modifier plus tard
```

Chaque SVG repasse par la validation technique avant d'être écrit (un fichier refusé est listé dans `skipped`, jamais livré). `zipExport` produit l'archive avec un manifeste ; `readLogoJson` relit un `logo.json`.

## 7. Intégration IDEM — `idem.service.ts`

| Où | Ce qui change |
|---|---|
| `branding.service#generateLogoConceptsWithStreaming` / `#generateLogoConcepts` | le moteur d'abord ; il complète par des logos composés par le code s'il ne tient pas le compte ; l'ancien pipeline reprend s'il échoue |
| `#generateLogoVariations` / `…WithStreaming` | un logo qui porte un `ir` reçoit ses six déclinaisons du Logo IR : **aucun appel au modèle**, même géométrie |
| `#editLogo` | la demande devient un patch sur l'IR ; sans IR connu ou patch refusé, l'ancien chemin reprend |
| `brand/logoAdapt.ts`, `brandSync` | un changement de palette ou de police **reconstruit** le logo depuis son IR (couleurs exactes, lettres retracées dans la nouvelle police), déclinaisons comprises |
| `LogoModel` | + `ir` (rouvrable) et `engine` (catégorie, qualité, nouveauté, empreinte, polices, décisions de l'IA) |

- `LOGO_ENGINE=legacy` (ou `off`) rend la main à l'ancien pipeline.
- Les logos sont inline (SVGO) : l'ancien optimiseur par expressions régulières ne repasse pas dessus.
- Les polices : `idemFontProvider` (chargeur de la charte : Google, Fontshare, polices importées). Le chargeur servait la **première** graisse d'une feuille multi-graisses (un logo « en gras » sortait en filet pour une police Fontshare) ; il choisit maintenant la graisse demandée (`extractFontFileUrl`), et le cache Redis est passé en `font-file-v2`.
- Le logo retouché est retrouvé depuis son SVG par un cache de 24 h (`logoir:`) : le client n'a pas à renvoyer l'IR.
- Dépendances ajoutées à `apps/api` : `paper`, `@resvg/resvg-js`, `zod`.

## 8. Contrôle — `npm run check:logo`

150 vérifications, **sans réseau ni modèle** (police locale Liberation Sans, modèle simulé) : contrat ; Node seul (aucun React/jsdom/canvas chargé) ; noyau remplaçable ; booléens exacts et 58 générateurs × 40 tirages ; typographie ; composition et variantes ; 14 fichiers défectueux détectés ; mesures et auto-amélioration ; patchs ; **les 11 catégories** produisent chacune un logo accepté ; reproductibilité (mêmes octets) ; planificateur (8 marques : aucune paire « trop proche », 24 SVG différents, la mémoire du projet écarte le déjà-vu) ; l'agent à chaque cran, ses replis et ses garde-fous ; budget de tokens contre l'ancien pipeline ; export (relecture à l'identique, ZIP) ; qualité mesurée sur 8 marques × 3 types (72 logos, score moyen ≥ 90).

## 9. Limites connues

- **Mascottes** : première génération (lion, hibou, chat, ours, éléphant, oiseau, renard, robot), propres et lisibles mais simples ; une mascotte de qualité « illustrateur » demande davantage (corps, poses, accessoires).
- **Dessin libre** (`path`) : réservé à Ultra, sans noyau de lissage ni vérification d'originalité ; la validation et le patch le contiennent.
- **Évaluateur multimodal** : branché au cran Ultra seulement ; le modèle de vision note trop large (le critère le plus faible compte double). Jamais décisif seul.
- **Interface** : le formulaire de préférences n'expose toujours que icône / nom / initiales ; les 11 catégories se répartissent d'elles-mêmes entre les trois propositions. Aucun écran de téléchargement du livrable complet (`exportLogoPackage`) n'est branché ; la fonction est prête.
- **Langue** : le raisonnement des planificateurs est en français, les consignes aux modèles en anglais (comme les autres agents créatifs).
- Non vérifié dans le navigateur : l'affichage des cartes de propositions (nom, mention de catégorie) et la progression en direct.

# @idem/graphic-engine — le moteur de génération graphique d'IDEM AFRICA

Un **paquet du monorepo**, importé par les applications — l'API IDEM (`apps/api`), l'API iVision
(`apps/ivision/api`) et le cœur iVision (`apps/ivision/core`). Jamais un service contacté par HTTP.

Il produit, à partir d'un contenu structuré et de la charte d'un projet :

- les pages du **business plan** (A4 portrait, paginées pour le PDF) ;
- les pages de la **charte graphique** (16:9, A4 portrait ou paysage) et leur couverture ;
- les diapositives du **pitch deck** ;
- les deux faces des **cartes de visite** (85 × 55 mm, gabarit à marqueurs `{{champ}}`) ;
- les **visuels** : flyers, publications, stories, bannières et avatars des réseaux ;
- les **graphiques** (SVG dessinés depuis les données, palette validée).

Le principe tient en une phrase : **le modèle écrit le contenu et prend les décisions que la jauge lui
confie ; le code dessine.** Aucun HTML n'est écrit par un modèle, aucune couleur ni police hors charte
ne peut apparaître, aucun chiffre n'est recopié par un modèle.

## Le flux

```
contenu (ContentModel : sections de blocs typés, intention de page facultative)
  → validation et normalisation (un petit modèle se trompe : on répare la forme, jamais le fond)
  → médias (si la page a une intention) : plan, sources dans l'ordre, pose, repli tracé
  → plan du document (chaque page reçoit d'avance une composition distincte de ses voisines)
  → candidats (motifs × paramètres) → classement (adéquation, style, diversité, mémoire)
  → choix : le code (Low, Medium) ou un agent dans un menu (High, Max), ou un arbre d'auteur (Ultra)
  → DesignSpec (versionné) → compilateur HTML/CSS déterministe
  → ajustement et mesure dans Chromium → réparations par le code, puis réparation ciblée (High+)
  → critique visuelle (High+, si la vision est branchée)
  → RenderResult (versionné) + trace de génération (coûts, décisions, réparations)
```

## Utiliser le moteur

### Brancher l'hôte, une fois

```ts
import { configureGraphicEngine } from '@idem/graphic-engine';

configureGraphicEngine({
  agentCall: (ctx) => runtimeCall(ctx),            // l'appel d'agent de l'hôte (High+ seulement)
  analyzeImage: (b64, mime, instruction, o) => …,  // la vision, pour la critique (High+)
  logger,                                           // info / warn / error
  onTrace: (trace) => logger.info('graphic.trace', summary(trace)),
  recentFingerprints: async (scope) => …,           // mémoire de diversité entre documents
  rememberFingerprints: async (scope, prints) => …,
  browser: { shared: () => sharedChromium(), allow: (url) => isRenderUrlAllowed(url) },
});
```

Tout port est facultatif : sans agent, le moteur compose seul (le cran se comporte comme Medium) ; sans
navigateur partagé, il ouvre le sien ; sans mémoire, la diversité vaut à l'intérieur du document.
`configureGraphicEngine({ agentCall: undefined })` débranche un port. Branchements actuels :
`apps/api/api/services/graphic/engine.host.ts` (IDEM) et `apps/ivision/core/src/runtime/host.ts`
(cœur iVision).

> Journaux : le cran de créativité ne va **jamais** sous la clé `level` d'un journal winston (c'est le
> niveau du journal, que winston fusionne) — il s'écrit `creativity`.

### Composer

```ts
import { brandFromIdem, createDocument, sectionHtml } from '@idem/graphic-engine';

const { brand, direction } = brandFromIdem({ name, branding, logos });     // la charte stockée par IDEM
const doc = await createDocument({
  documentType: 'business-plan', format: 'a4-portrait',
  brand, direction, creativity: 'medium',
  seed: documentKey,                       // sème tous les tirages : même clé, même document
  sections: pages.map((p) => ({ id: p.id, role: p.role })),
});
const out = await doc.composeSection(content, { index: 2, total: pages.length });
const fragment = sectionHtml(out);         // les polices puis la racine : ce que l'on stocke et imprime
await doc.remember();                      // confie les empreintes à la mémoire de l'hôte
```

`renderSingle({ …, content })` compose une toile d'une seule section (une face de carte, un visuel, une
couverture de réseau). `doc.designSpec()` rend le DesignSpec du document (sections composées jusque-là).
`validate: false` compose sans Chromium (contrôles de composition, tests rapides) ; `png: true`
photographie la page.

### Les adaptateurs

| Fonction | Rôle |
|---|---|
| `brandFromIdem` | La charte d'un projet IDEM (couleurs, polices, logos, motifs, direction artistique) → `BrandInput` + `DirectionInput`. Rien n'est inventé : une couleur absente est dérivée, un logo absent n'est pas remplacé par un faux. |
| `sectionFromModel` | La sortie BRUTE d'un rédacteur → une section valide : JSON lu (même sous clôture de code), page HTML récupérée (`salvageHtmlSection` : le texte gardé, la forme jetée), blocs posés par le code en tête (`prepend`), titre imposé par le plan (`heading`). |
| `systemSection` | Une page entièrement posée par le code (spécimens, références). |
| `coverContent` | Une couverture : le nom, ce qu'est le document, la promesse — des mots, jamais une mise en page. |
| `cardFaces` | Les deux faces d'une carte (`markers` : gabarit partagé ; `values` : une personne). |
| `visualContent` | Un visuel : son texte et, s'il y en a une, sa photo (point d'intérêt compris). |

### Les rédacteurs de l'hôte

Le moteur fournit aussi ce que les rédacteurs IA reçoivent, pour que tous écrivent le même contrat :
`contentContract({ deliverable })` (les blocs du livrable, avec leur forme), `WRITING_RULES` (vocabulaire
banni, remplissage, références et chiffres inventés, grandiloquence), `volumeDirective(blocks)` (une seule
consigne de volume, en blocs), et le plan de section en deux temps (`sectionPlanContract`,
`normalizeSectionPlan`, `describeSectionPlan`).

## Les trois contrats

Versionnés (`src/version.ts`), validés par zod, publiés en JSON Schema dans `contracts/`
(`npm run schemas`), exemples valides et invalides dans `contracts/examples/`.

- **ContentModel** — ce que le livrable DIT. Des sections (`id`, `role`, `kicker`, `title`, `lede`) de
  blocs typés : rédigés (`prose`, `metrics`, `table`, `cards`, `chart`, `timeline`, `quote`, `assumption`,
  `comparison`, `steps`, `swot`, `funnel`, `persona`, `riskMatrix`, `businessModel`), spécimens posés par
  le code (`swatches`, `typeSpecimen`, `logoDisplay`, `typeScale`, `patternGrid`, `logoStory`, réseaux,
  mockups, direction artistique, `sources`), et ceux des visuels, couvertures et cartes (`copy`, `figure`,
  `cover`, `contact`). `origin: 'system'` marque ce que le code a posé à partir de données réelles.
- **DesignSpec** — comment le livrable est COMPOSÉ : par section, un motif et ses paramètres, la
  stratégie de couleur, l'humeur typographique, la tension, l'accent, la densité, et l'ARBRE de nœuds
  (piles, rangées, grilles, boîtes, blocs, textes, logo, formes du kit). Il désigne le contenu par
  identifiant, jamais en recopiant un texte.
- **RenderResult** — ce qui a été rendu : le HTML, son `<head>` (polices), la provenance (moteur,
  composants, hachages, motif, empreinte), la mesure, les réparations, les constats et l'usage (appels,
  jetons, durée).

## Les toiles

| Format | Famille | Taille (px CSS) | Corps minimal |
|---|---|---|---|
| `a4-portrait` | document (flux paginé) | 794 × 1123 | 9 |
| `slide-16x9` | diapositive | 1123 × 631 | 11 |
| `page-a4`, `page-a4-landscape` | page fixe de charte | 794 × 1123 · 1123 × 794 | 9 · 10 |
| `card-landscape`, `card-portrait` | carte (85 × 55 mm) | 321 × 208 · 208 × 321 | 8,5 (≈ 6,4 pt) |
| `flyer-square`, `flyer-story`, `flyer-banner`, `flyer-post`, `flyer-a4` | visuel | 1080², 1080 × 1920, 1200 × 630, 1200 × 1500, 1240 × 1754 | 12 à 23 |
| `cover-facebook`, `cover-linkedin`, `cover-x`, `cover-youtube`, `avatar-square` | couverture de réseau | aux cotes de chaque réseau | 12 à 51 |
| `chart-free` | graphique autonome | 640 × 360 | 9 |

## Composer : motifs, plan, diversité

- **69 motifs** de composition (`design-system/patterns/`) : 18 diapositives (dont 4 visuelles) et 7 couvertures, 10 pages
  de document et 7 couvertures, 6 rectos et 4 versos de carte, 12 visuels, 5 couvertures et avatars de
  réseau. Un motif est une recette à paramètres, pas un gabarit figé : il déclare les régions qu'il occupe,
  d'où une silhouette calculée AVANT le rendu.
- **34 composants** (`design-system/components/`), un par type de bloc, avec leurs variantes.
- **Le plan** (`composition-engine/plan.ts`), semé par la clé du document : l'humeur typographique, la
  densité et le pied restent constants ; chaque page reçoit une préférence de motifs décalée de ses
  voisines (les sections peuvent être composées en parallèle).
- **Le classement** (`composition-engine/compose.ts#rank`) : adéquation au contenu, affinité avec le
  style (elle penche, n'élimine pas), ressemblance avec les trois dernières pages et avec les documents
  récents du projet, réservation du plan, usure d'un motif déjà employé, et jamais le motif d'une page
  VOISINE tant qu'un autre convient.
- **L'empreinte** d'une page (motif, paramètres, stratégie, tension, accent, silhouette) nourrit la
  mémoire de diversité ; l'hôte la garde 30 jours par projet.

## L'intention des pages et les médias (pitch deck)

Une diapositive part de l'idée à faire comprendre, pas du gabarit à remplir. Une section peut porter une
**intention** (`SlideIntent`, `contracts/slide-intent.ts`) : sa stratégie visuelle (`illustration`,
`full-bleed`, `product-capture`, `diagram`, `data-visualization`, `collage`, `editorial`,
`free-composition`), le message à retenir, l'image qu'elle appelle et son **budget de texte**
(`TEXT_BUDGETS` : `statement`, `points`, `demonstration`, `data`).

- **Le bloc `points`** : des points MONTRÉS (libellé court, une ligne, un chiffre, ce que leur image
  représente) au lieu de paragraphes. Le code y pose l'icône locale ou le média trouvé, jamais le modèle.
- **Quatre motifs visuels** (`patterns/slides-visual.ts`) : `slide.full-bleed` (image en grand, message
  sur un panneau clair), `slide.illustrated` (les points illustrés portent la page), `slide.hub` (le message
  au centre, les points rayonnent), `slide.capture` (la vraie capture, encadrée et annotée). Chaque motif
  déclare les stratégies qu'il sert (`strategies`) et la matière qu'il exige (`needs` : le plan ne les
  réserve jamais). L'intention pèse 2,4 dans le classement ; au cran Medium, le tirage se fait entre motifs
  qui la servent.
- **Le planificateur de médias** (`asset-planner/`) : `planAssets` déduit les besoins (`AssetRequirement`) ;
  `resolveAssets` essaie les sources dans l'ordre utilisateur → projet → capture → génération → banque →
  natif, chez les fournisseurs branchés par l'hôte (`assetProviders`) ; `applyAssets` pose les figures et
  les icônes, ou applique le repli (une page « pleine image » sans image redevient éditoriale). Une capture
  de produit n'est jamais générée ni prise en banque ; la génération n'existe qu'à High+ et se plafonne par
  document (`GENERATION_CAP`). La provenance de chaque média est dans la trace (`assets`).
- **La charge de texte** est mesurée contre le budget : au-delà de 1,25×, un conseil `text_heavy` (jamais
  bloquant — le moteur ne retire pas un mot). L'API IDEM renvoie alors la slide une fois au rédacteur (High+).

Les contenus SANS intention (anciens decks, business plan, charte) se composent exactement comme avant.

## La jauge de créativité

`composition-engine/profiles.ts` traduit les cinq crans vendus par IDEM en politique :

| Cran | Profil | Qui décide | Menu | Contrôles de jugement |
|---|---|---|---|---|
| low | guidé | le code, compositions éprouvées, aucun appel | — | bloquants |
| medium | équilibré | le code, tirage parmi les trois meilleurs motifs distincts | — | bloquants |
| high | créatif | le directeur artistique choisit ; critique visuelle ; réparation ciblée | 6 | conseils |
| max | créatif + | + il règle les paramètres bornés, dans le même appel | 6 | conseils |
| ultra | libre | + le compositeur écrit un ARBRE inédit avec les primitives autorisées | 8 | conseils |

La validation reste **stricte** à tous les crans : contenu perdu, chiffre inventé, texte hors page,
référence inexistante, CSS libre — jamais. Chaque tâche d'agent a sa politique (`orchestrator/policies.ts` :
cran minimal, profil du runtime, plafond de jetons, délai) et chaque génération un budget de jetons
(`budgetFor`) ; un budget atteint rend la décision au code, et la trace le dit.

## Qualité : mesurer, réparer

`quality-engine/measure.ts` ouvre la page dans Chromium : titres ajustés au pixel, débordement vertical
et horizontal, texte sorti de son aplat, remplissage et plus grande bande vide, contraste de chaque
texte sur son fond RÉEL, chevauchements, décor posé sur un texte, images manquantes, polices réellement
chargées, silhouette mesurée.

Réparations par le code, dans cet ordre : `fit_text`, `fit_grow` (diapositive trop vide), `fix_contrast`
(texte trop pâle ramené vers l'encre de la charte, sa teinte gardée tant qu'il se peut), `drop_decor`,
`fit_scale` (échelle bornée), `simplify_chrome` (accent et tension retirés), `next_candidate`. À partir
de High, la réparation ciblée par l'agent (changer de composition, densifier, retirer le décor, compacter
un bloc). La meilleure tentative est gardée.

Un constat est **bloquant** s'il rend la page fausse (débordement, texte illisible, image manquante) ;
il est un **conseil** s'il la rend perfectible. Au-dessus de Medium, le jugement ne bloque jamais.

## Le contrat avec le PDF (documents paginés)

- Le fragment stocké : les `<link>` de polices AVANT la racine, jamais dedans.
- Les enfants en flux de la racine sont les RANGÉES que le paginateur découpe ; l'écart entre elles est
  une marge (qu'il sait étirer), jamais un `gap` de la racine. Les enfants positionnés en absolu sont des
  décors, recopiés sur chaque page.
- Une rangée porte les marqueurs que le paginateur lit : `data-keep-together` (bloc insécable),
  `data-idem-folio` (pied de section, retiré s'il resterait seul), `data-keep-with-next`.

## Le registre de capacités

`capability-registry/` inscrit ce que les agents peuvent nommer, du plus proche au plus lointain :
composants et motifs, formes du kit (17 : anneaux, arcs, vagues, courbes de niveau, damier…), motifs de
marque, icônes locales (Lucide, Tabler), polices — puis les outils MCP du dépôt (`.mcp.json` : Context7,
Chrome DevTools, accessibilité, Iconify), lus depuis `capability-registry/mcp/manifest.json`. Une
capacité locale passe toujours avant un outil ; l'index montré à un agent reste court (≤ 1 200 signes),
la documentation détaillée se charge à la demande. `npm run mcp:sync` régénère le manifeste,
`npm run mcp:check` vérifie qu'il suit `.mcp.json`.

## Observabilité

Chaque section rend une `GenerationTrace` : ses tâches (code ou modèle, jetons d'entrée et de sortie,
durée, issue — `accepted`, `refused`, `failed`, `skipped`), ses réparations et ses tentatives. L'hôte la
reçoit par `onTrace` ; IDEM l'écrit dans son journal JSON (`graphic.trace`), qu'exploite Grafana.

## Scripts

| Script | Rôle |
|---|---|
| `npm run check` | Les contrôles du moteur : contrats, normalisation, jetons et contrastes, palettes des graphiques, compilateur (déterminisme, sécurité, fidélité, contrat du PDF), motifs, composition et diversité, profils, agents simulés, registre, puis un corpus rendu et mesuré dans Chromium (decks, business plan, charte, carte, visuel). |
| `npm run check:fast` | Les mêmes, sans Chromium. |
| `npm run bench` | Le banc d'essai A/C (ancien moteur contre celui-ci, par cran) → `docs/BENCHMARK.md`. |
| `npm run preview` | Fait passer des livrables complets par tout le moteur et assemble des planches contact dans `scratch/graphic-engine-preview/`, pour REGARDER les rendus (`-- --level high`, `-- --only deck,bp`). |
| `npm run schemas` | Régénère les JSON Schema des contrats. |
| `npm run typecheck`, `npm run build` | Vérification des types ; compilation vers `dist/` (images de production). |

Depuis la racine du dépôt : `npm run check:graphic-engine`, `npm run typecheck:graphic-engine`,
`npm run bench:graphic-engine`. Depuis l'API IDEM : `npm run check:graphic`.

## Étendre le moteur

- **Un composant** : un fichier dans `design-system/components/` (`registerComponent` : types de blocs,
  variantes, estimation de hauteur, rendu), inscrit dans `components/library.ts`. Les couleurs viennent
  des encres de la charte (`ink`, `ruleColor`) : un glyphe au corps du texte demande le contraste d'un
  texte (4,5:1), un trait ou un grand titre celui de 3:1.
- **Un motif** : `registerPattern` dans `design-system/patterns/` (famille, rôles, paramètres,
  adéquation, régions, construction de l'arbre). `npm run check` le construit sur le corpus et vérifie
  que son DesignSpec est valide.
- **Un format** : une entrée dans `design-system/formats.ts` (cotes, marges, zone de sécurité, corps de
  base et minimal) et dans le type `FormatId` (`contracts/common.ts`).
- **Un style** : une entrée dans `design-system/tokens/styles.data.ts` ET dans le catalogue des
  directions artistiques (`apps/ivision/core/src/design/artDirection.catalog.ts`) ; le contrôle
  `check:design` de l'API vérifie qu'ils s'accordent.

## Versions

`ENGINE_VERSION`, `COMPONENT_LIBRARY_VERSION` et `CONTRACT_VERSIONS` (`src/version.ts`) sont écrites dans
la provenance de chaque rendu. Modifier un composant ou un motif change la version de la bibliothèque ;
modifier la forme d'un contrat change sa version. Les clés de cache qui en dépendent (les ressources
sociales de la charte, par exemple) s'invalident d'elles-mêmes.

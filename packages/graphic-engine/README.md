# @idem/graphic-engine — le moteur de génération graphique d'IDEM AFRICA

Un **paquet du monorepo**, importé par les applications — l'API IDEM (`apps/api`), l'API iVision
(`apps/ivision/api`) et le cœur iVision (`apps/ivision/core`). Jamais un service contacté par HTTP.

Il produit, à partir d'un contenu structuré et de la charte d'un projet :

- les pages du **business plan** (A4 portrait, qui s'allongent ; le PDF les pagine) ;
- les pages de la **charte graphique** (16:9, A4 portrait ou paysage) et leur couverture ;
- les diapositives du **pitch deck** ;
- les deux faces des **cartes de visite** (85 × 55 mm, gabarit à marqueurs `{{champ}}`) ;
- les **visuels** : flyers, publications, stories, bannières et avatars des réseaux ;
- les **graphiques** (SVG dessinés depuis les données, palette de la marque).

Le principe (version 2.0, 14 octobre 2026) : **l'IA conçoit et écrit chaque page en HTML Tailwind, librement ;
le code garantit l'exactitude et l'affichage ; la jauge de créativité choisit le modèle.** Aucun gabarit,
aucun catalogue de mises en page, aucune note esthétique, aucune critique, aucune réécriture automatique.
Historique : [docs/MIGRATION.md](docs/MIGRATION.md).

## Le flux

```
contenu (ContentModel : sections de blocs typés, écrit par le rédacteur de l'hôte)
  → validation et normalisation (un petit modèle se trompe : on répare la forme, jamais le fond)
  → médias (si la page a une intention) : plan, sources dans l'ordre, pose, repli tracé
  → matière à plat : chaque texte reçoit une clé ({{title}}, {{b2.items.0.value}}) ; graphiques et tableaux
    deviennent des primitives du code
  → langage visuel de la MARQUE (directeur, une fois par charte, gardé par l'hôte : port brandMemory)
  → plan du DOCUMENT (directeur, documents de plusieurs pages) : une idée, une ligne par page
  → page écrite en HTML Tailwind (auteur, rôle graphic.author, une fois par page) avec SA ligne du plan
    et celles de ses voisines, et la documentation des seuls outils dont elle a besoin
  → assainie (scripts, cadres, adresses étrangères, CSS natif retirés) → remplie par le code
    (textes exacts, primitives dessinées, racine .ge-page aux cotes du support)
  → Tailwind compilé côté serveur avec le thème de la marque → « s'affiche-t-elle ? » (Chromium)
  → sinon correction bornée → RenderResult + trace de génération
```

Mêmes étapes, même contexte à tous les crans : le cran (`low`, `medium`, `high`, `ultra`) est transmis à
l'hôte avec chaque appel, et l'hôte résout le modèle du rôle sur son échelle (`apps/api/api/config/creative-roles.ts`,
`MODEL_LADDERS`).

## Utiliser le moteur

### Brancher l'hôte, une fois

```ts
import { configureGraphicEngine } from '@idem/graphic-engine';

configureGraphicEngine({
  agentCall: (ctx) => runtimeCall(ctx),            // l'appel d'agent de l'hôte : rôle + cran → modèle
  logger,                                           // info / warn / error
  onTrace: (trace) => logger.info('graphic.trace', summary(trace)),
  recentFingerprints: async (scope) => …,           // idées déjà employées pour la marque
  rememberFingerprints: async (scope, entries) => …,
  brandMemory: { read: async (key) => …, write: async (key, text) => … },  // langage visuel de la marque
  browser: { shared: () => sharedChromium(), allow: (url) => isRenderUrlAllowed(url) },
  assetProviders, assetRegistry,                    // médias (génération, banque) et registre du projet
});
```

Sans `agentCall`, aucune page ne s'écrit (`GraphicRenderError`) : il n'y a plus de composition du code.
Branchements actuels : `apps/api/api/services/graphic/engine.host.ts` (IDEM) et
`apps/ivision/core/src/runtime/host.ts` (cœur iVision).

> Journaux : le cran de créativité ne va **jamais** sous la clé `level` d'un journal winston (c'est le
> niveau du journal) — il s'écrit `creativity`.

### Un document

```ts
const doc = await createDocument({
  documentType: 'pitch-deck', format: 'slide-16x9',
  brand, direction,                 // brandFromIdem(...) : couleurs, polices, logos, motifs, direction artistique
  creativity: 'medium', seed: designKey,
  sections: slides.map((s) => ({ id: s.id, role: s.role })),
  brief: project.description,       // ce que fait le projet, pour le directeur et l'auteur
  user: { userId, projectId }, memoryScope: { documentType: 'pitch-deck', key: projectId },
});
const out = await doc.composeSection(section, { index: 2, total: 12 });   // pages en parallèle possibles
sectionHtml(out);                    // le fragment autonome : polices + <style> Tailwind, puis la racine
await doc.remember();                // la bible, pour que le prochain document de la marque fasse autrement
```

Une toile d'une seule section : `renderSingle({ ..., content })`. Options utiles : `png` (photographie),
`bindings: 'markers'` (carte partagée entre porteurs), `size` (toile imposée), `reference` (une composition
modèle à reproduire), `allowDark` (fond sombre, sur demande explicite seulement), `validate: false` (sans
Chromium).

### Retoucher une page

- `composeSection(content, { replay: out.spec })` : le CODE gardé, rejoué avec un contenu retouché (texte,
  chiffre, photo) — **aucun modèle**.
- `composeSection(content, { revise: { spec: out.spec, instruction } })` : une retouche de FORME (« titre plus
  grand, logo en bas ») — l'auteur reçoit son code et la consigne.
- Une page de l'ancien moteur (arbre v1, `isAuthoredSpec(spec) === false`) ne se rejoue pas : elle est réécrite.

## Retoucher, remettre en page, exporter — sans réécrire

- `doc.page(id)` rend le **contenu final** d'une page (textes, chiffres, médias déjà posés) et son **code** : l'hôte les
  garde avec la section (`SectionModel.composition` chez IDEM).
- **Retouche de mots** : `applyTextEdits(content, { "<clé>": "nouveau texte" })` (mêmes clés que celles de l'auteur ;
  les blocs posés par le code restent intouchables), puis `composeSection(content, { replay })` — aucun auteur.
- **Retouche de forme** : `composeSection(content, { revise: { spec, instruction } })`.
- **Nouvelle mise en page** : `composeSection(content)` dans un nouveau document, avec `layoutNote` (« plus aérée ») —
  aucun texte réécrit, aucun média recherché.
- **Page modifiée ailleurs** (éditeur, réécriture du HTML) : `restyleFragment(html, tokens)` recompile sa feuille
  Tailwind (nouvelles classes comprises) ; `withoutCompiledStyle(html)` retire la feuille avant de la donner à lire
  à un modèle.
- **Export PowerPoint** (`exportPptx(slides, { mode })`, PptxGenJS) : le HTML reste la source. `fidelity` (défaut) :
  une image haute résolution par slide, rendu identique ; `editable` : les visuels forment l'image de fond rendue sans
  textes, chaque bloc de texte devient une zone PowerPoint native (police, corps, graisse, couleur, alignement, mots
  en gras conservés) ; un texte pivoté ou dans un graphique reste dans l'image. Les notes de l'orateur suivent.
  L'export ne modifie jamais le HTML et ne redemande rien à l'IA.

## Économiser les jetons sans brider l'IA

- **Ce qui dure est écrit une fois** : le langage visuel de la marque (≈ 520 jetons d'entrée, une fois par charte ;
  la clé change avec la charte), relu par tous ses livrables — decks, plans, flyers, cartes, pages de charte.
- **Le plan du document** tient en une ligne par page ; chaque page ne reçoit que sa ligne et celles de ses voisines.
- **La consigne système de l'auteur est la même pour toutes les pages** d'un support (le fournisseur peut la garder
  en cache) ; la fiche de la marque est compacte ; la documentation des outils est donnée à la demande (graphique,
  tableau, icône, motif seulement si la page en a).
- **Les données ne passent jamais par le modèle** : textes par clés, graphiques et tableaux dessinés par le code ;
  une retouche de texte rejoue la page sans appel.
- Mesure : `npm run prompt-size` (au 14/10/2026 : ≈ 690 + 770 jetons par page, contre ≈ 900 + 880 avant).

## Un rendu professionnel

La consigne de l'auteur pose le niveau d'un studio : la hiérarchie fait le travail (taille, graisse, espace,
alignement sur une grille) ; la décoration n'est permise que lorsqu'elle porte la marque (logo, motif, signes de
son langage) — jamais de cercles, taches, halos, dégradés, ombres, émojis, ornements ou textes penchés gratuits ;
peu de corps, les polices de la marque, la couleur avec intention. C'est une consigne d'écriture : aucun contrôle
esthétique ne la vérifie.

## Ce que l'auteur reçoit (contexte compact, identique à tous les crans)

`src/author/prompts.ts` :

- le livrable et le **support** : cotes en px et en mm, nature (toile fixe ou page A4 qui s'allonge), zone de
  sécurité (cartes, stories, couvertures), corps minimal — des contraintes d'impression, pas de design ;
- la **marque** : couleurs sous leurs noms Tailwind (`bg-brand-primary`, `text-ink`, `bg-brand-soft`…),
  polices (`font-display`, `font-body`), logos disponibles, motif, direction artistique et grammaire de
  composition de la charte, surface claire par défaut ;
- la **bible** du document ;
- la **matière** : chaque clé et son texte (les images par leur description et leur point d'intérêt) ;
- une **référence Tailwind** courte, les **primitives**, et UN exemple de syntaxe (« invente ta propre
  composition »).

Contrat de sortie : un bloc ```html, le fragment seul. Toile fixe : l'élément de tête remplit la toile
(`relative w-full h-full`). Page A4 : une suite de blocs de premier niveau (le PDF coupe entre eux ;
`data-keep-together` pour un bloc insécable). Tous les mots viennent des clés ; l'auteur n'ajoute que du
non-verbal (formes, filets, icônes, numérotation).

### Les primitives (`src/runtime/primitives.ts`)

| Balise | Ce que dessine le code |
|---|---|
| `<idem-chart data-block="b3" data-aspect="16/9" class="…">` | le graphique exact (bar, groupedBar, stacked, horizontalBar, line, area, pie, doughnut, radar), palette de la marque déclarée (`data-ge-palette`, recalculée par la traduction de marque) ; les libellés prennent la couleur du texte. L'auteur choisit la représentation (`data-type`, refusée si elle trahit les données : camembert à plusieurs séries…) et met une catégorie en avant (`data-highlight`) |
| `<idem-table data-block="b4" class="… [&_th]:bg-brand-primary">` | le tableau, cellule pour cellule, colonnes chiffrées à droite ; l'auteur le stylise depuis la balise |
| `<idem-logo variant="primary\|onLight\|onDark\|mono\|icon" class="h-[40px]">` | le logo (ou le nom en wordmark si la marque n'en a pas) |
| `<idem-icon name="truck" class="size-[40px] text-brand-primary">` | une icône vectorielle locale (Tabler, Lucide) |
| `<idem-pattern index="0" class="absolute inset-0 opacity-[0.1]">` | la tuile de motif de la marque |

## Tailwind côté serveur (`src/runtime/tailwind.ts`)

Le cœur JavaScript de `tailwindcss` 4 (aucun binaire natif) compile les classes lues dans les attributs `class`
avec un `@theme` tiré des jetons de la marque. La feuille obtenue :

- porte les variables du thème sur `.ge-page` (deux marques cohabitent sur un même écran) ;
- n'a que des `px` (la taille de police racine de l'application hôte ne change pas la page) ;
- remplace le preflight par une remise à zéro sans poids (`:where(.ge-page)`), qui ne fuit pas dans l'hôte.

## La seule vérification : l'affichage

`src/runtime/check.ts` ouvre la page dans Chromium (le moteur de l'impression PDF) : racine présente, taille non
nulle, quelque chose de visible dans la toile, et — sur une toile fixe — aucun texte coupé par le bord (il ne
s'afficherait pas en entier). Un texte encore coupé après la correction bornée n'efface pas la page : elle est livrée
avec le constat bloquant `text_cut` (réparation `render_partial`). Une image dont la clé n'existe pas est retirée au
remplissage, jamais laissée cassée. Les clés acceptent `-` et `:` (médias `asset-1`, blocs du code `sys-1`). Une ressource lente (police distante) ne fait jamais échouer
le rendu ; un navigateur absent n'est pas une faute de la page (`infra`).

Ce qui ne s'affiche pas — réponse sans HTML, rien de visible, rendu impossible — passe par la **correction
bornée** (`engine.ts`) :

1. **corriger** : le modèle du cran reçoit son code et l'erreur ;
2. **réécrire autrement** : le modèle du cran au-dessus, plus simplement, en connaissant les échecs ;
3. **version minimale** : le même, la page la plus simple qui s'affiche.

Une tentative à la fois, jamais deux fois la même approche, trois au plus, et un budget par document
(`GRAPHIC_REPAIR_ATTEMPTS` 3, `GRAPHIC_REPAIR_TOKEN_BUDGET` 60 000, `GRAPHIC_REPAIR_MAX_MS` 240 s). Ce qui
résiste lève `GraphicRenderError` (le service traite la section comme en échec, et le dit).

Les constats non bloquants restent dans `result.issues` comme conseils, sans rien déclencher :
`native_css_removed`, `content_not_shown` (une clé que l'auteur n'a pas placée), `unknown_keys`,
`unknown_blocks`.

## Les modules

| Dossier | Rôle |
|---|---|
| `contracts/` | ContentModel (blocs typés), SectionSpec/DesignSpec v2 (le code de l'auteur), RenderResult ; validation, normalisation, récupération d'une page HTML rendue par erreur |
| `author/` | prompts du directeur et de l'auteur, retouche et correction ; appel de modèle tracé (`model.ts`) |
| `runtime/` | matière à plat, assainissement et remplissage, primitives, Tailwind, contrôle d'affichage, navigateur |
| `content/` | analyse du volume de texte (budgets des slides), régime de texte (`slideDiet`) |
| `asset-planner/` | les médias d'une page : besoins, sources dans l'ordre, génération plafonnée par cran |
| `design-system/` | formats (cotes), jetons de la marque (couleurs lisibles, polices), palettes de graphiques, motifs |
| `agents/` | contrats des RÉDACTEURS de l'hôte : contrat de contenu, consigne de volume, plan de section |
| `adapters/` | marque IDEM → entrée du moteur ; sections depuis la sortie d'un rédacteur ; fragment autonome |
| `observability/` | traces par page, enregistrement d'une génération (`GenerationRecord`) |

## Contrôles

```
npm run check --prefix packages/graphic-engine        # 74 vérifications, auteur simulé, Chromium
npm run check:fast --prefix packages/graphic-engine   # sans Chromium
npm run schemas --prefix packages/graphic-engine      # régénère contracts/*.schema.json
```

Côté API : `check:creativity`, `check:roles`, `check:brand`, `check:bpquality`, `check:mockups` (ces trois
derniers avec l'auteur simulé `apps/api/api/scripts/fakeGraphicAuthor.ts`). Aucun contrôle ne juge
l'esthétique : ils vérifient l'exactitude, le contrat et l'affichage.

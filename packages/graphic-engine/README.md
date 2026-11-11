# @idem/graphic-engine — le moteur de génération graphique d'IDEM AFRICA

Un **paquet du monorepo**, importé par les applications — l'API IDEM (`apps/api`), l'API iVision
(`apps/ivision/api`) et le cœur iVision (`apps/ivision/core`). Jamais un service contacté par HTTP.

Il produit, à partir d'un contenu structuré et de la charte d'un projet :

- les pages du **business plan** (A4 portrait, composées en pages par le moteur : l'aperçu est le PDF) ;
- les pages de la **charte graphique** (16:9, A4 portrait ou paysage) et leur couverture ;
- les diapositives du **pitch deck** ;
- les deux faces des **cartes de visite** (85 × 55 mm, gabarit à marqueurs `{{champ}}`) ;
- les **visuels** : flyers, publications, stories, bannières et avatars des réseaux ;
- les **graphiques** (SVG dessinés depuis les données, palette de la marque).

## Le catalogue de gabarits en ligne (2.6, seul mode depuis la 2.7 du 11 novembre 2026)

**Chaque page est ASSEMBLÉE depuis un catalogue en ligne** (dépôt `idem-templates`, publié sur MinIO avec un manifeste
signé), à tous les crans. Le modèle n'écrit plus de HTML : il choisit dans une liste courte de gabarits documentés et met
à jour leur `config.json` (≈ 100 jetons de sortie au lieu de 3 000 à 6 000). Ajouter ou corriger un gabarit ne
demande ni rebuild ni redéploiement.

```
contenu → médias → matière à plat (clés)                                     (inchangé)
  → le CODE parcourt le graphe (0 jeton)     catalog/graph.ts
       filtre : élément, toile, rôle, CAPACITÉ (les unités tiennent dans les zones, largeur minimale des composants)
       score  : direction artistique (humeurs, densité, image), enchaînement (follows/contrasts/avoidAfter),
                usure dans le document, mémoire des combinaisons déjà livrées, poids d'exploitation, graine
       jamais le même squelette sur deux pages voisines
  → habillage du document : le code (Low, Medium) ou le modèle parmi 4 (High, Ultra), une fois par document
  → le MODÈLE choisit et met à jour la configuration (Medium+ ; Low : le code seul)   catalog/choose.ts
  → le CODE assemble (catalog/assemble.ts) : unités dans les zones, listes déroulées, couleurs de surface,
       hiérarchie tenue (un texte courant ≤ 72 % du titre), rien de perdu (textes oubliés posés à la suite)
  → rendu Chromium ; une zone qui déborde voit ses tailles réduites (jusqu'à trois passes) ; sous 70 %,
       le candidat suivant ; puis le squelette intégré ; un graphique ou une image qui partagent une zone gardent
       28 % de la toile au moins, un tableau la hauteur de ses rangées (rien n'est écrasé sous un voisin)
  → business plan, rapport : le moteur compose lui-même ses pages A4 (catalog/paginate.ts) — aperçu = PDF
  → page gardée : HTML à clés (rejeu, PPTX, éditeur) + spec.catalog.config (une retouche écrite modifie la config)
```

| Cran | Qui choisit | Finesse | Liste courte | Rendus mesurés | Mémoire de nouveauté |
|---|---|---|---|---|---|
| Low | le code | gabarit entier, réglages tirés par la graine | 6 | 1 (2 : visuel seul) | marque |
| Medium | modèle `graphic.template` | + réglages discrets | 4 | 1 (2 : visuel seul) | marque |
| High | modèle | + un composant par unité, habillage choisi | 8 | 2 | toutes les portées |
| Ultra | modèle | + squelettes de tout le graphe, réglages continus | 12 | 3 | + tous les clients |

Le modèle `graphic.template` suit l'échelle `catalog`, à poids ouverts : qwen3.6-35b-a3b (Medium), qwen3.5-122b-a10b
(High), deepseek-v4.1-flash (Ultra) ; aucun appel au cran Low. Comparaison chiffrée avec l'écriture libre :
[docs/MIGRATION.md](docs/MIGRATION.md#26--le-catalogue-de-gabarits-en-ligne-à-tous-les-crans-10-novembre-2026).

Le registre (`catalog/registry.ts`) lit, dans l'ordre : `IDEM_TEMPLATES_DIR` (dépôt local, relu toutes les 10 s),
`IDEM_TEMPLATES_URL` (le seau MinIO, ETag, `IDEM_TEMPLATES_TTL_S`, `POST /catalog/refresh` ; en local
`http://localhost:9000/idem-templates`, publié par `npm run publish:local` dans `idem-templates`), le cache disque
(`IDEM_TEMPLATES_CACHE`), l'instantané `catalog/snapshot.json`, puis le minimum intégré. Un manifeste non signé est
refusé dès que `IDEM_TEMPLATES_PUBKEY` est posée ; un HTML dont l'empreinte diffère est refusé ; un nœud dangereux ou
qui écrit des mots est écarté. Contrôle : `npm run check:catalog`.

**Ce que le modèle fait encore** (crans hauts) : le **langage visuel de la marque** (une fois par charte, gardé par l'hôte),
le **plan du document** et l'**exploration** de quatre pistes d'idée (Ultra) — ils guident le CHOIX dans le catalogue ;
le **juge visuel** départage les compositions rendues (High, Ultra). Aucun modèle n'écrit plus de HTML.

## Avant la 2.6 : l'écriture libre (retirée le 11 novembre 2026)

De la 2.0 (14 octobre 2026) à la 2.5, un modèle écrivait chaque page en HTML Tailwind (auteur, directeur de page,
travail par zones, variantes écrites, correction par réécriture, bibliothèque d'exemples). Ce chemin et ses rôles
(`graphic.author`, `graphic.cover`, `graphic.page-director`, `graphic.layout`, `graphic.zone`) sont retirés depuis la
2.7 ; les pages qu'il a écrites se rejouent toujours (même code, même assainissement). Historique :
[docs/MIGRATION.md](docs/MIGRATION.md).

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

Sans `agentCall`, le code choisit seul dans le catalogue (comme au cran Low) : aucune page n'est perdue faute de modèle.
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
  brief: project.description,       // ce que fait le projet, pour le directeur et le choix
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
  grand, logo en bas ») — le choix repart de la configuration actuelle (`CURRENT CONFIG`) avec la consigne.
- Une page de l'ancien moteur (arbre v1, `isAuthoredSpec(spec) === false`) ne se rejoue pas : elle est recomposée
  depuis le catalogue.

## Retoucher, remettre en page, exporter — sans réécrire

- `doc.page(id)` rend le **contenu final** d'une page (textes, chiffres, médias déjà posés) et son **code** : l'hôte les
  garde avec la section (`SectionModel.composition` chez IDEM).
- **Retouche de mots** : `applyTextEdits(content, { "<clé>": "nouveau texte" })` (les clés de la page ; les blocs
  posés par le code restent intouchables), puis `composeSection(content, { replay })` — aucun modèle.
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

## Économiser les jetons

- **Aucune page écrite par un modèle** : au cran Low, aucun appel ; au-dessus, une réponse JSON de quelques dizaines
  de jetons par page (le choix et ses réglages), et rien quand un seul gabarit convient.
- **Ce qui dure est écrit une fois** : le langage visuel de la marque, relu par tous ses livrables.
- **Les données ne passent jamais par le modèle** : textes par clés, graphiques et tableaux dessinés par le code ;
  une retouche de texte rejoue la page sans appel.

## Un rendu professionnel

Le niveau vient du CATALOGUE (gabarits documentés, relus, versionnés dans `idem-templates`) et des mesures du code :
un texte courant ne ressemble jamais au titre, une zone qui déborde est ramenée à sa taille ou la composition écartée,
un graphique n'est jamais écrasé, un actif de la marque est montré entier. **L'essentiel** reste garanti sur le
CONTENU : slide sans chapô, deux blocs de preuve et trois points au plus, le surplus dans les notes de l'orateur
(`slideEssentials`) ; un chiffre-clé est un chiffre (`figuresOnly`).

### Les primitives (`src/runtime/primitives.ts`)

| Balise | Ce que dessine le code |
|---|---|
| `<idem-chart data-block="b3" data-aspect="16/9" class="…">` | le graphique exact (bar, groupedBar, stacked, horizontalBar, line, area, pie, doughnut, radar), palette de la marque déclarée (`data-ge-palette`, recalculée par la traduction de marque) ; les libellés prennent la couleur du texte. Le composant choisit la représentation (`data-type`, refusée si elle trahit les données : camembert à plusieurs séries…) et peut mettre une catégorie en avant (`data-highlight`) |
| `<idem-table data-block="b4" data-rows="0-3" class="… [&_th]:bg-brand-primary">` | le tableau, cellule pour cellule, colonnes chiffrées à droite (`data-rows` : une plage de rangées, en-tête répété — pages A4) ; le composant le stylise depuis la balise |
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

Une composition qui ne s'affiche pas, ou dont l'ordre mesuré (`QUALITY`) est fautif — un texte posé sur un autre, un
actif de la marque rogné ou trop petit, un cadre vide, un graphique ou un tableau absent (`content_missing`) — cède la
place au candidat suivant du catalogue, puis au squelette intégré, sans modèle. En dernier recours, la meilleure page
est livrée avec son constat bloquant (`render_partial`) plutôt que perdue ; rien ne s'affiche du tout :
`GraphicRenderError` (le service traite la section comme en échec, et le dit).

Les constats non bloquants restent dans `result.issues` comme conseils, sans rien déclencher :
`native_css_removed`, `content_not_shown` (une clé que la page ne place pas), `unknown_keys`,
`unknown_blocks`.

## Les modules

| Dossier | Rôle |
|---|---|
| `contracts/` | ContentModel (blocs typés), SectionSpec/DesignSpec v2 (le code de la page et sa configuration du catalogue), RenderResult ; validation, normalisation, récupération d'une page HTML rendue par erreur |
| `catalog/` | registre (dépôt, CDN, cache, instantané), graphe, assemblage, choix par le modèle, mise en pages A4 (`paginate.ts`) |
| `author/` | prompts du directeur (langage de la marque, plan, exploration) ; appel de modèle tracé (`model.ts`) |
| `runtime/` | matière à plat, assainissement et remplissage, primitives, pages d'actif, Tailwind, contrôle d'affichage, navigateur |
| `content/` | analyse du volume de texte (budgets des slides), régime de texte (`slideDiet`) |
| `asset-planner/` | les médias d'une page : besoins, sources dans l'ordre, génération plafonnée par cran |
| `design-system/` | formats (cotes), jetons de la marque (couleurs lisibles, polices), palettes de graphiques, motifs |
| `agents/` | contrats des RÉDACTEURS de l'hôte : contrat de contenu, consigne de volume, plan de section |
| `adapters/` | marque IDEM → entrée du moteur ; sections depuis la sortie d'un rédacteur ; fragment autonome |
| `observability/` | traces par page, enregistrement d'une génération (`GenerationRecord`) |

## Contrôles

```
npm run check --prefix packages/graphic-engine          # 71 vérifications, aucun modèle, Chromium
npm run check:fast --prefix packages/graphic-engine     # sans Chromium
npm run check:catalog --prefix packages/graphic-engine  # chaque gabarit rendu dans Chromium (65 vérifications)
npm run schemas --prefix packages/graphic-engine      # régénère contracts/*.schema.json
```

Côté API : `check:creativity`, `check:roles`, `check:relayout`, `check:brand`, `check:mockups` (choix simulé dans le
catalogue, `apps/api/api/scripts/fakeGraphicAuthor.ts`), `check:bpcatalog` (business plan imprimé, aperçu = PDF) et
`check:bpquality` (le paginateur des pages écrites avant le catalogue).

# AGENTS.md — règles permanentes pour les agents IA

Ce fichier s'applique à **tout** ce qui est écrit dans ce dépôt par un agent :
code, écrans, livrables, chartes, documentation. Il n'a pas à être rappelé dans
la demande — il est la demande de fond, toujours valable.

> Le reste des conventions Angular/TypeScript est dans `.claude/CLAUDE.md`.
> Ce fichier-ci porte le **design** et les **briques partagées**.

---

## 1. Le design system s'utilise, il ne se reproduit pas

C'est la règle la plus importante, et celle qui a déjà été enfreinte.

**Respecter le design system ne veut pas dire « obtenir un rendu qui lui
ressemble ». Cela veut dire appeler ses classes.** Réécrire en Tailwind ou en
CSS local quelque chose que `@idem/shared-styles` fournit déjà est un défaut,
même si le résultat est joli — cela crée une deuxième source de vérité qui
dérivera.

### Avant d'écrire la moindre ligne de style

1. Ouvrir `packages/shared-styles/styles.css`.
2. Chercher si la brique existe déjà.
3. Elle existe presque toujours.

### L'inventaire (à jour au 25/09/2026)

**Surfaces** · `.glass` `.glass-card` `.glass-dark` `.modal-panel` `.modal-drawer`
`.container` `.border-glass` `.shadow-glass` `.shadow-glass-hover` `.project-card`

**Actions** · `.inner-button` (principale) `.outer-button` (secondaire)
`.button-ghost` `.button-accent` `.button-icon` `.button-sm` `.button-lg` `.button-xl`

**Signalétique** · `.tag` `.status-dot` `.i-underline` `.skeleton` `.pulse-glow`
`.animated-border` `.transition-smooth` `.custom-scrollbar` `.compact-grid`

**Couleur / lumière** · `.text-primary` `.text-secondary` `.text-accent` `.text-light`
`.bg-primary` `.bg-secondary` `.bg-dark` `.bg-light` `.gradient-primary`
`.gradient-secondary` `.gradient-accent` `.gradient-success` `.glow-primary`
`.glow-secondary` `.glow-accent` `.text-glow-primary` `.text-glow-secondary`
`.bg-gradient-glow`

**Formulaires** · rien à ajouter. `input[type=…]`, `select`, `textarea`, `label`,
`fieldset`, `legend`, `progress`, `meter` sont **stylés nativement**.

### Interdits

| Ne jamais écrire | Écrire |
|---|---|
| une classe `.box`, `.card`, `.panel` locale | `.glass-card` |
| un `.button` / `.btn` local | `.inner-button` / `.outer-button` |
| une classe `.input` locale | rien — l'élément natif est déjà stylé |
| `text-white`, `bg-white/10`, `border-white/5` | `text-text-primary`, `bg-[var(--glass-bg-light)]`, `border-[var(--glass-border-subtle)]` |
| `text-blue-500`, `bg-gray-800`, `#1447e6` | `text-primary-500`, tokens `--color-*` |
| une police d'icônes tierce (FontAwesome…) | `pi pi-*` — PrimeIcons est **dans** Vilevile |

### Deux pièges vérifiés

- Les sélecteurs d'éléments du design system ne sont pas dans un `@layer` : ils
  **battent** les utilitaires Tailwind. Un `select` avec `w-32` sortira en pleine
  largeur — il faut `!w-32`.
- Le design system stylise `input[type='text']`, pas `input`. **Un `<input>` sans
  attribut `type` ne reçoit aucun style.** Toujours écrire le `type`.

---

## 2. Un seul chargement : `<idem-loader>`

`@idem/shared-loader/angular` est **l'unique** indicateur de chargement de toutes
les applications. Il n'y a plus de `.loader`, plus de `.spinner`, plus de
`pi-spinner pi-spin`, plus d'anneau bricolé en `animate-spin rounded-full
border-t-…`, plus de `<app-loader>` local. Ces classes ont été retirées du design
system ; ne pas les réintroduire.

```html
<button class="inner-button" [disabled]="saving()">
  @if (saving()) { <idem-loader size="xs" /> }
  {{ 'common.save' | translate }}
</button>

<idem-loader block [label]="'common.loading' | translate" />   <!-- zone qui se remplit -->
<idem-loader size="lg" />                                      <!-- page entière -->
<idem-loader overlay />                                        <!-- rafraîchissement par-dessus -->
```

Tailles : `xs` (dans un bouton, à côté d'un mot) · `sm` · `md` (défaut) · `lg`.

**Ce qui reste distinct :** `.skeleton` et `animate-pulse`. Un squelette ne dit
pas « ça tourne », il dit « voilà la forme de ce qui arrive » — c'est une autre
information, et elle est meilleure dès qu'on connaît la mise en page à venir.

**Et il en faut.** Toute action qui part au réseau doit montrer qu'elle est
partie : un bouton qui soumet, une liste qui charge, un onglet qui va chercher
ses données. Un écran qui ne répond pas pendant deux secondes est un défaut, pas
un détail.

---

## 3. Minimalisme

- **Rien de décoratif.** Chaque trait, chaque encadré, chaque ombre doit porter
  une information. Pas de dégradé « pour faire joli », pas d'icône qui répète le
  mot juste à côté, pas de carte dans une carte.
- **Mesure.** Une hiérarchie typographique lisible bat cinq tailles de police.
  Deux niveaux de gris suffisent presque toujours.
- **Mots simples.** L'interface est lue par des non-techniciens : « Mettre en
  ligne », pas « Déployer le artefact ». Le jargon est acceptable seulement quand
  c'est le mot que l'utilisateur emploie lui-même.
- **Surfaces claires.** Aucun thème sombre imposé dans une charte, un livrable ou
  un site, sauf demande explicite. Les deux thèmes doivent rester lisibles :
  toute couleur écrite en dur trahit un écran qui n'a été regardé que dans un
  seul mode.

---

## 4. Illustrations

Là où un écran serait nu — état vide, choix entre deux options, étape d'un
parcours, page de réussite ou d'erreur, modale, section de présentation — il
faut une illustration. Ailleurs, non.

### Le style IDEM : un élément de la culture africaine, choisi pour le sens

Toute illustration de l'interface d'IDEM (dashboard, landing, iDeploy, AppGen,
simulateur) représente **un élément de la culture africaine qui dit la même
chose que la page**. C'est le style de référence pour les modales, les sections,
les états vides et les pages d'aboutissement. Le bouclier aux lances croisées
de l'écran de connexion (`shield-illustration`) et la clé à anneau-bouclier de
l'invitation bêta (`beta-invite`) en sont les modèles.

Choisir l'élément par le **sens**, jamais par le décor :

| Ce que dit l'écran | Élément à dessiner |
| --- | --- |
| Accès, compte, sécurité, protection | Bouclier aux lances croisées ; clé dont l'anneau est un bouclier |
| Argent, paiement, crédits, prix | Cauris (monnaie historique), calebasse qui les contient |
| Croissance, business plan, ambition | Baobab (jeune pousse → arbre adulte selon l'étape) |
| Communication, marketing, réseaux | Tambour parleur (tama, djembé) |
| Équipe, collaboration, partage | Arbre à palabres et tabourets en cercle |
| Stratégie, simulation, calcul | Plateau d'awalé et ses graines |
| Construction, application, code | Architecture de terre (murs en banco, torons de Djenné), métier à tisser |
| Mise en ligne, départ, lancement | Pirogue à la proue dressée |
| Attente, vide, rien encore | Calebasse vide, grenier à remplir |
| Erreur, problème | Calebasse fêlée, fil de tissage cassé |
| Réussite, livrable prêt | Pagne tissé déroulé, grenier plein |
| Serveur, réserve, stockage | Grenier dogon, canaris ; porte de grenier et serrure de bois pour « votre machine » |
| Recherche, tri | Van de vannage |
| Identité, logo, marque | Tampon adinkra en calebasse et son empreinte |
| Droit, équilibre | Balance akan à peser l'or |
| Document écrit | Feuillet manuscrit et calame |
| Retour en arrière, page introuvable | Sankofa (poids akan en forme d'oiseau qui se retourne) |
| Réseau, diagramme | Filet de pêche (épervier) |
| Étapes, progression guidée | Échelle dogon |
| Vérifier sur le terrain, tester en vrai | Daba (houe ouest-africaine à lame plate) |
| S'abriter des imprévus, protéger d'une crise | Kyinie (ombrelle d'apparat akan, « le roi couvre ») |
| Partir faire sa vie, choisir sa route, définir son projet | Croix d'Agadez (« je te donne les quatre coins du monde ») |

### Quand aucun objet ne colle : chercher, dessiner, ajouter

**Ne pas recycler un objet qui dit autre chose.** Reprendre le grenier ou le van
« parce qu'ils existent déjà » sur un écran dont le sens est différent est un
défaut, au même titre qu'une icône générique. Si aucun élément de la table ni
de `docs/ILLUSTRATIONS.md` ne dit exactement ce que dit l'écran :

1. **Chercher sur internet** un élément réel de la culture africaine (objet,
   outil, architecture, végétal, jeu, symbole adinkra porté par un objet) dont
   le sens d'usage correspond à l'écran. Vérifier ce sens dans au moins une
   source sérieuse (encyclopédie, musée, ouvrage d'ethnographie) et écarter
   tout objet sacré ou rituel.
2. **Dessiner son SVG** selon les règles ci-dessous (au trait, deux encres,
   motifs à l'intérieur de l'objet), dans le composant d'illustration de
   l'application concernée.
3. **L'ajouter au répertoire** : une ligne dans la table ci-dessus, une ligne
   dans le vocabulaire de `docs/ILLUSTRATIONS.md` avec sa source, et l'écran
   qui l'utilise dans la section de l'application.

Un même objet peut servir à plusieurs écrans **seulement** s'ils disent la même
chose.

**Ce qui est interdit :** masques et objets sacrés, animaux de safari, huttes au
coucher du soleil, silhouette du continent par défaut, motifs ethniques plaqués
en fond d'écran. Les motifs géométriques (bogolan, kente, ndebele : chevrons,
losanges, dents de scie, points) vivent **à l'intérieur** de l'objet dessiné,
jamais comme papier peint. Un élément par illustration.

### Comment elles sont faites

- **En SVG dans le code**, pas en fichier image : aucune requête, net à toutes les
  tailles, et le thème est suivi sans seconde version.
- **Deux encres.** `currentColor` pour le trait, `var(--color-primary-500)` pour
  le seul détail qui compte (souvent le cœur de l'objet : le losange du
  bouclier). Jamais plus.
- **Au trait**, `stroke-width` 1.5–2, pas d'aplat visible, pas d'ombre, pas de 3D.
  Un remplissage à la couleur de la surface est permis pour masquer ce qui
  passe derrière (les lances derrière le bouclier).
- **Décoratif pour les lecteurs d'écran** (`aria-hidden="true"`) : le texte voisin
  porte le sens.
- **Identifiants SVG uniques par instance** (`clipPath`, `use`) : la même
  illustration peut apparaître deux fois sur une page.
- Pas de personnage, pas de mascotte.

Le répertoire complet (objet retenu pour chaque écran, candidats écartés,
dessins gardés comme schémas) est dans `docs/ILLUSTRATIONS.md` : le compléter à
chaque nouvelle illustration.

Les illustrations partagées du dashboard sont dans
`apps/main-dashboard/src/app/shared/components/` (dont `module-emblem`, l'emblème
de chaque module, commun au tableau de bord et au lanceur du chat). Dans iDeploy
elles sont centralisées dans
`apps/ideploy-web/src/app/shared/components/illustration/illustration.ts`
(`box` `code` `server` `store` `market` `activity` `managed-cloud` `own-server`
`search` `shield` `team` `beads` `net`), l'état vide standard est `<app-empty-state>`,
et l'en-tête de page de liste `<app-page-header>`.
AppGen : `components/ui/Illustrations.tsx` et `tourIllustrations.ts`.
Images de partage (Open Graph) : `apps/api/public/og/illustrations/<clé>.svg`,
mêmes règles de dessin (voir `docs/SEO.md`).

**Ne pas confondre** avec les livrables générés pour les clients (charte,
visuels, site, documents) : ceux-là suivent l'identité et la direction
artistique de la marque du client (`apps/api/docs/ART_DIRECTION.md`), pas celle
d'IDEM.

---

## 5. Avant de dire que c'est fini

- [ ] `npx ng build` passe, et `npm run typecheck` aussi.
- [ ] L'écran a été **regardé** dans les deux thèmes — pas supposé correct.
- [ ] Aucune classe locale ne redouble une classe de `@idem/shared-styles`.
- [ ] Aucun `text-white`, aucun hex, aucune couleur de la palette Tailwind.
- [ ] Les icônes sont des `pi pi-*`.
- [ ] Chaque `<input>` a un `type`.
- [ ] Chaque appel réseau a son `<idem-loader>` ou son squelette.
- [ ] Chaque illustration représente un élément africain qui dit ce que dit l'écran (§ 4).
- [ ] Aucun objet recyclé pour un sens qu'il ne porte pas ; tout nouvel objet est sourcé et ajouté à `docs/ILLUSTRATIONS.md`.
- [ ] Aucune page vide, aucun grand blanc, aucun texte de remplissage.

Dire ce qui n'a pas été fait. Un périmètre réduit en silence est pire qu'un
périmètre annoncé.

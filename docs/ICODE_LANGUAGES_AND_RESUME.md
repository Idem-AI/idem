# iCode : langues des projets générés, plan de génération et reprise

Ce document décrit deux mécanismes d'iCode (`apps/appgen`).

- **Les langues.** Tout projet généré sort prêt à être traduit. Un site refait reprend toutes les langues de l'ancien site.
- **Le plan.** Une génération de site écrit sa liste de tâches avant de commencer et la coche à mesure. Un « continue » reprend là où elle s'était arrêtée.

## 1. Les langues

### Détection sur l'ancien site (refonte)

Le relevé (`apps/ivision/core/src/site/site-crawler.ts`) note les langues dans `inventory.languages`, la principale en tête. Chaque langue porte son mode de détection (`via`) :

| `via` | Source | Traitement |
| --- | --- | --- |
| `html` | `<html lang>` de l'accueil | langue principale |
| `hreflang` | `<link rel="alternate" hreflang>` | traduite d'office |
| `switcher` | sélecteur WPML, Polylang, TranslatePress, lien `hreflang` ou nom de langue | traduite d'office |
| `path` | au moins deux liens internes sous `/en/`, `/es/`… | traduite d'office |
| `widget` | traducteur automatique (GTranslate `gtranslateSettings`, Weglot), sans page vraiment traduite | **proposée** dans le chat |

Pour une langue `widget`, la question est posée avec les couleurs, avant toute facturation. Les options sont, dans l'ordre :

- la langue principale plus l'anglais (ou le français pour un site anglophone), marquée « Recommandé » ;
- toutes les langues proposées par le widget ;
- la langue principale seule.

Les pages des autres langues ne sont jamais relevées comme des pages du site. Les traducteurs automatiques (`translate.google*`, `gtranslate`, `weglot`) sont bloqués pendant la lecture : sans ce blocage, le relevé lirait une traduction machine (cas réel : eknumerik.org lu en anglais au lieu du français).

Vérification sans modèle : `npm run crawl -- <url> [pages]` dans `apps/ivision/core` affiche la ligne `languages`.

### Sites du moteur (`siteEngine`)

Le système de langues fait partie du template (`template/src/i18n/`). Il n'a aucune dépendance.

- `t("texte d'origine")` : le texte d'origine sert de clé, et une traduction absente laisse l'original. `{nom}` est remplacé par `valeurs.nom`.
- `localePath(lien)` : `/contact/` devient `/en/contact/` dans la langue courante. Les liens externes, les fichiers et les ancres ne bougent pas.
- `localize(objet)` : les faits de `@/site/data` se lisent traduits.
- `components/site/language-switcher.tsx` : affiche des liens vers la même page dans chaque langue, et rien s'il n'y a qu'une langue.
- Chaque langue a ses documents (`en/index.html`, `en/a-propos/index.html`) avec `<html lang>` (`dir="rtl"` pour l'arabe), le titre et la description traduits, et les balises `hreflang` + `x-default`.
- `vite.config.ts` découvre ces dossiers. `scripts/prerender.mjs` pré-rend les pages langue par langue et relit les modules à chaque langue.

Les auteurs écrivent en clair, dans la langue du site. Le code fait ensuite le reste (`src/siteEngine/i18n.ts`) :

1. `localizeCode` enveloppe chaque composant accepté :
   - le texte JSX, `alt`, `placeholder`, `aria-label` et les props de texte, ainsi que les textes des listes de contenu, passent dans `t()` ;
   - une phrase coupée par des valeurs devient une seule phrase avec `{name}` ;
   - les liens internes passent dans `localePath()` ;
   - les classes, icônes, variantes et animations ne sont pas touchées ;
   - le code est relu par le parseur TypeScript : au moindre doute, il est rendu tel quel ;
   - dans un site en plusieurs langues, la version enveloppée est d'abord montée en **pseudo-langue** (`pseudoLocaleFiles`). Un composant qui retrouve une icône par son titre (`icons[item.title]`) casserait une fois traduit : il garde alors ses textes en clair.
2. `collectMessages`, `dataMessages` et `shellMessages` relèvent les textes de la langue principale.
3. `translateCatalog` est l'agent traducteur. Il traduit par lots de 60 textes en JSON et garde inchangés les noms propres, prix, nombres, coordonnées et `{variables}`.
4. Le code écrit `src/i18n/config.json`, `src/i18n/messages/<langue>.json` et `src/i18n/messages.ts`.

Les langues d'une génération viennent de trois sources :

- l'ancien site ;
- le choix fait dans le chat ;
- la demande, via `languages` dans le manifeste, que l'architecte ne remplit que si la demande le réclame.

Le plafond est `SITE_MAX_LANGUAGES`, 6 par défaut.

Après la génération :

- **Retouche** (`edit.ts`) : le code modifié repasse dans `localizeCode`, et les phrases nouvelles sont traduites dans chaque langue (`syncCatalogs`).
- **`/translate <langue>`** (alias `/languages`, ou reconnu par l'agent) : ajoute une langue sans réécrire de section.
  - Sans langue nommée, la question est posée.
  - Un site d'avant les langues reçoit le système à ce moment-là.
  - L'opération est facturée comme une construction.

### Applications (web et mobile)

`scaffold/shared.ts` → `buildI18nKit` pose les fichiers suivants (sous `frontend/` pour une application web) :

- `src/i18n/index.js` (verrouillé) : `t`, `useLanguage`, `setLanguage`, `formatNumber`, `formatDate`, `formatCurrency` et `LanguageRoot`.
- `src/components/LanguageSwitcher.jsx` (verrouillé).
- `src/i18n/config.json` et `src/i18n/messages.js` : restent modifiables, puisqu'on y ajoute une langue.

`main.jsx` enveloppe l'application dans `<LanguageRoot>`. La skill `i18n` (cœur, cibles `web-app` et `mobile-app`) fait écrire chaque texte visible avec `t()` et explique comment ajouter une langue.

Contrôles :

- `npm run check:i18n` (29) : transformation, idempotence, catalogue, runtime exécuté, kit des applications.
- `npm run check:site-render` : section traduite montée dans un site en deux langues.

## 2. Le plan de génération et la reprise

Le moteur de sites écrit deux fichiers dans le projet (`src/siteEngine/plan.ts`) :

- `idem.plan.json` : les étapes et leur état (`pending`, `done` ou `failed`).
  - L'étape `design` est posée d'emblée.
  - L'en-tête, le pied de page, chaque section, l'assemblage et la traduction s'ajoutent une fois le manifeste connu.
  - Le fichier est réécrit à chaque étape. Le code le coche, jamais un modèle : une case cochée veut dire que le fichier est écrit.
- `idem.manifest.json` : le manifeste, le style des visuels et le thème. La reprise n'a ainsi rien à redemander aux modèles.

Une génération reprend dans trois cas :

- l'utilisateur tape `/continue` (alias `/resume`) ;
- l'agent reconnaît une demande de reprise (« continue », « vas-y ») alors que le contexte lui dit qu'une génération est inachevée ;
- l'atelier envoie sa consigne automatique après une réponse coupée, et le plan n'est pas terminé (`routes/chat.ts`). Auparavant, cette consigne tombait dans la retouche de site, qui répondait « je n'ai pas compris quelle partie modifier ».

L'atelier affiche aussi au-dessus de la saisie la carte « Votre dernière génération s'est arrêtée avant la fin », avec le bouton « Reprendre » marqué « Recommandé ».

À la reprise (`createSiteEngineStream({ resume })`) :

- Le manifeste et le design system sont relus dans les fichiers.
- Pour une refonte, le relevé de l'ancien site est relu dans IDEM, pas sur le site.
- Les composants cochés sont gardés tels quels. Ceux qui restent ou qui ont échoué sont écrits, avec les visuels déjà produits.
- L'assemblage et la traduction sont refaits si besoin.
- **Rien n'est refacturé.**
- Si la génération s'est arrêtée avant le manifeste, elle repart de la demande du plan. Pour une refonte, elle repart du relevé stocké, toujours sans refacturer.

Contrôle : `npm run check:commands` (69). Il couvre `/translate`, `/continue`, le plan coché étape par étape et la reprise sans projet.

# @idem/shared-trusted-by

Le bandeau défilant « Ils nous font confiance » — les communautés tech et
partenaires d'Idem — partagé par les landing pages du monorepo.

Une seule liste de partenaires, une seule feuille de style, un rendu par
framework. Ajouter un partenaire se fait à un seul endroit.

## Ce que contient le paquet

| Fichier              | Rôle                                                            |
| -------------------- | --------------------------------------------------------------- |
| `partners.json`      | La liste des partenaires. **La source de vérité.**              |
| `assets/`            | Les logos, en `kebab-case` (les espaces cassent certaines URL). |
| `src/trusted-by.css` | La feuille de style, commune aux trois rendus.                  |
| `src/angular/`       | Le composant Angular, `<idem-trusted-by>`.                      |
| `src/react/`         | Le composant React, `<TrustedBy />`.                            |
| `src/index.ts`       | Les données seules, sans framework.                             |

Les rendus vivent dans des points d'entrée séparés pour qu'une application
React n'embarque pas Angular, et réciproquement.

## Utilisation

### Angular

```ts
import { TrustedByComponent } from '@idem/shared-trusted-by/angular';

@Component({
  imports: [TrustedByComponent],
  template: `<idem-trusted-by [label]="'landing.trustedBy' | translate" />`,
})
```

### React

```tsx
import { TrustedBy } from '@idem/shared-trusted-by/react';

<TrustedBy label={t('landing.trustedBy')} />;
```

Sans `label`, aucun intitulé n'est rendu — c'est ce que fait la landing
principale, où le bandeau ferme le hero.

## Les logos, eux, doivent être copiés

Un composant partagé ne suffit pas : chaque application sert ses propres
fichiers statiques. Les logos doivent donc exister dans le `public/` de
chacune, sous `/assets/images/trust-by`.

```bash
npm run sync:trusted-by     # copie les logos dans chaque application
npm run check:trusted-by    # vérifie sans copier (pour la CI)
```

Une application qui sert ses images ailleurs le dit :
`<idem-trusted-by basePath="/static/partners" />`.

## Ajouter un partenaire

1. Déposer le logo dans `assets/`, en `kebab-case`.
2. Ajouter l'entrée dans `partners.json`.
3. `npm run sync:trusted-by` à la racine, et versionner le résultat.

Aucune application n'est à modifier.

## Applications concernées

`landing`, `ideploy-web`, `simulation` et `appgen` (client iCode).

Absents volontairement : `chart` et `main-dashboard`, qui n'ont pas de landing
page, et `ideploy` — la version Laravel historique, remplacée par
`ideploy-web`.

## Une note sur les versions d'Angular

Le paquet est consommé en source, hors de `node_modules` : son
`import ... from '@angular/core'` remonte jusqu'à la racine du monorepo. Une
application dont la version d'Angular diffère de celle qui y est hissée doit
épingler la sienne, sinon deux copies du framework se retrouvent dans le
bundle :

```jsonc
// apps/<app>/tsconfig.json
"paths": { "@angular/*": ["./node_modules/@angular/*"] }
```

C'est ce que fait `simulation` (Angular 22, contre Angular 20 à la racine).
Côté React, `appgen` obtient le même résultat avec le `resolve.dedupe` de Vite.

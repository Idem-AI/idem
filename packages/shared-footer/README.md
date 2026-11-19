# @idem/shared-footer

Le pied de page d'IDEM — et le registre des textes juridiques auquel il renvoie.

Un seul pied de page sert les six applications du dépôt : la landing, iCode,
iDeploy, iVision, iDomain et le simulateur. Avant, chacune avait le sien :
iVision portait une ligne sans aucun lien juridique, le simulateur n'avait rien,
et le tableau de bord obligeait à quitter l'application pour lire les conditions
générales.

## Contenu

| Fichier | Rôle |
| --- | --- |
| `src/legal.ts` | **Le registre des textes juridiques.** La source de vérité : identifiant, chemin, service, nature, libellé. |
| `src/apps.ts` | La structure du pied de page : colonnes, promesse, réseaux, par application. |
| `src/footer.css` | La feuille, partagée par les deux rendus. |
| `src/angular/` | Le composant Angular, `<idem-footer>`. |
| `src/react/` | Le composant React, `<IdemFooter />`. |
| `src/check.ts` | `npm run check:legal` : vérifie que registre, contenus, routes, référencement et sous-traitants disent la même chose. |

Les rendus ont des points d'entrée séparés, pour qu'une application React
n'embarque pas Angular, et réciproquement.

## Usage

### Angular

```ts
import { IdemFooterComponent } from '@idem/shared-footer/angular';

@Component({
  imports: [IdemFooterComponent],
  template: `
    <idem-footer app="ideploy" [locale]="locale()" [services]="services">
      <app-language-selector /><app-theme-toggle />
    </idem-footer>
  `,
})
```

Le contenu projeté par défaut atterrit dans la zone de préférences, à droite de
la ligne de signature : la bascule de langue et celle de thème agissent sur
l'application hôte, elles ne peuvent donc pas être partagées.

Une application qui dessine sa marque au lieu de servir deux fichiers (iVision,
iDomain) le déclare et projette son signe :

```html
<idem-footer app="ivision" [brandSlot]="true">
  <a idemFooterBrand href="/"><iv-brand-mark /></a>
</idem-footer>
```

### React

```tsx
import { IdemFooter } from '@idem/shared-footer/react';

<IdemFooter
  app="icode"
  locale="fr"
  services={FOOTER_SERVICES}
  brand={<Brand size="sm" />}
  prefs={<><LanguageToggle /><ThemeToggle /></>}
/>;
```

### La variante compacte

`compact` ne garde que la ligne de signature et les liens juridiques. C'est ce
qu'utilisent le tableau de bord et le simulateur : un atelier n'est pas une page
d'accueil, mais il doit porter les mêmes textes.

## Les adresses

Les colonnes pointent d'autres applications. L'hôte passe ce que son
`environment` connaît ; le reste retombe sur les adresses de production
(`DEFAULT_SERVICES`). Un lien absent serait pire qu'un lien qui sort du
développement, et une adresse vide dans un `environment` ne masque pas la
production.

`selfHosted` est réservé à la landing : elle sert elle-même les pages produit et
les textes juridiques, donc ses liens restent relatifs et le routeur les prend
en charge.

## Les textes juridiques

Le registre déclare *où* chaque texte vit ; son contenu est écrit dans la
landing (`apps/landing/src/app/shared/legal/`), bilingue, et rendu par une seule
page (`legal-page.ts`) à partir de l'identifiant posé par la route.

Les textes sont servis par la landing, à une seule adresse. Une application qui
les recopierait aurait sa propre version le jour où la politique change — c'est
exactement ce qu'un texte juridique ne supporte pas.

```
npm run check:legal
```

échoue si un document déclaré n'a pas de contenu, si un contenu n'est pas
déclaré, si un chemin n'a pas de route, s'il manque au plan du site, ou si un
sous-traitant du code (`apps/api/api/config/data-governance.ts`) n'est pas
publié sur la page des sous-traitants.

## Ajouter un texte

1. Déclarer le document dans `src/legal.ts`.
2. Écrire son contenu dans `apps/landing/src/app/shared/legal/docs/<id>.ts`, et
   l'importer dans `docs/index.ts`.
3. Ajouter sa route dans `apps/landing/src/app/app.routes.ts`
   (`legalDoc: '<id>'`), et sa page dans `packages/shared-seo/src/landing.ts`.
4. `npm run check:legal`, puis `npm run seo:sync`.

Aucun pied de page n'a besoin de changer : il lit le registre.

## Une note sur les images Docker

Une application est construite deux fois : chez vous, où tout `packages/` est
là, et dans son image, où **seul ce que son Dockerfile copie existe**. Ce paquet
est donc copié dans `Dockerfile/prod/Dockerfile.{landing,main-dashboard,main-dashboard.staging,simulation,appgen-client}` ;
les images d'iDeploy web, d'iVision web et celles de développement prennent
tout `packages/` et n'avaient rien à changer.

Il tire la définition de la marque de `@idem/shared-seo` : les mêmes images
copient donc ce paquet aussi.

```
npm run check:docker
```

compare, pour chaque image, les paquets `@idem/*` que les sources importent et
ceux que le Dockerfile copie. C'est la règle 5 d'`AGENTS.md`.

## Une note sur les versions d'Angular

Le paquet est consommé comme source, hors de `node_modules` : son
`import … from '@angular/core'` remonte à la racine du monorepo. Une application
dont la version d'Angular diffère doit épingler la sienne, sinon deux copies du
framework finissent dans le paquet final. C'est ce que fait `simulation`
(Angular 22 contre 20 à la racine), par un lien symbolique et
`preserveSymlinks`. Côté React, iCode obtient le même résultat avec le
`resolve.dedupe` de Vite.

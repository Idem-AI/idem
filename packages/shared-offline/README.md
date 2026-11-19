# @idem/shared-offline

Le service worker partagé des applications IDEM.

## Pourquoi

Deux problèmes mesurés sur les connexions à bas débit :

- **chaque retour retéléchargeait tout** ce que le cache HTTP n'avait pas gardé ;
- **les versions périmées** : sans `Cache-Control`, les navigateurs appliquaient
  leur cache heuristique et gardaient des semaines une coquille obsolète.

Le worker sert la page depuis le cache puis la revalide : l'application
s'affiche tout de suite, et la mise à jour arrive au chargement suivant.

## Branchement dans une application

1. `angular.json` — recopier le worker à la RACINE des assets. Un service
   worker ne contrôle que les pages sous son propre chemin : servi depuis un
   sous-dossier, il ne verrait rien.

   ```json
   { "glob": "sw.js", "input": "../../packages/shared-offline/src", "output": "." }
   ```

2. `app.config.ts` — enregistrer après le premier rendu :

   ```ts
   provideAppInitializer(() => {
     registerIdemServiceWorker({ onUpdate: () => inject(UpdateBanner).show() });
   });
   ```

3. nginx — `/sw.js` doit être servi en `no-cache`. C'est déjà le cas dans les
   configurations IDEM (voir la carte `$idem_uri_cc`).

## Ce qu'il ne fait pas

- **Aucun précache à l'installation.** Précharger la coquille au premier
  passage doublerait le coût de la première visite, exactement ce qu'on cherche
  à éviter.
- **Aucun `skipWaiting()` automatique.** Remplacer le worker pendant que
  l'utilisateur travaille échangerait les fichiers sous ses pieds : c'est la
  page qui décide, via `applyIdemServiceWorkerUpdate()`.
- **Aucune mise en cache des appels d'API.** Un solde de portefeuille ou une
  génération en cours servis depuis un cache seraient faux.

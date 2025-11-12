# Fix: "Cannot find module" dans les fichiers .svelte

## Problème

Les imports dans les fichiers `.svelte` affichent "Cannot find module" dans VSCode alors que le build fonctionne.

## Cause

VSCode/TypeScript ne détecte pas correctement le fichier `.svelte-kit/tsconfig.json` généré par SvelteKit qui contient les alias de paths.

## Solution

### 1. Vérifier que le fichier `.svelte-kit/tsconfig.json` existe

Le fichier existe déjà et contient les bons paths:

```json
{
  "compilerOptions": {
    "paths": {
      "@idem/shared-models": ["../../../packages/shared-models/src"],
      "@idem/shared-auth-client": ["../../../packages/shared-auth-client/src"],
      "$lib": ["../src/lib"],
      "$lib/*": ["../src/lib/*"]
    }
  }
}
```

### 2. Redémarrer le serveur TypeScript Svelte

**Option 1: Commande VSCode**

1. `Cmd+Shift+P` (Mac) ou `Ctrl+Shift+P` (Windows/Linux)
2. Tapez: `Svelte: Restart Language Server`
3. Appuyez sur Entrée

**Option 2: Redémarrer TypeScript**

1. `Cmd+Shift+P` (Mac) ou `Ctrl+Shift+P` (Windows/Linux)
2. Tapez: `TypeScript: Restart TS Server`
3. Appuyez sur Entrée

**Option 3: Recharger la fenêtre**

1. `Cmd+Shift+P` (Mac) ou `Ctrl+Shift+P` (Windows/Linux)
2. Tapez: `Developer: Reload Window`
3. Appuyez sur Entrée

### 3. Vérifier l'extension Svelte pour VSCode

Assurez-vous que l'extension **Svelte for VS Code** est installée:

1. Ouvrez les extensions (`Cmd+Shift+X`)
2. Cherchez "Svelte for VS Code" (svelte.svelte-vscode)
3. Installez-la si elle n'est pas déjà installée

### 4. Configuration VSCode pour Svelte

Ajoutez dans `.vscode/settings.json`:

```json
{
  "svelte.enable-ts-plugin": true,
  "svelte.plugin.svelte.compilerWarnings": {
    "css-unused-selector": "ignore"
  }
}
```

## Vérification

Après le redémarrage, ces imports devraient fonctionner dans les fichiers `.svelte`:

✅ Packages npm standards:

```svelte
<script lang="ts">
  import { writable } from 'svelte/store';
  import { onMount } from 'svelte';
</script>
```

✅ Packages partagés:

```svelte
<script lang="ts">
  import { UserModel } from '@idem/shared-models';
  import { AuthClient } from '@idem/shared-auth-client';
</script>
```

✅ Alias locaux:

```svelte
<script lang="ts">
  import Component from '$lib/components/Component.svelte';
</script>
```

## Si le problème persiste

### 1. Régénérer `.svelte-kit`

```bash
cd apps/chart
rm -rf .svelte-kit
npm run dev
# Arrêter après quelques secondes (Ctrl+C)
```

### 2. Vérifier `svelte.config.js`

Les alias sont déjà correctement configurés:

```javascript
kit: {
  alias: {
    '@idem/shared-models': '../../packages/shared-models/src',
    '@idem/shared-auth-client': '../../packages/shared-auth-client/src'
  }
}
```

### 3. Nettoyer et réinstaller

```bash
rm -rf node_modules .svelte-kit
npm install
```

### 4. Vérifier les versions

```bash
npx svelte-check --version
npx tsc --version
```

## Notes importantes

- ✅ Le `tsconfig.json` ne doit PAS contenir `baseUrl` et `paths` (déjà corrigé)
- ✅ Les alias doivent être dans `svelte.config.js` (déjà fait)
- ✅ SvelteKit génère automatiquement `.svelte-kit/tsconfig.json`
- 🔄 Un redémarrage du serveur Svelte est nécessaire après modification

## Configuration actuelle

### `tsconfig.json` (simplifié)

```json
{
  "extends": "./.svelte-kit/tsconfig.json",
  "compilerOptions": {
    "moduleResolution": "bundler"
  }
}
```

### `svelte.config.js` (aliases)

```javascript
kit: {
  alias: {
    '$/*': './src/lib/*',
    '@idem/shared-models': '../../packages/shared-models/src',
    '@idem/shared-auth-client': '../../packages/shared-auth-client/src'
  }
}
```

Cette configuration est optimale pour SvelteKit + TypeScript!

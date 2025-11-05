# Exemples d'utilisation des fichiers de traduction divisés

Ce document présente des exemples concrets d'utilisation des scripts de division et fusion des fichiers de traduction.

## 📚 Table des matières

- [Exemple 1 : Modifier une traduction existante](#exemple-1--modifier-une-traduction-existante)
- [Exemple 2 : Ajouter une nouvelle traduction](#exemple-2--ajouter-une-nouvelle-traduction)
- [Exemple 3 : Créer un nouveau composant avec traductions](#exemple-3--créer-un-nouveau-composant-avec-traductions)
- [Exemple 4 : Workflow complet de développement](#exemple-4--workflow-complet-de-développement)

## Exemple 1 : Modifier une traduction existante

### Scénario

Vous voulez modifier le texte du bouton "Save" dans le sidebar.

### Étapes

**1. Diviser les fichiers :**

```bash
npm run i18n:split
```

**2. Localiser le fichier :**

```bash
# Le sidebar est dans modules/dashboard/components/sidebar-dashboard
cd public/assets/i18n/split/modules/dashboard/components/sidebar-dashboard
```

**3. Éditer le fichier anglais :**

```json
// en.json - AVANT
{
  "projectHome": "Project Home",
  "teams": "Teams",
  "branding": "Branding"
}

// en.json - APRÈS
{
  "projectHome": "Project Home",
  "teams": "My Teams",  // ← Modifié
  "branding": "Branding"
}
```

**4. Éditer le fichier français :**

```json
// fr.json - AVANT
{
  "projectHome": "Accueil du projet",
  "teams": "Équipes",
  "branding": "Image de marque"
}

// fr.json - APRÈS
{
  "projectHome": "Accueil du projet",
  "teams": "Mes équipes",  // ← Modifié
  "branding": "Image de marque"
}
```

**5. Fusionner les fichiers :**

```bash
cd ../../../../../..  # Retour à la racine
npm run i18n:merge
```

**6. Vérifier le résultat :**

```bash
# Les fichiers en.json et fr.json ont été mis à jour
git diff public/assets/i18n/en.json
git diff public/assets/i18n/fr.json
```

**7. Commit :**

```bash
git add public/assets/i18n/*.json
git commit -m "feat: update teams label in sidebar"
```

## Exemple 2 : Ajouter une nouvelle traduction

### Scénario

Vous ajoutez un nouveau bouton "Export PDF" dans le composant `project-card`.

### Étapes

**1. Diviser les fichiers :**

```bash
npm run i18n:split
```

**2. Éditer le fichier du composant :**

```bash
cd public/assets/i18n/split/modules/dashboard/components/project-card
```

**3. Ajouter la traduction en anglais :**

```json
// en.json - AVANT
{
  "logoAlt": "Logo",
  "open": "Open"
}

// en.json - APRÈS
{
  "logoAlt": "Logo",
  "open": "Open",
  "exportPdf": "Export PDF",           // ← Nouveau
  "exportSuccess": "PDF exported!"     // ← Nouveau
}
```

**4. Ajouter la traduction en français :**

```json
// fr.json - AVANT
{
  "logoAlt": "Logo",
  "open": "Ouvrir"
}

// fr.json - APRÈS
{
  "logoAlt": "Logo",
  "open": "Ouvrir",
  "exportPdf": "Exporter en PDF",      // ← Nouveau
  "exportSuccess": "PDF exporté !"     // ← Nouveau
}
```

**5. Utiliser dans le composant Angular :**

```typescript
// project-card.component.ts
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-project-card',
  imports: [CommonModule, TranslateModule],
  templateUrl: './project-card.component.html',
})
export class ProjectCardComponent {
  exportPdf(): void {
    // Logic here
    console.log('Exporting PDF...');
  }
}
```

```html
<!-- project-card.component.html -->
<button (click)="exportPdf()">{{ 'dashboard.projectCard.exportPdf' | translate }}</button>
```

**6. Fusionner et tester :**

```bash
cd ../../../../../..
npm run i18n:merge
npm start
```

## Exemple 3 : Créer un nouveau composant avec traductions

### Scénario

Vous créez un nouveau composant `project-settings` dans `modules/dashboard/components/`.

### Étapes

**1. Créer le composant Angular :**

```bash
cd src/app/modules/dashboard/components
ng generate component project-settings --standalone
```

**2. Ajouter les traductions dans les fichiers monolithiques :**

```json
// public/assets/i18n/en.json
{
  "dashboard": {
    // ... autres traductions
    "projectSettings": {
      "title": "Project Settings",
      "general": "General",
      "advanced": "Advanced",
      "save": "Save Settings",
      "cancel": "Cancel",
      "sections": {
        "general": {
          "name": "Project Name",
          "description": "Description",
          "visibility": "Visibility"
        },
        "advanced": {
          "apiKey": "API Key",
          "webhook": "Webhook URL",
          "customDomain": "Custom Domain"
        }
      }
    }
  }
}
```

```json
// public/assets/i18n/fr.json
{
  "dashboard": {
    // ... autres traductions
    "projectSettings": {
      "title": "Paramètres du projet",
      "general": "Général",
      "advanced": "Avancé",
      "save": "Enregistrer les paramètres",
      "cancel": "Annuler",
      "sections": {
        "general": {
          "name": "Nom du projet",
          "description": "Description",
          "visibility": "Visibilité"
        },
        "advanced": {
          "apiKey": "Clé API",
          "webhook": "URL du webhook",
          "customDomain": "Domaine personnalisé"
        }
      }
    }
  }
}
```

**3. Mettre à jour le mapping dans `scripts/split-i18n.js` :**

```javascript
componentMapping: {
  // ... autres mappings
  'dashboard.projectSettings': 'modules/dashboard/components/project-settings',
}
```

**4. Mettre à jour le mapping dans `scripts/merge-i18n.js` :**

```javascript
pathToKeyMapping: {
  // ... autres mappings
  'modules/dashboard/components/project-settings': 'dashboard.projectSettings',
}
```

**5. Diviser les fichiers :**

```bash
npm run i18n:split
```

**Résultat :** Les fichiers suivants sont créés automatiquement :

- `public/assets/i18n/split/modules/dashboard/components/project-settings/en.json`
- `public/assets/i18n/split/modules/dashboard/components/project-settings/fr.json`

**6. Utiliser dans le composant :**

```typescript
// project-settings.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-project-settings',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './project-settings.component.html',
})
export class ProjectSettingsComponent {}
```

```html
<!-- project-settings.component.html -->
<div class="settings-container">
  <h2>{{ 'dashboard.projectSettings.title' | translate }}</h2>

  <div class="tabs">
    <button>{{ 'dashboard.projectSettings.general' | translate }}</button>
    <button>{{ 'dashboard.projectSettings.advanced' | translate }}</button>
  </div>

  <div class="general-section">
    <label>{{ 'dashboard.projectSettings.sections.general.name' | translate }}</label>
    <input type="text" />

    <label>{{ 'dashboard.projectSettings.sections.general.description' | translate }}</label>
    <textarea></textarea>
  </div>

  <div class="actions">
    <button>{{ 'dashboard.projectSettings.save' | translate }}</button>
    <button>{{ 'dashboard.projectSettings.cancel' | translate }}</button>
  </div>
</div>
```

## Exemple 4 : Workflow complet de développement

### Scénario

Vous travaillez sur une nouvelle fonctionnalité pendant 2 semaines avec plusieurs développeurs.

### Workflow recommandé

**Jour 1 - Configuration initiale :**

```bash
# 1. Créer une branche
git checkout -b feature/new-dashboard-widget

# 2. Diviser les fichiers pour faciliter le travail
npm run i18n:split

# 3. Commit la structure divisée (optionnel)
git add public/assets/i18n/split/
git commit -m "chore: split i18n files for development"
```

**Pendant le développement (Jours 2-12) :**

```bash
# Chaque développeur modifie les fichiers divisés dans son composant
# Exemple : Développeur A travaille sur le widget
cd public/assets/i18n/split/modules/dashboard/components/dashboard-widget
# Éditer en.json et fr.json

# Développeur B travaille sur le sidebar
cd public/assets/i18n/split/modules/dashboard/components/sidebar-dashboard
# Éditer en.json et fr.json

# Moins de conflits Git car chaque dev travaille sur des fichiers différents !
```

**Avant chaque commit :**

```bash
# 1. Fusionner les fichiers divisés
npm run i18n:merge

# 2. Vérifier les changements
git diff public/assets/i18n/en.json
git diff public/assets/i18n/fr.json

# 3. Commit
git add public/assets/i18n/*.json
git commit -m "feat: add translations for dashboard widget"
```

**Jour 13 - Merge de la branche :**

```bash
# 1. Fusionner une dernière fois
npm run i18n:merge

# 2. Nettoyer les fichiers divisés (optionnel)
rm -rf public/assets/i18n/split/

# 3. Merge
git checkout main
git merge feature/new-dashboard-widget
```

**Jour 14 - Production :**

```bash
# Les fichiers monolithiques (en.json, fr.json) sont utilisés en production
npm run build

# L'application charge automatiquement les fichiers fusionnés
```

## 🎯 Bonnes pratiques

### ✅ À faire

1. **Diviser au début d'un sprint** pour faciliter la collaboration
2. **Fusionner avant chaque commit** pour maintenir les fichiers monolithiques à jour
3. **Tester après fusion** avec `npm start` pour vérifier que tout fonctionne
4. **Documenter les nouvelles clés** dans le code avec des commentaires
5. **Utiliser des clés descriptives** : `dashboard.projectSettings.save` (pas `dashboard.ps.s`)

### ❌ À éviter

1. **Ne pas commiter les fichiers divisés** dans la branche principale (sauf si toute l'équipe est d'accord)
2. **Ne pas modifier les fichiers monolithiques ET divisés** en même temps
3. **Ne pas oublier de mettre à jour les mappings** lors de l'ajout de nouveaux composants
4. **Ne pas utiliser des clés trop génériques** : `button.save` → `dashboard.projectSettings.save`

## 🔧 Commandes utiles

```bash
# Diviser les fichiers
npm run i18n:split

# Fusionner les fichiers
npm run i18n:merge

# Diviser puis fusionner (test)
npm run i18n:split-merge

# Compter le nombre de fichiers divisés
find public/assets/i18n/split -name "*.json" | wc -l

# Chercher une clé de traduction
grep -r "projectHome" public/assets/i18n/split/

# Lister tous les composants avec traductions
ls -R public/assets/i18n/split/modules/dashboard/components/
```

## 📊 Statistiques

Après division, vous obtenez :

- **29 fichiers** par langue (58 au total)
- **Structure organisée** suivant l'arborescence de l'application
- **Fichiers plus petits** : 10-50 lignes au lieu de 820 lignes
- **Moins de conflits Git** lors du travail en équipe

## 🚀 Prochaines étapes

1. Consultez [I18N_SPLIT_GUIDE.md](./I18N_SPLIT_GUIDE.md) pour le guide complet
2. Lisez [scripts/README.md](./scripts/README.md) pour la documentation des scripts
3. Testez les scripts avec `npm run i18n:split-merge`

---

**Dernière mise à jour :** Janvier 2025

# 🌍 Guide de Synchronisation Intelligente i18n

## 📋 Vue d'ensemble

Le système de traduction utilise maintenant une **synchronisation bidirectionnelle intelligente** qui :

- ✅ **Préserve** les traductions existantes
- ✅ **Ajoute** les nouvelles clés
- ✅ **Met à jour** les clés modifiées
- ✅ **Fonctionne dans les deux sens** (split ↔ complet)

---

## 🗂️ Structure des fichiers

```
public/assets/i18n/
├── en.json                    # Fichier complet EN (généré)
├── fr.json                    # Fichier complet FR (généré)
└── split/                     # Fichiers divisés par composant
    ├── shared/
    │   ├── common/
    │   │   ├── en.json
    │   │   └── fr.json
    │   └── ...
    └── modules/
        └── dashboard/
            ├── components/
            │   ├── branding-required-blocker/
            │   │   ├── en.json
            │   │   └── fr.json
            │   └── ...
            └── pages/
                └── ...
```

---

## 🚀 Commandes disponibles

### **1. Restauration depuis Git** 🆘

```bash
npm run i18n:restore
```

- Récupère la version précédente depuis Git (HEAD)
- Fusionne avec la version actuelle
- **Restaure** toutes les traductions perdues
- Crée des sauvegardes (\*.backup.json)

**Quand l'utiliser :**

- Après avoir perdu des traductions suite à un merge
- Pour récupérer des traductions supprimées par erreur
- Avant de faire un commit pour vérifier qu'aucune traduction n'a été perdue

**Exemple de résultat :**

```
📊 Statistiques:
   📉 Version actuelle: 1529 clés
   📦 Version Git: 1604 clés
   ✨ Version fusionnée: 1625 clés
   🆕 Clés restaurées: 96
```

---

### **2. Merge intelligent (split → complet)**

```bash
npm run i18n:merge
```

- Fusionne tous les fichiers split dans les fichiers complets
- **Préserve** les traductions existantes dans les fichiers complets
- **Ajoute** les nouvelles clés depuis les fichiers split
- **Met à jour** les clés modifiées

**Quand l'utiliser :**

- Après avoir modifié un fichier split
- Après avoir ajouté un nouveau composant avec traductions

---

### **2. Split intelligent (complet → split)**

```bash
npm run i18n:split
```

- Divise les fichiers complets dans les fichiers split
- **Préserve** les traductions existantes dans les fichiers split
- **Ajoute** les nouvelles clés depuis les fichiers complets
- **Met à jour** les clés modifiées

**Quand l'utiliser :**

- Après avoir modifié directement un fichier complet (en.json ou fr.json)
- Pour synchroniser les modifications du fichier complet vers les fichiers split

---

### **3. Synchronisation bidirectionnelle**

```bash
npm run i18n:sync
```

- Exécute `merge` puis `split`
- Synchronise complètement dans les deux sens
- Garantit la cohérence totale

**Quand l'utiliser :**

- Après avoir modifié plusieurs fichiers (split et complet)
- Pour une synchronisation complète avant un commit
- En cas de doute sur l'état de synchronisation

---

### **4. Scripts legacy (anciens)**

```bash
npm run i18n:merge:legacy   # Ancien merge (écrase tout)
npm run i18n:split:legacy   # Ancien split (écrase tout)
```

⚠️ **Attention :** Ces scripts écrasent complètement les fichiers. À utiliser uniquement en cas de problème.

---

## 📝 Workflow recommandé

### **Scénario 0 : Récupérer des traductions perdues** 🆘

**Si vous avez perdu des traductions après un merge :**

1. **Restaurer depuis Git :**

   ```bash
   npm run i18n:restore
   ```

2. **Synchroniser les fichiers split :**

   ```bash
   npm run i18n:split
   ```

3. **Vérifier les changements :**

   ```bash
   git diff public/assets/i18n/en.json
   ```

4. **Commit les traductions restaurées :**
   ```bash
   git add public/assets/i18n/
   git commit -m "chore(i18n): restore lost translations from Git"
   ```

**Résultat :**

- ✅ Toutes les traductions Git sont récupérées
- ✅ Les nouvelles traductions sont préservées
- ✅ Les fichiers split sont synchronisés
- ✅ Sauvegardes créées (\*.backup.json)

---

### **Scénario 1 : Ajouter une nouvelle traduction dans un composant**

1. Modifier le fichier split du composant :

   ```
   public/assets/i18n/split/modules/dashboard/components/mon-composant/en.json
   ```

2. Exécuter le merge :

   ```bash
   npm run i18n:merge
   ```

3. Les traductions sont automatiquement ajoutées à `en.json` et `fr.json`

---

### **Scénario 2 : Modifier une traduction existante**

**Option A : Modifier dans le fichier split**

1. Modifier le fichier split
2. Exécuter `npm run i18n:merge`

**Option B : Modifier dans le fichier complet**

1. Modifier `en.json` ou `fr.json`
2. Exécuter `npm run i18n:split`

---

### **Scénario 3 : Ajouter un nouveau composant**

1. Créer le dossier et les fichiers de traduction :

   ```
   public/assets/i18n/split/modules/dashboard/components/nouveau-composant/
   ├── en.json
   └── fr.json
   ```

2. Ajouter le mapping dans `scripts/smart-merge-i18n.js` et `scripts/smart-split-i18n.js` :

   ```javascript
   pathToKeyMapping: {
     // ...
     'modules/dashboard/components/nouveau-composant': 'dashboard.nouveauComposant',
   }
   ```

3. Exécuter la synchronisation :
   ```bash
   npm run i18n:sync
   ```

---

## 🔍 Comment ça fonctionne ?

### **Merge intelligent (split → complet)**

```javascript
// 1. Charge le fichier complet existant
const existingTranslations = JSON.parse(fs.readFileSync('en.json'));

// 2. Charge tous les fichiers split
const splitTranslations = loadAllSplitFiles();

// 3. Fusion profonde (deepMerge)
const finalTranslations = deepMerge(existingTranslations, splitTranslations);

// 4. Sauvegarde
fs.writeFileSync('en.json', JSON.stringify(finalTranslations));
```

**Résultat :**

- Les clés existantes dans `en.json` sont **préservées**
- Les nouvelles clés depuis les fichiers split sont **ajoutées**
- Les clés modifiées dans les fichiers split **écrasent** celles de `en.json`

---

### **Split intelligent (complet → split)**

```javascript
// 1. Charge le fichier complet
const completeTranslations = JSON.parse(fs.readFileSync('en.json'));

// 2. Pour chaque mapping
for (const [path, key] of Object.entries(pathToKeyMapping)) {
  // 3. Extrait la valeur
  const value = getNestedValue(completeTranslations, key);

  // 4. Crée/met à jour le fichier split
  const splitContent = {};
  setNestedValue(splitContent, key, value);
  fs.writeFileSync(`split/${path}/en.json`, JSON.stringify(splitContent));
}
```

**Résultat :**

- Les fichiers split sont **créés** s'ils n'existent pas
- Les fichiers split existants sont **mis à jour** avec les valeurs du fichier complet

---

## 📊 Statistiques de synchronisation

Après chaque exécution, le script affiche des statistiques :

```
✨ Fichier fusionné créé: en.json
  📊 Statistiques:
     🆕 Nouvelles clés ajoutées: 5
     🔄 Clés mises à jour: 12
     💾 Clés préservées: 234
```

---

## ⚠️ Bonnes pratiques

### ✅ À FAIRE

- Toujours exécuter `npm run i18n:sync` avant un commit
- Modifier les fichiers split pour les traductions de composants
- Ajouter le mapping pour chaque nouveau composant
- Vérifier les statistiques après chaque synchronisation

### ❌ À NE PAS FAIRE

- Ne jamais modifier manuellement les fichiers complets ET les fichiers split en même temps
- Ne pas utiliser les scripts legacy sauf en cas de problème
- Ne pas oublier d'ajouter le mapping pour un nouveau composant

---

## 🐛 Dépannage

### **Problème : Les traductions ne se synchronisent pas**

**Solution :**

1. Vérifier que le mapping existe dans les deux scripts :
   - `scripts/smart-merge-i18n.js`
   - `scripts/smart-split-i18n.js`

2. Exécuter une synchronisation complète :
   ```bash
   npm run i18n:sync
   ```

---

### **Problème : Traductions perdues après un merge**

**Solution :**

1. Vérifier l'historique Git pour récupérer les traductions
2. Restaurer les traductions dans les fichiers split
3. Exécuter `npm run i18n:merge`

---

### **Problème : Conflit entre fichier complet et fichier split**

**Solution :**

1. Décider quelle version est la bonne
2. Si c'est le fichier split : `npm run i18n:merge`
3. Si c'est le fichier complet : `npm run i18n:split`
4. Vérifier les statistiques pour confirmer

---

## 📚 Exemple complet

### **Ajouter une nouvelle traduction pour le blocker de branding**

1. **Créer les fichiers split :**

   ```json
   // public/assets/i18n/split/modules/dashboard/components/branding-required-blocker/en.json
   {
     "dashboard": {
       "brandingBlocker": {
         "title": "Brand Identity Required",
         "description": "To access {{featureName}}...",
         "missingElements": "Missing elements:",
         "backButton": "Back to Dashboard",
         "completeButton": "Complete Brand Identity"
       }
     }
   }
   ```

2. **Ajouter le mapping :**

   ```javascript
   // scripts/smart-merge-i18n.js et scripts/smart-split-i18n.js
   pathToKeyMapping: {
     'modules/dashboard/components/branding-required-blocker': 'dashboard.brandingBlocker',
   }
   ```

3. **Synchroniser :**

   ```bash
   npm run i18n:merge
   ```

4. **Résultat :**

   ```
   ✨ Fichier fusionné créé: en.json
     📊 Statistiques:
        🆕 Nouvelles clés ajoutées: 1
        🔄 Clés mises à jour: 0
        💾 Clés préservées: 234
   ```

5. **Vérifier :**
   ```json
   // public/assets/i18n/en.json
   {
     "dashboard": {
       "brandingBlocker": {
         "title": "Brand Identity Required"
         // ...
       }
     }
   }
   ```

---

## 🎯 Résumé

| Action                      | Commande                              | Résultat                            |
| --------------------------- | ------------------------------------- | ----------------------------------- |
| Modifier un fichier split   | `npm run i18n:merge`                  | Synchronise vers le fichier complet |
| Modifier le fichier complet | `npm run i18n:split`                  | Synchronise vers les fichiers split |
| Synchronisation complète    | `npm run i18n:sync`                   | Synchronise dans les deux sens      |
| Nouveau composant           | Ajouter mapping + `npm run i18n:sync` | Crée les fichiers et synchronise    |

---

**✅ Le système est maintenant intelligent et préserve toutes les traductions !**

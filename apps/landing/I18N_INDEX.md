# 📚 Index - Documentation i18n

Navigation rapide vers toute la documentation d'internationalisation.

## 🚀 Démarrage

- **[QUICK_START_I18N.md](./QUICK_START_I18N.md)** ⚡  
  Guide ultra-rapide en 5 minutes pour commencer

- **[I18N_SETUP_COMPLETE.md](./I18N_SETUP_COMPLETE.md)** ✅  
  État de la configuration et prochaines étapes

## 📖 Documentation principale

- **[I18N_README.md](./I18N_README.md)** 📋  
  Documentation principale - Vue d'ensemble complète
  - Langues supportées
  - Démarrage rapide
  - Structure des fichiers
  - Syntaxe de base
  - Configuration
  - Conventions
  - Workflow
  - Déploiement

## 📘 Guides détaillés

- **[I18N_GUIDE.md](./I18N_GUIDE.md)** 🎓  
  Guide technique complet (3500+ lignes)
  - Configuration des locales
  - Syntaxe i18n complète
  - Workflow de traduction
  - Format JSON
  - Conventions de nommage
  - Bonnes pratiques
  - $localize dans TypeScript
  - Débogage
  - Déploiement multi-locale
  - Comparaison avec ngx-translate

- **[I18N_EXAMPLES.md](./I18N_EXAMPLES.md)** 💡  
  Exemples concrets avant/après (2000+ lignes)
  - Hero sections
  - Navigation
  - Stats avec variables
  - Pluriels (ICU)
  - Attributs (alt, title, placeholder)
  - Listes avec @for
  - Formulaires avec validation
  - Select/Switch
  - Dates et nombres
  - Workflow complet

- **[I18N_MIGRATION_PLAN.md](./I18N_MIGRATION_PLAN.md)** 📋  
  Plan de migration structuré
  - État actuel
  - 9 pages à migrer
  - Composants partagés
  - Ordre de migration (5 phases)
  - Processus par composant
  - Métriques (11-12h estimées)
  - Checklist finale

## 🛠️ Outils

- **[scripts/check-i18n.sh](./scripts/check-i18n.sh)** 🔍  
  Script de vérification automatique
  ```bash
  ./scripts/check-i18n.sh
  ```

  - Analyse des fichiers HTML
  - Statistiques de progression
  - Vérification des traductions
  - Détection de textes en dur

## 📁 Fichiers de traduction

- **[src/locale/messages.fr.json](./src/locale/messages.fr.json)** 🇫🇷  
  Fichier de traductions françaises (format JSON)

## 🎯 Par cas d'usage

### Je débute

1. [QUICK_START_I18N.md](./QUICK_START_I18N.md) - Commencer en 5 min
2. [I18N_EXAMPLES.md](./I18N_EXAMPLES.md) - Voir des exemples
3. [I18N_README.md](./I18N_README.md) - Comprendre le système

### Je veux migrer un composant

1. [I18N_EXAMPLES.md](./I18N_EXAMPLES.md) - Voir comment faire
2. [I18N_GUIDE.md](./I18N_GUIDE.md) - Syntaxe détaillée
3. [I18N_MIGRATION_PLAN.md](./I18N_MIGRATION_PLAN.md) - Suivre le plan

### Je cherche une syntaxe spécifique

1. [I18N_GUIDE.md](./I18N_GUIDE.md) - Référence complète
2. [I18N_EXAMPLES.md](./I18N_EXAMPLES.md) - Exemples concrets

### Je veux voir l'état du projet

1. [I18N_SETUP_COMPLETE.md](./I18N_SETUP_COMPLETE.md) - État actuel
2. `./scripts/check-i18n.sh` - Vérification automatique
3. [I18N_MIGRATION_PLAN.md](./I18N_MIGRATION_PLAN.md) - Progression

## 🔧 Commandes rapides

```bash
# Développement
npm run start:fr              # Servir en français
npm run start:en              # Servir en anglais

# Extraction
npm run i18n:extract:json     # Extraire les messages

# Build
npm run build:fr              # Build français
npm run build:en              # Build anglais
npm run build:all-locales     # Build toutes les locales

# Vérification
./scripts/check-i18n.sh       # Vérifier l'état i18n
```

## 📊 Structure de la documentation

```
apps/landing/
├── QUICK_START_I18N.md          ⚡ Démarrage rapide (5 min)
├── I18N_README.md               📋 Documentation principale
├── I18N_GUIDE.md                🎓 Guide technique complet
├── I18N_EXAMPLES.md             💡 Exemples concrets
├── I18N_MIGRATION_PLAN.md       📋 Plan de migration
├── I18N_SETUP_COMPLETE.md       ✅ État de la configuration
├── I18N_INDEX.md                📚 Ce fichier (navigation)
├── scripts/
│   └── check-i18n.sh            🔍 Script de vérification
└── src/
    └── locale/
        └── messages.fr.json     🇫🇷 Traductions françaises
```

## 🎓 Parcours d'apprentissage recommandé

### Niveau 1 : Débutant (30 min)

1. Lire [QUICK_START_I18N.md](./QUICK_START_I18N.md)
2. Essayer sur un composant simple
3. Consulter [I18N_EXAMPLES.md](./I18N_EXAMPLES.md) au besoin

### Niveau 2 : Intermédiaire (1-2h)

1. Lire [I18N_README.md](./I18N_README.md) en entier
2. Étudier [I18N_EXAMPLES.md](./I18N_EXAMPLES.md)
3. Migrer 2-3 composants
4. Utiliser `./scripts/check-i18n.sh`

### Niveau 3 : Avancé (3-4h)

1. Lire [I18N_GUIDE.md](./I18N_GUIDE.md) en détail
2. Comprendre [I18N_MIGRATION_PLAN.md](./I18N_MIGRATION_PLAN.md)
3. Migrer des composants complexes
4. Gérer les cas spéciaux (pluriels, ICU, etc.)

## 🆘 Support

### Problème technique

1. Consulter [I18N_GUIDE.md](./I18N_GUIDE.md) section "Débogage"
2. Vérifier [I18N_EXAMPLES.md](./I18N_EXAMPLES.md) pour des exemples
3. Documentation officielle : https://angular.dev/guide/i18n

### Question sur la syntaxe

1. Chercher dans [I18N_GUIDE.md](./I18N_GUIDE.md)
2. Voir les exemples dans [I18N_EXAMPLES.md](./I18N_EXAMPLES.md)

### Planification de la migration

1. Consulter [I18N_MIGRATION_PLAN.md](./I18N_MIGRATION_PLAN.md)
2. Utiliser `./scripts/check-i18n.sh` pour suivre la progression

## 📈 Métriques

- **Documentation** : 6 fichiers, ~10 000 lignes
- **Scripts** : 1 script de vérification
- **Temps de lecture** : ~2-3 heures (tout lire)
- **Temps de migration estimé** : 11-12 heures

## 🎯 Objectifs

- ✅ Infrastructure configurée
- ✅ Documentation complète
- ⏳ Migration des composants (0%)
- ⏳ Traductions françaises (0%)
- ⏳ Tests et validation
- ⏳ Déploiement

## 🚀 Commencer maintenant

```bash
# 1. Lire le quick start
cat QUICK_START_I18N.md

# 2. Vérifier l'état actuel
./scripts/check-i18n.sh

# 3. Choisir un composant et migrer
# 4. Extraire et traduire
npm run i18n:extract:json

# 5. Tester
npm run start:fr
```

---

**Dernière mise à jour** : Novembre 2024  
**Version** : 1.0  
**Statut** : Infrastructure complète, migration en attente

# 🌍 Système i18n - Guide Rapide

## 📁 Structure

```
src/locale/
├── en/
│   ├── components/     (17 fichiers - header, footer, features, etc.)
│   ├── pages/          (9 fichiers - home, pricing, solutions, etc.)
│   └── shared/         (5 fichiers - privacy, beta, terms, etc.)
└── fr/
    └── (même structure - À TRADUIRE)
```

**Total: 31 fichiers | 1730 clés**

## 🚀 Commandes Essentielles

```bash
# Après modification du code
npm run i18n:workflow

# Fusionner avant build
npm run i18n:merge

# Builder toutes les locales
npm run build:all-locales

# Tester en français
npm run start:fr
```

## 📝 Workflow de Traduction

1. **Choisir un fichier** dans `src/locale/fr/`
2. **Traduire** toutes les clés
3. **Tester**: `npm run i18n:merge && npm run start:fr`
4. **Commit**: `git add src/locale/fr/...`

## 🎯 Priorités de Traduction

### 🔴 HAUTE (182 clés - 1-2 jours)

- `fr/components/header.json` (24)
- `fr/components/footer.json` (24)
- `fr/components/hero.json` (12)
- `fr/components/features.json` (106)
- `fr/pages/home.json` (18)

### 🟡 MOYENNE (603 clés - 4-6 jours)

- Pages principales (pricing, solutions, about)
- Composants métier (business-plan, diagrams)

### 🟢 BASSE (945 clés - 6-8 jours)

- Pages secondaires
- Documents légaux
- Composants restants

## 📚 Documentation Complète

- **Guide Principal**: `I18N_COMPONENT_STRUCTURE_GUIDE.md`
- **Résumé Final**: `I18N_FINAL_SUMMARY.md`
- **Technique**: `LOCALIZE_CONVERSION_GUIDE.md`

## ✅ État Actuel

- ✅ 1730 clés extraites et organisées
- ✅ 31 fichiers créés (structure miroir)
- ✅ Scripts d'automatisation configurés
- ⏳ 0/1730 clés traduites en français

**Prêt pour la traduction! 🚀**

# Plan de Migration i18n - Landing Page

## 📊 État actuel

- ✅ @angular/localize installé (v20.3.9)
- ✅ angular.json configuré avec locales (en, fr)
- ✅ Scripts npm ajoutés
- ✅ Structure src/locale/ créée
- ✅ Format JSON configuré
- ⏳ Templates à migrer

## 🎯 Objectif

Migrer tous les composants de la landing page vers `@angular/localize` avec traductions en français.

## 📁 Composants à migrer

### Pages principales (9 pages)

1. **home** (`src/app/pages/home/`)
   - Hero section
   - Features
   - CTA
   - Sections multiples

2. **about-page** (`src/app/pages/about-page/`)
   - Hero
   - Stats (4 items)
   - Mission
   - Values (4 items)
   - Timeline/Journey
   - Vision
   - Contact CTA

3. **african-market-page** (`src/app/pages/african-market-page/`)
   - Market focus
   - Statistics
   - Opportunities

4. **architecture-page** (`src/app/pages/architecture-page/`)
   - Technical architecture
   - Diagrams descriptions

5. **deployment** (`src/app/pages/deployment/`)
   - Deployment guides
   - Screenshots descriptions

6. **open-source-page** (`src/app/pages/open-source-page/`)
   - Open source benefits
   - License information
   - Community

7. **premium-beta-access** (`src/app/pages/premium-beta-access/`)
   - Beta program
   - Access form
   - Benefits

8. **pricing-page** (`src/app/pages/pricing-page/`)
   - Plans (3-4 plans)
   - Features comparison
   - FAQ

9. **solutions-page** (`src/app/pages/solutions-page/`)
   - Solutions overview
   - Use cases

### Composants partagés

#### Components (`src/app/components/`)

- Header/Navigation
- Footer
- Hero sections
- Feature cards
- CTA sections
- Testimonials
- Logos showcase
- Video trailer
- etc.

#### Shared Components (`src/app/shared/components/`)

- beta-badge
- beta-policy
- carousel
- not-found
- privacy-policy
- terms-of-service

## 📋 Ordre de migration recommandé

### Phase 1 : Composants globaux (Priorité haute)

1. ✅ Header/Navigation - Utilisé partout
2. ✅ Footer - Utilisé partout
3. ✅ Not Found (404) - Page d'erreur

### Phase 2 : Page d'accueil (Priorité haute)

4. ✅ Home page - Page principale
   - Hero section
   - Features
   - CTA
   - Toutes les sections

### Phase 3 : Pages importantes (Priorité moyenne)

5. ✅ About page - Présentation
6. ✅ Pricing page - Tarifs
7. ✅ Solutions page - Cas d'usage

### Phase 4 : Pages secondaires (Priorité basse)

8. ✅ African Market page
9. ✅ Architecture page
10. ✅ Open Source page
11. ✅ Deployment page
12. ✅ Premium Beta Access

### Phase 5 : Composants légaux (Priorité basse)

13. ✅ Privacy Policy
14. ✅ Terms of Service
15. ✅ Beta Policy

## 🔧 Processus par composant

### 1. Analyse

```bash
# Identifier les textes à traduire
grep -r ">" component.html | grep -v "i18n"
```

### 2. Marquage

- Ajouter `i18n="@@section.component.element"` sur chaque élément avec texte
- Ajouter `i18n-attribute` pour alt, title, placeholder
- Utiliser `$localize` dans le TypeScript pour les données

### 3. Extraction

```bash
npm run i18n:extract:json
```

### 4. Traduction

- Ouvrir `src/locale/messages.fr.json`
- Ajouter les traductions françaises

### 5. Test

```bash
# Test en français
npm run start:fr

# Test en anglais
npm run start:en
```

### 6. Validation

- [ ] Tous les textes sont traduits
- [ ] Aucun texte en dur restant
- [ ] Layout correct dans les deux langues
- [ ] Pas d'erreurs console
- [ ] SSR fonctionne

## 📝 Convention de nommage des IDs

```
page.section.element
```

### Exemples par page

**Home:**

- `home.hero.title`
- `home.hero.subtitle`
- `home.hero.cta`
- `home.features.title`
- `home.features.item1.title`

**About:**

- `about.hero.title`
- `about.stats.founded`
- `about.mission.title`
- `about.values.sovereignty.title`

**Navigation:**

- `navigation.home`
- `navigation.about`
- `navigation.pricing`

**Footer:**

- `footer.product.title`
- `footer.company.title`
- `footer.copyright`

**Common:**

- `common.button.learn_more`
- `common.button.get_started`
- `common.button.contact`

## 🎨 Gestion des cas spéciaux

### Emojis

Les emojis restent dans le template, pas besoin de les traduire :

```html
<span i18n="@@about.location">Made in Cameroon 🇨🇲</span>
```

### Noms propres

Marquer avec i18n mais garder la même valeur :

```html
<h1 i18n="@@brand.name">IDEM</h1>
```

### Dates et nombres

Utiliser les pipes Angular (s'adaptent automatiquement) :

```html
<span>{{ date | date:'medium' }}</span> <span>{{ price | currency:'USD' }}</span>
```

### Pluriels

Utiliser la syntaxe ICU :

```html
<span i18n="@@users.count">
  {count, plural, =0 {No users} =1 {One user} other {{{count}} users}}
</span>
```

### Listes dynamiques

Option 1 - i18n dans template :

```html
@for (item of items; track item.id) {
<div i18n="@@items.{{item.id}}.title">{{ item.title }}</div>
}
```

Option 2 - $localize dans TypeScript :

```typescript
items = [{ id: 1, title: $localize`:@@items.1.title:Title 1` }];
```

## 📊 Métriques de progression

### Estimation

- **Pages** : 9 pages × 30 min = 4.5h
- **Composants globaux** : 10 composants × 20 min = 3.3h
- **Composants partagés** : 6 composants × 15 min = 1.5h
- **Tests et ajustements** : 2h
- **Total estimé** : ~11-12 heures

### Suivi

- [ ] Phase 1 : Composants globaux (0/3)
- [ ] Phase 2 : Home page (0/1)
- [ ] Phase 3 : Pages importantes (0/3)
- [ ] Phase 4 : Pages secondaires (0/5)
- [ ] Phase 5 : Composants légaux (0/3)

## 🚀 Commandes rapides

```bash
# Extraire les messages
npm run i18n:extract:json

# Dev en français
npm run start:fr

# Dev en anglais
npm run start:en

# Build production français
npm run build:fr

# Build production anglais
npm run build:en

# Build toutes les locales
npm run build:all-locales
```

## 📚 Documentation

- `I18N_GUIDE.md` - Guide complet d'utilisation
- `I18N_EXAMPLES.md` - Exemples concrets avant/après
- `I18N_MIGRATION_PLAN.md` - Ce document (plan de migration)

## ✅ Checklist finale

Avant de considérer la migration terminée :

- [ ] Tous les composants migrés
- [ ] Fichier messages.fr.json complet
- [ ] Tests manuels en FR et EN
- [ ] SSR testé et fonctionnel
- [ ] Build production réussi
- [ ] Pas de textes en dur restants
- [ ] Documentation à jour
- [ ] Performance vérifiée (bundle size)
- [ ] SEO vérifié (meta tags traduits)
- [ ] Accessibilité vérifiée (aria-labels traduits)

## 🎯 Prochaines étapes

1. **Immédiat** : Commencer par la Phase 1 (Header, Footer, 404)
2. **Court terme** : Migrer la home page (Phase 2)
3. **Moyen terme** : Migrer les pages importantes (Phase 3)
4. **Long terme** : Compléter toutes les pages

## 💡 Conseils

1. **Migrer progressivement** : Une page à la fois
2. **Tester fréquemment** : Après chaque composant
3. **Documenter** : Noter les patterns récurrents
4. **Réutiliser** : Copier les patterns qui fonctionnent
5. **Valider** : Faire relire par un francophone natif

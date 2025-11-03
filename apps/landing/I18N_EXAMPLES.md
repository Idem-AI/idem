# Exemples de Migration i18n

## 📝 Exemples concrets de migration

Ce document contient des exemples avant/après pour migrer vos composants vers `@angular/localize`.

## 🏠 Page Home - Hero Section

### Avant (texte en dur)

```html
<h1 class="text-5xl font-bold text-white">Africa's First Sovereign AI Platform</h1>
<p class="text-xl text-white/70">
  Build, deploy, and scale AI applications with full data sovereignty
</p>
<button class="inner-button">Start Free Trial</button>
```

### Après (avec i18n)

```html
<h1 class="text-5xl font-bold text-white" i18n="@@home.hero.title">
  Africa's First Sovereign AI Platform
</h1>
<p class="text-xl text-white/70" i18n="@@home.hero.subtitle">
  Build, deploy, and scale AI applications with full data sovereignty
</p>
<button class="inner-button" i18n="@@home.hero.cta">Start Free Trial</button>
```

### Traduction (messages.fr.json)

```json
{
  "locale": "fr",
  "translations": {
    "home.hero.title": "La Première Plateforme d'IA Souveraine d'Afrique",
    "home.hero.subtitle": "Créez, déployez et faites évoluer des applications IA avec une souveraineté totale des données",
    "home.hero.cta": "Commencer l'essai gratuit"
  }
}
```

## 🧭 Navigation

### Avant

```html
<nav>
  <a routerLink="/">Home</a>
  <a routerLink="/about">About</a>
  <a routerLink="/pricing">Pricing</a>
  <a routerLink="/solutions">Solutions</a>
</nav>
```

### Après

```html
<nav>
  <a routerLink="/" i18n="@@navigation.home">Home</a>
  <a routerLink="/about" i18n="@@navigation.about">About</a>
  <a routerLink="/pricing" i18n="@@navigation.pricing">Pricing</a>
  <a routerLink="/solutions" i18n="@@navigation.solutions">Solutions</a>
</nav>
```

### Traduction

```json
{
  "locale": "fr",
  "translations": {
    "navigation.home": "Accueil",
    "navigation.about": "À propos",
    "navigation.pricing": "Tarifs",
    "navigation.solutions": "Solutions"
  }
}
```

## 📊 Stats avec variables

### Avant

```html
<div class="stat">
  <div class="value">{{ userCount }}</div>
  <div class="label">Active Users</div>
</div>
```

### Après

```html
<div class="stat">
  <div class="value">{{ userCount }}</div>
  <div class="label" i18n="@@stats.active.users">Active Users</div>
</div>
```

### Avec interpolation

```html
<p i18n="@@stats.users.message">We have {{userCount}} active users in {{countryCount}} countries</p>
```

### Traduction

```json
{
  "locale": "fr",
  "translations": {
    "stats.active.users": "Utilisateurs actifs",
    "stats.users.message": "Nous avons {{userCount}} utilisateurs actifs dans {{countryCount}} pays"
  }
}
```

## 🔢 Pluriels

### Avant (logique dans le code)

```typescript
getUserCountText(count: number): string {
  if (count === 0) return 'No users';
  if (count === 1) return '1 user';
  return `${count} users`;
}
```

```html
<span>{{ getUserCountText(userCount) }}</span>
```

### Après (avec ICU)

```html
<span i18n="@@users.count">
  {userCount, plural, =0 {No users} =1 {One user} other {{{userCount}} users} }
</span>
```

### Traduction

```json
{
  "locale": "fr",
  "translations": {
    "users.count": "{userCount, plural, =0 {Aucun utilisateur} =1 {Un utilisateur} other {{{userCount}} utilisateurs}}"
  }
}
```

## 🎯 Attributs (alt, title, placeholder)

### Avant

```html
<img src="logo.png" alt="IDEM Logo" />
<button title="Click to start">Start</button>
<input placeholder="Enter your email" />
```

### Après

```html
<img src="logo.png" i18n-alt="@@logo.alt" alt="IDEM Logo" />
<button i18n-title="@@button.start.tooltip" title="Click to start" i18n="@@button.start">
  Start
</button>
<input i18n-placeholder="@@input.email.placeholder" placeholder="Enter your email" />
```

### Traduction

```json
{
  "locale": "fr",
  "translations": {
    "logo.alt": "Logo IDEM",
    "button.start.tooltip": "Cliquez pour commencer",
    "button.start": "Démarrer",
    "input.email.placeholder": "Entrez votre email"
  }
}
```

## 📋 Listes avec @for

### Avant

```html
@for (feature of features; track feature.id) {
<div class="feature-card">
  <h3>{{ feature.title }}</h3>
  <p>{{ feature.description }}</p>
</div>
}
```

### Après (Option 1 : i18n dans le template)

```html
@for (feature of features; track feature.id) {
<div class="feature-card">
  <h3 i18n="@@features.{{feature.id}}.title">{{ feature.title }}</h3>
  <p i18n="@@features.{{feature.id}}.description">{{ feature.description }}</p>
</div>
}
```

### Après (Option 2 : $localize dans le TypeScript)

```typescript
import { Component } from '@angular/core';

@Component({
  selector: 'app-features',
  templateUrl: './features.component.html',
})
export class FeaturesComponent {
  features = [
    {
      id: 'sovereignty',
      title: $localize`:@@features.sovereignty.title:Data Sovereignty`,
      description: $localize`:@@features.sovereignty.description:Your data stays in Africa`,
    },
    {
      id: 'opensource',
      title: $localize`:@@features.opensource.title:Open Source`,
      description: $localize`:@@features.opensource.description:Full transparency with Apache 2.0`,
    },
  ];
}
```

```html
@for (feature of features; track feature.id) {
<div class="feature-card">
  <h3>{{ feature.title }}</h3>
  <p>{{ feature.description }}</p>
</div>
}
```

### Traduction

```json
{
  "locale": "fr",
  "translations": {
    "features.sovereignty.title": "Souveraineté des données",
    "features.sovereignty.description": "Vos données restent en Afrique",
    "features.opensource.title": "Open Source",
    "features.opensource.description": "Transparence totale avec Apache 2.0"
  }
}
```

## 🎨 About Page - Stats

### Avant

```typescript
stats = [
  { value: '2024', label: 'Founded' },
  { value: '10K+', label: 'Users' },
  { value: '54', label: 'African Countries' },
  { value: '99.9%', label: 'Uptime' },
];
```

### Après

```typescript
stats = [
  {
    value: '2024',
    label: $localize`:@@about.stats.founded:Founded`,
  },
  {
    value: '10K+',
    label: $localize`:@@about.stats.users:Users`,
  },
  {
    value: '54',
    label: $localize`:@@about.stats.countries:African Countries`,
  },
  {
    value: '99.9%',
    label: $localize`:@@about.stats.uptime:Uptime`,
  },
];
```

### Traduction

```json
{
  "locale": "fr",
  "translations": {
    "about.stats.founded": "Fondée",
    "about.stats.users": "Utilisateurs",
    "about.stats.countries": "Pays africains",
    "about.stats.uptime": "Disponibilité"
  }
}
```

## 🦶 Footer

### Avant

```html
<footer>
  <div class="footer-section">
    <h3>Product</h3>
    <a routerLink="/features">Features</a>
    <a routerLink="/pricing">Pricing</a>
    <a routerLink="/docs">Documentation</a>
  </div>

  <div class="footer-section">
    <h3>Company</h3>
    <a routerLink="/about">About Us</a>
    <a routerLink="/blog">Blog</a>
    <a routerLink="/contact">Contact</a>
  </div>

  <p class="copyright">© 2024 IDEM. All rights reserved.</p>
</footer>
```

### Après

```html
<footer>
  <div class="footer-section">
    <h3 i18n="@@footer.product.title">Product</h3>
    <a routerLink="/features" i18n="@@footer.product.features">Features</a>
    <a routerLink="/pricing" i18n="@@footer.product.pricing">Pricing</a>
    <a routerLink="/docs" i18n="@@footer.product.docs">Documentation</a>
  </div>

  <div class="footer-section">
    <h3 i18n="@@footer.company.title">Company</h3>
    <a routerLink="/about" i18n="@@footer.company.about">About Us</a>
    <a routerLink="/blog" i18n="@@footer.company.blog">Blog</a>
    <a routerLink="/contact" i18n="@@footer.company.contact">Contact</a>
  </div>

  <p class="copyright" i18n="@@footer.copyright">© 2024 IDEM. All rights reserved.</p>
</footer>
```

### Traduction

```json
{
  "locale": "fr",
  "translations": {
    "footer.product.title": "Produit",
    "footer.product.features": "Fonctionnalités",
    "footer.product.pricing": "Tarifs",
    "footer.product.docs": "Documentation",
    "footer.company.title": "Entreprise",
    "footer.company.about": "À propos",
    "footer.company.blog": "Blog",
    "footer.company.contact": "Contact",
    "footer.copyright": "© 2024 IDEM. Tous droits réservés."
  }
}
```

## 🔐 Formulaires avec validation

### Avant

```html
<form>
  <label>Email</label>
  <input type="email" required />
  @if (emailControl.errors?.['required']) {
  <span class="error">Email is required</span>
  } @if (emailControl.errors?.['email']) {
  <span class="error">Invalid email format</span>
  }

  <button type="submit">Submit</button>
</form>
```

### Après

```html
<form>
  <label i18n="@@form.email.label">Email</label>
  <input
    type="email"
    required
    i18n-placeholder="@@form.email.placeholder"
    placeholder="your@email.com"
  />
  @if (emailControl.errors?.['required']) {
  <span class="error" i18n="@@form.email.error.required"> Email is required </span>
  } @if (emailControl.errors?.['email']) {
  <span class="error" i18n="@@form.email.error.invalid"> Invalid email format </span>
  }

  <button type="submit" i18n="@@form.submit">Submit</button>
</form>
```

### Traduction

```json
{
  "locale": "fr",
  "translations": {
    "form.email.label": "Email",
    "form.email.placeholder": "votre@email.com",
    "form.email.error.required": "L'email est requis",
    "form.email.error.invalid": "Format d'email invalide",
    "form.submit": "Envoyer"
  }
}
```

## 🎭 Select/Switch (conditions)

### Avant

```typescript
getUserRole(role: string): string {
  switch(role) {
    case 'admin': return 'Administrator';
    case 'user': return 'User';
    case 'guest': return 'Guest';
    default: return 'Unknown';
  }
}
```

### Après

```html
<span i18n="@@user.role">
  {userRole, select, admin {Administrator} user {User} guest {Guest} other {Unknown} }
</span>
```

### Traduction

```json
{
  "locale": "fr",
  "translations": {
    "user.role": "{userRole, select, admin {Administrateur} user {Utilisateur} guest {Invité} other {Inconnu}}"
  }
}
```

## 📅 Dates et nombres

### TypeScript

```typescript
import { Component } from '@angular/core';

@Component({
  selector: 'app-example',
  template: `
    <!-- Date -->
    <p i18n="@@event.date">Event date: {{ eventDate | date: 'medium' }}</p>

    <!-- Nombre -->
    <p i18n="@@price.amount">Price: {{ price | currency: 'USD' }}</p>

    <!-- Pourcentage -->
    <p i18n="@@discount.rate">Discount: {{ discount | percent }}</p>
  `,
})
export class ExampleComponent {
  eventDate = new Date();
  price = 99.99;
  discount = 0.15;
}
```

Les pipes Angular (`date`, `currency`, `percent`) s'adaptent automatiquement à la locale.

## 🚀 Workflow complet - Exemple About Page

### 1. Marquer le template

```html
<!-- about-page.html -->
<div class="about-page">
  <h1 i18n="@@about.hero.title">Africa's First Sovereign AI Platform</h1>
  <p i18n="@@about.hero.description">
    Founded in Cameroon with a mission to democratize tech entrepreneurship
  </p>

  <div class="stats">
    @for (stat of stats; track stat.label) {
    <div class="stat-card">
      <div class="value">{{ stat.value }}</div>
      <div class="label">{{ stat.label }}</div>
    </div>
    }
  </div>
</div>
```

### 2. Mettre à jour le TypeScript

```typescript
// about-page.ts
import { Component } from '@angular/core';

@Component({
  selector: 'app-about-page',
  templateUrl: './about-page.html',
})
export class AboutPageComponent {
  stats = [
    {
      value: '2024',
      label: $localize`:@@about.stats.founded:Founded`,
    },
    {
      value: '10K+',
      label: $localize`:@@about.stats.users:Users`,
    },
  ];
}
```

### 3. Extraire

```bash
npm run i18n:extract:json
```

### 4. Traduire

```json
{
  "locale": "fr",
  "translations": {
    "about.hero.title": "La Première Plateforme d'IA Souveraine d'Afrique",
    "about.hero.description": "Fondée au Cameroun avec pour mission de démocratiser l'entrepreneuriat technologique",
    "about.stats.founded": "Fondée",
    "about.stats.users": "Utilisateurs"
  }
}
```

### 5. Tester

```bash
npm run start:fr
```

## 📝 Notes importantes

1. **Emojis** : Les emojis (🇨🇲, ❤️) peuvent rester dans les templates, ils ne nécessitent pas de traduction
2. **Noms propres** : IDEM, Cameroon, etc. peuvent être marqués i18n mais garder la même valeur
3. **URLs** : Les routerLink ne changent pas selon la locale
4. **Images** : Seuls les attributs alt/title sont traduits, pas les src

## ✅ Checklist par composant

- [ ] Marquer tous les textes visibles avec `i18n="@@id"`
- [ ] Marquer tous les attributs (alt, title, placeholder) avec `i18n-attribute`
- [ ] Remplacer la logique de pluriel par ICU
- [ ] Utiliser `$localize` pour les textes dans le TypeScript
- [ ] Extraire les messages
- [ ] Traduire dans messages.fr.json
- [ ] Tester en français et anglais

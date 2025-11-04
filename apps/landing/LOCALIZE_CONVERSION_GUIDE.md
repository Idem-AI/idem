# Guide de Conversion $localize pour les Composants Légaux

## Syntaxe $localize

```typescript
// Format de base
$localize`:@@id:Texte par défaut`;

// Avec interpolation
$localize`:@@id:Texte avec ${variable}:INTERPOLATION:`;

// Avec caractères spéciaux
$localize`:@@id:Text with "quotes" and 'apostrophes'`;
```

## Conversion des Structures

### 1. Propriétés Simples

**AVANT:**

```typescript
protected title = 'IDEM Legal';
```

**APRÈS:**

```typescript
protected title = $localize`:@@privacy.title:IDEM Legal`;
```

### 2. Tableaux

**AVANT:**

```typescript
protected versions = ['October 10, 2025', 'August 30, 2025'];
```

**APRÈS:**

```typescript
protected versions = [
  $localize`:@@privacy.version.oct2025:October 10, 2025`,
  $localize`:@@privacy.version.aug2025:August 30, 2025`,
];
```

### 3. Objets avec title/content

**AVANT:**

```typescript
{
  id: 'about',
  title: '1. ABOUT',
  titleI18n: '@@privacy.about.title',
  content: 'IDEM, Inc. and its affiliates...',
  contentI18n: '@@privacy.about.content',
}
```

**APRÈS:**

```typescript
{
  id: 'about',
  title: $localize`:@@privacy.about.title:1. ABOUT`,
  titleI18n: '@@privacy.about.title',
  content: $localize`:@@privacy.about.content:IDEM, Inc. and its affiliates...`,
  contentI18n: '@@privacy.about.content',
}
```

### 4. Listes d'items

**AVANT:**

```typescript
list: [
  {
    text: 'Account information including name, email address, and password',
    textI18n: '@@privacy.personal_info.you_provide.account',
  },
];
```

**APRÈS:**

```typescript
list: [
  {
    text: $localize`:@@privacy.personal_info.you_provide.account:Account information including name, email address, and password`,
    textI18n: '@@privacy.personal_info.you_provide.account',
  },
];
```

### 5. Items avec strong + text

**AVANT:**

```typescript
{
  strong: 'Provide Services',
  strongI18n: '@@privacy.how_we_use.provide_services.strong',
  text: 'To operate and maintain our AI-powered platform',
  textI18n: '@@privacy.how_we_use.provide_services.text',
}
```

**APRÈS:**

```typescript
{
  strong: $localize`:@@privacy.how_we_use.provide_services.strong:Provide Services`,
  strongI18n: '@@privacy.how_we_use.provide_services.strong',
  text: $localize`:@@privacy.how_we_use.provide_services.text:To operate and maintain our AI-powered platform`,
  textI18n: '@@privacy.how_we_use.provide_services.text',
}
```

### 6. Warning boxes

**AVANT:**

```typescript
warning: {
  type: 'warning',
  icon: '⚠️',
  title: 'Important Beta Software Warning',
  titleI18n: '@@beta.nature.warning.title',
  content: 'Beta software is inherently unstable...',
  contentI18n: '@@beta.nature.warning.content',
}
```

**APRÈS:**

```typescript
warning: {
  type: 'warning',
  icon: '⚠️',
  title: $localize`:@@beta.nature.warning.title:Important Beta Software Warning`,
  titleI18n: '@@beta.nature.warning.title',
  content: $localize`:@@beta.nature.warning.content:Beta software is inherently unstable...`,
  contentI18n: '@@beta.nature.warning.content',
}
```

## Caractères Spéciaux à Échapper

- Apostrophes: `'` → `\'` ou utiliser des backticks
- Guillemets doubles: `"` → `\"`
- Backslash: `\` → `\\`

## Exemple Complet

```typescript
ngOnInit(): void {
  this.sections = [
    {
      id: 'about',
      title: $localize`:@@privacy.about.title:1. ABOUT`,
      titleI18n: '@@privacy.about.title',
      content: $localize`:@@privacy.about.content:IDEM, Inc. and its affiliates ("IDEM," "we," "us," and "our") goal is to make AI-powered project management accessible to all.`,
      contentI18n: '@@privacy.about.content',
    },
    {
      id: 'personal-info',
      title: $localize`:@@privacy.personal_info.title:3. PERSONAL INFORMATION WE COLLECT`,
      titleI18n: '@@privacy.personal_info.title',
      content: $localize`:@@privacy.personal_info.content:The personal information we collect depends on how you interact with our Services.`,
      contentI18n: '@@privacy.personal_info.content',
      subsections: [
        {
          title: $localize`:@@privacy.personal_info.you_provide.title:3.1 Information You Provide to Us`,
          titleI18n: '@@privacy.personal_info.you_provide.title',
          content: $localize`:@@privacy.personal_info.you_provide.content:We collect personal information that you provide directly to us when using our Services:`,
          contentI18n: '@@privacy.personal_info.you_provide.content',
          list: [
            {
              text: $localize`:@@privacy.personal_info.you_provide.account:Account information including name, email address, and password`,
              textI18n: '@@privacy.personal_info.you_provide.account',
            },
          ],
        },
      ],
    },
  ];
}
```

## Vérification

Après conversion, exécutez:

```bash
npm run i18n:extract:json
```

Tous les textes marqués avec `$localize` seront extraits dans `src/locale/messages.json`.

## Notes Importantes

1. **Gardez les propriétés `*I18n`**: Elles sont utilisées par le template HTML
2. **L'ID doit correspondre**: L'ID dans `$localize` doit être identique à celui dans `*I18n`
3. **Pas de retour à la ligne**: Le texte dans `$localize` doit être sur une seule ligne
4. **Guillemets**: Utilisez des backticks si le texte contient des apostrophes

## Fichiers à Convertir

1. ✅ `privacy-policy.ts` - En cours
2. ⏳ `beta-policy.ts` - À faire
3. ⏳ `terms-of-service.ts` - À faire

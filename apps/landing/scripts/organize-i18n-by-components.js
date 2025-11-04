#!/usr/bin/env node

/**
 * Script to organize i18n files by component structure
 * Creates the same folder structure as components/pages/shared
 */

const fs = require('fs');
const path = require('path');

// Read the main messages.json
const messagesPath = path.join(__dirname, '../src/locale/messages.json');
const messages = JSON.parse(fs.readFileSync(messagesPath, 'utf8'));

// Define component structure based on actual folders
const structure = {
  components: [
    'african-market',
    'brand-charter',
    'business-plan',
    'cta',
    'cta-section',
    'deployment-screenshots',
    'diagrams',
    'features',
    'footer',
    'header',
    'hero',
    'loader',
    'logos-showcase',
    'multi-agent-architecture',
    'open-source-sovereignty',
    'pricing',
    'splash-screen',
    'team',
    'video-trailer',
    'website-showcase',
  ],
  pages: [
    'about-page',
    'african-market-page',
    'architecture-page',
    'deployment',
    'home',
    'open-source-page',
    'premium-beta-access',
    'pricing-page',
    'solutions-page',
  ],
  shared: {
    components: [
      'beta-policy',
      'legal-document-template',
      'not-found',
      'privacy-policy',
      'terms-of-service',
    ],
  },
};

// Create directory structure
function createDirStructure(locale) {
  const baseDir = path.join(__dirname, `../src/locale/${locale}`);

  // Create main directories
  ['components', 'pages', 'shared/components'].forEach((dir) => {
    const fullPath = path.join(baseDir, dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  });
}

// Map translation keys to components
function mapKeysToComponents(translations) {
  const mapped = {
    components: {},
    pages: {},
    shared: { components: {} },
    common: {}, // For keys that don't match any component
  };

  Object.entries(translations).forEach(([key, value]) => {
    let assigned = false;

    // Check components
    for (const component of structure.components) {
      const prefix = component.replace(/-/g, '-'); // Keep hyphens
      if (key.startsWith(prefix + '.') || key === prefix) {
        if (!mapped.components[component]) mapped.components[component] = {};
        mapped.components[component][key] = value;
        assigned = true;
        break;
      }
    }

    if (assigned) return;

    // Check pages
    for (const page of structure.pages) {
      const prefix = page.replace(/-/g, '-');
      if (key.startsWith(prefix + '.') || key === prefix) {
        if (!mapped.pages[page]) mapped.pages[page] = {};
        mapped.pages[page][key] = value;
        assigned = true;
        break;
      }
    }

    if (assigned) return;

    // Check shared components
    for (const component of structure.shared.components) {
      // Special handling for legal components
      if (component === 'privacy-policy' && key.startsWith('privacy.')) {
        if (!mapped.shared.components[component]) mapped.shared.components[component] = {};
        mapped.shared.components[component][key] = value;
        assigned = true;
        break;
      }
      if (component === 'beta-policy' && key.startsWith('beta.')) {
        if (!mapped.shared.components[component]) mapped.shared.components[component] = {};
        mapped.shared.components[component][key] = value;
        assigned = true;
        break;
      }
      if (component === 'terms-of-service' && key.startsWith('terms.')) {
        if (!mapped.shared.components[component]) mapped.shared.components[component] = {};
        mapped.shared.components[component][key] = value;
        assigned = true;
        break;
      }
      if (component === 'legal-document-template' && key.startsWith('legal.')) {
        if (!mapped.shared.components[component]) mapped.shared.components[component] = {};
        mapped.shared.components[component][key] = value;
        assigned = true;
        break;
      }
      if (component === 'not-found' && key.startsWith('not-found.')) {
        if (!mapped.shared.components[component]) mapped.shared.components[component] = {};
        mapped.shared.components[component][key] = value;
        assigned = true;
        break;
      }
    }

    if (!assigned) {
      mapped.common[key] = value;
    }
  });

  return mapped;
}

// Write files
function writeComponentFiles(locale, mapped) {
  const baseDir = path.join(__dirname, `../src/locale/${locale}`);

  // Write components
  Object.entries(mapped.components).forEach(([component, translations]) => {
    if (Object.keys(translations).length === 0) return;

    const filePath = path.join(baseDir, 'components', `${component}.json`);
    const content = {
      locale: locale,
      translations: translations,
    };
    fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf8');
    console.log(
      `✅ ${locale}/components/${component}.json (${Object.keys(translations).length} keys)`,
    );
  });

  // Write pages
  Object.entries(mapped.pages).forEach(([page, translations]) => {
    if (Object.keys(translations).length === 0) return;

    const filePath = path.join(baseDir, 'pages', `${page}.json`);
    const content = {
      locale: locale,
      translations: translations,
    };
    fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf8');
    console.log(`✅ ${locale}/pages/${page}.json (${Object.keys(translations).length} keys)`);
  });

  // Write shared components
  Object.entries(mapped.shared.components).forEach(([component, translations]) => {
    if (Object.keys(translations).length === 0) return;

    const filePath = path.join(baseDir, 'shared/components', `${component}.json`);
    const content = {
      locale: locale,
      translations: translations,
    };
    fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf8');
    console.log(
      `✅ ${locale}/shared/components/${component}.json (${Object.keys(translations).length} keys)`,
    );
  });

  // Write common (remaining keys)
  if (Object.keys(mapped.common).length > 0) {
    const filePath = path.join(baseDir, 'common.json');
    const content = {
      locale: locale,
      translations: mapped.common,
    };
    fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf8');
    console.log(`✅ ${locale}/common.json (${Object.keys(mapped.common).length} keys)`);
  }
}

// Main execution
console.log('🔄 Organizing i18n files by component structure...\n');

// Create directory structure for both locales
createDirStructure('en');
createDirStructure('fr');

// Map and write English files
console.log('📝 Creating English (en) files:');
const mappedEn = mapKeysToComponents(messages.translations);
writeComponentFiles('en', mappedEn);

// Create French templates (empty translations)
console.log('\n📝 Creating French (fr) template files:');
const mappedFr = JSON.parse(JSON.stringify(mappedEn)); // Deep clone

// Empty all translations for French
function emptyTranslations(obj) {
  if (obj.translations) {
    Object.keys(obj.translations).forEach((key) => {
      obj.translations[key] = '';
    });
  }
  return obj;
}

// Empty French translations
Object.keys(mappedFr.components).forEach((comp) => {
  Object.keys(mappedFr.components[comp]).forEach((key) => {
    mappedFr.components[comp][key] = '';
  });
});
Object.keys(mappedFr.pages).forEach((page) => {
  Object.keys(mappedFr.pages[page]).forEach((key) => {
    mappedFr.pages[page][key] = '';
  });
});
Object.keys(mappedFr.shared.components).forEach((comp) => {
  Object.keys(mappedFr.shared.components[comp]).forEach((key) => {
    mappedFr.shared.components[comp][key] = '';
  });
});
Object.keys(mappedFr.common).forEach((key) => {
  mappedFr.common[key] = '';
});

writeComponentFiles('fr', mappedFr);

// Create new merge script
const newMergeScript = `#!/usr/bin/env node

/**
 * Merge component-based i18n files back into single messages.json
 */

const fs = require('fs');
const path = require('path');

function mergeLocale(locale) {
  const baseDir = path.join(__dirname, \`../src/locale/\${locale}\`);
  const merged = {
    locale: locale,
    translations: {}
  };

  // Merge components
  const componentsDir = path.join(baseDir, 'components');
  if (fs.existsSync(componentsDir)) {
    fs.readdirSync(componentsDir)
      .filter(f => f.endsWith('.json'))
      .forEach(file => {
        const content = JSON.parse(fs.readFileSync(path.join(componentsDir, file), 'utf8'));
        Object.assign(merged.translations, content.translations);
      });
  }

  // Merge pages
  const pagesDir = path.join(baseDir, 'pages');
  if (fs.existsSync(pagesDir)) {
    fs.readdirSync(pagesDir)
      .filter(f => f.endsWith('.json'))
      .forEach(file => {
        const content = JSON.parse(fs.readFileSync(path.join(pagesDir, file), 'utf8'));
        Object.assign(merged.translations, content.translations);
      });
  }

  // Merge shared components
  const sharedDir = path.join(baseDir, 'shared/components');
  if (fs.existsSync(sharedDir)) {
    fs.readdirSync(sharedDir)
      .filter(f => f.endsWith('.json'))
      .forEach(file => {
        const content = JSON.parse(fs.readFileSync(path.join(sharedDir, file), 'utf8'));
        Object.assign(merged.translations, content.translations);
      });
  }

  // Merge common
  const commonFile = path.join(baseDir, 'common.json');
  if (fs.existsSync(commonFile)) {
    const content = JSON.parse(fs.readFileSync(commonFile, 'utf8'));
    Object.assign(merged.translations, content.translations);
  }

  // Write merged file
  const outputPath = path.join(__dirname, \`../src/locale/messages.\${locale === 'en' ? '' : locale + '.'}json\`);
  fs.writeFileSync(outputPath, JSON.stringify(merged, null, 2), 'utf8');
  console.log(\`✅ Merged \${locale}: \${Object.keys(merged.translations).length} keys\`);
}

mergeLocale('en');
if (fs.existsSync(path.join(__dirname, '../src/locale/fr'))) {
  mergeLocale('fr');
}

console.log('\\n✅ All locales merged successfully!');
`;

fs.writeFileSync(path.join(__dirname, 'merge-i18n-components.js'), newMergeScript, 'utf8');
fs.chmodSync(path.join(__dirname, 'merge-i18n-components.js'), '755');

console.log('\n✅ Organization complete!');
console.log('\n📁 New structure:');
console.log('src/locale/');
console.log('├── en/');
console.log('│   ├── components/');
console.log('│   │   ├── header.json');
console.log('│   │   ├── footer.json');
console.log('│   │   └── ... (20 components)');
console.log('│   ├── pages/');
console.log('│   │   ├── home.json');
console.log('│   │   ├── about-page.json');
console.log('│   │   └── ... (9 pages)');
console.log('│   ├── shared/');
console.log('│   │   └── components/');
console.log('│   │       ├── privacy-policy.json');
console.log('│   │       ├── beta-policy.json');
console.log('│   │       └── terms-of-service.json');
console.log('│   └── common.json');
console.log('└── fr/ (same structure)');
console.log('\n📝 Next steps:');
console.log('1. Translate files in src/locale/fr/');
console.log('2. Run: node scripts/merge-i18n-components.js');
console.log('3. Build: npm run build:all-locales');

#!/usr/bin/env node

/**
 * Merge component-based i18n files back into single messages.json
 */

const fs = require('fs');
const path = require('path');

function mergeLocale(locale) {
  const baseDir = path.join(__dirname, `../src/locale/${locale}`);
  const merged = {
    locale: locale,
    translations: {},
  };

  // Merge components
  const componentsDir = path.join(baseDir, 'components');
  if (fs.existsSync(componentsDir)) {
    fs.readdirSync(componentsDir)
      .filter((f) => f.endsWith('.json'))
      .forEach((file) => {
        const content = JSON.parse(fs.readFileSync(path.join(componentsDir, file), 'utf8'));
        Object.assign(merged.translations, content.translations);
      });
  }

  // Merge pages
  const pagesDir = path.join(baseDir, 'pages');
  if (fs.existsSync(pagesDir)) {
    fs.readdirSync(pagesDir)
      .filter((f) => f.endsWith('.json'))
      .forEach((file) => {
        const content = JSON.parse(fs.readFileSync(path.join(pagesDir, file), 'utf8'));
        Object.assign(merged.translations, content.translations);
      });
  }

  // Merge shared components
  const sharedDir = path.join(baseDir, 'shared/components');
  if (fs.existsSync(sharedDir)) {
    fs.readdirSync(sharedDir)
      .filter((f) => f.endsWith('.json'))
      .forEach((file) => {
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
  const outputPath = path.join(
    __dirname,
    `../src/locale/messages.${locale === 'en' ? '' : locale + '.'}json`,
  );
  fs.writeFileSync(outputPath, JSON.stringify(merged, null, 2), 'utf8');
  console.log(`✅ Merged ${locale}: ${Object.keys(merged.translations).length} keys`);
}

mergeLocale('en');
if (fs.existsSync(path.join(__dirname, '../src/locale/fr'))) {
  mergeLocale('fr');
}

console.log('\n✅ All locales merged successfully!');

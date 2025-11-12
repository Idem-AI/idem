#!/usr/bin/env node

/**
 * Merge component-based i18n files back into single messages.json
 */

var fs = require('fs');
var path = require('path');

function mergeLocale(locale) {
  var baseDir = path.join(__dirname, '../src/locale/' + locale);
  var merged = {
    locale: locale,
    translations: {},
  };

  // Merge components
  var componentsDir = path.join(baseDir, 'components');
  if (fs.existsSync(componentsDir)) {
    fs.readdirSync(componentsDir)
      .filter(function (f) {
        return f.endsWith('.json');
      })
      .forEach(function (file) {
        var content = JSON.parse(fs.readFileSync(path.join(componentsDir, file), 'utf8'));
        Object.assign(merged.translations, content.translations);
      });
  }

  // Merge pages
  var pagesDir = path.join(baseDir, 'pages');
  if (fs.existsSync(pagesDir)) {
    fs.readdirSync(pagesDir)
      .filter(function (f) {
        return f.endsWith('.json');
      })
      .forEach(function (file) {
        var content = JSON.parse(fs.readFileSync(path.join(pagesDir, file), 'utf8'));
        Object.assign(merged.translations, content.translations);
      });
  }

  // Merge shared components
  var sharedDir = path.join(baseDir, 'shared/components');
  if (fs.existsSync(sharedDir)) {
    fs.readdirSync(sharedDir)
      .filter(function (f) {
        return f.endsWith('.json');
      })
      .forEach(function (file) {
        var content = JSON.parse(fs.readFileSync(path.join(sharedDir, file), 'utf8'));
        Object.assign(merged.translations, content.translations);
      });
  }

  // Merge common
  var commonFile = path.join(baseDir, 'common.json');
  if (fs.existsSync(commonFile)) {
    var content = JSON.parse(fs.readFileSync(commonFile, 'utf8'));
    Object.assign(merged.translations, content.translations);
  }

  // Merge meta (SEO metadata)
  var metaFile = path.join(baseDir, 'meta.json');
  if (fs.existsSync(metaFile)) {
    var content = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
    Object.assign(merged.translations, content.translations);
  }

  // Write merged file
  var outputPath = path.join(
    __dirname,
    '../src/locale/messages.' + (locale === 'en' ? '' : locale + '.') + 'json',
  );
  fs.writeFileSync(outputPath, JSON.stringify(merged, null, 2), 'utf8');
  console.log('✅ Merged ' + locale + ': ' + Object.keys(merged.translations).length + ' keys');
}

mergeLocale('en');
if (fs.existsSync(path.join(__dirname, '../src/locale/fr'))) {
  mergeLocale('fr');
}

console.log('\n✅ All locales merged successfully!');

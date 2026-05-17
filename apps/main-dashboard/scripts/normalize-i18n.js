#!/usr/bin/env node

/**
 * Script pour normaliser les fichiers de traduction
 * 
 * Ce script :
 * 1. Vérifie que EN et FR ont la même structure
 * 2. Déplace les clés mal placées sous dashboard.*
 * 3. Assure que les deux fichiers ont les mêmes clés racine
 * 
 * Usage: node scripts/normalize-i18n.js
 */

const fs = require('fs');
const path = require('path');

const CONFIG = {
  i18nDir: path.join(__dirname, '../public/assets/i18n'),
  languages: ['en', 'fr'],
};

/**
 * Compte le nombre de clés dans un objet (récursif)
 */
function countKeys(obj) {
  let count = 0;
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      count++;
      if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
        count += countKeys(obj[key]);
      }
    }
  }
  return count;
}

/**
 * Normalise un fichier de traduction
 */
function normalizeTranslations(lang) {
  console.log(`\n📦 Normalisation de la langue: ${lang}`);

  const filePath = path.join(CONFIG.i18nDir, `${lang}.json`);
  const backupPath = path.join(CONFIG.i18nDir, `${lang}.normalize-backup.json`);

  // Charger le fichier
  let translations = {};
  try {
    translations = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    console.log(`  📄 Fichier chargé: ${Object.keys(translations).length} clés racine`);
  } catch (error) {
    console.error(`  ❌ Erreur lecture: ${error.message}`);
    return null;
  }

  // Créer une sauvegarde
  fs.writeFileSync(backupPath, JSON.stringify(translations, null, 2), 'utf8');
  console.log(`  💾 Sauvegarde créée: ${lang}.normalize-backup.json`);

  // Clés qui doivent être sous dashboard.*
  const dashboardKeys = [
    'diagramDisplay',
    'diagramGeneration',
    'showDiagrams',
    'showTests',
    'teamDetailsGlobal',
    'teamDetailsProject',
    'pdfViewer',
    'projectDetails',
  ];

  // Clés qui doivent rester à la racine
  const rootKeys = [
    'common',
    'dashboard',
    'deployment',
    'errors',
    'logoCreation',
    'navigation',
    'notFound',
    'projects',
    'teams',
    'validation',
  ];

  const normalized = {};
  let movedCount = 0;

  // Initialiser dashboard si nécessaire
  if (!translations.dashboard) {
    translations.dashboard = {};
  }

  // Traiter chaque clé
  for (const key in translations) {
    if (translations.hasOwnProperty(key)) {
      if (dashboardKeys.includes(key)) {
        // Déplacer sous dashboard
        normalized.dashboard = normalized.dashboard || {};
        normalized.dashboard[key] = translations[key];
        movedCount++;
        console.log(`  🔄 Déplacé: ${key} → dashboard.${key}`);
      } else if (rootKeys.includes(key)) {
        // Garder à la racine
        normalized[key] = translations[key];
      } else {
        // Clé inconnue, la garder mais avertir
        console.warn(`  ⚠️  Clé inconnue conservée: ${key}`);
        normalized[key] = translations[key];
      }
    }
  }

  // Fusionner avec dashboard existant
  if (translations.dashboard) {
    normalized.dashboard = {
      ...translations.dashboard,
      ...normalized.dashboard,
    };
  }

  // Trier les clés racine
  const sorted = {};
  rootKeys.forEach(key => {
    if (normalized[key]) {
      sorted[key] = normalized[key];
    }
  });

  // Ajouter les clés inconnues à la fin
  for (const key in normalized) {
    if (!rootKeys.includes(key)) {
      sorted[key] = normalized[key];
    }
  }

  // Statistiques
  const beforeKeys = countKeys(translations);
  const afterKeys = countKeys(sorted);

  console.log(`\n  📊 Statistiques:`);
  console.log(`     📉 Avant: ${beforeKeys} clés, ${Object.keys(translations).length} racine`);
  console.log(`     ✨ Après: ${afterKeys} clés, ${Object.keys(sorted).length} racine`);
  console.log(`     🔄 Clés déplacées: ${movedCount}`);

  // Sauvegarder
  fs.writeFileSync(filePath, JSON.stringify(sorted, null, 2), 'utf8');
  console.log(`  ✅ Fichier normalisé: ${lang}.json`);

  return sorted;
}

/**
 * Vérifie la cohérence entre EN et FR
 */
function verifyConsistency() {
  console.log('\n🔍 Vérification de la cohérence...\n');

  const enPath = path.join(CONFIG.i18nDir, 'en.json');
  const frPath = path.join(CONFIG.i18nDir, 'fr.json');

  const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
  const fr = JSON.parse(fs.readFileSync(frPath, 'utf8'));

  const enKeys = Object.keys(en).sort();
  const frKeys = Object.keys(fr).sort();

  const enCount = countKeys(en);
  const frCount = countKeys(fr);

  console.log(`📊 Clés racine:`);
  console.log(`   EN: ${enKeys.length} clés`);
  console.log(`   FR: ${frKeys.length} clés`);

  console.log(`\n📊 Total clés (récursif):`);
  console.log(`   EN: ${enCount} clés`);
  console.log(`   FR: ${frCount} clés`);

  const missingInFr = enKeys.filter(k => !frKeys.includes(k));
  const missingInEn = frKeys.filter(k => !enKeys.includes(k));

  if (missingInFr.length > 0) {
    console.log(`\n⚠️  Clés manquantes dans FR: ${missingInFr.join(', ')}`);
  }

  if (missingInEn.length > 0) {
    console.log(`\n⚠️  Clés manquantes dans EN: ${missingInEn.join(', ')}`);
  }

  if (enKeys.length === frKeys.length && missingInFr.length === 0 && missingInEn.length === 0) {
    console.log(`\n✅ Structure cohérente !`);
    console.log(`   ${enKeys.length} clés racine identiques`);
  } else {
    console.log(`\n❌ Structure incohérente`);
  }

  const diff = Math.abs(enCount - frCount);
  if (diff > 0) {
    console.log(`\n⚠️  Différence de ${diff} clés au total`);
  }
}

/**
 * Point d'entrée principal
 */
function main() {
  console.log('🚀 Démarrage de la normalisation des traductions...\n');

  // Normaliser chaque langue
  for (const lang of CONFIG.languages) {
    normalizeTranslations(lang);
  }

  // Vérifier la cohérence
  verifyConsistency();

  console.log('\n✅ Normalisation terminée avec succès!');
  console.log(`📁 Fichiers dans: ${CONFIG.i18nDir}`);
  console.log(`💾 Sauvegardes: *.normalize-backup.json\n`);
}

// Exécuter le script
main();

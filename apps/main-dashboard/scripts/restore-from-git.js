#!/usr/bin/env node

/**
 * Script pour restaurer les traductions perdues depuis Git
 * 
 * Ce script :
 * 1. Récupère la version précédente depuis Git (HEAD)
 * 2. Fusionne avec la version actuelle
 * 3. Préserve toutes les traductions (anciennes + nouvelles)
 * 
 * Usage: node scripts/restore-from-git.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CONFIG = {
  languages: ['en', 'fr'],
  i18nDir: path.join(__dirname, '../public/assets/i18n'),
  tempDir: '/tmp',
};

/**
 * Fusionne profondément deux objets JSON
 * @param {Object} target - Objet cible (version actuelle)
 * @param {Object} source - Objet source (version Git)
 * @returns {Object} - Objet fusionné
 */
function deepMerge(target, source) {
  const output = { ...source }; // On part de la version Git (complète)

  for (const key in target) {
    if (target.hasOwnProperty(key)) {
      if (
        target[key] &&
        typeof target[key] === 'object' &&
        !Array.isArray(target[key]) &&
        source[key] &&
        typeof source[key] === 'object' &&
        !Array.isArray(source[key])
      ) {
        // Si c'est un objet dans les deux, fusion récursive
        output[key] = deepMerge(target[key], source[key]);
      } else if (!source[key]) {
        // Si la clé n'existe que dans target (nouvelle), on la garde
        output[key] = target[key];
      }
      // Sinon, on garde la version de source (Git)
    }
  }

  return output;
}

/**
 * Récupère le fichier depuis Git
 * @param {string} lang - Code de langue
 * @returns {Object|null} - Contenu JSON ou null si erreur
 */
function getFileFromGit(lang) {
  const gitPath = `HEAD:apps/main-dashboard/public/assets/i18n/${lang}.json`;
  const tempFile = path.join(CONFIG.tempDir, `${lang}-git.json`);

  try {
    console.log(`  📥 Récupération depuis Git: ${gitPath}`);
    execSync(`git show ${gitPath} > ${tempFile}`, {
      cwd: path.join(__dirname, '../../..'),
      stdio: 'pipe',
    });

    const content = JSON.parse(fs.readFileSync(tempFile, 'utf8'));
    console.log(`  ✅ Fichier Git chargé: ${Object.keys(content).length} clés racine`);
    return content;
  } catch (error) {
    console.error(`  ❌ Erreur lors de la récupération depuis Git: ${error.message}`);
    return null;
  }
}

/**
 * Restaure les traductions pour une langue
 * @param {string} lang - Code de langue
 */
function restoreTranslations(lang) {
  console.log(`\n📦 Restauration de la langue: ${lang}`);

  const currentFile = path.join(CONFIG.i18nDir, `${lang}.json`);
  const backupFile = path.join(CONFIG.i18nDir, `${lang}.backup.json`);

  // 1. Charger la version actuelle
  let currentTranslations = {};
  if (fs.existsSync(currentFile)) {
    try {
      currentTranslations = JSON.parse(fs.readFileSync(currentFile, 'utf8'));
      console.log(`  📄 Version actuelle: ${Object.keys(currentTranslations).length} clés racine`);
    } catch (error) {
      console.error(`  ❌ Erreur lecture version actuelle: ${error.message}`);
      return;
    }
  }

  // 2. Récupérer la version Git
  const gitTranslations = getFileFromGit(lang);
  if (!gitTranslations) {
    console.warn(`  ⚠️  Impossible de récupérer la version Git`);
    return;
  }

  // 3. Créer une sauvegarde de la version actuelle
  try {
    fs.writeFileSync(backupFile, JSON.stringify(currentTranslations, null, 2), 'utf8');
    console.log(`  💾 Sauvegarde créée: ${lang}.backup.json`);
  } catch (error) {
    console.error(`  ❌ Erreur création sauvegarde: ${error.message}`);
  }

  // 4. Fusionner : Git (base) + Current (nouvelles clés)
  const mergedTranslations = deepMerge(currentTranslations, gitTranslations);
  console.log(`  🔄 Fusion effectuée: ${Object.keys(mergedTranslations).length} clés racine`);

  // 5. Compter les différences
  const currentKeys = countKeys(currentTranslations);
  const gitKeys = countKeys(gitTranslations);
  const mergedKeys = countKeys(mergedTranslations);

  console.log(`\n  📊 Statistiques:`);
  console.log(`     📉 Version actuelle: ${currentKeys} clés`);
  console.log(`     📦 Version Git: ${gitKeys} clés`);
  console.log(`     ✨ Version fusionnée: ${mergedKeys} clés`);
  console.log(`     🆕 Clés restaurées: ${mergedKeys - currentKeys}`);

  // 6. Sauvegarder le résultat
  try {
    fs.writeFileSync(currentFile, JSON.stringify(mergedTranslations, null, 2), 'utf8');
    console.log(`  ✅ Fichier restauré: ${lang}.json`);
  } catch (error) {
    console.error(`  ❌ Erreur sauvegarde: ${error.message}`);
  }
}

/**
 * Compte le nombre total de clés dans un objet (récursif)
 * @param {Object} obj - Objet à analyser
 * @returns {number} - Nombre de clés
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
 * Point d'entrée principal
 */
function main() {
  console.log('🚀 Démarrage de la restauration des traductions depuis Git...\n');

  // Vérifier qu'on est dans un repo Git
  try {
    execSync('git rev-parse --git-dir', {
      cwd: path.join(__dirname, '../../..'),
      stdio: 'pipe',
    });
  } catch (error) {
    console.error('❌ Erreur: Ce script doit être exécuté dans un dépôt Git');
    process.exit(1);
  }

  // Restaurer pour chaque langue
  for (const lang of CONFIG.languages) {
    restoreTranslations(lang);
  }

  console.log('\n✅ Restauration terminée avec succès!');
  console.log(`📁 Fichiers restaurés dans: ${CONFIG.i18nDir}`);
  console.log(`💾 Sauvegardes créées: *.backup.json\n`);
  console.log('💡 Prochaines étapes:');
  console.log('   1. Vérifier les fichiers restaurés');
  console.log('   2. Exécuter: npm run i18n:split');
  console.log('   3. Commit les changements\n');
}

// Exécuter le script
main();

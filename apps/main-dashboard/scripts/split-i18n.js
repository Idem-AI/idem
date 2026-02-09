#!/usr/bin/env node

/**
 * Script pour diviser les fichiers de traduction en plusieurs fichiers par composant
 *
 * Ce script prend les fichiers en.json et fr.json et les divise en plusieurs fichiers
 * en suivant l'arborescence des composants et modules.
 *
 * Usage: node scripts/split-i18n.js
 */

const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  sourceDir: path.join(__dirname, '../public/assets/i18n'),
  outputDir: path.join(__dirname, '../public/assets/i18n/split'),
  languages: ['en', 'fr'],

  // Mapping des clés JSON vers les chemins de composants
  componentMapping: {
    // Common et validation sont utilisés partout
    common: 'shared/common',
    validation: 'shared/validation',
    navigation: 'shared/navigation',
    errors: 'shared/errors',
    projects: 'modules/projects',
    teams: 'modules/teams',

    // Dashboard components
    'dashboard.addMemberModal': 'modules/dashboard/components/add-team-member-modal',
    'dashboard.addTeamToProjectModal': 'modules/dashboard/components/add-team-to-project-modal',
    'dashboard.projectCard': 'modules/dashboard/components/project-card',
    'dashboard.sidebar': 'modules/dashboard/components/sidebar-dashboard',
    'dashboard.sidebarGlobal': 'modules/dashboard/components/sidebar-global',

    // Dashboard pages - Create Project
    'dashboard.colorCustomizer':
      'modules/dashboard/pages/create-project/components/color-customizer',
    'dashboard.colorSelection': 'modules/dashboard/pages/create-project/components/color-selection',
    'dashboard.logoEditor': 'modules/dashboard/pages/create-project/components/logo-editor-chat',
    'dashboard.logoPreferences':
      'modules/dashboard/pages/create-project/components/logo-preferences',
    'dashboard.logoSelection': 'modules/dashboard/pages/create-project/components/logo-selection',
    'dashboard.logoVariations': 'modules/dashboard/pages/create-project/components/logo-variations',
    'dashboard.projectDescription':
      'modules/dashboard/pages/create-project/components/project-description',
    'dashboard.projectDetails': 'modules/dashboard/pages/create-project/components/project-details',
    'dashboard.projectSummary': 'modules/dashboard/pages/create-project/components/project-summary',
    'dashboard.typographySelection':
      'modules/dashboard/pages/create-project/components/typography-selection',
    'dashboard.createProject': 'modules/dashboard/pages/create-project',

    // Dashboard pages - Other
    'dashboard.createTeam': 'modules/dashboard/pages/create-team',
    'dashboard.aiAssistant': 'modules/dashboard/pages/deployment/components/ai-assistant',
    'dashboard.expertDeployment': 'modules/dashboard/pages/deployment/components/expert-deployment',
    'dashboard.modeSelector': 'modules/dashboard/pages/deployment/components/mode-selector',
    'dashboard.quickDeployment': 'modules/dashboard/pages/deployment/components/quick-deployment',
    'dashboard.templateDeployment':
      'modules/dashboard/pages/deployment/components/template-deployment',
    'dashboard.terraformFiles': 'modules/dashboard/pages/deployment/components/terraform-files',

    // Dashboard pages - Nouvelles pages
    'dashboard.addTeamToProject': 'modules/dashboard/pages/add-team-to-project',
    'dashboard.dashboard': 'modules/dashboard/pages/dashboard',
    'dashboard.globalDashboard': 'modules/dashboard/pages/global-dashboard',
    'dashboard.myTeams': 'modules/dashboard/pages/my-teams',
    'dashboard.profile': 'modules/dashboard/pages/profile',
    'dashboard.projectsList': 'modules/dashboard/pages/projects-list',
    'dashboard.projectTeams': 'modules/dashboard/pages/project-teams',
    'dashboard.showTests': 'modules/dashboard/pages/show-tests',
    'dashboard.teamDetailsGlobal': 'modules/dashboard/pages/team-details-global',
    'dashboard.teamDetailsProject': 'modules/dashboard/pages/team-details-project',

    // Dashboard pages - Show pages
    'dashboard.showBranding': 'modules/dashboard/pages/show-branding',
    'dashboard.showBusinessPlan': 'modules/dashboard/pages/show-business-plan',
    'dashboard.businessPlanGeneration':
      'modules/dashboard/pages/show-business-plan/components/business-plan-generation',
    'dashboard.additionalInfoForm':
      'modules/dashboard/pages/show-business-plan/components/additional-info-form',
    'dashboard.showDiagrams': 'modules/dashboard/pages/show-diagrams',
    'dashboard.diagramGeneration':
      'modules/dashboard/pages/show-diagrams/components/diagram-generation',
    'dashboard.diagramDisplay': 'modules/dashboard/pages/show-diagrams/components/diagram-display',

    // Dashboard pages - Deployment
    'dashboard.createDeployment': 'modules/dashboard/pages/deployment/create-deployment',
    'dashboard.deploymentList': 'modules/dashboard/pages/deployment/deployment-list',

    // Dashboard pages - Development
    'dashboard.createDevelopment': 'modules/dashboard/pages/development/create-development',
    'dashboard.showDevelopment': 'modules/dashboard/pages/development/show-development',

    // Shared components
    notFound: 'shared/components/not-found',
    'dashboard.pdfViewer': 'shared/components/pdf-viewer',
  },
};

/**
 * Récupère la valeur d'un objet à partir d'un chemin de clés
 * @param {Object} obj - L'objet source
 * @param {string} path - Le chemin (ex: "dashboard.addMemberModal.title")
 * @returns {*} La valeur trouvée ou undefined
 */
function getValueByPath(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Définit la valeur d'un objet à partir d'un chemin de clés
 * @param {Object} obj - L'objet cible
 * @param {string} path - Le chemin (ex: "dashboard.addMemberModal.title")
 * @param {*} value - La valeur à définir
 */
function setValueByPath(obj, path, value) {
  const keys = path.split('.');
  const lastKey = keys.pop();
  const target = keys.reduce((current, key) => {
    if (!current[key]) current[key] = {};
    return current[key];
  }, obj);
  target[lastKey] = value;
}

/**
 * Trouve le mapping de composant pour une clé donnée
 * @param {string} key - La clé de traduction
 * @returns {string|null} Le chemin du composant ou null
 */
function findComponentPath(key) {
  // Recherche exacte
  if (CONFIG.componentMapping[key]) {
    return CONFIG.componentMapping[key];
  }

  // Recherche par préfixe (pour les clés imbriquées)
  const sortedKeys = Object.keys(CONFIG.componentMapping).sort((a, b) => b.length - a.length);
  for (const mappingKey of sortedKeys) {
    if (key.startsWith(mappingKey + '.')) {
      return CONFIG.componentMapping[mappingKey];
    }
  }

  return null;
}

/**
 * Extrait les traductions pour un composant spécifique
 * @param {Object} translations - L'objet de traductions complet
 * @param {string} prefix - Le préfixe de clé (ex: "dashboard.addMemberModal")
 * @returns {Object} Les traductions extraites
 */
function extractTranslations(translations, prefix) {
  const result = {};
  const value = getValueByPath(translations, prefix);

  if (value && typeof value === 'object') {
    return value;
  }

  return result;
}

/**
 * Crée la structure de dossiers si elle n'existe pas
 * @param {string} filePath - Le chemin du fichier
 */
function ensureDirectoryExists(filePath) {
  const dirname = path.dirname(filePath);
  if (!fs.existsSync(dirname)) {
    fs.mkdirSync(dirname, { recursive: true });
  }
}

/**
 * Divise les traductions en plusieurs fichiers
 * @param {string} lang - Le code de langue (en, fr)
 */
function splitTranslations(lang) {
  console.log(`\n📦 Traitement de la langue: ${lang}`);

  // Lire le fichier source
  const sourceFile = path.join(CONFIG.sourceDir, `${lang}.json`);
  if (!fs.existsSync(sourceFile)) {
    console.error(`❌ Fichier source non trouvé: ${sourceFile}`);
    return;
  }

  const translations = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
  const processedKeys = new Set();
  let fileCount = 0;

  // Traiter chaque mapping
  for (const [key, componentPath] of Object.entries(CONFIG.componentMapping)) {
    const extracted = extractTranslations(translations, key);

    if (Object.keys(extracted).length === 0) {
      continue;
    }

    // Créer le chemin de fichier de sortie
    const outputPath = path.join(CONFIG.outputDir, componentPath, `${lang}.json`);
    ensureDirectoryExists(outputPath);

    // Lire le fichier existant ou créer un nouveau
    let existingContent = {};
    if (fs.existsSync(outputPath)) {
      existingContent = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    }

    // Fusionner avec le contenu existant
    const merged = { ...existingContent, ...extracted };

    // Écrire le fichier
    fs.writeFileSync(outputPath, JSON.stringify(merged, null, 2) + '\n', 'utf8');

    processedKeys.add(key);
    fileCount++;
    console.log(`  ✅ ${componentPath}/${lang}.json`);
  }

  console.log(`\n✨ ${fileCount} fichiers créés pour ${lang}`);
}

/**
 * Crée un fichier d'index pour chaque langue
 * @param {string} lang - Le code de langue
 */
function createIndexFile(lang) {
  const indexPath = path.join(CONFIG.outputDir, `index.${lang}.json`);
  const index = {
    language: lang,
    components: [],
  };

  // Parcourir tous les fichiers créés
  function scanDirectory(dir, relativePath = '') {
    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        scanDirectory(fullPath, path.join(relativePath, item));
      } else if (item === `${lang}.json`) {
        index.components.push(relativePath);
      }
    }
  }

  scanDirectory(CONFIG.outputDir);

  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n', 'utf8');
  console.log(`\n📋 Index créé: index.${lang}.json`);
}

/**
 * Fonction principale
 */
function main() {
  console.log('🚀 Démarrage de la division des fichiers de traduction...\n');

  // Créer le dossier de sortie
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }

  // Traiter chaque langue
  for (const lang of CONFIG.languages) {
    splitTranslations(lang);
    createIndexFile(lang);
  }

  console.log('\n✅ Division terminée avec succès!');
  console.log(`📁 Fichiers générés dans: ${CONFIG.outputDir}`);
}

// Exécuter le script
if (require.main === module) {
  main();
}

module.exports = { splitTranslations, extractTranslations, findComponentPath };

#!/usr/bin/env node

/**
 * Script pour fusionner les fichiers de traduction divisés en un seul fichier
 *
 * Ce script prend tous les fichiers de traduction divisés et les fusionne
 * en un seul fichier en.json et fr.json
 *
 * Usage: node scripts/merge-i18n.js
 */

const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  splitDir: path.join(__dirname, '../public/assets/i18n/split'),
  outputDir: path.join(__dirname, '../public/assets/i18n'),
  languages: ['en', 'fr'],

  // Mapping inverse: chemin de composant vers clé JSON
  pathToKeyMapping: {
    'shared/common': 'common',
    'shared/validation': 'validation',
    'shared/navigation': 'navigation',
    'shared/errors': 'errors',
    'modules/projects': 'projects',
    'modules/teams': 'teams',

    // Dashboard components
    'modules/dashboard/components/add-team-member-modal': 'dashboard.addMemberModal',
    'modules/dashboard/components/add-team-to-project-modal': 'dashboard.addTeamToProjectModal',
    'modules/dashboard/components/project-card': 'dashboard.projectCard',
    'modules/dashboard/components/sidebar-dashboard': 'dashboard.sidebar',
    'modules/dashboard/components/sidebar-global': 'dashboard.sidebarGlobal',

    // Dashboard pages - Create Project
    'modules/dashboard/pages/create-project/components/color-customizer':
      'dashboard.colorCustomizer',
    'modules/dashboard/pages/create-project/components/color-selection': 'dashboard.colorSelection',
    'modules/dashboard/pages/create-project/components/logo-creation-simulator': 'logoCreation',
    'modules/dashboard/pages/create-project/components/logo-editor-chat': 'dashboard.logoEditor',
    'modules/dashboard/pages/create-project/components/logo-preferences':
      'dashboard.logoPreferences',
    'modules/dashboard/pages/create-project/components/logo-selection': 'dashboard.logoSelection',
    'modules/dashboard/pages/create-project/components/logo-variations': 'dashboard.logoVariations',
    'modules/dashboard/pages/create-project/components/project-description':
      'dashboard.projectDescription',
    'modules/dashboard/pages/create-project/components/project-details': 'dashboard.projectDetails',
    'modules/dashboard/pages/create-project/components/project-summary': 'dashboard.projectSummary',
    'modules/dashboard/pages/create-project/components/typography-selection':
      'dashboard.typographySelection',
    'modules/dashboard/pages/create-project': 'dashboard.createProject',

    // Dashboard pages - Other
    'modules/dashboard/pages/create-team': 'dashboard.createTeam',
    'modules/dashboard/pages/deployment/components/ai-assistant': 'dashboard.aiAssistant',
    'modules/dashboard/pages/deployment/components/expert-deployment': 'dashboard.expertDeployment',
    'modules/dashboard/pages/deployment/components/mode-selector': 'dashboard.modeSelector',
    'modules/dashboard/pages/deployment/components/quick-deployment': 'dashboard.quickDeployment',
    'modules/dashboard/pages/deployment/components/template-deployment':
      'dashboard.templateDeployment',
    'modules/dashboard/pages/deployment/components/terraform-files': 'dashboard.terraformFiles',

    // Dashboard pages - Nouvelles pages
    'modules/dashboard/pages/add-team-to-project': 'dashboard.addTeamToProject',
    'modules/dashboard/pages/dashboard': 'dashboard.dashboard',
    'modules/dashboard/pages/global-dashboard': 'dashboard.globalDashboard',
    'modules/dashboard/pages/my-teams': 'dashboard.myTeams',
    'modules/dashboard/pages/profile': 'dashboard.profile',
    'modules/dashboard/pages/projects-list': 'dashboard.projectsList',
    'modules/dashboard/pages/project-teams': 'dashboard.projectTeams',
    'modules/dashboard/pages/show-tests': 'dashboard.showTests',
    'modules/dashboard/pages/team-details-global': 'dashboard.teamDetailsGlobal',
    'modules/dashboard/pages/team-details-project': 'dashboard.teamDetailsProject',

    // Dashboard pages - Show pages
    'modules/dashboard/pages/show-branding': 'dashboard.showBranding',
    'modules/dashboard/pages/show-branding/components/branding-display': 'dashboard.brandingDisplay',
    'modules/dashboard/pages/show-branding/components/branding-generation': 'dashboard.brandingGeneration',
    'modules/dashboard/components/branding-generation': 'dashboard.brandingGeneration',
    'modules/dashboard/pages/show-business-plan': 'dashboard.showBusinessPlan',
    'modules/dashboard/pages/show-business-plan/components/business-plan-generation':
      'dashboard.businessPlanGeneration',
    'modules/dashboard/components/business-plan-generation': 'dashboard.businessPlanGeneration',
    'modules/dashboard/pages/show-business-plan/components/business-plan-display':
      'dashboard.businessPlanDisplay',
    'modules/dashboard/pages/show-business-plan/components/additional-info-form':
      'dashboard.additionalInfoForm',
    'modules/dashboard/pages/show-diagrams': 'dashboard.showDiagrams',
    'modules/dashboard/pages/show-diagrams/components/diagram-generation':
      'dashboard.diagramGeneration',
    'modules/dashboard/pages/show-diagrams/components/diagram-display': 'dashboard.diagramDisplay',

    // Dashboard pages - Deployment
    'modules/dashboard/pages/deployment/create-deployment': 'dashboard.createDeployment',
    'modules/dashboard/pages/deployment/deployment-list': 'dashboard.deploymentList',

    // Dashboard pages - Development
    'modules/dashboard/pages/development/create-development': 'dashboard.createDevelopment',
    'modules/dashboard/pages/development/show-development': 'dashboard.showDevelopment',

    // Shared components
    'shared/components/not-found': 'notFound',
    'shared/components/pdf-viewer': 'dashboard.pdfViewer',
  },
};

/**
 * Définit la valeur d'un objet à partir d'un chemin de clés
 * @param {Object} obj - L'objet cible
 * @param {string} path - Le chemin (ex: "dashboard.addMemberModal")
 * @param {*} value - La valeur à définir
 */
function setValueByPath(obj, path, value) {
  const keys = path.split('.');
  const lastKey = keys.pop();
  const target = keys.reduce((current, key) => {
    if (!current[key]) current[key] = {};
    return current[key];
  }, obj);

  // Fusionner si c'est un objet
  if (typeof value === 'object' && !Array.isArray(value) && typeof target[lastKey] === 'object') {
    target[lastKey] = { ...target[lastKey], ...value };
  } else {
    target[lastKey] = value;
  }
}

/**
 * Parcourt récursivement un dossier et trouve tous les fichiers de traduction
 * @param {string} dir - Le dossier à parcourir
 * @param {string} lang - La langue recherchée
 * @param {string} basePath - Le chemin de base (pour la récursion)
 * @returns {Array} Liste des fichiers trouvés avec leur chemin relatif
 */
function findTranslationFiles(dir, lang, basePath = '') {
  const results = [];

  if (!fs.existsSync(dir)) {
    return results;
  }

  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      const subResults = findTranslationFiles(fullPath, lang, path.join(basePath, item));
      results.push(...subResults);
    } else if (item === `${lang}.json`) {
      results.push({
        filePath: fullPath,
        relativePath: basePath,
      });
    }
  }

  return results;
}

/**
 * Fusionne les traductions pour une langue
 * @param {string} lang - Le code de langue (en, fr)
 */
function mergeTranslations(lang) {
  console.log(`\n📦 Fusion de la langue: ${lang}`);

  const merged = {};
  const files = findTranslationFiles(CONFIG.splitDir, lang);

  console.log(`  📄 ${files.length} fichiers trouvés`);

  for (const { filePath, relativePath } of files) {
    // Trouver la clé correspondante
    const key = CONFIG.pathToKeyMapping[relativePath];

    if (!key) {
      console.warn(`  ⚠️  Aucune clé trouvée pour: ${relativePath}`);
      continue;
    }

    // Lire le fichier
    let content;
    try {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      if (!fileContent.trim()) {
        console.warn(`  ⚠️  Fichier vide ignoré: ${filePath}`);
        continue;
      }
      content = JSON.parse(fileContent);
    } catch (error) {
      console.error(`  ❌ Erreur de parsing JSON dans: ${filePath}`);
      console.error(`     Erreur: ${error.message}`);
      continue;
    }

    // Ajouter au résultat fusionné
    setValueByPath(merged, key, content);

    console.log(`  ✅ ${relativePath} → ${key}`);
  }

  // Écrire le fichier fusionné
  const outputPath = path.join(CONFIG.outputDir, `${lang}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(merged, null, 2) + '\n', 'utf8');

  console.log(`\n✨ Fichier fusionné créé: ${lang}.json`);
}

/**
 * Fonction principale
 */
function main() {
  console.log('🚀 Démarrage de la fusion des fichiers de traduction...\n');

  // Vérifier que le dossier split existe
  if (!fs.existsSync(CONFIG.splitDir)) {
    console.error(`❌ Dossier split non trouvé: ${CONFIG.splitDir}`);
    console.log("💡 Exécutez d'abord: node scripts/split-i18n.js");
    process.exit(1);
  }

  // Traiter chaque langue
  for (const lang of CONFIG.languages) {
    mergeTranslations(lang);
  }

  console.log('\n✅ Fusion terminée avec succès!');
  console.log(`📁 Fichiers générés dans: ${CONFIG.outputDir}`);
}

// Exécuter le script
if (require.main === module) {
  main();
}

module.exports = { mergeTranslations, findTranslationFiles };

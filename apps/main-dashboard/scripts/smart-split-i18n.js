#!/usr/bin/env node

/**
 * Script intelligent de split des traductions (inverse du merge)
 *
 * Ce script prend les fichiers complets (en.json, fr.json) et les divise
 * intelligemment dans les fichiers split en :
 * - Préservant les traductions existantes dans les fichiers split
 * - Ajoutant les nouvelles clés depuis le fichier complet
 * - Mettant à jour les clés modifiées
 *
 * Usage: node scripts/smart-split-i18n.js
 */

const fs = require('fs');
const path = require('path');

// Configuration (même que smart-merge)
const CONFIG = {
  splitDir: path.join(__dirname, '../public/assets/i18n/split'),
  outputDir: path.join(__dirname, '../public/assets/i18n'),
  languages: ['en', 'fr'],

  // Mapping: chemin de composant vers clé JSON
  pathToKeyMapping: {
    'shared/common': 'common',
    'shared/validation': 'validation',
    'shared/navigation': 'navigation',
    'shared/errors': 'errors',
    'modules/chat': 'chat',
    'modules/projects': 'projects',
    'modules/teams': 'teams',

    // Dashboard components
    'modules/dashboard/components/add-team-member-modal': 'dashboard.addMemberModal',
    'modules/dashboard/components/add-team-to-project-modal': 'dashboard.addTeamToProjectModal',
    'modules/dashboard/components/incomplete-project-banner': 'dashboard.incompleteBanner',
    'modules/dashboard/components/project-card': 'dashboard.projectCard',
    'modules/dashboard/components/sidebar-dashboard': 'dashboard.sidebar',
    'modules/dashboard/components/sidebar-global': 'dashboard.sidebarGlobal',

    // Dashboard pages - Create Project
    'modules/dashboard/pages/create-project/components/color-customizer': 'dashboard.colorCustomizer',
    'modules/dashboard/pages/create-project/components/color-selection': 'dashboard.colorSelection',
    'modules/dashboard/pages/create-project/components/logo-creation-simulator': 'logoCreation',
    'modules/dashboard/pages/create-project/components/logo-editor-chat': 'dashboard.logoEditor',
    'modules/dashboard/pages/create-project/components/logo-preferences': 'dashboard.logoPreferences',
    'modules/dashboard/pages/create-project/components/logo-selection': 'dashboard.logoSelection',
    'modules/dashboard/pages/create-project/components/logo-variations': 'dashboard.logoVariations',
    'modules/dashboard/pages/create-project/components/project-description': 'dashboard.projectDescription',
    'modules/dashboard/pages/create-project/components/project-details': 'dashboard.projectDetails',
    'modules/dashboard/pages/create-project/components/project-summary': 'dashboard.projectSummary',
    'modules/dashboard/pages/create-project/components/typography-selection': 'dashboard.typographySelection',
    'modules/dashboard/pages/create-project': 'dashboard.createProject',

    // Dashboard pages
    'modules/dashboard/pages/add-team-to-project': 'dashboard.addTeamToProject',
    'modules/dashboard/pages/advisor': 'dashboard.advisor',
    'modules/dashboard/pages/create-team': 'dashboard.createTeam',
    'modules/dashboard/pages/dashboard': 'dashboard.dashboard',
    'modules/dashboard/pages/deployment/components/ai-assistant': 'dashboard.aiAssistant',
    'modules/dashboard/pages/deployment/components/expert-deployment': 'dashboard.expertDeployment',
    'modules/dashboard/pages/deployment/components/mode-selector': 'dashboard.modeSelector',
    'modules/dashboard/pages/deployment/components/quick-deployment': 'dashboard.quickDeployment',
    'modules/dashboard/pages/deployment/components/template-deployment': 'dashboard.templateDeployment',
    'modules/dashboard/pages/deployment/components/terraform-files': 'dashboard.terraformFiles',
    'modules/dashboard/pages/deployment/create-deployment': 'dashboard.createDeployment',
    'modules/dashboard/pages/deployment/deployment-list': 'dashboard.deploymentList',
    'modules/dashboard/pages/development/create-development': 'dashboard.createDevelopment',
    'modules/dashboard/pages/development/show-development': 'dashboard.showDevelopment',
    'modules/dashboard/pages/global-dashboard': 'dashboard.globalDashboard',
    'modules/dashboard/pages/legal-docs': 'dashboard.legalDocs',
    'modules/dashboard/pages/my-teams': 'dashboard.myTeams',
    'modules/dashboard/pages/profile': 'dashboard.profile',
    'modules/dashboard/pages/project-teams': 'dashboard.projectTeams',
    'modules/dashboard/pages/projects-list': 'dashboard.projectsList',
    'modules/dashboard/pages/show-branding/components/branding-display': 'dashboard.brandingDisplay',
    'modules/dashboard/pages/show-branding/components/branding-generation': 'dashboard.brandingGeneration',
    'modules/dashboard/pages/show-branding': 'dashboard.showBranding',
    'modules/dashboard/pages/show-business-plan/components/additional-info-form': 'dashboard.additionalInfoForm',
    'modules/dashboard/pages/show-business-plan/components/business-plan-display': 'dashboard.businessPlanDisplay',
    'modules/dashboard/pages/show-business-plan/components/business-plan-generation': 'dashboard.businessPlanGeneration',
    'modules/dashboard/pages/show-business-plan': 'dashboard.showBusinessPlan',
    'modules/dashboard/pages/show-diagrams/components/diagram-display': 'dashboard.diagramDisplay',
    'modules/dashboard/pages/show-diagrams/components/diagram-generation': 'dashboard.diagramGeneration',
    'modules/dashboard/pages/show-diagrams': 'dashboard.showDiagrams',
    'modules/dashboard/pages/show-pitch-deck': 'dashboard.showPitchDeck',
    'modules/dashboard/pages/show-tests': 'dashboard.showTests',
    'modules/dashboard/pages/team-details-global': 'dashboard.teamDetailsGlobal',
    'modules/dashboard/pages/team-details-project': 'dashboard.teamDetailsProject',

    // Shared components
    'shared/components/not-found': 'notFound',
    'shared/components/pdf-viewer': 'dashboard.pdfViewer',
  },
};

/**
 * Extrait une valeur d'un objet imbriqué via un chemin en notation pointée
 * @param {Object} obj - Objet source
 * @param {string} path - Chemin (ex: 'dashboard.sidebar.title')
 * @returns {*} - Valeur extraite ou undefined
 */
function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Définit une valeur dans un objet imbriqué via un chemin en notation pointée
 * @param {Object} obj - Objet cible
 * @param {string} path - Chemin (ex: 'dashboard.sidebar.title')
 * @param {*} value - Valeur à définir
 */
function setNestedValue(obj, path, value) {
  const keys = path.split('.');
  const lastKey = keys.pop();
  const target = keys.reduce((current, key) => {
    if (!current[key]) current[key] = {};
    return current[key];
  }, obj);
  target[lastKey] = value;
}

/**
 * Split intelligemment les traductions pour une langue
 * @param {string} lang - Le code de langue (en, fr)
 */
function smartSplitTranslations(lang) {
  console.log(`\n📦 Split intelligent de la langue: ${lang}`);

  const completeFile = path.join(CONFIG.outputDir, `${lang}.json`);

  // 1. Charger le fichier complet
  if (!fs.existsSync(completeFile)) {
    console.warn(`  ⚠️  Fichier complet non trouvé: ${lang}.json`);
    return;
  }

  let completeTranslations = {};
  try {
    completeTranslations = JSON.parse(fs.readFileSync(completeFile, 'utf8'));
    console.log(`  📄 Fichier complet chargé: ${lang}.json`);
  } catch (error) {
    console.error(`  ❌ Erreur lors de la lecture du fichier complet: ${error.message}`);
    return;
  }

  let updatedCount = 0;
  let createdCount = 0;

  // 2. Pour chaque mapping, extraire et sauvegarder dans le fichier split
  for (const [relativePath, key] of Object.entries(CONFIG.pathToKeyMapping)) {
    const splitFilePath = path.join(CONFIG.splitDir, relativePath, `${lang}.json`);

    // Extraire la valeur du fichier complet
    const value = getNestedValue(completeTranslations, key);

    if (!value) {
      // Pas de valeur pour cette clé, on skip
      continue;
    }

    // Créer le répertoire si nécessaire
    const splitDir = path.dirname(splitFilePath);
    if (!fs.existsSync(splitDir)) {
      fs.mkdirSync(splitDir, { recursive: true });
    }

    // Créer l'objet avec la structure complète
    const splitContent = {};
    setNestedValue(splitContent, key, value);

    // Sauvegarder le fichier split
    try {
      const fileExists = fs.existsSync(splitFilePath);
      fs.writeFileSync(splitFilePath, JSON.stringify(splitContent, null, 2), 'utf8');

      if (fileExists) {
        updatedCount++;
        console.log(`  🔄 ${key} → ${relativePath}`);
      } else {
        createdCount++;
        console.log(`  🆕 ${key} → ${relativePath}`);
      }
    } catch (error) {
      console.error(`  ❌ Erreur lors de l'écriture de ${splitFilePath}: ${error.message}`);
    }
  }

  console.log(`\n✨ Split terminé pour: ${lang}.json`);
  console.log(`  📊 Statistiques:`);
  console.log(`     🆕 Fichiers créés: ${createdCount}`);
  console.log(`     🔄 Fichiers mis à jour: ${updatedCount}`);
}

/**
 * Point d'entrée principal
 */
function main() {
  console.log('🚀 Démarrage du split intelligent des traductions...\n');

  // Split pour chaque langue
  for (const lang of CONFIG.languages) {
    smartSplitTranslations(lang);
  }

  console.log('\n✅ Split intelligent terminé avec succès!');
  console.log(`📁 Fichiers générés dans: ${CONFIG.splitDir}\n`);
}

// Exécuter le script
main();

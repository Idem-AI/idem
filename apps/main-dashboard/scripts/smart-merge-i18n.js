#!/usr/bin/env node

/**
 * Script intelligent de fusion bidirectionnelle des traductions
 *
 * Ce script fusionne intelligemment les traductions en :
 * - Préservant les traductions existantes
 * - Ajoutant les nouvelles clés
 * - Mettant à jour les clés modifiées
 * - Fonctionnant dans les deux sens (split ↔ complet)
 *
 * Usage: node scripts/smart-merge-i18n.js
 */

const fs = require('fs');
const path = require('path');

// Configuration
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
    'modules/dashboard/components/generation-status-panel': 'dashboard.generationPanel',
    'modules/dashboard/components/project-card': 'dashboard.projectCard',
    'modules/dashboard/components/sidebar-dashboard': 'dashboard.sidebar',
    'modules/dashboard/components/sidebar-global': 'dashboard.sidebarGlobal',

    // Dashboard pages - Create Project
    'modules/dashboard/pages/create-project/components/color-customizer': 'dashboard.colorCustomizer',
    'modules/dashboard/pages/create-project/components/color-selection': 'dashboard.colorSelection',
    'modules/dashboard/pages/create-project/components/logo-choice': 'dashboard.logoChoice',
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
    'modules/dashboard/pages/document-editor': 'dashboard.documentEditor',
    'modules/dashboard/pages/finance': 'dashboard.finance',
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
    'shared/components/agent-research-console': 'dashboard.researchConsole',
  },
};

/**
 * Fusionne profondément deux objets JSON
 * @param {Object} target - Objet cible (existant)
 * @param {Object} source - Objet source (nouveau)
 * @returns {Object} - Objet fusionné
 */
function deepMerge(target, source) {
  const output = { ...target };

  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      if (
        source[key] &&
        typeof source[key] === 'object' &&
        !Array.isArray(source[key])
      ) {
        // Si c'est un objet, fusion récursive
        output[key] = deepMerge(target[key] || {}, source[key]);
      } else {
        // Sinon, on prend la valeur source (nouvelle ou mise à jour)
        output[key] = source[key];
      }
    }
  }

  return output;
}

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
 * Trouve tous les fichiers de traduction pour une langue
 * @param {string} dir - Répertoire à scanner
 * @param {string} lang - Code de langue
 * @param {string} basePath - Chemin de base relatif
 * @returns {Array} - Liste des fichiers trouvés
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
 * Fusionne intelligemment les traductions pour une langue
 * @param {string} lang - Le code de langue (en, fr)
 */
function smartMergeTranslations(lang) {
  console.log(`\n📦 Fusion intelligente de la langue: ${lang}`);

  const outputFile = path.join(CONFIG.outputDir, `${lang}.json`);

  // 1. Charger le fichier complet existant (s'il existe)
  let existingTranslations = {};
  if (fs.existsSync(outputFile)) {
    try {
      existingTranslations = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
      console.log(`  📄 Fichier existant chargé: ${lang}.json`);
    } catch (error) {
      console.warn(`  ⚠️  Erreur lors de la lecture du fichier existant: ${error.message}`);
    }
  }

  // 2. Charger tous les fichiers split
  const files = findTranslationFiles(CONFIG.splitDir, lang);
  console.log(`  📄 ${files.length} fichiers split trouvés`);

  // 3. Fusionner les fichiers split dans un nouvel objet
  const splitTranslations = {};
  let addedCount = 0;
  let updatedCount = 0;

  for (const { filePath, relativePath } of files) {
    const key = CONFIG.pathToKeyMapping[relativePath];

    if (!key) {
      console.warn(`  ⚠️  Aucune clé trouvée pour: ${relativePath}`);
      continue;
    }

    try {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      if (!fileContent.trim()) {
        console.warn(`  ⚠️  Fichier vide ignoré: ${filePath}`);
        continue;
      }

      const content = JSON.parse(fileContent);

      // Extraire le contenu à la clé spécifiée
      const extractedContent = getNestedValue(content, key);

      if (extractedContent) {
        // Vérifier si c'est une nouvelle clé ou une mise à jour
        const existingValue = getNestedValue(existingTranslations, key);
        if (!existingValue) {
          addedCount++;
        } else {
          updatedCount++;
        }

        setNestedValue(splitTranslations, key, extractedContent);
        console.log(`  ✅ ${relativePath} → ${key}`);
      }
    } catch (error) {
      console.error(`  ❌ Erreur lors du traitement de ${filePath}: ${error.message}`);
    }
  }

  // 4. Fusionner intelligemment : existant + split
  const finalTranslations = deepMerge(existingTranslations, splitTranslations);

  // 5. Sauvegarder le fichier fusionné
  fs.writeFileSync(outputFile, JSON.stringify(finalTranslations, null, 2), 'utf8');

  console.log(`\n✨ Fichier fusionné créé: ${lang}.json`);
  console.log(`  📊 Statistiques:`);
  console.log(`     🆕 Nouvelles clés ajoutées: ${addedCount}`);
  console.log(`     🔄 Clés mises à jour: ${updatedCount}`);
  console.log(`     💾 Clés préservées: ${Object.keys(existingTranslations).length - updatedCount}`);
}

/**
 * Point d'entrée principal
 */
function main() {
  console.log('🚀 Démarrage de la fusion intelligente des traductions...\n');

  // Créer le répertoire de sortie s'il n'existe pas
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }

  // Fusionner pour chaque langue
  for (const lang of CONFIG.languages) {
    smartMergeTranslations(lang);
  }

  console.log('\n✅ Fusion intelligente terminée avec succès!');
  console.log(`📁 Fichiers générés dans: ${CONFIG.outputDir}\n`);
}

// Exécuter le script
main();

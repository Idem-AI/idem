const fs = require('fs');
const path = require('path');

// Déterminer l'environnement (production ou development)
const isProduction = process.env.NODE_ENV === 'production';
const envFile = isProduction ? '.env' : '.env.development';
const envPath = path.join(__dirname, envFile);

// Charger les variables d'environnement depuis le bon fichier
require('dotenv').config({ path: envPath });

// Vérifier que le fichier .env existe
if (!fs.existsSync(envPath)) {
  console.error(`\n❌ Fichier ${envFile} introuvable!`);
  console.error(`📝 Copiez ${envFile}.example vers ${envFile} et remplissez les valeurs.\n`);
  console.error(`Commandes:`);
  console.error(`  cp ${envFile}.example ${envFile}`);
  console.error(`  nano ${envFile}\n`);
  process.exit(1);
}


// Générer le contenu du fichier environment.ts
const envFileContent = `// ⚠️ FICHIER GÉNÉRÉ AUTOMATIQUEMENT - NE PAS MODIFIER MANUELLEMENT
// Ce fichier est généré depuis ${envFile} par mynode.js
// Pour modifier la configuration, éditez ${envFile} puis relancez: npm run env:${isProduction ? 'prod' : 'dev'}

export const environment = {
  environment: '${isProduction ? 'prod' : 'dev'}',
  isBeta: ${process.env.IS_BETA || 'true'},
  waitlistUrl: '${process.env.WAITLIST_URL || 'https://forms.gle/gP7fr8te9qMUovad6'}',
  analytics: {
    enabled: ${process.env.ANALYTICS_ENABLED || (isProduction ? 'true' : 'false')},
    // Identifiant de mesure Google Analytics 4 (G-XXXXXXX) ; vide = aucun suivi.
    measurementId: '${process.env.GA_MEASUREMENT_ID || ''}',
  },
  services: {
    domain: '${process.env.SERVICES_DOMAIN || 'https://idem.africa'}',
    dashboard: {
      url: '${process.env.SERVICES_DASHBOARD_URL || (isProduction ? 'https://console.idem.africa' : 'http://localhost:4200')}',
    },
    api: {
      url: '${process.env.SERVICES_API_URL || (isProduction ? 'https://api.idem.africa' : 'http://localhost:3001')}',
    },
    idev: {
      url: '${process.env.SERVICES_IDEV_URL || (isProduction ? 'https://appgen.idem.africa' : 'http://localhost:5173')}',
    },
    ideploy: {
      url: '${process.env.SERVICES_IDEPLOY_URL || (isProduction ? 'https://deploy.idem.africa' : 'http://localhost:8000')}',
    },
    simulation: {
      url: '${process.env.SERVICES_SIMULATION_URL || (isProduction ? 'https://simulator.idem.africa' : 'http://localhost:4203')}',
    },
  },
};`;
// trigger ci/cd
// Définir le chemin du dossier
const envDir = path.join(__dirname, './src/environments');

// Vérifier et créer le dossier s'il n'existe pas
if (!fs.existsSync(envDir)) {
  fs.mkdirSync(envDir, { recursive: true });
  console.log(`📁 Created directory: ${envDir}`);
}

// Définir le chemin du fichier de sortie
const targetFileName = isProduction ? 'environment.ts' : 'environment.development.ts';
const targetPath = path.join(envDir, targetFileName);

// Écrire le fichier (toujours écraser pour garantir la synchronisation avec .env)
fs.writeFileSync(targetPath, envFileContent, 'utf8');
console.log(`✅ Fichier ${targetFileName} généré avec succès depuis ${envFile}`);

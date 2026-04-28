const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');

// Charger les variables d'environnement depuis .env
require('dotenv').config({ path: envPath });

// Vérifier que le fichier .env existe
if (!fs.existsSync(envPath)) {
  console.error(`\n❌ Fichier .env introuvable!`);
  console.error(`📝 Copiez .env.example vers .env et remplissez les valeurs.\n`);
  console.error(`Commandes:`);
  console.error(`  cp .env.example .env`);
  console.error(`  nano .env\n`);
  process.exit(1);
}

// Variables requises
const requiredVars = [
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_APP_ID'
];

// Vérifier que toutes les variables requises sont présentes et configurées
const missing = requiredVars.filter(v => !process.env[v] || process.env[v].includes('your_'));
if (missing.length > 0) {
  console.error(`\n❌ Variables d'environnement manquantes ou non configurées:`);
  missing.forEach(v => console.error(`   - ${v}`));
  console.error(`\n📝 Éditez .env et remplacez les valeurs par défaut.\n`);
  process.exit(1);
}

// Générer le contenu du fichier environment.ts
const envFileContent = `// ⚠️ FICHIER GÉNÉRÉ AUTOMATIQUEMENT - NE PAS MODIFIER MANUELLEMENT
// Ce fichier est généré depuis .env par mynode.js
// Pour modifier la configuration, éditez .env puis relancez: npm run env:prod

export const environment = {
  environment: 'prod',
  isBeta: ${process.env.IS_BETA || 'true'},
  waitlistUrl: '${process.env.WAITLIST_URL || 'https://forms.gle/gP7fr8te9qMUovad6'}',
  analytics: {
    enabled: ${process.env.ANALYTICS_ENABLED || 'true'},
  },
  firebase: {
    apiKey: '${process.env.FIREBASE_API_KEY}',
    authDomain: '${process.env.FIREBASE_AUTH_DOMAIN}',
    projectId: '${process.env.FIREBASE_PROJECT_ID}',
    appId: '${process.env.FIREBASE_APP_ID}',
    measurementId: '${process.env.FIREBASE_MEASUREMENT_ID || ''}',
  },
  services: {
    domain: '${process.env.SERVICES_DOMAIN || 'https://idem.africa'}',
    dashboard: {
      url: '${process.env.SERVICES_DASHBOARD_URL || 'https://console.idem.africa'}',
    },
    api: {
      url: '${process.env.SERVICES_API_URL || 'https://api.idem.africa'}',
    },
    idev: {
      url: '${process.env.SERVICES_IDEV_URL || 'https://appgen.idem.africa'}',
    },
    ideploy: {
      url: '${process.env.SERVICES_IDEPLOY_URL || 'https://deploy.idem.africa'}',
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

// Écrire le fichier environment.ts
const targetPath = path.join(envDir, 'environment.ts');
fs.writeFileSync(targetPath, envFileContent, 'utf8');
console.log(`✅ Fichier environment.ts généré avec succès depuis .env`);

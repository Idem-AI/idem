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

// Variables requises
const requiredVars = [
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_STORAGE_BUCKET',
  'FIREBASE_MESSAGING_SENDER_ID',
  'FIREBASE_APP_ID',
  'IDEPLOY_API_TOKEN'
];

// Vérifier que toutes les variables requises sont présentes et configurées
const missing = requiredVars.filter(v => !process.env[v] || process.env[v].includes('your_'));
if (missing.length > 0) {
  console.error(`\n❌ Variables d'environnement manquantes ou non configurées:`);
  missing.forEach(v => console.error(`   - ${v}`));
  console.error(`\n📝 Éditez ${envFile} et remplacez les valeurs par défaut.\n`);
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
  },
  firebase: {
    apiKey: '${process.env.FIREBASE_API_KEY}',
    authDomain: '${process.env.FIREBASE_AUTH_DOMAIN}',
    projectId: '${process.env.FIREBASE_PROJECT_ID}',
    storageBucket: '${process.env.FIREBASE_STORAGE_BUCKET}',
    messagingSenderId: '${process.env.FIREBASE_MESSAGING_SENDER_ID}',
    appId: '${process.env.FIREBASE_APP_ID}',
    measurementId: '${process.env.FIREBASE_MEASUREMENT_ID || ''}',
  },
  services: {
    domain: '${process.env.SERVICES_DOMAIN || 'https://idem.africa'}',
    dashboard: {
      url: '${process.env.SERVICES_DASHBOARD_URL || (isProduction ? 'https://console.idem.africa' : 'http://localhost:4200')}',
    },
    api: {
      url: '${process.env.SERVICES_API_URL || (isProduction ? 'https://api.idem.africa' : 'http://localhost:3001')}',
      version: '${process.env.SERVICES_API_VERSION || 'v1'}',
      llmModel: '${process.env.SERVICES_API_LLM_MODEL || 'gpt-3.5-turbo'}',
    },
    webgen: {
      url: '${process.env.SERVICES_WEBGEN_URL || (isProduction ? 'https://appgen.idem.africa' : 'http://localhost:5173')}',
    },
    diagen: {
      url: '${process.env.SERVICES_DIAGEN_URL || (isProduction ? 'http://chart.idem.africa' : 'http://localhost:3002')}',
    },
    ideploy: {
      url: '${process.env.SERVICES_IDEPLOY_URL || (isProduction ? 'https://ideploy.idem.africa' : 'http://localhost:8000')}',
      apiToken: '${process.env.IDEPLOY_API_TOKEN}',
    },
  },
};
`;

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

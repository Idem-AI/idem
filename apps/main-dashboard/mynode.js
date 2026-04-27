const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Déterminer l'environnement
const NODE_ENV = process.env.NODE_ENV || 'production';
const isProduction = NODE_ENV === 'production';

// Fichiers possibles (ordre de priorité)
const envFiles = isProduction
  ? ['.env', '.env.production']
  : ['.env.development', '.env'];

// Trouver le premier fichier existant
let envPath = null;

for (const file of envFiles) {
  const fullPath = path.join(__dirname, file);
  if (fs.existsSync(fullPath)) {
    envPath = fullPath;
    break;
  }
}

// Charger le fichier s’il existe
if (envPath) {
  dotenv.config({ path: envPath });
  console.log(`✅ Chargement des variables depuis ${envPath}`);
} else {
  console.warn(`⚠️ Aucun fichier .env trouvé, utilisation des variables système`);
}

// Variables requises
const requiredVars = [
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_APP_ID',
  'IDEPLOY_API_TOKEN'
];

// Vérification intelligente (ne casse pas en CI si variables injectées)
const missing = requiredVars.filter(
  v => !process.env[v] || process.env[v].includes('your_')
);

if (missing.length > 0) {
  console.error(`\n❌ Variables d'environnement manquantes:`);
  missing.forEach(v => console.error(`   - ${v}`));

  if (!isProduction) {
    console.error(`\n📝 Mode dev: configure ton .env\n`);
    process.exit(1);
  } else {
    console.warn(`⚠️ Mode production: on continue (variables potentiellement injectées ailleurs)`);
  }
}

// Génération du fichier Angular
const envFileContent = `// ⚠️ AUTO-GENERATED FILE
export const environment = {
  environment: '${isProduction ? 'prod' : 'dev'}',
  isBeta: ${process.env.IS_BETA || 'true'},
  waitlistUrl: '${process.env.WAITLIST_URL || 'https://forms.gle/your_waitlist_form_id'}',
  analytics: {
    enabled: ${process.env.ANALYTICS_ENABLED || (isProduction ? 'true' : 'false')},
  },
  firebase: {
    apiKey: '${process.env.FIREBASE_API_KEY || ''}',
    authDomain: '${process.env.FIREBASE_AUTH_DOMAIN || ''}',
    projectId: '${process.env.FIREBASE_PROJECT_ID || ''}',
    appId: '${process.env.FIREBASE_APP_ID || ''}',
    measurementId: '${process.env.FIREBASE_MEASUREMENT_ID || ''}',
  },
  services: {
    domain: '${process.env.SERVICES_DOMAIN || 'https://idem.africa'}',
    api: {
      url: '${process.env.SERVICES_API_URL || (isProduction ? 'https://api.idem.africa' : 'http://localhost:3001')}',
    },
    ideploy: {
      url: '${process.env.SERVICES_IDEPLOY_URL || (isProduction ? 'https://ideploy.idem.africa' : 'http://localhost:8000')}',
      apiToken: '${process.env.IDEPLOY_API_TOKEN || ''}',
    },
    webgen: {
      url: '${process.env.SERVICES_WEBGEN_URL || (isProduction ? 'https://webgen.idem.africa' : 'http://localhost:5173')}',
    },
    diagen: {
      url: '${process.env.SERVICES_DIAGEN_URL || (isProduction ? 'https://diagen.idem.africa' : 'http://localhost:5174')}',
    },
  },
};
`;

const envDir = path.join(__dirname, './src/environments');

if (!fs.existsSync(envDir)) {
  fs.mkdirSync(envDir, { recursive: true });
}

const targetFileName = isProduction
  ? 'environment.ts'
  : 'environment.development.ts';

const targetPath = path.join(envDir, targetFileName);

fs.writeFileSync(targetPath, envFileContent, 'utf8');

console.log(`✅ ${targetFileName} généré (${NODE_ENV})`);

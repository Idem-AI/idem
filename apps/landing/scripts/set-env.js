const fs = require('fs');
const path = require('path');

// Charger les variables d'environnement depuis .env ou .env.development
const envFile = process.env.NODE_ENV === 'production' ? '.env' : '.env.development';
const envPath = path.join(__dirname, '..', envFile);

if (!fs.existsSync(envPath)) {
  console.error(`❌ Fichier ${envFile} introuvable!`);
  console.error(`📝 Copiez ${envFile}.example vers ${envFile} et remplissez les valeurs.`);
  process.exit(1);
}

// Parser le fichier .env manuellement
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const [key, ...valueParts] = trimmed.split('=');
    if (key && valueParts.length > 0) {
      env[key.trim()] = valueParts.join('=').trim();
    }
  }
});


// Générer le fichier environment.ts
const isProduction = process.env.NODE_ENV === 'production';
const targetFile = isProduction
  ? path.join(__dirname, '..', 'src', 'environments', 'environment.ts')
  : path.join(__dirname, '..', 'src', 'environments', 'environment.development.ts');

const environmentContent = `// ⚠️ FICHIER GÉNÉRÉ AUTOMATIQUEMENT - NE PAS MODIFIER MANUELLEMENT
// Ce fichier est généré depuis ${envFile} par scripts/set-env.js

export const environment = {
  environment: '${isProduction ? 'prod' : 'dev'}',
  isBeta: ${env.IS_BETA || 'true'},
  waitlistUrl: '${env.WAITLIST_URL || 'https://forms.gle/gP7fr8te9qMUovad6'}',
  analytics: {
    enabled: ${env.ANALYTICS_ENABLED || (isProduction ? 'true' : 'false')},
    // Identifiant de mesure Google Analytics 4 (G-XXXXXXX) ; vide = aucun suivi.
    measurementId: '${env.GA_MEASUREMENT_ID || ''}',
  },
  services: {
    domain: '${env.SERVICES_DOMAIN || 'https://idem.africa'}',
    dashboard: {
      url: '${env.SERVICES_DASHBOARD_URL || (isProduction ? 'https://console.idem.africa' : 'http://localhost:4200')}',
    },
    api: {
      url: '${env.SERVICES_API_URL || (isProduction ? 'https://api.idem.africa' : 'http://localhost:3001')}',
      version: 'v1',
      llmModel: 'gpt-3.5-turbo',
    },
    webgen: {
      url: '${isProduction ? 'https://appgen.idem.africa' : 'http://localhost:5173'}',
    },
    idev: {
      url: '${isProduction ? 'https://appgen.idem.africa' : 'http://localhost:5173'}',
    },
    ideploy: {
      url: '${isProduction ? 'https://deploy.idem.africa' : 'http://localhost:8000'}',
    },
    diagen: {
      url: '${isProduction ? 'http://chart.idem.africa' : 'http://localhost:3002'}',
    },
  },
};
`;

// Créer le dossier environments s'il n'existe pas
const envDir = path.dirname(targetFile);
if (!fs.existsSync(envDir)) {
  fs.mkdirSync(envDir, { recursive: true });
}

// Écrire le fichier
fs.writeFileSync(targetFile, environmentContent, 'utf8');
console.log(`✅ Fichier ${path.basename(targetFile)} généré avec succès depuis ${envFile}`);

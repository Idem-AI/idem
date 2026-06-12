const fs = require('fs');
const path = require('path');

// Load .env — try app root first, fall back to src/.env (legacy), then Docker env vars
const envPaths = [
  path.join(__dirname, '.env'),
  path.join(__dirname, 'src/.env'),
];
for (const p of envPaths) {
  if (fs.existsSync(p)) {
    require('dotenv').config({ path: p });
    break;
  }
}

const isProduction = process.env.NODE_ENV === 'production';

const envFileContent = `// ⚠️ FICHIER GÉNÉRÉ AUTOMATIQUEMENT - NE PAS MODIFIER MANUELLEMENT
// Généré par mynode.js — pour modifier, éditez .env puis relancez: node mynode.js

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
    storageBucket: '${process.env.FIREBASE_STORAGE_BUCKET || ''}',
    messagingSenderId: '${process.env.FIREBASE_MESSAGING_SENDER_ID || ''}',
    appId: '${process.env.FIREBASE_APP_ID || ''}',
    measurementId: '${process.env.FIREBASE_MEASUREMENT_ID || ''}',
  },
  services: {
    domain: '${process.env.SERVICES_DOMAIN || 'https://idem.africa'}',
    api: {
      url: '${process.env.SERVICES_API_URL || process.env.API_URL || (isProduction ? 'https://api.idem.africa' : 'http://localhost:3010')}',
      version: '${process.env.API_VERSION || 'v1'}',
      llmModel: '${process.env.API_LLM_MODEL || ''}',
    },
    ideploy: {
      url: '${process.env.SERVICES_IDEPLOY_URL || (isProduction ? 'https://ideploy.idem.africa' : 'http://localhost:8000')}',
      apiToken: '${process.env.IDEPLOY_API_TOKEN || ''}',
    },
    webgen: {
      url: '${process.env.SERVICES_WEBGEN_URL || process.env.WEBGEN_URL || (isProduction ? 'https://webgen.idem.africa' : 'http://localhost:3003')}',
    },
    diagen: {
      url: '${process.env.SERVICES_DIAGEN_URL || process.env.DIAGEN_URL || (isProduction ? 'https://diagen.idem.africa' : 'http://localhost:3004')}',

    },
  },
};
`;

const envDir = path.join(__dirname, './src/environments');

if (!fs.existsSync(envDir)) {
  fs.mkdirSync(envDir, { recursive: true });
  console.log(`📁 Created directory: ${envDir}`);
}

// Always overwrite — never skip if file already exists
fs.writeFileSync(path.join(envDir, 'environment.ts'), envFileContent, 'utf8');
console.log('✅ environment.ts generated');

if (!isProduction) {
  fs.writeFileSync(path.join(envDir, 'environment.development.ts'), envFileContent, 'utf8');
  console.log('✅ environment.development.ts generated');
}

const fs = require('fs');
const path = require('path');

// Load .env — app root first, then the shared docker/CI environment variables.
const envPaths = [path.join(__dirname, '.env'), path.join(__dirname, 'src/.env')];
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
  /** Serve the built-in demo dataset instead of calling the simulation API. */
  useMockData: ${process.env.USE_MOCK_DATA || (isProduction ? 'false' : 'true')},
  defaultLanguage: '${process.env.DEFAULT_LANGUAGE || 'fr'}',
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
    self: {
      url: '${process.env.SERVICES_SIMULATION_URL || (isProduction ? 'https://simulation.idem.africa' : 'http://localhost:4203')}',
    },
    api: {
      url: '${process.env.SERVICES_API_URL || process.env.API_URL || (isProduction ? 'https://api.idem.africa' : 'http://localhost:3010')}',
    },
    dashboard: {
      url: '${process.env.SERVICES_DASHBOARD_URL || (isProduction ? 'https://console.idem.africa' : 'http://localhost:4200')}',
    },
    landing: {
      url: '${process.env.SERVICES_LANDING_URL || (isProduction ? 'https://idem.africa' : 'http://localhost:4201')}',
    },
  },
};
`;

const envDir = path.join(__dirname, './src/environments');

if (!fs.existsSync(envDir)) {
  fs.mkdirSync(envDir, { recursive: true });
  console.log(`📁 Created directory: ${envDir}`);
}

fs.writeFileSync(path.join(envDir, 'environment.ts'), envFileContent, 'utf8');
console.log('✅ environment.ts generated');

if (!isProduction) {
  fs.writeFileSync(path.join(envDir, 'environment.development.ts'), envFileContent, 'utf8');
  console.log('✅ environment.development.ts generated');
}

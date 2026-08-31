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

// Bêta produit : les tarifs restent affichés mais barrés, et les exécutions
// sont annoncées gratuites. Normalisé ici plutôt qu'interpolé brut — une
// valeur autre que true/false produirait un environment.ts qui ne compile pas.
const isBeta = "true";

const envFileContent = `// ⚠️ FICHIER GÉNÉRÉ AUTOMATIQUEMENT - NE PAS MODIFIER MANUELLEMENT
// Généré par mynode.js — pour modifier, éditez .env puis relancez: node mynode.js

export const environment = {
  environment: '${isProduction ? 'prod' : 'dev'}',
  /** Bêta produit : la tarification est affichée barrée, les runs sont gratuits. */
  isBeta: ${isBeta},
  defaultLanguage: '${process.env.DEFAULT_LANGUAGE || 'fr'}',
  analytics: {
    enabled: ${process.env.ANALYTICS_ENABLED || (isProduction ? 'true' : 'false')},
  },
  services: {
    domain: '${process.env.SERVICES_DOMAIN || 'https://idem.africa'}',
    self: {
      url: '${process.env.SERVICES_SIMULATION_URL || (isProduction ? 'https://simulation.idem.africa' : 'http://localhost:4203')}',
    },
    api: {
      url: '${process.env.SERVICES_API_URL || process.env.API_URL || (isProduction ? 'https://api.idem.africa' : 'http://localhost:3001')}',
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

// Écrit src/environments/environment.ts (dev) ou environment.prod.ts (production, choisi par
// les `fileReplacements` d'angular.json) depuis process.env. Le dossier est ignoré par git
// (**/src/environments/**) : ce script est la seule façon reproductible de construire l'app.
const fs = require('fs');
const path = require('path');

const isProduction = process.env.NODE_ENV === 'production';

/** Lignes `CLÉ=valeur` d'un fichier, sans écraser ce que l'environnement fixe déjà. */
function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = /^\s*([\w.-]+)\s*=\s*(.*)?\s*$/.exec(line);
    if (match && !(match[1] in process.env)) process.env[match[1]] = (match[2] || '').replace(/^["']|["']$/g, '');
  }
}

loadEnvFile(path.join(__dirname, '../.env'));

// Pas de domaine deviné en production : une build qui parlerait au mauvais serveur serait pire qu'un échec.
const requiredInProd = ['IVISION_API_URL', 'SERVICES_API_URL', 'SERVICES_DASHBOARD_URL'];
if (isProduction) {
  const missing = requiredInProd.filter((v) => !process.env[v]);
  if (missing.length) {
    console.error(`\n❌ Variables manquantes pour une build de production :\n${missing.map((v) => `   - ${v}`).join('\n')}\n`);
    process.exit(1);
  }
}

const content = `// GÉNÉRÉ par scripts/set-env.js — ne pas modifier à la main.
// Régénérer : npm run ${isProduction ? 'env:prod' : 'env:dev'}

export const environment = {
  production: ${isProduction},
  /** L'API iVision (conversation, marques, vidéos, visuels). */
  api: { url: '${process.env.IVISION_API_URL || 'http://localhost:3006'}' },
  services: {
    /** L'API IDEM : identité (cookie de session partagé). */
    api: { url: '${process.env.SERVICES_API_URL || 'http://localhost:3001'}' },
    /** Le tableau de bord IDEM : connexion, crédits, projets. */
    dashboard: { url: '${process.env.SERVICES_DASHBOARD_URL || 'http://localhost:4200'}' },
    landing: { url: '${process.env.SERVICES_LANDING_URL || 'https://idem.africa'}' },
  },
};
`;

const outDir = path.join(__dirname, '../src/environments');
fs.mkdirSync(outDir, { recursive: true });
// Le même contenu dans les deux fichiers : esbuild résout d'abord environment.ts, qui doit exister.
const outFiles = isProduction ? ['environment.prod.ts', 'environment.ts'] : ['environment.ts'];
for (const name of outFiles) fs.writeFileSync(path.join(outDir, name), content);
console.log(`✅ ${outFiles.map((f) => path.relative(process.cwd(), path.join(outDir, f))).join(', ')}`);

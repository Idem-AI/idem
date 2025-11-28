#!/usr/bin/env node

/**
 * Script post-install pour main-dashboard
 * Copie automatiquement les assets ngx-extended-pdf-viewer après npm install
 * Utilisé aussi dans le Dockerfile pour la production
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 Post-install main-dashboard...');

// Vérifier si nous sommes dans le bon contexte
const isInMainDashboard = process.cwd().includes('main-dashboard');
const rootPath = isInMainDashboard ? '../..' : '.';

// Chemins
const nodeModulesPath = path.join(rootPath, 'node_modules/ngx-extended-pdf-viewer/assets');
const targetPath = path.join(isInMainDashboard ? '.' : 'apps/main-dashboard', 'src/assets/ngx-extended-pdf-viewer');

try {
  // Vérifier si les assets source existent
  if (!fs.existsSync(nodeModulesPath)) {
    console.log('⚠️  Assets ngx-extended-pdf-viewer non trouvés, ignoré');
    process.exit(0);
  }

  // Créer le dossier de destination
  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true });
  }

  // Copier les assets
  console.log('📦 Copie des assets ngx-extended-pdf-viewer...');

  if (process.platform === 'win32') {
    execSync(`xcopy "${nodeModulesPath}" "${targetPath}" /E /I /Y`, { stdio: 'inherit' });
  } else {
    // Utiliser rsync si disponible, sinon cp avec gestion d'erreurs
    try {
      execSync(`rsync -av "${nodeModulesPath}/" "${targetPath}/" 2>/dev/null`, { stdio: 'pipe' });
    } catch (rsyncError) {
      // Fallback sur cp avec suppression des erreurs de permissions
      execSync(`cp -r "${nodeModulesPath}"/* "${targetPath}/" 2>/dev/null || true`, { stdio: 'pipe' });
    }
  }

  console.log('✅ Assets ngx-extended-pdf-viewer copiés avec succès');

} catch (error) {
  console.error('❌ Erreur lors de la copie des assets:', error.message);
  // Ne pas faire échouer l'installation pour autant
  process.exit(0);
}

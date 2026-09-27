/**
 * Point d'entrée du serveur AppGen : secrets d'abord, serveur ensuite.
 *
 * Les clients des modèles et la configuration lisent `process.env` au chargement
 * de leur module. Un `import` statique de `server.js` serait exécuté AVANT tout
 * code de ce fichier (les imports ESM sont hissés) : le serveur est donc chargé
 * dynamiquement, une fois les secrets injectés.
 */
import 'dotenv/config';
import { loadSecretsFromManager } from './config/secret-loader.js';
import { SECRET_MANIFEST } from './config/secrets.manifest.js';

try {
  await loadSecretsFromManager(SECRET_MANIFEST);
  await import('./server.js');
} catch (error) {
  console.error('AppGen server bootstrap failed:', (error as Error).message);
  process.exit(1);
}

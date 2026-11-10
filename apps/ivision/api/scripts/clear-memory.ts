/**
 * Efface la mémoire des idées d'iVision (MongoDB `graphic_memory`) — `npm run clear:memory [-- --scope <texte>]`.
 * Sans `--scope`, toute la mémoire ; avec, seulement les portées dont la clé contient ce texte (utilisateur, projet, secteur).
 */
import { collection, connectDatabase } from '../src/config/db';

async function main() {
  await connectDatabase();
  const scope = process.argv.includes('--scope') ? process.argv[process.argv.indexOf('--scope') + 1] : '';
  const filter = scope ? { _id: { $regex: scope.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') } } : {};
  const { deletedCount } = await collection<{ _id: string }>('graphic_memory').deleteMany(filter as never);
  console.log(`${deletedCount} portée(s) de mémoire effacée(s)${scope ? ` (« ${scope} »)` : ''}`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

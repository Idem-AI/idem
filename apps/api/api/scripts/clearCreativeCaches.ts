/**
 * Vide les caches de la génération créative — `npm run cache:clear -- [--all | --memory --images --context --language --fonts] [--scope <texte>]`.
 *
 *   --memory    la mémoire des idées déjà servies (portées projet, utilisateur, secteur)
 *   --images    les rendus PNG des visuels (24 h)
 *   --context   le contexte et la stratégie de Communication, les recherches (30 j)
 *   --language  le langage visuel des marques
 *   --fonts     les fichiers de polices
 *   --scope     ne retire que les clés qui contiennent ce texte (un identifiant de projet ou d'utilisateur, un secteur)
 *
 * Rien d'autre n'est touché : ni les files de déploiement, ni les commandes de domaines. La mémoire d'iVision est dans
 * MongoDB (`graphic_memory`) : `npm run clear:memory --prefix apps/ivision/api`.
 */
import RedisConnection from '../config/redis.config';
import { cacheService } from '../services/cache.service';

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`) || args.includes('--all');
const scope = args.includes('--scope') ? args[args.indexOf('--scope') + 1] : '';

const TARGETS: Array<{ flag: string; label: string; pattern: string }> = [
  { flag: 'memory', label: 'mémoire des idées', pattern: 'graphic:graphic-fingerprints:*' },
  { flag: 'images', label: 'rendus des visuels', pattern: 'flyer:*' },
  { flag: 'context', label: 'contexte, stratégie, recherches', pattern: 'ai:*' },
  { flag: 'language', label: 'langage visuel des marques', pattern: 'graphic:brand-language:*' },
  { flag: 'fonts', label: 'fichiers de polices', pattern: 'font-file-v2:*' },
];

async function main() {
  const chosen = TARGETS.filter((t) => flag(t.flag));
  if (!chosen.length) {
    console.log('Rien à vider : indiquez --all ou --memory --images --context --language --fonts (voir l’en-tête du script).');
    return;
  }
  for (const target of chosen) {
    const pattern = scope ? `${target.pattern.replace(/\*$/, '')}*${scope}*` : target.pattern;
    const deleted = await cacheService.deletePattern(pattern);
    console.log(`${target.label} : ${deleted} clé(s) retirée(s) (${pattern})`);
  }
  await RedisConnection.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

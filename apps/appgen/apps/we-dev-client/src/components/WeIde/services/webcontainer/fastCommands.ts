/**
 * LE CHEMIN RAPIDE DES COMMANDES — ce qu'une génération demande d'exécuter, fait sans npm quand c'est possible.
 *
 * Le modèle (et le moteur de sites) écrit `npm install` puis `npm run dev` à la fin d'une génération, par
 * habitude. Exécutées telles quelles, ces deux lignes coûtaient l'essentiel du démarrage : trois minutes
 * d'installation pour un `node_modules` souvent déjà en place, puis un second serveur alors qu'un premier
 * tournait. Ici, chaque morceau d'une commande (`a && b`) est d'abord interprété :
 *
 *   npm install / npm i / npm ci     les arbres de la cible mis en place par cache, instantané ou arbre voisin
 *                                    complété (`ensureDependencies`) ; npm seulement en dernier recours
 *   npm install <paquets>            rien à faire si chaque paquet est déjà dans `node_modules`
 *   npm run dev / npm start          rien à faire si l'aperçu tourne ; sinon dépendances puis démarrage
 *   cd <dossier>                     suivi, pour les commandes du même morceau
 *
 * Ce qui n'est pas reconnu (un vrai paquet nouveau, un script) repart vers le terminal, tel qu'écrit, à partir
 * du premier morceau non traité. Rien n'est jamais sauté sans preuve que c'est inutile.
 */
import { depsTarget } from '@/components/AiChat/utils/warmStart';
import useWarmStart from '@/stores/warmStartSlice';
import { startupBegin, startupPhase, startupSource } from '@/utils/startupTimer';
import { ensureDependencies } from './deps';
import { getLastServerUrl, getWebContainerInstance } from './instance';
import { startCommand } from './runner';

const INSTALL_ALL = /^(?:npm|pnpm|yarn)(?:\s+(?:install|i|ci))?(?:\s+--?[\w-]+(?:=\S+)?)*$/;
const INSTALL_SOME = /^(?:npm\s+(?:install|i|add)|pnpm\s+add|yarn\s+add)\s+(.+)$/;
const START = /^(?:npm|pnpm|yarn)\s+(?:run\s+)?(?:dev|start)$/;
const CD = /^cd\s+([\w./-]+)$/;

/** `@scope/nom@1.2.3` → `@scope/nom` ; les options (`-D`, `--save-dev`) ne sont pas des paquets. */
function packageNames(args: string): string[] {
  return args
    .split(/\s+/)
    .filter((word) => word && !word.startsWith('-'))
    .map((word) => (word.startsWith('@') ? `@${word.slice(1).split('@')[0]}` : word.split('@')[0]))
    .filter(Boolean);
}

async function installed(cwd: string, names: string[]): Promise<boolean> {
  const container = await getWebContainerInstance();
  if (!container || !names.length) return false;
  for (const name of names) {
    try {
      await container.fs.readFile(`${cwd ? `${cwd}/` : ''}node_modules/${name}/package.json`, 'utf-8');
    } catch {
      return false;
    }
  }
  return true;
}

/** Les dépendances de la cible, par le chemin rapide. Faux si la cible est inconnue ou si rien n'a abouti. */
async function ensureAll(trigger: string): Promise<boolean> {
  const target = depsTarget();
  if (!target) return false;
  startupBegin(trigger, target);
  useWarmStart.getState().begin(target);
  const started = performance.now();
  const outcomes = await ensureDependencies(target, (progress) => useWarmStart.getState().progress(progress));
  startupPhase('dependencies', performance.now() - started);
  outcomes.forEach((outcome) => startupSource(outcome.source));
  if (outcomes.some((outcome) => outcome.source === 'failed')) {
    useWarmStart.getState().fail('deps');
    return false;
  }
  return true;
}

/**
 * Exécute ce qui peut l'être par le chemin rapide. Rend ce qui reste à confier au terminal (`''` : tout est
 * fait). Une erreur rend la commande entière, inchangée : le chemin rapide ne doit jamais faire perdre une
 * commande.
 */
export async function runFast(command: string): Promise<string> {
  const parts = command
    .split('&&')
    .map((part) => part.trim())
    .filter(Boolean);
  let cwd = '';
  try {
    for (let index = 0; index < parts.length; index++) {
      const part = parts[index];
      const rest = () => parts.slice(index).join(' && ');
      const cd = part.match(CD);
      if (cd) {
        cwd = cd[1].replace(/^\.\//, '').replace(/\/$/, '');
        continue;
      }
      if (INSTALL_ALL.test(part)) {
        // `npm install` dans un sous-dossier ou à la racine : tous les arbres de la cible sont vérifiés ensemble.
        if (await ensureAll('generation')) continue;
        return rest();
      }
      const some = part.match(INSTALL_SOME);
      if (some) {
        if (await installed(cwd, packageNames(some[1]))) continue;
        return rest();
      }
      if (START.test(part)) {
        if (getLastServerUrl()) continue;
        if (!(await ensureAll('generation'))) return rest();
        const started = performance.now();
        await startCommand(cwd ? `cd ${cwd} && ${part}` : part);
        startupPhase('spawn', performance.now() - started);
        continue;
      }
      return rest();
    }
    return '';
  } catch (error) {
    console.warn('[rapide] repli sur le terminal :', command, error);
    return command;
  }
}

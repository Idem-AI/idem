/**
 * Lancer une commande sans attendre qu'un terminal existe.
 *
 * Jusqu'ici toute commande passait par le terminal xterm (`weTerminal`), et
 * deux délais en découlaient :
 *
 * 1. l'installation anticipée sondait l'apparition du terminal toutes les
 *    500 ms, jusqu'à vingt secondes. Vingt secondes où le conteneur était prêt
 *    et où rien ne se passait ;
 * 2. une commande arrivée avant le montage du terminal était simplement
 *    perdue — « aucun terminal, commande ignorée » — et l'aperçu restait vide
 *    sans explication.
 *
 * Or le terminal n'est qu'un affichage : `executeCommand` fait un
 * `container.spawn('jsh', ['-c', …])`, qui ne dépend de rien d'autre que du
 * conteneur. Ce module lance donc directement, alimente l'état d'exécution
 * (`runStatus`, qui porte les erreurs et les phases montrées à l'utilisateur)
 * et recopie la sortie dans le terminal **s'il existe**. La sortie émise avant
 * qu'un terminal apparaisse est gardée puis rejouée, pour qu'on retrouve le
 * journal complet en ouvrant le terminal.
 */

import useRunStatus from '@/stores/runStatusSlice';
import useTerminalStore from '@/stores/terminalSlice';
import { getWebContainerInstance } from './instance';

export interface RunResult {
  exitCode: number;
  output: string;
  /** Arrêtée parce qu'elle dépassait `timeoutMs`. */
  timedOut?: boolean;
}

/** Journal des commandes lancées sans terminal, rejoué au premier terminal ouvert. */
const backlog: string[] = [];
const MAX_BACKLOG_CHARS = 200_000;

let replayed = false;

/** Écrit dans le terminal 0 s'il est là, et garde de côté sinon. */
function mirror(chunk: string): void {
  const terminal = useTerminalStore.getState().getTerminal(0);

  if (terminal) {
    if (!replayed && backlog.length) {
      replayed = true;
      for (const held of backlog) terminal.write(held);
      backlog.length = 0;
    }
    terminal.write(chunk);
    return;
  }

  backlog.push(chunk);
  let held = backlog.reduce((sum, entry) => sum + entry.length, 0);
  while (held > MAX_BACKLOG_CHARS && backlog.length > 1) {
    held -= backlog.shift()?.length ?? 0;
  }
}

/** Remet le journal à zéro quand l'espace de travail repart de zéro. */
export function resetRunner(): void {
  backlog.length = 0;
  replayed = false;
  running.clear();
  alive.clear();
}

/** Serveurs lancés et toujours vivants, par commande complète (et de quoi les arrêter). */
const alive = new Map<string, { kill: () => void } | null>();

/**
 * Arrête les serveurs lancés par l'atelier : la cible change (une application devient un site), l'ancien
 * serveur tiendrait le port avec la mauvaise configuration.
 */
export function stopStarted(): void {
  alive.forEach((process) => {
    try {
      process?.kill();
    } catch {
      /* déjà arrêté */
    }
  });
  alive.clear();
}

/** Commandes en cours, pour ne pas lancer deux fois la même. */
const running = new Map<string, Promise<RunResult>>();

/**
 * Lance une commande dans l'espace de travail et attend sa fin.
 *
 * `cwd` est relatif à la racine de l'espace de travail (`frontend`, `backend`).
 * Une commande identique déjà en cours n'est pas relancée : deux `npm install`
 * en parallèle laissent un `node_modules` à moitié lié — npm s'arrête sur
 * « EIO: failed to link packages » — et c'est une panne qu'on a déjà payée.
 */
export async function runCommand(
  command: string,
  options: { cwd?: string; quiet?: boolean; timeoutMs?: number } = {}
): Promise<RunResult> {
  const key = `${options.cwd ?? ''}$${command}`;
  const inflight = running.get(key);
  if (inflight) return inflight;

  const task = (async (): Promise<RunResult> => {
    const container = await getWebContainerInstance();
    if (!container) return { exitCode: -1, output: '' };

    if (!options.quiet) useRunStatus.getState().commandStarted(command);

    const full = options.cwd ? `cd ${options.cwd} && ${command}` : command;
    let output = '';

    try {
      const process = await container.spawn('jsh', ['-c', full], {
        env: { npm_config_yes: true },
      });

      const piping = process.output.pipeTo(
        new WritableStream({
          write: (data) => {
            output += data;
            mirror(data);
            if (!options.quiet) useRunStatus.getState().feed(data);
          },
        })
      ).catch(() => undefined);

      // Le délai, s'il y en a un : la commande est arrêtée et l'appelant le sait, au lieu d'attendre sans fin.
      let timer: ReturnType<typeof setTimeout> | undefined;
      const late = options.timeoutMs
        ? new Promise<'late'>((resolve) => (timer = setTimeout(() => resolve('late'), options.timeoutMs)))
        : null;
      const exitCode = await (late ? Promise.race([process.exit, late]) : process.exit);
      clearTimeout(timer);
      if (exitCode === 'late') {
        console.warn(`[run] ${full} arrêtée après ${Math.round((options.timeoutMs ?? 0) / 60_000)} min`);
        try {
          process.kill();
        } catch {
          /* déjà arrêtée */
        }
        if (!options.quiet) useRunStatus.getState().commandExited(command, -1);
        return { exitCode: -1, output, timedOut: true };
      }
      await piping;
      if (!options.quiet) useRunStatus.getState().commandExited(command, exitCode);
      return { exitCode, output };
    } catch (error) {
      console.warn('[run] échec de', full, error);
      return { exitCode: -1, output };
    }
  })();

  running.set(key, task);
  try {
    return await task;
  } finally {
    running.delete(key);
  }
}

/**
 * Lance une commande sans attendre sa fin : pour un serveur de développement,
 * qui ne rend jamais la main. L'état « prêt » se lit sur `server-ready`, pas sur
 * la sortie du processus.
 */
export async function startCommand(
  command: string,
  options: { cwd?: string; retried?: boolean } = {}
): Promise<void> {
  const retried = !!options.retried;
  let output = '';
  const container = await getWebContainerInstance();
  if (!container) return;

  const full = options.cwd ? `cd ${options.cwd} && ${command}` : command;
  // Un serveur déjà lancé par la même commande et toujours vivant : pas de second (Vite prendrait un autre port,
  // et l'aperçu montrerait l'un ou l'autre au hasard). Le démarrage à chaud et le filet de fin de génération
  // peuvent le demander presque en même temps.
  if (alive.has(full)) return;
  alive.set(full, null);
  useRunStatus.getState().commandStarted(command);

  try {
    const process = await container.spawn('jsh', ['-c', full], {
      env: { npm_config_yes: true },
    });
    alive.set(full, process);

    const piping = process.output.pipeTo(
      new WritableStream({
        write: (data) => {
          if (output.length < 20_000) output += data;
          mirror(data);
          useRunStatus.getState().feed(data);
        },
      })
    ).catch(() => undefined);

    // La sortie du serveur qui s'arrête est une erreur, pas un succès : elle
    // doit remonter, sinon l'aperçu reste vide sans rien dans l'interface.
    // Un programme sans droit d'exécution (arbre remonté d'un instantané, voir
    // `repairExecBits`) se répare, et le serveur repart une fois de lui-même.
    void process.exit.then(async (exitCode) => {
      alive.delete(full);
      // La sortie peut finir d'arriver après la fin du processus : on la lit en entier avant de juger.
      await Promise.race([piping, new Promise((resolve) => setTimeout(resolve, 1500))]);
      if (!retried && /spawn \S+ EACCES/.test(output)) {
        const fixed = await repairExecBits(['node_modules', 'frontend/node_modules', 'backend/node_modules']);
        console.warn(`[run] ${fixed} programme(s) rendus exécutables, nouveau démarrage :`, full);
        if (fixed) return void startCommand(command, { ...options, retried: true });
      }
      if (exitCode !== 0) useRunStatus.getState().commandExited(command, exitCode);
    });
  } catch (error) {
    alive.delete(full);
    console.warn('[run] démarrage impossible :', full, error);
  }
}

/**
 * Rend leur droit d'exécution aux programmes des arbres (`<arbre>/.bin/*` et leurs cibles). Un `node_modules`
 * exporté puis remonté perd le mode de ses fichiers : le serveur de développement mourait aussitôt sur
 * « jsh: spawn vite EACCES », et l'aperçu restait sur « Démarrage » sans fin. Moins d'une seconde.
 */
// « require » écrit en deux morceaux : un module Vite de l'atelier réécrit tout appel à require avec un nom de
// module qu'il trouve, même dans une chaîne, et le script arrivait abîmé dans le conteneur (rien n'était réparé).
const REQUIRE = ['req', 'uire'].join('');
const EXEC_FIX =
  `const fs=${REQUIRE}('fs'),path=${REQUIRE}('path');let n=0;` +
  "for(const root of process.argv.slice(1)){const bin=path.join(root,'.bin');let names=[];try{names=fs.readdirSync(bin)}catch{continue}for(const name of names){try{const real=fs.realpathSync(path.join(bin,name));const mode=fs.statSync(real).mode;if((mode&0o111)!==0o111){fs.chmodSync(real,mode|0o755);n++}}catch{}}}console.log(n)";

export async function repairExecBits(mountPoints: string[]): Promise<number> {
  const result = await runCommand(`node -e "${EXEC_FIX}" ${mountPoints.join(' ')}`, { quiet: true, timeoutMs: 60_000 });
  if (result.exitCode !== 0) console.warn("[run] droits d'exécution non rétablis", result.output);
  return Number(result.output.replace(/\x1b\[[0-9;]*m/g, '').trim()) || 0;
}

/** Y a-t-il un fichier à ce chemin dans l'espace de travail ? */
export async function exists(path: string): Promise<boolean> {
  const container = await getWebContainerInstance();
  if (!container) return false;
  try {
    await container.fs.readFile(path, 'utf-8');
    return true;
  } catch {
    return false;
  }
}

/** Lit un fichier de l'espace de travail, ou `null`. */
export async function readWorkspaceFile(path: string): Promise<string | null> {
  const container = await getWebContainerInstance();
  if (!container) return null;
  try {
    return await container.fs.readFile(path, 'utf-8');
  } catch {
    return null;
  }
}

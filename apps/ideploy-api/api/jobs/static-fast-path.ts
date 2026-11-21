/**
 * Mise en ligne express d'un site DÉJÀ construit — ce qu'iCode envoie.
 *
 * Le chemin général construit une image par déploiement (`FROM nginx:alpine` +
 * `COPY dist`), la fait tourner à côté de la version en ligne (≥ 12 s),
 * remplace le conteneur, attend qu'il « tienne » (12 s + 15 s) et cherche son
 * port (jusqu'à 30 s). Pour des fichiers déjà prêts, tout cela ne protège rien :
 * il n'y a ni build qui puisse échouer, ni programme qui puisse planter.
 *
 * Ici le conteneur nginx est créé UNE fois, avec le dossier du site monté :
 *
 *   <workdir>/static/releases/<id>/html   une version (les fichiers reçus)
 *   <workdir>/static/current → releases/<id>   la version servie
 *   <workdir>/static/conf/default.conf     la configuration nginx
 *
 * Publier = déposer l'archive, la décompresser dans une nouvelle version, puis
 * basculer le lien `current` d'un seul `rename` (atomique : un visiteur voit
 * l'ancienne version ou la nouvelle, jamais un mélange). nginx lit les fichiers
 * à chaque requête : rien à redémarrer. Les versions précédentes restent sur le
 * disque (les 3 dernières) : revenir en arrière est un autre basculement.
 *
 * Deux allers-retours SSH au lieu d'une vingtaine : quelques secondes.
 */
import YAML from 'yaml';
import { writeFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { executeRemoteCommand, shellQuote, uploadRemoteFile } from '../ssh/ssh';
import { STATIC_NGINX_CONF, toBuildPack } from '../docker/build-packs';
import { composeDirFile, composeProject, composeServiceName, generateComposeFile } from '../docker/compose';
import { writeFirewallFile } from '../services/firewall-file.service';
import { applyRoutes, retryPlatformCertificates } from '../services/routes-file.service';
import { ApplicationRow, PrivateKeyRow, ServerRow } from '../models/ideploy.types';

/** Versions gardées sur le serveur : la servie et deux d'avant. */
const STATIC_RELEASES_KEPT = 3;
const STATIC_IMAGE = 'nginx:alpine';

/** La configuration du chemin général, servie depuis le dossier monté. */
export const FAST_STATIC_NGINX_CONF = STATIC_NGINX_CONF.replace('root /usr/share/nginx/html;', 'root /site/current/html;');

/**
 * Le site arrive tout construit (iCode) : des fichiers, pas de commande à
 * lancer. Un dépôt Git, une commande d'installation ou de build, une image :
 * le chemin général.
 */
export function isPrebuiltStatic(app: ApplicationRow, hasSourceArchive: boolean): boolean {
  return (
    hasSourceArchive &&
    !app.git_repository &&
    toBuildPack(app.build_pack) === 'static' &&
    !app.install_command &&
    !app.build_command &&
    !app.start_command
  );
}

export interface FastStaticContext {
  deploymentUuid: string;
  app: ApplicationRow;
  server: ServerRow;
  key: PrivateKeyRow;
  workdir: string;
  archive: Buffer;
  labels?: string[];
  network?: string;
  log: (line: string) => Promise<void>;
  step: (label: string, fn: () => Promise<void>) => Promise<void>;
  markSwitched: () => void;
}

/** Le compose du conteneur unique : nginx, le dossier du site et sa configuration montés en lecture seule. */
export function fastStaticCompose(app: ApplicationRow, siteDir: string, labels?: string[], network?: string): string {
  const base = YAML.parse(generateComposeFile(app, STATIC_IMAGE, labels, network, [], 80)) as {
    services: Record<string, Record<string, unknown>>;
  };
  const service = base.services[composeServiceName(app)];
  service.volumes = [`${siteDir}:/site:ro`, `${siteDir}/conf:/etc/nginx/conf.d:ro`];
  // Le site peut changer sous nginx sans qu'il soit relancé : la santé se lit par une requête.
  service.healthcheck = {
    test: ['CMD-SHELL', 'wget -q -O /dev/null http://127.0.0.1/ || exit 1'],
    interval: '30s',
    timeout: '5s',
    retries: 3,
    start_period: '5s',
  };
  return YAML.stringify(base);
}

export async function deployPrebuiltStatic(ctx: FastStaticContext): Promise<void> {
  const { app, server, key, workdir, deploymentUuid, log } = ctx;
  const siteDir = `${workdir}/static`;
  const id = deploymentUuid.slice(0, 8);
  const release = `releases/${id}`;
  const publish = (app.publish_directory ?? 'dist').replace(/^\.?\/+|\/+$/g, '') || 'dist';
  const compose = fastStaticCompose(app, siteDir, ctx.labels, ctx.network);
  const project = composeProject(app);
  const service = composeServiceName(app);
  const q = shellQuote;

  await log('Prebuilt site: published as files, without building an image.');
  let confChanged = false;

  // 1. Les fichiers, dans une nouvelle version (rien de ce qui est servi ne change encore).
  await ctx.step('Uploading the site', async () => {
    const localArchive = join(tmpdir(), `ideploy-site-${deploymentUuid}.tgz`);
    const remoteArchive = `${siteDir}/incoming-${id}.tgz`;
    await writeFile(localArchive, ctx.archive);
    try {
      const prepared = await executeRemoteCommand(server, key, `mkdir -p ${q(`${siteDir}/releases`)} ${q(`${siteDir}/conf`)}`, { noRetry: true });
      if (prepared.exitCode !== 0) throw new Error(`Failed to prepare the site directory: ${prepared.stderr.slice(0, 300)}`);
      await uploadRemoteFile(server, key, localArchive, remoteArchive);
    } finally {
      await rm(localArchive, { force: true });
    }

    const conf = Buffer.from(FAST_STATIC_NGINX_CONF, 'utf8').toString('base64');
    const script = [
      'set -e',
      `cd ${q(siteDir)}`,
      `R=${q(release)}`,
      'rm -rf "$R" && mkdir -p "$R/x"',
      `tar xzf ${q(`incoming-${id}.tgz`)} -C "$R/x" && rm -f ${q(`incoming-${id}.tgz`)}`,
      // Le dossier publié (`dist/`), ou les fichiers à la racine de l'archive.
      `if [ -f "$R/x/${publish}/index.html" ]; then mv "$R/x/${publish}" "$R/html"; elif [ -f "$R/x/index.html" ]; then mv "$R/x" "$R/html"; else echo "NO_INDEX" >&2; exit 3; fi`,
      'rm -rf "$R/x"',
      'chmod -R a+rX "$R/html"',
      // La configuration : réécrite seulement si elle a changé (le dossier est monté, nginx la relit au reload).
      `echo ${conf} | base64 -d > conf/default.conf.new`,
      'if cmp -s conf/default.conf.new conf/default.conf; then rm -f conf/default.conf.new; echo CONF_SAME; else mv -f conf/default.conf.new conf/default.conf; echo CONF_CHANGED; fi',
      'echo FILES=$(find "$R/html" -type f | wc -l)',
    ].join('\n');
    const r = await executeRemoteCommand(server, key, script, { noRetry: true });
    if (r.exitCode === 3 || /NO_INDEX/.test(r.stderr)) {
      throw new Error(`The site has no index.html (looked in ${publish}/ and at the root of the files sent).`);
    }
    if (r.exitCode !== 0) throw new Error(`Unpacking the site failed: ${(r.stderr || r.stdout).slice(0, 300)}`);
    const files = /FILES=\s*(\d+)/.exec(r.stdout)?.[1];
    if (files) await log(`${files} files received.`);
    confChanged = /CONF_CHANGED/.test(r.stdout);
  });

  // 2. Le conteneur unique : créé s'il n'existe pas (ou si son compose a changé), sinon laissé tel quel.
  ctx.markSwitched();
  await ctx.step('Switching to the new version', async () => {
    await writeFirewallFile(server, key, app);
    const { routed, waiting } = await applyRoutes(server, key, app, { port: 80, waitForPlatformDnsMs: 90_000 });
    if (routed.length) await log(`Routes: ${routed.join(', ')}`);
    if (waiting.length) await log(`Waiting for DNS (not routed yet): ${waiting.join(', ')} — see Settings › domain.`);

    const b64 = Buffer.from(compose, 'utf8').toString('base64');
    const script = [
      'set -e',
      `cd ${q(workdir)}`,
      // La bascule : un lien temporaire renommé par-dessus l'ancien (rename(2), atomique).
      `ln -sfn ${q(release)} ${q(`${siteDir}/current.next`)}`,
      `mv -Tf ${q(`${siteDir}/current.next`)} ${q(`${siteDir}/current`)}`,
      `echo ${b64} | base64 -d > docker-compose.yml.next`,
      `RUNNING=$(docker ps -q -f ${q(`name=^${service}$`)})`,
      'if [ -n "$RUNNING" ] && cmp -s docker-compose.yml.next docker-compose.yml; then',
      '  rm -f docker-compose.yml.next; echo CONTAINER_KEPT',
      'else',
      '  mv -f docker-compose.yml.next docker-compose.yml',
      `  docker compose -p ${q(project)} up -d --remove-orphans 2>&1 || { docker compose -p ${q(project)} down --remove-orphans 2>/dev/null; docker compose -p ${q(project)} up -d --remove-orphans 2>&1; }`,
      '  echo CONTAINER_STARTED',
      'fi',
      `echo ${q(workdir)} > ${q(composeDirFile(app))}`,
    ].join('\n');
    const r = await executeRemoteCommand(server, key, script, { noRetry: true, onData: (c) => log(c) });
    if (r.exitCode !== 0) throw new Error(`Switching failed: ${(r.stderr || r.stdout).trim().slice(0, 300)}`);
    if (/CONTAINER_KEPT/.test(r.stdout) && confChanged) {
      await executeRemoteCommand(server, key, `docker exec ${q(service)} nginx -s reload`, { noRetry: true }).catch(() => undefined);
    }
    await log(/CONTAINER_KEPT/.test(r.stdout) ? 'Same server, new files: nothing to restart.' : 'Site server started.');
  });

  // 3. Le site répond : une vraie requête, depuis le conteneur. Quelques dixièmes de seconde d'habitude.
  await ctx.step('Checking the site answers', async () => {
    const probe =
      `for i in $(seq 1 30); do ` +
      `docker exec ${q(service)} wget -q -O /dev/null http://127.0.0.1/ 2>/dev/null && { echo OK; exit 0; }; sleep 0.5; ` +
      `done; docker logs --tail 40 ${q(service)} 2>&1; exit 1`;
    const r = await executeRemoteCommand(server, key, probe, { noRetry: true });
    if (r.exitCode !== 0) {
      // L'ancienne version reprend la main.
      await executeRemoteCommand(
        server,
        key,
        `cd ${q(siteDir)} && P=$(ls -1t releases | grep -vx ${q(id)} | head -n 1) && [ -n "$P" ] && ln -sfn "releases/$P" current.next && mv -Tf current.next current`,
        { noRetry: true }
      ).catch(() => undefined);
      throw new Error(`The site server did not answer.\n${(r.stdout || r.stderr).slice(-1500)}`);
    }
    await log('✓ The site answers.');
  });

  // Une adresse dont le certificat avait échoué avant ce correctif : redemandé une fois.
  void retryPlatformCertificates(server, key, app, 80);

  // 4. Le ménage, sans attendre : les vieilles versions, et les images du chemin général d'avant.
  void executeRemoteCommand(
    server,
    key,
    `cd ${q(`${siteDir}/releases`)} && ls -1t | grep -vx ${q(id)} | tail -n +${STATIC_RELEASES_KEPT} | xargs -r rm -rf; ` +
      `rm -rf ${q(`${workdir}/releases`)} ${q(`${workdir}/src`)}; ` +
      `docker images ${q(`ideploy-${app.uuid.toLowerCase()}`)} -q | xargs -r docker rmi >/dev/null 2>&1; true`,
    { noRetry: true }
  ).catch(() => undefined);
}

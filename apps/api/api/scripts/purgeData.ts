/**
 * Purge manuelle — `npm run privacy:purge -- …`. Sans `--apply`, rien n'est effacé : le rapport dit ce qui le serait.
 *
 *   --due                          les échéances du moment (comme la tâche horaire)
 *   --user <uid>                   un compte dont la demande de suppression est échue
 *   --project <uid>:<projectId>    un projet archivé depuis plus du délai
 *   --now                          ignore l'échéance (demande écrite d'un utilisateur, exercée par le support)
 *   --apply                        efface pour de bon, puis vérifie
 *
 * Le rapport est aussi rangé dans `data_purge_reports`.
 */
import { loadSecrets } from '../config/secrets';
import mongoDBConnection from '../config/mongodb.config';
import RedisConnection from '../config/redis.config';
import { dueSubjects, runPurge, stillDue, type PurgeSubject } from '../services/privacy/data-lifecycle.service';

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const value = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

async function main(): Promise<void> {
  await loadSecrets();
  await mongoDBConnection.connect();
  const mode = flag('--apply') ? 'enforce' : 'dry-run';
  const now = new Date();
  try {
    let subjects: PurgeSubject[] = [];
    if (flag('--due')) subjects = await dueSubjects(now, 500);
    const user = value('--user');
    if (user) subjects.push({ kind: 'account', userId: user });
    const project = value('--project');
    if (project) {
      const [userId, projectId] = project.split(':');
      if (!userId || !projectId) throw new Error('--project attend <uid>:<projectId>');
      subjects.push({ kind: 'project', userId, projectId });
    }
    if (!subjects.length) {
      console.log('Rien à traiter. Options : --due | --user <uid> | --project <uid>:<projectId> [--now] [--apply]');
      return;
    }
    for (const subject of subjects) {
      if (!flag('--now') && !(await stillDue(subject, now))) {
        console.log(`– ${subject.kind} ${subject.projectId ?? subject.userId} : pas d'échéance atteinte (--now pour passer outre)`);
        continue;
      }
      const r = await runPurge(subject, mode);
      console.log(`\n${r.kind} ${r.projectId ?? r.userId} — ${mode} → ${r.status}`);
      console.log(`  effacés     : ${JSON.stringify(r.deleted)}`);
      console.log(`  gardés      : ${JSON.stringify(r.retained)} (preuves comptables, sans e-mail ni téléphone)`);
      console.log(`  détachés    : ${JSON.stringify(r.anonymized)}`);
      console.log(`  fichiers    : ${r.storageObjects}   caches : ${r.cacheKeys}   authentification : ${r.authAccount}`);
      if (r.ideployResources) console.log(`  iDeploy     : ${r.ideployResources} ressource(s) à supprimer à la main`);
      if (r.remaining) console.log(`  RESTE       : ${JSON.stringify(r.remaining)}`);
      for (const note of r.notes) console.log(`  note        : ${note}`);
    }
    if (mode === 'dry-run') console.log('\nRelevé seulement. Relancer avec --apply pour effacer.');
  } finally {
    await mongoDBConnection.disconnect();
    try {
      RedisConnection.getInstance().disconnect();
    } catch {
      /* pas de Redis : rien à fermer */
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

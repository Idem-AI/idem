# Backups

`backup.sh` dumps every production database each night and sends the dumps to an S3 bucket off the server (Hetzner Object Storage). A copy on the same disk would not survive the loss of the server.

| Base | Container | Dump |
| --- | --- | --- |
| iDeploy | `ideploy-db` | `pg_dumpall` |
| Auth (GoTrue) | `idem-auth-db` | `pg_dumpall` |
| Infisical (every secret) | `infisical-db` | `pg_dumpall` |
| Wiki | `wikijs-db` | `pg_dumpall` |
| IDEM, iVision | `mongodb` | `mongodump --archive` |
| WeGift | `wegift-mysql` | `mysqldump --all-databases` |

Each dump runs inside its own container, is compressed and uploaded as `s3://<bucket>/<base>/<base>-<YYYY-MM-DD>.gz`. Dumps older than `RETENTION_DAYS` (14 by default) are deleted.

## Install (production host)

```bash
mkdir -p /root/application/backup
cp infra/backup/backup.sh /root/application/backup/
cat > /root/application/backup/backup.env <<'ENV'
S3_ENDPOINT=https://fsn1.your-objectstorage.com
S3_BUCKET=idem-backups
S3_ACCESS_KEY=
S3_SECRET_KEY=
RETENTION_DAYS=14
ENV
chmod 600 /root/application/backup/backup.env
( crontab -l 2>/dev/null; echo '15 3 * * * /root/application/backup/backup.sh >> /root/application/logs/backup.log 2>&1' ) | crontab -
```

## Monitoring

Every step prints a JSON line (`service: backup`, events `backup.uploaded`, `backup.failed`, `backup.completed`) through a short-lived container named `idem-backup`, which Alloy ships to Loki. Two Grafana alerts read them: **Sauvegarde en échec** and **Aucune sauvegarde depuis 26 heures**.

## Restore

`restore.sh`, installed next to `backup.sh` (same `backup.env`):

```bash
./restore.sh list                          # every dump, newest first
./restore.sh test ideploy-postgres         # into a throw-away container; production untouched
./restore.sh prod ideploy-postgres 2026-10-10
```

| Mode | What it does |
| --- | --- |
| `list [base]` | the dumps in the bucket, with their size |
| `test <base> [date]` | downloads the dump (the newest without a date), checks it, loads it into a throw-away container and prints what came back: databases, tables or collections, rows. Nothing in production changes. |
| `prod <base> [date]` | restores over production, in this order: asks to type the base name (`--yes` skips it); **saves the current state** to `<base>/pre-restore-<time>.gz` and stops if that save fails; stops the applications using the base; drops the databases the dump recreates; loads the dump; starts the applications again; prints what production now holds. Exits with code 2 if the load reported errors. |

To undo a restore, give the safety file instead of a date: `./restore.sh prod ideploy-postgres pre-restore-20261010T203418Z.gz`. The command to use is printed at the end of every restore.

Applications stopped during a `prod` restore:

| Base | Applications |
| --- | --- |
| `ideploy-postgres` | `ideploy-api`, `ideploy-worker` |
| `auth-postgres` | `idem-auth` |
| `infisical-postgres` | `infisical-backend` (every API reads its secrets at start-up: restart them afterwards if they were restarted meanwhile) |
| `wikijs-postgres` | `wikijs` |
| `mongodb` | `idem-api`, `ivision-api`, `appgen-server`, `idem-admin-api` |
| `wegift-mysql` | `wegift-backend` |

**Drill.** `RESTORE_TARGET=<container> RESTORE_APPS="" ./restore.sh prod <base>` runs the production path against another container, for instance a `postgres:16-alpine` started for the exercise: the safety dump, the drop and the load can be rehearsed without touching the real base.

Run `./restore.sh test <base>` for each base at least once a month: a backup that was never restored is not known to work.

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

```bash
aws --endpoint-url "$S3_ENDPOINT" s3 cp s3://idem-backups/ideploy-postgres/ideploy-postgres-2026-10-10.gz .
gunzip -c ideploy-postgres-2026-10-10.gz | docker exec -i ideploy-db psql -U ideploy -d postgres
gunzip -c mongodb-2026-10-10.gz | docker exec -i mongodb mongorestore --archive -u "$USER" -p "$PASS" --authenticationDatabase admin
```

Test a restore into a throw-away container at least once a month: a backup that was never restored is not known to work.

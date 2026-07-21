/**
 * SSL certificate management. Ports SslCertificate model + RegenerateSslCertJob.
 * `ssl_certificate` and `ssl_private_key` are Laravel-`encrypted`. The API never
 * returns the private key — only certificate metadata.
 */
import pool from '../config/db.config';
import { encryptString } from '../utils/laravel-crypto';
import * as serverService from './server.service';
import { executeRemoteCommand } from '../ssh/ssh';

export interface SslCertView {
  id: number;
  common_name: string;
  is_ca_certificate: boolean;
  valid_until: string;
  server_id: number;
}

function mapView(r: Record<string, unknown>): SslCertView {
  return {
    id: Number(r.id),
    common_name: String(r.common_name),
    is_ca_certificate: Boolean(r.is_ca_certificate),
    valid_until: String(r.valid_until),
    server_id: Number(r.server_id),
  };
}

export async function listForServer(teamId: number, serverUuid: string): Promise<SslCertView[]> {
  const server = await serverService.getServer(teamId, serverUuid);
  if (!server) throw new Error('Server not found');
  const { rows } = await pool.query(
    `SELECT id, common_name, is_ca_certificate, valid_until, server_id
     FROM ssl_certificates WHERE server_id = $1 ORDER BY common_name`,
    [server.id]
  );
  return rows.map(mapView);
}

/**
 * Generate a self-signed certificate on the server (openssl) and store it
 * encrypted. Ports the local-CA path of RegenerateSslCertJob (Let's Encrypt is
 * handled by Traefik separately).
 */
export async function generateSelfSigned(
  teamId: number,
  serverUuid: string,
  commonName: string,
  isCa = false
): Promise<SslCertView> {
  const server = await serverService.getServer(teamId, serverUuid);
  if (!server) throw new Error('Server not found');
  const key = await serverService.getPrivateKey(teamId, server.private_key_id);
  if (!key) throw new Error('Private key not found for server');

  const days = 3650;
  const script =
    `openssl req -x509 -newkey rsa:4096 -nodes -days ${days} ` +
    `-keyout /tmp/ideploy-ssl.key -out /tmp/ideploy-ssl.crt -subj "/CN=${commonName}" 2>/dev/null && ` +
    `echo '---CERT---' && cat /tmp/ideploy-ssl.crt && echo '---KEY---' && cat /tmp/ideploy-ssl.key && ` +
    `rm -f /tmp/ideploy-ssl.key /tmp/ideploy-ssl.crt`;

  const result = await executeRemoteCommand(server, key, script, { noRetry: true });
  if (result.exitCode !== 0) {
    throw new Error(`Failed to generate certificate: ${result.stderr.slice(0, 300)}`);
  }

  const certMatch = result.stdout.split('---CERT---')[1]?.split('---KEY---');
  const certificate = (certMatch?.[0] ?? '').trim();
  const privateKey = (certMatch?.[1] ?? '').trim();
  if (!certificate || !privateKey) throw new Error('Could not parse generated certificate');

  // valid_until = now + days (computed server-side via interval to avoid Date in code paths)
  const { rows } = await pool.query(
    `INSERT INTO ssl_certificates
       (ssl_certificate, ssl_private_key, server_id, common_name, valid_until, is_ca_certificate, created_at, updated_at)
     VALUES ($1, $2, $3, $4, now() + ($5 || ' days')::interval, $6, now(), now())
     RETURNING id, common_name, is_ca_certificate, valid_until, server_id`,
    [encryptString(certificate), encryptString(privateKey), server.id, commonName, String(days), isCa]
  );
  return mapView(rows[0]);
}

export async function deleteCert(teamId: number, serverUuid: string, id: number): Promise<boolean> {
  const server = await serverService.getServer(teamId, serverUuid);
  if (!server) throw new Error('Server not found');
  const { rowCount } = await pool.query(
    'DELETE FROM ssl_certificates WHERE id = $1 AND server_id = $2',
    [id, server.id]
  );
  return (rowCount ?? 0) > 0;
}

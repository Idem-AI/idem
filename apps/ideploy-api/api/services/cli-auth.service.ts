/**
 * Signing the CLI in through the browser — the device flow Railway, Vercel and
 * GitHub's CLIs use, so nobody copies a token by hand.
 *
 *   1. `idem login` asks for a request: a secret `deviceCode` it keeps, a
 *      short `userCode` it shows, and the page to open.
 *   2. The developer, signed in on iDeploy, sees "Authorise the CLI on <host>"
 *      with that code, and approves: a personal access token is issued for them.
 *   3. The CLI polls with its `deviceCode` and receives the token — once.
 *
 * A request lives 10 minutes in Redis; nothing is written to the database
 * until it is approved.
 */
import crypto from 'crypto';
import redis from '../config/redis.config';
import { createToken } from './pat.service';
import { notFound, unprocessable } from '../utils/errors';

const TTL_SECONDS = 600;
/** Seconds the CLI waits between two polls. */
export const POLL_INTERVAL_SECONDS = 3;
/** A CLI token lasts a year; `idem logout` revokes it sooner. */
const TOKEN_DAYS = 365;
/** No 0/O, 1/I/L, 2/Z, 5/S, 8/B: read from a terminal, typed or compared by eye. */
const ALPHABET = 'ACDEFGHJKMNPQRTUVWXY34679';

const deviceKey = (deviceCode: string) => `cli-auth:device:${deviceCode}`;
const userKey = (userCode: string) => `cli-auth:user:${userCode}`;

interface CliAuthRequest {
  userCode: string;
  /** The machine the CLI runs on, as it says: shown to the developer before approving. */
  host: string;
  createdAt: string;
  status: 'pending' | 'approved' | 'denied';
  token?: string;
}

/** `ABCD-EFGH` from random bytes. */
export function userCodeFrom(bytes: Buffer): string {
  const chars = [...bytes.subarray(0, 8)].map((b) => ALPHABET[b % ALPHABET.length]);
  return `${chars.slice(0, 4).join('')}-${chars.slice(4, 8).join('')}`;
}

/** What the developer typed or the link carried, in the stored form: `abcd efgh` → `ABCD-EFGH`. */
export function normaliseUserCode(input: string): string | null {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (raw.length !== 8 || [...raw].some((c) => !ALPHABET.includes(c))) return null;
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

/** A label for the machine: what the CLI sent, kept short and printable. */
export function cleanHost(host: unknown): string {
  const value = typeof host === 'string' ? host.replace(/[^\w .@()-]/g, '').trim().slice(0, 60) : '';
  return value || 'unknown machine';
}

export async function startRequest(host: unknown, webUrl: string): Promise<{
  deviceCode: string;
  userCode: string;
  verificationUrl: string;
  expiresIn: number;
  interval: number;
}> {
  const deviceCode = crypto.randomBytes(32).toString('hex');
  let userCode = userCodeFrom(crypto.randomBytes(8));
  // A collision with a live request would hand one developer's approval to another CLI.
  for (let i = 0; i < 5 && (await redis.exists(userKey(userCode))); i++) userCode = userCodeFrom(crypto.randomBytes(8));
  const request: CliAuthRequest = { userCode, host: cleanHost(host), createdAt: new Date().toISOString(), status: 'pending' };
  await redis.set(deviceKey(deviceCode), JSON.stringify(request), 'EX', TTL_SECONDS);
  await redis.set(userKey(userCode), deviceCode, 'EX', TTL_SECONDS);
  return {
    deviceCode,
    userCode,
    verificationUrl: `${webUrl.replace(/\/+$/, '')}/cli/authorize?code=${userCode}`,
    expiresIn: TTL_SECONDS,
    interval: POLL_INTERVAL_SECONDS,
  };
}

async function byUserCode(input: string): Promise<{ deviceCode: string; request: CliAuthRequest }> {
  const userCode = normaliseUserCode(input);
  if (!userCode) throw unprocessable('CLI_CODE_INVALID', 'This code is not valid: check it in your terminal.');
  const deviceCode = await redis.get(userKey(userCode));
  const raw = deviceCode ? await redis.get(deviceKey(deviceCode)) : null;
  if (!deviceCode || !raw) throw notFound('This sign-in request (expired after 10 minutes — run `idem login` again)');
  return { deviceCode, request: JSON.parse(raw) as CliAuthRequest };
}

/** What the approval page shows before the developer decides. */
export async function describeRequest(userCode: string): Promise<{ userCode: string; host: string; createdAt: string; status: string }> {
  const { request } = await byUserCode(userCode);
  return { userCode: request.userCode, host: request.host, createdAt: request.createdAt, status: request.status };
}

/** The developer's answer. Approving issues their token, held for the CLI's next poll. */
export async function answerRequest(
  user: { id: number; currentTeamId: number },
  userCode: string,
  approve: boolean
): Promise<void> {
  const { deviceCode, request } = await byUserCode(userCode);
  if (request.status !== 'pending') throw unprocessable('CLI_CODE_USED', 'This sign-in request was already answered.');
  const ttl = Math.max(await redis.ttl(deviceKey(deviceCode)), 30);
  if (!approve) {
    await redis.set(deviceKey(deviceCode), JSON.stringify({ ...request, status: 'denied' }), 'EX', ttl);
    return;
  }
  const issued = await createToken(user, { name: `CLI — ${request.host}`, expiresInDays: TOKEN_DAYS });
  await redis.set(
    deviceKey(deviceCode),
    JSON.stringify({ ...request, status: 'approved', token: issued.plainTextToken }),
    'EX',
    ttl
  );
}

/** The CLI's poll: the token once approved (then the request is gone), else where it stands. */
export async function pollRequest(deviceCode: unknown): Promise<{ status: 'pending' | 'approved' | 'denied' | 'expired'; token?: string }> {
  if (typeof deviceCode !== 'string' || !/^[0-9a-f]{64}$/.test(deviceCode)) return { status: 'expired' };
  const raw = await redis.get(deviceKey(deviceCode));
  if (!raw) return { status: 'expired' };
  const request = JSON.parse(raw) as CliAuthRequest;
  if (request.status === 'approved' && request.token) {
    // Handed over once: a second poll with the same code gets nothing.
    await redis.del(deviceKey(deviceCode), userKey(request.userCode));
    return { status: 'approved', token: request.token };
  }
  if (request.status === 'denied') {
    await redis.del(deviceKey(deviceCode), userKey(request.userCode));
    return { status: 'denied' };
  }
  return { status: 'pending' };
}

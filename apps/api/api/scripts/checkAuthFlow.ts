/**
 * Vérification de bout en bout de l'authentification — `npm run check:auth`.
 *
 * Exerce le vrai serveur d'authentification Supabase (infra/supabase-auth) et
 * une base MongoDB **jetable**, jamais la base de l'application :
 *
 *  1. reprise d'un compte existant (import), puis connexion par mot de passe :
 *     l'uid IDEM d'origine est conservé ;
 *  2. compte existant non importé + adresse vérifiée : rattachement par e-mail ;
 *  3. adresse non vérifiée face à un compte existant : refus ;
 *  4. nouveau compte : l'uid IDEM est l'identifiant Supabase ;
 *  5. cookies `session` / `refreshToken` posés par `/auth/sessionLogin`, lus
 *     par `/auth/me` et `/auth/profile`, renouvelés par `/auth/refresh` ;
 *  6. Bearer Supabase accepté par `authenticate` ;
 *  7. sessions liées à leur appareil : refus depuis un autre appareil, relais
 *     des satellites, « C'est moi » / « Ce n'est pas moi » (Redis requis) ;
 *  8. « déconnecter partout » révoque les sessions déjà émises.
 *
 *   SUPABASE_AUTH_URL=http://localhost:9999 \
 *   SUPABASE_JWT_SECRET=… \
 *   AUTH_CHECK_MONGODB_URI='mongodb://admin:admin123@localhost:27017/idem_auth_check?authSource=admin' \
 *   npx ts-node --transpile-only api/scripts/checkAuthFlow.ts
 */

import assert from 'assert';
import axios from 'axios';
import express from 'express';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import { AddressInfo } from 'net';
import { supabaseAdmin } from '../services/identity/supabaseAuth.client';
import { importAuthAccounts } from '../services/identity/accountImport';
import { IdentityError, identityService } from '../services/identity/identity.service';
import {
  createSessionToken,
  forgetRevocation,
  verifySessionCookie,
} from '../services/sessionCookie.service';
import { signHs256 } from '../utils/jwt-hs256.util';
import { issueDeviceCheck } from '../services/identity/deviceCheck.service';
import { deviceFingerprint } from '../utils/device-fingerprint.util';
import RedisConnection from '../config/redis.config';

const MONGO_URI = process.env.AUTH_CHECK_MONGODB_URI;
const AUTH_URL = (process.env.SUPABASE_AUTH_URL || '').replace(/\/+$/, '');
const RUN = Date.now().toString(36);
const PASSWORD = `Check-${RUN}-pw!`;

let failures = 0;
async function step(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    console.log(`  ok    ${name}`);
  } catch (error: any) {
    failures += 1;
    console.log(`  ÉCHEC ${name}\n        ${error.response?.data ? JSON.stringify(error.response.data) : error.message}`);
  }
}

async function passwordSignIn(email: string): Promise<string> {
  const { data } = await axios.post(`${AUTH_URL}/token?grant_type=password`, {
    email,
    password: PASSWORD,
  });
  return data.access_token as string;
}

function claimsOf(token: string) {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
}

async function main(): Promise<void> {
  if (!MONGO_URI || !AUTH_URL || !process.env.SUPABASE_JWT_SECRET) {
    throw new Error('AUTH_CHECK_MONGODB_URI, SUPABASE_AUTH_URL et SUPABASE_JWT_SECRET sont requis');
  }
  if (!/\/idem_auth_check(\?|$)/.test(MONGO_URI)) {
    throw new Error('AUTH_CHECK_MONGODB_URI doit viser la base jetable `idem_auth_check`');
  }
  process.env.NODE_ENV = 'development';

  await mongoose.connect(MONGO_URI);
  await mongoose.connection.dropDatabase();
  const users = mongoose.connection.collection('users');
  await users.createIndex(
    { authId: 1 },
    { unique: true, partialFilterExpression: { authId: { $type: 'string' } } }
  );
  await users.createIndex({ email: 1 }, { unique: true });

  const legacyUid = `legacyUid${RUN}`;
  const legacyEmail = `legacy.${RUN}@example.com`;
  const lateUid = `lateUid${RUN}`;
  const lateEmail = `Late.${RUN}@Example.com`;
  const guardedUid = `guardedUid${RUN}`;
  const guardedEmail = `guarded.${RUN}@example.com`;
  const newEmail = `new.${RUN}@example.com`;
  const base = { subscription: 'free', roles: ['user'], quota: {}, createdAt: new Date(), lastLogin: new Date() };

  await users.insertOne({ _id: legacyUid as any, uid: legacyUid, email: legacyEmail, displayName: 'Legacy', ...base });

  console.log('Authentification — vérification de bout en bout\n');

  await step('import : compte créé sans mot de passe et rattaché', async () => {
    const dry = await importAuthAccounts(false);
    assert.equal(dry.created, 1);
    assert.equal((await users.findOne({ _id: legacyUid as any }))?.authId, undefined);
    const report = await importAuthAccounts(true);
    assert.equal(report.created, 1);
    assert.deepEqual(report.failed, []);
    const again = await importAuthAccounts(true);
    assert.equal(again.alreadyLinked, 1);
    assert.equal(again.created, 0);
  });

  const legacyDoc = await users.findOne({ _id: legacyUid as any });
  const legacyAuthId = legacyDoc?.authId as string;

  await step("compte importé : impossible d'entrer sans avoir choisi un mot de passe", async () => {
    await assert.rejects(passwordSignIn(legacyEmail));
  });

  await step("compte importé : après « mot de passe oublié », l'uid d'origine est conservé", async () => {
    // Le lien de récupération aboutit à un changement de mot de passe : on le simule.
    await supabaseAdmin.updateUser(legacyAuthId, { password: PASSWORD });
    const token = await passwordSignIn(legacyEmail);
    assert.equal(claimsOf(token).app_metadata.idem_uid, legacyUid);
    const user = await identityService.resolveUser(claimsOf(token));
    assert.equal(user.uid, legacyUid);
    assert.equal(user.emailVerified, true);
  });

  await step('compte existant non importé : rattaché par adresse vérifiée (casse ignorée)', async () => {
    await users.insertOne({ _id: lateUid as any, uid: lateUid, email: lateEmail, ...base });
    await supabaseAdmin.createUser({ email: lateEmail.toLowerCase(), password: PASSWORD, email_confirm: true });
    const token = await passwordSignIn(lateEmail.toLowerCase());
    const user = await identityService.resolveUser(claimsOf(token));
    assert.equal(user.uid, lateUid);
    const doc = await users.findOne({ _id: lateUid as any });
    assert.equal(doc?.authMigration?.linkedBy, 'verified-email');
  });

  await step('adresse non vérifiée face à un compte existant : refus', async () => {
    await users.insertOne({ _id: guardedUid as any, uid: guardedUid, email: guardedEmail, ...base });
    const intruder = await supabaseAdmin.createUser({ email: guardedEmail, password: PASSWORD, email_confirm: false });
    // Le serveur refuse lui-même la connexion d'une adresse non confirmée…
    await assert.rejects(passwordSignIn(guardedEmail));
    // … et même avec un jeton valide, l'API ne rattache pas.
    const now = Math.floor(Date.now() / 1000);
    const forged = signHs256(
      { sub: intruder.id, email: guardedEmail, aud: 'authenticated', role: 'authenticated', exp: now + 60, iat: now },
      process.env.SUPABASE_JWT_SECRET!
    );
    await assert.rejects(identityService.resolveUser(claimsOf(forged)), (error: unknown) => {
      return error instanceof IdentityError && error.code === 'email_not_verified';
    });
    assert.equal((await users.findOne({ _id: guardedUid as any }))?.authId, undefined);
  });

  let newToken = '';
  await step("nouveau compte : l'uid IDEM est l'identifiant Supabase", async () => {
    const created = await supabaseAdmin.createUser({ email: newEmail, password: PASSWORD, email_confirm: true });
    newToken = await passwordSignIn(newEmail);
    const user = await identityService.resolveUser(claimsOf(newToken));
    assert.equal(user.uid, created.id);
  });

  await step('jeton de session IDEM : signé, vérifié, refusé une fois falsifié', async () => {
    const doc = await users.findOne({ _id: legacyUid as any });
    const token = createSessionToken({ ...(doc as any), uid: legacyUid });
    const identity = await verifySessionCookie(token);
    assert.equal(identity.uid, legacyUid);
    const [h, , s] = token.split('.');
    const tampered = `${h}.${Buffer.from(JSON.stringify({ ...claimsOf(token), sub: lateUid })).toString('base64url')}.${s}`;
    await assert.rejects(verifySessionCookie(tampered));
    // Un jeton Supabase ne passe pas pour une session IDEM.
    await assert.rejects(verifySessionCookie(newToken));
  });

  // ── HTTP : routes réelles de l'API ──────────────────────────────────────
  const { authRoutes } = await import('../routes/auth.routes');
  const { userRoutes } = await import('../routes/user.routes');
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use('/auth', authRoutes);
  app.use('/auth', userRoutes);
  const server = app.listen(0);
  const api = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const http = axios.create({ baseURL: api, validateStatus: () => true });

  const cookieHeader = (setCookie: string[] | undefined) =>
    (setCookie ?? []).map((c) => c.split(';')[0]).join('; ');

  let cookies = '';
  await step('POST /auth/sessionLogin : cookies session + refreshToken httpOnly', async () => {
    const token = await passwordSignIn(legacyEmail);
    const res = await http.post('/auth/sessionLogin', { token });
    assert.equal(res.status, 200, JSON.stringify(res.data));
    assert.equal(res.data.user.uid, legacyUid);
    assert.equal(res.data.user.refreshTokens, undefined);
    const set = res.headers['set-cookie'] ?? [];
    assert.ok(set.some((c) => c.startsWith('session=') && /HttpOnly/i.test(c)));
    assert.ok(set.some((c) => c.startsWith('refreshToken=') && /HttpOnly/i.test(c)));
    cookies = cookieHeader(set);
  });

  await step('POST /auth/sessionLogin : jeton invalide refusé', async () => {
    const res = await http.post('/auth/sessionLogin', { token: 'x.y.z' });
    assert.equal(res.status, 401);
  });

  await step('GET /auth/me et /auth/profile avec le cookie', async () => {
    const me = await http.get('/auth/me', { headers: { Cookie: cookies } });
    assert.equal(me.status, 200);
    assert.equal(me.data.uid, legacyUid);
    const profile = await http.get('/auth/profile', { headers: { Cookie: cookies } });
    assert.equal(profile.status, 200, JSON.stringify(profile.data));
    assert.equal(profile.data.uid, legacyUid);
    assert.equal(profile.data.emailVerified, true);
  });

  await step('GET /auth/me avec un Bearer Supabase', async () => {
    const token = await passwordSignIn(legacyEmail);
    const me = await http.get('/auth/me', { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(me.status, 200);
    assert.equal(me.data.uid, legacyUid);
  });

  await step('session absente : le refresh token la rétablit (/auth/profile)', async () => {
    const refreshOnly = cookies.split('; ').filter((c) => c.startsWith('refreshToken=')).join('; ');
    const profile = await http.get('/auth/profile', { headers: { Cookie: refreshOnly } });
    assert.equal(profile.status, 200);
    assert.ok((profile.headers['set-cookie'] ?? []).some((c) => c.startsWith('session=')));
    const refreshed = await http.post('/auth/refresh', {}, { headers: { Cookie: refreshOnly } });
    assert.equal(refreshed.status, 200);
  });

  // ── Sessions liées à leur appareil ──────────────────────────────────────
  const PHONE = 'Mozilla/5.0 (Linux; Android 14; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
  const LAPTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
  let phoneCookies = '';
  let phoneBearer = '';
  let phoneSid = '';
  await step('session ouverte sur un téléphone : acceptée sur ce téléphone', async () => {
    phoneBearer = await passwordSignIn(legacyEmail);
    const res = await http.post('/auth/sessionLogin', { token: phoneBearer }, { headers: { 'User-Agent': PHONE } });
    assert.equal(res.status, 200, JSON.stringify(res.data));
    phoneCookies = cookieHeader(res.headers['set-cookie']);
    const session = phoneCookies.split('; ').find((c) => c.startsWith('session='))!.slice('session='.length);
    phoneSid = claimsOf(session).sid;
    assert.ok(phoneSid);
    assert.equal(claimsOf(session).dfp, 'android/chrome/mobile');
    // Une nouvelle version du navigateur reste le même appareil.
    const me = await http.get('/auth/me', { headers: { Cookie: phoneCookies, 'User-Agent': PHONE.replace('130.0', '131.0') } });
    assert.equal(me.status, 200);
  });

  await step('même session depuis un autre appareil : refusée (cookie, refresh, Bearer)', async () => {
    const me = await http.get('/auth/me', { headers: { Cookie: phoneCookies, 'User-Agent': LAPTOP } });
    assert.equal(me.status, 401);
    assert.equal(me.data.code, 'suspicious_device');
    const refreshOnly = phoneCookies.split('; ').filter((c) => c.startsWith('refreshToken=')).join('; ');
    const refresh = await http.post('/auth/refresh', {}, { headers: { Cookie: refreshOnly, 'User-Agent': LAPTOP } });
    assert.equal(refresh.status, 401);
    assert.equal(refresh.data.code, 'suspicious_device');
    const profile = await http.get('/auth/profile', { headers: { Cookie: refreshOnly, 'User-Agent': LAPTOP } });
    assert.equal(profile.status, 401);
    const bearer = await http.get('/auth/me', { headers: { Authorization: `Bearer ${phoneBearer}`, 'User-Agent': LAPTOP } });
    assert.equal(bearer.status, 401);
    assert.equal(bearer.data.code, 'suspicious_device');
    // L'alerte part en arrière-plan, une fois par heure et par appareil.
    await new Promise((r) => setTimeout(r, 300));
    const throttle = await RedisConnection.getInstance().get(
      `auth:device-alert:${legacyUid}:${phoneSid}:${deviceFingerprint(LAPTOP)}`
    );
    assert.equal(throttle, '1');
  });

  await step('satellite qui relaie le User-Agent du navigateur : accepté', async () => {
    const me = await http.get('/auth/profile', {
      headers: { Cookie: phoneCookies, 'User-Agent': 'axios/1.7.7', 'X-Idem-Client-User-Agent': PHONE },
    });
    assert.equal(me.status, 200);
    const bare = await http.get('/auth/profile', { headers: { Cookie: phoneCookies, 'User-Agent': 'axios/1.7.7' } });
    assert.equal(bare.status, 401);
  });

  await step("e-mail « C'est moi » : la page ne change rien, le bouton ajoute l'appareil", async () => {
    const token = await issueDeviceCheck({
      uid: legacyUid, sessionId: phoneSid, fingerprint: deviceFingerprint(LAPTOP), ipAddress: '203.0.113.7', at: new Date().toISOString(),
    });
    const page = await http.get(`/auth/device-check/${token}?d=approve`);
    assert.equal(page.status, 200);
    assert.match(page.data, /Chrome sur Windows/);
    const stillRefused = await http.get('/auth/me', { headers: { Cookie: phoneCookies, 'User-Agent': LAPTOP } });
    assert.equal(stillRefused.status, 401);
    const decided = await http.post(`/auth/device-check/${token}`, 'decision=approve', {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    assert.equal(decided.status, 200);
    const me = await http.get('/auth/me', { headers: { Cookie: phoneCookies, 'User-Agent': LAPTOP } });
    assert.equal(me.status, 200);
    const reused = await http.post(`/auth/device-check/${token}`, 'decision=deny', {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    assert.equal(reused.status, 410);
  });

  await step("e-mail « Ce n'est pas moi » : toutes les sessions sont fermées", async () => {
    const TABLET = 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
    const token = await issueDeviceCheck({
      uid: legacyUid, sessionId: phoneSid, fingerprint: deviceFingerprint(TABLET), ipAddress: '203.0.113.8', at: new Date().toISOString(),
    });
    await new Promise((r) => setTimeout(r, 5));
    const decided = await http.post(`/auth/device-check/${token}`, 'decision=deny', {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    assert.equal(decided.status, 200);
    const me = await http.get('/auth/me', { headers: { Cookie: phoneCookies, 'User-Agent': PHONE } });
    assert.equal(me.status, 403);
    const refresh = await http.post('/auth/refresh', {}, { headers: { Cookie: phoneCookies, 'User-Agent': PHONE } });
    assert.equal(refresh.status, 401);
    // Le serveur d'authentification a fermé la session : son refresh token est mort.
    const bearer = await http.get('/auth/me', { headers: { Authorization: `Bearer ${phoneBearer}`, 'User-Agent': PHONE } });
    assert.equal(bearer.status, 403);
  });

  // « Ce n'est pas moi » a tout fermé : on rouvre une session pour la suite.
  await new Promise((r) => setTimeout(r, 1100));
  {
    const res = await http.post('/auth/sessionLogin', { token: await passwordSignIn(legacyEmail) });
    cookies = cookieHeader(res.headers['set-cookie']);
  }

  const oldBearer = await passwordSignIn(legacyEmail);
  await new Promise((r) => setTimeout(r, 1100));
  await step('POST /auth/logout-all : les sessions et jetons déjà émis sont refusés', async () => {
    const sessionOnly = cookies.split('; ').filter((c) => c.startsWith('session=')).join('; ');
    await new Promise((r) => setTimeout(r, 5));
    const res = await http.post('/auth/logout-all', {}, { headers: { Cookie: cookies } });
    assert.equal(res.status, 200);
    forgetRevocation(legacyUid);
    const me = await http.get('/auth/me', { headers: { Cookie: sessionOnly } });
    assert.equal(me.status, 403);
    const refresh = await http.post('/auth/refresh', {}, { headers: { Cookie: cookies } });
    assert.equal(refresh.status, 401);
    const bearer = await http.get('/auth/me', { headers: { Authorization: `Bearer ${oldBearer}` } });
    assert.equal(bearer.status, 403);
  });

  server.close();
  RedisConnection.getInstance().disconnect();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();

  console.log(failures ? `\n${failures} échec(s).` : '\nTout est conforme.');
  process.exit(failures ? 1 : 0);
}

main().catch(async (error) => {
  console.error(`Erreur : ${error.message}`);
  process.exit(1);
});

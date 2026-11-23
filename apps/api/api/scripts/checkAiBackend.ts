/**
 * Contrôle de la bascule OpenRouter ↔ idem-ml, SANS aucun appel payant : deux faux serveurs locaux (la passerelle
 * d'idem-ml et OpenRouter), les vrais modules d'IDEM.
 *
 *   npm run check:ai-backend
 *
 * Vérifie : le défaut (OpenRouter), la bascule par un réglage, la bascule partielle par sorte, la recherche web et la
 * voix épinglées chez OpenRouter, le repli (texte par le SDK openai, médias par axios) avec la politique d'OpenRouter
 * reposée sur le corps rejoué, le disjoncteur, et le repli interdit (`IDEM_AI_FALLBACK=off`).
 */
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import OpenAI from 'openai';

for (const key of Object.keys(process.env)) if (key.startsWith('IDEM_AI_BACKEND') || key.startsWith('IDEM_ML_')) delete process.env[key];
delete process.env.IDEM_AI_FALLBACK;

import { LLMProvider } from '../config/ai.config';
import { getProvider } from '../config/ai-providers.config';
import { aiBackend, describeAiBackends, resetIdemMlBreaker } from '../config/ai-backend.config';
import { fallbackFetch, postToModel } from '../services/model-transport';

type Seen = { path: string; auth?: string; body: any };

function fakeServer(name: string, reply: (seen: Seen) => { status: number; body: unknown }) {
  const seen: Seen[] = [];
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      const entry = { path: req.url ?? '', auth: req.headers.authorization, body: raw ? JSON.parse(raw) : undefined };
      seen.push(entry);
      const { status, body } = reply(entry);
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    });
  });
  return {
    seen,
    listen: () => new Promise<string>((resolve) => server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`))),
    close: () => server.close(),
    name,
  };
}

const completion = (model: string) => ({ id: 'c', object: 'chat.completion', created: 0, model, choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: 'ok' } }] });

let gatewayStatus = 200;
const gateway = fakeServer('idem-ml', (s) => {
  if (gatewayStatus !== 200) return { status: gatewayStatus, body: { error: { code: 'upstream_unavailable' } } };
  if (s.path.endsWith('/images')) return { status: 200, body: { data: [{ b64_json: 'aW1n' }] } };
  return { status: 200, body: completion(s.body?.model) };
});
const openrouter = fakeServer('openrouter', (s) => (s.path.endsWith('/images') ? { status: 200, body: { data: [{ b64_json: 'b3I=' }] } } : { status: 200, body: completion(s.body?.model) }));

let failures = 0;
async function check(label: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`  ✓ ${label}`);
  } catch (error: any) {
    failures += 1;
    console.log(`  ✗ ${label}\n      ${error?.message}`);
  }
}

async function main() {
  const gw = await gateway.listen();
  const or = await openrouter.listen();
  process.env.OPENROUTER_BASE_URL = `${or}/api/v1`;
  process.env.OPENROUTER_API_KEY = 'or-key';

  await check('défaut : tout chez OpenRouter', () => {
    assert.deepEqual([aiBackend('text'), aiBackend('image'), aiBackend('video')], ['openrouter', 'openrouter', 'openrouter']);
    assert.equal(getProvider(LLMProvider.OPENROUTER).baseUrl, `${or}/api/v1`);
  });

  process.env.IDEM_AI_BACKEND = 'idem-ml';
  await check('idem-ml demandé sans adresse : OpenRouter conservé', () => assert.equal(aiBackend('text'), 'openrouter'));

  process.env.IDEM_ML_URL = gw; // sans /v1 : normalisé
  process.env.IDEM_ML_API_KEY = 'ml-key';
  await check('UN réglage : texte, image, vidéo, logo sur idem-ml', () => {
    assert.deepEqual([aiBackend('text'), aiBackend('image'), aiBackend('video'), aiBackend('logo')], ['idem-ml', 'idem-ml', 'idem-ml', 'idem-ml']);
    const def = getProvider(LLMProvider.OPENROUTER);
    assert.equal(def.baseUrl, `${gw}/v1`);
    assert.equal(def.apiKeyEnv, 'IDEM_ML_API_KEY');
    assert.equal(def.servedBy, 'idem-ml');
    assert.ok(!('provider' in (def.extraBody ?? {})), 'pas de routage d’hébergeurs OpenRouter chez nous');
    assert.equal(def.models?.writing, 'deepseek/deepseek-v4.1-flash-1017', 'mêmes identifiants de modèles');
  });
  await check('voix et recherche web restent chez OpenRouter', () => {
    assert.equal(aiBackend('speech'), 'openrouter');
    assert.equal(aiBackend('search'), 'openrouter');
    assert.equal(getProvider(LLMProvider.OPENROUTER, 'search').baseUrl, `${or}/api/v1`);
  });

  process.env.IDEM_AI_BACKEND = `text:idem-ml,image:idem-ml,video:openrouter,logo:idem-ml`;
  await check('format mixte : vidéo reste chez OpenRouter, logo sur idem-ml', () => assert.deepEqual(describeAiBackends(), { text: 'idem-ml', image: 'idem-ml', video: 'openrouter', logo: 'idem-ml', fallback: true, idemMl: `${gw}/v1` }));
  process.env.IDEM_AI_BACKEND = 'idem-ml';

  await check('image servie par idem-ml, sans routage ni politique OpenRouter', async () => {
    const { data, endpoint } = await postToModel<any>('image', '/images', { model: 'black-forest-labs/flux.2-klein-4b', prompt: 'p' });
    assert.equal(endpoint.backend, 'idem-ml');
    assert.equal(data.data[0].b64_json, 'aW1n');
    const last = gateway.seen.at(-1)!;
    assert.equal(last.auth, 'Bearer ml-key');
    assert.equal(last.body.provider, undefined);
  });

  gatewayStatus = 503;
  await check('passerelle en panne : l’image repart chez OpenRouter, politique reposée', async () => {
    const { endpoint } = await postToModel<any>('image', '/images', { model: 'black-forest-labs/flux.2-klein-4b', prompt: 'p' });
    assert.equal(endpoint.backend, 'openrouter');
    const last = openrouter.seen.at(-1)!;
    assert.equal(last.auth, 'Bearer or-key');
    assert.equal(last.body.provider?.data_collection, 'deny');
  });
  await check('disjoncteur : la passerelle est mise de côté après la panne', () => assert.equal(aiBackend('text'), 'openrouter'));
  resetIdemMlBreaker();

  await check('texte (SDK openai) : 503 de la passerelle → rejoué chez OpenRouter', async () => {
    const def = getProvider(LLMProvider.OPENROUTER);
    const client = new OpenAI({ apiKey: process.env[def.apiKeyEnv]!, baseURL: def.baseUrl, maxRetries: 0, fetch: fallbackFetch('text') });
    const before = openrouter.seen.length;
    const res = await client.chat.completions.create({ model: 'deepseek/deepseek-v4.1-flash-1017', messages: [{ role: 'user', content: 'x' }] });
    assert.equal(res.choices[0].message.content, 'ok');
    const replay = openrouter.seen[before];
    assert.equal(replay.path, '/api/v1/chat/completions');
    assert.equal(replay.auth, 'Bearer or-key');
    assert.equal(replay.body.provider?.data_collection, 'deny');
  });
  resetIdemMlBreaker();

  gatewayStatus = 400;
  await check('erreur de requête (400) : pas de repli', async () => {
    await assert.rejects(postToModel('image', '/images', { model: 'm', prompt: 'p' }), (e: any) => e?.response?.status === 400);
  });

  gatewayStatus = 503;
  process.env.IDEM_AI_FALLBACK = 'off';
  await check('IDEM_AI_FALLBACK=off : la panne remonte, rien ne part chez OpenRouter', async () => {
    const before = openrouter.seen.length;
    await assert.rejects(postToModel('image', '/images', { model: 'm', prompt: 'p' }));
    assert.equal(openrouter.seen.length, before);
  });

  gateway.close();
  openrouter.close();
  console.log(`\n${failures ? 'ÉCHEC' : 'OK'} — ${failures} échec(s)`);
  process.exitCode = failures ? 1 : 0;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

import { promptExtra } from './prompt';

export const cacheFunctionRegister = {
  redis: resolveRedis,
};

function resolveRedis(extra: promptExtra) {
  const username = extra.extra['cacheUsername'] ?? '';
  const password = extra.extra['cachePassword'] ?? 'root';
  const databaseUrl = extra.extra['cacheUrl'] ?? 'localhost:3306';
  extra?.extra['backendLanguage'].push(
    `IMPORTANT: Use Redis for caching. Redis URL is ${databaseUrl}, username is ${username}, password is ${password}. Please write this configuration to the backend.`
  );
  return extra?.extra['backendLanguage'];
}

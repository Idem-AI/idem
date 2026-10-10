/**
 * Configuration the AppGen server cannot run without in production.
 *
 * Without CORS_ALLOWED_ORIGINS every browser request from iCode is refused at
 * the CORS preflight ("Failed to fetch"), and without IDEM_API_URL sessions are
 * checked against localhost. Both happened silently in production: the server
 * started, answered /health, and refused every user. It now stops at start-up
 * and says what is missing.
 */
const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/;

export function missingProductionConfig(env: NodeJS.ProcessEnv = process.env): string[] {
  if (env.NODE_ENV !== 'production') return [];
  const problems: string[] = [];
  const origins = (env.CORS_ALLOWED_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean);
  if (origins.length === 0) {
    problems.push('CORS_ALLOWED_ORIGINS (the iCode front origins, comma-separated, e.g. https://appgen.idem.africa)');
  }
  for (const key of ['IDEM_API_URL', 'IDEPLOY_API_URL']) {
    const value = env[key];
    if (!value) problems.push(`${key} (not set)`);
    else if (LOCAL.test(value)) problems.push(`${key} (points to ${value} in production)`);
  }
  return problems;
}

export function assertProductionConfig(env: NodeJS.ProcessEnv = process.env): void {
  const problems = missingProductionConfig(env);
  if (problems.length > 0) {
    throw new Error(`Missing production configuration: ${problems.join('; ')}. See .env.example.`);
  }
}

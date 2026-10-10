import { describe, expect, it } from 'vitest';
import { analyseCompose, renderDotEnv } from '../../../api/services/compose-env.service';

const COMPOSE = `
services:
  api:
    image: acme/api
    env_file: .env
    environment:
      DB: \${DB_PASSWORD:-sygre_pass}
      KEY: \${API_KEY:?required}
      URL: \${SERVICE_FQDN_API}
      PRICE: $$5
  worker:
    image: acme/worker
    env_file:
      - ./.env
      - other.env
    build: .
`;

describe('analyseCompose', () => {
  it('lists the variables with defaults and requirements, not iDeploy placeholders', () => {
    const { variables } = analyseCompose(COMPOSE);
    expect(variables).toEqual([
      { key: 'DB_PASSWORD', default: 'sygre_pass', required: false },
      { key: 'API_KEY', default: null, required: true },
    ]);
  });

  it('reports env files, services and what cannot work', () => {
    const a = analyseCompose(COMPOSE);
    expect(a.services).toEqual(['api', 'worker']);
    expect(a.envFiles).toEqual(['.env', './.env', 'other.env']);
    expect(a.warnings.map((w) => w.code).sort()).toEqual(['BUILD_CONTEXT', 'ENV_FILE_OTHER']);
  });

  it('warns about fixed container names and ports opened on the server', () => {
    const a = analyseCompose('services:\n  app:\n    image: x\n    container_name: my_app\n    ports:\n      - "8080:8080"\n');
    expect(a.warnings.map((w) => w.code).sort()).toEqual(['CONTAINER_NAME', 'HOST_PORTS']);
  });

  it('does not throw on invalid YAML', () => {
    expect(analyseCompose('services: [').warnings[0].code).toBe('INVALID_YAML');
  });
});

describe('renderDotEnv', () => {
  it('keeps values literal and escapes what needs it', () => {
    expect(renderDotEnv([{ key: 'A', value: 'p$ss' }])).toBe("A='p$ss'\n");
    expect(renderDotEnv([{ key: 'B', value: "it's\nme" }])).toBe('B="it\'s\\nme"\n');
  });

  it('drops invalid names and renders nothing for nothing', () => {
    expect(renderDotEnv([{ key: 'bad key', value: 'x' }])).toBe('');
    expect(renderDotEnv([])).toBe('');
  });
});

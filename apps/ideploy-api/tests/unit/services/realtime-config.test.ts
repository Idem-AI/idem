/**
 * Realtime settings that cannot work are said at startup, not lost silently.
 */
import { describe, expect, it } from 'vitest';
import { realtimeConfigProblem } from '../../../api/services/realtime.service';

describe('realtimeConfigProblem', () => {
  it('names a mistyped scheme — the production setting was "http0s"', () => {
    expect(realtimeConfigProblem({ PUSHER_SCHEME: 'http0s' } as NodeJS.ProcessEnv)).toMatch(/PUSHER_SCHEME/);
  });

  it('requires a host and a secret in production', () => {
    expect(realtimeConfigProblem({ NODE_ENV: 'production', PUSHER_SCHEME: 'https' } as NodeJS.ProcessEnv)).toMatch(/PUSHER_HOST/);
    expect(
      realtimeConfigProblem({ NODE_ENV: 'production', PUSHER_SCHEME: 'https', PUSHER_HOST: 'ws.example.com' } as NodeJS.ProcessEnv)
    ).toMatch(/PUSHER_APP_SECRET/);
  });

  it('accepts usable settings', () => {
    expect(
      realtimeConfigProblem({
        NODE_ENV: 'production',
        PUSHER_SCHEME: 'https',
        PUSHER_HOST: 'ws.example.com',
        PUSHER_APP_SECRET: 's',
      } as NodeJS.ProcessEnv)
    ).toBeNull();
    expect(realtimeConfigProblem({} as NodeJS.ProcessEnv)).toBeNull();
  });
});

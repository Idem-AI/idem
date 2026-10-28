/**
 * The CLI's browser sign-in: the code a developer reads in a terminal and
 * types or compares in a browser.
 */
import { describe, it, expect } from 'vitest';
import { cleanHost, normaliseUserCode, userCodeFrom } from '../../../api/services/cli-auth.service';

describe('the code shown in the terminal', () => {
  it('is two groups of four, without characters read one for another', () => {
    const code = userCodeFrom(Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 200, 201]));
    expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(code).not.toMatch(/[01OILZ2S5B8]/);
  });

  it('is read back however it was typed', () => {
    const code = userCodeFrom(Buffer.from([9, 8, 7, 6, 5, 4, 3, 2]));
    expect(normaliseUserCode(code.toLowerCase().replace('-', ' '))).toBe(code);
    expect(normaliseUserCode('ABC')).toBeNull();
    expect(normaliseUserCode('ABCD-EFG0')).toBeNull();
  });
});

describe('the machine named on the approval page', () => {
  it('keeps a short printable name', () => {
    expect(cleanHost('romuald@laptop (linux)')).toBe('romuald@laptop (linux)');
    expect(cleanHost('<script>x</script>')).toBe('scriptxscript');
    expect(cleanHost(42)).toBe('unknown machine');
    expect(cleanHost('a'.repeat(100))).toHaveLength(60);
  });
});

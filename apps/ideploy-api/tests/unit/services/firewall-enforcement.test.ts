/**
 * Rule classification.
 *
 * Whether a rule can be enforced decides whether an application is protected, so
 * the classification must be conservative: anything neither layer can act on has
 * to come back as `unsupported` with a reason, never as a silent no-op. A rule
 * wrongly reported as enforceable is the failure this whole phase exists to
 * prevent.
 *
 * A rule that *is* enforceable still names which layer does it, via
 * `enforcedBy`: an address becomes a CrowdSec decision, applied the instant it
 * is pushed; a country becomes a proxy label, applied only once the application
 * is redeployed. Collapsing that distinction is its own way of overstating
 * protection, which is why a rule may not mix the two scopes.
 *
 * Worth knowing while reading: the rule builder in the current interface only
 * offers `request_path` conditions, so every rule it can create by hand lands in
 * the unsupported half — that needs CrowdSec's AppSec, which is a separate,
 * still-open question. That is a real finding, not a gap in these tests.
 */
import { describe, expect, it } from 'vitest';
import { analyseRule } from '../../../api/services/firewall-enforcement.service';
import { FirewallRule } from '../../../api/services/firewall.service';

function rule(overrides: Partial<FirewallRule> = {}): FirewallRule {
  return {
    id: 1,
    name: 'block-scanner',
    enabled: true,
    priority: 100,
    rule_type: 'inband',
    conditions: [{ field: 'ip', operator: 'equals', value: '203.0.113.5' }],
    logical_operator: 'AND',
    action: 'block',
    ...overrides,
  };
}

describe('analyseRule — enforceable', () => {
  it('accepts a rule naming an address, enforced by CrowdSec', () => {
    const analysis = analyseRule(rule());

    expect(analysis.enforceability).toBe('enforceable');
    expect(analysis.enforcedBy).toBe('crowdsec');
    expect(analysis.targets).toEqual([{ scope: 'ip', value: '203.0.113.5' }]);
  });

  it.each(['ip', 'remote_addr', 'source_ip', 'client_ip'])(
    'recognises %s as an address field',
    (field) => {
      const analysis = analyseRule(
        rule({ conditions: [{ field, operator: 'equals', value: '203.0.113.5' }] })
      );

      expect(analysis.enforceability).toBe('enforceable');
    }
  );

  it('collects addresses from several conditions', () => {
    const analysis = analyseRule({
      ...rule(),
      conditions: [
        { field: 'ip', operator: 'equals', value: '203.0.113.5' },
        { field: 'ip', operator: 'equals', value: '203.0.113.6' },
      ],
    });

    expect(analysis.targets).toEqual([
      { scope: 'ip', value: '203.0.113.5' },
      { scope: 'ip', value: '203.0.113.6' },
    ]);
  });

  it('accepts a list of addresses in one condition', () => {
    const analysis = analyseRule({
      ...rule(),
      conditions: [{ field: 'ip', operator: 'in', value: ['203.0.113.5', '203.0.113.6'] }],
    });

    expect(analysis.targets).toHaveLength(2);
  });

  it('de-duplicates an address named twice', () => {
    const analysis = analyseRule({
      ...rule(),
      conditions: [
        { field: 'ip', operator: 'equals', value: '203.0.113.5' },
        { field: 'remote_addr', operator: 'equals', value: '203.0.113.5' },
      ],
    });

    expect(analysis.targets).toEqual([{ scope: 'ip', value: '203.0.113.5' }]);
  });

  it('parses conditions stored as a JSON string', () => {
    // The column is JSON; some drivers hand it back as text.
    const analysis = analyseRule(
      rule({ conditions: JSON.stringify([{ field: 'ip', operator: 'equals', value: '203.0.113.5' }]) })
    );

    expect(analysis.enforceability).toBe('enforceable');
  });

  it.each(['country', 'country_code', 'geoip_country'])(
    'recognises %s as a country field, enforced by the proxy',
    (field) => {
      const analysis = analyseRule(rule({ conditions: [{ field, operator: 'in', value: ['RU'] }] }));

      expect(analysis.enforceability).toBe('enforceable');
      expect(analysis.enforcedBy).toBe('proxy');
      expect(analysis.targets).toEqual([{ scope: 'country', value: 'RU' }]);
    }
  );

  it('upper-cases a country code, since CrowdSec and the proxy plugin both expect that', () => {
    const analysis = analyseRule(rule({ conditions: [{ field: 'country', operator: 'in', value: 'ru' }] }));

    expect(analysis.targets).toEqual([{ scope: 'country', value: 'RU' }]);
  });
});

describe('analyseRule — unsupported', () => {
  it('rejects a path rule, naming what it would need', () => {
    // The only kind the current rule builder produces.
    const analysis = analyseRule(
      rule({ conditions: [{ field: 'request_path', operator: 'equals', value: '/admin' }] })
    );

    expect(analysis.enforceability).toBe('unsupported');
    expect(analysis.reason).toMatch(/AppSec/);
    expect(analysis.targets).toEqual([]);
  });

  it('rejects a rule mixing an address with something we cannot match', () => {
    // Enforcing half a rule would block more, or less, than the author asked.
    const analysis = analyseRule({
      ...rule(),
      conditions: [
        { field: 'ip', operator: 'equals', value: '203.0.113.5' },
        { field: 'user_agent', operator: 'equals', value: 'curl' },
      ],
    });

    expect(analysis.enforceability).toBe('unsupported');
    expect(analysis.targets).toEqual([]);
  });

  it('rejects a rule mixing an address with a country', () => {
    // The two are applied by different layers at different moments — CrowdSec
    // immediately, the proxy only at the next deploy — so one rule cannot report
    // one combined state that means anything.
    const analysis = analyseRule({
      ...rule(),
      conditions: [
        { field: 'ip', operator: 'equals', value: '203.0.113.5' },
        { field: 'country', operator: 'in', value: ['RU'] },
      ],
    });

    expect(analysis.enforceability).toBe('unsupported');
    expect(analysis.reason).toMatch(/cannot mix addresses and countries/i);
  });

  it('rejects an operator it cannot translate', () => {
    const analysis = analyseRule({
      ...rule(),
      conditions: [{ field: 'ip', operator: 'matches_regex', value: '203\\.0\\..*' }],
    });

    expect(analysis.enforceability).toBe('unsupported');
    expect(analysis.reason).toMatch(/matches_regex/);
  });

  it('rejects a rule with no conditions', () => {
    expect(analyseRule(rule({ conditions: [] })).enforceability).toBe('unsupported');
  });

  it('rejects a rule whose condition names no value', () => {
    const analysis = analyseRule({
      ...rule(),
      conditions: [{ field: 'ip', operator: 'equals', value: '' }],
    });

    expect(analysis.enforceability).toBe('unsupported');
    expect(analysis.reason).toMatch(/nothing to block/i);
  });

  it('rejects an allow rule, which has no decision equivalent', () => {
    // CrowdSec blocks what it is told about and permits everything else, so an
    // allow rule would apply cleanly and change nothing.
    const analysis = analyseRule(rule({ action: 'allow' }));

    expect(analysis.enforceability).toBe('unsupported');
    expect(analysis.reason).toMatch(/blocking rules/i);
  });

  it('survives conditions that are not valid JSON', () => {
    const analysis = analyseRule(rule({ conditions: 'not json at all' }));

    expect(analysis.enforceability).toBe('unsupported');
  });

  it('always explains itself', () => {
    // An unsupported rule with no reason leaves the user unable to fix it.
    const unsupported = [
      rule({ conditions: [] }),
      rule({ conditions: [{ field: 'request_path', operator: 'equals', value: '/x' }] }),
      rule({ action: 'allow' }),
    ].map(analyseRule);

    for (const analysis of unsupported) {
      expect(analysis.reason, `rule ${analysis.name}`).toBeTruthy();
    }
  });
});

describe('analyseRule — identity', () => {
  it('carries the rule id and name through, so the report can point at it', () => {
    const analysis = analyseRule(rule({ id: 42, name: 'block-known-scanner' }));

    expect(analysis.ruleId).toBe(42);
    expect(analysis.name).toBe('block-known-scanner');
  });
});

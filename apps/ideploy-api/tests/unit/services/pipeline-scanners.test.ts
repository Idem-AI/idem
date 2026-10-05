/**
 * Trivy results read from its JSON, and the rule that fails a pipeline.
 */
import { describe, expect, it } from 'vitest';
import { sonarConfig, summariseTrivy, trivyFails } from '../../../api/services/pipeline-scanners.service';

const report = JSON.stringify({
  Results: [
    {
      Target: 'package-lock.json',
      Vulnerabilities: [
        { VulnerabilityID: 'CVE-1', PkgName: 'lodash', InstalledVersion: '4.17.0', FixedVersion: '4.17.21', Severity: 'HIGH', Title: 'Prototype pollution' },
        { VulnerabilityID: 'CVE-2', PkgName: 'minimist', InstalledVersion: '0.0.8', Severity: 'CRITICAL', Title: 'Prototype pollution' },
        { VulnerabilityID: 'CVE-3', PkgName: 'debug', InstalledVersion: '2.6.0', Severity: 'LOW' },
      ],
    },
    {
      Target: 'backend/package-lock.json',
      // The same CVE in the same package version is one problem.
      Vulnerabilities: [{ VulnerabilityID: 'CVE-1', PkgName: 'lodash', InstalledVersion: '4.17.0', Severity: 'HIGH' }],
    },
    { Target: '.env', Secrets: [{ RuleID: 'aws-access-key-id', Title: 'AWS Access Key ID', Severity: 'CRITICAL', StartLine: 3, Match: 'AKIA…' }] },
  ],
});

describe('summariseTrivy', () => {
  it('counts by severity, lists the worst first, and keeps secrets without their value', () => {
    const s = summariseTrivy(`2026-10-05T10:00:00Z INFO progress\n${report}`);
    expect(s.counts).toEqual({ CRITICAL: 1, HIGH: 1, MEDIUM: 0, LOW: 1, UNKNOWN: 0 });
    expect(s.findings.map((f) => f.id)).toEqual(['CVE-2', 'CVE-1', 'CVE-3']);
    expect(s.findings[1]).toMatchObject({ package: 'lodash', installed: '4.17.0', fixed: '4.17.21' });
    expect(s.secrets).toEqual([{ target: '.env', rule: 'AWS Access Key ID', severity: 'CRITICAL', line: 3 }]);
    expect(JSON.stringify(s.secrets)).not.toContain('AKIA');
  });

  it('reports nothing rather than guessing from unreadable output', () => {
    expect(summariseTrivy('FATAL error').counts.CRITICAL).toBe(0);
  });
});

describe('trivyFails', () => {
  const counts = { CRITICAL: 0, HIGH: 2, MEDIUM: 5, LOW: 1, UNKNOWN: 0 };
  it('fails at or above the threshold only', () => {
    expect(trivyFails(counts, 'CRITICAL')).toBe(false);
    expect(trivyFails(counts, 'HIGH')).toBe(true);
    expect(trivyFails(counts, 'NONE')).toBe(false);
  });
});

describe('sonarConfig', () => {
  it('needs both the URL and an administrator token', () => {
    expect(sonarConfig({ SONARQUBE_URL: 'https://sonar.example.com/' } as NodeJS.ProcessEnv)).toBeNull();
    expect(sonarConfig({ SONARQUBE_URL: 'https://sonar.example.com/', SONARQUBE_ADMIN_TOKEN: 't' } as NodeJS.ProcessEnv)).toEqual({
      url: 'https://sonar.example.com',
      token: 't',
    });
  });
});

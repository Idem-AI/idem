import { describe, expect, it } from 'vitest';
import { declaredJavaVersion, jdkFor, parseProbe, planJavaBuild } from '../../../api/services/java-build';
import { defaultGates, parseGates, resolveGates } from '../../../api/services/pipeline-gates';

describe('pipeline gates', () => {
  it('only stops on committed secrets by default', () => {
    expect(defaultGates({})).toEqual({ trivy_fail_on: 'NONE', quality_gate: 'report', secrets: 'block' });
  });

  it('lets the operator set the platform default, and the application override it', () => {
    expect(defaultGates({ PIPELINE_TRIVY_FAIL_ON: 'high' }).trivy_fail_on).toBe('HIGH');
    expect(resolveGates({ gates: { trivy_fail_on: 'CRITICAL' } }, { PIPELINE_TRIVY_FAIL_ON: 'HIGH' }).trivy_fail_on).toBe('CRITICAL');
    expect(resolveGates({ gates: { trivy_fail_on: 'bogus' } }, {}).trivy_fail_on).toBe('NONE');
    expect(resolveGates(null, {}).quality_gate).toBe('report');
  });

  it('refuses an unknown value from a client', () => {
    expect(() => parseGates({ trivy_fail_on: 'ALL' })).toThrow();
    expect(() => parseGates({ quality_gate: 'maybe' })).toThrow();
    expect(parseGates({ secrets: 'report' })).toEqual({ secrets: 'report' });
  });
});

describe('java build plan', () => {
  it('reads the Java version and picks the lowest LTS that can compile it', () => {
    expect(declaredJavaVersion('<java.version>1.8</java.version>')).toBe(8);
    expect(declaredJavaVersion('<maven.compiler.release>17</maven.compiler.release>')).toBe(17);
    expect(declaredJavaVersion("sourceCompatibility = '11'")).toBe(11);
    expect(declaredJavaVersion('languageVersion = JavaLanguageVersion.of(21)')).toBe(21);
    expect(declaredJavaVersion('nothing here')).toBeNull();
    expect([jdkFor(null), jdkFor(8), jdkFor(9), jdkFor(12), jdkFor(18), jdkFor(25)]).toEqual([21, 8, 11, 17, 21, 21]);
  });

  it('plans Maven at the shallowest build file, Gradle with its wrapper when there is one', () => {
    expect(planJavaBuild({ buildFiles: ['api/pom.xml', 'pom.xml'], hasJava: true, buildText: '' })).toMatchObject({ tool: 'maven', dir: '.', image: 'maven:3.9-eclipse-temurin-21' });
    expect(planJavaBuild({ buildFiles: ['svc/build.gradle', 'svc/gradlew'], hasJava: true, buildText: "sourceCompatibility = '17'" })).toMatchObject({
      tool: 'gradle',
      dir: 'svc',
      image: 'eclipse-temurin:17-jdk',
      command: 'sh ./gradlew --no-daemon -q classes -x test',
    });
    expect(planJavaBuild({ buildFiles: ['build.gradle.kts'], hasJava: true, buildText: '' })?.image).toBe('gradle:jdk21');
  });

  it('plans nothing without Java or without a build tool', () => {
    expect(planJavaBuild({ buildFiles: ['pom.xml'], hasJava: false, buildText: '' })).toBeNull();
    expect(planJavaBuild({ buildFiles: ['gradlew'], hasJava: true, buildText: '' })).toBeNull();
    expect(parseProbe('BUILD=pom.xml\nHASJAVA=1\n')).toEqual({ buildFiles: ['pom.xml'], hasJava: true });
  });
});

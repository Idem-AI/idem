/**
 * Which database a repository's code is built for, from its drivers.
 */
import { describe, expect, it } from 'vitest';
import { detectDatabaseEngines } from '../../../api/services/ecosystem-detection.service';

const repo = (files: Record<string, string>) => ({ getFile: async (path: string) => files[path] ?? null });

describe('detectDatabaseEngines', () => {
  it('reads a Spring Boot backend built for MySQL only', async () => {
    // The guide linked this exact backend to a PostgreSQL database.
    const engines = await detectDatabaseEngines(
      repo({
        'pom.xml': '<dependency><groupId>com.mysql</groupId><artifactId>mysql-connector-j</artifactId></dependency>',
        'src/main/resources/application.properties': 'spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.MySQLDialect',
      })
    );
    expect(engines).toEqual(['mysql']);
  });

  it('reads Node, Python and URL-based declarations', async () => {
    expect(await detectDatabaseEngines(repo({ 'package.json': '{"dependencies":{"pg":"^8.11.0"}}' }))).toEqual(['postgresql']);
    expect(await detectDatabaseEngines(repo({ 'requirements.txt': 'Django\npsycopg2-binary==2.9' }))).toEqual(['postgresql']);
    expect(await detectDatabaseEngines(repo({ '.env.example': 'DATABASE_URL=mysql://u:p@db:3306/app' }))).toEqual(['mysql']);
    expect(await detectDatabaseEngines(repo({ 'package.json': '{"dependencies":{"mongoose":"^8"}}' }))).toEqual(['mongodb']);
  });

  it('names nothing when the code names no driver', async () => {
    expect(await detectDatabaseEngines(repo({ 'package.json': '{"dependencies":{"express":"^4"}}' }))).toEqual([]);
  });
});

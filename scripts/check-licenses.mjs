#!/usr/bin/env node
/**
 * `npm run check:licenses` — les licences des dépendances des moteurs créatifs (registre du plan qualité créative,
 * `PLAN-QUALITE-CREATIVE-MOTEURS.md` §2). Le dépôt est sous Apache 2.0 avec Commons Clause : une dépendance doit être
 * permissive, ou figurer dans les EXCEPTIONS décidées (avec leur raison). Certaines sont refusées nommément.
 *
 * Lit la licence du paquet INSTALLÉ (champ `license`, sinon son fichier LICENSE), pas une déclaration de seconde main.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCOPES = ['packages/design-tools', 'packages/graphic-engine', 'packages/motion-compiler', 'apps/ivision/core'];

const ALLOWED = new Set(['MIT', 'MIT-0', 'Apache-2.0', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', '0BSD', 'Unlicense', 'CC0-1.0', 'BlueOak-1.0.0', 'Python-2.0', 'MPL-2.0', 'OFL-1.1', 'Zlib']);

/** Les exceptions décidées, et pourquoi. */
const EXCEPTIONS = {
  gsap: 'licence « Standard no charge » de GreenSock/Webflow, gratuite en usage commercial — retenue par décision du 04/11/2026 (clause d’usages interdits à garder en tête : outils d’animation sans code concurrents de Webflow)',
  '@hyperframes/producer': 'Apache-2.0 (fichier LICENSE du paquet ; le champ `license` manque dans npm)',
  '@hyperframes/lint': 'Apache-2.0 (fichier LICENSE du paquet ; le champ `license` manque dans npm)',
  '@hyperframes/core': 'Apache-2.0 (fichier LICENSE du paquet)',
  '@hyperframes/engine': 'Apache-2.0 (fichier LICENSE du paquet)',
};

/** Les paquets refusés (licence incompatible ou trop restrictive). */
const FORBIDDEN = {
  'apca-w3': 'licence limitée aux contenus WCAG, brevet en attente — contraste WCAG 2 à la place',
  remotion: 'licence propre, payante au-delà de 3 employés',
  '@remotion/renderer': 'licence propre, payante au-delà de 3 employés',
  potrace: 'GPL, incompatible avec la Commons Clause',
  'firecrawl': 'AGPL-3.0',
};

function findPackage(name, fromDir) {
  for (let dir = path.join(ROOT, fromDir); ; dir = path.dirname(dir)) {
    const file = path.join(dir, 'node_modules', name, 'package.json');
    if (fs.existsSync(file)) return file;
    if (dir === ROOT || path.dirname(dir) === dir) return null;
  }
}

function licenseOf(pkgFile) {
  const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
  let license = typeof pkg.license === 'string' ? pkg.license : pkg.license?.type || (Array.isArray(pkg.licenses) ? pkg.licenses.map((l) => l.type).join(' OR ') : '');
  if (!license) {
    const dir = path.dirname(pkgFile);
    const file = fs.readdirSync(dir).find((f) => /^licen[cs]e/i.test(f));
    const text = file ? fs.readFileSync(path.join(dir, file), 'utf8').slice(0, 600) : '';
    license = /Apache License[\s\S]*Version 2\.0/.test(text) ? 'Apache-2.0' : /MIT License|Permission is hereby granted, free of charge/.test(text) ? 'MIT' : /ISC License/.test(text) ? 'ISC' : '';
  }
  return license;
}

const accepts = (license) => license.replace(/[()]/g, '').split(/\s+OR\s+/i).some((l) => ALLOWED.has(l.trim()));

let failures = 0;
const seen = new Set();
for (const scope of SCOPES) {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, scope, 'package.json'), 'utf8'));
  for (const name of Object.keys(manifest.dependencies || {})) {
    if (name.startsWith('@idem/') || seen.has(name)) continue;
    seen.add(name);
    if (FORBIDDEN[name]) {
      console.log(`✗ ${name} (${scope}) — refusé : ${FORBIDDEN[name]}`);
      failures++;
      continue;
    }
    const file = findPackage(name, scope);
    if (!file) {
      console.log(`· ${name} (${scope}) — non installé ici, non vérifié`);
      continue;
    }
    const license = licenseOf(file);
    if (accepts(license)) continue;
    if (EXCEPTIONS[name]) {
      console.log(`· ${name} — exception : ${EXCEPTIONS[name]}`);
      continue;
    }
    console.log(`✗ ${name} (${scope}) — licence « ${license || 'absente'} » hors registre`);
    failures++;
  }
}
console.log(`\n${failures ? '✗' : '✓'} Licences : ${seen.size} dépendance(s) des moteurs créatifs examinée(s), ${failures} en échec.`);
process.exit(failures ? 1 : 0);

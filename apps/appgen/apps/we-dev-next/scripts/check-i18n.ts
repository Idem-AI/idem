/**
 * Contrôle des langues des sites, sans modèle : `npm run check:i18n`.
 *
 * Il prouve que le code enveloppe les textes affichés (et seulement eux), que les liens internes suivent la langue,
 * que la transformation est idempotente et que le résultat se relit, puis que le runtime du template traduit,
 * préfixe les liens et lit les faits à travers `localize()`.
 */
import ts from 'typescript';
import { readFileSync, mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build, transformSync } from 'esbuild';
import { buildI18nKit } from '../src/scaffold/shared.js';
import { buildScaffold } from '../src/scaffold/index.js';
import { collectMessages, dataMessages, isProse, localizeCode, renderI18nFiles } from '../src/siteEngine/i18n.js';

let failures = 0;
let passed = 0;
const expect = (label: string, ok: boolean, detail = '') => {
  if (ok) passed += 1;
  else {
    failures += 1;
    console.error(`ÉCHEC ${label}${detail ? `\n${detail}` : ''}`);
  }
};

const SECTION = `import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { site } from '@/site/data';

const services = [
  { title: 'Formation des éducateurs', text: 'Des ateliers pratiques pour les enseignants.', icon: 'GraduationCap', href: '/services/' },
  { title: 'Accès aux ressources', text: "Une bibliothèque numérique ouverte à tous.", icon: 'BookOpen', href: '/ressources/' },
];

export default function Services({ tone = 'primary' }: { tone?: string }) {
  const label = 'Découvrir nos services';
  return (
    <section id="services" className={cn('py-section', tone === 'primary' && 'bg-surface')}>
      <h2 className="text-h2 font-heading">Nos services pour l&apos;éducation numérique</h2>
      <p>
        Bienvenue chez {site.name}, nous agissons depuis 2015.
      </p>
      <img src="/media/hero.webp" alt="Enfants devant un ordinateur" className="rounded-card" />
      <input placeholder="Votre adresse e-mail" type="email" name="email" />
      <ul>
        {services.map((t) => (
          <li key={t.title}>
            <a href={t.href}>{t.title}</a>
            <span>{t.text}</span>
          </li>
        ))}
      </ul>
      <motion.div initial={{ opacity: 0 }} transition={{ ease: 'easeOut' }} />
      <Button asChild variant="default" size="lg"><a href="/contact/">{label} <ArrowRight className="size-4" /></a></Button>
      <a href="https://wa.me/237600000000">WhatsApp</a>
      <a href="#contact" aria-label="Aller au formulaire">Contact</a>
    </section>
  );
}
`;

const out = localizeCode(SECTION, 'Services.tsx');
const has = (text: string) => out.code.includes(text);
expect('le fichier a changé', out.changed);
expect('`t` est pris par un paramètre : import renommé', has("import { t as translate, localePath } from '@/i18n';"), out.code);
expect('texte JSX enveloppé', has(`{translate("Nos services pour l'éducation numérique")}`), out.code);
expect('phrase coupée par une valeur : une seule phrase', has('{translate("Bienvenue chez {name}, nous agissons depuis 2015.", { name: site.name })}'), out.code);
expect('alt et placeholder', has(`alt={translate("Enfants devant un ordinateur")}`) && has(`placeholder={translate("Votre adresse e-mail")}`));
expect('aria-label', has(`aria-label={translate("Aller au formulaire")}`));
expect('textes des listes de contenu', has(`title: translate("Formation des éducateurs")`) && has(`text: translate("Une bibliothèque numérique ouverte à tous.")`));
expect('variable de texte', has(`const label = translate("Découvrir nos services")`));
expect('icônes, liens, classes, variantes et animations intacts', has(`icon: 'GraduationCap'`) && has(`href: '/services/'`) && has(`cn('py-section', tone === 'primary' && 'bg-surface')`) && has(`variant="default"`) && has(`ease: 'easeOut'`) && has(`tone = 'primary'`) && has(`src="/media/hero.webp"`) && has('name="email"'));
expect('liens internes suivis', has('href={localePath(t.href)}') && has('href={localePath("/contact/")}'), out.code);
expect('liens externes et ancres intacts', has('href="https://wa.me/237600000000"') && has('href="#contact"'));
const again = localizeCode(out.code, 'Services.tsx');
expect('idempotent', again.code === out.code, again.code);
const parsed = ts.createSourceFile('x.tsx', out.code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX) as ts.SourceFile & { parseDiagnostics?: unknown[] };
expect('se relit', !parsed.parseDiagnostics?.length);

const simple = localizeCode(`export default function Hero() {\n  return <h1>Bonjour</h1>;\n}\n`, 'Hero.tsx');
expect('import ajouté sous la forme courte', simple.code.startsWith("import { t } from '@/i18n';") && simple.code.includes('{t("Bonjour")}'), simple.code);

const catalog = collectMessages({ 'src/sections/home/Services.tsx': out.code, 'src/sections/home/Hero.tsx': simple.code, 'src/i18n/index.ts': 't("ignoré")' });
expect('catalogue relevé', catalog.includes('Bonjour') && catalog.includes("Nos services pour l'éducation numérique") && catalog.includes('Formation des éducateurs') && !catalog.includes('ignoré'), JSON.stringify(catalog));

expect('isProse : classes et identifiants refusés', !isProse('flex items-center gap-2') && !isProse('easeOut') && !isProse('ArrowRight') && !isProse('/contact/') && !isProse('a@b.co') && isProse('Contact') && isProse('Nos services'));
const data = dataMessages({ name: 'EKnumeriK', description: 'Une association engagée.', contact: { phone: '+237 6', email: 'a@b.co' }, navigation: [{ label: 'À propos', href: '/a-propos/' }], language: 'fr' });
expect('faits : textes relevés, coordonnées laissées', data.includes('Une association engagée.') && data.includes('À propos') && !data.includes('/a-propos/') && !data.includes('a@b.co') && !data.includes('EKnumeriK'), JSON.stringify(data));

// Le runtime du template, compilé et exécuté pour de vrai.
const dir = mkdtempSync(join(tmpdir(), 'i18n-'));
const files = renderI18nFiles('fr', { fr: {}, en: { Bonjour: 'Hello', 'À propos': 'About', 'Bienvenue {nom}': 'Welcome {nom}' } });
mkdirSync(join(dir, 'messages'), { recursive: true });
for (const [path, content] of Object.entries(files)) writeFileSync(join(dir, path.replace('src/i18n/', '')), content);
writeFileSync(join(dir, 'index.ts'), readFileSync(new URL('../src/siteEngine/template/src/i18n/index.ts', import.meta.url), 'utf8'));
writeFileSync(join(dir, 'probe.ts'), `import { t, localePath, localize, stripLanguage, languages } from './index';
const site = localize({ navigation: [{ label: 'À propos', href: '/a-propos/' }] });
const g = globalThis as { __IDEM_LANG__?: string };
const read = () => ({ hello: t('Bonjour'), vars: t('Bienvenue {nom}', { nom: 'Awa' }), path: localePath('/a-propos/'), file: localePath('/media/a.webp'), ext: localePath('https://x.com'), nav: site.navigation.map((l) => l.label).join(','), strip: stripLanguage('/en/contact/') });
g.__IDEM_LANG__ = 'fr';
const fr = read();
g.__IDEM_LANG__ = 'en';
const en = read();
console.log(JSON.stringify({ languages, fr, en }));
`);
const bundle = await build({ entryPoints: [join(dir, 'probe.ts')], bundle: true, write: false, format: 'esm', platform: 'node' });
writeFileSync(join(dir, 'probe.mjs'), bundle.outputFiles[0].text);
const { execFileSync } = await import('node:child_process');
const result = JSON.parse(execFileSync(process.execPath, [join(dir, 'probe.mjs')], { encoding: 'utf8' }));
expect('runtime : langues', result.languages.join() === 'fr,en', JSON.stringify(result));
expect('runtime : langue principale inchangée', result.fr.hello === 'Bonjour' && result.fr.path === '/a-propos/' && result.fr.nav === 'À propos' && result.fr.vars === 'Bienvenue Awa');
expect('runtime : traduction, liens préfixés, faits traduits', result.en.hello === 'Hello' && result.en.path === '/en/a-propos/' && result.en.nav === 'About' && result.en.vars === 'Welcome Awa' && result.en.strip === '/contact/', JSON.stringify(result.en));
expect('runtime : fichiers et liens externes intacts', result.en.file === '/media/a.webp' && result.en.ext === 'https://x.com');

// Les applications : le module de langues posé dans chaque projet se compile, l'entrée l'enveloppe.
const kit = buildI18nKit('fr');
for (const [path, content] of Object.entries(kit)) {
  if (!/\.(jsx?|json)$/.test(path)) continue;
  try {
    if (path.endsWith('.json')) JSON.parse(content);
    else transformSync(content, { loader: path.endsWith('.jsx') ? 'jsx' : 'js', jsx: 'automatic' });
    expect(`application : ${path} se compile`, true);
  } catch (error) {
    expect(`application : ${path} se compile`, false, (error as Error).message);
  }
}
const web = buildScaffold({ target: 'web-app', language: 'fr' });
expect('application web : runtime verrouillé, config modifiable', web.locked.includes('frontend/src/i18n/index.js') && !web.locked.includes('frontend/src/i18n/config.json') && 'frontend/src/i18n/config.json' in web.files);
expect('application web : entrée enveloppée', /<LanguageRoot>/.test(web.files['frontend/src/main.jsx'] ?? ''));
const mobile = buildScaffold({ target: 'mobile-app', language: 'en' });
expect('application mobile : langues posées, anglais par défaut', JSON.parse(mobile.files['src/i18n/config.json'] ?? '{}').defaultLanguage === 'en' && mobile.locked.includes('src/components/LanguageSwitcher.jsx') && /<LanguageRoot>/.test(mobile.files['src/main.jsx'] ?? ''));
const site = buildScaffold({ target: 'site', language: 'fr' });
expect('site : système de langues du template présent', ['src/i18n/index.ts', 'src/i18n/config.json', 'src/components/site/language-switcher.tsx'].every((path) => path in site.files));

console.log(`${passed} contrôles réussis, ${failures} en échec`);
process.exit(failures ? 1 : 0);

/**
 * ÉCHANTILLON RÉEL de la chaîne graphique — VRAIS MODÈLES, donc payant (≈ 6 à 9 appels par page) :
 *
 *   npm run sample:graphic -- <dossier de sortie> [couverture,palette,usage-logo,bp-finance]
 *
 * Quatre pages AgriLink au cran Medium (couverture forcée en Ultra) passent par toute la chaîne — directeur de page,
 * auteur, mesure du code, ajustement, relecteur visuel — et leurs rendus PNG sont enregistrés pour être REGARDÉS.
 * Les contrôles `check:*` simulent les modèles ; seul cet échantillon dit la qualité réelle. À lancer avec parcimonie.
 */
import { loadSecrets } from '../config/secrets';
import fs from 'fs';
import path from 'path';
import '../services/graphic/engine.host';
import { brandFromIdem, coverContent, createDocument, withDataChart, SectionContent } from '@idem/graphic-engine';

const OUT = process.argv[2];
const ONLY = (process.argv[3] ?? '').split(',').filter(Boolean);
const want = (name: string) => !ONLY.length || ONLY.some((o) => name.includes(o));
const svg = (fill: string, ground: string) =>
  'data:image/svg+xml;base64,' + Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="${ground}"/><circle cx="60" cy="60" r="44" fill="none" stroke="${fill}" stroke-width="7"/><circle cx="91" cy="29" r="8" fill="#E85D3A"/><text x="60" y="78" text-anchor="middle" font-family="Georgia" font-weight="700" font-size="52" fill="${fill}">A</text></svg>`).toString('base64');
const LIGHT = svg('#1B7A7A', 'none');
const DARK = svg('#F2F7F7', 'none');
const MONO = svg('#111111', 'none');
const branding = {
  colors: { colors: { primary: '#1B7A7A', secondary: '#D4A017', accent: '#E85D3A', background: '#F2F7F7', text: '#1A2E2E' } },
  typography: { primaryFont: 'Young Serif', secondaryFont: 'Karla' },
  artDirection: { styleId: 'vector-art', keywords: ['vector', 'flat colour', 'circle seal'], imagery: { medium: 'illustration', treatment: 'flat colour, no gradient', lighting: 'none' }, imagePromptModifier: 'flat vector illustration, solid colour fills, no gradients, no texture' },
};
(async () => {
  await loadSecrets();
  fs.mkdirSync(OUT, { recursive: true });
  const { brand, direction } = brandFromIdem({ name: 'AgriLink', branding: branding as never, logos: { primary: LIGHT, withTextLight: LIGHT, withTextDark: DARK, withTextMono: MONO, icon: LIGHT } });
  const user = { userId: undefined, projectId: undefined };
  const shots: Array<{ name: string; out: { png?: Buffer; result: { repairs: Array<{ code: string; detail: string }>; issues: Array<{ code: string; severity: string; message: string }>; usage: unknown } } }> = [];
  const charter = await createDocument({
    documentType: 'brand-charter', format: 'slide-16x9', brand, direction, creativity: 'medium', seed: `live-${Date.now()}`, png: true, locale: 'fr',
    brief: 'AgriLink installe des bornes tactiles dans des lieux sécurisés : les agriculteurs sans smartphone achètent intrants et vendent leurs récoltes.',
    sections: [{ id: 'cover', role: 'cover' }, { id: 'palette', role: 'specimen' }, { id: 'logo-usage', role: 'specimen' }],
    user,
  });
  if (want('1-couverture')) shots.push({ name: '1-couverture', out: await charter.composeSection(coverContent({ id: 'cover', brandName: 'AgriLink', documentLabel: 'Charte graphique', kicker: 'Agriculture connectée', promise: 'Le marché à portée de main, sans smartphone ni internet.', detail: 'Version 1.0', dateLabel: 'Octobre 2026' }), { index: 1, total: 3 }) });
  const palette: SectionContent = { id: 'palette', role: 'specimen', title: 'Palette de couleurs', blocks: [{ id: 'sys-1', kind: 'swatches', origin: 'system', items: [
    { hex: '#1B7A7A', name: 'Primaire', role: 'Identité, titres, aplats' }, { hex: '#D4A017', name: 'Secondaire', role: 'Zones calmes' }, { hex: '#E85D3A', name: 'Accent', role: 'Chiffres, appels' }, { hex: '#F2F7F7', name: 'Fond', role: 'Surface de page' }, { hex: '#1A2E2E', name: 'Encre', role: 'Texte courant' } ] }] } as SectionContent;
  if (want('2-palette')) shots.push({ name: '2-palette', out: await charter.composeSection(palette, { index: 2, total: 3 }) });
  const usage: SectionContent = { id: 'logo-usage', role: 'specimen', title: "Règles d'usage du logo", blocks: [
    { id: 'sys-1', kind: 'logoDisplay', origin: 'system', variants: [{ url: LIGHT, label: 'Sur fond clair', background: 'light' }, { url: DARK, label: 'Sur fond sombre', background: 'dark' }, { url: MONO, label: 'Monochrome', background: 'neutral' }] },
    { id: 'c1', kind: 'cards', items: [{ title: 'Zone de protection', body: 'Égale à la hauteur du « A », de chaque côté.' }, { title: 'Taille minimale', body: '12 mm à l’impression, 60 px à l’écran.' }, { title: 'Interdit', body: 'Ne pas incliner, déformer ni poser sur une photo.' }] },
  ] } as SectionContent;
  if (want('3-usage-logo')) shots.push({ name: '3-usage-logo', out: await charter.composeSection(usage, { index: 3, total: 3 }) });
  const bp = await createDocument({ documentType: 'business-plan', format: 'a4-portrait', brand, direction, creativity: 'medium', seed: `live-bp-${Date.now()}`, png: true, locale: 'fr', sections: [{ id: 'finance' }, { id: 'market' }], user });
  const finance = withDataChart({ id: 'finance', title: 'Plan financier', lede: 'Trois exercices pour atteindre l’équilibre.', blocks: [
    { id: 'p1', kind: 'prose', paragraphs: ['Le chiffre d’affaires suit le déploiement des bornes : 12 la première année, 40 la deuxième, 90 la troisième. Les charges fixes portent la maintenance et les agents de terrain ; la marge brute reste stable autour de 65 %.', 'Le résultat net reste négatif deux ans, le temps d’amortir les bornes, et devient positif la troisième année.'] },
    { id: 't1', kind: 'table', headers: ['Indicateur', '2026', '2027', '2028'], rows: [['Chiffre d’affaires (XAF)', '6 650 000', '31 680 000', '81 750 000'], ['Marge brute (%)', '65,0 %', '65,5 %', '66,4 %'], ['Résultat net (XAF)', '-23 811 333', '-7 285 607', '13 705 608']] },
  ] } as SectionContent, 'fr');
  if (want('4-bp-finance')) shots.push({ name: '4-bp-finance', out: await bp.composeSection(finance, { index: 1, total: 2 }) });
  for (const s of shots) {
    if (s.out.png) fs.writeFileSync(path.join(OUT, `${s.name}.png`), s.out.png);
    console.log(`\n== ${s.name}`, JSON.stringify(s.out.result.usage));
    console.log('  réparations :', s.out.result.repairs.map((r) => `${r.code}: ${r.detail.slice(0, 160)}`).join('\n    '));
    console.log('  constats bloquants :', s.out.result.issues.filter((i) => i.severity === 'blocking').map((i) => i.message.slice(0, 160)).join(' | ') || 'aucun');
  }
  process.exit(0);
})().catch((e) => { console.error('ÉCHEC', e?.message ?? e); process.exit(1); });

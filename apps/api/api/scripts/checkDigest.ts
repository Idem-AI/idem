/** Contrôle du DIGEST construit par le code (diagnostic S1/S2) — `npm run check:digest`. Aucun appel. */
import assert from 'assert';
import { digestFromStructured, digestSection, rememberStructured } from '../services/agents/section-digest.service';

const section = {
  title: 'Analyse du marché',
  blocks: [
    { type: 'metrics', items: [{ value: '2,3 Md FCFA', label: 'Taille du marché' }, { value: '18 %', label: 'Croissance annuelle' }] },
    { type: 'prose', text: 'Le marché croît vite. Douala et Yaoundé concentrent 62 % de la demande. Une phrase générale sans fait utile qui ne doit pas passer.' },
    { type: 'table', rows: [['Segment', 'Part'], ['PME', '40 %']] },
  ],
};
const facts = digestFromStructured(section);
assert.ok(facts.includes('Taille du marché : 2,3 Md FCFA'));
assert.ok(facts.includes('62 %'));
assert.ok(facts.includes('PME · 40 %'));
assert.ok(!facts.includes('phrase générale'));
assert.ok(!/\bmetrics\b|\bprose\b/.test(facts), 'les noms techniques des blocs ne passent pas');

(async () => {
  const html = `<section>${'x'.repeat(5000)}</section>`;
  rememberStructured(html, section);
  const d = await digestSection('Analyse du marché', html);
  assert.equal(d.origin, 'deterministic', 'une section structurée connue se résume SANS modèle');
  assert.ok(d.text.includes('2,3 Md FCFA'));
  console.log('✓ Digest par le code : faits extraits de l’objet, 0 appel de modèle.');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

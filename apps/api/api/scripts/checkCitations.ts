/**
 * Contrôle du VÉRIFICATEUR DE CITATIONS par le code — `npm run check:citations` (diagnostic RS1/RS2). Aucun appel.
 */
import assert from 'assert';
import { checkCitations, isQuantified, stripUncited } from '../services/research/citation-check';

const ids = ['s0', 's1'];
assert.ok(isQuantified('Le marché pèse 2,3 Md FCFA.'));
assert.ok(isQuantified('La part atteint 18 % des ménages.'));
assert.ok(!isQuantified('Le lancement est prévu en 2027.'), 'une année seule n’est pas une donnée');
assert.ok(!isQuantified('Étape 2 : recruter l’équipe commerciale.'), 'un numéro d’étape non plus');

const v = checkCitations('Le marché pèse 2,3 Md FCFA [s0]. La part atteint 18 % des ménages. Un taux de 12 % [s9] est annoncé. Lancement en 2027.', ids);
assert.equal(v.citedClaims, 1);
assert.equal(v.uncitedClaims, 2, 'sans marqueur, et marqueur inconnu');
assert.equal(v.passed, false);
assert.ok(checkCitations('Rien de chiffré ici.', ids).passed);

const section = JSON.stringify({
  title: 'Analyse du marché',
  blocks: [
    { type: 'prose', text: 'Le marché camerounais du transport pèse 2,3 Md FCFA [s0]. Il croît de 12 % par an sans aucune source citée. La demande est portée par la jeunesse urbaine.' },
    { type: 'metrics', items: [{ value: '18 %', label: 'Part visée' }] },
  ],
});
const out = stripUncited(section, ids, 'fr');
assert.equal(out.removed.length, 1);
const parsed = JSON.parse(out.content);
assert.ok(parsed.blocks[0].text.includes('[s0]') && !parsed.blocks[0].text.includes('12 %'));
assert.equal(parsed.blocks[1].items[0].value, '18 %', 'les valeurs des blocs de données ne sont jamais touchées');
assert.equal(stripUncited('<div>HTML</div>', ids).content, '<div>HTML</div>', 'un contenu non JSON reste tel quel');

console.log('✓ Vérificateur de citations : 0 appel de modèle, phrases non sourcées retirées de la prose seulement.');

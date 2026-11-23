/**
 * `npm run check:spoken` — GRATUIT : l'écrit et le dit de la voix off (`audio/spoken.ts`). Ce que l'écran écrit
 * (« 2 500 FCFA », « idem.africa », « 30 % ») est dit comme une personne le dirait ; l'écrit reste pour l'écran.
 */
import { enNumber, frNumber, speakableText, writtenText } from '../src/video/audio/spoken';
import { plainSpoken } from '../src/video/audio/voice';

let failed = 0;
const ok = (label: string, got: string, want: string) => {
  const pass = got === want;
  if (!pass) failed++;
  console.log(`${pass ? '✓' : '✗'} ${label}${pass ? '' : ` — « ${got} » au lieu de « ${want} »`}`);
};
ok('nombres : 71, 80, 81, 200, 2 500, 80 000, 1 999', [71, 80, 81, 200, 2500, 80000, 1999].map(frNumber).join(' | '), 'soixante et onze | quatre-vingts | quatre-vingt-un | deux cents | deux mille cinq cents | quatre-vingt mille | mille neuf cent quatre-vingt-dix-neuf');
ok('nombres anglais', [21, 2500].map(enNumber).join(' | '), 'twenty-one | two thousand five hundred');
ok('domaine et heure', speakableText('Commandez sur idem.africa avant 9h30', 'fr'), 'Commandez sur idem point africa avant 9 heures 30');
ok('francs CFA et pourcentage', speakableText('Le pack coûte 2 500 FCFA, soit 30 % de moins', 'fr'), 'Le pack coûte deux mille cinq cents francs CFA, soit trente pour cent de moins');
ok('téléphone en groupes', speakableText('Appelez le +237 6 99 12 34 56', 'fr'), 'Appelez le plus 237, 6, 99, 12, 34, 56');
ok('adresse électronique', speakableText('Écrivez à contact@kora.sn', 'fr'), 'Écrivez à contact arobase kora point sn');
ok('ordinaux', speakableText('Le 1er marché, la 2e saison, la 21e édition', 'fr'), 'Le premier marché, la deuxième saison, la vingt et unième édition');
ok('{écrit|dit} : la voix dit', speakableText('Rendez-vous sur {kora.sn|kora point S N}', 'fr'), 'Rendez-vous sur kora point S N');
ok('{écrit|dit} : l’écran écrit', writtenText('Rendez-vous sur {kora.sn|kora point S N}'), 'Rendez-vous sur kora.sn');
ok('{écrit|dit} : les sous-titres lisent l’écrit', plainSpoken('[warmly] Rendez-vous sur {kora.sn|kora point S N}'), 'Rendez-vous sur kora.sn');
ok('anglais', speakableText('Order at idem.africa, 30 % off, 2 500 XAF', 'en'), 'Order at idem dot africa, thirty percent off, two thousand five hundred CFA francs');
ok('un chiffre décimal à virgule', speakableText('Il reste 2,5 tonnes', 'fr'), 'Il reste deux virgule cinq tonnes');
console.log(`\n${failed ? '✗' : '✓'} L’écrit et le dit : ${failed} échec(s).`);
process.exit(failed ? 1 : 0);

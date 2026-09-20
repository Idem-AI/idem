/**
 * Récupération d'une section rendue en HTML — `npm run check:salvage`.
 *
 * Le rédacteur doit renvoyer du contenu structuré ; il lui arrive de renvoyer
 * la page HTML d'avant le gabarit. Ce contrôle fige la propriété qui rend ce
 * manquement sans conséquence : le texte est retrouvé, la forme est jetée, et
 * AUCUN fait n'est inventé au passage.
 *
 * Les fragments ci-dessous sont ceux réellement produits par glm-5.2 sur le
 * plan SPEED MOBILITY — c'est ce HTML-là qui faisait disparaître trois pages.
 */

import { htmlToSectionContent, looksLikeHtmlPage } from '../services/design/htmlToSectionContent';
import { normalizeSectionContent } from '../services/design/sectionContent';

let failures = 0;
function check(label: string, condition: boolean, detail = ''): void {
  if (condition) console.log(`  ✓ ${label}`);
  else {
    failures += 1;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

const SAMPLE = `
<div class="space-y-12">
  <!-- En-tête -->
  <div class="border-l-4 border-indigo-600 pl-6">
    <p class="text-sm font-semibold uppercase tracking-wider text-indigo-600">Clientèles ciblées</p>
    <h2 class="text-4xl font-bold text-slate-900">Deux segments distincts, une même exigence de fiabilité</h2>
    <p class="mt-4 text-lg text-slate-600">Les entreprises de Douala immobilisent trop de capital dans leur flotte [s0].</p>
  </div>
  <div class="grid grid-cols-3 gap-6">
    <div class="rounded-xl bg-slate-50 p-6">
      <h3 class="text-xl font-bold">Marc, gestionnaire de flotte</h3>
      <p class="mt-2 text-slate-600">42 ans, dirige 18 véhicules pour une société de distribution.</p>
    </div>
    <div class="rounded-xl bg-slate-50 p-6">
      <h3 class="text-xl font-bold">Aïcha, entrepreneure</h3>
      <p class="mt-2 text-slate-600">34 ans, a besoin d'un véhicule fiable sans immobiliser 8 M XAF.</p>
    </div>
  </div>
  <table class="w-full">
    <thead><tr><th>Segment</th><th>Taille estimée</th><th>Panier moyen</th></tr></thead>
    <tbody>
      <tr><td>Flottes entreprises</td><td>1 200 sociétés [s1]</td><td>650 000 XAF / mois</td></tr>
      <tr><td>Particuliers urbains</td><td>À documenter</td><td>25 000 XAF / jour</td></tr>
    </tbody>
  </table>
  <ul class="list-disc">
    <li>Opacité tarifaire sur le marché de l'occasion</li>
    <li>Absence de garantie après l'achat</li>
  </ul>
  <canvas id="segChart"></canvas>
  <script>new Chart(document.getElementById('segChart'), {data:{labels:['A','B'],datasets:[{data:[70,30]}]}});</script>
</div>`;

console.log("\nRécupération d'une sortie HTML");

const recovered = htmlToSectionContent(SAMPLE, 'Target Audience');
check('une sortie HTML produit du contenu structuré', recovered !== null);

if (recovered) {
  check(
    'le titre vient du <h2>, pas du nom de section',
    recovered.title === 'Deux segments distincts, une même exigence de fiabilité',
    recovered.title
  );
  check('le sur-titre est reconnu', recovered.kicker === 'Clientèles ciblées', recovered.kicker ?? '—');
  check(
    'le chapô est conservé avec sa citation',
    Boolean(recovered.lede?.includes('[s0]')),
    recovered.lede ?? '—'
  );

  const kinds = recovered.blocks.map((b) => b.kind);
  check('les personas deviennent des cartes', kinds.includes('cards'), kinds.join(', '));
  check('le tableau est conservé', kinds.includes('table'), kinds.join(', '));
  check('la liste devient de la prose', kinds.includes('prose'), kinds.join(', '));

  const cards = recovered.blocks.find((b) => b.kind === 'cards');
  check(
    'chaque carte porte son titre ET son corps',
    cards?.kind === 'cards' &&
      cards.items.length === 2 &&
      cards.items.every((item) => item.title.length > 0 && item.body.length > 0),
    cards?.kind === 'cards' ? JSON.stringify(cards.items) : '—'
  );

  const table = recovered.blocks.find((b) => b.kind === 'table');
  check(
    'le tableau garde ses en-têtes et ses lignes',
    table?.kind === 'table' &&
      table.headers.length === 3 &&
      table.rows.length === 2 &&
      table.rows.every((row) => row.length === 3),
    table?.kind === 'table' ? JSON.stringify(table.headers) : '—'
  );

  // LA règle : le graphique Chart.js n'est PAS reconstitué. Ses séries vivent
  // dans un <script> ; les deviner serait inventer des chiffres.
  check("aucun graphique n'est inventé à partir du script", !kinds.includes('chart'));

  const flat = JSON.stringify(recovered);
  check('les marqueurs de citation survivent', flat.includes('[s0]') && flat.includes('[s1]'));
  check('aucun résidu de balise ni de classe Tailwind', !/[<>]|text-slate|rounded-xl/.test(flat));
  check(
    'le contenu récupéré passe la normalisation du gabarit',
    normalizeSectionContent(recovered) !== null
  );
}

console.log('\nCe qui ne doit RIEN produire');
check('une sortie vide est refusée', htmlToSectionContent('', 'X') === null);
check('du HTML sans texte est refusé', htmlToSectionContent('<div><span></span></div>', 'X') === null);
check(
  'un JSON déjà valide ne passe pas par ici',
  htmlToSectionContent('{"title":"T","blocks":[]}', 'X') === null
);

console.log("\nLa garde : ce qui a le droit d'être récupéré");
{
  // Le piège que cette garde existe pour éviter : un contenu structuré TRONQUÉ
  // porte souvent des balises dans ses chaînes. Le récupérer comme du HTML
  // imprimerait « "kind": "prose" » dans le document — pire que la page perdue.
  const truncatedJson =
    '{"title":"Plan financier","blocks":[{"kind":"prose","paragraphs":' +
    '["Le capital de <strong>950 000 XAF</strong> couvre le premier lot."]},' +
    '{"kind":"table","headers":["Année","CA"],"rows":[["1","1 000 000 0';

  check("un JSON tronqué n'est PAS pris pour du HTML", !looksLikeHtmlPage(truncatedJson));
  check('une page HTML est reconnue', looksLikeHtmlPage('  <div class="p-6"><h2>Titre</h2></div>'));
  check(
    'une page HTML sous clôture de code est reconnue',
    looksLikeHtmlPage('```html\n<section><h2>Titre</h2></section>')
  );
  check('un JSON valide est écarté', !looksLikeHtmlPage('{"title":"T","blocks":[]}'));
  check('une prose de préambule est écartée', !looksLikeHtmlPage('Voici la section demandée :'));
}

console.log('');
if (failures > 0) {
  console.error(`Récupération HTML: ${failures} vérification(s) en échec.\n`);
  process.exit(1);
}
console.log('Récupération HTML: toutes les vérifications passent.\n');

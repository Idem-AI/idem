/**
 * Contrôle sans modèle ni réseau de la refonte demandée dans le chat : `npm run check:redesign`.
 * Ce qui est vérifié est ce que l'utilisateur verrait : une question posée (ou pas), la bonne adresse, une
 * marque que l'atelier sait relire.
 */
import { detectRedesign, findSiteUrl } from '../src/siteEngine/redesign/intent.js';
import { marker, redesignAsk } from '../src/siteEngine/redesign/ask.js';
import { redesignArchitect, redesignFacts } from '../src/siteEngine/redesign/brief.js';

let failed = 0;
let passed = 0;
const check = (name: string, ok: boolean, detail?: unknown) => {
  if (ok) passed += 1;
  else {
    failed += 1;
    console.error(`✗ ${name}`, detail ?? '');
  }
};

// 1. Les demandes de refonte, en français et en anglais, avec ou sans https://.
const yes: [string, string][] = [
  ['Refais complètement mon site https://www.boulangerie-ndolo.cm', 'boulangerie-ndolo.cm'],
  ['je veux une refonte de monsite.com stp', 'monsite.com'],
  ['Modernise le site https://exemple.ci/accueil, il fait vieux', 'exemple.ci'],
  ['Peux-tu améliorer notre site web : www.cabinet-mbarga.com ?', 'cabinet-mbarga.com'],
  ['Redesign my website https://acme.co.uk please', 'acme.co.uk'],
  ['make https://shop.example.com better', 'shop.example.com'],
  ['Fais une nouvelle version de https://hotel-kribi.com plus moderne', 'hotel-kribi.com'],
];
for (const [text, host] of yes) {
  const intent = detectRedesign(text);
  check(`refonte : ${text}`, intent?.host === host, intent);
}

// 2. Ce qui n'en est pas une.
const no = [
  'Crée un site pour ma boulangerie à Douala',
  'Refais le menu en bleu', // une retouche, pas d'adresse
  'Inspire-toi de https://stripe.com pour le style', // une adresse sans refonte
  'Mon e-mail est contact@refonte.com, crée mon site',
  'Améliore le fichier index.html',
  'Change le titre de src/pages/home.tsx',
  'Refais la section https://localhost:5173',
];
for (const text of no) check(`pas une refonte : ${text}`, detectRedesign(text) === null, detectRedesign(text));

// 3. L'adresse : ponctuation retirée, ancre retirée, schéma ajouté.
check('adresse nettoyée', findSiteUrl('voici mon site : https://exemple.com/a-propos#equipe.')?.url === 'https://exemple.com/a-propos');
check('adresse sans schéma', findSiteUrl('mon site www.exemple.sn')?.url === 'https://www.exemple.sn/');
check('domaine dans le verbe ignoré', detectRedesign('regarde refonte-digitale.com') === null);

// 4. La question : deux choix, un seul recommandé, accord demandé sans projet.
{
  const ask = redesignAsk({ url: 'https://exemple.com/', host: 'exemple.com' }, { fr: true, needsConsent: true });
  check('deux choix', ask.options.length === 2 && ask.options.map((o) => o.value).join() === 'direct,identity');
  check('un seul recommandé', ask.options.filter((o) => o.recommended).length === 1);
  check('accord demandé', ask.consent === true);
  check('accord non demandé avec un projet', redesignAsk({ url: 'https://exemple.com/', host: 'exemple.com' }, { fr: false, needsConsent: false }).consent === false);
}

// 5. La marque se relit telle quelle, même avec « -- » dans un texte.
{
  const payload = { id: 'p1', name: 'A -- B <x>' };
  const text = `avant ${marker('project', payload)} après`;
  const match = text.match(/<!--\s*idem:project\s+(\{[\s\S]*?\})\s*-->/);
  check('marque fermée une seule fois', (text.match(/-->/g) ?? []).length === 1);
  check('marque relue', JSON.stringify(JSON.parse(match?.[1] ?? 'null')) === JSON.stringify(payload));
}

// 6. Les blocs des agents portent les faits du site et la mission.
{
  const content = {
    url: 'https://exemple.com/',
    title: 'Exemple — Traiteur',
    language: 'fr',
    headings: ['Nos menus', 'Contact'],
    paragraphs: ['Appelez-nous au 6 99 00 11 22.'],
    voice: { businessType: 'traiteur', valueProposition: 'Des repas pour vos événements' },
    styleEvidence: 'Typography seen: titles in Poppins.',
    pages: ['https://exemple.com/', 'https://exemple.com/menus'],
    images: [],
    logo: true,
  };
  const facts = redesignFacts(content, true);
  check('faits : textes du site', facts.includes('6 99 00 11 22') && facts.includes('Nos menus'));
  check('architecte : refonte', redesignArchitect(content, true).includes('REFONTE') && redesignArchitect(content, true).includes('2 pages'));
}

console.log(`${passed} contrôles réussis, ${failed} en échec`);
if (failed) process.exit(1);

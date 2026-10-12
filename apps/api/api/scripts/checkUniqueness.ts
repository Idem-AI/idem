/**
 * Test de collision — `npm run check:uniqueness`.
 *
 * L'unicité d'un projet est une exigence produit : deux marques ne doivent pas
 * se ressembler, y compris quand elles appartiennent au même secteur. Elle est
 * TIRÉE par le code — la région chromatique et le registre typographique de la
 * charte, puis la composition des pages par le moteur graphique
 * (@idem/graphic-engine), semée par la clé du livrable — ce qui la rend
 * vérifiable sans appeler un seul modèle. Le résultat est donc le MÊME sur un
 * gros et sur un petit modèle : un écart signalerait qu'une dimension est
 * encore laissée au modèle.
 *
 * Les pages sont composées SANS rendu (`validate: false`) : c'est la décision
 * de composition qui est mesurée ici, pas sa mesure dans Chromium (contrôlée
 * par `npm run check:graphic-engine`). Aucun réseau, aucune base, aucune clé
 * d'API : il tourne partout, en quelques secondes, et peut donc être exécuté en
 * intégration continue.
 *
 *   npx ts-node --transpile-only api/scripts/checkUniqueness.ts
 */

import { createDocument, CreativityLevel, DocumentType, FormatId, SectionContent, STYLE_DATA } from '@idem/graphic-engine';
import { buildPaletteConstraint, buildTypographyConstraint } from '../../../ivision/core/src/brand/brand-constraints';
import { documentDesignKey, LEGACY_DOCUMENT_ID } from '../services/common/deliverable-documents';

let failures = 0;

function check(label: string, condition: boolean, detail = ''): void {
  if (condition) {
    console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`);
  } else {
    failures += 1;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

/** Trente projets, dont dix dans le MÊME secteur : le cas qui fait converger. */
const PROJECTS = [
  ...Array.from({ length: 10 }, (_, i) => ({ id: `fintech-${i}`, sector: 'fintech' })),
  ...Array.from({ length: 10 }, (_, i) => ({ id: `agri-${i}`, sector: 'agritech' })),
  ...Array.from({ length: 10 }, (_, i) => ({ id: `health-${i}`, sector: 'healthtech' })),
];

const para = (n: number): string[] =>
  Array.from({ length: n }, (_, i) => `Point ${i + 1} : la société sert les commerçants de Douala avec un service de paiement mobile rapide, fiable et peu coûteux, adossé aux opérateurs existants.`);

/** Les pages d'un business plan, chacune avec sa matière : c'est la structure qui doit varier page à page. */
const PLAN: SectionContent[] = [
  { id: 'company-summary', title: 'Résumé de la société', lede: 'Un service de paiement pour les commerçants.', blocks: [{ id: 'p', kind: 'prose', paragraphs: para(3) }, { id: 'm', kind: 'metrics', items: [{ value: '1 200', label: 'Commerçants' }, { value: '+35 %', label: 'Croissance' }, { value: '18 mois', label: 'Rentabilité' }] }] },
  { id: 'opportunity', title: 'L’opportunité', blocks: [{ id: 'p', kind: 'prose', paragraphs: para(2) }, { id: 'c', kind: 'cards', items: [{ title: 'Commerçants', body: 'Des frais trop élevés.' }, { title: 'Clients', body: 'Pas de reçu.' }, { title: 'Banques', body: 'Peu de données.' }] }] },
  { id: 'target-audience', title: 'Clients cibles', blocks: [{ id: 'pe', kind: 'persona', name: 'Awa', role: 'Commerçante', traits: ['Pressée', 'Mobile'], needs: ['Encaisser vite'] }, { id: 'p', kind: 'prose', paragraphs: para(2) }] },
  { id: 'products-services', title: 'Produits et services', blocks: [{ id: 'c', kind: 'cards', items: [{ title: 'Encaissement', body: 'QR et USSD.' }, { title: 'Reçus', body: 'Par SMS.' }, { title: 'Tableau de bord', body: 'Ventes du jour.' }, { title: 'Avances', body: 'Sur le chiffre.' }] }] },
  { id: 'marketing-sales', title: 'Marketing et ventes', blocks: [{ id: 'f', kind: 'funnel', stages: [{ label: 'Visites', value: '10 000' }, { label: 'Inscrits', value: '2 000' }, { label: 'Actifs', value: '1 200' }] }, { id: 'p', kind: 'prose', paragraphs: para(1) }] },
  { id: 'financial-plan', title: 'Plan financier', blocks: [{ id: 't', kind: 'table', headers: ['Poste', '2026', '2027'], rows: [['Revenus', '120 M', '310 M'], ['Charges', '90 M', '180 M'], ['Résultat', '30 M', '130 M']] }, { id: 'ch', kind: 'chart', chartType: 'bar', labels: ['2026', '2027', '2028'], series: [{ name: 'Revenus', data: [120, 310, 520] }], readingKey: 'Les revenus quadruplent en trois ans.' }] },
  { id: 'goal-planning', title: 'Objectifs', blocks: [{ id: 'tl', kind: 'timeline', steps: [{ date: 'T1', title: 'Lancement', body: 'Douala.' }, { date: 'T3', title: 'Yaoundé', body: 'Deuxième ville.' }, { date: 'T6', title: 'Avances', body: 'Crédit marchand.' }] }] },
  { id: 'risks', title: 'Risques', blocks: [{ id: 'r', kind: 'riskMatrix', risks: [{ label: 'Régulation', likelihood: 'medium', impact: 'high' }, { label: 'Concurrence', likelihood: 'high', impact: 'medium' }] }] },
  { id: 'appendix', title: 'Annexes', blocks: [{ id: 'p', kind: 'prose', paragraphs: para(2) }] },
];

const SLIDE: SectionContent = { id: 'market', title: 'Un marché de 2,3 milliards de FCFA', blocks: [{ id: 'm', kind: 'metrics', items: [{ value: '2,3 Md', label: 'Marché adressable' }, { value: '+18 %', label: 'Croissance annuelle' }] }, { id: 'p', kind: 'prose', paragraphs: para(1) }] };

/** La même marque pour tous : même style, même palette — le pire cas, où seule la graine peut séparer. */
const SAME_BRAND = { name: 'Marque', palette: { primary: '#1447e6', secondary: '#000060', accent: '#22d3ee', background: '#ffffff', text: '#111111' } };

interface Composed {
  /** L'empreinte de chaque page (motif, paramètres, couleur, tension, accent, silhouette). */
  prints: string[];
  /** Le DesignSpec du document, sans la graine : ce qui serait rendu. */
  spec: string;
}

async function compose(o: { seed: string; styleId?: string; level?: CreativityLevel; documentType?: DocumentType; format?: FormatId; sections?: SectionContent[] }): Promise<Composed> {
  const sections = o.sections ?? PLAN;
  const doc = await createDocument({
    documentType: o.documentType ?? 'business-plan',
    format: o.format ?? 'a4-portrait',
    brand: SAME_BRAND,
    direction: { styleId: o.styleId ?? 'swiss' },
    creativity: o.level ?? 'medium',
    seed: o.seed,
    sections: sections.map((s) => ({ id: s.id })),
    validate: false,
  });
  const prints: string[] = [];
  for (const [index, section] of sections.entries()) {
    prints.push((await doc.composeSection(section, { index: index + 1, total: sections.length })).result.provenance.fingerprint);
  }
  const { seed: _seed, ...spec } = doc.designSpec();
  return { prints, spec: JSON.stringify(spec) };
}

const patternOf = (print: string): string => print.split('|')[0];

(async () => {
  console.log('\nTest de collision — unicité par projet\n');

  // ───────────────────────────────────────────────────────────────────────────
  console.log('Composition d’un business plan (même style, même palette pour tous)');
  {
    const documents = await Promise.all(PROJECTS.map((p) => compose({ seed: documentDesignKey('businessplan', p.id, LEGACY_DOCUMENT_ID) })));
    const signatures = documents.map((d) => d.prints.join('#'));
    const distinct = new Set(signatures).size;
    check('aucune collision de document entre les trente projets', distinct === PROJECTS.length, `${distinct} documents distincts sur ${PROJECTS.length}`);

    // Le test qui compte vraiment : deux projets du MÊME secteur ne doivent pas converger, page par page.
    const fintech = documents.slice(0, 10);
    const worstPage = PLAN.map((s, k) => ({ id: s.id, distinct: new Set(fintech.map((d) => d.prints[k])).size })).sort((a, b) => a.distinct - b.distinct)[0];
    check('dix projets du même secteur : chaque page varie d’un projet à l’autre', worstPage.distinct >= 6, `page la moins variée : ${worstPage.id}, ${worstPage.distinct} compositions sur 10`);

    // Dans un même document, la structure varie d'une page à l'autre ; un long document peut revenir à une
    // composition calme, jamais sur deux pages voisines (même exigence que le moteur : ≥ 4 sur 6 pages).
    const perDocument = documents.map((d) => new Set(d.prints.map(patternOf)).size);
    const poorest = Math.min(...perDocument);
    check(`chaque document varie ses compositions page à page (${PLAN.length} pages)`, poorest >= 6, `au pire ${poorest} motifs distincts sur ${PLAN.length} pages`);
    const adjacent = documents.filter((d) => d.prints.some((x, k) => k > 0 && patternOf(x) === patternOf(d.prints[k - 1]))).length;
    check('deux pages voisines n’ont jamais la même composition', adjacent === 0, `${adjacent} document(s) en défaut`);
    const repeated = documents.map((d) => Math.max(...[...new Set(d.prints.map(patternOf))].map((p) => d.prints.filter((x) => patternOf(x) === p).length)));
    check('aucun motif ne revient plus de trois fois dans un même document', Math.max(...repeated) <= 3, `au pire ${Math.max(...repeated)} fois`);

    // Reproductibilité : c'est ce qui distingue « unique » de « aléatoire ». Un document régénéré retrouve sa
    // composition, et deux documents d'un même projet (plan bancaire, plan investisseur) ont chacun la leur.
    const first = await compose({ seed: documentDesignKey('businessplan', 'fintech-0', LEGACY_DOCUMENT_ID) });
    const again = await compose({ seed: documentDesignKey('businessplan', 'fintech-0', LEGACY_DOCUMENT_ID) });
    check('même clé ⇒ même composition (un document régénéré garde sa mise en page)', first.spec === again.spec);
    const other = await compose({ seed: documentDesignKey('businessplan', 'fintech-0', 'bp-investor') });
    check('deux documents d’un même projet ont des compositions distinctes', first.prints.join('#') !== other.prints.join('#'));
  }

  // ───────────────────────────────────────────────────────────────────────────
  console.log('\nEspace de composition par style (20 projets par style)');
  {
    // La variété reste À L'INTÉRIEUR du style : le plus contraint doit encore séparer les projets. Low compose
    // avec les compositions éprouvées (exploration minimale), Medium tire parmi les trois meilleures.
    const floors: Record<'low' | 'medium', { page: number; slide: number }> = { low: { page: 5, slide: 12 }, medium: { page: 12, slide: 15 } };
    for (const level of ['low', 'medium'] as const) {
      let page = { size: Infinity, styleId: '' };
      let slide = { size: Infinity, styleId: '' };
      for (const styleId of Object.keys(STYLE_DATA)) {
        const pages = new Set<string>();
        const slides = new Set<string>();
        for (let i = 0; i < 20; i++) {
          pages.add((await compose({ seed: `businessplan:space-${i}`, styleId, level, sections: [PLAN[0]] })).prints[0]);
          slides.add((await compose({ seed: `pitchdeck:space-${i}`, styleId, level, documentType: 'pitch-deck', format: 'slide-16x9', sections: [SLIDE] })).prints[0]);
        }
        if (pages.size < page.size) page = { size: pages.size, styleId };
        if (slides.size < slide.size) slide = { size: slides.size, styleId };
      }
      check(`${level} : une page de business plan garde au moins ${floors[level].page} compositions sur 20 projets, dans chaque style`, page.size >= floors[level].page, `au pire ${page.size} (${page.styleId})`);
      check(`${level} : une diapositive garde au moins ${floors[level].slide} compositions sur 20 projets, dans chaque style`, slide.size >= floors[level].slide, `au pire ${slide.size} (${slide.styleId})`);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  console.log('\nRégion chromatique');
  {
    const constraints = PROJECTS.map((p) => buildPaletteConstraint(p.id));
    const distinct = new Set(constraints.map((c) => JSON.stringify(c))).size;

    // 648 régions pour 30 projets : quelques collisions sont statistiquement
    // normales (paradoxe des anniversaires). Ce qui compte est qu'elles restent
    // rares — et surtout qu'elles ne suivent PAS le secteur.
    check('les régions chromatiques sont majoritairement distinctes', distinct >= PROJECTS.length - 2, `${distinct} régions distinctes sur ${PROJECTS.length} projets`);

    // Deux projets du MÊME secteur ne doivent pas converger : c'est le défaut que la contrainte corrige.
    const fintechHues = new Set(PROJECTS.filter((p) => p.sector === 'fintech').map((p) => buildPaletteConstraint(p.id).baseHue));
    check('deux marques du même secteur ne partagent pas la même teinte de base', fintechHues.size >= 6, `${fintechHues.size} teintes distinctes sur 10 projets fintech`);

    check('la région est déterministe', JSON.stringify(buildPaletteConstraint('fintech-0')) === JSON.stringify(buildPaletteConstraint('fintech-0')));
  }

  // ───────────────────────────────────────────────────────────────────────────
  console.log('\nRegistre typographique');
  {
    const distinct = new Set(PROJECTS.map((p) => buildTypographyConstraint(p.id))).size;
    check('les registres typographiques se répartissent', distinct >= 5, `${distinct} registres distincts sur ${PROJECTS.length} projets`);
  }

  console.log('');
  if (failures) {
    console.error(`Unicité: ${failures} vérification(s) en échec.\n`);
    process.exit(1);
  }
  console.log('Unicité: toutes les vérifications passent.\n');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

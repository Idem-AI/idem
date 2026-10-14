/**
 * Contrôle de la REMISE EN PAGE et de la RETOUCHE sans réécriture — `npm run check:relayout`.
 *
 * Aucun réseau, aucun modèle : l'auteur des pages est simulé (`fakeGraphicAuthor`), le modèle d'écriture aussi.
 *  1. une page générée garde son contenu et son code (`SectionModel.composition`) ;
 *  2. une nouvelle mise en page refait les pages depuis ce contenu, garde telles quelles celles qui n'en ont pas ;
 *  3. une retouche de MOTS rejoue la page sans auteur ; une retouche de FORME passe par l'auteur avec son code ;
 *  4. une consigne qui demande du contenu nouveau retombe sur la réécriture du HTML ;
 *  5. une page réécrite ailleurs retrouve sa feuille Tailwind (nouvelles classes comprises).
 */
import { closeBrowser, configureGraphicEngine, SectionContent } from '@idem/graphic-engine';
import { fakeAuthorCall } from './fakeGraphicAuthor';
import { composeGraphicPage, openGraphicDocument, pageComposition } from '../services/graphic/graphic.service';
import { editComposedSection, relayoutDocument, restyleSection } from '../services/graphic/page-editing.service';
import { promptService } from '../services/prompt.service';
import { sectionHtml } from '@idem/graphic-engine';
import type { SectionModel } from '../models/section.model';
import type { ProjectModel } from '../models/project.model';

let failures = 0;
let passed = 0;
const check = (label: string, ok: boolean, detail = '') => {
  if (ok) passed++;
  else failures++;
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
};

const authorCalls: string[] = [];
configureGraphicEngine({
  agentCall: () => async (req) => {
    if (req.role === 'graphic.author') authorCalls.push(req.user);
    return fakeAuthorCall(req);
  },
  brandMemory: undefined,
  recentFingerprints: undefined,
  rememberFingerprints: undefined,
});

let writerAnswer = '';
(promptService as unknown as { runPrompt: () => Promise<string> }).runPrompt = async () => writerAnswer;
(promptService as unknown as { getCleanAIText: (r: string) => string }).getCleanAIText = (r: string) => r;

const project = {
  id: 'check-relayout',
  name: 'Verda Jus',
  description: 'Jus de fruits locaux pressés chaque matin à Dakar.',
  analysisResultModel: { branding: { colors: { colors: { primary: '#1F6F43', secondary: '#F2C14E', accent: '#E07A2E', background: '#FFFFFF', text: '#1A1A1A' } }, typography: { primaryFont: 'Archivo', secondaryFont: 'Inter' } } },
} as unknown as ProjectModel;

const MARKET: SectionContent = { id: 'market', title: 'Un marché urbain qui consomme hors du foyer', lede: 'La demande vient des bureaux du Plateau.', blocks: [{ id: 'm', kind: 'metrics', items: [{ value: '38', label: 'Bureaux clients' }, { value: '+70 %', label: 'Croissance annuelle' }] }] };
const TEAM: SectionContent = { id: 'team', title: 'Une équipe de quatre personnes', blocks: [{ id: 'k', kind: 'cards', items: [{ title: 'Awa', body: 'Production et qualité.' }, { title: 'Moussa', body: 'Livraisons.' }] }] };

(async () => {
  console.log('\nRemise en page et retouche sans réécriture\n');
  const graphic = await openGraphicDocument({ project, documentType: 'pitch-deck', format: 'slide-16x9', seed: 'check', creativity: 'medium', sections: [{ id: 'market' }, { id: 'team' }], userId: 'u' });
  const sections: SectionModel[] = [];
  for (const [i, [name, content]] of ([['Market', MARKET], ['Team', TEAM]] as const).entries()) {
    const out = await composeGraphicPage(graphic, { ...content }, { index: i + 1, total: 2 });
    sections.push({ name, type: 'text/html', data: sectionHtml(out), summary: name, composition: pageComposition(graphic, name, content.id) });
  }
  sections.push({ name: 'Legacy', type: 'text/html', data: '<div><p>Ancienne page</p></div>', summary: 'legacy' });
  check('1. chaque page générée garde son contenu et son code', sections.slice(0, 2).every((s) => s.composition?.content.title && s.composition.spec?.html));

  authorCalls.length = 0;
  const report = await relayoutDocument({ userId: 'u', projectId: project.id as string, project, kind: 'pitchDeck', documentId: 'd1', sections, creativity: 'high', note: 'plus aérée' });
  check('2. nouvelle mise en page : deux pages refaites par l’auteur, la page sans contenu gardée telle quelle', report.relaid.length === 2 && report.kept.join() === 'Legacy' && authorCalls.length === 2 && report.sections[2].data === sections[2].data);
  check('2. aucun texte réécrit : les chiffres de la page sont ceux du contenu, le souhait du client est transmis', String(report.sections[0].data).includes('+70 %') && authorCalls.every((u) => u.includes('THE CLIENT ASKS FOR THIS LAYOUT: plus aérée')));

  authorCalls.length = 0;
  writerAnswer = JSON.stringify({ set: { title: 'Un marché qui a doublé en un an' }, design: null, needsNewContent: false });
  const words = await editComposedSection({ userId: 'u', projectId: project.id as string, project, kind: 'pitchDeck', section: report.sections[0], instruction: 'change le titre' });
  check('3. retouche de mots : la page est rejouée sans auteur, avec le nouveau titre', words?.mode === 'words' && authorCalls.length === 0 && String(words.section.data).includes('Un marché qui a doublé en un an') && words.section.composition?.content.title === 'Un marché qui a doublé en un an');

  writerAnswer = JSON.stringify({ set: {}, design: 'make the key figures much larger', needsNewContent: false });
  const design = await editComposedSection({ userId: 'u', projectId: project.id as string, project, kind: 'pitchDeck', section: report.sections[0], instruction: 'les chiffres plus grands' });
  check('3. retouche de forme : l’auteur reçoit son code et la consigne', design?.mode === 'design' && authorCalls.length === 1 && authorCalls[0].includes('CURRENT PAGE CODE') && authorCalls[0].includes('make the key figures much larger'));

  writerAnswer = JSON.stringify({ set: {}, design: null, needsNewContent: true });
  const fresh = await editComposedSection({ userId: 'u', projectId: project.id as string, project, kind: 'pitchDeck', section: report.sections[0], instruction: 'ajoute un tableau des concurrents' });
  check('4. du contenu nouveau demandé : retour à la réécriture du HTML (null)', fresh === null);

  const rewritten = String(report.sections[0].data).replace(/<style data-ge-tailwind>[\s\S]*?<\/style>/, '').replace('<h2 class="', '<h2 class="text-[61px] ');
  const restyled = await restyleSection('pitchDeck', project, rewritten, { force: true });
  check('5. une page réécrite ailleurs retrouve sa feuille Tailwind, nouvelles classes comprises', /<style data-ge-tailwind>/.test(restyled) && restyled.includes('text-\\[61px\\]'));

  await closeBrowser();
  console.log(`\n${failures ? '✗' : '✓'} Remise en page : ${passed} vérification(s) réussie(s), ${failures} en échec.`);
  process.exit(failures ? 1 : 0);
})().catch(async (error) => {
  console.error(error);
  await closeBrowser().catch(() => undefined);
  process.exit(1);
});

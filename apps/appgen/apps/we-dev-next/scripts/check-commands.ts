/**
 * Contrôle sans modèle ni réseau des déroulés du chat d'iCode : `npm run check:commands`.
 * Ce qui est vérifié est ce que l'utilisateur verrait : la commande reconnue, les questions posées (la
 * recommandée en tête), une réponse cliquée qui reprend le bon déroulé, une réponse de l'agent bien lue.
 */
import { dispatch, DispatchInput } from '../src/commands/dispatch.js';
import { marker, withRecommendedFirst, ChatChoices } from '../src/commands/choices.js';
import { readIntent } from '../src/commands/intent.js';
import { COMMANDS, parseCommand } from '../src/commands/registry.js';
import { siteRequest } from '../src/commands/workflows/site.js';
import { findSiteUrl } from '../src/siteEngine/redesign/intent.js';
import { redesignArchitect, redesignFacts } from '../src/siteEngine/redesign/brief.js';

process.env.ICODE_INTENT_AGENT = 'off';

let failed = 0;
let passed = 0;
const check = (name: string, ok: boolean, detail?: unknown) => {
  if (ok) passed += 1;
  else {
    failed += 1;
    console.error(`✗ ${name}`, detail ?? '');
  }
};

/** Ce qu'une réponse écrit dans le flux : le texte, et les choix posés. */
async function run(responder: { pipeDataStreamToResponse(res: any): Promise<void> } | null): Promise<{ text: string; choices: ChatChoices | null }> {
  if (!responder) return { text: '', choices: null };
  let raw = '';
  const res = { writeHead: () => undefined, write: (chunk: string) => ((raw += chunk), true), end: () => undefined, on: () => undefined, status: () => res, json: () => undefined, writableEnded: false };
  await responder.pipeDataStreamToResponse(res);
  const text = raw
    .split('\n')
    .filter((line) => line.startsWith('0:'))
    .map((line) => JSON.parse(line.slice(2)) as string)
    .join('');
  const match = text.match(/<!--\s*idem:choices\s+(\{[\s\S]*?\})\s*-->/);
  return { text, choices: match ? (JSON.parse(match[1]) as ChatChoices) : null };
}

const base = (over: Partial<DispatchInput> = {}): DispatchInput => ({
  messages: [{ id: '1', role: 'user', content: over.text ?? '' }],
  text: '',
  fr: true,
  model: 'test',
  userId: 'u1',
  credentials: {},
  hasSite: false,
  product: null,
  ...over,
});
const project = { id: 'p1', name: 'Ndolo', description: 'Boulangerie', analysisResultModel: { branding: { colors: { colors: { primary: '#123456' } } } } } as any;

async function main() {
  // 1. Les commandes et leurs alias, français et anglais.
  check('/redesign + adresse', parseCommand('/redesign monsite.com')?.command.name === 'redesign' && parseCommand('/redesign monsite.com')?.args === 'monsite.com');
  check('/refonte = /redesign', parseCommand('/refonte')?.command.name === 'redesign');
  check('/charte = /charter', parseCommand('/Charte')?.command.name === 'charter');
  check('/réparer (accent) = /fix', parseCommand('/réparer')?.command.name === 'fix');
  check('pas une commande', parseCommand('refais / modernise le site') === null);
  check('chaque commande a ses mots', COMMANDS.every((c) => c.label.fr && c.label.en && c.description.fr && c.description.en));

  // 2. /redesign sans adresse : l'adresse est demandée d'abord, l'accord à la fin (pas de projet).
  {
    const { choices } = await run(await dispatch(base({ text: '/redesign' })));
    check('redesign : questions', choices?.purpose === 'redesign' && choices.questions[0].id === 'url' && choices.questions[0].kind === 'text', choices);
    check('redesign : accord demandé sans projet', choices?.consent === true);
    check('redesign : espace préparé', choices?.prepare === 'site-reset');
    check('redesign : recommandée en tête', !!choices?.questions.filter((q) => q.options).every((q) => q.options![0].recommended));
  }
  // Avec l'adresse et un projet : pas de question d'adresse, pas d'accord.
  {
    const { choices, text } = await run(await dispatch(base({ text: '/redesign https://www.ndolo.cm/', projectData: project })));
    check('redesign : adresse reprise', !choices?.questions.some((q) => q.id === 'url') && choices?.context?.url === 'https://www.ndolo.cm/' && text.includes('ndolo.cm'));
    check('redesign : pas d’accord avec un projet', choices?.consent === false);
  }
  // Une réponse avec une adresse illisible : la question revient, rien n'est lancé.
  {
    const { choices } = await run(await dispatch(base({ answers: { purpose: 'redesign', values: { url: 'pas une adresse', focus: 'all' }, consent: true } })));
    check('redesign : adresse illisible → redemandée', choices?.purpose === 'redesign' && choices.questions[0].id === 'url');
  }
  // Sans projet ni accord : redemandé.
  {
    const { choices } = await run(await dispatch(base({ answers: { purpose: 'redesign', values: { url: 'ndolo.cm', path: 'direct', focus: 'all' } } })));
    check('redesign : sans accord → redemandé', choices?.purpose === 'redesign' && choices.consent === true);
  }

  // 3. /site : trois décisions, la question d'activité sans projet.
  {
    const { choices } = await run(await dispatch(base({ text: '/site' })));
    check('site sans projet : activité demandée', choices?.questions.map((q) => q.id).join() === 'about,pages,action,style', choices?.questions.map((q) => q.id));
    const withProject = await run(await dispatch(base({ text: '/site', projectData: project })));
    check('site avec projet : trois questions', withProject.choices?.questions.map((q) => q.id).join() === 'pages,action,style');
    check('site avec marque : style de la marque recommandé', withProject.choices?.questions.find((q) => q.id === 'style')?.options?.[0]?.value === 'brand');
    const request = siteRequest({ purpose: 'site', values: { pages: 'one', action: 'whatsapp', style: 'minimal', about: 'Une boulangerie à Douala' } }, true);
    check('site : demande composée', request.includes('boulangerie') && request.includes('WhatsApp') && request.includes('une seule page'), request);
    check('site : « Autre » gardé tel quel', siteRequest({ purpose: 'site', values: { pages: 'multi', action: 'Prendre rendez-vous en visio' } }, true).includes('visio'));
  }

  // 4. /charte : sans projet, une explication ; avec projet, une confirmation.
  {
    const none = await run(await dispatch(base({ text: '/charte' })));
    check('charte sans projet : explication', !none.choices && none.text.includes('/redesign'));
    const ask = await run(await dispatch(base({ text: '/charte', projectData: project })));
    check('charte : confirmation', ask.choices?.purpose === 'charter' && ask.choices.questions[0].options?.[0].value === 'create');
    const later = await run(await dispatch(base({ projectData: project, answers: { purpose: 'charter', values: { confirm: 'later' } } })));
    check('charte plus tard : rien de lancé', !later.choices && later.text.includes('plus tard'));
  }

  // 5. Commandes de l'atelier arrivées au serveur, commande inconnue, aide.
  {
    const publish = await run(await dispatch(base({ text: '/publish' })));
    check('commande atelier : explication', publish.text.includes('barre de saisie'));
    const unknown = await run(await dispatch(base({ text: '/inconnue' })));
    check('commande inconnue : aide', unknown.text.includes('/refonte'));
  }

  // 6. Agent coupé, « continuer » : chemin habituel.
  check('agent coupé → chemin habituel', (await dispatch(base({ text: 'Refais mon site exemple.com' }))) === null);
  check('continuer → chemin habituel', (await dispatch(base({ text: 'x', answers: { purpose: 'passthrough', values: {} } }))) === null);

  // 7. La réponse de l'agent, lue et bornée.
  check('agent : refonte + adresse', JSON.stringify(readIntent({ intent: 'redesign', url: 'www.ndolo.cm.', confidence: 0.9 })) === JSON.stringify({ intent: 'redesign', confidence: 0.9, url: 'https://www.ndolo.cm/' }));
  check('agent : intention inconnue refusée', readIntent({ intent: 'hack', confidence: 1 }) === null);
  check('agent : confiance bornée', readIntent({ intent: 'none', confidence: 7 })?.confidence === 1);
  check('agent : « null » texte', readIntent({ intent: 'redesign', url: 'null', confidence: 0.8 })?.url === undefined);

  // 8. Adresses, marques, blocs des agents.
  check('adresse nettoyée', findSiteUrl('voici mon site : https://exemple.com/a-propos#equipe.')?.url === 'https://exemple.com/a-propos');
  check('e-mail ignoré', findSiteUrl('contact@refonte.com') === null);
  check('fichier ignoré', findSiteUrl('index.html') === null);
  {
    const payload = { id: 'p1', name: 'A -- B <x>' };
    const text = `avant ${marker('project', payload)} après`;
    const match = text.match(/<!--\s*idem:project\s+(\{[\s\S]*?\})\s*-->/);
    check('marque fermée une seule fois', (text.match(/-->/g) ?? []).length === 1);
    check('marque relue', JSON.stringify(JSON.parse(match?.[1] ?? 'null')) === JSON.stringify(payload));
  }
  check(
    'recommandée en tête',
    withRecommendedFirst({ purpose: 'x', questions: [{ id: 'q', question: 'q', options: [{ value: 'a', label: 'a' }, { value: 'b', label: 'b', recommended: true }] }] }).questions[0].options![0].value === 'b'
  );
  {
    const content = { url: 'https://exemple.com/', title: 'Exemple', language: 'fr', headings: ['Nos menus'], paragraphs: ['Appelez-nous au 6 99 00 11 22.'], voice: {}, styleEvidence: '', pages: ['a', 'b'], images: [], logo: true };
    check('faits : textes du site', redesignFacts(content, true).includes('6 99 00 11 22'));
    check('architecte : priorité design', redesignArchitect(content, true, 'design').includes('DESIGN'));
  }

  console.log(`${passed} contrôles réussis, ${failed} en échec`);
  if (failed) process.exit(1);
}

void main();

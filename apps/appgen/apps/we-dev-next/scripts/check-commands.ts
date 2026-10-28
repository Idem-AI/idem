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
import { inventoryOutline, linkMapper, SiteInventory, sourceContent } from '../src/siteEngine/redesign/inventory.js';
import { completeCoverage, diversifyLayouts, missingCoverage, readManifest } from '../src/siteEngine/manifest.js';
import { isIncomplete, PlanTracker, readPlan, remaining, PLAN_PATH } from '../src/siteEngine/plan.js';
import { SiteStream } from '../src/siteEngine/stream.js';
import { cleanSlop } from '../src/siteEngine/slopGuard.js';
import { tameNeon } from '../src/siteEngine/designConfig.js';

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
  check('commandes en anglais seulement', parseCommand('/refonte') === null && parseCommand('/charte') === null && parseCommand('/publier') === null);
  check('/Charter (majuscule) = /charter', parseCommand('/Charter')?.command.name === 'charter');
  check('/deploy = /publish', parseCommand('/deploy')?.command.name === 'publish');
  check('noms et alias en anglais', COMMANDS.every((c) => /^[a-z]+$/.test(c.name) && c.aliases.every((a) => /^[a-z]+$/.test(a))));
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
    const none = await run(await dispatch(base({ text: '/charter' })));
    check('charte sans projet : explication', !none.choices && none.text.includes('/redesign'));
    const ask = await run(await dispatch(base({ text: '/charter', projectData: project })));
    check('charte : confirmation', ask.choices?.purpose === 'charter' && ask.choices.questions[0].options?.[0].value === 'create');
    const later = await run(await dispatch(base({ projectData: project, answers: { purpose: 'charter', values: { confirm: 'later' } } })));
    check('charte plus tard : rien de lancé', !later.choices && later.text.includes('plus tard'));
  }

  // 5. Commandes de l'atelier arrivées au serveur, commande inconnue, aide.
  {
    const publish = await run(await dispatch(base({ text: '/publish' })));
    check('commande atelier : explication', publish.text.includes('barre de saisie'));
    const unknown = await run(await dispatch(base({ text: '/inconnue' })));
    check('commande inconnue : aide', unknown.text.includes('/redesign') && unknown.text.includes('/charter'));
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

  // 9. La refonte : rien de l'ancien site ne disparaît.
  {
    const inventory: SiteInventory = {
      origin: 'https://ex.cm',
      language: 'fr',
      pages: [
        { url: 'https://ex.cm/', path: '/', title: 'Accueil', sections: [{ id: 'p0.s0', headings: ['Bienvenue'], texts: ['Nous formons les jeunes.'], items: [], ctas: [{ label: 'Nos services', href: 'https://ex.cm/services/', kind: 'internal' }], images: [{ url: 'https://cdn/a.jpg', alt: 'Atelier', width: 800, height: 600, kind: 'img' }] }, { id: 'p0.s1', headings: ['Chiffres'], texts: ['120 enfants formés'], items: [], ctas: [], images: [] }] },
        { url: 'https://ex.cm/services/', path: '/services/', title: 'Services', sections: [{ id: 'p1.s0', headings: ['Ateliers'], texts: [], items: ['Robotique', 'Dessin'], ctas: [], images: [] }] },
      ],
      skipped: [],
      navigation: [],
      footer: { texts: [], links: [] },
      contact: { phones: ['+237 6 92 95 13 10'], emails: [], whatsapp: [], addresses: [], socials: [] },
      assets: { images: [] },
    };
    const outline = inventoryOutline(inventory, true);
    check('plan : chaque section citée', ['p0.s0', 'p0.s1', 'p1.s0'].every((id) => outline.includes(id)));
    const raw = { pages: [{ slug: '', source: 'p0', label: 'Accueil', sections: [{ id: 'hero', brief: 'Ouverture', visual: 'photo', sources: ['p0.s0'] }, { id: 'impact', brief: 'Chiffres', visual: 'none', sources: ['p0.s1'] }] }] };
    const { manifest } = readManifest(raw, { maxPages: 10, maxSections: 16 });
    const coverage = { pageCount: 2, sectionIds: ['p0.s0', 'p0.s1', 'p1.s0'] };
    const missing = missingCoverage(manifest!, coverage);
    check('couverture : page et section manquantes repérées', missing.pages.join() === '1' && missing.sections.join() === 'p1.s0', missing);
    const completed = completeCoverage(manifest!, coverage, ['Accueil', 'Services'], ['/', '/services/'], true);
    check('couverture complétée par le code', missingCoverage(completed, coverage).pages.length === 0 && missingCoverage(completed, coverage).sections.length === 0 && completed.pages[1].path === '/services/');
    const map = linkMapper(inventory, (i) => (i === 1 ? '/nos-services/' : i === 0 ? '/' : undefined));
    const source = sourceContent([inventory.pages[0].sections[0]], map, true);
    check('lien interne réécrit vers la nouvelle page', source.includes('/nos-services/') && source.includes('Nous formons les jeunes.'), source);
  }

  // 10. Les marques d'un site « généré » retirées par le code.
  {
    const dirty = `<section className="bg-gradient-to-r from-purple-500 to-pink-500 p-8"><h2 className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">🚀 Nos services — rapides</h2><div className="absolute -top-10 left-0 h-64 w-64 rounded-full bg-primary/30 blur-3xl" /><div className="bg-white/10 backdrop-blur-md">x</div><div className="relative"><img className="absolute inset-0" /><div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" /></div></section>`;
    const { code, fixes } = cleanSlop(dirty);
    check('slop : émoji retiré', !/🚀/u.test(code));
    check('slop : tiret cadratin remplacé', !code.includes('—'));
    check('slop : dégradé décoratif retiré', !code.includes('from-purple-500') && !code.includes('bg-clip-text'));
    check('slop : voile sur photo gardé', code.includes('from-black/60 to-transparent'));
    check('slop : pastille floue retirée', !code.includes('blur-3xl'));
    check('slop : effet verre retiré', !code.includes('backdrop-blur'));
    check('slop : corrections dites', fixes.length >= 5, fixes);
  }

  // 11. Pas de couleur fluo (hors couleurs de la marque).
  {
    const config = { tokens: { colors: { primary: '#22c55e', accent: '#39ff14', muted: '#f4f4f5' } } };
    const changed = tameNeon(config, ['#22c55e'], new Set(['tokens.colors.primary']));
    check('fluo apaisé', changed.join() === 'accent (fluo)' && config.tokens.colors.accent.startsWith('oklch('), { changed, config });
    check('marque intacte', config.tokens.colors.primary === '#22c55e' && config.tokens.colors.muted === '#f4f4f5');
  }

  // 12. Étiquettes au-dessus des titres, pastilles d'icône, Sparkles, décor en HTML.
  {
    const dirty = `<div><Badge variant="secondary">Nos services</Badge><Heading level={2}>Ce que nous faisons</Heading><p className="text-xs uppercase tracking-widest text-primary">Impact</p><h3>120 enfants</h3><div className="flex size-12 items-center justify-center rounded-xl bg-primary/10"><GraduationCap className="size-6" /></div><Sparkles className="size-4" /><div className="absolute -right-8 top-10 size-40 rounded-full border border-primary/20" /><div aria-hidden="true"></div><p className="uppercase tracking-wide text-xs">Note de bas</p><p>Un texte</p></div>`;
    const { code } = cleanSlop(dirty);
    check('slop : badge au-dessus du titre retiré', !code.includes('<Badge') && code.includes('Ce que nous faisons'), code);
    check('slop : sur-titre en capitales retiré', !code.includes('>Impact<') && code.includes('120 enfants'), code);
    check('slop : petit texte en capitales qui ne précède pas un titre gardé', code.includes('Note de bas'), code);
    check('slop : pastille d’icône retirée, icône gardée', code.includes('<GraduationCap className="size-6" />') && !code.includes('rounded-xl bg-primary/10'), code);
    check('slop : Sparkles et décor retirés', !code.includes('Sparkles') && !code.includes('size-40 rounded-full') && !code.includes('aria-hidden'), code);
  }

  // 13. Les mises en page varient : jamais deux fois la même de suite, une seule rangée de cartes par page.
  {
    const raw = { pages: [{ slug: '', label: 'Accueil', sections: ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, brief: id, visual: 'none', layout: 'cards' })) }] };
    const { manifest } = readManifest(raw, { maxPages: 4, maxSections: 10 });
    diversifyLayouts(manifest!);
    const layouts = manifest!.pages[0].sections.map((section) => section.layout);
    check('mises en page : pas deux fois de suite', layouts.every((layout, i) => i === 0 || layout !== layouts[i - 1]), layouts);
    check('mises en page : une rangée de cartes au plus', layouts.filter((layout) => layout === 'cards').length <= 1, layouts);
  }

  // 14. Les langues et la reprise : `/translate`, `/continue`, le plan.
  check('/translate et /languages', parseCommand('/translate anglais')?.command.name === 'translate' && parseCommand('/languages')?.command.name === 'translate');
  check('/continue et /resume', parseCommand('/continue')?.command.name === 'continue' && parseCommand('/resume')?.command.name === 'continue');
  check('agent : langues lues', JSON.stringify(readIntent({ intent: 'translate', languages: ['EN', 'es-ES', 'x'], confidence: 0.9 })?.languages) === JSON.stringify(['en', 'es']));
  check('agent : reprise reconnue', readIntent({ intent: 'resume', confidence: 0.95 })?.intent === 'resume');
  {
    const nothing = await run(await dispatch(base({ text: '/continue', projectData: project })));
    check('/continue sans plan : rien à reprendre', /rien à reprendre/.test(nothing.text), nothing.text);
    const noSite = await run(await dispatch(base({ text: '/translate anglais', projectData: project })));
    check('/translate sans site : on dit comment faire', /site créé ici/.test(noSite.text), noSite.text);

    // Le plan, écrit dans le flux et coché étape par étape.
    let raw = '';
    const res = { writeHead: () => undefined, write: (chunk: string) => ((raw += chunk), true), end: () => undefined, on: () => undefined, writableEnded: false } as any;
    const stream = new SiteStream(res);
    const tracker = PlanTracker.create(stream, { request: 'Mon site', language: 'fr', languages: ['fr'], steps: [{ id: 'design', label: 'Design', status: 'pending' }] });
    tracker.add([{ id: 'src/sections/home/Hero.tsx', label: 'Accueil · hero', path: 'src/sections/home/Hero.tsx' }, { id: 'pages', label: 'Pages' }]);
    tracker.mark('design', 'done');
    tracker.mark('src/sections/home/Hero.tsx', 'done');
    const text = raw.split('\n').filter((line) => line.startsWith('0:')).map((line) => JSON.parse(line.slice(2)) as string).join('');
    const writes = [...text.matchAll(/<boltAction type="file" filePath="\.idem\/plan\.json">\n([\s\S]*?)<\/boltAction>/g)].map((m) => m[1]);
    const last = readPlan({ '.idem/plan.json': writes[writes.length - 1] ?? '' });
    check('plan : rangé dans .idem/ (caché dans l’explorateur)', PLAN_PATH === '.idem/plan.json' && !text.includes('filePath="idem.plan.json"'));
    check('plan : relu à son ancienne place (génération d’avant)', isIncomplete(readPlan({ 'idem.plan.json': writes[writes.length - 1] ?? '' })));
    check('plan : écrit à chaque étape', writes.length === 4, writes.length);
    check('plan : il reste l’assemblage', isIncomplete(last) && remaining(last!).map((step) => step.id).join() === 'pages', last);
    tracker.mark('pages', 'done');
    tracker.finish();
    const final = readPlan({ '.idem/plan.json': JSON.stringify(tracker.plan) });
    check('plan : terminé, plus rien à reprendre', !isIncomplete(final));

    const incomplete = { '.idem/plan.json': JSON.stringify(last), 'src/site/pages.json': '{}' };
    const resumed = await run(await dispatch(base({ text: '/continue', projectData: undefined, siteFiles: incomplete, hasSite: true })));
    check('/continue sans projet : on dit d’ouvrir le projet', /ouvrez iCode depuis votre projet/.test(resumed.text), resumed.text);
  }

  console.log(`${passed} contrôles réussis, ${failed} en échec`);
  if (failed) process.exit(1);
}

void main();

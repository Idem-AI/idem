/**
 * `npm run check:visual-quality` — les visuels du plan qualité créative, sans modèle (agents simulés) :
 *
 *   1. l'idée : quatre pistes lues (rôle d'image, traitement), la plus nouvelle retenue ;
 *   2. un visuel dont l'idée demande un sujet DÉTOURÉ : l'idée parvient au rédacteur et à l'auteur, l'image est
 *      détourée (U²-Net-p) et posée ; le titre garde la police de la CHARTE (jamais une police d'accroche hors charte) ;
 *   3. les variantes (cran High) : les compositions écartées sont renvoyées, avec leur image, pour le choix du client ;
 *   4. la déclinaison dans un autre format : aucune idée nouvelle, aucun rédacteur, l'auteur adapte la même page ;
 *   5. une idée « illustration » : l'image est vectorisée aux couleurs de la marque (SVG).
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { configureGraphicEngine } from '@idem/graphic-engine';
import { composeVisual, stockQueries } from '../src/visual/visual.composer';
import { chooseConcept, parseConcepts } from '../src/visual/visual.concept';

process.env.IDEM_CUTOUT_MODEL = 'u2netp';
process.env.IDEM_DESIGN_TOOLS_OFFLINE = process.env.IDEM_DESIGN_TOOLS_OFFLINE ?? '0';
const OUT = path.resolve(__dirname, '../tmp/check-visual-quality');
let failures = 0;
let passed = 0;
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${!ok && detail ? ` — ${detail}` : ''}`);
  if (ok) passed++;
  else failures++;
};

const TRACKS = (image: string, treatment: string, type: string) =>
  [
    'TRACK 1: Morning ritual — a steaming cup seen from above, the headline wraps around it like steam.',
    `IMAGE 1: ${image} — a ceramic coffee cup on a wooden table`,
    `TREATMENT 1: ${treatment}`,
    `TYPE 1: ${type}`,
    'TRACK 2: The roaster — hands pouring beans, the price set like a stamp in the corner.',
    'IMAGE 2: photo — hands pouring roasted beans',
    'TREATMENT 2: natural',
    'TYPE 2: brand',
  ].join('\n');

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  // 1. L'idée
  const concepts = parseConcepts(`**${TRACKS('cutout', 'duotone', 'expressive')}**`);
  check('idée : deux pistes lues avec leur rôle d’image et leur traitement', concepts.length === 2 && concepts[0].image === 'cutout' && concepts[0].treatment === 'duotone' && concepts[1].image === 'photo', JSON.stringify(concepts.map((c) => [c.image, c.treatment])));
  // Le repli Pexels d'un visuel : plusieurs recherches, de la plus précise à la plus large.
  const queries = stockQueries({ headline: 'Le café qui réveille Abidjan', facts: [], photo: { idea: 'barista pouring coffee in a small Abidjan cafe', query: 'barista coffee cafe' } } as never, { brandName: 'Kafé', businessType: 'coffee shop' } as never, 'steaming cup on a wooden counter');
  check('banque : la requête du rédacteur, la scène, le métier (sans doublon, 3 au plus)', queries[0] === 'barista coffee cafe' && queries.length >= 2 && queries.length <= 3 && new Set(queries).size === queries.length, JSON.stringify(queries));
  check('idée : la piste déjà faite est écartée', chooseConcept(concepts, ['Morning ritual — a steaming cup seen from above, the headline wraps around it like steam.'])?.concept.title === 'The roaster');

  // L'auteur simulé du moteur graphique : il pose chaque clé (l'image en grand) et retient ce qu'on lui dit.
  const authorPrompts: string[] = [];
  configureGraphicEngine({
    agentCall: () => async ({ user }) => {
      authorPrompts.push(user);
      const keys = [...user.matchAll(/^\{\{([\w.:-]+)\}\} = /gm)].map((m) => m[1]);
      const body = keys.map((k) => (/\.url$/.test(k) ? `<img src="{{${k}}}" alt="" class="absolute right-0 top-0 h-[70%] w-auto object-contain">` : `<p class="relative ${k === 'title' ? 'font-accent text-[72px]' : 'text-[28px]'} font-bold text-ink">{{${k}}}</p>`)).join('');
      return `\`\`\`html\n<div class="relative flex h-full w-full flex-col justify-end gap-[16px] bg-brand-primary p-[64px]">${body}<idem-logo class="relative h-[48px]"></idem-logo></div>\n\`\`\``;
    },
    recentFingerprints: undefined,
    rememberFingerprints: undefined,
    judgeImage: undefined,
  });

  const photo = await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200"><rect width="900" height="1200" fill="#cfd8dc"/><ellipse cx="450" cy="420" rx="170" ry="210" fill="#7a4b2a"/><rect x="250" y="600" width="400" height="600" rx="120" fill="#c0392b"/></svg>')).jpeg().toBuffer();
  const photoUrl = `data:image/jpeg;base64,${photo.toString('base64')}`;
  const context = { brandName: 'Kora Café', businessType: 'torréfacteur', tone: 'chaleureux', keywords: ['café'], language: 'fr', country: 'CI', branding: { primary: '#1f6f4a', secondary: '#14324a', accent: '#f2a93b', background: '#fbfaf7', text: '#16181d', primaryFont: 'Inter', secondaryFont: 'Inter' } };
  const calls: { role: string; user: string }[] = [];
  const agentCall = async ({ role, user }: { role: string; user: string }) => {
    calls.push({ role, user });
    if (role === 'graphic.explore') return TRACKS('cutout', 'natural', 'expressive');
    return '';
  };

  // 2. Un sujet détouré, dans les polices de la charte
  const cut = await composeVisual({ runPrompt: async () => '', agentCall: agentCall as never }, 'u', 'brand-1', { id: 'c1', title: 'Le café qui réveille Abidjan', description: 'Torréfié chaque lundi, livré en 24 h.' }, context, 'square', 'check', 'check:cut', undefined, false, { creativity: 'medium', image: { url: photoUrl } });
  fs.writeFileSync(path.join(OUT, 'cutout.png'), cut.png);
  const explore = calls.find((c) => c.role === 'graphic.explore');
  check('idée : quatre pistes demandées avant les mots, avec le point de départ et la photo du client', !!explore && /STARTING POINT/.test(explore.user) && /THE CLIENT GAVE A PHOTO/.test(explore.user));
  // Depuis le catalogue (moteur graphique 2.7), aucun modèle n'écrit la page : l'idée guide le CHOIX de la composition.
  // Le moteur graphique passe par l'appel de l'hôte (`configureGraphicEngine`, ci-dessus) : ses demandes y sont notées.
  const choice = authorPrompts.filter((u) => /TEMPLATES:/.test(u)).pop() ?? '';
  check('idée : elle parvient au choix de la composition dans le catalogue', /Morning ritual/.test(choice), choice.slice(0, 200));
  check('image : le sujet est détouré (PNG transparent) et posé dans la page', /^data:image\/png;base64,/.test(cut.parsed.photo?.url ?? '') && cut.html.includes('data:image/png;base64,'), (cut.parsed.photo?.url ?? '').slice(0, 30));
  check('typographie : aucune police hors charte (pas de font-accent), les polices de la marque compilées', !/--font-accent|font-accent/.test(cut.html) && /--font-display/.test(cut.html));
  check('mémoire : l’idée retenue est rendue avec le visuel', cut.concept?.concept.title === 'Morning ritual');

  // 3. Les variantes (cran High : deux compositions du catalogue, l'écartée renvoyée)
  authorPrompts.length = 0;
  const high = await composeVisual({ runPrompt: async () => '', agentCall: agentCall as never }, 'u', 'brand-1', { id: 'c2', title: 'Le café qui réveille Abidjan' }, context, 'square', 'check', 'check:high', undefined, true, { creativity: 'high' });
  // Le catalogue au cran High rend deux compositions (CATALOG_EFFORT) : la meilleure, l'autre proposée au client.
  check('variantes : les compositions écartées sont renvoyées avec leur image, pour le choix du client', (high.alternatives?.length ?? 0) >= 1 && high.alternatives!.every((a) => a.png.length > 1000 && /<div/.test(a.html)) && typeof high.score === 'number', String(high.alternatives?.length));

  // 4. La déclinaison
  calls.length = 0;
  authorPrompts.length = 0;
  const story = await composeVisual({ runPrompt: async () => '', agentCall: agentCall as never }, 'u', 'brand-1', { id: 'c1', title: 'Le café qui réveille Abidjan' }, context, 'story', 'check', 'check:cut', undefined, false, { creativity: 'medium', adaptFrom: { spec: cut.parsed.spec, copy: cut.parsed.copy, ...(cut.parsed.photo ? { photo: cut.parsed.photo } : {}), concept: 'Morning ritual — a steaming cup', format: 'square' } });
  fs.writeFileSync(path.join(OUT, 'declined-story.png'), story.png);
  check('déclinaison : aucune nouvelle idée, l’auteur adapte la même page à la story', !calls.some((c) => c.role === 'graphic.explore') && authorPrompts.some((u) => /Adapt this exact visual to the new story canvas/.test(u)) && story.parsed.photo?.url === cut.parsed.photo?.url);

  // 5. Une illustration vectorielle
  calls.length = 0;
  const illustrated = await composeVisual({ runPrompt: async () => '', agentCall: (async ({ role, user }: { role: string; user: string }) => (calls.push({ role, user }), role === 'graphic.explore' ? TRACKS('illustration', 'natural', 'brand') : '')) as never }, 'u', 'brand-1', { id: 'c3', title: 'Le café qui réveille Abidjan' }, context, 'square', 'check', 'check:illu', undefined, false, { creativity: 'medium', image: { url: photoUrl } });
  check('illustration : l’image devient un SVG vectorisé aux couleurs de la marque', /^data:image\/svg\+xml;base64,/.test(illustrated.parsed.photo?.url ?? ''), (illustrated.parsed.photo?.url ?? '').slice(0, 30));

  console.log(`\n${passed} vérifications réussies, ${failures} en échec · fichiers : ${OUT}`);
  process.exit(failures ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

/**
 * `npm run check:visual-quality` — les visuels du plan qualité créative, sans modèle (agents simulés) :
 *
 *   1. l'idée : quatre pistes lues (rôle d'image, traitement, typographie), la plus nouvelle retenue ;
 *   2. un visuel dont l'idée demande un sujet DÉTOURÉ et une police d'ACCROCHE : l'idée parvient au rédacteur et à
 *      l'auteur, l'image est détourée (U²-Net-p) et posée, `font-accent` est compilée ;
 *   3. les variantes (cran High) : les compositions écartées sont renvoyées, avec leur image, pour le choix du client ;
 *   4. la déclinaison dans un autre format : aucune idée nouvelle, aucun rédacteur, l'auteur adapte la même page ;
 *   5. une idée « illustration » : l'image est vectorisée aux couleurs de la marque (SVG).
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { configureGraphicEngine } from '@idem/graphic-engine';
import { composeVisual } from '../src/visual/visual.composer';
import { accentFontFor, chooseConcept, parseConcepts } from '../src/visual/visual.concept';

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
  check('idée : deux pistes lues avec leur rôle d’image, traitement et typographie', concepts.length === 2 && concepts[0].image === 'cutout' && concepts[0].treatment === 'duotone' && concepts[0].type === 'expressive' && concepts[1].image === 'photo', JSON.stringify(concepts.map((c) => [c.image, c.treatment, c.type])));
  check('idée : la piste déjà faite est écartée', chooseConcept(concepts, ['Morning ritual — a steaming cup seen from above, the headline wraps around it like steam.'])?.concept.title === 'The roaster');
  const accent = accentFontFor({ primaryFont: 'Inter', secondaryFont: 'Inter' }, 'seed-1');
  check('police d’accroche : une face de titre différente des polices de la marque, déterministe', !!accent && accent !== 'Inter' && accent === accentFontFor({ primaryFont: 'Inter', secondaryFont: 'Inter' }, 'seed-1'), accent);

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

  // 2. Un sujet détouré, une police d'accroche
  const cut = await composeVisual({ runPrompt: async () => '', agentCall: agentCall as never }, 'u', 'brand-1', { id: 'c1', title: 'Le café qui réveille Abidjan', description: 'Torréfié chaque lundi, livré en 24 h.' }, context, 'square', 'check', 'check:cut', undefined, false, { creativity: 'medium', image: { url: photoUrl } });
  fs.writeFileSync(path.join(OUT, 'cutout.png'), cut.png);
  const explore = calls.find((c) => c.role === 'graphic.explore');
  check('idée : quatre pistes demandées avant les mots, avec le point de départ et la photo du client', !!explore && /STARTING POINT/.test(explore.user) && /THE CLIENT GAVE A PHOTO/.test(explore.user));
  const lastAuthor = authorPrompts[authorPrompts.length - 1] ?? '';
  check('idée : elle parvient à l’auteur de la page', /THE IDEA OF THIS VISUAL/.test(lastAuthor) && /Morning ritual/.test(lastAuthor));
  check('image : le sujet est détouré (PNG transparent), l’auteur le sait', /^data:image\/png;base64,/.test(cut.parsed.photo?.url ?? '') && /CUT OUT of its background/.test(lastAuthor), (cut.parsed.photo?.url ?? '').slice(0, 30));
  check('typographie : la police d’accroche est proposée à l’auteur et compilée dans la page', /font-accent: an expressive face/.test(lastAuthor) && /--font-accent/.test(cut.html), lastAuthor.match(/font-accent[^\n]*/)?.[0]);
  check('mémoire : l’idée retenue est rendue avec le visuel', cut.concept?.concept.title === 'Morning ritual');

  // 3. Les variantes (cran High : trois compositions, deux écartées et renvoyées)
  authorPrompts.length = 0;
  const high = await composeVisual({ runPrompt: async () => '', agentCall: agentCall as never }, 'u', 'brand-1', { id: 'c2', title: 'Le café qui réveille Abidjan' }, context, 'square', 'check', 'check:high', undefined, true, { creativity: 'high' });
  check('variantes : les compositions écartées sont renvoyées avec leur image, pour le choix du client', (high.alternatives?.length ?? 0) === 2 && high.alternatives!.every((a) => a.png.length > 1000 && /<div/.test(a.html)) && typeof high.score === 'number', String(high.alternatives?.length));

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

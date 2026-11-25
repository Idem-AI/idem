/**
 * Vérifie le choix des images d'une refonte, sans appel payant (modèle simulé du SDK `ai`, client média simulé) :
 *
 *   - le manifeste des images de l'ancien site : logos, icônes et captures écartés, sections d'origine regroupées,
 *     relevé non regardé → `null` (règle d'avant) ;
 *   - les bornes du code sur les choix de l'agent : une ouverture veut une image en paysage, nette, sans texte ; une
 *     image ne sert qu'une fois ; un identifiant inconnu est ignoré ;
 *   - l'agent média : image de l'ancien site retenue, refusée (visuel cherché ailleurs), et repli sans agent ;
 *   - la génération sans attente : un visuel provisoire est rendu tout de suite, la génération le remplace ensuite ;
 *   - la lecture d'une image par le modèle de vision (API) : réponse vérifiée champ par champ.
 *
 *   npm run check:image-casting
 */
import { MockLanguageModelV1 } from 'ai/test';
import { ModelCaller } from '../src/siteEngine/modelCaller.js';
import { siteImageLibrary, type ImageReading, type SiteInventory } from '../src/siteEngine/redesign/inventory.js';
import { castSiteImages, directMedia, type MediaSlot, type MediaStyle } from '../src/siteEngine/media/mediaDirector.js';
import { createLimiter, produceMedia, type MediaAsset, type PipelineContext } from '../src/siteEngine/media/mediaPipeline.js';
import type { MediaClient } from '../src/siteEngine/media/mediaClient.js';
import type { SiteFacts } from '../src/siteEngine/siteFacts.js';

let failures = 0;
let passed = 0;
const check = (label: string, ok: boolean, detail?: unknown) => {
  if (ok) {
    passed += 1;
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.log(`  ✗ ÉCHEC ${label}${detail === undefined ? '' : `\n       ${JSON.stringify(detail)}`}`);
  }
};

const reading = (kind: ImageReading['kind'], description: string, extra: Partial<ImageReading> = {}): ImageReading => ({
  description,
  kind,
  people: false,
  text: false,
  generic: false,
  flaws: [],
  ...extra,
});

const image = (url: string, width: number, height: number, vision?: ImageReading) => ({ url, alt: url, width, height, kind: 'img' as const, ...(vision ? { vision } : {}) });

const inventory = (read: boolean): SiteInventory => ({
  origin: 'https://exemple.cm',
  language: 'fr',
  pages: [
    {
      url: 'https://exemple.cm/',
      path: '/',
      title: 'Accueil',
      sections: [
        {
          id: 'p0.s0',
          headings: ['Pressing à Douala'],
          texts: ['Votre linge propre en 24 h'],
          items: [],
          ctas: [],
          // L'ouverture de l'ancien site : un paysage de plage sans rapport, et le logo.
          images: [
            image('https://cdn/beach.jpg', 1920, 1080, read ? reading('photo', 'A tropical beach at sunset with palm trees', { generic: true }) : undefined),
            image('https://cdn/logo.png', 600, 600, read ? reading('logo', 'The company logo') : undefined),
          ],
        },
        {
          id: 'p0.s1',
          headings: ['Nos services'],
          texts: ['Lavage, repassage, livraison'],
          items: ['Lavage', 'Repassage', 'Livraison'],
          ctas: [],
          images: [
            image('https://cdn/ironing.jpg', 1600, 1000, read ? reading('photo', 'A woman ironing a white shirt in a bright laundry shop', { people: true }) : undefined),
            image('https://cdn/promo.jpg', 1400, 800, read ? reading('photo', 'A promotional banner with prices', { text: true }) : undefined),
          ],
        },
      ],
    },
    {
      url: 'https://exemple.cm/a-propos',
      path: '/a-propos',
      title: 'À propos',
      sections: [
        {
          id: 'p1.s0',
          headings: ['Notre atelier'],
          texts: ['Depuis 2015'],
          items: [],
          ctas: [],
          images: [
            image('https://cdn/ironing.jpg', 1600, 1000, read ? reading('photo', 'A woman ironing a white shirt in a bright laundry shop', { people: true }) : undefined),
            image('https://cdn/shop.jpg', 800, 600, read ? reading('photo', 'The front of a laundry shop on a busy street') : undefined),
          ],
        },
      ],
    },
  ],
  skipped: [],
  navigation: [],
  footer: { texts: [], links: [] },
  contact: { phones: [], emails: [], whatsapp: [], addresses: [], socials: [] },
  assets: { images: [] },
});

console.log('\nManifeste des images');
const library = siteImageLibrary(inventory(true))!;
check('les images lues forment un manifeste', Array.isArray(library) && library.length === 4, library?.map((i) => i.url));
check('le logo est écarté', !library.some((i) => i.url.endsWith('logo.png')));
check('une image vue dans deux sections garde ses deux origines', library.find((i) => i.url.endsWith('ironing.jpg'))?.from.join(',') === 'p0.s1,p1.s0');
check('un relevé non regardé donne null (règle d’avant)', siteImageLibrary(inventory(false)) === null);

const id = (suffix: string) => library.find((i) => i.url.endsWith(suffix))!.id;
const byId = new Map(library.map((i) => [i.id, i]));
const slot = (over: Partial<MediaSlot>): MediaSlot => ({ id: 'home-hero', pageLabel: 'Accueil', brief: 'Ouverture', role: 'story', aspect: '4:3', required: false, count: 1, videoAllowed: false, overlay: false, ...over });

console.log('\nBornes du code');
check('une ouverture accepte une image en paysage, nette et sans texte', castSiteImages(slot({ role: 'hero' }), [id('ironing.jpg')], byId, new Set()).join() === id('ironing.jpg'));
check('une ouverture refuse une image à texte incrusté', castSiteImages(slot({ role: 'hero' }), [id('promo.jpg')], byId, new Set()).length === 0);
check('une ouverture refuse une image trop petite', castSiteImages(slot({ role: 'hero' }), [id('shop.jpg')], byId, new Set()).length === 0);
check('une ouverture met en tête l’image qui ouvre bien', castSiteImages(slot({ role: 'hero' }), [id('shop.jpg'), id('ironing.jpg')], byId, new Set())[0] === id('ironing.jpg'));
check('une image déjà servie ne revient pas', castSiteImages(slot({}), [id('shop.jpg')], byId, new Set([id('shop.jpg')])).length === 0);
check('un texte posé sur l’image refuse le texte incrusté', castSiteImages(slot({ overlay: true }), [id('promo.jpg')], byId, new Set()).length === 0);
check('un identifiant inconnu est ignoré', castSiteImages(slot({}), ['i99', id('shop.jpg')], byId, new Set()).join() === id('shop.jpg'));

const facts = { name: 'Pressing Mboa', description: 'Pressing et blanchisserie à Douala', city: 'Douala', country: 'Cameroun', offers: [] } as unknown as SiteFacts;
const style: MediaStyle = { name: 'Clair', signature: 'net', family: 'structured', palette: ['#0a6', '#111'], ground: '#fff' };
const RAW = { rawCall: { rawPrompt: null, rawSettings: {} } };
const answering = (text: string | Error) => {
  const prompts: string[] = [];
  const model = new MockLanguageModelV1({
    doGenerate: async (options) => {
      prompts.push(JSON.stringify(options.prompt));
      if (text instanceof Error) throw text;
      return { ...RAW, finishReason: 'stop', usage: { promptTokens: 10, completionTokens: 5 }, text };
    },
  });
  return { caller: new ModelCaller('mock', null, new AbortController().signal, { model: () => model, hedge: false }), prompts };
};

const slots: MediaSlot[] = [
  slot({ id: 'home-hero', role: 'hero', aspect: '16:9', ownImages: [id('beach.jpg')] }),
  slot({ id: 'home-services', ownImages: [id('ironing.jpg'), id('promo.jpg')] }),
  slot({ id: 'about-atelier', ownImages: [id('ironing.jpg'), id('shop.jpg')] }),
];

console.log('\nAgent média avec le manifeste');
{
  const { caller, prompts } = answering(
    JSON.stringify({
      assets: [
        // La plage est hors sujet : l'agent n'en retient aucune et dit quoi chercher.
        { slot: 'home-hero', site: [], kind: 'photo', subject: 'african woman folding laundry', query: 'african woman laundry', alt: 'Linge plié' },
        // La photo de repassage va à l'ouverture des services ; la bannière à prix est laissée.
        { slot: 'home-services', site: [id('ironing.jpg')], kind: 'photo', subject: 'ironing', query: 'ironing shirt', alt: 'Repassage' },
        // Elle est déjà servie : seule la devanture reste.
        { slot: 'about-atelier', site: [id('ironing.jpg'), id('shop.jpg')], kind: 'photo', subject: 'shop', query: 'laundry shop', alt: 'Atelier' },
      ],
    })
  );
  const decisions = await directMedia({ slots, facts, style, caller, language: 'fr', hasPattern: true, allowVideo: false, library });
  const of = (key: string) => decisions.find((d) => d.slot === key)!;
  check('le manifeste est dans la consigne', prompts.some((p) => p.includes('tropical beach') && p.includes('texte incrusté')));
  check('aucune image ne convient à l’ouverture : visuel cherché ailleurs', of('home-hero').kind === 'photo' && !of('home-hero').site && of('home-hero').query === 'african woman laundry', of('home-hero'));
  check('l’image retenue va à sa section', of('home-services').kind === 'site' && of('home-services').site?.join() === id('ironing.jpg'), of('home-services'));
  check('une image ne sert qu’une fois', of('about-atelier').site?.join() === id('shop.jpg'), of('about-atelier'));
}
{
  const { caller } = answering(JSON.stringify({ assets: [{ slot: 'home-hero', site: [id('promo.jpg')], kind: 'illustration', subject: 'clean clothes', query: 'clean clothes', alt: 'x' }, { slot: 'home-services', kind: 'photo', subject: 's', query: 'q', alt: 'a' }] }));
  const decisions = await directMedia({ slots, facts, style, caller, language: 'fr', hasPattern: true, allowVideo: false, library });
  check('un choix refusé par le code garde le visuel décrit par l’agent', decisions[0].kind === 'illustration' && !decisions[0].site, decisions[0]);
}
{
  const { caller } = answering(new Error('provider down'));
  const decisions = await directMedia({ slots, facts, style, caller, language: 'fr', hasPattern: true, allowVideo: false, library });
  check('sans agent, chaque section reprend ses images d’origine (bornées)', decisions[1].kind === 'site' && decisions[1].site?.[0] === id('ironing.jpg') && decisions[2].site?.join() === id('shop.jpg'), decisions.map((d) => [d.slot, d.kind, d.site]));
  // Sans agent, personne ne juge le sujet : l'ouverture garde son image d'origine quand elle ouvre bien (règle d'avant).
  check('sans agent, l’ouverture garde son image d’origine si elle ouvre bien', decisions[0].kind === 'site' && decisions[0].site?.join() === id('beach.jpg'), decisions[0]);
  const small = await directMedia({ slots: [slot({ id: 'about-hero', role: 'hero', ownImages: [id('shop.jpg')] })], facts, style, caller, language: 'fr', hasPattern: true, allowVideo: false, library });
  check('sans agent, une ouverture sans bonne image n’en reçoit pas', small[0].kind !== 'site', small[0]);
}

console.log('\nGénération sans attente');
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const client = (generateMs: number): MediaClient => ({
  available: true,
  async generateImage() {
    await sleep(generateMs);
    return { url: 'https://gen/image.webp', model: 'flux' };
  },
  async generateVideo() {
    await sleep(generateMs);
    return { url: 'https://gen/clip.mp4', model: 'veo' };
  },
  // La requête précise ne trouve rien ; la requête plus large, si.
  async stock(query) {
    return query.split(' ').length > 2 ? [] : [{ url: `https://stock/${query.replace(/\s+/g, '-')}.jpg`, provider: 'pexels' }];
  },
});
const pipeline = (generateMs: number, upgrades: Array<[string, MediaAsset[]]> | null): PipelineContext => ({
  client: client(generateMs),
  caller: answering(JSON.stringify({ prompt: 'A precise photograph of an african woman folding fresh laundry in a bright shop, natural light, editorial framing. No text.' })).caller,
  facts,
  style,
  language: 'fr',
  pattern: { src: '/brand/pattern.svg', ground: '#fff', tile: 120 },
  note: () => undefined,
  writeFile: () => undefined,
  limit: createLimiter(2),
  generations: { left: 4 },
  ...(upgrades ? { upgrade: (key: string, assets: MediaAsset[]) => upgrades.push([key, assets]), late: [] as Promise<unknown>[] } : {}),
});
{
  const upgrades: Array<[string, MediaAsset[]]> = [];
  const ctx = pipeline(300, upgrades);
  const decision = { slot: 'home-hero', kind: 'photo' as const, subject: 'woman folding laundry', query: 'african woman folding laundry', queryLanguage: 'en' as const, alt: 'Linge plié' };
  const started = Date.now();
  const assets = await produceMedia(slot({ role: 'hero', aspect: '16:9' }), decision, ctx);
  const took = Date.now() - started;
  check('le visuel provisoire est rendu sans attendre la génération', took < 200 && assets[0]?.origin === 'pexels', { took, assets });
  check('la génération est partie en arrière-plan', ctx.late?.length === 1);
  await Promise.all(ctx.late ?? []);
  check('la génération remplace le provisoire', upgrades.length === 1 && upgrades[0][0] === 'home-hero' && upgrades[0][1][0].origin === 'gemini', upgrades);
}
{
  const ctx = pipeline(150, null);
  const decision = { slot: 'home-hero', kind: 'photo' as const, subject: 'woman folding laundry', query: 'african woman folding laundry', queryLanguage: 'en' as const, alt: 'Linge plié' };
  const assets = await produceMedia(slot({ role: 'hero' }), decision, ctx);
  check('sans remplacement possible, la génération est attendue (comme avant)', assets[0]?.origin === 'gemini', assets);
}
{
  const ctx = pipeline(50, []);
  ctx.siteImages = new Map([[id('shop.jpg'), { url: 'https://cdn/shop.jpg', alt: 'Devanture' }]]);
  const assets = await produceMedia(slot({}), { slot: 'about', kind: 'site', site: [id('shop.jpg')], subject: '', query: '', queryLanguage: 'en', alt: 'x' }, ctx);
  check('une image de l’ancien site est posée telle quelle', assets.length === 1 && assets[0].origin === 'site' && assets[0].src === 'https://cdn/shop.jpg' && assets[0].alt === 'Devanture', assets);
}

console.log('\nLecture d’une image (API)');
// L'API est en CommonJS : ses exports arrivent sous `default`.
const readingModule = (await import('../../../../api/api/services/SiteImport/siteImageReading.js')) as unknown as { default?: typeof import('../../../../api/api/services/SiteImport/siteImageReading.js'); parseReading?: (raw: string) => ImageReading | null };
const parseReading = (readingModule.parseReading ?? readingModule.default!.parseReading) as (raw: string) => ImageReading | null;
check('une réponse complète est lue', parseReading('Voici : {"description":"A woman ironing a shirt","kind":"photo","people":true,"text":false,"generic":false,"flaws":[]}')?.people === true);
check('une nature inconnue est refusée', parseReading('{"description":"A woman ironing a shirt","kind":"poster"}') === null);
check('une réponse illisible est refusée', parseReading('je ne sais pas') === null);
check('les défauts sont bornés', (parseReading(`{"description":"A woman ironing a shirt","kind":"photo","flaws":["a","b","c","d","e"]}`)?.flaws.length ?? 0) === 4);

console.log(`\n${passed} réussies, ${failures} échec(s)`);
process.exit(failures ? 1 : 0);

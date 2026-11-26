/**
 * Vérifie que chaque image d'une refonte reste avec SON élément (photo d'équipe ↔ nom, projet ↔ titre), sans aucun
 * appel de modèle. Cas tiré d'une vraie refonte (26/11/2026) : six membres, deux « co-founder », une photo
 * manquante, un rédacteur qui change l'ordre.
 *
 *   npm run check:image-binding
 */
import { bindMediaToItems } from '../src/siteEngine/redesign/binding.js';
import { bestFirst, boundImages, siteImageLibrary, type InventoryImage, type SiteInventory } from '../src/siteEngine/redesign/inventory.js';
import { directMedia, type MediaSlot, type MediaStyle } from '../src/siteEngine/media/mediaDirector.js';
import type { MediaAsset } from '../src/siteEngine/media/mediaPipeline.js';
import type { SiteFacts } from '../src/siteEngine/siteFacts.js';
import type { ModelCaller } from '../src/siteEngine/modelCaller.js';

let failures = 0;
const check = (label: string, ok: boolean, detail?: unknown) => {
  console.log(`  ${ok ? 'ok  ' : '✗ ÉCHEC'} ${label}${ok || detail === undefined ? '' : `\n       ${JSON.stringify(detail)}`}`);
  if (!ok) failures += 1;
};

const TEAM: [string, string][] = [
  ['corine.jpg', 'Corine FONKOUE Founder'],
  ['michelle.png', 'Michèle NANGA Chargé de la communication et partenariats'],
  ['paul.png', 'Paul Shunkiss Webdesigner / Coach Trainer'],
  ['fabrice.jpg', 'Fabrice TAMELAH Data scientist / Coach Trainer'],
  ['joly.png', 'Joly MEWAHA co- founder'],
  ['etoile.png', 'Étoile KINFAK co- founder'],
];
const asset = (file: string, caption?: string): MediaAsset => ({ kind: 'image', src: `https://cdn/${file}`, alt: caption ?? file, origin: 'site', ...(caption ? { caption } : {}) });
const photoOf = (assets: MediaAsset[], i: number) => assets[i]?.src.replace('https://cdn/', '') ?? '(aucune)';

console.log('\n# Le rédacteur change l’ordre et l’écriture des noms');
{
  const assets = TEAM.map(([file, caption]) => asset(file, caption));
  const content = {
    title: 'Notre équipe',
    members: [
      { name: 'Étoile Kinfak', role: 'Co-fondatrice' },
      { name: 'Corine Fonkoue', role: 'Fondatrice' },
      { name: 'Joly Mewaha', role: 'Co-fondateur' },
      { name: 'Fabrice Tamelah', role: 'Data scientist' },
      { name: 'Michèle Nanga', role: 'Communication' },
      { name: 'Paul Shunkiss', role: 'Webdesigner' },
    ],
  };
  const bound = bindMediaToItems(content, assets)!;
  const members = bound.content.members as { name: string }[];
  const expected: Record<string, string> = { 'Étoile Kinfak': 'etoile.png', 'Corine Fonkoue': 'corine.jpg', 'Joly Mewaha': 'joly.png', 'Fabrice Tamelah': 'fabrice.jpg', 'Michèle Nanga': 'michelle.png', 'Paul Shunkiss': 'paul.png' };
  check('liste reconnue : members', bound.list === 'members');
  check('six membres, six photos', bound.matched === 6 && bound.assets.length === 6);
  members.forEach((m, i) => check(`${m.name} → ${photoOf(bound.assets, i)}`, expected[m.name] === photoOf(bound.assets, i)));
}

console.log('\n# Une photo absente (écartée en route) : personne ne prend le visage d’un autre');
{
  const assets = TEAM.filter(([file]) => file !== 'corine.jpg').map(([file, caption]) => asset(file, caption));
  const content = { members: TEAM.map(([, caption]) => ({ name: caption.split(' ').slice(0, 2).join(' '), role: caption.split(' ').slice(2).join(' ') })) };
  const bound = bindMediaToItems(content, assets)!;
  const members = bound.content.members as { name: string }[];
  const corine = members.findIndex((m) => m.name.startsWith('Corine'));
  check('Corine passe en fin de liste', corine === members.length - 1);
  check('… et n’a aucune photo', corine >= bound.assets.length, { corine, assets: bound.assets.length });
  members.slice(0, bound.assets.length).forEach((m, i) => check(`${m.name} → ${photoOf(bound.assets, i)}`, TEAM.find(([, c]) => c.startsWith(m.name))?.[0] === photoOf(bound.assets, i)));
}

console.log('\n# Un membre retiré par le rédacteur : sa photo n’est posée nulle part');
{
  const assets = TEAM.map(([file, caption]) => asset(file, caption));
  const content = { members: TEAM.filter(([file]) => file !== 'paul.png').map(([, caption]) => ({ name: caption.split(' ').slice(0, 2).join(' ') })) };
  const bound = bindMediaToItems(content, assets)!;
  check('photo de Paul retirée', !bound.assets.some((a) => a.src.endsWith('paul.png')) && bound.dropped === 1);
}

console.log('\n# Des rôles partagés ne suffisent pas à apparier');
{
  const assets = [asset('joly.png', 'Joly MEWAHA co- founder'), asset('etoile.png', 'Étoile KINFAK co- founder')];
  const content = { members: [{ name: 'Une personne', role: 'co-founder' }, { name: 'Une autre', role: 'co-founder' }] };
  check('aucun appariement sur « co-founder » seul', bindMediaToItems(content, assets) === null);
}

console.log('\n# Sans légende : rien ne change');
{
  check('images sans légende → null', bindMediaToItems({ cards: [{ title: 'A' }, { title: 'B' }] }, [asset('a.jpg'), asset('b.jpg')]) === null);
}

console.log('\n# Ordre de l’ancien site gardé pour des images liées (le tri par netteté ne les déplace plus)');
{
  const images: InventoryImage[] = TEAM.map(([file, caption], i) => ({ url: file, alt: '', width: 100 + i * 50, height: 100 + i * 50, kind: 'img', caption }));
  check('boundImages : six', boundImages(images).length === 6);
  check('bestFirst garde l’ordre', bestFirst(images).map((i) => i.url).join() === images.map((i) => i.url).join());
  const unbound: InventoryImage[] = images.map(({ caption: _c, ...rest }) => rest);
  check('sans légende, la plus grande passe devant', bestFirst(unbound)[0].url === 'etoile.png');
}

console.log('\n# Agent média : images liées réservées, petites ou pas, dans l’ordre');
await (async () => {
  const inventory: SiteInventory = {
    origin: 'https://ex.cm',
    language: 'fr',
    pages: [
      {
        url: 'https://ex.cm/about',
        path: '/about',
        title: 'À propos',
        sections: [
          {
            id: 'p1.s3',
            headings: ['Notre équipe'],
            texts: [],
            items: [],
            ctas: [],
            images: TEAM.map(([file, caption]) => ({ url: file, alt: '', width: 100, height: 100, kind: 'img' as const, caption, vision: { description: 'Portrait', kind: 'photo' as const, people: true, text: false, generic: false, flaws: [] } })),
          },
          { id: 'p1.s1', headings: ['Histoire'], texts: ['…'], items: [], ctas: [], images: [{ url: 'hero.jpg', alt: '', width: 1600, height: 900, kind: 'img', vision: { description: 'Classroom', kind: 'photo', people: true, text: false, generic: false, flaws: [] } }] },
        ],
      },
    ],
    skipped: [],
    navigation: [],
    footer: { texts: [], links: [] },
    contact: { phones: [], emails: [], whatsapp: [], addresses: [], socials: [] },
    assets: { images: [] },
  };
  const library = siteImageLibrary(inventory)!;
  check('manifeste : 7 images, légendes gardées', library.length === 7 && library.filter((i) => i.caption).length === 6);
  const ids = library.filter((i) => i.caption).map((i) => i.id);
  const slot = (id: string, extra: Partial<MediaSlot> = {}): MediaSlot => ({ id, role: 'section', aspect: '4:3', brief: id, required: false, count: 1, videoAllowed: false, overlay: false, ...extra });
  const slots = [slot('hero', { role: 'hero', aspect: '16:9', required: true }), slot('team', { count: 6, ownImages: ids, boundImages: ids })];
  // L'agent « se trompe » : il met la photo de Corine dans l'ouverture et mélange l'équipe.
  const caller = { json: async (_l: string, _s: string, _p: string, validate: (raw: unknown) => { value?: unknown }) => validate({ assets: [{ slot: 'hero', kind: 'photo', site: [ids[0]], subject: 's', query: 'q', alt: 'a' }, { slot: 'team', kind: 'photo', site: [...ids].reverse(), subject: 's', query: 'q', alt: 'a' }] }) } as unknown as ModelCaller;
  const facts = { name: 'EK', description: 'Éducation numérique', offers: [], team: [] } as unknown as SiteFacts;
  const decisions = await directMedia({ slots, facts, style: { family: 'editorial' } as MediaStyle, caller, language: 'fr', hasPattern: false, allowVideo: false, library });
  const team = decisions.find((d) => d.slot === 'team')!;
  const hero = decisions.find((d) => d.slot === 'hero')!;
  check('équipe : les six, dans l’ordre de l’ancien site', team.kind === 'site' && team.site?.join() === ids.join(), team.site);
  check('ouverture : jamais la photo d’un membre', !(hero.site ?? []).some((id) => ids.includes(id)), hero.site);
})();

console.log(failures ? `\n${failures} échec(s)` : '\nTout est bon.');
process.exit(failures ? 1 : 0);

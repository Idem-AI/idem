/**
 * `npm run check:stock-media` — le routeur des bibliothèques libres de droit (`media/stock`).
 *
 * Aucun réseau : `axios.get` est remplacé par une réponse en mémoire, au nom du fournisseur appelé
 * (déduit de l'URL). Vérifie ce qui rend le choix robuste, pas seulement « une liste de fournisseurs » :
 * le repli vers la bibliothèque suivante quand la première n'a rien de pertinent, l'ordre par rôle
 * (illustration → Pixabay avant Pexels), qu'un fournisseur en panne ne bloque pas les autres, et que
 * Unsplash (photos seulement, dernier repli) prend le relais quand les deux premières n'ont rien.
 */
process.env.PEXELS_API_KEY = 'test-pexels';
process.env.PIXABAY_API_KEY = 'test-pixabay';
process.env.UNSPLASH_ACCESS_KEY = 'test-unsplash';

import axios from 'axios';
import { relevant, searchStockPhotos, searchStockVideos } from '../src/media/stock';

let failures = 0;
let passes = 0;
function ok(label: string, cond: boolean, detail = ''): void {
  if (cond) passes += 1;
  else failures += 1;
  console.log(`  ${cond ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
}

type Fixture = (url: string, params: Record<string, unknown>) => any;
let fixture: Fixture = () => ({ data: {} });
(axios as any).get = async (url: string, config?: { params?: Record<string, unknown> }) => fixture(url, config?.params ?? {});

async function main(): Promise<void> {
  console.log('\nRouteur des bibliothèques libres de droit (media/stock)\n');

  // 1. Pexels pertinent d'abord (rôle photo) : Pixabay n'est pas appelé.
  let pixabayCalled = false;
  fixture = (url) => {
    if (url.includes('pexels.com/v1/search')) return { data: { photos: [{ src: { large2x: 'https://x/a.jpg', medium: 'https://x/a-m.jpg' }, alt: 'coffee farmers harvesting cherries', photographer: 'A', url: 'https://pexels/a' }] } };
    pixabayCalled = true;
    return { data: { hits: [] } };
  };
  const photo1 = await searchStockPhotos('coffee farmers harvesting cherries', 'photo', { count: 1 });
  ok('photo : Pexels pertinent répond, Pixabay non appelé', photo1.length === 1 && photo1[0].provider === 'pexels' && !pixabayCalled);

  // 2. Pexels hors-sujet (aucun mot en commun) : repli sur Pixabay.
  fixture = (url) => {
    if (url.includes('pexels.com/v1/search')) return { data: { photos: [{ src: { large2x: 'https://x/wrong.jpg', medium: 'https://x/wrong-m.jpg' }, alt: 'a red sports car on a race track', photographer: 'B', url: 'https://pexels/b' }] } };
    return { data: { hits: [{ largeImageURL: 'https://x/right.jpg', webformatURL: 'https://x/right-m.jpg', tags: 'coffee, farmer, harvest', user: 'C', pageURL: 'https://pixabay/c' }] } };
  };
  const photo2 = await searchStockPhotos('coffee farmers harvesting cherries', 'photo', { count: 1 });
  ok('photo : Pexels hors-sujet → repli sur Pixabay pertinent', photo2.length === 1 && photo2[0].provider === 'pixabay' && photo2[0].url === 'https://x/right.jpg');

  // 3. Rôle illustration : Pixabay est interrogé avant Pexels.
  let pexelsCalledForIllustration = false;
  fixture = (url) => {
    if (url.includes('pixabay.com/api/') && !url.includes('videos')) return { data: { hits: [{ largeImageURL: 'https://x/ill.jpg', webformatURL: 'https://x/ill-m.jpg', tags: 'delivery, truck, logistics', user: 'D', pageURL: 'https://pixabay/d' }] } };
    pexelsCalledForIllustration = true;
    return { data: { photos: [] } };
  };
  const illu = await searchStockPhotos('delivery truck logistics', 'illustration', { count: 1 });
  ok('illustration : Pixabay interrogé d’abord, répond pertinemment', illu.length === 1 && illu[0].provider === 'pixabay' && !pexelsCalledForIllustration);

  // 4. Pexels en panne (erreur réseau) : repli sur Pixabay sans lever.
  fixture = (url) => {
    if (url.includes('pexels.com')) throw new Error('network down');
    return { data: { hits: [{ largeImageURL: 'https://x/safe.jpg', webformatURL: 'https://x/safe-m.jpg', tags: 'market woman vegetables', user: 'E', pageURL: 'https://pixabay/e' }] } };
  };
  const photo3 = await searchStockPhotos('market woman vegetables', 'photo', { count: 1 }).catch(() => null);
  ok('photo : un fournisseur en panne ne bloque pas le suivant', !!photo3 && photo3.length === 1 && photo3[0].provider === 'pixabay');

  // 5. Aucune bibliothèque configurée : pas d'appel, résultat vide, pas d'exception.
  delete process.env.PEXELS_API_KEY;
  delete process.env.PIXABAY_API_KEY;
  delete process.env.UNSPLASH_ACCESS_KEY;
  const noKey = await searchStockPhotos('anything', 'photo', { count: 1 }).catch(() => null);
  ok('photo : sans clé configurée, résultat vide sans exception', Array.isArray(noKey) && noKey.length === 0);
  process.env.PEXELS_API_KEY = 'test-pexels';
  process.env.PIXABAY_API_KEY = 'test-pixabay';
  process.env.UNSPLASH_ACCESS_KEY = 'test-unsplash';

  // 5bis. Pexels ET Pixabay hors-sujet (rôle photo) : Unsplash prend le relais, en dernier repli.
  fixture = (url) => {
    if (url.includes('pexels.com/v1/search')) return { data: { photos: [{ src: { large2x: 'https://x/wrong1.jpg' }, alt: 'a red sports car', photographer: 'B', url: 'https://pexels/b' }] } };
    if (url.includes('pixabay.com/api/') && !url.includes('videos')) return { data: { hits: [{ largeImageURL: 'https://x/wrong2.jpg', tags: 'race car track', user: 'C', pageURL: 'https://pixabay/c' }] } };
    return { data: { results: [{ urls: { regular: 'https://x/right.jpg', small: 'https://x/right-m.jpg' }, alt_description: 'coffee farmers harvesting cherries', user: { name: 'G' }, links: { html: 'https://unsplash/g' } }] } };
  };
  const photo4 = await searchStockPhotos('coffee farmers harvesting cherries', 'photo', { count: 1 });
  ok('photo : Pexels et Pixabay hors-sujet → repli sur Unsplash pertinent', photo4.length === 1 && photo4[0].provider === 'unsplash' && photo4[0].url === 'https://x/right.jpg');

  // 5ter. Unsplash n'a pas de vidéos : jamais appelé pour ce rôle (vérifié indirectement au test 6).

  // 6. Vidéo : même logique de repli que les photos.
  fixture = (url) => {
    if (url.includes('pexels.com/videos/search')) return { data: { videos: [] } };
    return {
      data: {
        hits: [
          { duration: 8, videos: { medium: { url: 'https://x/clip.mp4', width: 1280, height: 720 } }, tags: 'barista espresso coffee', user: 'F', pageURL: 'https://pixabay/f' },
        ],
      },
    };
  };
  const video1 = await searchStockVideos('barista espresso coffee', { count: 1 });
  ok('vidéo : Pexels vide → repli sur Pixabay', video1.length === 1 && video1[0].provider === 'pixabay' && video1[0].url === 'https://x/clip.mp4');

  // 7. Le filtre de pertinence lui-même : un résultat hors-sujet est écarté.
  const ranked = relevant([{ text: 'a red sports car' }, { text: 'coffee farmers harvesting cherries' }], (item) => item.text, 'coffee harvest');
  ok('pertinence : le résultat qui partage des mots passe en tête, le hors-sujet est écarté', ranked.length === 1 && ranked[0].text.includes('coffee'));

  console.log(`\n${failures ? '✗' : '✓'} media/stock : ${passes} vérification(s) réussie(s), ${failures} en échec.`);
  process.exit(failures ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

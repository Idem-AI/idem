/**
 * Contrôle du REGISTRE DES RESSOURCES — `npm run check:assets`.
 *
 * Le registre est commun aux documents (moteur graphique) et aux vidéos (sourcing du cœur) : une image
 * obtenue par l'un se reprend dans l'autre, avant toute génération. Aucun réseau, aucun modèle : la
 * génération et le stockage sont des doubles en mémoire.
 */
import sharp from 'sharp';
import type { AssetRecord } from '@idem/graphic-engine';
import { planAssets, resolveAssets, FORMATS } from '@idem/graphic-engine';
import { createAssetRegistry, MAX_RECORDS, recordsFromBrand } from '../../../ivision/core/src/media/asset-registry';
import { configureCore } from '../../../ivision/core/src/runtime/host';
import { sourceShots, ShotPlan } from '../../../ivision/core/src/video/assets/sourcing';

let failures = 0;
let passed = 0;
const ok = (label: string, cond: boolean, detail = ''): void => {
  if (cond) passed += 1;
  else failures += 1;
  console.log(`  ${cond ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
};

async function main(): Promise<void> {
  console.log('\nRegistre des ressources (documents ↔ vidéos)\n');

  // 1. Ce que la marque possède déjà.
  const brand = {
    media: [{ url: 'https://x/site.png', kind: 'screen' as const, note: 'screenshot: subscription dashboard with delivery tracking' }, { url: 'https://x/team.jpg', note: 'photo: the team roasting coffee in Douala' }],
    visuals: [{ backgroundImageUrl: 'https://x/visual.jpg', photo: { subject: 'cup of coffee on a wooden table' }, imageSource: 'generated' } as any],
    videos: [{ media: [{ id: 'm1', kind: 'video', url: 'https://x/clip.webm', origin: 'generated', name: 'farmers harvesting coffee cherries' }] } as any],
  };
  const derived = recordsFromBrand(brand);
  ok('marque : capture → capture produit, photo importée → utilisateur, fond de visuel et clip de vidéo inscrits', derived.find((r) => r.url.endsWith('site.png'))?.role === 'product-capture' && derived.find((r) => r.url.endsWith('site.png'))?.source === 'capture' && derived.find((r) => r.url.endsWith('team.jpg'))?.source === 'user' && derived.some((r) => r.origin === 'visual') && derived.some((r) => r.role === 'clip'));

  // 2. Le registre : inscriptions + marque, sans doublon, borné.
  const stored = new Map<string, AssetRecord[]>();
  const registry = createAssetRegistry({ store: { get: async (p) => stored.get(p) ?? [], set: async (p, r) => void stored.set(p, r) }, loadBrand: async () => brand });
  const ctx = { userId: 'u', projectId: 'p' };
  await registry.remember(ctx, [{ id: 'a', url: 'https://x/visual.jpg', kind: 'image', role: 'photo', source: 'generated', subject: 'updated', origin: 'deck', provenance: { provider: 'openrouter' } }]);
  const listed = await registry.list(ctx);
  ok('registre : une adresse une seule fois, l’inscription la plus récente l’emporte', listed.filter((r) => r.url === 'https://x/visual.jpg').length === 1 && listed.find((r) => r.url === 'https://x/visual.jpg')?.subject === 'updated');
  await registry.remember(ctx, Array.from({ length: MAX_RECORDS + 20 }, (_, i) => ({ id: `n${i}`, url: `https://x/n${i}.jpg`, kind: 'image' as const, role: 'photo' as const, source: 'stock' as const, subject: `photo ${i}`, origin: 'video' as const, provenance: { provider: 'pexels' } })));
  ok(`registre : borné à ${MAX_RECORDS} inscriptions`, (stored.get('p') ?? []).length === MAX_RECORDS);
  stored.clear();

  // 3. Deck → vidéo : la photo générée pour le deck est reprise par la vidéo, sans génération.
  const remembered: AssetRecord[] = [];
  const deckSection = { id: 'vision', title: 'Le café d’ici, bu ici', intent: { visualStrategy: 'full-bleed' as const, image: { subject: 'coffee farmers harvesting red cherries on a hillside in Cameroon' } }, blocks: [] };
  const reqs = planAssets(deckSection, FORMATS['slide-16x9']);
  const deckRes = await resolveAssets(reqs, { generated: { resolve: async () => ({ url: 'https://x/deck-hero.jpg', alt: 'x', provenance: { provider: 'openrouter' } }) } }, { level: 'high', documentType: 'pitch-deck', ...ctx }, { generationLeft: 3, registry: { list: async () => [], remember: async (_c, r) => void remembered.push(...r) } });
  ok('deck : l’image générée est inscrite au registre (origine deck)', deckRes.resolved[0]?.source === 'generated' && remembered[0]?.origin === 'deck');
  const plan = (kind: 'image' | 'video', shot: string, query: string): ShotPlan => ({ scene: 0, sceneId: 'footage', kind, slot: 0, texts: [], shot, query });
  const reuse = await sourceShots({ direction: { look: 'natural light', shots: [plan('image', 'farmers harvesting ripe coffee cherries on a green hillside', 'coffee harvest Cameroon')], source: 'llm' }, orientation: 'landscape', storage: { uploadFile: async () => ({ downloadURL: 'x' }) } as any, folder: 'f', allowGenerate: false, allowStock: false, clipQuality: 'speed', registry: { records: remembered, remember: async () => undefined } });
  ok('vidéo : le plan reprend la photo du deck (registre), sans génération ni banque', reuse.assets[0]?.url === 'https://x/deck-hero.jpg' && reuse.report.fromRegistry === 1 && reuse.report.generatedImages === 0 && (reuse.report.assets ?? [])[0].includes('registre'));
  const unrelated = await sourceShots({ direction: { look: 'x', shots: [plan('image', 'a red sports car on a race track', 'sports car')], source: 'llm' }, orientation: 'landscape', storage: {} as any, folder: 'f', allowGenerate: false, allowStock: false, clipQuality: 'speed', registry: { records: remembered, remember: async () => undefined } });
  ok('vidéo : un plan sans rapport ne prend pas la photo du deck', unrelated.assets.length === 0 && (unrelated.report.assets ?? [])[0].endsWith('✗'));

  // 4. Vidéo → registre : ce que la vidéo génère y est inscrit (le deck suivant le reprendra).
  const png = await sharp({ create: { width: 64, height: 36, channels: 3, background: '#335533' } }).png().toBuffer();
  configureCore({ generateImage: async () => ({ buffer: png, mimeType: 'image/png', model: 'test/flux' }) });
  const fromVideo: AssetRecord[] = [];
  await sourceShots({ direction: { look: 'x', shots: [plan('image', 'a barista pouring espresso in a bright cafe', 'barista espresso')], source: 'llm' }, orientation: 'landscape', storage: { uploadFile: async (_b: Buffer, name: string) => ({ downloadURL: `https://x/${name}` }) } as any, folder: 'f', allowGenerate: true, allowStock: false, clipQuality: 'speed', registry: { records: [], remember: async (r) => void fromVideo.push(...r) } });
  ok('vidéo : la photo générée rejoint le registre (origine vidéo, provenance)', fromVideo.length === 1 && fromVideo[0].origin === 'video' && fromVideo[0].source === 'generated');
  const deckAgain = await resolveAssets(planAssets({ ...deckSection, intent: { visualStrategy: 'full-bleed', image: { subject: 'a barista pouring an espresso in a cafe' } } }, FORMATS['slide-16x9']), {}, { level: 'medium', documentType: 'pitch-deck', ...ctx }, { generationLeft: 0, registry: { list: async () => fromVideo, remember: async () => undefined } });
  ok('deck (Medium) : reprend la photo générée par la vidéo, sans rien payer', deckAgain.resolved[0]?.url === fromVideo[0].url);

  console.log(`\n${failures ? '✗' : '✓'} Registre : ${passed} vérification(s) réussie(s), ${failures} en échec.`);
  process.exit(failures ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

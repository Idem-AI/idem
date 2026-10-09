// Banc d'essai du moteur de visuels : toutes les compositions, avec la vraie marque DevGirls.
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { loadSecrets } from '../../src/config/secrets';
(async () => {
  await loadSecrets();
  process.env.RENDER_ALLOWED_HOSTS = 'localhost,127.0.0.1';
  const { connectDatabase, collection } = await import('../../src/config/db');
  await connectDatabase();
  const brand: any = await collection<any>('brands').findOne({ _id: 'brand_mv0osyv845218a7b' });
  const { POSTER_TEMPLATES } = await import('../../../core/src/visual/poster/poster.templates');
  const { renderPoster, posterFonts } = await import('../../../core/src/visual/poster/poster.render');
  const { specFor, schemesOf } = await import('../../../core/src/visual/poster/poster.spec');
  const { posterImage, analyzeLogo } = await import('../../../core/src/visual/poster/poster.images');
  const out = process.argv[2] || '/tmp/gallery';
  fs.mkdirSync(out, { recursive: true });
  const photos = (await Promise.all(brand.photos.slice(0, 7).map((u: string) => posterImage(u, 'brand')))).filter(Boolean) as any[];
  console.log('photos', photos.length, brand.photos.slice(0, 7));
  const logo = await analyzeLogo(brand.kit.logo?.assetUrls?.primary);
  console.log('logo', logo);
  const fonts = posterFonts(brand.kit.typography);
  const copies: Record<string, any> = {
    event: { kicker: 'DevGirls Live', headline: 'La tech au féminin prend le micro', sub: 'Scène ouverte, témoignages et rencontres pour celles qui codent et construisent.', facts: [{ kind: 'date', text: 'Samedi 12 oct.' }, { kind: 'time', text: '18h00' }, { kind: 'place', text: 'La Scène · Paris 11e' }, { kind: 'other', text: 'Entrée libre' }], emphasis: 3 },
    promo: { kicker: 'Formations', headline: 'Sur toutes nos formations web', sub: "Pour celles qui se lancent dans le code cette rentrée.", facts: [{ kind: 'date', text: "Jusqu'au 31 octobre" }], offer: '−30 %', emphasis: 4 },
    quote: { headline: 'Elles racontent DevGirls', facts: [], quote: { text: "DevGirls m'a donné le courage de lancer ma propre startup.", author: 'Awa K., développeuse full-stack' } },
  };
  const which = (process.argv[3] || '').split(',').filter(Boolean);
  const formats = (process.argv[4] || 'square,story').split(',') as any[];
  for (const format of formats) {
    const tiles: string[] = [];
    for (const t of POSTER_TEMPLATES) {
      if (which.length && !which.includes(t.id)) continue;
      const copy = t.id === 'offer' ? copies.promo : t.id === 'quote' ? copies.quote : copies.event;
      const input = { format, copy, palette: brand.kit.colors.colors, image: t.needsImage || t.id === 'event' || t.id === 'offer' ? photos[2] : undefined, extraImages: [photos[0], photos[2]], allowDark: true, logo, brandName: brand.name, language: 'fr' };
      const schemes = schemesOf(input as any);
      for (const sid of [...t.schemes.slice(0, 2), 'ink'].filter((v, i, a) => a.indexOf(v) === i)) {
        if (!schemes.find((s) => s.id === sid)) continue;
        const spec = specFor(input as any, { template: t.id, scheme: sid, mirror: false, treatment: 'natural' }, schemes)!;
        if (t.needs && !t.needs(spec)) continue;
        const res = await renderPoster(spec, t.render(spec), fonts);
        const file = path.join(out, `${format}-${t.id}-${sid}.png`);
        fs.writeFileSync(file, res.png);
        tiles.push(file);
        console.log(format, t.id, sid, 'score', res.measure.score, res.measure.blocking ? 'BLOCK' : '', JSON.stringify({ o: res.measure.overflow, x: res.measure.overlaps, out: res.measure.outside, h: res.measure.headlineU.toFixed(1) }));
      }
    }
    // Planche : 4 colonnes.
    const tw = format === 'story' ? 270 : format === 'banner' ? 480 : 360, th = format === 'story' ? 480 : format === 'banner' ? 252 : 360;
    const cols = format === 'banner' ? 4 : 6, rows = Math.ceil(tiles.length / cols);
    const comps = await Promise.all(tiles.map(async (f, i) => ({ input: await sharp(f).resize(tw, th).toBuffer(), left: (i % cols) * (tw + 10), top: Math.floor(i / cols) * (th + 10) })));
    await sharp({ create: { width: cols * (tw + 10), height: rows * (th + 10), channels: 3, background: '#cccccc' } }).composite(comps).png().toFile(path.join(out, `sheet-${format}.png`));
  }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });

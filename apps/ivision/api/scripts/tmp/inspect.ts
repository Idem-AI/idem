import { loadSecrets } from '../../src/config/secrets';
(async () => {
  await loadSecrets();
  const { connectDatabase, collection } = await import('../../src/config/db');
  await connectDatabase();
  const visuals = await collection<any>('visuals').find({}).sort({ createdAt: -1 }).limit(5).toArray();
  for (const v of visuals) console.log(JSON.stringify({ id: v._id, brandId: v.brandId, prompt: v.prompt, format: v.format, creativity: v.creativity, layout: v.layout, score: v.audit?.score, img: v.imageUrl, htmlLen: v.html?.length, createdAt: v.createdAt }));
  const brandIds = [...new Set(visuals.map((v: any) => v.brandId))];
  for (const id of brandIds) {
    const b = await collection<any>('brands').findOne({ _id: id });
    if (!b) continue;
    console.log('BRAND', JSON.stringify({ id: b._id, name: b.name, source: b.source, site: b.siteUrl, status: b.status, colors: b.kit?.colors, typography: b.kit?.typography, logo: { svg: !!b.kit?.logo?.svg, assetUrls: b.kit?.logo?.assetUrls }, art: b.kit?.artDirection ? Object.keys(b.kit.artDirection) : null, styleId: b.kit?.artDirection?.styleId, voice: b.voice, photos: b.photos?.length }));
  }
  const sessions = await collection<any>('sessions').find({ mode: 'image' }).sort({ updatedAt: -1 }).limit(2).toArray();
  for (const s of sessions) console.log('SESSION', s._id, s.messages.filter((m: any) => m.role === 'user').map((m: any) => m.text).join(' | '));
  process.exit(0);
})();

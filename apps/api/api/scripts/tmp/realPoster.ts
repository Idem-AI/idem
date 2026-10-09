// Les vraies demandes, moteur branché sur les fournisseurs d'IDEM (sans l'API en cours d'exécution).
import fs from 'fs';
import path from 'path';
import { loadSecrets } from '../../config/secrets';
(async () => {
  await loadSecrets();
  process.env.RENDER_ALLOWED_HOSTS = 'localhost,127.0.0.1';
  await import('../../services/ivision/host');
  const mongoose = (await import('mongoose')).default;
  await mongoose.connect(process.env.MONGODB_URI!);
  const brand: any = await mongoose.connection.collection('ivision_brands').findOne({ _id: 'brand_mv0osyv845218a7b' } as any);
  const { composeVisual } = await import('../../../../ivision/core/src/visual/visual.composer');
  const { visualContextFromBrand } = await import('../../../../ivision/core/src/visual/visual.context');
  const { runtimeCall } = await import('../../services/creativity/orchestrator');
  const { classifyImage } = await import('../../../../ivision/core/src/visual/poster/poster.images');
  const kinds = await Promise.all(brand.photos.map((u: string) => classifyImage(u)));
  console.log('kinds', kinds.map((k: any) => `${k.kind}:${k.luminance.toFixed(2)}`).join(' '));
  const posters = kinds.filter((k: any) => k.kind === 'poster');
  const darkBrand = posters.length > 0 && posters.reduce((s: number, p: any) => s + p.luminance, 0) / posters.length < 0.24;
  const context = visualContextFromBrand({ brandName: brand.name, voice: brand.voice, branding: brand.kit });
  const out = process.argv[2];
  fs.mkdirSync(out, { recursive: true });
  for (const c of JSON.parse(process.argv[3])) {
    const t0 = Date.now();
    try {
      const r = await composeVisual({ runPrompt: async () => '', agentCall: runtimeCall({ userId: brand.userId, projectId: brand._id, element: 'flyer' }) }, brand.userId, brand._id, { id: c.name, title: c.title, description: c.text }, context, c.format || 'square', 'check', `${brand._id}:${c.name}:${Date.now()}`, undefined, false, { creativity: c.level, brandPhotos: brand.photos, allowDark: darkBrand, feedback: c.feedback, avoid: c.avoid });
      fs.writeFileSync(path.join(out, `${c.name}.png`), r.png);
      console.log(c.name, c.level, (r.parsed as any).layout, (r.parsed as any).scheme, 'score', r.audit.score, JSON.stringify((r.parsed as any).copy), `${Math.round((Date.now() - t0) / 1000)} s`);
    } catch (e: any) {
      console.log(c.name, 'FAILED', e.message);
    }
  }
  process.exit(0);
})();

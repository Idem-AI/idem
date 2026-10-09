// Les vraies demandes de l'utilisateur, avec les vrais modèles (passerelle IDEM), sans débit.
import fs from 'fs';
import path from 'path';
import { loadSecrets } from '../../src/config/secrets';
(async () => {
  await loadSecrets();
  process.env.RENDER_ALLOWED_HOSTS = 'localhost,127.0.0.1';
  const { connectDatabase, collection } = await import('../../src/config/db');
  await connectDatabase();
  const { configureCoreForIvision } = await import('../../src/core-host');
  configureCoreForIvision();
  const { createVisual } = await import('../../src/services/visuals.service');
  const { messageOf, formatIn } = await import('../../src/services/chat.service');
  const brand: any = await collection<any>('brands').findOne({ _id: 'brand_mv0osyv845218a7b' });
  const out = process.argv[2];
  fs.mkdirSync(out, { recursive: true });
  const cases = JSON.parse(process.argv[3]);
  for (const c of cases) {
    const t0 = Date.now();
    try {
      const v = await createVisual(brand.userId, brand, { prompt: messageOf(c.text), brief: c.text, format: formatIn(c.text) || c.format || 'square', creativity: c.level, withPhoto: true, feedback: c.feedback, avoid: c.avoid }, 0);
      const png = await fetch(v.imageUrl).then((r) => r.arrayBuffer());
      const file = path.join(out, `${c.name}.png`);
      fs.writeFileSync(file, Buffer.from(png));
      console.log(c.name, c.level, v.format, v.layout, v.scheme, 'score', v.audit?.score, `${Math.round((Date.now() - t0) / 1000)} s`);
    } catch (e: any) {
      console.log(c.name, 'FAILED', e.message);
    }
  }
  process.exit(0);
})();

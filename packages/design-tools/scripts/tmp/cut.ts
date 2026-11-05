import sharp from 'sharp';
import { cutout, treatPhoto } from '../../src';
(async () => {
  const img = await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200"><defs><linearGradient id="g"><stop offset="0" stop-color="#9fb8c9"/><stop offset="1" stop-color="#dfe7ec"/></linearGradient></defs><rect width="900" height="1200" fill="url(#g)"/><ellipse cx="450" cy="420" rx="170" ry="210" fill="#7a4b2a"/><rect x="250" y="600" width="400" height="600" rx="120" fill="#c0392b"/></svg>')).jpeg().toBuffer();
  for (const m of ['u2netp', 'isnet'] as const) {
    const r = await cutout(img, m);
    console.log(m, r ? { coverage: r.coverage, box: r.box, ms: r.ms } : 'indisponible');
    if (r) await sharp(r.png).toFile(`/private/tmp/claude-501/-Users-pharaon-Documents-pharaon-IDEM-AFRICA/ffd117ed-b1ae-485b-9526-5080984870b8/scratchpad/cut-${m}.png`);
  }
  const t = Date.now();
  await treatPhoto(img, 'duotone', { dark: '#14324a', light: '#f2a93b' });
  console.log('duotone ms', Date.now() - t);
})();

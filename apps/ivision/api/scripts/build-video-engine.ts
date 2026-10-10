/**
 * `npm run build:video-engine` — les paquets du moteur vidéo (runtime React, moteur, addons)
 * pour CETTE API, dans `public/video-engine/`. Mêmes sources que l'API IDEM
 * (`apps/ivision/core/engine/src`), même construction.
 */
import path from 'path';
import { buildVideoEngine } from '../../core/src/video/video.engine';

buildVideoEngine(process.env.VIDEO_ENGINE_DIR || path.resolve(__dirname, '../public/video-engine'))
  .then((b) => {
    const kb = (s: string) => `${Math.round(s.length / 1024)} ko`;
    console.log(`✓ runtime ${kb(b.runtime)} · moteur ${kb(b.engine)}`);
    for (const [id, js] of Object.entries(b.addons)) console.log(`  addon ${id} : ${kb(js)}`);
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

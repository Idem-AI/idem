/** `npm run build:video-engine` — empaquette le moteur React des vidéos (runtime, moteur, addons). */
import { buildVideoEngine } from '../../../ivision/core/src/video/video.engine';

buildVideoEngine()
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

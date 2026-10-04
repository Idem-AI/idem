/** `npm run build:video-engine` — empaquette le moteur React des vidéos. */
import { buildVideoEngine } from '../services/Communication/video/video.engine';

buildVideoEngine()
  .then((js) => {
    console.log(`✓ moteur vidéo : ${Math.round(js.length / 1024)} ko`);
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

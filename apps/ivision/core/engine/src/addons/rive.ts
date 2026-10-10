/**
 * Addon Rive : fichiers .riv importés par l'utilisateur (logos animés, mascottes).
 *
 * Le moteur WebAssembly est embarqué dans le paquet (aucun téléchargement depuis
 * unpkg pendant le rendu). Pas de lecture automatique : chaque image pose
 * l'animation par `scrub(nom, secondes)`. Les machines à états, interactives par
 * nature, ne sont pas pilotées : on joue la première animation linéaire.
 */
import { Alignment, Fit, Layout, Rive, RuntimeLoader } from '@rive-app/canvas';
import wasm from '@rive-app/canvas/rive.wasm';
import { registerAddon } from '../shared';

RuntimeLoader.setWasmUrl(URL.createObjectURL(new Blob([wasm as BlobPart], { type: 'application/wasm' })));

registerAddon('rive', {
  mount(canvas, buffer) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('rive load timeout')), 20000);
      const r: any = new Rive({
        canvas,
        buffer,
        autoplay: false,
        layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
        onLoad: () => {
          clearTimeout(timer);
          r.resizeDrawingSurfaceToCanvas?.();
          const name: string | undefined = r.animationNames?.[0];
          // Durée de l'animation (secondes) lue sur le fichier, 3 s à défaut.
          let duration = 3;
          try {
            const anim = r.artboard?.animationByName?.(name);
            if (anim) duration = anim.duration / (anim.fps || 60) || duration;
          } catch {
            /* durée par défaut */
          }
          resolve({
            duration,
            seek(t: number) {
              if (!name) return;
              r.scrub(name, duration > 0 ? t % duration : t);
            },
          });
        },
        onLoadError: () => {
          clearTimeout(timer);
          reject(new Error('rive load error'));
        },
      });
    });
  },
});

/**
 * Addon OGL : les fonds de matière en shader (aurore, satin, plasma, encre, dégradé à points,
 * courbes de niveau, vagues, métaballes).
 *
 * OGL ne sert ici qu'à poser un triangle plein cadre et à compiler le programme : aucune boucle
 * (`requestAnimationFrame`) ne tourne. Le kit (`kit/Shader.tsx`) donne à chaque image les
 * uniformes de l'instant (`uTime` vient du moteur) et la toile se dessine une fois. La toile est
 * créée à l'apparition de la scène et libérée à son départ (`gl.tsx`).
 */
import { Mesh, Program, Renderer, Triangle } from 'ogl';
import { GlInstance, registerAddon } from '../shared';
import { SHADERS, SHADER_IDS, VERTEX } from './shaders';

registerAddon('ogl', {
  effects: SHADER_IDS,
  create(canvas, opts): GlInstance | null {
    const fragment = SHADERS[opts.effect];
    if (!fragment) return null;
    const renderer = new Renderer({ canvas, width: opts.width, height: opts.height, dpr: 1, alpha: true, premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: true });
    const gl = renderer.gl;
    if (!gl) return null;
    // OGL écrit width/height en ligne sur la toile : la feuille du moteur (100 % du cadre) doit rester maîtresse.
    canvas.style.width = '';
    canvas.style.height = '';
    gl.clearColor(0, 0, 0, 0);
    const uniforms: Record<string, { value: any }> = {};
    for (const [k, v] of Object.entries(opts.uniforms)) uniforms[k] = { value: v };
    const program = new Program(gl, { vertex: VERTEX, fragment, uniforms, transparent: true, depthTest: false, depthWrite: false, cullFace: false });
    const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });
    return {
      render(params) {
        for (const [k, v] of Object.entries(params)) if (program.uniforms[k]) program.uniforms[k].value = v;
        renderer.render({ scene: mesh });
      },
      dispose() {
        gl.getExtension('WEBGL_lose_context')?.loseContext();
      },
    };
  },
});

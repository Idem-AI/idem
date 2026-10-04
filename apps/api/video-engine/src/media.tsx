/**
 * Médias pilotés par le temps : clips vidéo, animations Lottie, scènes 3D.
 *
 * Chaque média s'inscrit dans un registre au montage ; à chaque image, le moteur
 * le pose à l'instant t (clip positionné, Lottie sur sa trame, 3D recalculée
 * puis dessinée). Au rendu, rien ne « joue » tout seul.
 */
import { useEffect, useRef } from 'react';
import { Timed, useScene } from './context';

declare const lottie: any;
declare const THREE: any;
declare const THREE_EXTRA: any;

// ─── Registres ──────────────────────────────────────────────────────────────

interface ClipEntry { v: HTMLVideoElement; s: Timed }
interface LottieEntry { anim: any; s: Timed; fr: number; total: number; loop: boolean }
interface ThreeEntry { s: Timed; update: (lt: number) => void; render: () => void; failed?: boolean }

const clips: ClipEntry[] = [];
const lotties: LottieEntry[] = [];
const threes: ThreeEntry[] = [];
const pending: Promise<unknown>[] = [];

export function mediaReady(): Promise<unknown> {
  return Promise.all(pending);
}

const visible = (s: Timed, t: number) => t >= s.visFrom - 0.05 && t <= s.visTo + 0.05;

function clipTime(c: ClipEntry, t: number): number {
  const dur = c.v.duration || 0;
  if (!dur) return 0;
  const local = Math.max(0, t - c.s.visFrom);
  const usable = Math.max(0.5, dur - 0.05);
  return local > usable ? local % usable : local;
}

/** Rendu : chaque clip visible est posé exactement à son image (promesse). */
export function syncClipsExact(t: number): Promise<unknown> | null {
  const jobs: Promise<unknown>[] = [];
  for (const c of clips) {
    if (!visible(c.s, t) || !c.v.duration) continue;
    const want = clipTime(c, t);
    if (Math.abs(c.v.currentTime - want) < 0.004) continue;
    jobs.push(
      new Promise<void>((res) => {
        let done = false;
        const fin = () => {
          if (!done) {
            done = true;
            res();
          }
        };
        c.v.addEventListener('seeked', fin, { once: true });
        try {
          c.v.currentTime = want;
        } catch {
          fin();
        }
        setTimeout(fin, 3000);
      })
    );
  }
  return jobs.length ? Promise.all(jobs) : null;
}

/** Aperçu : les clips jouent nativement, recalés s'ils dérivent. */
export function syncClipsPreview(t: number, playing: boolean): void {
  for (const c of clips) {
    const on = visible(c.s, t);
    const want = clipTime(c, t);
    if (!on || !playing) {
      if (!c.v.paused) c.v.pause();
      if (on && Math.abs(c.v.currentTime - want) > 0.1) c.v.currentTime = want;
      continue;
    }
    if (Math.abs(c.v.currentTime - want) > 0.3) c.v.currentTime = want;
    if (c.v.paused) c.v.play().catch(() => undefined);
  }
}

export function syncLotties(t: number): void {
  for (const l of lotties) {
    if (!visible(l.s, t)) continue;
    let f = Math.max(0, t - l.s.tin) * l.fr;
    f = l.loop ? f % l.total : Math.min(l.total - 1, f);
    l.anim.goToAndStop(f, true);
  }
}

export function syncThree(t: number): void {
  for (const e of threes) {
    if (e.failed || !visible(e.s, t)) continue;
    e.update(Math.max(0, t - e.s.tin));
    e.render();
  }
}

// ─── Clip vidéo ─────────────────────────────────────────────────────────────

export function Clip({ src, className }: { src: string; className?: string }) {
  const s = useScene();
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = true;
    clips.push({ v, s });
    pending.push(
      new Promise<void>((res) => {
        if (v.readyState >= 2) return res();
        v.addEventListener('loadeddata', () => res(), { once: true });
        v.addEventListener('error', () => {
          v.style.visibility = 'hidden';
          res();
        }, { once: true });
        setTimeout(res, 15000);
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <video ref={ref} className={className} src={src} muted playsInline preload="auto" />;
}

// ─── Lottie ─────────────────────────────────────────────────────────────────

export function LottieBox({ data, loop, className }: { data: unknown; loop: boolean; className?: string }) {
  const s = useScene();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current || !data || typeof lottie === 'undefined') return;
    const json: any = JSON.parse(JSON.stringify(data));
    pending.push(
      new Promise<void>((res) => {
        try {
          const anim = lottie.loadAnimation({ container: ref.current, renderer: 'svg', loop: false, autoplay: false, animationData: json, rendererSettings: { preserveAspectRatio: 'xMidYMid meet' } });
          lotties.push({ anim, s, fr: json.fr || 30, total: Math.max(1, (json.op || 60) - (json.ip || 0)), loop });
          anim.addEventListener('DOMLoaded', () => {
            anim.goToAndStop(0, true);
            res();
          });
        } catch {
          res();
        }
        setTimeout(res, 5000);
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <div ref={ref} className={className} />;
}

// ─── 3D (three.js) ──────────────────────────────────────────────────────────

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
const smooth = (x: number) => {
  const v = clamp01(x);
  return v * v * (3 - 2 * v);
};

export function ThreeView({ cfg, width, height, horizontal }: { cfg: Record<string, any>; width: number; height: number; horizontal: boolean }) {
  const s = useScene();
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current || typeof THREE === 'undefined') return;
    const entry: ThreeEntry = { s, update: () => undefined, render: () => undefined };
    threes.push(entry);
    pending.push(
      setup(ref.current, cfg, width, height, horizontal, s, entry).catch((e) => {
        entry.failed = true;
        console.error('three', e?.message);
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <canvas ref={ref} className="three-canvas" />;
}

async function setup(canvas: HTMLCanvasElement, cfg: Record<string, any>, w: number, h: number, horizontal: boolean, s: Timed, entry: ThreeEntry) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(w, h, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new THREE_EXTRA.RoomEnvironment(), 0.04).texture;
  const camera = new THREE.PerspectiveCamera(horizontal ? 28 : 36, w / h, 0.1, 100);
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(3, 5, 4);
  const rim = new THREE.DirectionalLight(new THREE.Color(cfg.accent || '#ffffff'), 1.8);
  rim.position.set(-4, 2, -3);
  scene.add(key, rim, new THREE.HemisphereLight(0xffffff, new THREE.Color(cfg.primary || '#888888'), 0.5));
  const root = new THREE.Group();
  const tall = h / w > 1.5;
  root.position.y = horizontal ? 0.15 : tall ? 0.45 : 0.75;
  if (horizontal && cfg.mode !== 'logo') root.position.x = 0.95;
  scene.add(root);
  const compact = !horizontal && !tall;
  const span = s.span || 4;
  entry.render = () => renderer.render(scene, camera);

  if (cfg.mode === 'model' && cfg.model) {
    const buf = await (await fetch(cfg.model)).arrayBuffer();
    const gltf: any = await new Promise((res, rej) => new THREE_EXTRA.GLTFLoader().parse(buf, '', res, rej));
    const obj = gltf.scene;
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const k = (compact ? 1.6 : 2.1) / Math.max(size.x, size.y, size.z);
    obj.scale.setScalar(k);
    obj.position.copy(center.multiplyScalar(-k));
    const pivot = new THREE.Group();
    pivot.add(obj);
    root.add(pivot, softShadow(-size.y * k / 2 - 0.02));
    entry.update = (lt) => {
      const e = easeOut(lt / 1.3);
      pivot.rotation.y = -1.6 * (1 - e) + lt * 0.55 - 0.4;
      pivot.position.y = Math.sin(lt * 1.7) * 0.05 + (1 - e) * -0.5;
      pivot.scale.setScalar(0.8 + 0.2 * e);
      camera.position.set(0, 0.35, 6.4 - 0.8 * smooth(lt / span));
      camera.lookAt(0, root.position.y * 0.55, 0);
    };
  } else if (cfg.mode === 'cards' && cfg.images?.length) {
    const loader = new THREE.TextureLoader();
    const cards: any[] = [];
    for (const src of cfg.images.slice(0, 4)) {
      const tex = await loader.loadAsync(src);
      tex.colorSpace = THREE.SRGBColorSpace;
      const ar = tex.image ? tex.image.width / tex.image.height : 1;
      const hh = horizontal ? 1.55 : 1.3;
      const ww = Math.min(horizontal ? 2.1 : 1.5, hh * ar);
      const card = new THREE.Group();
      const frame = new THREE.Mesh(new THREE.PlaneGeometry(ww + 0.08, hh + 0.08), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, transparent: true }));
      frame.position.z = -0.005;
      const face = new THREE.Mesh(new THREE.PlaneGeometry(ww, hh), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, transparent: true }));
      card.add(frame, face);
      root.add(card);
      cards.push(card);
    }
    const n = Math.max(1, cards.length);
    entry.update = (lt) => {
      cards.forEach((card, i) => {
        const a = (i - (n - 1) / 2) * (horizontal ? 0.55 : 0.34);
        const e = easeOut((lt - i * 0.18) / 1.0);
        card.position.set(Math.sin(a) * 3.4, Math.sin(lt * 1.3 + i) * 0.04, Math.cos(a) * 3.4 - 3.4 - (1 - e) * 6);
        card.rotation.y = a * 0.9 + (1 - e) * 0.8;
        card.children.forEach((c: any) => (c.material.opacity = e));
      });
      root.rotation.y = 0.35 - 0.7 * smooth(lt / span);
      camera.position.set(root.position.x * 0.3, 0.2, horizontal ? 4.6 : 5.6);
      camera.lookAt(root.position.x * 0.3, root.position.y * 0.5, -0.6);
    };
  } else if (cfg.mode === 'logo' && cfg.svg && buildLogo(root, scene, camera, cfg, horizontal, entry)) {
    /* logo extrudé */
  } else {
    const mat = (c: string, extra: Record<string, unknown> = {}) => new THREE.MeshPhysicalMaterial({ color: new THREE.Color(c), roughness: 0.25, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.15, ...extra });
    const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(0.62, 0.22, 220, 32), mat(cfg.primary));
    const ico = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), mat(cfg.accent, { flatShading: true }));
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.3, 48, 48), mat(cfg.secondary));
    root.add(knot, ico, ball);
    entry.update = (lt) => {
      const e = easeOut(lt / 1.2);
      knot.rotation.set(lt * 0.45, lt * 0.7, 0);
      knot.scale.setScalar(0.4 + 0.6 * e);
      ico.position.set(-1.25 * e, 0.75 + Math.sin(lt * 1.4) * 0.08, 0.2);
      ico.rotation.set(lt * 0.9, lt * 0.6, 0);
      ball.position.set(1.2 * e, -0.7 + Math.cos(lt * 1.2) * 0.08, 0.3);
      camera.position.set(0, 0, 5.4 - 0.4 * smooth(lt / span));
      camera.lookAt(0, root.position.y * 0.5, 0);
    };
  }
  entry.update(0);
  entry.render();
}

function softShadow(y: number) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(0,0,0,0.35)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  return mesh;
}

function buildLogo(root: any, scene: any, camera: any, cfg: Record<string, any>, horizontal: boolean, entry: ThreeEntry): boolean {
  let parsed: any;
  try {
    parsed = new THREE_EXTRA.SVGLoader().parse(cfg.svg);
  } catch {
    return false;
  }
  const group = new THREE.Group();
  for (const path of parsed.paths) {
    if (path.userData?.style?.fill === 'none') continue;
    const color = path.color && path.color.getHexString() !== '000000' ? path.color : new THREE.Color(cfg.primary);
    for (const shape of THREE_EXTRA.SVGLoader.createShapes(path)) {
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 22, bevelEnabled: true, bevelThickness: 3, bevelSize: 2, bevelSegments: 4, curveSegments: 24 });
      group.add(new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, metalness: 0.25, clearcoat: 0.8 })));
    }
  }
  if (!group.children.length) return false;
  const box = new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  group.position.set(-center.x, -center.y, -center.z);
  const holder = new THREE.Group();
  holder.add(group);
  const k = (horizontal ? 1.15 : 1.45) / Math.max(size.x, size.y);
  holder.scale.set(k, -k, k);
  const pivot = new THREE.Group();
  pivot.add(holder);
  root.add(pivot);
  const sweep = new THREE.PointLight(0xffffff, 30, 12);
  scene.add(sweep);
  entry.update = (lt) => {
    const e = easeOut(lt / 1.5);
    pivot.rotation.y = -1.5 * (1 - e) + Math.sin(lt * 0.8) * 0.12 * e;
    pivot.rotation.x = 0.25 * (1 - e);
    pivot.scale.setScalar(0.6 + 0.4 * e);
    sweep.position.set(-4 + 8 * smooth((lt - 0.6) / 1.8), 1.2, 2.6);
    camera.position.set(0, 0, 5.2);
    camera.lookAt(0, root.position.y * 0.5, 0);
  };
  return true;
}

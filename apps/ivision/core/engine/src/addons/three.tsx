/**
 * Addon 3D : three.js + React Three Fiber v9 + drei + postprocessing.
 *
 * Pilotage image par image : la racine R3F est créée avec `frameloop: 'never'` ;
 * à chaque image, la scène est rendue de façon synchrone (`flushSync`) avec le
 * temps local en prop, puis `advance(lt)` dessine une image. L'horloge de R3F est
 * posée sur lt : même les aides drei qui lisent `clock.elapsedTime` restent
 * déterministes.
 *
 * Règles pour écrire une scène ici :
 *  - tout mouvement est une fonction de la prop `t` (jamais de useFrame avec delta) ;
 *  - pas de Suspense : les ressources (GLB, textures, SVG) sont chargées AVANT la
 *    première image par `loadAssets` ;
 *  - pas de fichier distant (HDR, police) : la lumière vient de Lightformers drei.
 *
 * Modes : model (GLB importé), cards (photos en cartes), logo (logo SVG extrudé),
 * shapes (formes aux couleurs de la marque).
 */
import { ContactShadows, Environment, Lightformer, RoundedBox } from '@react-three/drei';
import { _roots, advance, createRoot, extend, flushSync, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, SMAA } from '@react-three/postprocessing';
import { ReactElement, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { registerAddon } from '../shared';

// R3F v9 n'enregistre plus les classes de three d'office : toutes, une fois (<mesh>, <planeGeometry>…).
extend(THREE as any);

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
const smooth = (x: number) => {
  const v = clamp01(x);
  return v * v * (3 - 2 * v);
};

interface Opts {
  width: number;
  height: number;
  horizontal: boolean;
  span: number;
}

interface Assets {
  model?: { object: THREE.Object3D; size: THREE.Vector3; scale: number };
  cards?: { texture: THREE.Texture; w: number; h: number }[];
  logo?: { meshes: THREE.Mesh[]; scale: number };
}

// ─── Ressources, chargées avant la première image ───────────────────────────

async function loadAssets(cfg: Record<string, any>, o: Opts): Promise<Assets> {
  const tall = o.height / o.width > 1.5;
  const compact = !o.horizontal && !tall;
  if (cfg.mode === 'model' && cfg.model) {
    const buf = await (await fetch(cfg.model)).arrayBuffer();
    const gltf: any = await new Promise((res, rej) => new GLTFLoader().parse(buf, '', res, rej));
    const object: THREE.Object3D = gltf.scene;
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const scale = (compact ? 1.6 : 2.1) / Math.max(size.x, size.y, size.z);
    object.scale.setScalar(scale);
    object.position.copy(center.multiplyScalar(-scale));
    return { model: { object, size, scale } };
  }
  if (cfg.mode === 'cards' && cfg.images?.length) {
    const loader = new THREE.TextureLoader();
    const cards = [];
    for (const src of cfg.images.slice(0, 4)) {
      const texture = await loader.loadAsync(src);
      texture.colorSpace = THREE.SRGBColorSpace;
      const ar = texture.image ? texture.image.width / texture.image.height : 1;
      const h = o.horizontal ? 1.55 : 1.3;
      cards.push({ texture, h, w: Math.min(o.horizontal ? 2.1 : 1.5, h * ar) });
    }
    return { cards };
  }
  if (cfg.mode === 'logo' && cfg.svg) {
    const parsed = new SVGLoader().parse(cfg.svg);
    const meshes: THREE.Mesh[] = [];
    for (const path of parsed.paths) {
      if ((path.userData as any)?.style?.fill === 'none') continue;
      const color = path.color && path.color.getHexString() !== '000000' ? path.color : new THREE.Color(cfg.primary);
      for (const shape of SVGLoader.createShapes(path)) {
        const geo = new THREE.ExtrudeGeometry(shape, { depth: 22, bevelEnabled: true, bevelThickness: 3, bevelSize: 2, bevelSegments: 4, curveSegments: 24 });
        meshes.push(new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, metalness: 0.25, clearcoat: 0.8 })));
      }
    }
    if (!meshes.length) return {};
    const group = new THREE.Group();
    meshes.forEach((m) => group.add(m));
    const box = new THREE.Box3().setFromObject(group);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    meshes.forEach((m) => m.position.set(-center.x, -center.y, -center.z));
    return { logo: { meshes, scale: (o.horizontal ? 1.15 : 1.45) / Math.max(size.x, size.y) } };
  }
  return {};
}

// ─── Scène ──────────────────────────────────────────────────────────────────

/** Lumière de studio sans fichier HDR : trois boîtes à lumière et un contre-jour à la couleur d'accent. */
function Studio({ accent }: { accent: string }) {
  return (
    <Environment resolution={256} frames={1}>
      <Lightformer form="rect" intensity={2.2} position={[0, 4, 3]} scale={[8, 3, 1]} target={[0, 0, 0]} />
      <Lightformer form="rect" intensity={1.2} position={[-5, 1, 1]} scale={[3, 6, 1]} target={[0, 0, 0]} />
      <Lightformer form="rect" intensity={1.2} position={[5, 1, 1]} scale={[3, 6, 1]} target={[0, 0, 0]} />
      <Lightformer form="ring" intensity={1.6} color={accent} position={[-3, 2, -4]} scale={3} target={[0, 0, 0]} />
    </Environment>
  );
}

function useCameraAt(position: [number, number, number], look: [number, number, number]) {
  const camera = useThree((s) => s.camera);
  useLayoutEffect(() => {
    camera.position.set(...position);
    camera.lookAt(...look);
  });
}

function ModelRig({ a, t, span, rootY }: { a: NonNullable<Assets['model']>; t: number; span: number; rootY: number }) {
  const e = easeOut(t / 1.3);
  useCameraAt([0, 0.35, 6.4 - 0.8 * smooth(t / span)], [0, rootY * 0.55, 0]);
  return (
    <>
      <group rotation={[0, -1.6 * (1 - e) + t * 0.55 - 0.4, 0]} position={[0, Math.sin(t * 1.7) * 0.05 + (1 - e) * -0.5, 0]} scale={0.8 + 0.2 * e}>
        <primitive object={a.object} />
      </group>
      <ContactShadows position={[0, (-a.size.y * a.scale) / 2 - 0.02, 0]} opacity={0.4} scale={4} blur={2.4} far={2.5} resolution={512} />
    </>
  );
}

function CardsRig({ cards, t, span, horizontal, rootX, rootY }: { cards: NonNullable<Assets['cards']>; t: number; span: number; horizontal: boolean; rootX: number; rootY: number }) {
  const n = Math.max(1, cards.length);
  useCameraAt([rootX * 0.3, 0.2, horizontal ? 4.6 : 5.6], [rootX * 0.3, rootY * 0.5, -0.6]);
  return (
    <group rotation={[0, 0.35 - 0.7 * smooth(t / span), 0]}>
      {cards.map((c, i) => {
        const angle = (i - (n - 1) / 2) * (horizontal ? 0.55 : 0.34);
        const e = easeOut((t - i * 0.18) / 1.0);
        return (
          <group key={i} position={[Math.sin(angle) * 3.4, Math.sin(t * 1.3 + i) * 0.04, Math.cos(angle) * 3.4 - 3.4 - (1 - e) * 6]} rotation={[0, angle * 0.9 + (1 - e) * 0.8, 0]}>
            <RoundedBox args={[c.w + 0.08, c.h + 0.08, 0.03]} radius={0.012} smoothness={2}>
              <meshStandardMaterial color="#ffffff" roughness={0.5} transparent opacity={e} />
            </RoundedBox>
            <mesh position={[0, 0, 0.016]}>
              <planeGeometry args={[c.w, c.h]} />
              <meshStandardMaterial map={c.texture} roughness={0.55} transparent opacity={e} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function LogoRig({ logo, t, rootY }: { logo: NonNullable<Assets['logo']>; t: number; rootY: number }) {
  const e = easeOut(t / 1.5);
  useCameraAt([0, 0, 5.2], [0, rootY * 0.5, 0]);
  return (
    <>
      <group rotation={[0.25 * (1 - e), -1.5 * (1 - e) + Math.sin(t * 0.8) * 0.12 * e, 0]} scale={0.6 + 0.4 * e}>
        <group scale={[logo.scale, -logo.scale, logo.scale]}>
          {logo.meshes.map((m, i) => (
            <primitive key={i} object={m} />
          ))}
        </group>
      </group>
      {/* Un reflet qui balaie la tranche du logo */}
      <pointLight intensity={30} distance={12} position={[-4 + 8 * smooth((t - 0.6) / 1.8), 1.2, 2.6]} />
    </>
  );
}

function ShapesRig({ cfg, t, span, rootY }: { cfg: Record<string, any>; t: number; span: number; rootY: number }) {
  const e = easeOut(t / 1.2);
  useCameraAt([0, 0, 5.4 - 0.4 * smooth(t / span)], [0, rootY * 0.5, 0]);
  const mat = (color: string, flat = false) => <meshPhysicalMaterial color={color} roughness={0.25} metalness={0.1} clearcoat={1} clearcoatRoughness={0.15} flatShading={flat} />;
  return (
    <>
      <mesh rotation={[t * 0.45, t * 0.7, 0]} scale={0.4 + 0.6 * e}>
        <torusKnotGeometry args={[0.62, 0.22, 220, 32]} />
        {mat(cfg.primary)}
      </mesh>
      <mesh position={[-1.25 * e, 0.75 + Math.sin(t * 1.4) * 0.08, 0.2]} rotation={[t * 0.9, t * 0.6, 0]}>
        <icosahedronGeometry args={[0.42, 0]} />
        {mat(cfg.accent, true)}
      </mesh>
      <mesh position={[1.2 * e, -0.7 + Math.cos(t * 1.2) * 0.08, 0.3]}>
        <sphereGeometry args={[0.3, 48, 48]} />
        {mat(cfg.secondary)}
      </mesh>
    </>
  );
}

function Stage({ cfg, assets, t, o }: { cfg: Record<string, any>; assets: Assets; t: number; o: Opts }) {
  const tall = o.height / o.width > 1.5;
  const rootY = o.horizontal ? 0.15 : tall ? 0.45 : 0.75;
  const rootX = o.horizontal && cfg.mode !== 'logo' ? 0.95 : 0;
  const span = o.span || 4;
  const postfx: string[] = useMemo(() => (Array.isArray(cfg.postfx) ? cfg.postfx : []), [cfg]);
  const ref = useRef<THREE.Group>(null);
  let rig;
  if (assets.model) rig = <ModelRig a={assets.model} t={t} span={span} rootY={rootY} />;
  else if (assets.cards?.length) rig = <CardsRig cards={assets.cards} t={t} span={span} horizontal={o.horizontal} rootX={rootX} rootY={rootY} />;
  else if (assets.logo) rig = <LogoRig logo={assets.logo} t={t} rootY={rootY} />;
  else rig = <ShapesRig cfg={cfg} t={t} span={span} rootY={rootY} />;
  return (
    <>
      <Studio accent={cfg.accent || '#ffffff'} />
      <directionalLight intensity={1.6} position={[3, 5, 4]} />
      <hemisphereLight args={['#ffffff', cfg.primary || '#888888', 0.4]} />
      <group ref={ref} position={[rootX, rootY, 0]}>
        {rig}
      </group>
      {postfx.length ? (
        <EffectComposer multisampling={0}>
          {[postfx.includes('bloom') ? <Bloom key="bloom" intensity={0.35} luminanceThreshold={0.88} mipmapBlur /> : null, <SMAA key="smaa" />].filter((x): x is ReactElement => !!x)}
        </EffectComposer>
      ) : null}
    </>
  );
}

registerAddon('three', {
  async mount(canvas, cfg, o) {
    const assets = await loadAssets(cfg, o);
    const root = createRoot(canvas);
    await root.configure({
      frameloop: 'never',
      dpr: 1,
      size: { width: o.width, height: o.height, top: 0, left: 0, updateStyle: false } as any,
      gl: { antialias: true, alpha: true, preserveDrawingBuffer: true },
      camera: { fov: o.horizontal ? 28 : 36, near: 0.1, far: 100, position: [0, 0, 5.4] },
    });
    const store = _roots.get(canvas)!.store;
    const draw = (lt: number) => {
      flushSync(() => root.render(<Stage cfg={cfg} assets={assets} t={lt} o={o} />));
      advance(lt, false, store.getState());
    };
    draw(0);
    return { update: draw };
  },
});

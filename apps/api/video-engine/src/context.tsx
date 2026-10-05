/**
 * Les données de la vidéo et le temps courant, partagés par toutes les scènes.
 */
import { createContext, useContext } from 'react';
import { Bezier, bezier, quantize, springEase } from './time';

export interface SurfaceTokens {
  bg: string;
  ink: string;
  muted: string;
  hl: string;
  hlInk: string;
  hlText: string;
  hlSoft: string;
  soft: string;
  dark: boolean;
}

export interface DirectionDef {
  id: string;
  type: { displayCase: 'none' | 'upper'; tracking: number; weight: number; lineHeight: number; scale: number };
  pacing: { enter: number; unitStagger: number; groupStagger: number; transition: number };
  ease: { out: Bezier; in: Bezier };
  overshoot: boolean;
  color: string;
  decor: 'none' | 'rules' | 'grid' | 'grain' | 'letterbox' | 'paper' | 'frame';
  stepped: 0 | 2;
  camera: 'still' | 'push' | 'drift' | 'pull' | 'rise' | 'tilt';
}

export interface SceneMotion {
  anchor: 'top-left' | 'center-left' | 'bottom-left' | 'center' | 'bottom-center' | 'top-center' | 'right';
  headline: string;
  support: string;
  align: 'left' | 'center';
  transition?: string;
  kicker: boolean;
}

export interface SceneData {
  key: string;
  sceneId: string;
  variant: number;
  start: number;
  duration: number;
  surface: string;
  slots: Record<string, string>;
  image?: string;
  images?: string[];
  video?: string;
  lottieKey?: string;
  lottieName?: string;
  lottieLoop?: boolean;
  three?: Record<string, any>;
  /** Fichier Rive importé (.riv) joué dans la scène d'animation. */
  rive?: string;
  /** Pictogrammes SVG (déjà choisis et normalisés par le serveur), un par élément. */
  icons?: string[];
  /** Le fond du kit est posé sur cette scène (le graphe en retient deux au plus). */
  backdrop?: boolean;
  /** Tempo des entrées de la scène (rythme) : < 1 plus vif, > 1 plus posé. */
  pace?: number;
  /** Mise en scène d'un plan (clip ou photo plein cadre) : split, window, blinds, magazine, knockout, inline, duotone, broadcast, cinema. */
  treatment?: string;
  /** Mise en page (archétype de composition) choisie par l'agent directeur artistique, cf. layouts.tsx. */
  layout?: string;
  /** Le mot que le directeur artistique met en valeur (index dans le titre). */
  emphasis?: number;
  /** Le grand moment de la vidéo : punch (zoom + éclair), giant (titre géant), hold (temps suspendu), flip (couleur). */
  accent?: 'punch' | 'giant' | 'hold' | 'flip';
  motion: SceneMotion;
}

/**
 * Le kit retenu par le graphe de capacités (serveur, video.capabilities.ts) :
 * l'IA n'écrit pas de code, elle reçoit ces choix déjà validés.
 */
export interface KitData {
  /** Fond de quelques scènes : none | dot-grid | halftone | shape-field | stagger-grid | marquee | spotlight | ticks */
  background: string;
  /** Annotation du mot mis en valeur : none | marker | underline | circle */
  annotate: string;
  /** La seule scène annotée (clé de scène). */
  annotateScene?: string;
  /** Animation du logo : classic | draw | trace | morph | assemble | wipe | split | extrude */
  logo: string;
  /** Logo vectoriel nettoyé (scripts, liens externes et identifiants neutralisés). */
  logoSvg?: string;
  /** Le SVG n'est qu'un symbole : le nom de la marque s'écrit dessous. */
  logoIsIcon?: boolean;
  /** Caméra de la vidéo (graphe) : still | push | pull | drift | rise | tilt. */
  camera?: string;
  /** Famille d'entrée des éléments (graphe) : rise | spring | flip | unfold | skew | iris | drop | pop | slideLeft. */
  entrance?: string;
  /** Logo pendant la vidéo : none | corner ; et le coin libre calculé au montage. */
  brandmark?: string;
  brandmarkCorner?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  /** Rebond physique (ressort) pour les directions ludiques ; absent = courbe de la direction. */
  spring?: { bounce: number };
}

export interface VideoData {
  mode: 'render' | 'preview';
  width: number;
  height: number;
  fps: number;
  duration: number;
  format: string;
  direction: DirectionDef;
  scenes: SceneData[];
  surfaces: Record<string, SurfaceTokens>;
  palette: Record<string, string>;
  fonts: { display: string; body: string };
  brandName: string;
  logo: { onLight?: string; onDark?: string; icon?: string };
  lotties: Record<string, unknown>;
  zones: { st: number; sb: number; sx: number };
  music?: { url: string; startAt: number };
  sfx?: { enabled: boolean; sounds: Record<string, { url: string; gain: number }> };
  kit?: KitData;
  /** Grille du temps de la musique (en temps vidéo) : les mises en page pulsent dessus. */
  beat?: { bpm: number; offset: number };
}

/** Une scène replacée sur la ligne de temps, avec ses fenêtres calculées. */
export interface Timed extends SceneData {
  index: number;
  end: number;
  /** Visible de… à… (les transitions chevauchent les scènes voisines). */
  visFrom: number;
  visTo: number;
  /** Les éléments commencent à entrer à `tin`. */
  tin: number;
  /** Les éléments sortent à partir de `tout` (si la transition suivante le demande). */
  tout: number | null;
  span: number;
}

export interface Engine {
  data: VideoData;
  t: number;
  u: number;
  horizontal: boolean;
  ease: (p: number) => number;
  easeIn: (p: number) => number;
  /** Rebond ludique, seulement si la direction l'autorise. */
  back: (p: number) => number;
  scenes: Timed[];
}

export const EngineCtx = createContext<Engine | null>(null);
export const SceneCtx = createContext<Timed | null>(null);

export function useEngine(): Engine {
  const e = useContext(EngineCtx);
  if (!e) throw new Error('EngineCtx missing');
  return e;
}

export function useScene(): Timed {
  const s = useContext(SceneCtx);
  if (!s) throw new Error('SceneCtx missing');
  return s;
}

/** Temps local de la scène (quantifié image par image pour le style « collage »). */
export function useLocalTime(): number {
  const { t, data } = useEngine();
  const s = useScene();
  return quantize(t - s.start, data.direction.stepped);
}

export function makeEasings(d: DirectionDef, kit?: KitData) {
  const out = bezier(d.ease.out);
  const easeIn = bezier(d.ease.in);
  // Rebond : un vrai ressort (motion) quand le kit le demande, sinon une courbe de Bézier.
  const back = !d.overshoot ? out : kit?.spring ? springEase(kit.spring.bounce) : bezier([0.34, 1.56, 0.64, 1]);
  return { ease: out, easeIn, back };
}

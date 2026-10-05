/**
 * MISES EN SCÈNE DES CLIPS ET DES PHOTOS PLEIN CADRE.
 *
 * Fini « la vidéo en fond, un dégradé en bas, le texte dans une boîte » : chaque
 * plan reçoit une mise en scène tirée par le graphe (video.capabilities.ts,
 * genre `treatment`), selon la direction de motion, jamais deux fois la même de
 * suite dans une vidéo, et différente des vidéos récentes du projet.
 *
 *   split       le clip sur une moitié du cadre, le texte sur l'aplat de la marque
 *   window      le clip apparaît dans une fenêtre qui s'ouvre (cercle, arche, rectangle)
 *   blinds      des lames découvrent le clip ; une bande reste et porte le titre
 *   magazine    titre en haut, clip encadré au milieu, légende en bas
 *   knockout    le clip joue DANS les lettres du titre, puis la caméra traverse le texte
 *   inline      le clip dans une capsule insérée au milieu de la phrase
 *   duotone     le clip aux couleurs de la marque, titre géant au trait
 *   broadcast   barre de titre façon télévision (directions corporate)
 *   cinema      sous-titres sur cadre cinéma (direction cinématique)
 *
 * Tout est fonction du temps local ; le clip lui-même est posé image par image
 * par le registre des médias (media.tsx).
 */
import { CSSProperties, ReactNode } from 'react';
import { cue } from './cues';
import { useEngine, useLocalTime, useScene } from './context';
import { useExitAt } from './layout';
import { Clip } from './media';
import { Kinetic } from './text';
import { clamp, hash, mix, progress } from './time';

export type Treatment = 'split' | 'window' | 'blinds' | 'magazine' | 'knockout' | 'inline' | 'duotone' | 'broadcast' | 'cinema';

/** Repli sans graphe (vidéos d'avant) : une mise en scène par direction, déjà variée. */
export const DEFAULT_TREATMENT: Record<string, Treatment> = {
  cinematic: 'cinema',
  drenched: 'duotone',
  swiss: 'split',
  precision: 'broadcast',
  editorial: 'magazine',
  brutal: 'blinds',
  kinetic: 'knockout',
  collage: 'window',
};

export interface TreatmentProps {
  kind: Treatment;
  src?: string;
  video?: string;
  title?: string;
  sub?: string;
  /** Petit libellé facultatif (accroche de la scène). */
  kicker?: string;
  /** Rendu du titre avec la technique de la scène (taille max, min, lignes ; début). */
  renderTitle: (fit: [number, number, number], at: number, technique?: string) => ReactNode;
  renderSub: (at: number, muted?: boolean) => ReactNode;
  /** Élément en plus (prix d'un produit). */
  extra?: ReactNode;
}

/** Le média qui remplit sa boîte ; une photo fixe reçoit une lente poussée. */
function Fill({ src, video, style, className }: { src?: string; video?: string; style?: CSSProperties; className?: string }) {
  const s = useScene();
  const lt = useLocalTime();
  const kb = video ? {} : { transform: `scale(${mix(1.12, 1.02, clamp((lt + s.start - s.visFrom) / Math.max(0.1, s.span)))})` };
  return (
    <div className={`tm-fill ${className || ''}`} style={style}>
      <div className="tm-fill-inner" style={kb}>
        {video ? <Clip src={video} className="media-el" /> : src ? <img className="media-el" src={src} alt="" /> : null}
      </div>
    </div>
  );
}

/** Bloc de texte posé dans une zone (absolue), aligné selon la direction. */
function TextZone({ style, children, align = 'left', justify = 'center' }: { style: CSSProperties; children: ReactNode; align?: 'left' | 'center'; justify?: 'center' | 'flex-start' | 'flex-end' }) {
  return (
    <div className="tm-text" style={{ ...style, alignItems: align === 'center' ? 'center' : 'flex-start', textAlign: align, justifyContent: justify }}>
      {children}
    </div>
  );
}

function Split(p: TreatmentProps) {
  const { data, ease, horizontal } = useEngine();
  const lt = useLocalTime();
  const g = data.direction.pacing.groupStagger;
  const k = ease(progress(lt, 0, data.direction.pacing.enter * 1.3));
  const square = data.width === data.height;
  const cut = horizontal ? 56 : square ? 54 : 58;
  // Le média n'est jamais découpé : un cache de la couleur de la surface se retire (clip intact).
  const media: CSSProperties = horizontal ? { left: 0, top: 0, bottom: 0, width: `${cut}%` } : { left: 0, right: 0, top: 0, height: `${cut}%` };
  const cover: CSSProperties = horizontal
    ? { left: `${cut * k}%`, top: 0, bottom: 0, width: `${cut * (1 - k) + 0.2}%` }
    : { left: 0, right: 0, top: `${cut * k}%`, height: `${cut * (1 - k) + 0.2}%` };
  const seam: CSSProperties = horizontal
    ? { left: `${cut}%`, top: 0, bottom: 0, width: 'max(2px, calc(var(--u) * 0.35))', transform: `scaleY(${k})`, transformOrigin: 'top' }
    : { top: `${cut}%`, left: 0, right: 0, height: 'max(2px, calc(var(--u) * 0.35))', transform: `scaleX(${k})`, transformOrigin: 'left' };
  const zone: CSSProperties = horizontal
    ? { left: `calc(${cut}% + var(--sx))`, right: 'var(--sx)', top: 'var(--st)', bottom: 'var(--sb)' }
    : { left: 'var(--sx)', right: 'var(--sx)', top: `calc(${cut}% + var(--u) * 4)`, bottom: 'var(--sb)' };
  return (
    <>
      <Fill src={p.src} video={p.video} style={media} />
      {k < 1 ? <span className="tm-cover" style={cover} /> : null}
      <span className="tm-seam" style={seam} />
      <TextZone style={zone}>
        {p.renderTitle(horizontal ? [10, 5.5, 3] : [11, 6, 3], g * 0.6)}
        {p.renderSub(g * 1.4)}
        {p.extra}
      </TextZone>
    </>
  );
}

function Window(p: TreatmentProps) {
  const { data, ease, horizontal } = useEngine();
  const s = useScene();
  const lt = useLocalTime();
  const id = data.direction.id;
  const g = data.direction.pacing.groupStagger;
  const k = ease(progress(lt, 0, data.direction.pacing.enter * 1.6));
  const shape = ['editorial', 'collage', 'cinematic'].includes(id) ? 'arch' : ['kinetic', 'drenched'].includes(id) ? 'circle' : 'rect';
  // La fenêtre est un TROU dans un cache de la couleur de la surface, posé sur le média : le
  // clip n'est jamais découpé ni redimensionné (un calque vidéo découpé en mouvement peut être
  // composé avec une image de retard).
  const W = data.width;
  const H = data.height;
  let box: { x: number; y: number; w: number; h: number };
  if (shape === 'circle') {
    const d = (horizontal ? H * 0.78 : W * 0.86) * mix(0.12, 1, k);
    const cx = horizontal ? W * 0.3 : W * 0.5;
    const cy = horizontal ? H * 0.5 : H * 0.38;
    box = { x: cx - d / 2, y: cy - d / 2, w: d, h: d };
  } else {
    const [t, r, b, l] = horizontal ? [0.1, 0.55, 0.1, 0.07] : [0.09, 0.12, 0.42, 0.12];
    const fw = W * (1 - r - l);
    const fh = H * (1 - t - b);
    const sc = mix(0.35, 1, k);
    const cx = W * l + fw / 2;
    const cy = H * t + fh / 2;
    box = { x: cx - (fw * sc) / 2, y: cy - (fh * sc) / 2, w: fw * sc, h: fh * sc };
  }
  const radius = shape === 'circle' ? '50%' : shape === 'arch' ? `${box.w / 2}px ${box.w / 2}px 0 0` : 'calc(var(--u) * 2)';
  const zone: CSSProperties = horizontal
    ? { left: '52%', right: 'var(--sx)', top: 'var(--st)', bottom: 'var(--sb)' }
    : { left: 'var(--sx)', right: 'var(--sx)', top: shape === 'circle' ? '68%' : '61%', bottom: 'var(--sb)' };
  if (s.tin > 0) cue(`${s.key}:window`, s.tin, 'softwhoosh', 0.6);
  return (
    <>
      <Fill src={p.src} video={p.video} style={{ inset: 0 }} />
      <span className="tm-hole" style={{ left: box.x, top: box.y, width: box.w, height: box.h, borderRadius: radius }} />
      <TextZone style={zone} align={horizontal || shape !== 'circle' ? 'left' : 'center'}>
        {p.renderTitle(horizontal ? [10, 5.5, 3] : [10, 5.5, 2], g * 0.9)}
        {p.renderSub(g * 1.7)}
        {p.extra}
      </TextZone>
    </>
  );
}

function Blinds(p: TreatmentProps) {
  const { data, ease } = useEngine();
  const s = useScene();
  const lt = useLocalTime();
  const g = data.direction.pacing.groupStagger;
  // Cinq lames horizontales ; celle du milieu, plus haute, reste et devient la bande du titre.
  const rows = [18, 18, 28, 18, 18];
  let top = 0;
  const band = 2;
  cue(`${s.key}:blinds`, s.tin, 'whoosh', 0.55);
  return (
    <>
      <Fill src={p.src} video={p.video} style={{ inset: 0 }} />
      {rows.map((h, i) => {
        const y = top;
        top += h;
        if (i === band) return null;
        const k = ease(progress(lt, 0.04 + Math.abs(i - band) * 0.08, data.direction.pacing.enter));
        return <span key={i} className="tm-blind" style={{ top: `${y}%`, height: `calc(${h}% + 1px)`, transform: `translateX(${(i % 2 ? 1 : -1) * k * 101}%)` }} />;
      })}
      <div className="tm-band" style={{ top: `${rows[0] + rows[1]}%`, height: `${rows[band]}%` }}>
        <TextZone style={{ inset: 0, paddingLeft: 'var(--sx)', paddingRight: 'var(--sx)' }}>
          {p.renderTitle([9, 5, 2], g * 0.9)}
          {p.renderSub(g * 1.6)}
        </TextZone>
      </div>
      {p.extra ? <div className="tm-extra-bottom">{p.extra}</div> : null}
    </>
  );
}

function Magazine(p: TreatmentProps) {
  const { data, ease, horizontal } = useEngine();
  const lt = useLocalTime();
  const g = data.direction.pacing.groupStagger;
  const k = ease(progress(lt, g * 0.6, data.direction.pacing.enter * 1.4));
  // Titre en haut, image encadrée au centre (révélée depuis son milieu), légende en bas.
  const frame: CSSProperties = horizontal
    ? { left: '38%', right: 'var(--sx)', top: 'var(--st)', bottom: 'var(--sb)' }
    : { left: 'var(--sx)', right: 'var(--sx)', top: '30%', bottom: '33%' };
  // Révélation depuis le milieu par deux caches qui s'écartent (le média reste intact).
  const half = `${(1 - k) * 50}%`;
  return (
    <>
      <TextZone style={horizontal ? { left: 'var(--sx)', width: '30%', top: 'var(--st)', bottom: 'var(--sb)' } : { left: 'var(--sx)', right: 'var(--sx)', top: 'var(--st)', height: 'calc(30% - var(--st) - var(--u) * 2)' }} justify={horizontal ? 'center' : 'flex-end'}>
        {p.renderTitle(horizontal ? [9, 5, 4] : [10, 5.5, 2], 0.05)}
        {horizontal ? p.renderSub(g * 1.6) : null}
      </TextZone>
      <div className="tm-frame" style={frame}>
        <Fill src={p.src} video={p.video} style={{ inset: 0 }} />
        {k < 1 ? (
          <>
            <span className="tm-cover" style={{ left: 0, right: 0, top: 0, height: half }} />
            <span className="tm-cover" style={{ left: 0, right: 0, bottom: 0, height: half }} />
          </>
        ) : null}
      </div>
      <span className="tm-frame-line" style={{ ...frame, clipPath: `inset(0 ${(1 - k) * 100}% 0 0)` }} />
      {!horizontal ? (
        <TextZone style={{ left: 'var(--sx)', right: 'var(--sx)', top: 'calc(67% + var(--u) * 3)', bottom: 'var(--sb)' }} justify="flex-start">
          {p.renderSub(g * 1.8)}
          {p.extra}
        </TextZone>
      ) : p.extra ? (
        <div className="tm-extra-bottom">{p.extra}</div>
      ) : null}
    </>
  );
}

function Knockout(p: TreatmentProps) {
  const { data, ease, easeIn } = useEngine();
  const s = useScene();
  const lt = useLocalTime();
  const sf = data.surfaces[s.surface] || data.surfaces.light;
  // Le clip ne se voit qu'à travers les lettres : sur un aplat clair, « éclaircir » avec des
  // lettres noires laisse passer l'image ; sur un aplat sombre, « assombrir » avec des lettres blanches.
  const blend = sf.dark ? 'darken' : 'lighten';
  const ink = sf.dark ? '#fff' : '#000';
  const hold = Math.min(1.8, Math.max(1.1, s.duration * 0.45));
  const zoom = easeIn(progress(lt, hold, 0.7));
  const appear = ease(progress(lt, 0, data.direction.pacing.enter));
  const words = (p.title || '').split(/\s+/).filter(Boolean);
  const big = words.length > 3 ? words.slice(0, 3).join(' ') : p.title || '';
  if (s.tin > 0) cue(`${s.key}:knock`, s.start + hold, 'whoosh', 0.7);
  return (
    <>
      <Fill src={p.src} video={p.video} style={{ inset: 0 }} />
      {/* Toujours monté (caché une fois traversé) : la taille du titre est mesurée une fois, au départ. */}
      <div className="tm-knock" style={{ background: 'var(--bg)', mixBlendMode: blend, transform: `scale(${mix(1, 9, zoom)})`, opacity: 1 - clamp((zoom - 0.6) / 0.4), visibility: zoom >= 1 ? 'hidden' : 'inherit' }}>
        <div className="tm-knock-text" style={{ color: ink, opacity: appear }}>
          <Kinetic text={big} technique="trackIn" at={0} role="headline" fit={[34, 12, 3]} style={{ color: ink, fontWeight: 900 }} />
        </div>
      </div>
      {/* Une fois traversé : la suite du titre, sur une étiquette de la couleur d'accent. */}
      {lt > hold + 0.35 ? (
        <div className="tm-tag" style={{ opacity: ease(progress(lt, hold + 0.35, 0.4)), transform: `translateY(${(1 - ease(progress(lt, hold + 0.35, 0.4))) * 2}vmin)` }}>
          {p.sub || (words.length > 3 ? words.slice(3).join(' ') : '')}
          {p.extra}
        </div>
      ) : null}
    </>
  );
}

function Inline(p: TreatmentProps) {
  const { data, ease, horizontal, u } = useEngine();
  const lt = useLocalTime();
  const g = data.direction.pacing.groupStagger;
  const words = (p.title || '').split(/\s+/).filter(Boolean);
  const cut = Math.max(1, Math.ceil(words.length / 2));
  const first = words.slice(0, cut).join(' ');
  const second = words.slice(cut).join(' ');
  const k = ease(progress(lt, g * 0.8, data.direction.pacing.enter * 1.2));
  const w = (horizontal ? 34 : 56) * u;
  const h = (horizontal ? 14 : 16) * u;
  return (
    <TextZone style={{ left: 'var(--sx)', right: 'var(--sx)', top: 'var(--st)', bottom: 'var(--sb)' }} align="center">
      <Kinetic text={first} technique="maskUp" at={0.05} role="headline" fit={[14, 7, 2]} />
      <div className="tm-pill" style={{ width: mix(h, w, k), height: h, opacity: clamp(k * 3) }}>
        <Fill src={p.src} video={p.video} style={{ inset: 0 }} />
      </div>
      {second ? <Kinetic text={second} technique="maskUp" at={g * 1.2} role="headline" fit={[14, 7, 2]} /> : null}
      {p.renderSub(g * 2)}
      {p.extra}
    </TextZone>
  );
}

function Duotone(p: TreatmentProps) {
  const { data, ease, horizontal } = useEngine();
  const s = useScene();
  const lt = useLocalTime();
  const g = data.direction.pacing.groupStagger;
  const k = ease(progress(lt, g * 0.5, data.direction.pacing.enter * 1.4));
  const sf = data.surfaces[s.surface] || data.surfaces.light;
  return (
    <>
      <Fill src={p.src} video={p.video} style={{ inset: 0 }} className="tm-duo" />
      <TextZone style={{ left: 'var(--sx)', right: 'var(--sx)', top: 'var(--st)', bottom: 'var(--sb)' }} align={horizontal ? 'left' : 'center'}>
        <div className="tm-outline" style={{ WebkitTextStroke: `max(2px, calc(var(--u) * 0.35)) ${sf.hl}`, opacity: k, transform: `scale(${mix(1.25, 1, k)})` }}>
          {p.renderTitle([22, 9, 3], g * 0.4, 'scaleBlur')}
        </div>
        {p.renderSub(g * 1.6, false)}
        {p.extra}
      </TextZone>
    </>
  );
}

function Broadcast(p: TreatmentProps) {
  const { data, ease } = useEngine();
  const s = useScene();
  const lt = useLocalTime();
  const g = data.direction.pacing.groupStagger;
  const bar = ease(progress(lt, g * 0.6, data.direction.pacing.enter));
  const tab = ease(progress(lt, g * 1.2, data.direction.pacing.enter));
  cue(`${s.key}:bar`, s.tin + g * 0.6, 'click', 0.5);
  return (
    <>
      <Fill src={p.src} video={p.video} style={{ inset: 0 }} />
      <div className="tm-broadcast">
        {p.sub || p.kicker ? (
          <div className="tm-broadcast-tab" style={{ clipPath: `inset(0 ${(1 - tab) * 100}% 0 0)` }}>
            {p.kicker || p.sub}
          </div>
        ) : null}
        <div className="tm-broadcast-bar" style={{ clipPath: `inset(0 ${(1 - bar) * 100}% 0 0)` }}>
          <span className="tm-broadcast-accent" />
          {p.renderTitle([7, 4, 2], g * 0.9)}
        </div>
        {p.extra}
      </div>
    </>
  );
}

function Cinema(p: TreatmentProps) {
  const { data } = useEngine();
  const g = data.direction.pacing.groupStagger;
  return (
    <>
      <Fill src={p.src} video={p.video} style={{ inset: 0 }} className="tm-cine" />
      <TextZone style={{ left: 'var(--sx)', right: 'var(--sx)', top: 'var(--st)', bottom: 'calc(var(--sb) + var(--u) * 3)' }} align="center" justify="flex-end">
        <div className="tm-subtitle">
          {p.renderTitle([8, 4.5, 2], 0.3)}
          {p.renderSub(g * 1.8, false)}
        </div>
        {p.extra}
      </TextZone>
    </>
  );
}

const TREATMENTS: Record<Treatment, (p: TreatmentProps) => ReactNode> = {
  split: Split,
  window: Window,
  blinds: Blinds,
  magazine: Magazine,
  knockout: Knockout,
  inline: Inline,
  duotone: Duotone,
  broadcast: Broadcast,
  cinema: Cinema,
};

/** La mise en scène d'un plan (clip ou photo). */
export function MediaTreatment(p: TreatmentProps) {
  const T = TREATMENTS[p.kind] || Split;
  const exitAt = useExitAt();
  const lt = useLocalTime();
  const { easeIn, data } = useEngine();
  // Sortie commune : l'ensemble s'efface en accélérant, deux tiers de la durée d'entrée.
  const q = exitAt != null ? easeIn(progress(lt, exitAt, data.direction.pacing.enter * 0.66)) : 0;
  return (
    <div className={`tm tm-kind-${p.kind}`} style={q > 0 ? { opacity: 1 - q } : undefined}>
      <T {...p} />
    </div>
  );
}

/** Mise en scène de repli quand le graphe n'en a pas posé (vidéos d'avant). */
export function treatmentFor(sceneTreatment: string | undefined, direction: string, index: number): Treatment {
  if (sceneTreatment && sceneTreatment in TREATMENTS) return sceneTreatment as Treatment;
  const base = DEFAULT_TREATMENT[direction] || 'split';
  // Deux plans de suite dans une vieille vidéo : la seconde mise en scène diffère.
  const alt: Treatment[] = ['split', 'window', 'magazine', 'blinds'];
  return index % 2 === 0 ? base : alt[Math.floor(hash(index) * alt.length)] === base ? 'window' : alt[Math.floor(hash(index) * alt.length)];
}

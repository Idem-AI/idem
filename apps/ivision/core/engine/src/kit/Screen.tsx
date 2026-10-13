/**
 * L'INTERFACE DU PRODUIT À L'ÉCRAN — briques du moteur et du kit des plans écrits par l'IA.
 *
 *   ScreenFrame  une fenêtre de navigateur (barre, adresse, chargement) qui montre une CAPTURE de
 *                la marque (site lu, imports) avec une lente poussée, ou ce qu'on y dessine ;
 *   TypedPrompt  un champ où un texte de la demande se tape lettre à lettre (curseur, envoi) ;
 *   FileList     une liste de dossiers et fichiers qui apparaissent (les noms viennent de la demande) ;
 *   BrandSplash  sans capture ni texte : l'écran d'accueil à la marque (logo, nom) — jamais un faux
 *                tableau de bord rempli de chiffres inventés ;
 *   SceneMedia   le clip ou la photo du plan, plein cadre ou dans une boîte, posé image par image.
 *
 * Tout est fonction du temps local (rendu image par image, déterministe) ; les couleurs sont celles
 * de la surface de la scène (variables CSS), jamais écrites en dur.
 */
import { CSSProperties, ReactNode } from 'react';
import { useEngine, useLocalTime, useScene } from '../context';
import { Clip } from '../media';
import { clamp, mix, progress } from '../time';
import { PhotoEl } from './ImageFx';

/** L'adresse de la barre : celle des textes de la demande, sinon le nom de la marque (jamais un domaine inventé). */
function addressOf(url: string | undefined, brand: string): string {
  if (url) return url.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  return brand;
}

export function ScreenFrame({
  src,
  video,
  url,
  at = 0,
  dur,
  zoom = 0.1,
  chrome = 'browser',
  style,
  children,
}: {
  src?: string;
  video?: string;
  url?: string;
  /** Début de l'entrée (s, temps local) et durée de la lente poussée (par défaut : jusqu'à la fin du plan). */
  at?: number;
  dur?: number;
  /** Ampleur de la poussée sur la capture (0 = fixe). */
  zoom?: number;
  chrome?: 'browser' | 'none';
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const s = useScene();
  const { data, ease, u } = useEngine();
  const lt = useLocalTime();
  const enter = ease(progress(lt, at, data.direction.pacing.enter * 1.2));
  // La page « se charge » : une barre fine dans l'adresse, puis la capture se découvre de haut en bas.
  const load = ease(progress(lt, at + 0.15, 0.8));
  const span = dur ?? Math.max(1, s.duration - at);
  const p = clamp((lt - at) / span);
  const bar = Math.max(16, u * 3.4);
  return (
    <div
      className="scr"
      style={{
        ...style,
        opacity: clamp(enter * 1.5),
        transform: `translateY(${(1 - enter) * u * 3}px) scale(${mix(0.965, 1, enter)})`,
      }}
    >
      {chrome === 'browser' ? (
        <div className="scr-bar" style={{ height: bar }}>
          <span className="scr-dot" />
          <span className="scr-dot" />
          <span className="scr-dot" />
          <span className="scr-url" style={{ fontSize: Math.max(9, u * 1.55) }}>
            {addressOf(url, data.brandName)}
            <span className="scr-load" style={{ transform: `scaleX(${load})`, opacity: 1 - clamp((lt - at - 1.1) * 3) }} />
          </span>
        </div>
      ) : null}
      <div className="scr-view" style={{ top: chrome === 'browser' ? bar : 0 }}>
        {video || src ? (
          <div className="scr-shot" style={{ clipPath: `inset(0 0 ${(1 - load) * 100}% 0)`, transform: `scale(${mix(1, 1 + zoom, p)})`, transformOrigin: `${mix(35, 60, p)}% ${mix(8, 40, p)}%` }}>
            {video ? <Clip src={video} className="media-el scr-media" /> : <PhotoEl src={src!} className="media-el scr-media" />}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

/** Un texte de la demande tapé dans un champ, lettre à lettre, puis envoyé. */
export function TypedPrompt({ text, at = 0.35, cps = 20, style }: { text: string; at?: number; cps?: number; style?: CSSProperties }) {
  const lt = useLocalTime();
  const { u, ease } = useEngine();
  const n = Math.max(0, Math.min(text.length, Math.floor((lt - at) * cps)));
  const done = n >= text.length;
  const caret = !done || Math.floor((lt - at) * 2.2) % 2 === 0;
  const sent = ease(progress(lt, at + text.length / cps + 0.25, 0.3));
  return (
    <div className="scr-prompt" style={{ ...style, fontSize: Math.max(12, u * 2.6) }}>
      <span className="scr-prompt-text">
        {/* Le texte complet réserve sa place : la ligne ne bouge pas pendant la frappe. */}
        <span className="scr-prompt-ghost" aria-hidden>
          {text}
        </span>
        <span className="scr-prompt-live">
          {text.slice(0, n)}
          {caret ? <span className="scr-caret" /> : null}
        </span>
      </span>
      <span className="scr-send" style={{ transform: `scale(${mix(1, 0.86, sent)})`, opacity: mix(0.55, 1, sent) }} />
    </div>
  );
}

/** Une liste de dossiers et fichiers (noms de la demande), qui apparaissent l'un après l'autre. */
export function FileList({ items, title, at = 0.3, stagger = 0.11, style }: { items: string[]; title?: string; at?: number; stagger?: number; style?: CSSProperties }) {
  const lt = useLocalTime();
  const { u, ease } = useEngine();
  return (
    <div className="scr-files" style={{ ...style, fontSize: Math.max(11, u * 2.7) }}>
      {title ? (
        <div className="scr-folder" style={{ opacity: ease(progress(lt, at - 0.15, 0.4)) }}>
          <span className="scr-folder-icon" />
          {title}
        </div>
      ) : null}
      {items.map((item, i) => {
        const p = ease(progress(lt, at + i * stagger, 0.45));
        return (
          <div key={i} className="scr-file" style={{ opacity: p, transform: `translateX(${(1 - p) * u * 3}px)` }}>
            <span className="scr-file-icon" />
            {item}
          </div>
        );
      })}
    </div>
  );
}

/** Sans capture ni texte d'interface : l'écran d'accueil à la marque (logo, nom). */
export function BrandSplash() {
  const { data, ease, u } = useEngine();
  const lt = useLocalTime();
  const s = useScene();
  const sf = data.surfaces[s.surface] || data.surfaces.light;
  const src = data.logo.onLight || data.logo.icon || data.logo.onDark;
  const p = ease(progress(lt, 0.35, 0.8));
  return (
    <div className="scr-splash" style={{ opacity: p, transform: `scale(${mix(0.92, 1, p)})` }}>
      {src && !sf.dark ? <img src={src} alt="" style={{ height: u * 9, maxWidth: '60%', objectFit: 'contain' }} /> : <span style={{ fontFamily: 'var(--f-display)', fontWeight: 800, fontSize: u * 6 }}>{data.brandName}</span>}
    </div>
  );
}

/** Le clip ou la photo du plan (`s.video`, sinon `s.image`), qui remplit sa boîte ; une photo vit d'une lente poussée. */
export function SceneMedia({ fit = 'cover', push = 0.08, style, className }: { fit?: 'cover' | 'contain'; push?: number; style?: CSSProperties; className?: string }) {
  const s = useScene();
  const lt = useLocalTime();
  const k = clamp((lt + s.start - s.visFrom) / Math.max(0.1, s.span));
  const media = s.video ? <Clip src={s.video} className="media-el" /> : s.image ? <PhotoEl src={s.image} className="media-el" /> : null;
  if (!media) return null;
  return (
    <div className={`kit-media ${fit === 'contain' ? 'media-contain' : ''} ${className || ''}`} style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...style }}>
      <div style={{ position: 'absolute', inset: 0, transform: s.video ? undefined : `scale(${mix(1 + push, 1, k)})`, ...(fit === 'contain' ? { display: 'flex', alignItems: 'center', justifyContent: 'center' } : {}) }}>{media}</div>
    </div>
  );
}

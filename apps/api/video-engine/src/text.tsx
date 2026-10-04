/**
 * LES TEXTES EN MOUVEMENT — douze techniques de typographie cinétique.
 *
 * Règles appliquées (et non suggérées) :
 *  - le texte en mouvement ne se lit pas : chaque entrée se termine vite
 *    (l'essentiel du trajet dans le premier tiers), puis le texte TIENT ;
 *  - le décalage entre unités est une grammaire : court entre les mots d'une
 *    phrase (lisez dans l'ordre), long entre groupes (événements distincts) ;
 *  - la sortie dure les deux tiers de l'entrée, en accélération ;
 *  - aucune technique n'est imposée à tout le film : la direction en choisit
 *    une par scène, et le contrôle anti-réflexe interdit la répétition.
 *
 * La taille est trouvée UNE fois (plus grande taille qui tient dans le bloc et
 * dans le nombre de lignes voulu), avant la première image : le texte découpé
 * en mots et en lettres est mesuré tel qu'il sera rendu.
 */
import { CSSProperties, Fragment, useLayoutEffect, useRef } from 'react';
import { cue, CueKind } from './cues';
import { useEngine, useLocalTime, useScene } from './context';
import { clamp, hash, mix, progress } from './time';

export type Role = 'headline' | 'support' | 'kicker' | 'label';

export interface KineticProps {
  text: string;
  technique: string;
  /** Début de l'entrée, en temps local de la scène (s). */
  at: number;
  role?: Role;
  /** Taille maximale, minimale (centièmes du petit côté) et nombre de lignes. */
  fit?: [number, number, number];
  /** Mettre un mot en valeur (couleur) — réservé à l'accroche et à l'appel. */
  emph?: boolean;
  /** Début de la sortie (temps local) ; null = pas de sortie. */
  exitAt?: number | null;
  sound?: CueKind | null;
  className?: string;
  style?: CSSProperties;
}

/** La plus grande taille qui tient : largeur sans débordement, lignes plafonnées. */
function useFit(ref: React.RefObject<HTMLElement | null>, spec: [number, number, number] | undefined, u: number, scale: number) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !spec) return;
    let hi = spec[0] * u * scale;
    let lo = spec[1] * u;
    let best = lo;
    for (let k = 0; k < 14; k++) {
      const mid = (lo + hi) / 2;
      el.style.fontSize = `${mid}px`;
      const lh = parseFloat(getComputedStyle(el).lineHeight) || mid * 1.1;
      const ok = el.scrollWidth <= el.clientWidth + 1 && Math.round(el.scrollHeight / lh) <= spec[2];
      if (ok) {
        best = mid;
        lo = mid;
      } else hi = mid;
    }
    el.style.fontSize = `${best}px`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/** Le mot mis en valeur : le plus long des trois derniers, souvent le plus porteur. */
function emphasisIndex(words: string[]): number {
  if (words.length < 3) return -1;
  let best = words.length - 1;
  for (let i = words.length - 3; i < words.length; i++) {
    if (words[i].replace(/\W/g, '').length > words[best].replace(/\W/g, '').length) best = i;
  }
  return best;
}

const GLYPHS = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789#%&';

export function Kinetic(props: KineticProps) {
  const { data, u, ease, easeIn, back } = useEngine();
  const scene = useScene();
  const lt = useLocalTime();
  const ref = useRef<HTMLSpanElement>(null);
  const d = data.direction;
  const role = props.role ?? 'headline';
  const isDisplay = role === 'headline';
  useFit(ref, props.fit, u, isDisplay ? d.type.scale : 1);

  const text = isDisplay && d.type.displayCase === 'upper' ? props.text.toUpperCase() : props.text;
  const words = text.split(/\s+/).filter(Boolean);
  const emph = props.emph ? emphasisIndex(words) : -1;
  const tech = props.technique;
  const dur = role === 'headline' ? d.pacing.enter : d.pacing.enter * 0.8;
  const st = tech === 'stackPush' ? d.pacing.groupStagger * 0.55 : d.pacing.unitStagger;
  const at = props.at;

  // Le son de l'entrée, une fois, au moment où le mouvement commence.
  if (props.sound) cue(`${scene.key}:${role}:${at}`, scene.start + at + 0.02, props.sound, role === 'headline' ? 1 : 0.6);
  if (tech === 'boxReveal') cue(`${scene.key}:${role}:box`, scene.start + at, 'softwhoosh', 0.6);

  // Sortie : accélération, deux tiers de la durée d'entrée.
  const exitP = props.exitAt != null ? easeIn(progress(lt, props.exitAt, dur * 0.66)) : 0;

  const baseStyle: CSSProperties = {
    ...(isDisplay
      ? {
          fontFamily: 'var(--f-display)',
          fontWeight: d.type.weight,
          letterSpacing: `${d.type.tracking}em`,
          lineHeight: d.type.lineHeight,
        }
      : {}),
    ...props.style,
  };

  // ── Techniques qui animent le BLOC entier ─────────────────────────────────
  if (tech === 'trackIn' || tech === 'scaleBlur') {
    const p = ease(progress(lt, at, dur * 1.2));
    const block: CSSProperties =
      tech === 'trackIn'
        ? {
            letterSpacing: `${mix(0.42, isDisplay ? d.type.tracking : 0, p)}em`,
            opacity: p,
            filter: `blur(${(1 - p) * 0.08}em)`,
          }
        : {
            transform: `scale(${mix(1.32, 1, p)})`,
            opacity: p,
            filter: `blur(${(1 - p) * 0.12}em)`,
          };
    return (
      <span ref={ref} data-fit={props.fit?.join(',')} className={`kt kt-${role} ${props.className || ''}`} style={{ ...baseStyle, ...block, ...exitStyle(exitP) }}>
        {words.map((w, i) => (
          <Fragment key={i}>
            <span className={i === emph ? 'kt-em' : undefined}>{w}</span>
            {i < words.length - 1 ? ' ' : ''}
          </Fragment>
        ))}
      </span>
    );
  }

  // ── Révélation par bloc de couleur ────────────────────────────────────────
  if (tech === 'boxReveal') {
    const p1 = ease(progress(lt, at, dur * 0.5));
    const p2 = easeIn(progress(lt, at + dur * 0.5, dur * 0.5));
    const shown = lt >= at + dur * 0.5;
    return (
      <span ref={ref} data-fit={props.fit?.join(',')} className={`kt kt-${role} kt-box ${props.className || ''}`} style={{ ...baseStyle, ...exitStyle(exitP) }}>
        <span style={{ opacity: shown ? 1 : 0 }}>
          {words.map((w, i) => (
            <Fragment key={i}>
              <span className={i === emph ? 'kt-em' : undefined}>{w}</span>
              {i < words.length - 1 ? ' ' : ''}
            </Fragment>
          ))}
        </span>
        <span
          className="kt-box-fill"
          style={{
            transform: `scaleX(${shown ? 1 - p2 : p1})`,
            transformOrigin: shown ? 'right center' : 'left center',
          }}
        />
      </span>
    );
  }

  // ── Techniques par LETTRE ─────────────────────────────────────────────────
  if (tech === 'charCascade' || tech === 'flipChars' || tech === 'scramble' || tech === 'typewriter') {
    let ci = 0;
    const totalChars = words.join('').length;
    const typingEnd = at + totalChars * 0.035;
    const caretOn = tech === 'typewriter' && lt < typingEnd + 0.6 && Math.floor(lt * 2.4) % 2 === 0;
    return (
      <span
        ref={ref}
        data-fit={props.fit?.join(',')}
        className={`kt kt-${role} ${props.className || ''}`}
        style={{ ...baseStyle, ...(tech === 'flipChars' ? { perspective: '600px' } : {}), ...exitStyle(exitP) }}
      >
        {words.map((w, wi) => (
          <Fragment key={wi}>
            <span className={`kt-word ${wi === emph ? 'kt-em' : ''}`}>
              {[...w].map((ch, k) => {
                const i = ci++;
                const cst = tech === 'scramble' ? st * 1.6 : tech === 'typewriter' ? 0.035 : Math.min(st, 0.6 / Math.max(1, totalChars));
                const start = at + i * cst;
                if (tech === 'typewriter') {
                  return (
                    <span key={k} style={{ opacity: lt >= start ? 1 : 0 }}>
                      {ch}
                    </span>
                  );
                }
                if (tech === 'scramble') {
                  const resolved = lt >= start + 0.18;
                  const visible = lt >= start - 0.25;
                  const glyph = GLYPHS[Math.floor(hash(i * 13 + Math.floor(lt * 18)) * GLYPHS.length)];
                  return (
                    <span key={k} style={{ opacity: visible ? (resolved ? 1 : 0.55) : 0 }}>
                      {resolved ? ch : glyph}
                    </span>
                  );
                }
                const p = (tech === 'charCascade' ? back : ease)(progress(lt, start, dur * 0.8));
                const style: CSSProperties =
                  tech === 'flipChars'
                    ? { display: 'inline-block', transform: `rotateX(${(1 - p) * -95}deg)`, transformOrigin: '50% 100%', opacity: clamp(p * 1.6) }
                    : { display: 'inline-block', transform: `translateY(${(1 - p) * 0.55}em) rotate(${(1 - p) * 8}deg)`, opacity: clamp(p * 1.4) };
                return (
                  <span key={k} style={style}>
                    {ch}
                  </span>
                );
              })}
            </span>
            {wi < words.length - 1 ? ' ' : ''}
          </Fragment>
        ))}
        {caretOn ? <span className="kt-caret" /> : null}
      </span>
    );
  }

  // ── Techniques par MOT ────────────────────────────────────────────────────
  const masked = tech === 'maskUp' || tech === 'stackPush';
  return (
    <span ref={ref} data-fit={props.fit?.join(',')} className={`kt kt-${role} ${props.className || ''}`} style={{ ...baseStyle, ...exitStyle(exitP) }}>
      {words.map((w, i) => {
        const p = ease(progress(lt, at + i * st, dur));
        let inner: CSSProperties = {};
        let outer: CSSProperties = {};
        switch (tech) {
          case 'lineWipe':
            outer = { clipPath: `inset(-0.2em ${(1 - p) * 100}% -0.25em 0)` };
            inner = { transform: `translateX(${(1 - p) * -0.15}em)` };
            break;
          case 'blurWords':
            inner = { opacity: p, filter: `blur(${(1 - p) * 0.1}em)`, transform: `translateY(${(1 - p) * 0.25}em)` };
            break;
          case 'slideAlternate':
            inner = { opacity: clamp(p * 1.5), transform: `translateX(${(i % 2 ? 1 : -1) * (1 - p) * 0.9}em)` };
            break;
          default:
            // maskUp / stackPush : le mot monte derrière un masque.
            inner = { transform: `translateY(${(1 - p) * 112}%)` };
        }
        return (
          <Fragment key={i}>
            <span className={`kt-word ${masked ? 'kt-mask' : ''} ${i === emph ? 'kt-em' : ''}`} style={outer}>
              <span className="kt-in" style={inner}>
                {w}
              </span>
            </span>
            {i < words.length - 1 ? ' ' : ''}
          </Fragment>
        );
      })}
    </span>
  );
}

function exitStyle(q: number): CSSProperties {
  if (q <= 0) return {};
  return { opacity: 1 - q, transform: `translateY(${-q * 0.35}em)`, filter: q > 0.05 ? `blur(${q * 0.08}em)` : undefined };
}

/**
 * Compteur « odomètre » : chaque chiffre roule jusqu'à sa valeur, les chiffres
 * de gauche plus longtemps (ils parcourent plus de tours).
 */
export function Odometer({ text, at, dur, fit }: { text: string; at: number; dur: number; fit?: [number, number, number] }) {
  const { data, u, ease } = useEngine();
  const scene = useScene();
  const lt = useLocalTime();
  const ref = useRef<HTMLSpanElement>(null);
  useFit(ref, fit, u, data.direction.type.scale);
  const chars = [...text];
  const digits = chars.filter((c) => /\d/.test(c)).length;
  let di = 0;
  for (let k = 0; k < 6; k++) cue(`${scene.key}:tick:${k}`, scene.start + at + dur * Math.pow(k / 6, 1.5), 'tick', 0.7);
  return (
    <span
      ref={ref}
      data-fit={fit?.join(',')}
      className="kt kt-headline kt-odo"
      style={{ fontFamily: 'var(--f-display)', fontWeight: data.direction.type.weight, letterSpacing: '-0.04em', lineHeight: 1 }}
    >
      {chars.map((c, i) => {
        if (!/\d/.test(c)) return <span key={i}>{c}</span>;
        const order = di++;
        const turns = digits - order - 1;
        const p = ease(progress(lt, at + order * 0.06, dur));
        const target = Number(c) + turns * 10;
        const pos = target * p;
        return (
          <span key={i} className="kt-odo-col">
            <span className="kt-odo-strip" style={{ transform: `translateY(${(-(pos % 10) * 100) / 11}%)` }}>
              {Array.from({ length: 11 }, (_, n) => (
                <span key={n}>{n % 10}</span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
}

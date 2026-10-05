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
import { Em, EmDecor } from './kit/Em';
import { clamp, hash, mix, progress, springEase } from './time';

/** Ressort des entrées par lettre (motion), échantillonné une seule fois. */
let SPRING: ((p: number) => number) | null = null;
const spring = (p: number) => (SPRING ??= springEase(0.45))(p);

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
    // Mesure sans les transformations d'entrée (mots décalés, réduits, penchés) : sinon la
    // largeur mesurée au départ sous-estime la largeur finale et le texte déborde une fois posé.
    el.classList.add('kt-measuring');
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
    el.classList.remove('kt-measuring');
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

/**
 * Pas entre deux lettres. Plafonné pour que le texte soit entièrement lisible bien avant la
 * fin de la scène, quelle que soit sa longueur (règle reading-time) : brouillage ≤ 0,9 s,
 * machine à écrire ≤ 1,2 s, cascade ≤ 0,6 s.
 */
function charStep(tech: string, st: number, total: number): number {
  const n = Math.max(1, total);
  if (tech === 'scramble') return Math.min(st * 1.6, 0.9 / n);
  if (tech === 'typewriter') return Math.min(0.035, 1.2 / n);
  return Math.min(st, 0.6 / n);
}

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
  // Grand moment « temps suspendu » : les entrées de la scène ralentissent.
  const pace = (scene.accent === 'hold' ? 1.45 : 1) * (scene.pace || 1);
  const dur = (role === 'headline' ? d.pacing.enter : d.pacing.enter * 0.8) * pace;
  const st = tech === 'stackPush' ? d.pacing.groupStagger * 0.55 : d.pacing.unitStagger;
  const at = props.at;
  // L'annotation du mot mis en valeur se trace une fois le mot entièrement posé :
  // après sa dernière lettre (techniques par lettre), après lui (par mot), après le bloc.
  const emAt = (() => {
    if (emph < 0) return at;
    if (tech === 'charCascade' || tech === 'flipChars' || tech === 'scramble' || tech === 'typewriter' || tech === 'springUp' || tech === 'wave' || tech === 'stretch') {
      const total = words.join('').length;
      const upTo = words.slice(0, emph + 1).join('').length;
      const cst = charStep(tech, st, total);
      return at + upTo * cst + (tech === 'typewriter' ? 0.2 : dur) + 0.1;
    }
    if (tech === 'trackIn' || tech === 'scaleBlur' || tech === 'boxReveal') return at + dur * 1.2 + 0.1;
    return at + emph * st + dur + 0.1;
  })();

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
            {i === emph ? <Em at={emAt}>{w}</Em> : <span>{w}</span>}
            {i < words.length - 1 ? ' ' : ''}
          </Fragment>
        ))}
      </span>
    );
  }

  // ── Contour tracé, puis remplissage ───────────────────────────────────────
  if (tech === 'outlineFill') {
    const draw = ease(progress(lt, at, dur * 0.9));
    const fill = ease(progress(lt, at + dur * 0.6, dur * 0.8));
    return (
      <span
        ref={ref}
        data-fit={props.fit?.join(',')}
        className={`kt kt-${role} ${props.className || ''}`}
        style={{
          ...baseStyle,
          WebkitTextStroke: `${mix(0.025, 0, fill)}em currentColor`,
          color: `color-mix(in srgb, currentColor ${Math.round(fill * 100)}%, transparent)`,
          clipPath: `inset(-0.2em ${(1 - draw) * 100}% -0.3em -0.1em)`,
          ...exitStyle(exitP),
        }}
      >
        {words.map((w, i) => (
          <Fragment key={i}>
            {i === emph ? <Em at={emAt}>{w}</Em> : <span>{w}</span>}
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
              {i === emph ? <Em at={emAt}>{w}</Em> : <span>{w}</span>}
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
  if (tech === 'charCascade' || tech === 'flipChars' || tech === 'scramble' || tech === 'typewriter' || tech === 'springUp' || tech === 'wave' || tech === 'stretch') {
    let ci = 0;
    const totalChars = words.join('').length;
    const typingEnd = at + totalChars * charStep('typewriter', st, totalChars);
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
            <span className={`kt-word ${wi === emph ? 'kt-em relative isolate' : ''}`}>
              {wi === emph ? <EmDecor at={emAt} /> : null}
              {[...w].map((ch, k) => {
                const i = ci++;
                const cst = charStep(tech, st, totalChars);
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
                const raw = progress(lt, start, dur * 0.8);
                const p = (tech === 'charCascade' ? back : ease)(raw);
                let style: CSSProperties;
                if (tech === 'flipChars') style = p >= 1 ? { display: 'inline-block' } : { display: 'inline-block', transform: `rotateX(${(1 - p) * -95}deg)`, transformOrigin: '50% 100%', opacity: clamp(p * 1.6) };
                else if (tech === 'springUp') {
                  // Ressort physique : la lettre dépasse, puis se pose.
                  const k = spring(raw);
                  style = { display: 'inline-block', transform: `translateY(${(1 - k) * 0.7}em)`, opacity: clamp(raw * 3) };
                } else if (tech === 'wave') {
                  // Une vague qui traverse le mot et s'amortit.
                  const damp = 1 - ease(clamp((lt - start) / (dur * 1.6)));
                  style = { display: 'inline-block', transform: `translateY(${Math.sin((lt - start) * 9) * 0.22 * damp - (1 - p) * -0.4}em)`, opacity: clamp(raw * 2.5) };
                } else if (tech === 'stretch') {
                  const k = spring(raw);
                  style = { display: 'inline-block', transform: `scaleY(${k})`, transformOrigin: '50% 90%', opacity: clamp(raw * 4) };
                } else style = { display: 'inline-block', transform: `translateY(${(1 - p) * 0.55}em) rotate(${(1 - p) * 8}deg)`, opacity: clamp(p * 1.4) };
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
  // « Dispersion » : les mots arrivent dans un ordre aléatoire (déterministe), pas de gauche à droite.
  const order = tech === 'scatter' ? words.map((_, i) => i).sort((a, b) => hash(a * 7.7 + words.length) - hash(b * 7.7 + words.length)) : null;
  return (
    <span ref={ref} data-fit={props.fit?.join(',')} className={`kt kt-${role} ${props.className || ''}`} style={{ ...baseStyle, ...exitStyle(exitP) }}>
      {words.map((w, i) => {
        const rank = order ? order.indexOf(i) : i;
        const p = ease(progress(lt, at + rank * (order ? st * 1.8 : st), dur));
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
          case 'rotateX':
            // Le mot bascule vers le spectateur depuis sa ligne de base (3D). Posé : plus aucune
            // transformation 3D, sinon le texte reste dans un calque rastérisé selon l'historique.
            inner = p >= 1 ? {} : { opacity: clamp(p * 1.8), transform: `perspective(800px) rotateX(${(1 - p) * 80}deg)`, transformOrigin: '50% 100%' };
            break;
          case 'zoomWords':
            inner = { opacity: clamp(p * 1.4), transform: `scale(${mix(2.2, 1, p)})`, filter: `blur(${(1 - p) * 0.08}em)` };
            break;
          case 'skewIn':
            inner = { opacity: clamp(p * 1.6), transform: `translateX(${(1 - p) * -0.7}em) skewX(${(1 - p) * -18}deg)` };
            break;
          case 'scatter':
            inner = { opacity: p, transform: `translateY(${(1 - p) * (hash(i + 3.1) - 0.5) * 0.8}em) scale(${mix(0.85, 1, p)})` };
            break;
          default:
            // maskUp / stackPush : le mot monte derrière un masque.
            inner = { transform: `translateY(${(1 - p) * 112}%)` };
        }
        return (
          <Fragment key={i}>
            {i === emph ? (
              <Em at={emAt}>
                <span className={`kt-word ${masked ? 'kt-mask' : ''}`} style={outer}>
                  <span className="kt-in" style={inner}>
                    {w}
                  </span>
                </span>
              </Em>
            ) : (
              <span className={`kt-word ${masked ? 'kt-mask' : ''}`} style={outer}>
                <span className="kt-in" style={inner}>
                  {w}
                </span>
              </span>
            )}
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

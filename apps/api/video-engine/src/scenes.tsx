/**
 * LES SCÈNES — composants React, une composition par direction.
 *
 * Une scène ne connaît pas « sa » mise en page : elle demande à la direction
 * comment traiter une image (plein cadre, cellule de grille, carte, polaroïd,
 * bichromie…), une liste (filets, empilement, autocollants, un élément à la
 * fois), un bouton (pilule, rectangle, bloc, lien souligné). Deux vidéos du même
 * contenu ne se ressemblent donc pas d'une direction à l'autre.
 *
 * Interdits (règle « anti-slop » d'iCode, appliquée en code) : numérotation
 * 01/02/03 décorative, filets latéraux colorés, petit libellé en capitales au-
 * dessus de chaque titre, même entrée partout, décor par défaut.
 */
import { CSSProperties, ReactNode } from 'react';
import { cue } from './cues';
import { useEngine, useLocalTime, useScene } from './context';
import { Composition, useEnter, useExitAt } from './layout';
import { Icon } from './kit/Icon';
import { LogoMotion, SVG_LOGO_VARIANTS } from './kit/LogoMotion';
import { Clip, LottieBox, RiveBox, ThreeView } from './media';
import { Kinetic, Odometer } from './text';
import { clamp, mix, progress } from './time';

// ─── Briques communes ───────────────────────────────────────────────────────

/** Le son d'un titre selon la direction : une direction élégante ne cliquette pas. */
function useHeadlineSound(): 'pop' | 'click' | null {
  const { data } = useEngine();
  return ({ kinetic: 'pop', collage: 'pop', brutal: 'click', swiss: 'click', drenched: 'click' } as Record<string, 'pop' | 'click'>)[data.direction.id] ?? null;
}

function Headline({ text, at = 0, fit, emph }: { text?: string; at?: number; fit: [number, number, number]; emph?: boolean }) {
  const s = useScene();
  const exitAt = useExitAt();
  const sound = useHeadlineSound();
  if (!text) return null;
  // Grand moment « titre géant » : le titre prend tout le cadre (l'ajustement garde la lisibilité).
  const sized: [number, number, number] = s.accent === 'giant' ? [fit[0] * 1.35, fit[1] * 1.15, fit[2]] : fit;
  return <Kinetic text={text} technique={s.motion.headline} at={at} role="headline" fit={sized} emph={emph} exitAt={exitAt} sound={s.accent === 'giant' ? 'impact' : sound} />;
}

function Support({ text, at, fit = [6, 3.6, 3], muted = true }: { text?: string; at: number; fit?: [number, number, number]; muted?: boolean }) {
  const s = useScene();
  const exitAt = useExitAt();
  if (!text) return null;
  return <Kinetic text={text} technique={s.motion.support} at={at} role="support" fit={fit} exitAt={exitAt} style={muted ? { color: 'var(--muted)' } : undefined} />;
}

/** Le petit libellé : seulement si le plan l'autorise (une fois, sur l'accroche). */
function Kicker({ text, at }: { text?: string; at: number }) {
  const { data } = useEngine();
  const s = useScene();
  const style = useEnter('fade', at, 0.8, useExitAt());
  if (!text || !s.motion.kicker) return null;
  const tone: Record<string, string> = { editorial: 'kicker-italic', kinetic: 'kicker-tag', precision: 'kicker-plain' };
  return (
    <span className={`kicker ${tone[data.direction.id] || 'kicker-plain'}`} style={style}>
      {text}
    </span>
  );
}

/** Filet éditorial qui se trace (éditorial, précision). */
function Rule({ at, width = '28%' }: { at: number; width?: string }) {
  const { data, ease } = useEngine();
  const lt = useLocalTime();
  if (!['editorial', 'precision'].includes(data.direction.id)) return null;
  const p = ease(progress(lt, at, data.direction.pacing.enter));
  return <span className="rule" style={{ width, transform: `scaleX(${p})` }} />;
}

/** Une image ou un clip, traité selon la direction. */
function Media({ src, video, at, mode }: { src?: string; video?: string; at: number; mode: 'full' | 'framed' }) {
  const { data, ease } = useEngine();
  const s = useScene();
  const lt = useLocalTime();
  const id = data.direction.id;
  const content = video ? <Clip src={video} className="media-el" /> : src ? <img className="media-el" src={src} alt="" /> : null;
  if (!content) return null;
  // Lente poussée sur l'image fixe : elle vit sans distraire.
  const kb = video ? {} : { transform: `scale(${mix(1.12, 1.02, clamp((lt + s.start - s.visFrom) / Math.max(0.1, s.span)))})` };
  if (mode === 'full') {
    const duo = id === 'drenched';
    return (
      <div className={`media-full ${duo ? 'media-duo' : ''}`}>
        <div className="media-inner" style={kb}>
          {content}
        </div>
        <div className={id === 'cinematic' ? 'scrim scrim-cine' : 'scrim'} />
      </div>
    );
  }
  const p = ease(progress(lt, at, data.direction.pacing.enter * 1.2));
  const frame: Record<string, { cls: string; style: CSSProperties }> = {
    swiss: { cls: 'mf-swiss', style: { clipPath: `inset(0 ${(1 - p) * 100}% 0 0)` } },
    precision: { cls: 'mf-card', style: { opacity: p, transform: `translateY(${(1 - p) * 3}vmin)` } },
    collage: { cls: 'mf-polaroid', style: { opacity: clamp(p * 2), transform: `rotate(${mix(9, -3, p)}deg) scale(${mix(1.15, 1, p)})` } },
    brutal: { cls: 'mf-hard', style: { clipPath: `inset(${(1 - p) * 100}% 0 0 0)` } },
    editorial: { cls: 'mf-editorial', style: { clipPath: `inset(0 0 ${(1 - p) * 100}% 0)` } },
  };
  const f = frame[id] || { cls: 'mf-card', style: { opacity: p, transform: `scale(${mix(0.94, 1, p)})` } };
  return (
    <div className={`media-frame ${f.cls}`} style={f.style}>
      <div className="media-inner" style={kb}>
        {content}
      </div>
    </div>
  );
}

const fullBleedDirections = new Set(['cinematic', 'drenched', 'kinetic']);

// ─── Scènes ─────────────────────────────────────────────────────────────────

function Hook() {
  const s = useScene();
  const { data, horizontal } = useEngine();
  const big = data.direction.id === 'brutal' || data.direction.id === 'kinetic';
  return (
    <Composition>
      <Kicker text={s.slots.kicker} at={0} />
      <Headline text={s.slots.title} at={s.motion.kicker ? 0.25 : 0.05} fit={horizontal ? [15, 8, 2] : big ? [24, 10, 4] : [20, 9, 3]} emph={['kinetic', 'collage', 'drenched'].includes(data.direction.id) || data.kit?.annotateScene === s.key} />
      <Rule at={0.6} />
    </Composition>
  );
}

function Statement() {
  const s = useScene();
  const { data } = useEngine();
  const g = data.direction.pacing.groupStagger;
  return (
    <Composition>
      <Headline text={s.slots.title} fit={[14, 7, 4]} emph={data.kit?.annotateScene === s.key} />
      <Rule at={g + 0.3} />
      <Support text={s.slots.sub} at={g * 2} />
    </Composition>
  );
}

function Product() {
  const s = useScene();
  const { data, horizontal } = useEngine();
  const g = data.direction.pacing.groupStagger;
  const id = data.direction.id;
  const exitAt = useExitAt();
  const priceStyle = useEnter(id === 'collage' || id === 'kinetic' ? 'pop' : 'rise', g * 2.2, 0.8, exitAt);
  const price = s.slots.price ? (
    <span className={`price price-${id}`} style={priceStyle}>
      {s.slots.price}
    </span>
  ) : null;
  if (s.slots.price) cue(`${s.key}:price`, s.tin + g * 2.2, id === 'collage' || id === 'kinetic' ? 'pop' : 'click', 0.8);
  const text = (
    <>
      <Headline text={s.slots.name} at={g * 0.8} fit={horizontal ? [12, 6, 2] : [14, 7, 2]} />
      <Support text={s.slots.tagline} at={g * 1.6} />
      {price}
    </>
  );
  if (!s.image) {
    return (
      <Composition>
        <Headline text={s.slots.name} fit={[18, 9, 3]} />
        <Rule at={g} />
        <Support text={s.slots.tagline} at={g * 1.5} />
        {price}
      </Composition>
    );
  }
  if (fullBleedDirections.has(id)) {
    return (
      <>
        <Media src={s.image} at={0} mode="full" />
        <Composition anchor={s.motion.anchor === 'center' ? 'bottom-center' : 'bottom-left'}>{text}</Composition>
      </>
    );
  }
  return (
    <div className={`split ${horizontal ? 'split-row' : 'split-col'} split-${id}`}>
      <div className="split-media">
        <Media src={s.image} at={0} mode="framed" />
      </div>
      <div className="split-text" style={{ alignItems: s.motion.align === 'center' && !horizontal ? 'center' : 'flex-start', textAlign: s.motion.align === 'center' && !horizontal ? 'center' : 'left' }}>
        {text}
      </div>
    </div>
  );
}

function Benefits() {
  const s = useScene();
  const { data, ease } = useEngine();
  const lt = useLocalTime();
  const exitAt = useExitAt();
  const id = data.direction.id;
  const items = [s.slots.b1, s.slots.b2, s.slots.b3].filter(Boolean) as string[];
  const g = data.direction.pacing.groupStagger;
  const start = s.slots.title ? g * 1.4 : 0.05;
  // Cinématique et trempé : un élément à la fois, au centre de l'attention.
  if (id === 'cinematic' || id === 'drenched') {
    const per = Math.max(0.9, (s.duration - start - 0.4) / items.length);
    return (
      <Composition>
        <Headline text={s.slots.title} fit={[10, 6, 2]} />
        <div className="one-at-a-time">
          {items.map((it, i) => {
            const a = start + i * per;
            const p = ease(progress(lt, a, data.direction.pacing.enter));
            const q = i < items.length - 1 ? clamp(progress(lt, a + per - 0.25, 0.25)) : 0;
            cue(`${s.key}:b${i}`, s.start + a, 'softwhoosh', 0.45);
            return (
              <span key={i} className="oaat-item" style={{ opacity: p * (1 - q), transform: `translateY(${(1 - p) * 3 - q * 3}vmin)`, filter: `blur(${(1 - p + q) * 6}px)` }}>
                {s.icons?.[i] ? <Icon svg={s.icons[i]} className="mb-3 block size-12 text-hl-text" /> : null}
                {it}
              </span>
            );
          })}
        </div>
      </Composition>
    );
  }
  const styleClass = ({ editorial: 'list-rules', precision: 'list-rules', swiss: 'list-stack', brutal: 'list-stack', kinetic: 'list-pills', collage: 'list-stickers' } as Record<string, string>)[id] || 'list-rules';
  return (
    <Composition>
      <Headline text={s.slots.title} fit={[12, 6, 2]} />
      <ul className={`list ${styleClass}`}>
        {items.map((it, i) => (
          <Item key={i} text={it} at={start + i * g} index={i} exitAt={exitAt} />
        ))}
      </ul>
    </Composition>
  );
}

function Item({ text, at, index, exitAt }: { text: string; at: number; index: number; exitAt: number | null }) {
  const s = useScene();
  const { data } = useEngine();
  const id = data.direction.id;
  const kind = id === 'collage' ? 'drop' : id === 'kinetic' ? 'pop' : id === 'swiss' || id === 'brutal' ? 'slideLeft' : 'rise';
  const style = useEnter(kind, at, 0.85, exitAt);
  cue(`${s.key}:item${index}`, s.start + at, id === 'collage' || id === 'kinetic' ? 'pop' : 'click', 0.55);
  const tilt = id === 'collage' ? { rotate: `${[-2.5, 1.8, -1.2][index % 3]}deg` } : {};
  return (
    <li className="list-row" style={{ ...style, ...tilt }}>
      {s.icons?.[index] ? (
        // Pastille et autocollant portent déjà leur couleur : l'icône la reprend.
        <Icon svg={s.icons[index]} className={id === 'kinetic' || id === 'collage' ? 'size-8 text-current' : id === 'swiss' || id === 'brutal' ? 'size-11 text-hl-text' : 'size-10 text-hl-text'} />
      ) : id === 'editorial' || id === 'precision' ? (
        <span className="list-dot" />
      ) : null}
      <Kinetic text={text} technique={id === 'brutal' ? 'boxReveal' : 'blurWords'} at={at} role="support" fit={[id === 'swiss' || id === 'brutal' ? 10 : 7.5, 4.2, 2]} exitAt={exitAt} style={{ fontWeight: 600 }} />
    </li>
  );
}

function Stat() {
  const s = useScene();
  const { data } = useEngine();
  const g = data.direction.pacing.groupStagger;
  const value = s.slots.value || '';
  const hasDigits = /\d/.test(value);
  return (
    <Composition>
      {hasDigits ? <Odometer text={value} at={0.1} dur={Math.min(1.6, s.duration * 0.45)} fit={[28, 12, 1]} /> : <Headline text={value} fit={[24, 10, 1]} />}
      <Rule at={g * 1.5} width="18%" />
      <Support text={s.slots.label} at={g * 2} fit={[6, 3.6, 3]} muted={false} />
    </Composition>
  );
}

function Offer() {
  const s = useScene();
  const { data, ease } = useEngine();
  const lt = useLocalTime();
  const exitAt = useExitAt();
  const g = data.direction.pacing.groupStagger;
  const id = data.direction.id;
  const oldStyle = useEnter('fade', 0.05, 0.7, exitAt);
  const strike = ease(progress(lt, g, data.direction.pacing.enter * 0.6));
  const badgeAt = g * 2.4;
  const badgeStyle = useEnter(id === 'editorial' || id === 'precision' ? 'rise' : 'pop', badgeAt, 0.7, exitAt);
  if (s.slots.oldPrice) cue(`${s.key}:strike`, s.start + g, 'click', 0.7);
  if (s.slots.badge) cue(`${s.key}:badge`, s.start + badgeAt, id === 'editorial' || id === 'precision' ? 'click' : 'impact', 0.6);
  const badgeShape = ({ collage: 'badge-stamp', kinetic: 'badge-burst', swiss: 'badge-rect', brutal: 'badge-block', drenched: 'badge-rect' } as Record<string, string>)[id] || 'badge-text';
  return (
    <Composition>
      <Kicker text={s.slots.kicker} at={0} />
      {s.slots.oldPrice ? (
        <span className="old-price" style={oldStyle}>
          {s.slots.oldPrice}
          <span className="strike" style={{ transform: `scaleX(${strike}) rotate(-6deg)` }} />
        </span>
      ) : null}
      <Headline text={s.slots.price} at={g * 1.3} fit={[24, 10, 2]} />
      {s.slots.badge ? (
        <span className={`badge ${badgeShape}`} style={badgeStyle}>
          {s.slots.badge}
        </span>
      ) : null}
      <Support text={s.slots.note} at={g * 3} fit={[4.6, 3.2, 2]} />
    </Composition>
  );
}

function Quote() {
  const s = useScene();
  const { data } = useEngine();
  const g = data.direction.pacing.groupStagger;
  const exitAt = useExitAt();
  const authorStyle = useEnter('rise', g * 3, 0.8, exitAt);
  const showMark = ['editorial', 'collage', 'precision'].includes(data.direction.id);
  const markStyle = useEnter('scale', 0, 0.8, exitAt);
  return (
    <Composition>
      {showMark ? (
        <span className="quote-mark" style={markStyle}>
          “
        </span>
      ) : null}
      <Kinetic text={s.slots.quote || ''} technique={s.motion.support === 'lineWipe' ? 'lineWipe' : 'blurWords'} at={0.15} role="support" fit={[8, 4.4, 5]} exitAt={exitAt} style={{ fontFamily: 'var(--f-display)', fontWeight: 500, lineHeight: 1.18 }} />
      <span className="quote-author" style={authorStyle}>
        {s.slots.author}
      </span>
    </Composition>
  );
}

const ICON: Record<string, ReactNode> = {
  date: <path d="M4 6h16v14H4zM4 10h16M9 3v4M15 3v4" />,
  time: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  place: (
    <>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.4" />
    </>
  ),
};

function Event() {
  const s = useScene();
  const { data } = useEngine();
  const exitAt = useExitAt();
  const g = data.direction.pacing.groupStagger;
  const rows = (['date', 'time', 'place'] as const).filter((k) => s.slots[k]);
  return (
    <Composition>
      <Headline text={s.slots.title} fit={[14, 7, 3]} />
      <div className="event-rows">
        {rows.map((k, i) => (
          <EventRow key={k} icon={ICON[k]} svg={s.icons?.[(['date', 'time', 'place'] as const).indexOf(k)]} text={s.slots[k]} at={g * (1.6 + i)} exitAt={exitAt} />
        ))}
      </div>
    </Composition>
  );
}

function EventRow({ icon, svg, text, at, exitAt }: { icon: ReactNode; svg?: string; text: string; at: number; exitAt: number | null }) {
  const style = useEnter('slideLeft', at, 0.8, exitAt);
  return (
    <div className="event-row" style={style}>
      {svg ? (
        <Icon svg={svg} className="event-icon" />
      ) : (
        <svg className="event-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {icon}
        </svg>
      )}
      <Kinetic text={text} technique="blurWords" at={at} role="support" fit={[5.6, 3.4, 2]} exitAt={exitAt} style={{ fontWeight: 600 }} />
    </div>
  );
}

function Gallery() {
  const s = useScene();
  const { data, ease } = useEngine();
  const lt = useLocalTime();
  const imgs = (s.images || []).slice(0, 3);
  const id = data.direction.id;
  // Cinématique : une image à la fois, en fondu, chacune avec sa poussée lente.
  if (id === 'cinematic' || id === 'precision') {
    const per = s.duration / Math.max(1, imgs.length);
    return (
      <>
        {imgs.map((src, i) => {
          const p = i === 0 ? 1 : ease(progress(lt, i * per - 0.3, 0.6));
          return (
            <div key={i} className="media-full" style={{ opacity: p }}>
              <div className="media-inner" style={{ transform: `scale(${mix(1.14, 1.02, clamp((lt - i * per) / (per + 0.6)))})` }}>
                <img className="media-el" src={src} alt="" />
              </div>
            </div>
          );
        })}
        <div className="scrim" />
        <Composition anchor="bottom-left">
          <Support text={s.slots.caption} at={0.4} muted={false} fit={[6, 4, 2]} />
        </Composition>
      </>
    );
  }
  return (
    <div className={`gallery gallery-${id} gallery-n${imgs.length}`}>
      {imgs.map((src, i) => (
        <Tile key={i} src={src} at={i * data.direction.pacing.groupStagger} index={i} />
      ))}
      {s.slots.caption ? (
        <div className="gallery-caption">
          <Support text={s.slots.caption} at={0.6} muted={false} fit={[6, 4, 2]} />
        </div>
      ) : null}
    </div>
  );
}

function Tile({ src, at, index }: { src: string; at: number; index: number }) {
  const s = useScene();
  const { data, ease } = useEngine();
  const lt = useLocalTime();
  const id = data.direction.id;
  const p = ease(progress(lt, at, data.direction.pacing.enter * 1.1));
  cue(`${s.key}:tile${index}`, s.start + at, id === 'collage' ? 'pop' : 'softwhoosh', 0.5);
  const style: CSSProperties =
    id === 'collage'
      ? { opacity: clamp(p * 2), transform: `rotate(${[-4, 3, -2][index % 3] * p + (1 - p) * 12}deg) translateY(${(1 - p) * -6}vmin)` }
      : { clipPath: index % 2 ? `inset(${(1 - p) * 100}% 0 0 0)` : `inset(0 ${(1 - p) * 100}% 0 0)` };
  return (
    <div className="tile" style={style}>
      <img className="media-el" src={src} alt="" style={{ transform: `scale(${mix(1.2, 1.04, p)})` }} />
    </div>
  );
}

function Wordswap() {
  const s = useScene();
  const { data, ease, easeIn } = useEngine();
  const lt = useLocalTime();
  const words = [s.slots.w1, s.slots.w2, s.slots.w3].filter(Boolean) as string[];
  const g = data.direction.pacing.groupStagger;
  const per = Math.max(0.5, (s.duration - 0.9) / Math.max(1, words.length));
  return (
    <Composition>
      <Support text={s.slots.lead} at={0} muted fit={[7, 4, 2]} />
      <div className="swap" style={{ fontFamily: 'var(--f-display)', fontWeight: data.direction.type.weight, letterSpacing: `${data.direction.type.tracking}em` }}>
        {words.map((w, i) => {
          const a = g + i * per;
          const p = ease(progress(lt, a, data.direction.pacing.enter * 0.7));
          const q = i < words.length - 1 ? easeIn(progress(lt, a + per, data.direction.pacing.enter * 0.5)) : 0;
          cue(`${s.key}:w${i}`, s.start + a, 'click', 0.8);
          return (
            <span key={i} className={`swap-word ${i === words.length - 1 ? 'swap-last' : ''}`} style={{ transform: `translateY(${(1 - p) * 105 - q * 105}%)` }}>
              {w}
            </span>
          );
        })}
      </div>
    </Composition>
  );
}

function Cta() {
  const s = useScene();
  const { data, horizontal } = useEngine();
  const lt = useLocalTime();
  const exitAt = useExitAt();
  const id = data.direction.id;
  const g = data.direction.pacing.groupStagger;
  const btnStyle = useEnter(id === 'collage' || id === 'kinetic' ? 'pop' : 'rise', g * 1.6, 0.8, exitAt);
  cue(`${s.key}:btn`, s.start + g * 1.6, id === 'editorial' ? 'click' : 'pop', 0.8);
  // Une seule pulsation, tardive : attirer l'œil une fois, pas clignoter.
  const pulseT = lt - (g * 1.6 + 1.1);
  const pulse = pulseT > 0 && pulseT < 0.5 && id !== 'editorial' && id !== 'cinematic' ? 1 + Math.sin((pulseT / 0.5) * Math.PI) * 0.05 : 1;
  const shape = ({ precision: 'btn-pill', kinetic: 'btn-pill', swiss: 'btn-rect', brutal: 'btn-block', collage: 'btn-sticker', drenched: 'btn-rect', cinematic: 'btn-ghost' } as Record<string, string>)[id] || 'btn-link';
  return (
    <Composition>
      <Headline text={s.slots.title} fit={horizontal ? [12, 7, 2] : [15, 7, 3]} emph={['kinetic', 'collage', 'drenched'].includes(id) || data.kit?.annotateScene === s.key} />
      <span className={`btn ${shape}`} style={{ ...btnStyle, scale: String(pulse) }}>
        {s.slots.action}
        <svg className="btn-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12h15M13 6l6 6-6 6" />
        </svg>
      </span>
      <Support text={s.slots.contact} at={g * 2.6} fit={[4.6, 3.2, 1]} />
    </Composition>
  );
}

function Logo() {
  const s = useScene();
  const { data, ease, back, horizontal, u } = useEngine();
  const lt = useLocalTime();
  const sf = data.surfaces[s.surface] || data.surfaces.light;
  const src = sf.dark ? data.logo.onDark || data.logo.onLight : data.logo.onLight || data.logo.onDark;
  // Une montée avant la signature, puis un scintillement quand elle apparaît.
  if (s.start > 3 && !['editorial', 'precision', 'cinematic'].includes(data.direction.id)) cue(`${s.key}:riser`, Math.max(0, s.start - 1.5), 'riser', 0.6);
  cue(`${s.key}:shimmer`, s.tin + 0.05, 'shimmer');
  const tagStyle = useEnter('rise', 0.9, 0.9, null);
  if (s.three) {
    return (
      <>
        <ThreeView cfg={s.three} width={data.width} height={data.height} horizontal={horizontal} />
        <Composition anchor="bottom-center" gap={2}>
          <Kinetic text={data.brandName} technique="trackIn" at={0.9} role="headline" fit={[9, 5, 1]} />
          {s.slots.tagline ? (
            <span className="tagline" style={tagStyle}>
              {s.slots.tagline}
            </span>
          ) : null}
        </Composition>
      </>
    );
  }
  const id = data.direction.id;
  const kitLogo = data.kit?.logo || 'classic';
  // Logo vectoriel animé (graphe de capacités) : tracé, plume, morphose, assemblage, balayage.
  if (SVG_LOGO_VARIANTS.includes(kitLogo) && data.kit?.logoSvg) {
    cue(`${s.key}:logo-motion`, s.tin, kitLogo === 'assemble' ? 'pop' : kitLogo === 'morph' ? 'whoosh' : 'softwhoosh', 0.6);
    const anchor = id === 'swiss' || id === 'brutal' ? 'bottom-left' : 'center';
    return (
      <Composition anchor={anchor} gap={4}>
        <LogoMotion variant={kitLogo} at={0.05} height={u * (data.kit.logoIsIcon ? 26 : horizontal ? 24 : 22)} align={anchor === 'center' ? 'center' : 'left'} />
        {data.kit.logoIsIcon ? <Kinetic text={data.brandName} technique="maskUp" at={1.3} role="headline" fit={[11, 6, 1]} /> : null}
        {s.slots.tagline ? (
          <span className="tagline" style={tagStyle}>
            {s.slots.tagline}
          </span>
        ) : null}
      </Composition>
    );
  }
  // Symbole puis nom : l'icône se pose, le nom glisse de derrière elle.
  if (kitLogo === 'split' && data.logo.icon) {
    const ip = back(progress(lt, 0, data.direction.pacing.enter));
    const np = ease(progress(lt, 0.55, data.direction.pacing.enter * 1.2));
    return (
      <Composition anchor="center" gap={4}>
        <div className="flex items-center justify-center" style={{ gap: u * 3 }}>
          <img className="logo-icon" src={data.logo.icon} alt="" style={{ transform: `translateX(${(1 - np) * 40}%) scale(${mix(0.3, 1, ip)})`, opacity: clamp(ip * 2), position: 'relative', zIndex: 1 }} />
          <div className="overflow-hidden">
            <div style={{ transform: `translateX(${(1 - np) * -105}%)` }}>
              <Kinetic text={data.brandName} technique="trackIn" at={0.55} role="headline" fit={[12, 6, 1]} />
            </div>
          </div>
        </div>
        {s.slots.tagline ? (
          <span className="tagline" style={tagStyle}>
            {s.slots.tagline}
          </span>
        ) : null}
      </Composition>
    );
  }
  const p = ease(progress(lt, 0, data.direction.pacing.enter * 1.4));
  const logoImg = (style: CSSProperties = {}) =>
    src ? <img className="logo-img" src={src} alt="" style={style} /> : <Kinetic text={data.brandName} technique="trackIn" at={0} role="headline" fit={[14, 7, 2]} />;
  const tagline = s.slots.tagline ? (
    <span className="tagline" style={tagStyle}>
      {s.slots.tagline}
    </span>
  ) : null;

  // Brutaliste et trempé : le nom de la marque devient l'image, en très grand.
  if (id === 'brutal' || id === 'drenched') {
    return (
      <Composition anchor={id === 'brutal' ? 'center-left' : 'bottom-left'} gap={3}>
        {data.logo.icon ? <img className="logo-icon" src={data.logo.icon} alt="" style={useEnter('scale', 0, 0.8, null)} /> : null}
        <Kinetic text={data.brandName} technique={id === 'brutal' ? 'stackPush' : 'maskUp'} at={0.15} role="headline" fit={[26, 10, 2]} sound="impact" />
        {tagline}
      </Composition>
    );
  }
  // Suisse : signature en bas à gauche, un filet traverse le cadre, la phrase à droite.
  if (id === 'swiss') {
    return (
      <>
        <span className="sign-rule" style={{ transform: `scaleX(${p})` }} />
        <Composition anchor="bottom-left" gap={4}>
          {logoImg({ clipPath: `inset(0 ${(1 - p) * 100}% 0 0)`, objectPosition: 'left center' })}
          {tagline}
        </Composition>
      </>
    );
  }
  // Collage : le logo sur une carte de papier, un morceau d'adhésif.
  if (id === 'collage') {
    const card = useEnter('drop', 0, 1, null);
    return (
      <Composition anchor="center" gap={5}>
        <div className="sign-card" style={card}>
          <span className="sign-tape" />
          {logoImg()}
        </div>
        {tagline}
      </Composition>
    );
  }
  // Cinétique : le logo jaillit devant une étoile de rayons qui tourne.
  if (id === 'kinetic') {
    const pop = useEnter('pop', 0.05, 0.9, null);
    return (
      <Composition anchor="center" gap={5}>
        <div className="sign-burst-wrap">
          <span className="sign-burst" style={{ transform: `scale(${mix(0.3, 1, p)}) rotate(${lt * 25}deg)`, opacity: p }} />
          <div style={pop}>{logoImg()}</div>
        </div>
        {tagline}
      </Composition>
    );
  }
  // Cinématique : un fondu lent, net au dernier moment.
  if (id === 'cinematic') {
    const q = ease(progress(lt, 0, 1.6));
    return (
      <Composition anchor="center" gap={4}>
        {logoImg({ opacity: q, filter: `blur(${(1 - q) * 12}px)`, transform: `scale(${mix(1.06, 1, q)})` })}
        {tagline}
      </Composition>
    );
  }
  // Éditorial et précision : révélation par le centre, filet fin.
  return (
    <Composition anchor="center" gap={4}>
      {logoImg({ clipPath: `inset(0 ${(1 - p) * 50}% 0 ${(1 - p) * 50}%)`, transform: `scale(${mix(1.08, 1, p)})` })}
      <Rule at={0.6} width="22%" />
      {tagline}
    </Composition>
  );
}

function Footage() {
  const s = useScene();
  const { data } = useEngine();
  const g = data.direction.pacing.groupStagger;
  const exitAt = useExitAt();
  const boxStyle = useEnter('wipeRight', 0.05, 1, exitAt);
  const id = data.direction.id;
  const boxed = id === 'swiss' || id === 'precision';
  return (
    <>
      <Media src={s.image} video={s.video} at={0} mode="full" />
      <Composition anchor={s.motion.align === 'center' ? 'bottom-center' : 'bottom-left'}>
        {boxed ? (
          <div className="footage-box" style={boxStyle}>
            <Headline text={s.slots.title} at={0.3} fit={[10, 5.5, 3]} />
            <Support text={s.slots.sub} at={g * 1.6} fit={[4.6, 3.2, 2]} />
          </div>
        ) : (
          <>
            <Kicker text={s.slots.kicker} at={0} />
            <Headline text={s.slots.title} at={0.2} fit={[12, 6, 3]} />
            <Support text={s.slots.sub} at={g * 1.6} muted={false} />
          </>
        )}
      </Composition>
    </>
  );
}

function KineticScene() {
  const s = useScene();
  const { data, ease, easeIn } = useEngine();
  const lt = useLocalTime();
  const lines = [s.slots.l1, s.slots.l2, s.slots.l3, s.slots.l4].filter(Boolean) as string[];
  const d = data.direction;
  // Variante 1 : une ligne à la fois (rythme de coupe) ; variante 0 : empilement.
  if (s.variant === 1) {
    const per = Math.max(0.45, (s.duration - 0.4) / lines.length);
    return (
      <Composition anchor="center">
        <div className="kin-stage">
          {lines.map((l, i) => {
            const a = i * per;
            const p = ease(progress(lt, a, d.pacing.enter * 0.55));
            const q = i < lines.length - 1 ? easeIn(progress(lt, a + per - 0.12, 0.12)) : 0;
            const last = i === lines.length - 1;
            cue(`${s.key}:k${i}`, s.start + a, last ? 'impact' : 'pop', last ? 0.55 : 0.75);
            return (
              <div key={i} className={`kin-solo ${i % 2 && !last ? 'kin-outline' : ''} ${last ? 'kin-last' : ''}`} style={{ opacity: p * (1 - q), transform: `scale(${mix(1.5, 1, p) * mix(1, 0.9, q)})`, filter: `blur(${(1 - p) * 10}px)` }}>
                <Kinetic text={l} technique="trackIn" at={a} role="headline" fit={[last ? 17 : 22, 8, 2]} />
              </div>
            );
          })}
        </div>
      </Composition>
    );
  }
  return (
    <Composition>
      {lines.map((l, i) => (
        <div key={i} className={`kin-line ${i % 2 ? 'kin-alt' : ''}`} style={{ alignSelf: s.motion.align === 'center' ? 'center' : i % 2 ? 'flex-end' : 'flex-start' }}>
          <Kinetic text={l} technique={i % 2 ? 'slideAlternate' : s.motion.headline} at={i * d.pacing.groupStagger} role="headline" fit={[i === lines.length - 1 ? 13 : 17, 7, 2]} sound={i === lines.length - 1 ? 'impact' : 'click'} />
        </div>
      ))}
    </Composition>
  );
}

function LottieScene() {
  const s = useScene();
  const { data } = useEngine();
  const g = data.direction.pacing.groupStagger;
  const box = useEnter('scale', 0, 0.8, useExitAt());
  cue(`${s.key}:lottie`, s.tin + 0.05, 'pop');
  if (s.lottieName === 'confetti' || s.lottieName === 'sparkle') cue(`${s.key}:lottie2`, s.tin + 0.3, 'shimmer', 0.55);
  return (
    <Composition>
      {s.rive ? (
        <div style={box} className="lottie-wrap">
          <RiveBox src={s.rive} size={Math.round(Math.min(data.width, data.height) * 0.6)} className="lottie-box" />
        </div>
      ) : s.lottieKey ? (
        <div style={box} className="lottie-wrap">
          <LottieBox data={data.lotties[s.lottieKey]} loop={!!s.lottieLoop} className="lottie-box" />
        </div>
      ) : null}
      <Headline text={s.slots.title} at={g} fit={[11, 6, 3]} />
      <Support text={s.slots.sub} at={g * 2} />
    </Composition>
  );
}

function Showcase3d() {
  const s = useScene();
  const { data, horizontal } = useEngine();
  cue(`${s.key}:3d`, s.tin, 'softwhoosh', 0.8);
  return (
    <>
      {s.three ? <ThreeView cfg={s.three} width={data.width} height={data.height} horizontal={horizontal} /> : null}
      <Composition anchor={horizontal ? 'center-left' : 'bottom-left'} width={horizontal ? '42%' : '100%'}>
        <Headline text={s.slots.title} at={0.6} fit={[11, 6, 2]} />
        <Support text={s.slots.sub} at={0.9} />
      </Composition>
    </>
  );
}

export const SCENE_COMPONENTS: Record<string, () => ReactNode> = {
  hook: Hook,
  statement: Statement,
  product: Product,
  benefits: Benefits,
  stat: Stat,
  offer: Offer,
  quote: Quote,
  event: Event,
  gallery: Gallery,
  wordswap: Wordswap,
  cta: Cta,
  logo: Logo,
  footage: Footage,
  kinetic: KineticScene,
  lottie: LottieScene,
  showcase3d: Showcase3d,
};

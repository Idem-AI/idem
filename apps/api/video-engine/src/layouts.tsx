/**
 * LES MISES EN PAGE — quatorze archétypes de composition de motion design.
 *
 * Une scène de texte (accroche, affirmation, chiffre, avantages, offre, avis, appel,
 * événement, produit sans photo) n'est plus toujours « un bloc de texte à un ancrage » :
 * l'agent directeur artistique (serveur, video.layouts.ts) lui attribue l'une de ces
 * compositions, dans un menu que le graphe a filtré par la direction et la DA de la
 * charte. Chaque archétype :
 *
 *  - s'adapte à tous les formats (unités en centièmes du petit côté, `horizontal`) ;
 *  - a de la PROFONDEUR : au moins deux plans qui dérivent à des vitesses différentes ;
 *  - VIT pendant la tenue (dérive lente, rotation, défilement) au lieu de se figer ;
 *  - PULSE sur le temps de la musique (grille `data.beat`) quand il y en a une ;
 *  - déclare ses sons (cue) au moment exact de ses mouvements ;
 *  - ne pose ni transformation 3D ni clip-path sur un texte posé (déterminisme).
 *
 * Les couleurs viennent de la surface de la scène (charte) : --hl, --hl-ink, --ink, --soft.
 */
import { CSSProperties, ReactNode } from 'react';
import { cue } from './cues';
import { Timed, useEngine, useLocalTime, useScene } from './context';
import { Icon } from './kit/Icon';
import { ANCHOR_STYLE, Composition, useCamera, useEnter, useExitAt, useFamilyKind } from './layout';
import { ActionButton, Headline, Support, useHeadlineSound } from './scenes';
import { Kinetic, Odometer } from './text';
import { clamp, mix, progress } from './time';

// ─── Contenu générique d'une scène ──────────────────────────────────────────

interface Content {
  title?: string;
  sub?: string;
  items: string[];
  value?: string;
  oldPrice?: string;
  badge?: string;
  action?: string;
}

/** Les cases d'une scène, ramenées à des emplacements génériques (titre, sous-titre, éléments, valeur…). */
export function contentOf(s: Timed): Content {
  const sl = s.slots;
  switch (s.sceneId) {
    case 'stat':
      return { title: sl.value, value: sl.value, sub: sl.label, items: [] };
    case 'quote':
      return { title: sl.quote, sub: sl.author, items: [] };
    case 'cta':
      return { title: sl.title, sub: sl.contact, action: sl.action, items: [] };
    case 'benefits':
      return { title: sl.title, items: [sl.b1, sl.b2, sl.b3].filter(Boolean) as string[] };
    case 'offer':
      return { title: sl.price, value: sl.price, oldPrice: sl.oldPrice, badge: sl.badge, sub: sl.note, items: [] };
    case 'event':
      return { title: sl.title, items: [sl.date, sl.time, sl.place].filter(Boolean) as string[] };
    case 'product':
      return { title: sl.name, sub: sl.tagline, value: sl.price, items: [] };
    default:
      return { title: sl.title, sub: sl.sub, items: [] };
  }
}

// ─── Briques ────────────────────────────────────────────────────────────────

/**
 * Pulsation sur le temps de la musique : 1 sur le temps, puis décroissance rapide.
 * Sans grille de tempo (vidéo muette), rien ne pulse.
 */
export function useBeatPulse(): number {
  const { t, data } = useEngine();
  const b = data.beat;
  if (!b?.bpm || b.bpm < 40) return 0;
  const period = 60 / b.bpm;
  const phase = ((((t - (b.offset || 0)) % period) + period) % period) / period;
  return Math.exp(-phase * 7);
}

/** Avancement de la scène (0 → 1 sur toute sa visibilité) : la base des dérives lentes. */
export function useSceneProgress(): number {
  const { t } = useEngine();
  const s = useScene();
  return clamp((t - s.visFrom) / Math.max(0.1, s.span));
}

/** Sortie d'un élément graphique (accélération) quand la transition suivante ne couvre pas la scène. */
export function useExitFactor(): number {
  const { easeIn } = useEngine();
  const lt = useLocalTime();
  const exitAt = useExitAt();
  return exitAt == null ? 0 : easeIn(progress(lt, exitAt, 0.4));
}

/** Le mot à mettre en valeur : celui que l'agent a désigné, sinon le plus long des trois derniers. */
function emphasisOf(words: string[], chosen?: number): number {
  if (chosen != null && chosen >= 0 && chosen < words.length) return chosen;
  if (!words.length) return -1;
  let best = words.length - 1;
  for (let i = Math.max(0, words.length - 3); i < words.length; i++) {
    if (words[i].replace(/\W/g, '').length > words[best].replace(/\W/g, '').length) best = i;
  }
  return best;
}

/**
 * Découpe un titre en lignes d'affiche : les petits mots (« de », « la », « à ») restent
 * attachés au suivant, puis les paires les plus courtes fusionnent jusqu'au nombre de lignes voulu.
 */
export function stackLines(text: string, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const tokens: string[] = [];
  for (let i = 0; i < words.length; i++) {
    let w = words[i];
    while (w.replace(/\W/g, '').length <= 3 && i < words.length - 1) w = `${w} ${words[++i]}`;
    tokens.push(w);
  }
  while (tokens.length > maxLines) {
    let best = 0;
    for (let i = 1; i < tokens.length - 1; i++) if (tokens[i].length + tokens[i + 1].length < tokens[best].length + tokens[best + 1].length) best = i;
    tokens.splice(best, 2, `${tokens[best]} ${tokens[best + 1]}`);
  }
  return tokens;
}

/** Une étiquette pleine (couleur de la marque) qui entre en volet. */
export function LabelBlock({ text, at, className = '' }: { text?: string; at: number; className?: string }) {
  const s = useScene();
  const style = useEnter('wipeRight', at, 0.8, useExitAt());
  if (!text) return null;
  cue(`${s.key}:label`, s.start + at, 'softwhoosh', 0.5);
  return (
    <span className={`ly-label ${className}`} style={style}>
      <Kinetic text={text} technique="blurWords" at={at + 0.1} role="support" fit={[5.6, 3.4, 2]} style={{ fontWeight: 600, color: 'inherit' }} />
    </span>
  );
}

// ─── 1. Pile de mots (affiche typographique) ────────────────────────────────

function WordStack() {
  const s = useScene();
  const { data, horizontal } = useEngine();
  const c = contentOf(s);
  const exitAt = useExitAt();
  const pulse = useBeatPulse();
  const p = useSceneProgress();
  const sound = useHeadlineSound();
  const g = data.direction.pacing.groupStagger;
  const lines = stackLines(c.title || '', horizontal ? 3 : 4);
  // La ligne qui porte le mot mis en valeur (désigné par l'agent, sinon le plus porteur).
  const ew = emphasisOf((c.title || '').split(/\s+/).filter(Boolean), s.emphasis);
  let emph = lines.length - 1;
  for (let i = 0, n = 0; i < lines.length; n += lines[i].split(' ').length, i++) if (ew >= n && ew < n + lines[i].split(' ').length) emph = i;
  const align = s.motion.align === 'center' ? 'center' : 'flex-start';
  const camera = useCamera();
  return (
    <div className="safe" style={{ ...ANCHOR_STYLE[s.motion.anchor], ...camera }}>
      <div className="comp-block ly-stack" style={{ width: '100%', alignItems: align }}>
        {lines.map((line, i) => {
          const outline = lines.length > 2 && i % 2 === 1 && i !== emph;
          // Parallaxe : les lignes paires et impaires dérivent en sens contraire.
          const dx = (i % 2 ? -1 : 1) * mix(-1.4, 1.4, p);
          const beat = i === emph ? 1 + pulse * 0.025 : 1;
          return (
            <div key={i} className="ly-stack-line" style={{ transform: `translateX(${dx}%) scale(${beat})`, transformOrigin: align === 'center' ? '50% 50%' : '0% 50%' }}>
              <Kinetic
                text={line}
                technique={i % 2 ? 'slideAlternate' : s.motion.headline}
                at={0.05 + i * g * 0.55}
                role="headline"
                fit={[horizontal ? 19 : 30, 6, 1]}
                exitAt={exitAt}
                sound={i === 0 ? sound : i === lines.length - 1 ? 'click' : null}
                className={outline ? 'ly-outline' : i === emph ? 'ly-em' : ''}
              />
            </div>
          );
        })}
        {c.sub ? <Support text={c.sub} at={g * (lines.length * 0.55 + 0.8)} fit={[5.2, 3.4, 2]} /> : null}
        <ActionButton text={c.action} at={g * (lines.length * 0.55 + 1)} />
      </div>
    </div>
  );
}

// ─── 2. Mot géant qui défile derrière le titre ─────────────────────────────

function MarqueeBack() {
  const s = useScene();
  const { data, horizontal, u } = useEngine();
  const lt = useLocalTime();
  const c = contentOf(s);
  const g = data.direction.pacing.groupStagger;
  const words = (c.title || data.brandName).split(/\s+/).map((w) => w.replace(/[^\p{L}\p{N}'-]/gu, ''));
  const keyword = (words[emphasisOf(words, s.emphasis)] || data.brandName).toUpperCase();
  const rows = horizontal ? 2 : 3;
  const fade = clamp(progress(lt, 0, 0.6)) * (1 - useExitFactor());
  cue(`${s.key}:marquee`, s.start + 0.02, 'softwhoosh', 0.45);
  const line = Array.from({ length: 8 }, () => keyword).join(' · ');
  return (
    <>
      <div className="ly-marquee" style={{ opacity: fade }} aria-hidden>
        {Array.from({ length: rows }, (_, i) => {
          const dir = i % 2 ? 1 : -1;
          const x = (i % 2 ? -50 : 0) + dir * lt * 3.2;
          return (
            <div key={i} className="ly-marquee-row" style={{ top: `${((i + 0.5) / rows) * 100}%`, fontSize: u * (horizontal ? 24 : 21), transform: `translate(${x}%, -50%)` }}>
              {line}
            </div>
          );
        })}
      </div>
      <Composition>
        <Headline text={c.title} at={0.2} fit={horizontal ? [13, 7, 2] : [16, 7, 3]} emph={false} />
        <Support text={c.sub} at={g * 1.8} />
        <ActionButton text={c.action} at={g * 2} />
      </Composition>
    </>
  );
}

// ─── 3. Le chiffre géant qui remplit le cadre (jamais coupé : un chiffre rogné se lit mal) ─

function BigNumber() {
  const s = useScene();
  const { data, horizontal } = useEngine();
  const c = contentOf(s);
  const g = data.direction.pacing.groupStagger;
  const pulse = useBeatPulse();
  const p = useSceneProgress();
  const out = useExitFactor();
  const value = c.value || c.title || '';
  const digits = /\d/.test(value);
  const label = s.sceneId === 'offer' ? c.badge || c.sub : c.sub;
  const note = s.sceneId === 'offer' && c.badge ? c.sub : undefined;
  return (
    <>
      <div className="ly-bignum" style={{ opacity: 1 - out, transform: `translateX(${mix(0, -2.2, p)}%) scale(${1 + pulse * 0.012})` }}>
        {digits ? <Odometer text={value} at={0.1} dur={Math.min(1.6, s.duration * 0.45)} fit={[horizontal ? 52 : 64, 18, 1]} /> : <Kinetic text={value} technique="scaleBlur" at={0.1} role="headline" fit={[horizontal ? 46 : 58, 16, 1]} sound="impact" />}
      </div>
      <Composition anchor="top-left" gap={2.4} width={horizontal ? '48%' : '86%'}>
        {c.oldPrice ? <span className="old-price">{c.oldPrice}</span> : null}
        <LabelBlock text={label} at={g * 1.5} />
        <Support text={note} at={g * 2.4} fit={[4.6, 3.2, 2]} />
      </Composition>
    </>
  );
}

// ─── 4. Bandeau diagonal ────────────────────────────────────────────────────

function DiagonalBand() {
  const s = useScene();
  const { data, horizontal, ease } = useEngine();
  const lt = useLocalTime();
  const c = contentOf(s);
  const exitAt = useExitAt();
  const sound = useHeadlineSound();
  const g = data.direction.pacing.groupStagger;
  const p = useSceneProgress();
  const pulse = useBeatPulse();
  const out = useExitFactor();
  const compact = horizontal || data.format === 'square';
  const angle = (horizontal ? 5 : 8) * (s.index % 2 ? 1 : -1);
  const grow = ease(progress(lt, 0, data.direction.pacing.enter));
  const back = ease(progress(lt, g * 0.6, data.direction.pacing.enter));
  cue(`${s.key}:band`, s.start + 0.02, 'whoosh', 0.6);
  return (
    <>
      {/* Plan arrière : une bande fine, décalée, qui dérive en sens inverse et pulse sur le temps. */}
      <div className="ly-band ly-band-back" style={{ transform: `translateY(calc(-50% - var(--u) * ${compact ? 19 : 25})) translateX(${mix(2.5, -2.5, p)}%) rotate(${angle}deg) scaleY(${1 + pulse * 0.3})`, clipPath: back < 1 ? `inset(0 0 0 ${(1 - back) * 100}%)` : undefined, opacity: 1 - out }} />
      <div className="ly-band" style={{ transform: `translateY(-50%) translateX(${mix(-1.5, 1.5, p)}%) rotate(${angle}deg)`, clipPath: grow < 1 ? `inset(0 ${(1 - grow) * 100}% 0 0)` : undefined, opacity: 1 - out }}>
        <div className="ly-band-text">
          <Kinetic text={c.value && s.sceneId === 'offer' ? c.value : c.title || ''} technique={s.motion.headline} at={g * 0.7} role="headline" fit={compact ? [12, 6, 2] : [15, 6, 3]} exitAt={exitAt} sound={sound} style={{ color: 'var(--hl-ink)' }} />
        </div>
      </div>
      <Composition anchor="bottom-left" gap={2.4} width={horizontal ? '60%' : '100%'}>
        {c.oldPrice ? <span className="old-price">{c.oldPrice}</span> : null}
        {s.sceneId === 'offer' ? <LabelBlock text={c.badge} at={g * 1.8} /> : null}
        <Support text={c.sub} at={g * 2} />
        <ActionButton text={c.action} at={g * 2.2} />
      </Composition>
    </>
  );
}

// ─── 5. Le cercle de la marque ──────────────────────────────────────────────

function CircleStage() {
  const s = useScene();
  const { data, horizontal, back, u } = useEngine();
  const lt = useLocalTime();
  const c = contentOf(s);
  const g = data.direction.pacing.groupStagger;
  const pulse = useBeatPulse();
  const p = useSceneProgress();
  const out = useExitFactor();
  const k = back(progress(lt, 0, data.direction.pacing.enter * 1.1));
  // En colonne, le cercle laisse la place au texte : 42 % de la hauteur du cadre au plus. À
  // 64 unités sur un carré, cercle + titre sur deux lignes + sous-titre sortaient du cadre.
  const size = u * (horizontal ? 60 : Math.min(64, (data.height / u) * 0.42));
  cue(`${s.key}:circle`, s.start + 0.03, 'pop', 0.7);
  const inner = s.image ? (
    <img className="media-el" src={s.image} alt="" style={{ transform: `scale(${mix(1.15, 1.03, p)})` }} />
  ) : c.value ? (
    <div className="ly-circle-value">
      <Kinetic text={c.value} technique="scaleBlur" at={g * 0.6} role="headline" fit={[20, 7, 1]} style={{ color: 'var(--hl-ink)' }} />
    </div>
  ) : data.logo.icon ? (
    <img className="ly-circle-icon" src={data.logo.icon} alt="" />
  ) : null;
  const title = s.sceneId === 'stat' ? c.sub : c.title;
  return (
    <div className={`safe ly-circle-wrap ${horizontal ? 'ly-row' : 'ly-col'}`} style={useCamera()}>
      <div className="ly-circle-holder" style={{ width: size, height: size }}>
        <svg className="ly-ring" viewBox="0 0 100 100" style={{ transform: `rotate(${lt * 14}deg) scale(${mix(0.6, 1, clamp(k))})`, opacity: clamp(k) * (1 - out) }} aria-hidden>
          <circle cx="50" cy="50" r="48.5" fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 3.2" />
        </svg>
        <div className={`ly-circle ${s.image ? '' : c.value ? 'ly-circle-fill' : 'ly-circle-soft'}`} style={{ transform: `scale(${mix(0.2, 1, k) * (1 + pulse * 0.02)})`, opacity: clamp(k * 2) * (1 - out) }}>
          {inner}
        </div>
      </div>
      <div className="comp-block ly-circle-text" style={{ alignItems: horizontal ? 'flex-start' : 'center', textAlign: horizontal ? 'left' : 'center' }}>
        <Headline text={title} at={g * 0.9} fit={horizontal ? [10, 6, 3] : [12, 6, 3]} />
        <Support text={s.sceneId === 'stat' ? undefined : c.sub} at={g * 1.8} />
        <ActionButton text={c.action} at={g * 2} />
      </div>
    </div>
  );
}

// ─── 6. Deux blocs de couleur ───────────────────────────────────────────────

function SplitBlock() {
  const s = useScene();
  const { data, horizontal, ease } = useEngine();
  const lt = useLocalTime();
  const c = contentOf(s);
  const exitAt = useExitAt();
  const sound = useHeadlineSound();
  const g = data.direction.pacing.groupStagger;
  const p = useSceneProgress();
  const share = horizontal ? 48 : 46;
  const grow = ease(progress(lt, 0, data.direction.pacing.enter));
  const size = share * grow + mix(-0.8, 0.8, p);
  cue(`${s.key}:split`, s.start + 0.02, 'whoosh', 0.55);
  const blockStyle: CSSProperties = horizontal ? { left: 0, top: 0, bottom: 0, width: `${size}%` } : { left: 0, right: 0, top: 0, height: `${size}%` };
  const textA: CSSProperties = horizontal
    ? { left: 'var(--sx)', top: 'var(--st)', bottom: 'var(--sb)', width: `calc(${share}% - var(--sx) * 1.6)` }
    : { left: 'var(--sx)', right: 'var(--sx)', top: 'var(--st)', height: `calc(${share}% - var(--st) - var(--u) * 3)` };
  const textB: CSSProperties = horizontal
    ? { right: 'var(--sx)', top: 'var(--st)', bottom: 'var(--sb)', width: `calc(${100 - share}% - var(--sx) * 1.8)` }
    : { left: 'var(--sx)', right: 'var(--sx)', bottom: 'var(--sb)', height: `calc(${100 - share}% - var(--sb) - var(--u) * 3)` };
  const titleIsValue = s.sceneId === 'stat';
  return (
    <>
      <div className="ly-split-block" style={blockStyle} />
      <div className="ly-split-zone" style={{ ...textA, color: 'var(--hl-ink)' }}>
        {titleIsValue ? (
          <Odometer text={c.value || ''} at={g * 0.5} dur={Math.min(1.4, s.duration * 0.4)} fit={[horizontal ? 30 : 34, 10, 1]} />
        ) : (
          <Kinetic text={c.title || ''} technique={s.motion.headline} at={g * 0.6} role="headline" fit={horizontal ? [11, 5.5, 4] : [12, 5.5, 3]} exitAt={exitAt} sound={sound} style={{ color: 'var(--hl-ink)' }} />
        )}
      </div>
      <div className="ly-split-zone" style={textB}>
        {c.items.length ? (
          <ul className="ly-split-list">
            {c.items.map((it, i) => (
              <SplitItem key={i} text={it} icon={s.icons?.[i]} at={g * (1.4 + i * 0.8)} index={i} />
            ))}
          </ul>
        ) : (
          <>
            <Support text={c.sub} at={g * 1.6} fit={[6.4, 3.6, 4]} muted={false} />
            <ActionButton text={c.action} at={g * 2.2} />
          </>
        )}
      </div>
    </>
  );
}

function SplitItem({ text, icon, at, index }: { text: string; icon?: string; at: number; index: number }) {
  const s = useScene();
  const style = useEnter(useFamilyKind('slideLeft'), at, 0.8, useExitAt());
  cue(`${s.key}:split${index}`, s.start + at, 'click', 0.55);
  return (
    <li className="ly-split-item" style={style}>
      {icon ? <Icon svg={icon} className="size-9 text-hl-text" /> : <span className="ly-split-dot" />}
      <Kinetic text={text} technique="blurWords" at={at} role="support" fit={[6.2, 3.6, 2]} style={{ fontWeight: 600 }} />
    </li>
  );
}

// ─── 7. Cartes superposées ──────────────────────────────────────────────────

function LayeredCards() {
  const s = useScene();
  const { data, horizontal } = useEngine();
  const c = contentOf(s);
  const g = data.direction.pacing.groupStagger;
  const start = c.title ? g * 1.3 : 0.1;
  return (
    <Composition gap={4} width={horizontal ? '70%' : '100%'}>
      <Headline text={c.title} fit={horizontal ? [10, 6, 2] : [12, 6, 2]} />
      <div className="ly-cards">
        {c.items.map((it, i) => (
          <Card key={i} text={it} icon={s.icons?.[i]} at={start + i * g * 0.9} index={i} count={c.items.length} />
        ))}
      </div>
    </Composition>
  );
}

function Card({ text, icon, at, index, count }: { text: string; icon?: string; at: number; index: number; count: number }) {
  const s = useScene();
  const { data, back, u } = useEngine();
  const lt = useLocalTime();
  const out = useExitFactor();
  const k = back(progress(lt, at, data.direction.pacing.enter));
  cue(`${s.key}:card${index}`, s.start + at, 'pop', 0.6);
  const rot = [-2.2, 1.6, -1.1][index % 3];
  // Flottement continu, déphasé par carte : la pile respire.
  const float = Math.sin(lt * 1.5 + index * 1.9) * 0.45;
  const last = index === count - 1;
  return (
    <div
      className={`ly-card ${last ? 'ly-card-hl' : ''}`}
      style={{
        marginLeft: `${index * 5}%`,
        width: '86%',
        zIndex: index + 1,
        opacity: clamp(k * 2) * (1 - out),
        transform: `translateY(${(1 - k) * 14 * u + float * u}px) rotate(${mix(rot * 4, rot, k)}deg)`,
      }}
    >
      {icon ? <Icon svg={icon} className={`size-10 ${last ? 'text-current' : 'text-hl-text'}`} /> : null}
      <Kinetic text={text} technique="blurWords" at={at + 0.1} role="support" fit={[6.4, 3.6, 2]} style={{ fontWeight: 650, color: 'inherit' }} />
    </div>
  );
}

// ─── 8. Grille de cartes ────────────────────────────────────────────────────

function GridCards() {
  const s = useScene();
  const { data, horizontal } = useEngine();
  const lt = useLocalTime();
  const c = contentOf(s);
  const g = data.direction.pacing.groupStagger;
  const cells = c.items.length;
  // Le regard passe d'une case à l'autre pendant la tenue : une case « s'allume » à la fois.
  const allIn = g * (1 + cells * 0.7) + 0.4;
  const per = Math.max(0.6, (s.duration - allIn) / Math.max(1, cells));
  // Intensité continue (0 → 1 → 0) de chaque case, jamais un saut d'une image à l'autre.
  const glow = (i: number) => clamp(1 - Math.abs((lt - allIn - (i + 0.5) * per) / (per * 0.55)));
  const square = data.format === 'square';
  const sound = useHeadlineSound();
  return (
    <div className="safe" style={{ justifyContent: 'center', ...useCamera() }}>
      <div className={`comp-block ly-grid ${horizontal || square ? 'ly-grid-2' : 'ly-grid-1'}`}>
        <GridCell index={0} at={0.05} hl>
          <Kinetic text={c.title || ''} technique={s.motion.headline} at={0.15} role="headline" fit={[horizontal ? 8 : 9.5, 5, 3]} sound={sound} style={{ color: 'var(--hl-ink)' }} />
        </GridCell>
        {c.items.map((it, i) => (
          <GridCell key={i} index={i + 1} at={g * (1 + i * 0.7)} glow={glow(i)}>
            {s.icons?.[i] ? <Icon svg={s.icons[i]} className="size-9 text-hl-text" /> : null}
            <Kinetic text={it} technique="blurWords" at={g * (1 + i * 0.7) + 0.1} role="support" fit={[5.8, 3.4, 3]} style={{ fontWeight: 600 }} />
          </GridCell>
        ))}
      </div>
    </div>
  );
}

function GridCell({ children, index, at, hl, glow = 0 }: { children: ReactNode; index: number; at: number; hl?: boolean; glow?: number }) {
  const s = useScene();
  const { u } = useEngine();
  const style = useEnter(useFamilyKind('scale'), at, 0.75, useExitAt());
  if (index > 0) cue(`${s.key}:cell${index}`, s.start + at, 'click', 0.5);
  return (
    <div className={`ly-cell ${hl ? 'ly-cell-hl' : ''}`} style={{ ...style, translate: `0 ${-glow * 0.9 * u}px`, boxShadow: glow > 0 ? `inset 0 0 0 ${glow * 0.6 * u}px var(--hl)` : undefined }}>
      {children}
    </div>
  );
}

// ─── 9. Liste cochée ────────────────────────────────────────────────────────

function Checklist() {
  const s = useScene();
  const { data, horizontal, ease } = useEngine();
  const lt = useLocalTime();
  const c = contentOf(s);
  const g = data.direction.pacing.groupStagger;
  const start = c.title ? g * 1.3 : 0.1;
  const step = Math.max(g * 0.9, 0.35);
  const line = ease(progress(lt, start, step * Math.max(1, c.items.length - 1) + 0.3));
  return (
    <Composition gap={4} width={horizontal ? '66%' : '100%'}>
      <Headline text={c.title} fit={horizontal ? [10, 6, 2] : [12, 6, 2]} />
      <ul className="ly-checks">
        <span className="ly-check-line" style={{ transform: `scaleY(${line})` }} aria-hidden />
        {c.items.map((it, i) => (
          <CheckRow key={i} text={it} at={start + i * step} index={i} />
        ))}
      </ul>
    </Composition>
  );
}

function CheckRow({ text, at, index }: { text: string; at: number; index: number }) {
  const s = useScene();
  const { data, ease } = useEngine();
  const lt = useLocalTime();
  const out = useExitFactor();
  const ring = ease(progress(lt, at, data.direction.pacing.enter * 0.6));
  const tick = ease(progress(lt, at + data.direction.pacing.enter * 0.35, data.direction.pacing.enter * 0.5));
  cue(`${s.key}:check${index}`, s.start + at + data.direction.pacing.enter * 0.35, 'tick', 0.8);
  return (
    <li className="ly-check-row" style={{ opacity: 1 - out }}>
      <svg className="ly-check" viewBox="0 0 24 24" aria-hidden>
        <circle cx="12" cy="12" r="10.5" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - ring} />
        <path d="M7 12.5l3.2 3.2L17 9" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - tick} />
      </svg>
      <Kinetic text={text} technique="blurWords" at={at + 0.12} role="support" fit={[6.6, 3.6, 2]} style={{ fontWeight: 600 }} />
    </li>
  );
}

// ─── 10. La grande citation ─────────────────────────────────────────────────

function QuoteBig() {
  const s = useScene();
  const { data, horizontal, ease, u } = useEngine();
  const lt = useLocalTime();
  const c = contentOf(s);
  const exitAt = useExitAt();
  const g = data.direction.pacing.groupStagger;
  const p = useSceneProgress();
  const out = useExitFactor();
  const k = ease(progress(lt, 0, data.direction.pacing.enter * 1.2));
  const rule = ease(progress(lt, g * 2.6, data.direction.pacing.enter * 0.8));
  const author = useEnter('rise', g * 2.8, 0.8, exitAt);
  cue(`${s.key}:quote`, s.start + 0.02, 'softwhoosh', 0.6);
  return (
    <Composition gap={3} width={horizontal ? '72%' : '100%'}>
      <div className="ly-quote">
      <span className="ly-quote-mark" style={{ fontSize: u * (horizontal ? 30 : 40), opacity: k * 0.95 * (1 - out), transform: `translateY(${mix(4, -4, p)}%) scale(${mix(1.25, 1, k)})`, transformOrigin: '0% 0%' }} aria-hidden>
        “
      </span>
      <Kinetic text={c.title || ''} technique={s.motion.support === 'lineWipe' ? 'lineWipe' : 'blurWords'} at={0.3} role="support" fit={horizontal ? [8.4, 4.4, 4] : [9.6, 4.6, 5]} exitAt={exitAt} style={{ fontFamily: 'var(--f-display)', fontWeight: 500, lineHeight: 1.16, position: 'relative', zIndex: 1 }} />
      </div>
      {c.sub ? (
        <span className="ly-quote-author" style={author}>
          <span className="ly-quote-rule" style={{ transform: `scaleX(${rule})` }} />
          {c.sub}
        </span>
      ) : null}
    </Composition>
  );
}

// ─── 11. Le prix en étoile ──────────────────────────────────────────────────

function burstPath(points: number, inner: number): string {
  const pts: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : 50;
    const a = (Math.PI * i) / points - Math.PI / 2;
    pts.push(`${(50 + r * Math.cos(a)).toFixed(2)},${(50 + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
}
const BURST = burstPath(16, 42);

function PriceBurst() {
  const s = useScene();
  const { data, horizontal, back, u } = useEngine();
  const lt = useLocalTime();
  const c = contentOf(s);
  const g = data.direction.pacing.groupStagger;
  const pulse = useBeatPulse();
  const out = useExitFactor();
  const k = back(progress(lt, g * 0.4, data.direction.pacing.enter));
  const size = u * (horizontal ? 56 : 66);
  cue(`${s.key}:burst`, s.start + g * 0.4, 'impact', 0.7);
  const price = c.value || c.title || '';
  return (
    <div className={`safe ly-burst-wrap ${horizontal ? 'ly-row' : 'ly-col'}`} style={useCamera()}>
      <div className="ly-burst-holder" style={{ width: size, height: size, opacity: clamp(k * 2) * (1 - out), transform: `scale(${mix(0.3, 1, k) * (1 + pulse * 0.03)})` }}>
        <svg className="ly-burst" viewBox="0 0 100 100" style={{ transform: `rotate(${lt * 9}deg)` }} aria-hidden>
          <polygon points={BURST} />
        </svg>
        <div className="ly-burst-text">
          {c.oldPrice ? <span className="ly-burst-old">{c.oldPrice}</span> : null}
          <Kinetic text={price} technique="scaleBlur" at={g * 0.7} role="headline" fit={[17, 6, 1]} style={{ color: 'var(--hl-ink)' }} />
        </div>
      </div>
      <div className="comp-block" style={{ alignItems: horizontal ? 'flex-start' : 'center', textAlign: horizontal ? 'left' : 'center', gap: 'calc(var(--u) * 2.4)' }}>
        {s.sceneId === 'product' ? <Headline text={c.title} at={g * 1.2} fit={[11, 6, 2]} /> : <LabelBlock text={c.badge} at={g * 1.4} />}
        <Support text={c.sub} at={g * 2} fit={[5, 3.4, 2]} />
      </div>
    </div>
  );
}

// ─── 12. Bandeaux défilants ─────────────────────────────────────────────────

function Ticker() {
  const s = useScene();
  const { data, horizontal, u, ease } = useEngine();
  const lt = useLocalTime();
  const c = contentOf(s);
  const g = data.direction.pacing.groupStagger;
  const out = useExitFactor();
  const grow = ease(progress(lt, 0, data.direction.pacing.enter * 0.9));
  const phrase = [data.brandName, ...(c.items.length ? c.items : (c.title || '').split(/\s+/).filter((w) => w.length > 3).slice(0, 3))].join('  ✦  ').toUpperCase();
  const text = Array.from({ length: 10 }, () => phrase).join('  ✦  ');
  cue(`${s.key}:ticker`, s.start + 0.02, 'whoosh', 0.5);
  const band = (top: boolean) => (
    <div className={`ly-ticker ${top ? 'ly-ticker-top' : 'ly-ticker-bottom'}`} style={{ height: u * 7.5, fontSize: u * 3.6, clipPath: `inset(0 ${top ? (1 - grow) * 100 : 0}% 0 ${top ? 0 : (1 - grow) * 100}%)`, opacity: 1 - out }}>
      <div className="ly-ticker-run" style={{ transform: top ? `translateX(${-lt * 9 * u}px)` : `translateX(calc(-50% + ${lt * 9 * u}px))` }}>
        {text}
      </div>
    </div>
  );
  return (
    <>
      {band(true)}
      {band(false)}
      <Composition style={{ paddingTop: u * 10, paddingBottom: u * 10 }} width={horizontal ? '70%' : '100%'}>
        <Headline text={c.title} at={g * 0.6} fit={horizontal ? [13, 7, 2] : [15, 7, 3]} emph={!!data.kit?.annotateScene && data.kit.annotateScene === s.key} />
        <Support text={c.items.length ? undefined : c.sub} at={g * 1.8} />
        <ActionButton text={c.action} at={g * 2} />
      </Composition>
    </>
  );
}

// ─── 13. Le mot sous le projecteur ──────────────────────────────────────────

function SpotlightWord() {
  const s = useScene();
  const { data, horizontal } = useEngine();
  const c = contentOf(s);
  const exitAt = useExitAt();
  const g = data.direction.pacing.groupStagger;
  const p = useSceneProgress();
  const pulse = useBeatPulse();
  const words = (c.title || '').split(/\s+/).filter(Boolean);
  const word = (words[emphasisOf(words, s.emphasis)] || '').replace(/[.,;:!?]+$/, '');
  return (
    <>
      <div className="ly-spot" style={{ left: `${mix(42, 58, p)}%`, opacity: clamp(p * 6) * (0.85 + pulse * 0.15) }} aria-hidden />
      <div className="safe" style={{ justifyContent: 'space-between', alignItems: 'center', textAlign: 'center' }}>
        <div className="comp-block" style={{ width: horizontal ? '70%' : '100%', alignItems: 'center' }}>
          <Kinetic text={c.title || ''} technique="blurWords" at={0.05} role="support" fit={[6.4, 4, 3]} exitAt={exitAt} style={{ color: 'var(--muted)', fontWeight: 600 }} />
        </div>
        <div className="comp-block ly-spot-word" style={{ width: '100%', alignItems: 'center', transform: `scale(${1 + pulse * 0.02})` }}>
          <Kinetic text={word} technique="scaleBlur" at={g * 1.3} role="headline" fit={[horizontal ? 26 : 34, 9, 1]} exitAt={exitAt} sound="impact" style={{ color: 'var(--ink)' }} />
        </div>
        <div className="comp-block" style={{ width: '100%', alignItems: 'center' }}>
          <Support text={c.sub} at={g * 2.2} fit={[5, 3.4, 2]} />
          <ActionButton text={c.action} at={g * 2.2} />
        </div>
      </div>
    </>
  );
}

// ─── 14. Bloc et cadre décalés ──────────────────────────────────────────────

function FrameOverlap() {
  const s = useScene();
  const { data, horizontal, ease, u } = useEngine();
  const lt = useLocalTime();
  const c = contentOf(s);
  const exitAt = useExitAt();
  const g = data.direction.pacing.groupStagger;
  const p = useSceneProgress();
  const out = useExitFactor();
  const block = ease(progress(lt, 0, data.direction.pacing.enter));
  const frame = ease(progress(lt, g * 0.6, data.direction.pacing.enter * 1.2));
  cue(`${s.key}:frame`, s.start + 0.02, 'whoosh', 0.5);
  const shift = mix(-0.6, 0.6, p) * u;
  return (
    <Composition width={horizontal ? '64%' : '100%'}>
      <div className="ly-frame-wrap">
        <span className="ly-frame-line" style={{ transform: `translate(${u * 2.6 - shift}px, ${u * 2.6 - shift}px)`, clipPath: frame < 1 ? `inset(0 ${(1 - frame) * 100}% ${(1 - frame) * 100}% 0)` : undefined, opacity: 1 - out }} aria-hidden />
        <span className="ly-frame-block" style={{ transform: `translate(${shift}px, ${shift}px)`, clipPath: block < 1 ? `inset(0 ${(1 - block) * 100}% 0 0)` : undefined, opacity: 1 - out }} aria-hidden />
        <div className="ly-frame-text" style={{ transform: `translate(${shift}px, ${shift}px)` }}>
          <Kinetic text={c.title || ''} technique={s.motion.headline} at={g * 0.7} role="headline" fit={horizontal ? [11, 6, 3] : [13, 6, 4]} exitAt={exitAt} sound={useHeadlineSound()} style={{ color: 'var(--hl-ink)' }} />
          {c.sub ? <Kinetic text={c.sub} technique="blurWords" at={g * 1.8} role="support" fit={[5, 3.4, 2]} exitAt={exitAt} style={{ color: 'var(--hl-ink)', opacity: 0.86 }} /> : null}
        </div>
      </div>
      {s.sceneId === 'product' ? <LabelBlock text={c.value} at={g * 2.2} /> : null}
      <ActionButton text={c.action} at={g * 2.2} />
    </Composition>
  );
}

/** Les archétypes, par identifiant (le serveur n'attribue que ceux-ci). */
export const LAYOUT_COMPONENTS: Record<string, () => ReactNode> = {
  wordStack: WordStack,
  marqueeBack: MarqueeBack,
  bigNumber: BigNumber,
  diagonalBand: DiagonalBand,
  circleStage: CircleStage,
  splitBlock: SplitBlock,
  layeredCards: LayeredCards,
  gridCards: GridCards,
  checklist: Checklist,
  quoteBig: QuoteBig,
  priceBurst: PriceBurst,
  ticker: Ticker,
  spotlightWord: SpotlightWord,
  frameOverlap: FrameOverlap,
};

/** Scènes que les archétypes savent mettre en page (les autres gardent leur composant). */
export const LAYOUT_SCENES = new Set(['hook', 'statement', 'stat', 'benefits', 'offer', 'quote', 'cta', 'event', 'product']);

/** Le composant d'une scène : son archétype s'il en a un (et s'il s'applique), sinon le sien. */
export function layoutFor(s: Timed): (() => ReactNode) | undefined {
  if (!s.layout || s.layout === 'classic' || !LAYOUT_SCENES.has(s.sceneId)) return undefined;
  if (s.sceneId === 'product' && s.image) return s.layout === 'circleStage' ? LAYOUT_COMPONENTS.circleStage : undefined;
  return LAYOUT_COMPONENTS[s.layout];
}

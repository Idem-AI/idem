/**
 * LE CONTRÔLE CRÉATIF — après l'anti-réflexe (`lintMotion`) et les bonnes pratiques (`applyRules`).
 *
 * `lintMotion` interdit les tics d'une vidéo générée (même entrée partout, tout centré, même coupe).
 * Ce contrôle regarde plus large, film entier et projet entier :
 *
 *   récit          même structure narrative et même concept qu'une vidéo récente
 *   composition    la même forme sur trois scènes d'affilée, ou sur plus de 60 % du film
 *   mouvement      une entrée de titre sur plus de la moitié des scènes de texte
 *   coupes         une transition sur plus d'un tiers des coupes, ou deux fois de suite
 *   motifs         le même motif deux fois, ou moins de trois motifs distincts
 *   outils         un seul vocabulaire d'outils sur une vidéo de 15 s et plus
 *   tempo          des durées toutes égales alors que le rythme veut une courbe
 *   attention      une accroche molle, un plateau de trois scènes, une coupe faible avant le grand moment
 *   accent         une seule surprise, 30 % du film au plus
 *   empreinte      trop proche (< 0,30) de la vidéo la plus proche du projet
 *
 * Ce qui se répare sans modèle est réparé (coupes, entrées, mises en page, caméra, famille d'entrée),
 * toujours dans les menus que la direction et la DA admettent ; le reste est signalé. Une vidéo
 * n'est jamais rendue « différente partout » : on corrige jusqu'au seuil, pas au-delà.
 */
import { VideoStoryboard } from '../../../models/motionVideo.model';
import { DirectionId, DIRECTIONS, MotionTransition, TRANSITION_CATALOGUE } from './video.direction';
import { ExperienceMemory } from './video.experience';
import { CreativeFingerprint, fingerprintDistance, fingerprintOf, noveltyAgainst, SIMILARITY } from './video.fingerprint';
import { PATTERN_BY_ID } from './video.patterns';
import { ProjectMemory } from './video.planner';

export interface CreativeLintContext {
  direction: DirectionId;
  memory: ProjectMemory;
  /** Menu de transitions de la vidéo (direction + DA). */
  transitions: MotionTransition[];
  /** Mises en page valides d'une scène (menu du graphe, DA comprise). */
  layoutsFor?: (index: number) => string[];
  /** Caméras et familles d'entrée admises (menus du graphe). */
  cameras?: string[];
  entrances?: string[];
  experience?: ExperienceMemory;
  /** Réparer (pipeline des menus) ou seulement signaler (film d'auteur). */
  repair: boolean;
}

export interface CreativeLintReport {
  issues: string[];
  repaired: string[];
  fingerprint: CreativeFingerprint;
  novelty: ReturnType<typeof noveltyAgainst>;
}

const ENERGY_TECHNIQUES = new Set(['springUp', 'zoomWords', 'scatter', 'stretch', 'stackPush', 'flipChars', 'scramble', 'charCascade', 'skewIn', 'slideAlternate']);
const ENERGY_LAYOUTS = new Set(['wordStack', 'marqueeBack', 'ticker', 'bigNumber', 'diagonalBand', 'priceBurst', 'barCompare']);
const FEEL_ENERGY = { hard: 1, spatial: 0.9, graphic: 0.7, soft: 0.4 } as const;
const MEDIA = new Set(['footage', 'gallery', 'showcase3d', 'lottie', 'logo']);

/** L'énergie perçue de chaque scène : la coupe qui l'ouvre, l'entrée du titre, la mise en page, l'accent. */
export function attentionCurve(sb: VideoStoryboard): number[] {
  return sb.scenes.map((sc, i) => {
    const feel = sc.motion?.transition ? TRANSITION_CATALOGUE[sc.motion.transition as MotionTransition]?.feel : undefined;
    const cut = i === 0 ? 0.8 : feel ? FEEL_ENERGY[feel] : 0.5;
    const tech = sc.motion?.headline && ENERGY_TECHNIQUES.has(sc.motion.headline) ? 0.3 : 0.15;
    const layout = sc.layout && ENERGY_LAYOUTS.has(sc.layout) ? 0.3 : sc.video || sc.images?.length ? 0.25 : 0.15;
    const accent = sc.accent ? 0.4 : 0;
    const pace = sc.pace && sc.pace < 0.95 ? 0.1 : sc.pace && sc.pace > 1.05 ? -0.1 : 0;
    return Math.round((cut + tech + layout + accent + pace) * 100) / 100;
  });
}

export function creativeLint(sb: VideoStoryboard, ctx: CreativeLintContext): CreativeLintReport {
  const issues: string[] = [];
  const repaired: string[] = [];
  const scenes = sb.scenes;
  const d = DIRECTIONS[ctx.direction];
  const recent = ctx.memory.fingerprints;
  const coded = (i: number) => !!scenes[i]?.code?.tsx;
  const textIdx = scenes.map((sc, i) => i).filter((i) => !MEDIA.has(scenes[i].sceneId) && !coded(i));
  // Une mise en page de remplacement : jamais celle des voisines, chaque archétype une fois, la
  // composition de la direction sur un tiers des scènes au plus (mêmes règles que assignLayouts).
  const layoutFree = (l: string, at: number) => {
    if (l === scenes[at - 1]?.layout || l === scenes[at + 1]?.layout) return false;
    if (l !== 'classic') return !scenes.some((s, k) => k !== at && s.layout === l);
    const eligible = scenes.filter((s) => s.layout !== undefined).length;
    return scenes.filter((s, k) => k !== at && s.layout === 'classic').length < Math.max(1, Math.floor(eligible / 3));
  };

  // Récit : même structure et même concept qu'une vidéo récente.
  {
    const fp = fingerprintOf(sb);
    const twin = recent.slice(-3).findIndex((r) => r.narrative.join('>') === fp.narrative.join('>') && r.concept === fp.concept);
    if (twin >= 0) issues.push(`récit identique à une vidéo récente (${fp.narrative.join(' › ')})`);
  }

  // Mouvement : une entrée de titre sur plus de la moitié des scènes de texte.
  if (textIdx.length >= 4) {
    const count = new Map<string, number>();
    for (const i of textIdx) if (scenes[i].motion?.headline) count.set(scenes[i].motion!.headline, (count.get(scenes[i].motion!.headline) || 0) + 1);
    for (const [tech, n] of count) {
      if (n <= textIdx.length / 2) continue;
      issues.push(`entrée « ${tech} » sur ${n} scènes de texte sur ${textIdx.length}`);
      if (!ctx.repair) continue;
      let excess = n - Math.floor(textIdx.length / 2);
      for (const i of textIdx) {
        if (excess <= 0) break;
        const m = scenes[i].motion;
        if (!m || m.headline !== tech || i === textIdx[0]) continue;
        const alt = d.headline.find((h) => h !== tech && h !== scenes[i - 1]?.motion?.headline && h !== scenes[i + 1]?.motion?.headline);
        if (!alt) continue;
        scenes[i].motion = { ...m, headline: alt };
        repaired.push(`scène ${i + 1} : entrée ${tech} → ${alt}`);
        excess--;
      }
    }
  }

  // Coupes : une transition sur plus d'un tiers des coupes (au moins 4 coupes).
  {
    const cuts = scenes.map((sc, i) => (i > 0 && !coded(i) && !coded(i - 1) ? sc.motion?.transition : undefined));
    const real = cuts.filter(Boolean) as string[];
    const cap = Math.max(1, Math.ceil(real.length / 3));
    const count = new Map<string, number>();
    real.forEach((t) => count.set(t, (count.get(t) || 0) + 1));
    for (const [t, n] of count) {
      if (real.length < 4 || n <= cap) continue;
      issues.push(`coupe « ${t} » sur ${n} coupes sur ${real.length}`);
      if (!ctx.repair) continue;
      let excess = n - cap;
      for (let i = scenes.length - 2; i >= 1 && excess > 0; i--) {
        const m = scenes[i].motion;
        if (!m || cuts[i] !== t || scenes[i].sceneId === 'logo') continue;
        const alt = ctx.transitions.find((x) => x !== t && x !== scenes[i - 1]?.motion?.transition && x !== scenes[i + 1]?.motion?.transition && (count.get(x) || 0) < cap);
        if (!alt) continue;
        scenes[i].motion = { ...m, transition: alt };
        count.set(alt, (count.get(alt) || 0) + 1);
        repaired.push(`scène ${i + 1} : coupe ${t} → ${alt}`);
        excess--;
      }
    }
  }

  // Composition : la même forme sur trois scènes de suite, ou sur plus de 60 % du film.
  {
    const fp = fingerprintOf(sb);
    const comp = fp.composition;
    for (let i = 2; i < comp.length; i++) {
      if (comp[i] !== comp[i - 1] || comp[i] !== comp[i - 2] || MEDIA.has(scenes[i].sceneId)) continue;
      issues.push(`même composition « ${comp[i]} » sur trois scènes (${i - 1} à ${i + 1})`);
      if (ctx.repair && ctx.layoutsFor && scenes[i - 1].layout !== undefined) {
        const mid = i - 1;
        const alt = ctx.layoutsFor(mid).find((l) => l !== scenes[mid].layout && layoutFree(l, mid));
        if (alt) {
          repaired.push(`scène ${mid + 1} : mise en page ${scenes[mid].layout || 'classic'} → ${alt}`);
          scenes[mid].layout = alt;
          scenes[mid].pattern = undefined;
        }
      }
    }
    const content = comp.filter((_, i) => !MEDIA.has(scenes[i].sceneId));
    if (content.length >= 4) {
      const top = [...new Set(content)].map((c) => ({ c, n: content.filter((x) => x === c).length })).sort((a, b) => b.n - a.n)[0];
      if (top && top.n / content.length > 0.6) issues.push(`composition « ${top.c} » sur ${top.n} scènes sur ${content.length}`);
    }
  }

  // Motifs : variés à l'intérieur du film.
  {
    const ids = scenes.map((sc) => sc.pattern).filter((p): p is string => !!p && !PATTERN_BY_ID.get(p)?.generic);
    const twice = ids.filter((p, k) => ids.indexOf(p) !== k);
    if (twice.length) issues.push(`motif répété dans le film : ${[...new Set(twice)].join(', ')}`);
    const contentCount = scenes.filter((sc) => !MEDIA.has(sc.sceneId)).length;
    if (contentCount >= 3 && new Set(scenes.map((sc) => sc.pattern).filter(Boolean)).size < Math.min(3, contentCount)) issues.push('moins de trois motifs distincts');
  }

  // Outils : une vidéo de 15 s et plus mélange au moins deux vocabulaires.
  {
    const fp = fingerprintOf(sb);
    if (sb.durationSec >= 15 && fp.tools.length < 2) issues.push(`un seul vocabulaire d'outils (${fp.tools.join(', ')})`);
  }

  // Tempo : une courbe voulue par le rythme, pas des durées toutes égales.
  {
    const durs = scenes.filter((sc) => sc.sceneId !== 'logo').map((sc) => sc.duration);
    if (durs.length >= 4 && sb.rhythm && sb.rhythm !== 'steady') {
      const mean = durs.reduce((s, x) => s + x, 0) / durs.length;
      const cv = Math.sqrt(durs.reduce((s, x) => s + (x - mean) ** 2, 0) / durs.length) / mean;
      if (cv < 0.06) issues.push(`tempo uniforme (rythme ${sb.rhythm}, écart des durées ${Math.round(cv * 100)} %)`);
    }
  }

  // Attention : accroche, plateau, coupe avant le grand moment.
  {
    const e = attentionCurve(sb);
    const content = e.map((v, i) => ({ v, i })).filter(({ i }) => scenes[i].sceneId !== 'logo');
    const max = Math.max(...e);
    const sorted = [...content.map((c) => c.v)].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] || 0;
    if (content.length >= 3 && e[0] < median - 0.05) issues.push('accroche moins énergique que le reste du film');
    for (let k = 2; k < content.length; k++) {
      if ([content[k], content[k - 1], content[k - 2]].every((c) => c.v < max * 0.6)) {
        issues.push(`plateau d'attention (scènes ${content[k - 2].i + 1} à ${content[k].i + 1})`);
        break;
      }
    }
    const a = scenes.findIndex((sc) => !!sc.accent);
    if (a > 0 && !coded(a) && !coded(a - 1)) {
      const into = scenes[a].motion?.transition as MotionTransition | undefined;
      const feel = into ? TRANSITION_CATALOGUE[into]?.feel : undefined;
      if (feel === 'soft') {
        issues.push(`coupe douce avant le grand moment (scène ${a + 1})`);
        if (ctx.repair && scenes[a].motion) {
          const prev = scenes[a - 1]?.motion?.transition;
          const strong = ctx.transitions
            .filter((t) => ['hard', 'spatial'].includes(TRANSITION_CATALOGUE[t].feel) && t !== prev && t !== scenes[a + 1]?.motion?.transition)
            .map((t) => ({ t, q: ctx.experience?.comboQuality(scenes[a].pattern || '', t, ctx.direction) ?? 0.5 }))
            .sort((x, y) => y.q - x.q)[0]?.t;
          if (strong) {
            scenes[a].motion = { ...scenes[a].motion!, transition: strong };
            repaired.push(`scène ${a + 1} : coupe ${into} → ${strong} (grand moment)`);
          }
        }
      }
    }
  }

  // Accent créatif : une seule surprise, 30 % du film au plus.
  if (sb.creative?.accent) {
    const share = 1 / Math.max(1, scenes.length);
    if (share > 0.3) issues.push(`accent créatif sur ${Math.round(share * 100)} % du film`);
  }

  // Empreinte : trop proche de la vidéo la plus proche du projet → on écarte, jusqu'au seuil.
  let fp = fingerprintOf(sb);
  let novelty = noveltyAgainst(fp, recent);
  if (novelty.verdict === 'too-close' && ctx.repair) {
    const near = recent[novelty.index];
    const goal = SIMILARITY.tooClose + 0.02;
    const steps: (() => string | null)[] = [
      // 1. Les coupes que la vidéo proche n'avait pas.
      () => {
        const fresh = ctx.transitions.filter((t) => !near.transitions.includes(t));
        let changed = 0;
        scenes.forEach((sc, i) => {
          if (i === 0 || !sc.motion || coded(i) || sc.sceneId === 'logo' || !near.transitions.includes(sc.motion.transition || '')) return;
          const alt = fresh.find((t) => t !== scenes[i - 1]?.motion?.transition && t !== scenes[i + 1]?.motion?.transition);
          if (alt) {
            sc.motion = { ...sc.motion, transition: alt };
            changed++;
          }
        });
        return changed ? `${changed} coupe(s) changée(s)` : null;
      },
      // 2. Les entrées de titre.
      () => {
        const fresh = d.headline.filter((h) => !near.motion.includes(h));
        let changed = 0;
        for (const i of textIdx) {
          const m = scenes[i].motion;
          if (!m || !near.motion.includes(m.headline)) continue;
          const alt = fresh.find((h) => h !== scenes[i - 1]?.motion?.headline && h !== scenes[i + 1]?.motion?.headline);
          if (alt) {
            scenes[i].motion = { ...m, headline: alt };
            changed++;
          }
        }
        return changed ? `${changed} entrée(s) de titre changée(s)` : null;
      },
      // 3. La caméra et la famille d'entrée des éléments.
      () => {
        if (!sb.kit) return null;
        const out: string[] = [];
        const cam = (ctx.cameras || []).find((c) => c !== near.camera && c !== sb.kit!.camera);
        if (cam && sb.kit.camera === near.camera) {
          out.push(`caméra ${sb.kit.camera} → ${cam}`);
          sb.kit = { ...sb.kit, camera: cam };
        }
        const ent = (ctx.entrances || []).find((c) => c !== near.entrance && c !== sb.kit!.entrance);
        if (ent && sb.kit.entrance === near.entrance) {
          out.push(`entrées ${sb.kit.entrance} → ${ent}`);
          sb.kit = { ...sb.kit, entrance: ent };
        }
        return out.length ? out.join(', ') : null;
      },
      // 4. Les mises en page que la vidéo proche avait.
      () => {
        if (!ctx.layoutsFor) return null;
        let changed = 0;
        scenes.forEach((sc, i) => {
          if (!sc.layout || coded(i) || !near.layouts.includes(sc.layout)) return;
          const alt = ctx.layoutsFor!(i).find((l) => !near.layouts.includes(l) && layoutFree(l, i));
          if (alt) {
            sc.layout = alt;
            sc.pattern = undefined;
            changed++;
          }
        });
        return changed ? `${changed} mise(s) en page changée(s)` : null;
      },
    ];
    issues.push(`trop proche d'une vidéo récente du projet (distance ${novelty.nearest})`);
    for (const step of steps) {
      const what = step();
      if (!what) continue;
      fp = fingerprintOf(sb);
      const after = fingerprintDistance(fp, near).distance;
      repaired.push(`écart : ${what} (${novelty.nearest} → ${after})`);
      novelty = noveltyAgainst(fp, recent);
      if (novelty.verdict !== 'too-close' || after >= goal) break;
    }
  }
  return { issues, repaired, fingerprint: fp, novelty };
}

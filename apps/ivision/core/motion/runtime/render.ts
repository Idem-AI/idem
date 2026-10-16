/**
 * Le pilote du RENDU serveur : la page expose `window.__IDEM_RENDER__`, que Puppeteer appelle.
 *
 *   init(from)   polices chargées, film calculé (erreurs et effets sonores connus), lecture placée à `from` ;
 *   step()       rend l'image courante, la rend en JPEG (base64), puis avance d'une image ;
 *   still(f)     l'image `f` seule (vignettes des scènes, contrôle technique) ;
 *   layout(f)    les boîtes RÉELLES des textes visibles à l'image `f` (contrôle d'affichage : coupé, chevauché).
 */
import { Circle, Img, Line, Path, Polygon, Rect, Txt, Video } from '@motion-canvas/2d';
import { PlaybackState } from '@motion-canvas/core';
import { FilmEngine, loadFonts } from './engine';
import type { AuthorScene } from './harness';
import type { FilmData } from './film-data';

export function startRender(modules: Record<string, AuthorScene | undefined>, data: FilmData): void {
  let engine: FilmEngine | null = null;
  const api = {
    async init(from = 0) {
      await loadFonts(data.fontFamilies);
      engine = new FilmEngine(modules, data);
      await engine.init(PlaybackState.Rendering);
      if (from > 0) await engine.seek(from);
      return { frames: engine.frames, errors: engine.errorList(), cues: engine.cueList() };
    },
    async step(quality = 0.92) {
      if (!engine) throw new Error('not_initialized');
      await engine.draw();
      const data64 = engine.canvas.toDataURL('image/jpeg', quality).slice('data:image/jpeg;base64,'.length);
      const frame = engine.frame;
      const done = engine.finished || frame >= engine.frames - 1;
      if (!done) await engine.next();
      return { data: data64, frame, done };
    },
    async still(frame: number, quality = 0.85) {
      if (!engine) throw new Error('not_initialized');
      await engine.replay(frame);
      await engine.draw();
      return { data: engine.canvas.toDataURL('image/jpeg', quality).slice('data:image/jpeg;base64,'.length), errors: engine.errorList() };
    },
    async layout(frame: number) {
      if (!engine) throw new Error('not_initialized');
      await engine.replay(frame);
      await engine.draw();
      const scene = engine.playback.currentScene as unknown as { getView?: () => any } | null;
      const view = scene?.getView?.();
      if (!view) return { texts: [], shapes: [] };
      const toView: DOMMatrix = view.worldToLocal();
      const box = (n: any) => {
        const size = n.computedSize ? n.computedSize() : n.size?.();
        if (!size || !(size.x >= 1 && size.y >= 1)) return null;
        // La matrice locale → monde de Motion Canvas inclut déjà le décalage d'ancrage (offset) : la boîte locale est centrée.
        const x0 = -size.x / 2;
        const y0 = -size.y / 2;
        const m = toView.multiply(n.localToWorld());
        const pts = [[x0, y0], [x0 + size.x, y0], [x0, y0 + size.y], [x0 + size.x, y0 + size.y]].map(([x, y]) => m.transformPoint(new DOMPoint(x, y)));
        return { x0: Math.min(...pts.map((p) => p.x)), y0: Math.min(...pts.map((p) => p.y)), x1: Math.max(...pts.map((p) => p.x)), y1: Math.max(...pts.map((p) => p.y)) };
      };
      /** La boîte d'un tracé (ligne, chemin) : celle de ses points, pas une boîte centrée. */
      const curveBox = (n: any) => {
        const bb = n.cacheBBox();
        if (!bb || !(bb.width > 0 || bb.height > 0)) return null;
        const m = toView.multiply(n.localToWorld());
        const pts = [[bb.x, bb.y], [bb.x + bb.width, bb.y], [bb.x, bb.y + bb.height], [bb.x + bb.width, bb.y + bb.height]].map(([x, y]) => m.transformPoint(new DOMPoint(x, y)));
        return { x0: Math.min(...pts.map((p) => p.x)), y0: Math.min(...pts.map((p) => p.y)), x1: Math.max(...pts.map((p) => p.x)), y1: Math.max(...pts.map((p) => p.y)) };
      };
      type B = { x0: number; y0: number; x1: number; y1: number };
      /** Ce qui est visible d'une forme dans un masque (parent `clip`) : une photo recadrée ne compte que pour sa partie visible. */
      const within = (b: B | null, clip: B | null): B | null => {
        if (!b) return null;
        if (!clip) return b;
        const r = { x0: Math.max(b.x0, clip.x0), y0: Math.max(b.y0, clip.y0), x1: Math.min(b.x1, clip.x1), y1: Math.min(b.y1, clip.y1) };
        return r.x1 > r.x0 && r.y1 > r.y0 ? r : null;
      };
      const alphaOf = (c: any) => (c && typeof c.alpha === 'function' ? c.alpha() : c ? 1 : 0);
      // Tout ce qui se dessine, DANS L'ORDRE DE DESSIN de Motion Canvas (enfants triés par zIndex) : un texte peut
      // alors savoir quelles formes passent par-dessus lui.
      const texts: { text: string; x0: number; y0: number; x1: number; y1: number; group: string; order: number; ink?: number[]; contrast?: number; bg?: number[]; best?: string; bestContrast?: number }[] = [];
      const shapes: { kind: 'fill' | 'image' | 'line' | 'outline'; x0: number; y0: number; x1: number; y1: number; order: number; segs?: number[][] }[] = [];
      let order = 0;
      const walk = (n: any, harness: boolean, clip: B | null) => {
        const inHarness = harness || (n.zIndex?.() ?? 0) >= 1000;
        const visible = (n.absoluteOpacity?.() ?? 1) >= 0.35;
        if (!inHarness && visible) {
          if (n instanceof Txt) {
            const value = String(n.text() ?? '').trim();
            const b = value ? box(n) : null;
            const fill: any = (n as any).fill();
            const ink = fill && typeof fill.rgb === 'function' ? (fill.rgb() as number[]) : undefined;
            if (b) texts.push({ text: value.slice(0, 90), ...b, group: /^idem-split/.test(String(n.parent()?.key ?? '')) ? String(n.parent()!.key) : '', order: order++, ...(ink ? { ink } : {}) });
            return;
          }
          if (n instanceof Img || n instanceof Video) {
            const b = within(box(n), clip);
            if (b) shapes.push({ kind: 'image', ...b, order: order++ });
          } else if (n instanceof Line || n instanceof Path) {
            const b = within(curveBox(n), clip);
            const drawn = (n.end?.() ?? 1) - (n.start?.() ?? 0) > 0.2;
            // Les segments réels d'une ligne (diagonales comprises) : un trait qui traverse un texte se mesure sur eux.
            let segs: number[][] | undefined;
            if (n instanceof Line && drawn) {
              try {
                const m = toView.multiply(n.localToWorld());
                const pts = (n.parsedPoints?.() || []).map((p: any) => m.transformPoint(new DOMPoint(p.x, p.y)));
                segs = pts.slice(1).map((p: DOMPoint, k: number) => [pts[k].x, pts[k].y, p.x, p.y]);
              } catch {
                segs = undefined;
              }
            }
            if (b && alphaOf(n.fill()) > 0.5) shapes.push({ kind: 'fill', ...b, order: order++ });
            else if (b && alphaOf(n.stroke()) > 0.3 && n.lineWidth() > 0 && drawn) shapes.push({ kind: 'line', ...b, order: order++, ...(segs?.length ? { segs } : {}) });
          } else if (n instanceof Rect || n instanceof Circle || n instanceof Polygon) {
            const b = within(box(n), clip);
            if (b && alphaOf(n.fill()) > 0.5) shapes.push({ kind: 'fill', ...b, order: order++ });
            // Un contour seul (cadre, anneau) : un texte à cheval sur lui est coupé par le trait.
            else if (b && alphaOf(n.stroke()) > 0.3 && n.lineWidth() > 0) shapes.push({ kind: 'outline', ...b, order: order++ });
          }
        }
        const kids = typeof n.sortedChildren === 'function' ? n.sortedChildren() : n.children?.() || [];
        const childClip = typeof n.clip === 'function' && n.clip() ? within(box(n), clip) : clip;
        for (const k of kids) walk(k, inHarness, childClip);
      };
      for (const k of view.children()) walk(k, false, null);
      // LE CONTRASTE RÉEL : la couleur du fond est lue sur l'image rendue, juste autour de chaque texte (hors des autres
      // textes) ; on garde le contraste du 30e centile — un texte à moitié posé sur sa propre couleur ne se lit pas.
      try {
        const canvas = engine.canvas;
        const ctx2d = canvas.getContext('2d');
        const scale = canvas.width / data.width;
        const img = ctx2d ? ctx2d.getImageData(0, 0, canvas.width, canvas.height) : null;
        const lum = (c: number[]) => {
          const f = (v: number) => {
            const x = v / 255;
            return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
          };
          return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
        };
        const ratio = (a: number[], b: number[]) => {
          const la = lum(a), lb = lum(b);
          return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
        };
        if (img) {
          for (const t of texts) {
            if (!t.ink) continue;
            const w = t.x1 - t.x0, h = t.y1 - t.y0;
            const pts: [number, number][] = [];
            for (let k = 0; k <= 10; k++) {
              const x = t.x0 + (w * k) / 10;
              pts.push([x, t.y0 - Math.max(3, h * 0.08)], [x, t.y1 + Math.max(3, h * 0.08)]);
            }
            for (let k = 0; k <= 4; k++) {
              const y = t.y0 + (h * k) / 4;
              pts.push([t.x0 - Math.max(3, h * 0.25), y], [t.x1 + Math.max(3, h * 0.25), y]);
            }
            const values: number[] = [];
            const colors: number[][] = [];
            for (const [x, y] of pts) {
              if (texts.some((o) => o !== t && x >= o.x0 - 2 && x <= o.x1 + 2 && y >= o.y0 - 2 && y <= o.y1 + 2)) continue;
              const px = Math.round((x + data.width / 2) * scale);
              const py = Math.round((y + data.height / 2) * scale);
              if (px < 0 || py < 0 || px >= img.width || py >= img.height) continue;
              const i = (py * img.width + px) * 4;
              const c = [img.data[i], img.data[i + 1], img.data[i + 2]];
              values.push(ratio(t.ink, c));
              colors.push(c);
            }
            if (values.length >= 6) {
              const order2 = values.map((v, k) => ({ v, c: colors[k] })).sort((a, b) => a.v - b.v);
              const q = order2[Math.floor(order2.length * 0.3)];
              t.contrast = Math.round(q.v * 100) / 100;
              // La couleur du fond là où le texte se lit le moins bien : elle sert au dernier recours (encre lisible).
              t.bg = q.c;
              // L'encre claire ou foncée qui se lirait le mieux sur TOUT ce pourtour (30e centile) : sur un fond mixte
              // (moitié clair, moitié sombre), aucune ne suffit et le dernier recours sera un aplat.
              const p30 = (ink: number[]) => {
                const v = colors.map((c) => ratio(ink, c)).sort((a, b) => a - b);
                return v[Math.floor(v.length * 0.3)];
              };
              const light = p30([255, 255, 255]);
              const dark = p30([17, 20, 24]);
              t.best = light >= dark ? '#ffffff' : '#111418';
              t.bestContrast = Math.round(Math.max(light, dark) * 100) / 100;
            }
          }
        }
      } catch {
        // une page sans accès aux pixels : pas de mesure de contraste (le reste du contrôle vaut)
      }
      return { texts, shapes };
    },
    errors: () => engine?.errorList() ?? [],
    cues: () => engine?.cueList() ?? [],
  };
  (window as unknown as { __IDEM_RENDER__: typeof api }).__IDEM_RENDER__ = api;
}

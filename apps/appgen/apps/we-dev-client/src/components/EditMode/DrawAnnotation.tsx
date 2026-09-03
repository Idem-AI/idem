import { useCallback, useEffect, useRef, useState } from 'react';
import { Pencil, ArrowUpRight, Square, Circle, Eraser, Send, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export type AnnotationShape = 'free' | 'arrow' | 'rect' | 'ellipse';

export interface Annotation {
  /** Capture PNG du calque d'annotation, en data URI. */
  image: string;
  /** Ce que l'utilisateur demande, en langage naturel. */
  note: string;
  /** Boîte englobante des tracés, en fraction de la surface d'aperçu. */
  bounds: { x: number; y: number; width: number; height: number };
}

interface Stroke {
  shape: AnnotationShape;
  points: Array<{ x: number; y: number }>;
}

const STROKE_COLOR = '#e11d48';
const STROKE_WIDTH = 3;

/**
 * Calque d'annotation posé sur l'aperçu.
 *
 * Décrire un déplacement par écrit (« remonte le bouton au-dessus du titre,
 * mais aligné à droite ») est laborieux et ambigu ; un trait le dit d'un geste.
 * Le calque produit une image et une note, transmises ensemble au modèle.
 *
 * Les tracés à main levée sont conservés tels quels ; les flèches, rectangles
 * et ellipses sont redressés à partir des deux points extrêmes, pour qu'un
 * geste approximatif donne une forme nette.
 */
export function DrawAnnotation({
  onSubmit,
  onCancel,
}: {
  onSubmit: (annotation: Annotation) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const [shape, setShape] = useState<AnnotationShape>('free');
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [note, setNote] = useState('');
  const drawing = useRef<Stroke | null>(null);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = STROKE_COLOR;
    context.fillStyle = STROKE_COLOR;
    context.lineWidth = STROKE_WIDTH;
    context.lineCap = 'round';
    context.lineJoin = 'round';

    const all = drawing.current ? [...strokes, drawing.current] : strokes;
    for (const stroke of all) {
      drawStroke(context, stroke);
    }
  }, [strokes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;

    const resize = () => {
      const rect = host.getBoundingClientRect();
      // Le canvas est dimensionné en pixels physiques : sans le ratio de
      // l'écran, les traits sortent flous sur un écran Retina.
      const ratio = window.devicePixelRatio || 1;
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      canvas.getContext('2d')?.scale(ratio, ratio);
      redraw();
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    return () => observer.disconnect();
  }, [redraw]);

  useEffect(redraw, [redraw]);

  const pointFrom = (event: React.PointerEvent) => {
    const rect = hostRef.current!.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const onPointerDown = (event: React.PointerEvent) => {
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    drawing.current = { shape, points: [pointFrom(event)] };
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!drawing.current) return;
    const point = pointFrom(event);
    if (drawing.current.shape === 'free') {
      drawing.current.points.push(point);
    } else {
      // Les formes géométriques ne retiennent que départ et arrivée.
      drawing.current.points[1] = point;
    }
    redraw();
  };

  const onPointerUp = () => {
    const stroke = drawing.current;
    drawing.current = null;
    if (!stroke || stroke.points.length < 2) {
      redraw();
      return;
    }
    setStrokes((current) => [...current, stroke]);
  };

  const submit = () => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host || !strokes.length) return;

    const rect = host.getBoundingClientRect();
    const xs = strokes.flatMap((s) => s.points.map((p) => p.x));
    const ys = strokes.flatMap((s) => s.points.map((p) => p.y));
    const pad = 16;
    const minX = Math.max(0, Math.min(...xs) - pad);
    const minY = Math.max(0, Math.min(...ys) - pad);
    const maxX = Math.min(rect.width, Math.max(...xs) + pad);
    const maxY = Math.min(rect.height, Math.max(...ys) + pad);

    onSubmit({
      image: canvas.toDataURL('image/png'),
      note: note.trim(),
      bounds: {
        x: minX / rect.width,
        y: minY / rect.height,
        width: (maxX - minX) / rect.width,
        height: (maxY - minY) / rect.height,
      },
    });
  };

  const shapes: Array<{ id: AnnotationShape; icon: React.ReactNode; label: string }> = [
    { id: 'free', icon: <Pencil className="w-4 h-4" />, label: t('draw.free') },
    { id: 'arrow', icon: <ArrowUpRight className="w-4 h-4" />, label: t('draw.arrow') },
    { id: 'rect', icon: <Square className="w-4 h-4" />, label: t('draw.rect') },
    { id: 'ellipse', icon: <Circle className="w-4 h-4" />, label: t('draw.ellipse') },
  ];

  return (
    <div ref={hostRef} className="absolute inset-0 z-20">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 cursor-crosshair touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />

      <div className="absolute left-1/2 -translate-x-1/2 bottom-4 w-[min(560px,92%)] glass rounded-xl shadow-[var(--glass-shadow-lg)] p-2 flex flex-col gap-2">
        <div className="flex items-center gap-1">
          {shapes.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setShape(item.id)}
              aria-pressed={shape === item.id}
              title={item.label}
              className={`w-8 h-8 grid place-items-center rounded-lg transition-colors ${
                shape === item.id
                  ? 'bg-primary text-white'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-3'
              }`}
            >
              {item.icon}
            </button>
          ))}

          <div className="w-px h-5 bg-[var(--glass-border)] mx-1" />

          <button
            type="button"
            onClick={() => setStrokes([])}
            disabled={!strokes.length}
            title={t('draw.clear')}
            aria-label={t('draw.clear')}
            className="w-8 h-8 grid place-items-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-3 disabled:opacity-30 transition-colors"
          >
            <Eraser className="w-4 h-4" />
          </button>

          <div className="flex-1" />

          <button
            type="button"
            onClick={onCancel}
            title={t('common.cancel')}
            aria-label={t('common.cancel')}
            className="w-8 h-8 grid place-items-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-3 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && strokes.length) submit();
            }}
            placeholder={t('draw.placeholder')}
            className="flex-1 h-9 px-3 rounded-lg bg-surface-2 border border-[var(--glass-border)] text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={submit}
            disabled={!strokes.length}
            className="h-9 px-3 flex items-center gap-1.5 rounded-lg bg-primary text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition"
          >
            <Send className="w-4 h-4" />
            {t('draw.send')}
          </button>
        </div>
      </div>
    </div>
  );
}

function drawStroke(context: CanvasRenderingContext2D, stroke: Stroke) {
  const [start, end] = [stroke.points[0], stroke.points[stroke.points.length - 1]];
  if (!start) return;

  context.beginPath();

  if (stroke.shape === 'free') {
    context.moveTo(start.x, start.y);
    for (const point of stroke.points.slice(1)) context.lineTo(point.x, point.y);
    context.stroke();
    return;
  }

  if (!end || end === start) return;

  if (stroke.shape === 'rect') {
    context.rect(start.x, start.y, end.x - start.x, end.y - start.y);
    context.stroke();
    return;
  }

  if (stroke.shape === 'ellipse') {
    context.ellipse(
      (start.x + end.x) / 2,
      (start.y + end.y) / 2,
      Math.abs(end.x - start.x) / 2,
      Math.abs(end.y - start.y) / 2,
      0,
      0,
      Math.PI * 2
    );
    context.stroke();
    return;
  }

  // Flèche : le fût, puis une pointe pleine orientée selon l'angle du tracé.
  context.moveTo(start.x, start.y);
  context.lineTo(end.x, end.y);
  context.stroke();

  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const head = 12;
  context.beginPath();
  context.moveTo(end.x, end.y);
  context.lineTo(
    end.x - head * Math.cos(angle - Math.PI / 7),
    end.y - head * Math.sin(angle - Math.PI / 7)
  );
  context.lineTo(
    end.x - head * Math.cos(angle + Math.PI / 7),
    end.y - head * Math.sin(angle + Math.PI / 7)
  );
  context.closePath();
  context.fill();
}

export default DrawAnnotation;

/**
 * Un chiffre qui compte jusqu'à sa valeur quand il entre dans l'écran — posé par IDEM, NE PAS MODIFIER.
 *
 * Le composant ne FABRIQUE aucun chiffre : il reçoit le texte exact du contenu (« 1 200 », « 98 % », « 3,5 M F »),
 * en anime la seule partie numérique et garde le reste tel quel. Sans JavaScript, sans mouvement, ou pour un texte
 * sans chiffre, la valeur s'affiche telle qu'elle est écrite.
 */
import { useEffect, useRef, useState } from 'react';
import { useInView, useReducedMotion } from 'motion/react';

/** Sépare « 1 200 F » en avant / nombre / après, en gardant les séparateurs d'origine. */
function parse(value: string): { before: string; digits: string; after: string } | null {
  const match = value.match(/^(\D*?)([\d][\d\s.,  ]*)(.*)$/s);
  if (!match) return null;
  return { before: match[1], digits: match[2], after: match[3] };
}

const toNumber = (digits: string): number => Number(digits.replace(/[\s  ]/g, '').replace(',', '.'));

/** Remet la forme d'origine : mêmes séparateurs, mêmes décimales. */
function format(n: number, model: string): string {
  const decimals = (model.match(/[.,](\d+)\s*$/)?.[1] ?? '').length;
  const grouped = model.includes(' ') || model.includes(' ') || model.includes(' ');
  const fixed = n.toFixed(decimals);
  const [int, dec] = fixed.split('.');
  const head = grouped ? int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : int;
  return dec ? `${head}${model.includes(',') ? ',' : '.'}${dec}` : head;
}

export function Counter({ value, className, duration = 1.4 }: { value: string; className?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduced = useReducedMotion();
  const parts = parse(value);
  const target = parts ? toNumber(parts.digits) : Number.NaN;
  const animatable = !!parts && Number.isFinite(target) && !reduced;
  const [shown, setShown] = useState(() => (animatable ? 0 : null));

  useEffect(() => {
    if (!animatable || !inView) return;
    let frame = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / (duration * 1000));
      // Même courbe que les apparitions du thème : vif au départ, posé à l'arrivée.
      setShown(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [animatable, inView, target, duration]);

  if (!animatable || shown === null) return <span ref={ref} className={className}>{value}</span>;
  return (
    <span ref={ref} className={className}>
      {parts.before}
      <span aria-hidden="true">{format(shown, parts.digits)}</span>
      <span className="sr-only">{parts.digits}</span>
      {parts.after}
    </span>
  );
}

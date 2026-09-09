import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface PopoverProps {
  /** Élément déclencheur. Reçoit les props à étaler sur le bouton. */
  trigger: (props: {
    ref: React.Ref<HTMLButtonElement>;
    onClick: () => void;
    'aria-expanded': boolean;
    'aria-haspopup': 'dialog';
  }) => React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  /** Alignement du panneau sur le déclencheur. */
  align?: 'start' | 'end';
  className?: string;
  label: string;
}

/**
 * Panneau flottant ancré sur un déclencheur.
 *
 * Rendu dans un portail et positionné en `fixed` : le chrome du builder est une
 * pile de conteneurs `overflow-hidden` (panneaux redimensionnables, barre
 * d'en-tête), dans lesquels un panneau en `absolute` serait rogné.
 */
export function Popover({ trigger, children, align = 'end', className = '', label }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;

    const rect = trigger.getBoundingClientRect();
    const width = panel.offsetWidth;
    const gap = 6;

    const left =
      align === 'end'
        ? Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8))
        : Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));

    setPosition({ top: rect.bottom + gap, left });
  }, [align]);

  useLayoutEffect(() => {
    if (!open) return;
    place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close();
        triggerRef.current?.focus();
      }
    };

    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);

    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, close, place]);

  return (
    <>
      {trigger({
        ref: triggerRef,
        onClick: () => setOpen((value) => !value),
        'aria-expanded': open,
        'aria-haspopup': 'dialog',
      })}

      {open &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label={label}
            style={{
              position: 'fixed',
              top: position?.top ?? -9999,
              left: position?.left ?? -9999,
              // Invisible tant que la position n'est pas calculée : sinon le
              // panneau apparaît un instant en haut à gauche puis saute.
              visibility: position ? 'visible' : 'hidden',
            }}
            className={`z-[1000] rounded-xl border border-[var(--glass-border)] bg-surface-1 shadow-[var(--glass-shadow-xl)] overflow-hidden ${className}`}
          >
            {children(close)}
          </div>,
          document.body
        )}
    </>
  );
}

export default Popover;

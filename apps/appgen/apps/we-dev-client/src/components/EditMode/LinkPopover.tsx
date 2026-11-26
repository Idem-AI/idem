import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, PencilLine, X } from 'lucide-react';
import Button from '@/components/ui/Button';

/**
 * La petite fenêtre posée à côté d'un lien cliqué en mode Sélection : « Modifier » ou « Ouvrir le lien ».
 *
 * En mode Sélection, un clic désigne un élément au lieu de suivre le lien : sans ce choix, la personne ne savait plus
 * comment aller sur l'autre page. Même geste que la carte de lien de Google Docs : l'adresse en clair, puis les deux
 * actions, juste sous l'élément (au-dessus s'il n'y a pas la place), et qui suit la page quand elle défile.
 */
export interface LinkPopoverProps {
  /** Le rectangle de l'élément, en pixels de la surface d'aperçu (déjà ramené au zoom). */
  anchor: { top: number; left: number; width: number; height: number };
  /** La taille de la surface, pour ne jamais sortir du cadre. */
  bounds: { width: number; height: number };
  /** Ce que la personne lit : « Page À propos », « Section Contact de cette page », « wa.me/… ». */
  destination: string;
  external: boolean;
  onEdit: () => void;
  onOpen: () => void;
  onClose: () => void;
}

const GAP = 8;
const MARGIN = 8;

export function LinkPopover({ anchor, bounds, destination, external, onEdit, onOpen, onClose }: LinkPopoverProps) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 320, height: 96 });

  useLayoutEffect(() => {
    const node = ref.current;
    if (node) setSize({ width: node.offsetWidth, height: node.offsetHeight });
  }, [destination]);

  // Échap ferme ; le premier bouton prend le focus (clavier, lecteur d'écran).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    ref.current?.querySelector<HTMLButtonElement>('button[data-primary]')?.focus({ preventScroll: true });
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const below = anchor.top + anchor.height + GAP;
  const fitsBelow = below + size.height + MARGIN <= bounds.height;
  const top = fitsBelow ? below : Math.max(MARGIN, anchor.top - GAP - size.height);
  const left = Math.min(Math.max(MARGIN, anchor.left), Math.max(MARGIN, bounds.width - size.width - MARGIN));

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={t('editMode.linkPopover.title')}
      className="absolute z-30 w-[20rem] rounded-xl glass shadow-[var(--glass-shadow-xl)] p-3 text-left"
      style={{ top, left }}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-text-tertiary">{t('editMode.linkPopover.leadsTo')}</p>
          <p className="text-sm font-medium text-text-primary truncate" title={destination}>
            {destination}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="-mr-1 -mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-md text-text-tertiary hover:bg-surface-3 hover:text-text-primary"
          aria-label={t('editMode.linkPopover.close')}
        >
          <X size={14} />
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="primary" data-primary onClick={onEdit} icon={<PencilLine size={14} aria-hidden="true" />}>
          {t('editMode.linkPopover.edit')}
        </Button>
        <Button variant="secondary" onClick={onOpen} icon={<ExternalLink size={14} aria-hidden="true" />}>
          {t(external ? 'editMode.linkPopover.openSite' : 'editMode.linkPopover.open')}
        </Button>
      </div>
    </div>
  );
}

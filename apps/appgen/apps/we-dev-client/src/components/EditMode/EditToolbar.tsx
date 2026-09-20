import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MousePointerClick,
  Type,
  PenLine,
  Hand,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Undo2,
  Redo2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { EditToolMode } from './idemProtocol';

const POSITION_KEY = 'icode:edit-toolbar-position';
const MINIMIZED_KEY = 'icode:edit-toolbar-minimized';

interface Position {
  x: number;
  y: number;
}

/** Position de repli : centrée en bas, là où l'œil la retrouve. */
const DEFAULT_POSITION: Position = { x: 0.5, y: 0.92 };

function readPosition(): Position {
  try {
    const raw = localStorage.getItem(POSITION_KEY);
    if (!raw) return DEFAULT_POSITION;
    const parsed = JSON.parse(raw) as Position;
    if (typeof parsed?.x !== 'number' || typeof parsed?.y !== 'number') return DEFAULT_POSITION;
    // Bornée : une barre sortie de l'écran après un redimensionnement serait
    // définitivement inatteignable.
    return {
      x: Math.min(Math.max(parsed.x, 0.02), 0.98),
      y: Math.min(Math.max(parsed.y, 0.04), 0.96),
    };
  } catch {
    return DEFAULT_POSITION;
  }
}

interface EditToolbarProps {
  mode: EditToolMode;
  onModeChange: (mode: EditToolMode) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** Faux tant que l'agent d'édition n'a pas répondu dans l'iframe. */
  ready: boolean;
}

/**
 * Barre d'outils flottante posée sur l'aperçu.
 *
 * Elle remplace l'onglet « Edit » : les modes d'édition ne sont plus une
 * destination où l'on se rend, mais un état que l'on pose sur l'application que
 * l'on est en train de regarder. Déplaçable et repliable parce qu'elle masque
 * forcément une partie de la page qu'elle sert à modifier ; sa position est
 * mémorisée en fractions de la zone d'aperçu pour survivre aux
 * redimensionnements du panneau.
 */
export function EditToolbar({
  mode,
  onModeChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  ready,
}: EditToolbarProps) {
  const { t } = useTranslation();
  const [position, setPosition] = useState<Position>(readPosition);
  const [minimized, setMinimized] = useState(
    () => localStorage.getItem(MINIMIZED_KEY) === '1'
  );
  const [dragging, setDragging] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef({ dx: 0, dy: 0 });

  useEffect(() => {
    localStorage.setItem(MINIMIZED_KEY, minimized ? '1' : '0');
  }, [minimized]);

  const onDragStart = useCallback((event: React.PointerEvent) => {
    const host = rootRef.current?.offsetParent as HTMLElement | null;
    const node = rootRef.current;
    if (!host || !node) return;

    const hostRect = host.getBoundingClientRect();
    const nodeRect = node.getBoundingClientRect();
    dragOffset.current = {
      dx: event.clientX - (nodeRect.left + nodeRect.width / 2),
      dy: event.clientY - (nodeRect.top + nodeRect.height / 2),
    };

    const onMove = (moveEvent: PointerEvent) => {
      const x = (moveEvent.clientX - dragOffset.current.dx - hostRect.left) / hostRect.width;
      const y = (moveEvent.clientY - dragOffset.current.dy - hostRect.top) / hostRect.height;
      setPosition({
        x: Math.min(Math.max(x, 0.02), 0.98),
        y: Math.min(Math.max(y, 0.04), 0.96),
      });
    };

    const onUp = () => {
      setDragging(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setPosition((current) => {
        localStorage.setItem(POSITION_KEY, JSON.stringify(current));
        return current;
      });
    };

    setDragging(true);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, []);

  const tools: Array<{ mode: EditToolMode; icon: React.ReactNode; label: string; hint: string }> = [
    {
      mode: 'off',
      icon: <Hand className="w-4 h-4" />,
      label: t('editToolbar.navigate'),
      hint: t('editToolbar.navigateHint'),
    },
    {
      mode: 'select',
      icon: <MousePointerClick className="w-4 h-4" />,
      label: t('editToolbar.select'),
      hint: t('editToolbar.selectHint'),
    },
    {
      mode: 'text',
      icon: <Type className="w-4 h-4" />,
      label: t('editToolbar.text'),
      hint: t('editToolbar.textHint'),
    },
    {
      mode: 'draw',
      icon: <PenLine className="w-4 h-4" />,
      label: t('editToolbar.draw'),
      hint: t('editToolbar.drawHint'),
    },
  ];

  return (
    <div
      ref={rootRef}
      className="absolute z-30 -translate-x-1/2 -translate-y-1/2"
      style={{
        left: `${position.x * 100}%`,
        top: `${position.y * 100}%`,
        transition: dragging ? 'none' : 'left 120ms ease, top 120ms ease',
      }}
    >
      <div
        className="glass rounded-xl shadow-[var(--glass-shadow-lg)] flex items-center"
        role="toolbar"
        aria-label={t('editToolbar.label')}
      >
        {/* Poignée de déplacement */}
        <button
          type="button"
          onPointerDown={onDragStart}
          className="h-10 px-1.5 grid place-items-center text-text-tertiary hover:text-text-secondary cursor-grab active:cursor-grabbing touch-none"
          title={t('editToolbar.move')}
          aria-label={t('editToolbar.move')}
        >
          <GripVertical className="w-4 h-4" />
        </button>

        {!minimized && (
          <>
            <div className="w-px h-5 bg-[var(--glass-border)]" />

            <div className="flex items-center gap-0.5 px-1">
              {tools.map((tool) => (
                <ToolButton
                  key={tool.mode}
                  active={mode === tool.mode}
                  disabled={tool.mode !== 'off' && !ready}
                  onClick={() => onModeChange(tool.mode)}
                  label={tool.label}
                  hint={tool.hint}
                  icon={tool.icon}
                />
              ))}
            </div>

            <div className="w-px h-5 bg-[var(--glass-border)]" />

            <div className="flex items-center gap-0.5 px-1">
              <IconButton
                onClick={onUndo}
                disabled={!canUndo}
                label={`${t('editMode.undo')} (Ctrl+Z)`}
                icon={<Undo2 className="w-4 h-4" />}
              />
              <IconButton
                onClick={onRedo}
                disabled={!canRedo}
                label={`${t('editMode.redo')} (Ctrl+Y)`}
                icon={<Redo2 className="w-4 h-4" />}
              />
            </div>
          </>
        )}

        <div className="w-px h-5 bg-[var(--glass-border)]" />

        <button
          type="button"
          onClick={() => setMinimized((value) => !value)}
          className="h-10 px-2 grid place-items-center text-text-tertiary hover:text-text-primary"
          title={minimized ? t('editToolbar.expand') : t('editToolbar.minimize')}
          aria-label={minimized ? t('editToolbar.expand') : t('editToolbar.minimize')}
          aria-expanded={!minimized}
        >
          {minimized ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Repère de gratuité : l'édition de texte n'appelle aucun modèle, elle
          écrit directement dans le source. C'est un argument produit, il mérite
          d'être visible au moment où le mode est actif. */}
      {!minimized && mode === 'text' && (
        <p className="mt-1.5 text-center text-[11px] text-text-tertiary">
          {t('editToolbar.textFree')}
        </p>
      )}
    </div>
  );
}

function ToolButton({
  active,
  disabled,
  onClick,
  icon,
  label,
  hint,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      title={`${label} — ${hint}`}
      className={`h-8 px-2.5 flex items-center gap-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        active
          ? 'bg-primary text-white'
          : 'text-text-secondary hover:text-text-primary hover:bg-surface-3'
      }`}
    >
      {icon}
      <span className="hidden lg:inline">{label}</span>
    </button>
  );
}

function IconButton({
  onClick,
  disabled,
  icon,
  label,
}: {
  onClick: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="w-8 h-8 grid place-items-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-3 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
    >
      {icon}
    </button>
  );
}

export default EditToolbar;

import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Smartphone, Tablet, Laptop, Monitor, ChevronDown } from 'lucide-react';

export interface WindowSize {
  name: string;
  width: number | string;
  height: number | string;
  icon: React.ComponentType<{ size?: string | number }>;
}

export const WINDOW_SIZES: WindowSize[] = [
  { name: 'Desktop', width: '100%', height: '100%', icon: Monitor },
  { name: 'Laptop', width: 1280, height: 800, icon: Laptop },
  { name: 'Tablet', width: 768, height: 1024, icon: Tablet },
  { name: 'Mobile', width: 390, height: 844, icon: Smartphone },
];

/**
 * Sélecteur de taille d'écran. Le menu est rendu dans un PORTAL en
 * `position: fixed` sur document.body : il s'affiche donc TOUJOURS au-dessus de
 * l'iframe (les menus absolus « classiques » passent souvent derrière une iframe
 * cross-origin — c'était le bug de l'aperçu).
 */
export function SizeSelector({
  value,
  onChange,
}: {
  value: WindowSize;
  onChange: (size: WindowSize) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const r = btnRef.current?.getBoundingClientRect();
      if (r) setPos({ top: r.bottom + 4, left: r.left });
    };
    update();
    window.addEventListener('resize', update);
    // Fermer au scroll pour éviter un menu « flottant » désaligné.
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', close, true);
    };
  }, [open]);

  const Icon = value.icon;
  return (
    <div className="relative">
      <button
        ref={btnRef}
        className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-[#2c2c2c] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 flex items-center gap-1.5"
        onClick={() => setOpen((o) => !o)}
        title={value.name}
        aria-label={value.name}
      >
        <Icon size={16} />
        <ChevronDown size={14} />
      </button>
      {open &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[99998]" onClick={() => setOpen(false)} />
            <div
              className="fixed z-[99999] min-w-[220px] bg-white dark:bg-[#1a1a1a] rounded-xl shadow-2xl border border-[#E5E7EB] dark:border-[rgba(255,255,255,0.12)] overflow-hidden py-1"
              style={{ top: pos.top, left: pos.left }}
            >
              {WINDOW_SIZES.map((size) => {
                const SIcon = size.icon;
                const activeItem = size.name === value.name;
                return (
                  <button
                    key={size.name}
                    className={`w-full px-4 py-2.5 text-left text-sm whitespace-nowrap flex items-center gap-3 group hover:bg-[#F5EEFF] dark:hover:bg-[#2c2c2c] ${
                      activeItem
                        ? 'text-[#6D28D9] dark:text-[#a78bfa]'
                        : 'text-[#111827] dark:text-gray-300'
                    }`}
                    onClick={() => {
                      onChange(size);
                      setOpen(false);
                    }}
                  >
                    <SIcon size={18} />
                    <div className="flex flex-col">
                      <span className="font-medium">{size.name}</span>
                      <span className="text-xs text-[#6B7280] dark:text-gray-500">
                        {size.width} × {size.height}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </>,
          document.body
        )}
    </div>
  );
}

/** Style du conteneur intérieur qui porte l'iframe, selon la taille + le zoom. */
export function viewportStyle(size: WindowSize, scale = 1): React.CSSProperties {
  const isPercentW = typeof size.width === 'string' && size.width.includes('%');
  const isPercentH = typeof size.height === 'string' && size.height.includes('%');
  return {
    width: isPercentW ? (size.width as string) : `${Number(size.width) * scale}px`,
    height: isPercentH ? (size.height as string) : `${Number(size.height) * scale}px`,
    maxWidth: '100%',
    transition: 'width .2s ease, height .2s ease',
  };
}

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import classNames from "classnames";
import type { SendButtonProps } from "./types";
import { useTranslation } from "react-i18next";
import useChatStore, { CREATIVITY_LEVELS, CreativityLevel } from "@/stores/chatSlice";

const MENU_WIDTH = 320;
const GAP = 10;

/**
 * LE BOUTON D'ENVOI, avec le NIVEAU DE CRÉATIVITÉ dessus : cliquer ouvre un petit menu sous le bouton (au-dessus
 * s'il manque la place), un niveau par ligne ; cliquer un niveau ENVOIE avec ce niveau. Aucun modèle n'est
 * montré : le serveur choisit le modèle du niveau. La touche Entrée du champ envoie directement, au dernier
 * niveau choisi (rappelé au survol du bouton). Pendant une génération, le bouton l'arrête.
 */
export const SendButton: React.FC<SendButtonProps> = ({
  isLoading,
  isUploading,
  hasInput,
  hasUploadingImages,
  onClick,
  stop
}) => {
  const { t } = useTranslation();
  const { creativity, setCreativity } = useChatStore();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number; caret: number; below: boolean }>({ left: 0, top: 0, caret: 24, below: true });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const ready = hasInput && !isUploading && !hasUploadingImages;
  const levelLabel = t(`chat.creativity.levels.${creativity}.label`);

  /** Sous le bouton s'il y a la place, sinon au-dessus ; centré sur lui, dans l'écran. */
  const place = () => {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const width = Math.min(MENU_WIDTH, window.innerWidth - 24);
    const height = menuRef.current?.getBoundingClientRect().height || 300;
    const below = rect.bottom + GAP + height <= window.innerHeight - 8 || rect.top - GAP - height < 8;
    const center = rect.left + rect.width / 2;
    const left = Math.max(12, Math.min(window.innerWidth - width - 12, center - width / 2));
    setPos({ left, top: below ? rect.bottom + GAP : Math.max(8, rect.top - GAP - height), caret: Math.max(16, Math.min(width - 16, center - left)), below });
  };

  useLayoutEffect(() => {
    if (!open) return;
    place();
    const current = menuRef.current?.querySelectorAll<HTMLButtonElement>("[data-level]")[CREATIVITY_LEVELS.indexOf(creativity)];
    current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      const node = e.target as Node;
      if (!menuRef.current?.contains(node) && !buttonRef.current?.contains(node)) setOpen(false);
    };
    const reposition = () => place();
    document.addEventListener("pointerdown", outside, true);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open]);

  const choose = (level: CreativityLevel) => {
    setCreativity(level);
    setOpen(false);
    // Le niveau est enregistré avant l'envoi : la requête part avec lui.
    setTimeout(() => onClick(null as unknown as React.MouseEvent<HTMLButtonElement>), 0);
  };

  const onItemKey = (e: React.KeyboardEvent, index: number) => {
    const items = menuRef.current?.querySelectorAll<HTMLButtonElement>("[data-level]");
    if (!items) return;
    const last = items.length - 1;
    const to = e.key === "ArrowDown" ? Math.min(last, index + 1) : e.key === "ArrowUp" ? Math.max(0, index - 1) : e.key === "Home" ? 0 : e.key === "End" ? last : -1;
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
      return;
    }
    if (to < 0) {
      if (e.key === "Tab") setOpen(false);
      return;
    }
    e.preventDefault();
    items[to]?.focus();
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup={isLoading ? undefined : "menu"}
        aria-expanded={isLoading ? undefined : open}
        title={isLoading ? undefined : t("chat.creativity.current", { level: levelLabel })}
        onClick={(e) => {
          e.preventDefault();
          if (isLoading) return stop();
          if (!ready) return;
          setOpen((v) => !v);
        }}
        className={classNames(
          "p-2 flex items-center gap-2",
          isLoading
            ? "bg-danger hover:bg-red-600 text-white rounded-lg transition-all duration-200"
            : ready
              ? "inner-button"
              : "outer-button opacity-50",
          isUploading && "opacity-50 cursor-not-allowed"
        )}
      >
        {isLoading ? (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" className="w-4 h-4 text-white">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 4h4v16H6zM14 4h4v16h-4z" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        )}
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={t("chat.creativity.choose")}
            className="fixed z-[80] rounded-2xl border border-[var(--glass-border)] bg-[var(--color-surface-2)] p-1.5 shadow-2xl"
            style={{ left: pos.left, top: pos.top, width: Math.min(MENU_WIDTH, window.innerWidth - 24) }}
          >
            <p className="mx-2 mt-1.5 text-sm font-semibold text-[var(--color-text-primary)]">{t("chat.creativity.choose")}</p>
            <p className="mx-2 mb-1.5 mt-0.5 text-xs leading-snug text-[var(--color-text-tertiary)]">{t("chat.creativity.help")}</p>
            {CREATIVITY_LEVELS.map((level, i) => (
              <button
                key={level}
                type="button"
                role="menuitemradio"
                data-level={level}
                aria-checked={creativity === level}
                onClick={() => choose(level)}
                onKeyDown={(e) => onItemKey(e, i)}
                className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-[var(--glass-bg-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className={classNames("text-sm font-semibold", creativity === level ? "text-[var(--color-primary-500)]" : "text-[var(--color-text-primary)]")}>
                    {t(`chat.creativity.levels.${level}.label`)}
                  </span>
                  <span className="text-xs text-[var(--color-text-secondary)]">{t(`chat.creativity.levels.${level}.line`)}</span>
                </span>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-3.5 w-3.5 flex-none text-[var(--color-text-tertiary)]" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            ))}
            <span
              aria-hidden="true"
              className="absolute h-3 w-3 rotate-45 border-[var(--glass-border)] bg-[var(--color-surface-2)]"
              style={{ left: pos.caret - 6, ...(pos.below ? { top: -6, borderLeftWidth: 1, borderTopWidth: 1 } : { bottom: -6, borderRightWidth: 1, borderBottomWidth: 1 }) }}
            />
          </div>,
          document.body
        )}
    </>
  );
};

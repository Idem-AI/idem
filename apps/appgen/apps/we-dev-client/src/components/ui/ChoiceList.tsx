import { KeyboardEvent, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { IdemLoader } from '@idem/shared-loader/react';

export interface Choice {
  value: string;
  label: string;
  description?: string;
  recommended?: boolean;
}

/**
 * Une question et ses réponses à cliquer, au même dessin que les choix du chat d'iCode
 * (`ChatChoices`) : une ligne par option, numérotée, la recommandée en tête et marquée,
 * les chiffres du clavier choisissent, les flèches se déplacent.
 */
export function ChoiceList({
  question,
  help,
  choices,
  onChoose,
  busy = null,
  disabled = false,
}: {
  question: string;
  help?: string;
  choices: Choice[];
  onChoose: (value: string) => void;
  /** L'option dont le choix est en cours (un appel réseau) : son numéro devient le chargement. */
  busy?: string | null;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const id = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const ordered = [...choices.filter((c) => c.recommended), ...choices.filter((c) => !c.recommended)];
  const locked = disabled || busy !== null;

  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (locked) return;
    const buttons = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('button[data-option]') ?? []);
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next = event.key === 'ArrowDown' ? Math.min(buttons.length - 1, index + 1) : Math.max(0, index - 1);
      buttons[next < 0 ? 0 : next]?.focus();
    } else if (/^[1-9]$/.test(event.key)) {
      const target = buttons[Number(event.key) - 1];
      if (target) {
        event.preventDefault();
        target.click();
      }
    }
  };

  return (
    <div role="group" aria-labelledby={`${id}-q`}>
      <p id={`${id}-q`} className="text-sm font-semibold text-text-primary">
        {question}
      </p>
      {help && <p className="mt-0.5 text-xs text-text-tertiary">{help}</p>}
      <div ref={listRef} className="mt-2 grid gap-1.5" onKeyDown={onKey}>
        {ordered.map((choice, index) => (
          <button
            key={choice.value}
            type="button"
            data-option
            disabled={locked}
            onClick={() => onChoose(choice.value)}
            className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-500)] disabled:cursor-default ${
              choice.recommended || busy === choice.value
                ? 'border-[var(--color-primary-500)]'
                : 'border-[var(--glass-border)] hover:border-[var(--color-primary-500)]'
            } ${locked && busy !== choice.value ? 'opacity-60' : ''}`}
          >
            <span
              className="mt-0.5 grid h-5 w-5 flex-none place-items-center rounded border border-[var(--glass-border)] text-[11px] tabular-nums text-text-tertiary"
              aria-hidden="true"
            >
              {busy === choice.value ? <IdemLoader size="xs" /> : index + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-text-primary">
                {choice.label}
                {choice.recommended && (
                  <span className="tag !py-0 !text-[11px] text-[var(--color-primary-500)]">{t('chat.choices.recommended')}</span>
                )}
              </span>
              {choice.description && <span className="mt-0.5 block text-xs leading-relaxed text-text-secondary">{choice.description}</span>}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

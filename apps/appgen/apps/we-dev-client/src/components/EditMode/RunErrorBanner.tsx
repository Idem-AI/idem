import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ChevronDown, Wand2, X } from 'lucide-react';
import useRunStatus from '@/stores/runStatusSlice';

/**
 * L'erreur qui empêche l'application de tourner, dite à l'utilisateur au-dessus
 * de l'aperçu, avec un bouton qui en demande la correction à l'IA.
 *
 * Posée sous la barre de l'aperçu et non par-dessus : la dernière version qui
 * marchait reste visible dessous quand Vite la garde affichée.
 */
export function RunErrorBanner({ onFix }: { onFix: (prompt: string) => void }) {
  const { t } = useTranslation();
  const error = useRunStatus((state) => state.error);
  const clearError = useRunStatus((state) => state.clearError);
  const [open, setOpen] = useState(false);

  if (!error) return null;

  const fix = () => {
    const prompt = [
      t('preview.fix.prompt', { summary: error.summary }),
      '',
      '```',
      error.log,
      '```',
    ].join('\n');
    onFix(prompt);
    setOpen(false);
  };

  return (
    <div role="alert" className="shrink-0 border-b border-red-500/30 bg-red-500/[0.07] px-3 py-2.5">
      <div className="flex items-start gap-2.5">
        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-500" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text-primary">{t(`preview.fix.title.${error.source}`)}</p>
          <p className="mt-0.5 line-clamp-2 break-words text-xs text-text-secondary" data-mono>
            {error.summary}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={fix}
              className="inline-flex h-7 items-center gap-1.5 rounded-md bg-primary px-2.5 text-xs font-semibold text-white hover:opacity-90"
            >
              <Wand2 size={13} aria-hidden="true" />
              {t('preview.fix.cta')}
            </button>
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-text-secondary hover:bg-surface-3 hover:text-text-primary"
            >
              {t(open ? 'preview.fix.hideDetails' : 'preview.fix.details')}
              <ChevronDown size={13} className={open ? 'rotate-180' : ''} aria-hidden="true" />
            </button>
          </div>
          {open && (
            <pre
              className="mt-2 max-h-48 overflow-auto rounded-md border border-[var(--glass-border)] bg-surface-2 p-2 text-[11px] leading-relaxed text-text-secondary whitespace-pre-wrap break-words"
              data-mono
            >
              {error.log}
            </pre>
          )}
        </div>
        <button
          type="button"
          onClick={clearError}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-text-tertiary hover:bg-surface-3 hover:text-text-primary"
          aria-label={t('preview.fix.dismiss')}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

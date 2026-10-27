import { KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Check, CornerDownLeft } from 'lucide-react';
import type { ChatChoices as Choices, ChoiceOption, ChoiceQuestion } from '@/utils/chatMarkers';
import { eventEmitter } from '../../../utils/EventEmitter';

const LANDING_URL = (process.env.REACT_APP_IDEM_LANDING_URL || 'https://idem.africa').replace(/\/+$/, '');

export interface ChoicesAnswerEvent {
  choices: Choices;
  values: Record<string, string>;
  consent: boolean;
  /** L'option de la dernière question (une action de l'atelier, « continuer », « pas maintenant »…). */
  option?: ChoiceOption;
  /** La réponse écrite dans le fil, comme si l'utilisateur l'avait tapée. */
  summary: string;
}

const OTHER = '__other__';

/** La recommandée en tête, quelle que soit la façon dont le serveur l'a rangée. */
const ordered = (q: ChoiceQuestion): ChoiceOption[] => {
  const options = q.options ?? [];
  return [...options.filter((o) => o.recommended), ...options.filter((o) => !o.recommended)];
};

/**
 * DES CHOIX À CLIQUER DANS LE CHAT, comme un assistant les pose : une question à la fois, chaque option dite en
 * une ligne, la meilleure en tête et marquée « Recommandé ». Au clavier : les chiffres choisissent, les flèches
 * se déplacent, Entrée valide. « Autre… » ouvre un champ libre ; une question peut demander un mot (une adresse).
 *
 * Plusieurs questions, ou un accord à donner : une dernière étape récapitule les réponses (chacune se corrige
 * d'un clic) avec la case d'accord aux politiques d'IDEM — jamais cochée d'avance — et le bouton qui lance.
 * Une seule question sans accord : le clic suffit.
 *
 * Seuls les derniers choix de la conversation se répondent ; les précédents restent lisibles, désactivés.
 */
export function ChatChoices({ choices, active }: { choices: Choices; active: boolean }) {
  const { t } = useTranslation();
  const id = useId();
  const questions = choices.questions;
  const needsReview = questions.length > 1 || !!choices.consent;
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({});
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [other, setOther] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [consent, setConsent] = useState(false);
  const [missingConsent, setMissingConsent] = useState(false);
  const [sent, setSent] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const disabled = !active || sent;
  const reviewing = needsReview && step >= questions.length;
  const current = reviewing ? null : questions[Math.min(step, questions.length - 1)];
  const options = useMemo(() => (current ? ordered(current) : []), [current]);
  const hasRecommended = questions.slice(step).some((q) => q.options?.some((o) => o.recommended));

  // La question qui arrive prend le focus (clavier, lecteurs d'écran) — sauf la toute première, posée par le fil.
  useEffect(() => {
    if (!active || step === 0) return;
    queueMicrotask(() => {
      if (current?.kind === 'text' || other !== null) inputRef.current?.focus();
      else listRef.current?.querySelector<HTMLButtonElement>('button[data-option]')?.focus();
    });
  }, [step, other, active, current?.kind]);

  const finish = (nextValues: Record<string, string>, nextLabels: Record<string, string>, option?: ChoiceOption) => {
    if (choices.consent && !consent) {
      setMissingConsent(true);
      return;
    }
    setSent(true);
    const summary = questions.map((q) => nextLabels[q.id] ?? nextValues[q.id]).filter(Boolean).join(' · ');
    eventEmitter.emit('chat:choicesAnswer', { choices, values: nextValues, consent: choices.consent ? consent : false, option, summary } satisfies ChoicesAnswerEvent);
  };

  const answer = (value: string, label: string, option?: ChoiceOption) => {
    if (disabled || !current) return;
    const nextValues = { ...values, [current.id]: value };
    const nextLabels = { ...labels, [current.id]: label };
    setValues(nextValues);
    setLabels(nextLabels);
    setOther(null);
    setText('');
    // Une action sur place, « continuer » ou « pas maintenant » : la réponse part tout de suite.
    if (!needsReview || option?.clientAction || option?.passthrough || option?.dismiss) {
      finish(nextValues, nextLabels, option);
      return;
    }
    setStep((n) => n + 1);
  };

  /** Les choix recommandés pour les questions restantes ; celles qui demandent un mot restent à remplir. */
  const chooseForMe = () => {
    if (disabled) return;
    const nextValues = { ...values };
    const nextLabels = { ...labels };
    let firstOpen = -1;
    questions.forEach((q, index) => {
      if (index < step && nextValues[q.id]) return;
      const best = ordered(q)[0];
      if (q.kind === 'text' || !best) {
        if (!nextValues[q.id] && firstOpen < 0) firstOpen = index;
        return;
      }
      nextValues[q.id] = best.value;
      nextLabels[q.id] = best.label;
    });
    setValues(nextValues);
    setLabels(nextLabels);
    if (firstOpen >= 0) setStep(firstOpen);
    else if (needsReview) setStep(questions.length);
    else finish(nextValues, nextLabels, ordered(questions[0])[0]);
  };

  const onListKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled || other !== null) return;
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

  const submitText = (value: string) => {
    const clean = value.trim();
    if (!clean) return;
    answer(clean, clean);
  };

  return (
    <div className="mt-3 rounded-xl border border-[var(--glass-border)] bg-surface-1 p-3" role="group" aria-labelledby={`${id}-title`} aria-disabled={disabled}>
      {/* L'en-tête : où on en est, revenir, laisser choisir. */}
      <div className="mb-2 flex items-center gap-2">
        {questions.length > 1 && (
          <span className="text-xs tabular-nums text-text-tertiary">
            {reviewing ? t('chat.choices.review') : t('chat.choices.step', { current: step + 1, total: questions.length })}
          </span>
        )}
        <span className="ml-auto flex items-center gap-1">
          {step > 0 && !disabled && (
            <button type="button" className="button-ghost button-sm !px-2" onClick={() => {
                setOther(null);
                setStep((n) => n - 1);
              }}>
              <ArrowLeft size={12} aria-hidden="true" /> {t('chat.choices.back')}
            </button>
          )}
          {hasRecommended && !reviewing && !disabled && (
            <button type="button" className="button-ghost button-sm !px-2" onClick={chooseForMe}>
              {t('chat.choices.forMe')}
            </button>
          )}
        </span>
      </div>

      {current && (
        <>
          <p id={`${id}-title`} className="text-sm font-semibold text-text-primary">
            {current.question}
          </p>
          {current.help && <p className="mt-0.5 text-xs text-text-tertiary">{current.help}</p>}

          {current.kind === 'text' ? (
            <form
              className="mt-2 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                submitText(text);
              }}
            >
              <input
                ref={inputRef}
                type="text"
                className="min-w-0 flex-1"
                value={text}
                disabled={disabled}
                placeholder={current.placeholder}
                aria-label={current.question}
                onChange={(event) => setText(event.target.value)}
              />
              <button type="submit" className="inner-button button-sm" disabled={disabled || !text.trim()}>
                {t('chat.choices.continue')} <CornerDownLeft size={12} aria-hidden="true" />
              </button>
            </form>
          ) : (
            <div ref={listRef} className="mt-2 grid gap-1.5" onKeyDown={onListKey}>
              {options.map((option, index) => {
                const chosen = values[current.id] === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    data-option
                    disabled={disabled}
                    onClick={() => answer(option.value, option.label, option)}
                    aria-pressed={chosen}
                    className={`group flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-500)] disabled:cursor-default ${
                      chosen || (option.recommended && !values[current.id])
                        ? 'border-[var(--color-primary-500)]'
                        : 'border-[var(--glass-border)] hover:border-[var(--color-primary-500)]'
                    } ${disabled && !chosen ? 'opacity-60' : ''}`}
                  >
                    <span className="mt-0.5 grid h-5 w-5 flex-none place-items-center rounded border border-[var(--glass-border)] text-[11px] tabular-nums text-text-tertiary" aria-hidden="true">
                      {chosen ? <Check size={12} /> : index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-text-primary">
                        {option.label}
                        {option.recommended && <span className="tag !py-0 !text-[11px] text-[var(--color-primary-500)]">{t('chat.choices.recommended')}</span>}
                      </span>
                      {option.description && <span className="mt-0.5 block text-xs leading-relaxed text-text-secondary">{option.description}</span>}
                    </span>
                  </button>
                );
              })}

              {current.allowOther &&
                (other === null ? (
                  <button
                    type="button"
                    data-option
                    disabled={disabled}
                    onClick={() => setOther('')}
                    className="flex w-full items-center gap-3 rounded-lg border border-dashed border-[var(--glass-border)] px-3 py-2.5 text-left text-sm text-text-secondary hover:border-[var(--color-primary-500)] disabled:opacity-60"
                  >
                    <span className="grid h-5 w-5 flex-none place-items-center rounded border border-[var(--glass-border)] text-[11px] tabular-nums text-text-tertiary" aria-hidden="true">
                      {options.length + 1}
                    </span>
                    {t('chat.choices.other')}
                  </button>
                ) : (
                  <form
                    className="flex gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      submitText(other);
                    }}
                  >
                    <input
                      ref={inputRef}
                      type="text"
                      className="min-w-0 flex-1"
                      value={other}
                      placeholder={t('chat.choices.otherPlaceholder')}
                      aria-label={t('chat.choices.other')}
                      onChange={(event) => setOther(event.target.value)}
                      onKeyDown={(event) => event.key === 'Escape' && setOther(null)}
                    />
                    <button type="submit" className="inner-button button-sm" disabled={!other.trim()}>
                      {t('chat.choices.continue')}
                    </button>
                  </form>
                ))}
            </div>
          )}
        </>
      )}

      {/* Le récapitulatif : chaque réponse se corrige d'un clic, l'accord se donne ici, puis on lance. */}
      {reviewing && (
        <div>
          <p id={`${id}-title`} className="text-sm font-semibold text-text-primary">
            {t('chat.choices.reviewTitle')}
          </p>
          <ul className="mt-2 grid gap-1">
            {questions.map((q, index) => (
              <li key={q.id} className="flex items-baseline gap-2 text-sm">
                <span className="min-w-0 flex-1 text-text-secondary">
                  {q.question} <span className="font-medium text-text-primary">{labels[q.id] ?? values[q.id]}</span>
                </span>
                {!disabled && (
                  <button type="button" className="button-ghost button-sm !px-2" onClick={() => setStep(index)}>
                    {t('chat.choices.edit')}
                  </button>
                )}
              </li>
            ))}
          </ul>

          {choices.consent && (
            <div className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-text-secondary">
              <input
                id={`${id}-consent`}
                type="checkbox"
                className="mt-0.5 flex-none"
                checked={consent}
                disabled={disabled}
                onChange={(event) => {
                  setConsent(event.target.checked);
                  if (event.target.checked) setMissingConsent(false);
                }}
              />
              <label htmlFor={`${id}-consent`} className="!mb-0 !text-xs !font-normal">
                {t('chat.choices.consent.lead')}{' '}
                <a className="underline" href={`${LANDING_URL}/privacy-policy`} target="_blank" rel="noopener noreferrer">
                  {t('chat.choices.consent.privacy')}
                </a>
                ,{' '}
                <a className="underline" href={`${LANDING_URL}/terms-of-service`} target="_blank" rel="noopener noreferrer">
                  {t('chat.choices.consent.terms')}
                </a>{' '}
                {t('chat.choices.consent.and')}{' '}
                <a className="underline" href={`${LANDING_URL}/beta-policy`} target="_blank" rel="noopener noreferrer">
                  {t('chat.choices.consent.beta')}
                </a>{' '}
                {t('chat.choices.consent.ofIdem')}
              </label>
            </div>
          )}
          {missingConsent && (
            <p role="alert" className="mt-1 text-xs text-[var(--color-danger)]">
              {t('chat.choices.consent.required')}
            </p>
          )}

          <button type="button" className="inner-button button-sm mt-3" disabled={disabled} onClick={() => finish(values, labels)}>
            {choices.submitLabel || t('chat.choices.submit')}
          </button>
        </div>
      )}
    </div>
  );
}

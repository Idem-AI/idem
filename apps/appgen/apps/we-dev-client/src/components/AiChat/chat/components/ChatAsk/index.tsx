import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChatAsk as Ask } from '@/utils/chatMarkers';
import { eventEmitter } from '../../../utils/EventEmitter';

const LANDING_URL = (process.env.REACT_APP_IDEM_LANDING_URL || 'https://idem.africa').replace(/\/+$/, '');

export interface RedesignAnswer {
  url: string;
  choice: 'direct' | 'identity';
  consent: boolean;
  /** La réponse écrite dans le fil, comme si l'utilisateur l'avait tapée. */
  text: string;
}

/**
 * Une question à cliquer posée par le serveur (« Par où commence-t-on ? ») : chaque option dit ce qu'elle
 * fait, une seule est « Recommandé », « Choisir pour moi » prend celle-là. Quand la réponse crée un projet
 * IDEM, la case d'accord aux politiques est demandée — jamais cochée d'avance.
 *
 * Seule la dernière question de la conversation se répond ; une question passée reste lisible, désactivée.
 */
export function ChatAsk({ ask, active }: { ask: Ask; active: boolean }) {
  const { t } = useTranslation();
  const [consent, setConsent] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [missingConsent, setMissingConsent] = useState(false);
  const id = useId();
  const disabled = !active || !!sent;

  const answer = (value: 'direct' | 'identity') => {
    if (disabled) return;
    if (ask.consent && !consent) {
      setMissingConsent(true);
      document.getElementById(`${id}-consent`)?.focus();
      return;
    }
    const option = ask.options.find((item) => item.value === value);
    setSent(value);
    eventEmitter.emit('chat:redesignAnswer', { url: ask.url, choice: value, consent: ask.consent ? consent : false, text: option?.label ?? value } satisfies RedesignAnswer);
  };

  const recommended = ask.options.find((option) => option.recommended) ?? ask.options[0];

  return (
    <fieldset className="mt-3 space-y-3" disabled={disabled} aria-describedby={missingConsent ? `${id}-error` : undefined}>
      <legend className="text-sm font-semibold text-text-primary">{ask.question}</legend>
      <div className="grid gap-2">
        {ask.options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => answer(option.value)}
            aria-pressed={sent === option.value}
            className={`glass-card w-full p-3 text-left transition-colors hover:border-[var(--color-primary-500)] disabled:cursor-default ${
              sent === option.value ? 'border-[var(--color-primary-500)]' : ''
            } ${sent && sent !== option.value ? 'opacity-50' : ''}`}
          >
            <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-text-primary">
              {option.label}
              {option.recommended && <span className="tag">{t('chat.ask.recommended')}</span>}
            </span>
            <span className="mt-1 block text-xs leading-relaxed text-text-secondary">{option.description}</span>
          </button>
        ))}
      </div>

      {ask.consent && (
        <div className="flex items-start gap-2 text-xs leading-relaxed text-text-secondary">
          <input
            id={`${id}-consent`}
            type="checkbox"
            className="mt-0.5 flex-none"
            checked={consent}
            onChange={(event) => {
              setConsent(event.target.checked);
              if (event.target.checked) setMissingConsent(false);
            }}
          />
          <label htmlFor={`${id}-consent`} className="!mb-0 !text-xs !font-normal">
            {t('chat.ask.consent.lead')}{' '}
            <a className="underline" href={`${LANDING_URL}/privacy-policy`} target="_blank" rel="noopener noreferrer">
              {t('chat.ask.consent.privacy')}
            </a>
            ,{' '}
            <a className="underline" href={`${LANDING_URL}/terms-of-service`} target="_blank" rel="noopener noreferrer">
              {t('chat.ask.consent.terms')}
            </a>{' '}
            {t('chat.ask.consent.and')}{' '}
            <a className="underline" href={`${LANDING_URL}/beta-policy`} target="_blank" rel="noopener noreferrer">
              {t('chat.ask.consent.beta')}
            </a>{' '}
            {t('chat.ask.consent.ofIdem')}
          </label>
        </div>
      )}
      {missingConsent && (
        <p id={`${id}-error`} role="alert" className="text-xs text-[var(--color-danger)]">
          {t('chat.ask.consent.required')}
        </p>
      )}

      {!sent && active && (
        <button type="button" className="button-ghost button-sm" onClick={() => answer(recommended.value)}>
          {t('chat.ask.chooseForMe')}
        </button>
      )}
    </fieldset>
  );
}

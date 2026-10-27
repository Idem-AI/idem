import { useEffect, useMemo, useRef, useState } from 'react';
import { IdemLoader } from '@idem/shared-loader/react';
import { JourneyCardOptions, journeyCardView, journeyDismiss, journeyOpen, journeyShown } from '../card';
import { journeyIllustration } from '../illustrations';

export type JourneyCardProps = JourneyCardOptions & {
  /** Retirée (écartée par l'utilisateur) : l'hôte cesse de l'afficher. */
  onDismissed?: () => void;
};

/**
 * La carte « prochaine étape » : un dessin, une phrase qui dit ce que l'utilisateur y gagne, un bouton qui
 * l'y emmène avec son projet déjà sélectionné, et « Plus tard ». Une seule à la fois.
 */
export function JourneyCard(props: JourneyCardProps) {
  const { recommendation, onDismissed } = props;
  const view = useMemo(() => journeyCardView(props), [recommendation.id, recommendation.projectId, props.lang, props.urls.dashboard, props.urls.icode]);
  const [opening, setOpening] = useState(false);
  const reported = useRef<string | null>(null);

  useEffect(() => {
    if (reported.current === recommendation.id) return;
    reported.current = recommendation.id;
    journeyShown(props);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recommendation.id]);

  const open = async () => {
    setOpening(true);
    try {
      await journeyOpen(props);
    } finally {
      setOpening(false);
    }
  };

  return (
    <section className="glass-card flex items-start gap-4 p-4" aria-labelledby={`journey-${recommendation.id}`} data-journey={recommendation.id}>
      <span className="shrink-0 text-[var(--color-primary-500)]" dangerouslySetInnerHTML={{ __html: journeyIllustration(recommendation.destination) }} />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">{view.label}</p>
        <h3 id={`journey-${recommendation.id}`} className="mt-1 text-base font-semibold text-[var(--color-text-primary)]">
          {view.text.title}
        </h3>
        {view.text.body && <p className="mt-1 text-sm leading-relaxed text-[var(--color-text-secondary)]">{view.text.body}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" className="inner-button button-sm" disabled={opening} onClick={open}>
            {opening && <IdemLoader size="xs" />}
            {view.text.cta}
          </button>
          <button
            type="button"
            className="button-ghost button-sm"
            onClick={() => {
              journeyDismiss(props);
              onDismissed?.();
            }}
          >
            {view.dismissLabel}
          </button>
        </div>
      </div>
    </section>
  );
}

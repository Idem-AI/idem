import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { IdemLoader } from '@idem/shared-loader/react';
import { JourneyCardOptions, JourneyCardVariant, journeyCardView, journeyDismiss, journeyOpen, journeyShown } from '../card';
import { journeyIllustration, JOURNEY_ICONS } from '../illustrations';

export type JourneyCardProps = JourneyCardOptions & {
  /** Retirée (écartée par l'utilisateur) : l'hôte cesse de l'afficher. */
  onDismissed?: () => void;
  /** `inline` (défaut) dans le fil ; `float` en haut au centre (voir `JourneyFloat`). */
  variant?: JourneyCardVariant;
  /** La carte est déjà signalée affichée ailleurs (sa jumelle du fil) : pas de second « shown ». */
  silent?: boolean;
};

/**
 * La carte « prochaine étape » : un dessin, une phrase qui dit ce que l'utilisateur y gagne, un bouton qui
 * l'y emmène avec son projet déjà sélectionné, et « Plus tard ». Une seule à la fois. Ses styles sont ceux du
 * design system (`.idem-next`, `@idem/shared-styles`) : le même rendu dans toutes les applications.
 */
export function JourneyCard(props: JourneyCardProps) {
  const { recommendation, onDismissed, variant = 'inline', silent = false } = props;
  const view = useMemo(() => journeyCardView(props), [recommendation.id, recommendation.projectId, props.lang, props.urls.dashboard, props.urls.icode]);
  const [opening, setOpening] = useState(false);
  const reported = useRef<string | null>(null);
  const float = variant === 'float';
  const titleId = `journey-${variant}-${recommendation.id}`;

  useEffect(() => {
    if (silent || reported.current === recommendation.id) return;
    reported.current = recommendation.id;
    journeyShown(props);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recommendation.id, silent]);

  const open = async () => {
    setOpening(true);
    try {
      await journeyOpen(props);
    } finally {
      setOpening(false);
    }
  };

  const dismiss = () => {
    journeyDismiss(props);
    onDismissed?.();
  };

  return (
    <section
      className={`glass-card idem-next${float ? ' idem-next--float' : ''}`}
      role={float ? 'status' : undefined}
      aria-labelledby={titleId}
      data-journey={recommendation.id}
    >
      <span className="idem-next-art" dangerouslySetInnerHTML={{ __html: journeyIllustration(recommendation.destination) }} />
      <div className="idem-next-text">
        <p className="idem-next-label">{view.label}</p>
        <h3 id={titleId} className="idem-next-title" title={float ? view.text.title : undefined}>
          {view.text.title}
        </h3>
        {view.text.body && (
          <p className="idem-next-body" title={float ? view.text.body : undefined}>
            {view.text.body}
          </p>
        )}
        <div className="idem-next-actions">
          <button type="button" className="inner-button button-sm" disabled={opening} onClick={open}>
            {opening && <IdemLoader size="xs" />}
            {view.text.cta}
            {!opening && <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: JOURNEY_ICONS.arrow }} />}
          </button>
          {!float && (
            <button type="button" className="button-ghost button-sm" onClick={dismiss}>
              {view.dismissLabel}
            </button>
          )}
        </div>
      </div>
      {float && (
        <button type="button" className="button-icon idem-next-close" aria-label={view.closeLabel} title={view.dismissLabel} onClick={dismiss}>
          <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: JOURNEY_ICONS.close }} />
        </button>
      )}
    </section>
  );
}

export type JourneyFloatProps = JourneyCardProps & {
  /** Sous la barre du haut de l'hôte (`--idem-float-top`), par défaut 1 rem. */
  top?: string;
  /** Le centre du contenu (`--idem-float-center`), par défaut le milieu de la fenêtre. */
  center?: string;
};

/**
 * La carte posée EN HAUT AU CENTRE de l'écran (`.idem-float-stack`), par-dessus la page, sans la repousser — comme
 * l'« étape suivante » du dashboard. Rendue dans `document.body` : aucun conteneur de l'hôte ne la rogne.
 */
export function JourneyFloat({ top, center, ...card }: JourneyFloatProps) {
  if (typeof document === 'undefined') return null;
  const style = { ...(top ? { '--idem-float-top': top } : {}), ...(center ? { '--idem-float-center': center } : {}) } as CSSProperties;
  // Enveloppé : le portail garde le type d'élément de l'hôte, quelle que soit sa version des types React.
  return (
    <>
      {createPortal(
        <div className="idem-float-stack" style={style}>
          <JourneyCard {...card} variant="float" />
        </div>,
        document.body
      )}
    </>
  );
}

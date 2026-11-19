import * as React from 'react';

/**
 * Isole une section : si elle plante à l'exécution, le reste de la page
 * s'affiche. En développement, l'erreur est montrée à sa place ; en ligne, la
 * section est simplement absente. Posé par IDEM.
 *
 * `defer` — hydratation différée. Une page pré-rendue arrive avec tout son
 * texte ; seul le JavaScript la rend interactive (hydratation), et hydrater
 * toute la page d'un coup occupe le navigateur pendant le premier affichage.
 * Une section différée garde le HTML pré-rendu tel quel et ne s'hydrate qu'à
 * l'approche de l'écran (400 px avant) ou quand le navigateur est libre.
 * Une section déjà visible au chargement s'hydrate tout de suite. Sans HTML
 * pré-rendu (aperçu de l'atelier, rendu côté client), `defer` ne change rien.
 */
export default class SectionBoundary extends React.Component<
  { name: string; defer?: boolean; children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(`[section ${this.props.name}]`, error);
  }

  render() {
    if (!this.state.error) return this.props.defer ? <Deferred>{this.props.children}</Deferred> : this.props.children;
    if (!import.meta.env.DEV) return null;
    return (
      <div role="alert" className="mx-auto my-6 max-w-content px-gutter">
        <div className="rounded-card border border-destructive/40 bg-destructive/5 p-4 text-small text-foreground">
          <strong>Section « {this.props.name} » en erreur :</strong> {this.state.error.message}
        </div>
      </div>
    );
  }
}

const ATTR = 'data-idem-defer';
/** Sans effet sur la mise en page : les enfants se placent comme si l'enveloppe n'existait pas. */
const CONTENTS: React.CSSProperties = { display: 'contents' };

/** Le HTML pré-rendu de la section, si la page est reprise et que la section est encore loin de l'écran. */
function serverMarkup(id: string): string | null {
  if (typeof window === 'undefined') return null;
  if (!(window as Window & { __IDEM_HYDRATING__?: boolean }).__IDEM_HYDRATING__) return null;
  const element = document.querySelector(`[${ATTR}="${CSS.escape(id)}"]`);
  if (!element || !element.firstElementChild) return null;
  const top = element.firstElementChild.getBoundingClientRect().top;
  if (top < window.innerHeight + 400) return null;
  return element.innerHTML;
}

function Deferred({ children }: { children: React.ReactNode }) {
  const id = React.useId();
  const [html] = React.useState(() => serverMarkup(id));
  const [live, setLive] = React.useState(html === null);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (live) return;
    let done = false;
    const wake = () => {
      if (done) return;
      done = true;
      setLive(true);
    };
    const observer = new IntersectionObserver((entries) => entries.some((entry) => entry.isIntersecting) && wake(), {
      rootMargin: '400px 0px',
    });
    // Le contenu d'une enveloppe `display: contents` n'a pas de boîte à elle : on observe son premier élément.
    if (ref.current) observer.observe(ref.current.firstElementChild ?? ref.current);
    // Navigateur libre : seulement après le chargement (images du haut de page comprises), pour ne rien lui disputer.
    let idle = 0;
    const schedule = () => {
      idle = window.requestIdleCallback ? window.requestIdleCallback(wake, { timeout: 5000 }) : window.setTimeout(wake, 1500);
    };
    if (document.readyState === 'complete') schedule();
    else window.addEventListener('load', schedule, { once: true });
    // Une interaction (clavier, toucher) dans la section la réveille aussi.
    const element = ref.current;
    element?.addEventListener('focusin', wake);
    element?.addEventListener('pointerdown', wake);
    return () => {
      done = true;
      observer.disconnect();
      window.removeEventListener('load', schedule);
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      element?.removeEventListener('focusin', wake);
      element?.removeEventListener('pointerdown', wake);
    };
  }, [live]);

  if (!live && html !== null) {
    // Le même HTML que celui du serveur : React le reprend sans le recréer ni le comparer.
    return <div key="static" ref={ref} {...{ [ATTR]: id }} style={CONTENTS} dangerouslySetInnerHTML={{ __html: html }} suppressHydrationWarning />;
  }
  return (
    <div key="live" {...{ [ATTR]: id }} style={CONTENTS}>
      {children}
    </div>
  );
}

import * as React from 'react';

/**
 * Isole une section : si elle plante à l'exécution, le reste de la page
 * s'affiche. En développement, l'erreur est montrée à sa place ; en ligne, la
 * section est simplement absente. Posé par IDEM.
 */
export default class SectionBoundary extends React.Component<
  { name: string; children: React.ReactNode },
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
    if (!this.state.error) return this.props.children;
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

import { useState, useEffect } from 'react';
import { ArrowRight, Palette, Contrast, ShieldCheck, MousePointerClick } from 'lucide-react';
import useAppGenContextStore from '@/stores/appgenContextSlice';
import { getCurrentUser } from '@/api/persistence/db';
import type { UserModel } from '@/api/persistence/userModel';
import { UserProfile } from '../Header/UserProfile';
import { redirectToLogin } from '@/hooks/useAuth';
import { Brand } from '@/components/Brand';
import { AppGenPricing } from './AppGenPricing';

const PENDING_PROMPT_KEY = 'appgen_pending_prompt';

interface AppGenLandingProps {
  onStart: (prompt?: string) => void;
}

const EXAMPLE_PROMPTS = [
  'Une application de gestion de tontines pour une association de quartier',
  'Un tableau de bord de suivi des livraisons pour un e-commerce à Dakar',
  'Un site vitrine pour une startup fintech à Lagos',
  'Une place de marché entre freelances et entreprises à Abidjan',
];

const DASHBOARD_URL = process.env.REACT_APP_IDEM_MAIN_APP_URL || 'http://localhost:4200';

export function AppGenLanding({ onStart }: AppGenLandingProps) {
  const [inputValue, setInputValue] = useState('');
  const [currentUser, setCurrentUser] = useState<UserModel | null>(null);
  const { initDraft } = useAppGenContextStore();

  useEffect(() => {
    getCurrentUser().then((user) => setCurrentUser(user));
  }, []);

  const handleStart = (prompt?: string) => {
    const finalPrompt = prompt || inputValue.trim() || undefined;
    if (!currentUser) {
      if (finalPrompt) localStorage.setItem(PENDING_PROMPT_KEY, finalPrompt);
      redirectToLogin('generate');
      return;
    }
    initDraft();
    onStart(finalPrompt);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (inputValue.trim()) handleStart();
    }
  };

  return (
    <div className="dark min-h-screen bg-bg-darker text-text-primary">
      <nav className="fixed top-0 inset-x-0 z-50 px-6 py-3.5 bg-bg-darker/85 backdrop-blur-xl border-b border-[var(--glass-border-subtle)]">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-6">
          <Brand size="md" variant="dark" />

          <div className="hidden md:flex items-center gap-7">
            <a href="#how" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
              Comment ça marche
            </a>
            <a href="#craft" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
              Ce qui change
            </a>
            <a href="#pricing" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
              Tarifs
            </a>
          </div>

          {currentUser ? (
            <UserProfile user={currentUser} />
          ) : (
            <button
              type="button"
              onClick={() => (window.location.href = `${DASHBOARD_URL}/login?from=appgen`)}
              className="h-9 px-4 rounded-lg border border-[var(--glass-border-medium)] text-sm text-text-primary hover:bg-surface-2 transition-colors"
            >
              Se connecter
            </button>
          )}
        </div>
      </nav>

      {/* ---------------- Hero ---------------- */}
      <section className="px-4 pt-36 pb-24">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-[clamp(2.5rem,6vw,4.25rem)] font-bold leading-[1.05] tracking-[-0.03em] text-balance">
            Décrivez votre idée.
            <br />
            iCode écrit l'application.
          </h1>
          <p className="mt-6 text-lg text-text-secondary max-w-xl text-pretty">
            Du code React lisible, un aperçu qui tourne pendant que vous parlez, et une édition au
            clic directement sur la page. Vous partez d'une phrase, ou d'un projet déjà analysé sur
            Idem.
          </p>

          <div className="mt-10 rounded-2xl border border-[var(--glass-border-medium)] bg-surface-1 overflow-hidden focus-within:border-primary transition-colors">
            <label htmlFor="idea" className="sr-only">
              Décrivez l'application à construire
            </label>
            <textarea
              id="idea"
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Un tableau de bord pour suivre les livraisons à Dakar…"
              rows={3}
              className="w-full bg-transparent text-text-primary placeholder:text-text-disabled text-base p-5 resize-none focus:outline-none"
            />
            <div className="flex items-center justify-between gap-3 px-5 pb-4">
              <span className="text-xs text-text-disabled">Entrée pour lancer</span>
              <button
                type="button"
                onClick={() => handleStart()}
                disabled={!inputValue.trim()}
                className="h-10 px-5 flex items-center gap-2 rounded-lg bg-primary text-white text-sm font-medium hover:brightness-110 active:brightness-95 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Générer
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {EXAMPLE_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => handleStart(prompt)}
                className="text-left text-[13px] text-text-tertiary hover:text-text-primary border border-[var(--glass-border)] hover:border-[var(--glass-border-strong)] rounded-full px-3.5 py-1.5 transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Deux points d'entrée ---------------- */}
      <section id="how" className="px-4 py-24 border-t border-[var(--glass-border-subtle)]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold tracking-[-0.02em] text-balance">
            Deux façons de commencer
          </h2>
          <p className="mt-3 text-text-secondary max-w-2xl text-pretty">
            Une idée en une phrase suffit. Mais si votre projet est déjà analysé sur Idem, iCode
            part de ce qui existe : la charte, les diagrammes, la configuration technique.
          </p>

          <div className="mt-10 grid gap-5 md:grid-cols-2">
            <article className="p-6 rounded-2xl border border-[var(--glass-border)] bg-surface-1">
              <h3 className="text-lg font-semibold">Depuis une phrase</h3>
              <p className="mt-2 text-sm text-text-secondary text-pretty">
                Vous écrivez ce que vous voulez construire, iCode choisit une direction visuelle
                propre à votre projet et génère l'application. Rien à configurer.
              </p>
              <button
                type="button"
                onClick={() => handleStart()}
                className="mt-5 h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-primary text-white text-sm font-medium hover:brightness-110 transition"
              >
                Commencer ici
                <ArrowRight className="w-4 h-4" />
              </button>
            </article>

            <article className="p-6 rounded-2xl border border-[var(--glass-border)] bg-surface-1">
              <h3 className="text-lg font-semibold">Depuis un projet Idem</h3>
              <p className="mt-2 text-sm text-text-secondary text-pretty">
                Business plan, charte graphique, diagrammes, choix techniques : tout ce qu'Idem a
                déjà produit sur votre projet alimente la génération. Le code sort aligné sur votre
                marque, pas sur une palette générique.
              </p>
              <a
                href={`${DASHBOARD_URL}/projects`}
                className="mt-5 h-9 px-4 inline-flex items-center gap-1.5 rounded-lg border border-[var(--glass-border-medium)] text-sm text-text-primary hover:bg-surface-2 transition-colors"
              >
                Ouvrir mes projets
                <ArrowRight className="w-4 h-4" />
              </a>
            </article>
          </div>
        </div>
      </section>

      {/* ---------------- Ce qui distingue ---------------- */}
      <section id="craft" className="px-4 py-24 border-t border-[var(--glass-border-subtle)]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold tracking-[-0.02em] text-balance">
            Ce que la plupart des générateurs ne font pas
          </h2>

          <dl className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2">
            <Feature
              icon={<Palette className="w-5 h-5" />}
              title="Deux projets ne se ressemblent jamais"
              body="Chaque projet tire une direction artistique dans un catalogue de styles mutuellement exclusifs. Pas de dégradé violet par défaut, pas de grille de trois cartes systématique."
            />
            <Feature
              icon={<Contrast className="w-5 h-5" />}
              title="Les contrastes sont calculés, pas espérés"
              body="La palette est forgée en OKLCH et vérifiée avant d'être envoyée au modèle. Le texte courant atteint 4,5:1 parce que c'est mesuré, pas parce que le modèle a bien voulu."
            />
            <Feature
              icon={<MousePointerClick className="w-5 h-5" />}
              title="On corrige au clic, pas au prompt"
              body="Cliquez un texte dans l'aperçu et corrigez-le : l'écriture va directement dans le code source. Aucun modèle appelé, aucun crédit consommé."
            />
            <Feature
              icon={<ShieldCheck className="w-5 h-5" />}
              title="Le déploiement reste chez vous"
              body="Publication via iDeploy, l'infrastructure de l'écosystème Idem. Le code généré est du React standard : il vous appartient et se reprend ailleurs."
            />
          </dl>
        </div>
      </section>

      <AppGenPricing onGetStarted={() => handleStart()} />

      <section className="px-4 py-24 border-t border-[var(--glass-border-subtle)]">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold tracking-[-0.02em] text-balance">
            Écrivez la première phrase
          </h2>
          <p className="mt-3 text-text-secondary">
            La génération est gratuite pour commencer. Aucune carte bancaire.
          </p>
          <button
            type="button"
            onClick={() => handleStart()}
            className="mt-7 h-11 px-6 inline-flex items-center gap-2 rounded-lg bg-primary text-white font-medium hover:brightness-110 active:brightness-95 transition"
          >
            Ouvrir iCode
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      <footer className="px-4 py-10 border-t border-[var(--glass-border-subtle)]">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <Brand size="sm" variant="dark" />
          <p className="text-sm text-text-tertiary">
            iCode fait partie de l'écosystème{' '}
            <a href="https://idem.africa" className="text-text-secondary hover:text-text-primary underline underline-offset-4">
              Idem
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-4">
      <span className="shrink-0 w-10 h-10 grid place-items-center rounded-lg bg-primary/12 text-primary">
        {icon}
      </span>
      <div className="min-w-0">
        <dt className="font-semibold text-text-primary text-balance">{title}</dt>
        <dd className="mt-1.5 text-sm text-text-secondary text-pretty">{body}</dd>
      </div>
    </div>
  );
}

export default AppGenLanding;

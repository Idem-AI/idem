import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Sparkles } from 'lucide-react';
import useAppGenContextStore from '@/stores/appgenContextSlice';
import { getCurrentUser } from '@/api/persistence/db';
import type { UserModel } from '@/api/persistence/userModel';
import { UserProfile } from '../Header/UserProfile';
import { redirectToLogin } from '@/hooks/useAuth';
import { Brand } from '@/components/Brand';
import Button, { ButtonLink } from '@/components/ui/Button';
import ThemeToggle from '@/components/ui/ThemeToggle';
import LanguageToggle from '@/components/ui/LanguageToggle';
import {
  ProductMockIllustration,
  ArtDirectionIllustration,
  ContrastIllustration,
  VisualEditIllustration,
  PublishPipelineIllustration,
} from '@/components/ui/Illustrations';
import { AppGenPricing } from './AppGenPricing';

const PENDING_PROMPT_KEY = 'appgen_pending_prompt';
const DASHBOARD_URL = process.env.REACT_APP_IDEM_MAIN_APP_URL || 'http://localhost:4200';

/** Clés d'exemples ; les textes vivent dans les fichiers de langue. */
const EXAMPLE_KEYS = ['tontine', 'delivery', 'fintech', 'marketplace'] as const;

interface AppGenLandingProps {
  onStart: (prompt?: string) => void;
}

/**
 * Page d'accueil d'iCode.
 *
 * Trois corrections par rapport à la version précédente :
 *
 * 1. **Le thème n'est plus forcé.** La page s'ouvrait dans un conteneur
 *    `.dark` codé en dur, si bien qu'un compte réglé en clair basculait en
 *    sombre en passant du builder à l'accueil. Le thème vient maintenant de
 *    `<html>`, comme partout ailleurs, et la bascule écrit dans le cookie
 *    partagé entre applications.
 * 2. **Tous les textes passent par l'i18n.** Ils étaient en français dans le
 *    code, ce qui rendait la page monolingue quelle que soit la langue choisie.
 * 3. **Le produit se montre.** Une maquette de l'interface remplace les photos
 *    de bureaux, et chaque argument porte une illustration de son mécanisme.
 */
export function AppGenLanding({ onStart }: AppGenLandingProps) {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState('');
  const [currentUser, setCurrentUser] = useState<UserModel | null>(null);
  const { initDraft } = useAppGenContextStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    getCurrentUser().then(setCurrentUser);
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

  /** Un exemple ne part pas seul : il remplit le champ et rend la main, pour
   *  qu'on puisse l'ajuster avant de lancer. */
  const useExample = (text: string) => {
    setInputValue(text);
    textareaRef.current?.focus();
  };

  return (
    <div className="min-h-screen bg-bg-darker text-text-primary">
      {/* ---------------- Navigation ---------------- */}
      <nav className="fixed top-0 inset-x-0 z-50 px-4 sm:px-6 py-3 bg-bg-darker/85 backdrop-blur-xl border-b border-[var(--glass-border-subtle)]">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <Brand size="md" />

          <div className="hidden md:flex items-center gap-7">
            <NavLink href="#how">{t('landing.nav.how')}</NavLink>
            <NavLink href="#craft">{t('landing.nav.craft')}</NavLink>
            <NavLink href="#pricing">{t('landing.nav.pricing')}</NavLink>
          </div>

          <div className="flex items-center gap-1.5">
            <LanguageToggle className="hidden sm:flex" />
            <ThemeToggle />
            {currentUser ? (
              <UserProfile user={currentUser} />
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => (window.location.href = `${DASHBOARD_URL}/login?from=appgen`)}
              >
                {t('landing.nav.signIn')}
              </Button>
            )}
          </div>
        </div>
      </nav>

      {/* ---------------- Hero ---------------- */}
      <section className="relative px-4 pt-32 pb-16 sm:pt-40">
        {/* Halo discret derrière le champ : il désigne le point d'entrée sans
            devenir un décor. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-24 mx-auto h-72 w-[min(680px,90%)] rounded-full bg-primary/10 blur-3xl"
        />

        <div className="relative max-w-3xl mx-auto text-center">
          <h1 className="text-[clamp(2.25rem,6vw,3.75rem)] font-bold leading-[1.06] tracking-[-0.03em] text-balance">
            {t('landing.hero.title1')}
            <br />
            <span className="text-primary">{t('landing.hero.title2')}</span>
          </h1>

          <p className="mt-5 mx-auto max-w-xl text-base sm:text-lg text-text-secondary text-pretty">
            {t('landing.hero.lede')}
          </p>

          <div className="mt-9 rounded-2xl border border-[var(--glass-border-medium)] bg-surface-1 shadow-[var(--glass-shadow-lg)] overflow-hidden text-left focus-within:border-primary transition-colors">
            <label htmlFor="idea" className="sr-only">
              {t('landing.hero.placeholder')}
            </label>
            <textarea
              id="idea"
              ref={textareaRef}
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('landing.hero.placeholder')}
              rows={3}
              className="w-full bg-transparent text-text-primary placeholder:text-text-disabled text-base p-5 resize-none focus:outline-none"
            />
            <div className="flex items-center justify-between gap-3 px-4 pb-4">
              <span className="text-xs text-text-disabled">{t('landing.hero.hint')}</span>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleStart()}
                disabled={!inputValue.trim()}
                icon={<Sparkles className="w-4 h-4" />}
              >
                {t('landing.hero.cta')}
              </Button>
            </div>
          </div>

          <p className="mt-6 text-xs text-text-disabled">{t('landing.hero.tryLabel')}</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {EXAMPLE_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => useExample(t(`landing.examples.${key}`))}
                className="text-[13px] text-text-tertiary hover:text-text-primary border border-[var(--glass-border)] hover:border-primary/50 rounded-full px-3.5 py-1.5 transition-colors"
              >
                {t(`landing.examples.${key}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Maquette du produit : ce qu'on obtient après avoir écrit la phrase. */}
        <div className="relative mt-16 max-w-5xl mx-auto">
          <div className="rounded-2xl border border-[var(--glass-border)] bg-surface-1 p-3 sm:p-5 shadow-[var(--glass-shadow-xl)]">
            <ProductMockIllustration />
          </div>
        </div>
      </section>

      {/* ---------------- Deux points d'entrée ---------------- */}
      <section id="how" className="px-4 py-20 border-t border-[var(--glass-border-subtle)]">
        <div className="max-w-5xl mx-auto">
          <SectionHead title={t('landing.entries.title')} lede={t('landing.entries.lede')} />

          <div className="mt-10 grid gap-5 md:grid-cols-2">
            <article className="flex flex-col p-6 rounded-2xl border border-[var(--glass-border)] bg-surface-1">
              <h3 className="text-lg font-semibold">{t('landing.entries.prompt.title')}</h3>
              <p className="mt-2 flex-1 text-sm text-text-secondary text-pretty">
                {t('landing.entries.prompt.body')}
              </p>
              <Button variant="primary" size="sm" onClick={() => handleStart()} className="mt-5 self-start">
                {t('landing.entries.prompt.cta')}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </article>

            <article className="flex flex-col p-6 rounded-2xl border border-[var(--glass-border)] bg-surface-1">
              <div className="mb-3 grid place-items-center">
                <PublishPipelineIllustration size={72} />
              </div>
              <h3 className="text-lg font-semibold">{t('landing.entries.project.title')}</h3>
              <p className="mt-2 flex-1 text-sm text-text-secondary text-pretty">
                {t('landing.entries.project.body')}
              </p>
              <ButtonLink
                variant="secondary"
                size="sm"
                href={`${DASHBOARD_URL}/projects`}
                className="mt-5 self-start"
              >
                {t('landing.entries.project.cta')}
                <ArrowRight className="w-4 h-4" />
              </ButtonLink>
            </article>
          </div>
        </div>
      </section>

      {/* ---------------- Ce qui distingue ---------------- */}
      <section id="craft" className="px-4 py-20 border-t border-[var(--glass-border-subtle)]">
        <div className="max-w-5xl mx-auto">
          <SectionHead title={t('landing.craft.title')} lede={t('landing.craft.lede')} />

          <div className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2">
            <Feature
              illustration={<ArtDirectionIllustration />}
              title={t('landing.craft.direction.title')}
              body={t('landing.craft.direction.body')}
            />
            <Feature
              illustration={<ContrastIllustration />}
              title={t('landing.craft.contrast.title')}
              body={t('landing.craft.contrast.body')}
            />
            <Feature
              illustration={<VisualEditIllustration />}
              title={t('landing.craft.visual.title')}
              body={t('landing.craft.visual.body')}
            />
            <Feature
              illustration={<PublishPipelineIllustration size={76} />}
              title={t('landing.craft.sovereign.title')}
              body={t('landing.craft.sovereign.body')}
            />
          </div>
        </div>
      </section>

      <AppGenPricing onGetStarted={() => handleStart()} />

      {/* ---------------- Appel final ---------------- */}
      <section className="px-4 py-20 border-t border-[var(--glass-border-subtle)]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold tracking-[-0.02em] text-balance">
            {t('landing.cta.title')}
          </h2>
          <p className="mt-3 text-text-secondary">{t('landing.cta.lede')}</p>
          <div className="mt-7 flex justify-center">
            <Button variant="primary" size="md" onClick={() => handleStart()}>
              {t('landing.cta.button')}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </section>

      <footer className="px-4 py-10 border-t border-[var(--glass-border-subtle)]">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <Brand size="sm" />
          <p className="text-sm text-text-tertiary">
            {t('landing.footer.tagline')}{' '}
            <a
              href="https://idem.africa"
              className="text-text-secondary hover:text-text-primary underline underline-offset-4"
            >
              Idem
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="text-sm text-text-secondary hover:text-text-primary transition-colors"
    >
      {children}
    </a>
  );
}

function SectionHead({ title, lede }: { title: string; lede: string }) {
  return (
    <div className="max-w-2xl">
      <h2 className="text-3xl md:text-4xl font-bold tracking-[-0.02em] text-balance">{title}</h2>
      <p className="mt-3 text-text-secondary text-pretty">{lede}</p>
    </div>
  );
}

function Feature({
  illustration,
  title,
  body,
}: {
  illustration: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div>
      <div className="mb-4 h-20 flex items-center">{illustration}</div>
      <h3 className="font-semibold text-text-primary text-balance">{title}</h3>
      <p className="mt-2 text-sm text-text-secondary text-pretty">{body}</p>
    </div>
  );
}

export default AppGenLanding;

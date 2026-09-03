import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, ChevronDown } from 'lucide-react';
import useAppGenContextStore from '@/stores/appgenContextSlice';
import { getCurrentUser } from '@/api/persistence/db';
import { uploadImage } from '@/api/chat';
import useChatStore from '@/stores/chatSlice';
import { toast } from 'react-toastify';
import type { UserModel } from '@/api/persistence/userModel';
import { UserProfile } from '../Header/UserProfile';
import { redirectToLogin } from '@/hooks/useAuth';
import { Brand } from '@/components/Brand';
import Button, { ButtonLink } from '@/components/ui/Button';
import ThemeToggle from '@/components/ui/ThemeToggle';
import LanguageToggle from '@/components/ui/LanguageToggle';
import PromptComposer, { type ComposerAttachment } from '@/components/ui/PromptComposer';
import { SignInPrompt } from './SignInPrompt';
import {
  ProductMockIllustration,
  ArtDirectionIllustration,
  ContrastIllustration,
  VisualEditIllustration,
  PublishPipelineIllustration,
} from '@/components/ui/Illustrations';
import { AppGenPricing } from './AppGenPricing';
import { TrustedBy } from '@idem/shared-trusted-by/react';

const PENDING_PROMPT_KEY = 'appgen_pending_prompt';
const DASHBOARD_URL = process.env.REACT_APP_IDEM_MAIN_APP_URL || 'http://localhost:4200';

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
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [currentUser, setCurrentUser] = useState<UserModel | null>(null);
  const [signInOpen, setSignInOpen] = useState(false);
  const { initDraft } = useAppGenContextStore();

  useEffect(() => {
    getCurrentUser().then(setCurrentUser);
  }, []);

  // Les invites défilent dans le champ. `returnObjects` rend la clé elle-même
  // quand elle manque : le garde-fou évite d'afficher un identifiant brut.
  const rawPlaceholders = t('landing.hero.placeholders', { returnObjects: true });
  const placeholders = Array.isArray(rawPlaceholders) ? (rawPlaceholders as string[]) : [];

  /**
   * Transmet les pièces jointes à la conversation.
   *
   * Les images rejoignent le store du chat, qui les envoie au modèle. Les
   * fichiers texte sont lus ici et joints à la demande : leur contenu est
   * exploitable tel quel comme contexte, contrairement à un nom de fichier.
   */
  const forwardAttachments = async (prompt: string | undefined) => {
    if (!attachments.length) return prompt;

    const images = attachments.filter((item) => item.kind === 'image');
    const documents = attachments.filter((item) => item.kind === 'document');

    if (images.length) {
      const uploaded = await Promise.all(
        images.map(async (item) => ({
          id: item.id,
          file: item.file,
          url: await uploadImage(item.file),
          localUrl: item.preview ?? '',
          status: 'done' as const,
        }))
      );
      useChatStore.getState().addImages(uploaded);
    }

    if (!documents.length) return prompt;

    const contents = await Promise.all(
      documents.map(async (item) => `--- ${item.file.name} ---\n${await item.file.text()}`)
    );

    return [prompt, ...contents].filter(Boolean).join('\n\n');
  };

  const handleStart = async (prompt?: string) => {
    const typed = prompt || inputValue.trim() || undefined;

    if (!currentUser) {
      // La demande est mise de côté avant toute chose : c'est elle qui sera
      // rejouée après la connexion, et la modale s'appuie dessus pour montrer
      // qu'elle n'est pas perdue.
      if (typed) localStorage.setItem(PENDING_PROMPT_KEY, typed);
      setSignInOpen(true);
      return;
    }

    let finalPrompt = typed;
    try {
      finalPrompt = await forwardAttachments(typed);
    } catch (error) {
      // Une pièce jointe illisible ne doit pas empêcher de lancer la
      // génération : on part avec la demande écrite.
      console.warn('[landing] pièces jointes non transmises', error);
      toast.error(t('composer.attachmentsFailed'));
    }

    initDraft();
    onStart(finalPrompt);
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
      {/* Pleine hauteur : la page s'ouvre sur une seule chose à faire — écrire
          la phrase. Le motif de marque donne la matière du fond, comme sur les
          autres surfaces Idem. */}
      <section className="relative min-h-screen flex flex-col justify-center px-4 pt-24 pb-20 motif-surface">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-1/4 mx-auto h-80 w-[min(720px,92%)] rounded-full bg-primary/10 blur-3xl"
        />

        <div className="relative w-full max-w-3xl mx-auto text-center">
          <h1 className="text-[clamp(2.25rem,6.5vw,4rem)] font-bold leading-[1.08] tracking-[-0.03em] text-balance">
            {t('landing.hero.titleLead')}{' '}
            <span className="i-underline">{t('landing.hero.titleAccent')}</span>
          </h1>

          <p className="mt-7 mx-auto max-w-xl text-base sm:text-lg text-text-secondary text-pretty">
            {t('landing.hero.lede')}
          </p>

          <PromptComposer
            className="mt-10 text-left"
            value={inputValue}
            onChange={setInputValue}
            onSubmit={() => handleStart()}
            placeholders={placeholders}
            attachments={attachments}
            onAttachmentsChange={setAttachments}
          />
        </div>

        {/* Repère de défilement : la pleine hauteur cache ce qui suit, il faut
            dire qu'il y a une suite. */}
        <a
          href="#how"
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 text-xs text-text-disabled hover:text-text-secondary transition-colors"
        >
          {t('landing.hero.scroll')}
          <ChevronDown className="w-4 h-4 animate-bounce" />
        </a>
      </section>

      {/* ---------------- Le produit ---------------- */}
      <section className="px-4 pb-20">
        <div className="max-w-5xl mx-auto rounded-2xl border border-[var(--glass-border)] bg-surface-1 p-3 sm:p-5 shadow-[var(--glass-shadow-xl)]">
          <ProductMockIllustration />
        </div>
      </section>

      {/* ---------------- Ils nous font confiance ---------------- */}
      <TrustedBy label={t('landing.trustedBy')} />

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

      <SignInPrompt
        open={signInOpen}
        prompt={inputValue.trim() || undefined}
        onClose={() => setSignInOpen(false)}
        onSignIn={() => redirectToLogin('generate')}
      />

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

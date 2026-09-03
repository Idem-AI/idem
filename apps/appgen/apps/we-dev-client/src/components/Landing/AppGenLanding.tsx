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
      <nav className="fixed top-0 inset-x-0 z-50 px-6 py-3.5 bg-bg-darker/80 backdrop-blur-xl">
        <div className="max-w-[62rem] mx-auto flex items-center justify-between gap-4">
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
      {/* Pleine hauteur, rien d'autre à l'écran que la phrase à écrire.
          Aucune décoration : le halo en dégradé qui traînait derrière le champ
          était un ornement sans fonction, et c'est précisément le marqueur des
          pages générées à la chaîne. Le motif de marque suffit à porter le fond. */}
      <section className="min-h-screen flex flex-col justify-center px-6 pt-28 pb-24 motif-surface">
        <div className="w-full max-w-[46rem] mx-auto text-center">
          <h1 className="text-[clamp(2.5rem,7vw,4.5rem)] font-semibold leading-[1.02] tracking-[-0.045em] text-balance">
            {t('landing.hero.titleLead')}{' '}
            <span className="i-underline">{t('landing.hero.titleAccent')}</span>
          </h1>

          <p className="mt-8 mx-auto max-w-lg text-[17px] leading-relaxed text-text-tertiary text-pretty">
            {t('landing.hero.lede')}
          </p>

          <PromptComposer
            className="mt-11 text-left"
            value={inputValue}
            onChange={setInputValue}
            onSubmit={() => handleStart()}
            placeholders={placeholders}
            attachments={attachments}
            onAttachmentsChange={setAttachments}
          />

          <p className="mt-5 text-[13px] text-text-disabled">{t('landing.cta.lede')}</p>
        </div>

        <a
          href="#how"
          className="mt-20 mx-auto flex flex-col items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-text-disabled hover:text-text-secondary transition-colors"
        >
          {t('landing.hero.scroll')}
          <ChevronDown className="w-3.5 h-3.5" />
        </a>
      </section>

      {/* ---------------- L'atelier ---------------- */}
      {/* Sans cadre ni carte : la maquette se pose sur la page. Un liseré et une
          ombre auraient fait « capture d'écran encadrée », ce qui l'éloigne au
          lieu de la montrer. */}
      <section className="px-6 pb-28">
        <div className="max-w-[62rem] mx-auto">
          <ProductMockIllustration />
        </div>
      </section>

      {/* ---------------- Ils nous font confiance ---------------- */}
      <TrustedBy label={t('landing.trustedBy')} />

      {/* ---------------- Deux points d'entrée ---------------- */}
      {/* Deux colonnes de largeurs inégales, séparées par un filet vertical.
          Aucune carte : la hiérarchie vient de la largeur et du poids du texte,
          pas d'un rectangle bordé autour de chaque idée. */}
      <section id="how" className="px-6 py-28">
        <div className="max-w-[62rem] mx-auto">
          <h2 className="max-w-xl text-[clamp(1.75rem,3.4vw,2.5rem)] font-semibold leading-tight tracking-[-0.03em] text-balance">
            {t('landing.entries.title')}
          </h2>
          <p className="mt-4 max-w-xl text-text-tertiary text-pretty">
            {t('landing.entries.lede')}
          </p>

          <div className="mt-14 grid gap-12 lg:grid-cols-12 lg:gap-0">
            <div className="lg:col-span-6 lg:pr-14">
              <h3 className="text-xl font-semibold text-balance">
                {t('landing.entries.prompt.title')}
              </h3>
              <p className="mt-3 text-[15px] leading-relaxed text-text-tertiary text-pretty">
                {t('landing.entries.prompt.body')}
              </p>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleStart()}
                className="mt-6"
              >
                {t('landing.entries.prompt.cta')}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>

            <div className="hidden lg:block lg:col-span-1 justify-self-center w-px bg-[var(--glass-border-subtle)]" />

            <div className="lg:col-span-5 lg:pl-2">
              <h3 className="text-xl font-semibold text-balance">
                {t('landing.entries.project.title')}
              </h3>
              <p className="mt-3 text-[15px] leading-relaxed text-text-tertiary text-pretty">
                {t('landing.entries.project.body')}
              </p>
              <ButtonLink
                variant="secondary"
                size="sm"
                href={`${DASHBOARD_URL}/projects`}
                className="mt-6"
              >
                {t('landing.entries.project.cta')}
              </ButtonLink>
            </div>
          </div>

          <p className="mt-14 text-[13px] text-text-disabled">
            {t('landing.entries.converge')}
          </p>
        </div>
      </section>

      {/* ---------------- Ce qui distingue ---------------- */}
      {/* Lignes pleine largeur qui alternent de côté, séparées par de l'air
          plutôt que par des bordures. */}
      <section id="craft" className="px-6 py-28">
        <div className="max-w-[62rem] mx-auto">
          <h2 className="max-w-xl text-[clamp(1.75rem,3.4vw,2.5rem)] font-semibold leading-tight tracking-[-0.03em] text-balance">
            {t('landing.craft.title')}
          </h2>

          <div className="mt-20 space-y-24">
            <CraftRow
              visual={<ArtDirectionIllustration size={112} />}
              title={t('landing.craft.direction.title')}
              body={t('landing.craft.direction.body')}
            />

            {/* Le contraste est le seul argument chiffrable : il porte un
                relevé réel plutôt qu'une image de plus. */}
            <CraftRow
              flip
              visual={
                <div className="w-full max-w-[230px]">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-text-disabled">
                    {t('landing.craft.contrastBadge')}
                  </p>
                  <p className="mt-3 flex items-baseline gap-2.5">
                    <span className="text-[2.75rem] font-semibold tabular-nums leading-none text-success">
                      7.4
                    </span>
                    <span className="text-lg text-text-disabled">:1</span>
                    <span className="ml-auto text-[11px] font-semibold text-success">AA</span>
                  </p>
                  <div className="mt-4 h-px bg-[var(--glass-border)]">
                    <div className="h-px w-[82%] bg-success" />
                  </div>
                  <p className="mt-3 text-[12px] text-text-disabled">
                    {t('landing.craft.contrastNote')}
                  </p>
                </div>
              }
              title={t('landing.craft.contrast.title')}
              body={t('landing.craft.contrast.body')}
            />

            <CraftRow
              visual={<VisualEditIllustration size={112} />}
              title={t('landing.craft.visual.title')}
              body={t('landing.craft.visual.body')}
            />

            <CraftRow
              flip
              visual={<PublishPipelineIllustration size={112} />}
              title={t('landing.craft.sovereign.title')}
              body={t('landing.craft.sovereign.body')}
            />
          </div>
        </div>
      </section>

      <AppGenPricing onGetStarted={() => handleStart()} />

      {/* ---------------- Appel final ---------------- */}
      <section className="px-6 py-32">
        <div className="max-w-[46rem] mx-auto text-center">
          <h2 className="text-[clamp(1.75rem,3.4vw,2.5rem)] font-semibold leading-tight tracking-[-0.03em] text-balance">
            {t('landing.cta.title')}
          </h2>
          <div className="mt-9 flex justify-center">
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

      <footer className="px-6 py-12 border-t border-[var(--glass-border-subtle)]">
        <div className="max-w-[62rem] mx-auto flex flex-wrap items-center justify-between gap-4">
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

/**
 * Une ligne d'argument.
 *
 * `flip` inverse l'ordre visuel sans toucher à l'ordre du DOM : la lecture
 * reste « titre puis texte » pour un lecteur d'écran, alors que l'œil voit
 * l'illustration changer de côté d'une ligne à l'autre.
 */
function CraftRow({
  visual,
  title,
  body,
  flip,
}: {
  visual: React.ReactNode;
  title: string;
  body: string;
  flip?: boolean;
}) {
  return (
    <div className="grid gap-8 md:grid-cols-12 md:items-center md:gap-12">
      <div
        className={`md:col-span-4 flex ${
          flip ? 'md:order-2 md:justify-end' : 'md:justify-start'
        }`}
      >
        {visual}
      </div>
      <div className={`md:col-span-8 ${flip ? 'md:order-1' : ''}`}>
        <h3 className="text-[1.35rem] font-semibold leading-snug tracking-[-0.02em] text-balance">
          {title}
        </h3>
        <p className="mt-4 max-w-[58ch] text-[15px] leading-[1.7] text-text-tertiary text-pretty">
          {body}
        </p>
      </div>
    </div>
  );
}

export default AppGenLanding;

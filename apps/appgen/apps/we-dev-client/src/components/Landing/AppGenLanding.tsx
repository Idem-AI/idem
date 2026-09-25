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
  SovereignDeployIllustration,
  EntryPromptIllustration,
  EntryProjectIllustration,
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

  // Aucun fond ici ni sur les sections : la couleur est portée par <html> et
  // le motif de marque par `body::before` (@idem/shared-styles). Repeindre le
  // conteneur les masquait partout sauf dans le hero.
  return (
    <div className="min-h-screen text-text-primary">
      {/* ---------------- Navigation ---------------- */}
      <nav className="fixed top-0 inset-x-0 z-50 px-6 py-3.5 bg-bg-darker/80 backdrop-blur-xl">
        <div className="max-w-[68rem] mx-auto flex items-center justify-between gap-4">
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
          pages générées à la chaîne. Le motif de marque du body suffit à porter le
          fond. */}
      <section className="min-h-screen flex flex-col justify-center px-6 pt-28 pb-24">
        <div className="w-full max-w-[46rem] mx-auto text-center">
          <h1 className="text-[clamp(2.5rem,7vw,4.5rem)] font-semibold leading-[1.02] text-balance">
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
          className="mt-20 mx-auto flex flex-col items-center gap-1.5 text-[11px] uppercase text-text-disabled hover:text-text-secondary transition-colors"
        >
          {t('landing.hero.scroll')}
          <ChevronDown className="w-3.5 h-3.5" />
        </a>
      </section>

      {/* ---------------- L'atelier ---------------- */}
      {/* Sans cadre ni carte : la maquette se pose sur la page. Un liseré et une
          ombre auraient fait « capture d'écran encadrée », ce qui l'éloigne au
          lieu de la montrer. */}
      <section className="px-6 pb-24">
        <div className="max-w-[68rem] mx-auto">
          <ProductMockIllustration />
        </div>
      </section>

      {/* ---------------- Ils nous font confiance ---------------- */}
      <TrustedBy label={t('landing.trustedBy')} />

      {/* ---------------- Deux points d'entrée ---------------- */}
      {/* Deux panneaux de même largeur : c'est un choix entre deux options, et
          l'illustration en tête de chacun montre le mécanisme avant la lecture
          — une phrase qui devient une application, des livrables qui
          convergent vers le code. */}
      <section id="how" className="px-6 pt-24 pb-12">
        <div className="max-w-[68rem] mx-auto">
          <SectionHeading title={t('landing.entries.title')} lede={t('landing.entries.lede')} />

          <div className="mt-14 grid gap-14 md:grid-cols-2 md:gap-6">
            <EntryPanel
              visual={<EntryPromptIllustration />}
              title={t('landing.entries.prompt.title')}
              body={t('landing.entries.prompt.body')}
              action={
                <Button variant="primary" size="sm" onClick={() => handleStart()}>
                  {t('landing.entries.prompt.cta')}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              }
            />
            <EntryPanel
              visual={<EntryProjectIllustration />}
              title={t('landing.entries.project.title')}
              body={t('landing.entries.project.body')}
              action={
                <ButtonLink variant="secondary" size="sm" href={`${DASHBOARD_URL}/projects`}>
                  {t('landing.entries.project.cta')}
                </ButtonLink>
              }
            />
          </div>

          <p className="mt-8 text-center text-[13px] text-text-disabled">
            {t('landing.entries.converge')}
          </p>
        </div>
      </section>

      {/* ---------------- Ce qui distingue ---------------- */}
      {/* Trois compositions différentes plutôt qu'une même ligne répétée
          quatre fois : une vedette (texte à gauche, grande image à droite), une
          paire d'arguments côte à côte, puis une conclusion centrée. Aucun fond
          sous les images : elles se posent directement sur la page. */}
      <section id="craft" className="px-6 pt-12 pb-8">
        <div className="max-w-[68rem] mx-auto">
          <SectionHeading title={t('landing.craft.title')} lede={t('landing.craft.lede')} />

          {/* Vedette */}
          <div className="mt-16 grid gap-10 md:grid-cols-12 md:items-center md:gap-12">
            <CraftText
              className="md:col-span-5"
              title={t('landing.craft.direction.title')}
              body={t('landing.craft.direction.body')}
            />
            <div className="md:col-span-7 flex justify-center md:justify-end">
              <ArtDirectionIllustration className="max-w-[560px]" />
            </div>
          </div>

          {/* Paire : le texte d'abord, l'image en dessous */}
          <div className="mt-24 md:mt-32 grid gap-20 md:grid-cols-2 md:gap-16">
            <div>
              <CraftText
                title={t('landing.craft.contrast.title')}
                body={t('landing.craft.contrast.body')}
              />
              {/* Le contraste est le seul argument chiffrable : il porte un
                  relevé réel plutôt qu'une image de plus. */}
              <div className="mt-12">
                <ContrastReading />
              </div>
            </div>
            <div>
              <CraftText
                title={t('landing.craft.visual.title')}
                body={t('landing.craft.visual.body')}
              />
              <div className="mt-10">
                <VisualEditIllustration className="max-w-[460px]" />
              </div>
            </div>
          </div>

          {/* Conclusion centrée */}
          <div className="mt-24 md:mt-32 flex flex-col items-center text-center">
            <CraftText
              centered
              className="max-w-xl"
              title={t('landing.craft.sovereign.title')}
              body={t('landing.craft.sovereign.body')}
            />
            <SovereignDeployIllustration className="mt-12 max-w-[600px]" />
          </div>
        </div>
      </section>

      <AppGenPricing onGetStarted={() => handleStart()} />

      {/* ---------------- Appel final ---------------- */}
      <section className="px-6 py-24">
        <div className="max-w-[46rem] mx-auto text-center">
          <h2 className="text-[clamp(1.75rem,3.4vw,2.5rem)] font-semibold leading-tight text-balance">
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
        <div className="max-w-[68rem] mx-auto flex flex-wrap items-center justify-between gap-4">
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

function SectionHeading({ title, lede }: { title: string; lede?: string }) {
  return (
    <div className="max-w-2xl">
      <h2 className="text-[clamp(1.75rem,3.4vw,2.5rem)] font-semibold leading-tight text-balance">
        {title}
      </h2>
      {lede && <p className="mt-4 text-[17px] text-text-tertiary text-pretty">{lede}</p>}
    </div>
  );
}

function EntryPanel({
  visual,
  title,
  body,
  action,
}: {
  visual: React.ReactNode;
  title: string;
  body: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex flex-col">
      {/* Hauteur fixe : les deux titres démarrent sur la même ligne, même si
          les illustrations n'ont pas les mêmes proportions. */}
      <div className="aspect-[16/9] flex items-center justify-center">{visual}</div>
      <div className="flex flex-1 flex-col pt-6">
        <h3 className="text-[1.35rem] font-semibold leading-snug text-balance">{title}</h3>
        <p className="mt-3 max-w-[52ch] text-[15px] leading-[1.7] text-text-tertiary text-pretty">
          {body}
        </p>
        {/* Poussé en bas : les deux boutons s'alignent même si les textes
            n'ont pas la même longueur. */}
        <div className="mt-auto pt-6">{action}</div>
      </div>
    </div>
  );
}

/**
 * Relevé de contraste, à l'échelle d'une illustration.
 *
 * La jauge va de 0 à 9:1 et porte le seuil AA (4,5:1) : on voit la marge,
 * pas seulement le chiffre.
 */
function ContrastReading() {
  const { t } = useTranslation();
  const ratio = 7.4;
  const scaleMax = 9;
  const threshold = 4.5;

  return (
    <div className="w-full max-w-[400px]">
      <div className="flex items-center gap-6">
        <div
          aria-hidden
          className="grid place-items-center w-24 h-24 sm:w-28 sm:h-28 shrink-0 rounded-2xl bg-surface-1 border border-[var(--glass-border)] text-[3rem] sm:text-[3.5rem] font-semibold leading-none text-text-primary"
        >
          Aa
        </div>
        <div className="min-w-0">
          <p className="text-[11px] uppercase text-text-disabled">
            {t('landing.craft.contrastBadge')}
          </p>
          <p className="mt-2 flex items-baseline gap-2">
            <span className="text-[3.5rem] sm:text-[4rem] font-semibold tabular-nums leading-none text-success">
              {ratio}
            </span>
            <span className="text-xl text-text-disabled">:1</span>
            <span className="ml-2 px-2 py-0.5 rounded-md text-[11px] font-semibold text-success bg-success/12">
              AA
            </span>
          </p>
        </div>
      </div>

      <div className="relative mt-9 h-1.5 rounded-full bg-[var(--glass-border)]">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-success"
          style={{ width: `${(ratio / scaleMax) * 100}%` }}
        />
        <div
          className="absolute -top-2 -bottom-2 w-px bg-text-tertiary"
          style={{ left: `${(threshold / scaleMax) * 100}%` }}
        />
      </div>
      <div className="relative mt-3 h-4 text-[11px] tabular-nums text-text-disabled">
        <span className="absolute left-0">0</span>
        <span
          className="absolute -translate-x-1/2"
          style={{ left: `${(threshold / scaleMax) * 100}%` }}
        >
          {threshold}:1 · AA
        </span>
      </div>

      <p className="mt-6 text-[13px] text-text-tertiary">{t('landing.craft.contrastNote')}</p>
    </div>
  );
}

/** Titre et texte d'un argument ; la position est décidée par l'appelant. */
function CraftText({
  title,
  body,
  className = '',
  centered,
}: {
  title: string;
  body: string;
  className?: string;
  centered?: boolean;
}) {
  return (
    <div className={className}>
      <h3 className="text-[clamp(1.4rem,2.4vw,1.85rem)] font-semibold leading-snug text-balance">
        {title}
      </h3>
      <p
        className={`mt-4 max-w-[46ch] ${centered ? 'mx-auto' : ''} text-base leading-[1.7] text-text-tertiary text-pretty`}
      >
        {body}
      </p>
    </div>
  );
}

export default AppGenLanding;

import { ProjectTitle } from './ProjectTitle';
import { HeaderActions } from './HeaderActions';
import { ModeToggle } from './ModeToggle';
import { CreditsBadge } from './CreditsBadge';
import { Brand } from '@/components/Brand';

/**
 * En-tête du builder.
 *
 * L'ancienne barre faisait 48 px et servait à trois choses : montrer le logo,
 * nommer le projet, et cacher les actions derrière deux boutons. Elle ne disait
 * ni comment on travaille, ni ce qu'on a consommé, ni où en est la publication.
 *
 * Elle porte désormais l'état de la session, de gauche à droite : la marque,
 * le projet en cours, le mode de travail (Plan / Build), les crédits restants
 * et la publication. Tout le reste — historique des versions, export, GitHub —
 * vit dans le menu d'actions, parce que ce sont des gestes ponctuels et non
 * des informations à garder sous les yeux.
 */
function Header() {
  return (
    <header
      data-tour="appgen-header"
      className="h-14 shrink-0 flex items-center gap-3 px-3 border-b border-[var(--glass-border)] bg-surface-1"
    >
      <div className="shrink-0 flex items-center">
        <Brand size="sm" />
      </div>

      <div className="w-px h-6 bg-[var(--glass-border)] shrink-0" aria-hidden />

      <div className="flex-1 min-w-0">
        <ProjectTitle />
      </div>

      <div className="shrink-0 flex items-center gap-2">
        <ModeToggle />

        <CreditsBadge />

        <HeaderActions />
      </div>
    </header>
  );
}

export default Header;

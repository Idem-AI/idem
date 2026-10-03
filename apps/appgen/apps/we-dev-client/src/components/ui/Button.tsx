import React from 'react';
import { IdemLoader } from '@idem/shared-loader/react';

/**
 * Boutons du design system Idem.
 *
 * Le builder s'était mis à peindre ses propres boutons (`bg-primary text-white`
 * et variantes), alors que `@idem/shared-styles` en définit déjà un jeu complet.
 * Résultat : deux vocabulaires visuels dans la même application. Ce composant
 * ferme la porte — toute action passe par lui, et les classes du design system
 * restent la seule définition.
 *
 * `inner-button`  action principale (dégradé de marque)
 * `outer-button`  action secondaire (verre)
 * `button-ghost`  action tertiaire (contour seul)
 * `button-icon`   bouton d'icône seule (rond)
 */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'icon';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'inner-button',
  secondary: 'outer-button',
  ghost: 'button-ghost',
  icon: 'button-icon',
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'button-sm',
  md: '',
  lg: 'button-lg',
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Remplace le contenu par un indicateur d'activité et désactive le bouton. */
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'sm', loading, icon, children, className = '', disabled, ...rest },
  ref
) {
  const base = [VARIANT_CLASS[variant], variant !== 'icon' ? SIZE_CLASS[size] : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled || loading}
      className={`${base} inline-flex items-center justify-center gap-2 whitespace-nowrap`}
      {...rest}
    >
      {loading ? <Spinner /> : icon}
      {variant !== 'icon' && children}
    </button>
  );
});

/** Même lien, même apparence : un `<a>` qui navigue ne doit pas être un bouton. */
export function ButtonLink({
  variant = 'secondary',
  size = 'sm',
  icon,
  children,
  className = '',
  ...rest
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
}) {
  const base = [VARIANT_CLASS[variant], variant !== 'icon' ? SIZE_CLASS[size] : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <a className={`${base} inline-flex items-center justify-center gap-2 whitespace-nowrap`} {...rest}>
      {icon}
      {variant !== 'icon' && children}
    </a>
  );
}

function Spinner() {
  return (
    <IdemLoader size="xs" />
  );
}

export default Button;

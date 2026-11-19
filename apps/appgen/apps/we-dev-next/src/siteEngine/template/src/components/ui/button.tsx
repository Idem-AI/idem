import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { componentConfig } from '@/design-system/config';

/**
 * Bouton du design system. Rayon, hauteur, graisse, bordure, casse et ombre
 * viennent de design-system.json ; la variante par défaut aussi.
 * Lien d'action : `<Button asChild><a href="/contact">…</a></Button>`.
 * Bouton icône : `<Button size="icon" aria-label="…"><Menu /></Button>`.
 */
const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-button border-solid font-body [border-width:var(--button-border-width)] [font-weight:var(--button-weight)] [letter-spacing:var(--button-tracking)] [text-transform:var(--button-transform)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-[1.1em] [&_svg]:shrink-0',
  {
    variants: {
      // Les couleurs et les gestes (survol, appui) de chaque variante viennent du CSS du design system
      // (`theme.generated.css`, classes `ds-button` et `ds-btn-*`) : ils changent d'un projet à l'autre sans qu'aucun
      // composant ne soit réécrit.
      variant: {
        primary: 'ds-button ds-btn-primary',
        secondary: 'ds-button ds-btn-secondary',
        accent: 'ds-button ds-btn-accent',
        outline: 'ds-button ds-btn-outline',
        ghost: 'ds-button ds-btn-ghost',
        link: 'h-auto border-transparent bg-transparent px-0 text-primary transition-colors underline-offset-4 hover:underline',
        destructive: 'ds-button ds-btn-destructive',
      },
      size: {
        sm: 'h-control-sm px-3 text-small',
        md: 'h-control px-[var(--button-padding-x)] text-body',
        lg: 'h-control-lg px-[calc(var(--button-padding-x)*1.5)] text-lead',
        icon: 'size-control p-0',
      },
    },
    defaultVariants: {
      variant: componentConfig.button.variant,
      size: componentConfig.button.size,
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Rend l'enfant (un `<a>`, par exemple) avec l'apparence du bouton. */
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };

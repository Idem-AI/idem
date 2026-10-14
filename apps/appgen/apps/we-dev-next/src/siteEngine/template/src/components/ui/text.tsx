import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Texte courant du design system.
 * - `lead` : le paragraphe d'introduction, plus grand ;
 * - `body` : le texte courant ;
 * - `muted` : un texte secondaire ;
 * - `small` : légendes, mentions ;
 * - `eyebrow` : la petite ligne au-dessus d'un titre (casse réglée par le thème).
 */
const textVariants = cva('font-body', {
  variants: {
    variant: {
      lead: 'text-lead text-muted-foreground',
      body: 'text-body text-foreground',
      muted: 'text-body text-muted-foreground',
      small: 'text-small text-muted-foreground',
      eyebrow: 'text-small font-semibold tracking-[0.08em] text-primary [text-transform:var(--eyebrow-transform)]',
    },
  },
  defaultVariants: { variant: 'body' },
});

export interface TextProps extends React.HTMLAttributes<HTMLElement>, VariantProps<typeof textVariants> {
  as?: 'p' | 'span' | 'div' | 'strong' | 'small';
}

const Text = React.forwardRef<HTMLElement, TextProps>(({ as = 'p', variant, className, ...props }, ref) => {
  const Tag = as as 'p';
  return <Tag ref={ref as React.Ref<HTMLParagraphElement>} className={cn(textVariants({ variant }), className)} {...props} />;
});
Text.displayName = 'Text';

export { Text, textVariants };

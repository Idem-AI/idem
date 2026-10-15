import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Titre du design system : police, graisse, interlignage, approche et casse
 * viennent de design-system.json. `level` donne la balise (h1…h6), `size`
 * l'échelle visuelle quand elle diffère du niveau.
 */
const headingVariants = cva('font-heading text-foreground', {
  variants: {
    size: {
      display: 'text-display',
      h1: 'text-h1',
      h2: 'text-h2',
      h3: 'text-h3',
      h4: 'text-h4',
      lead: 'text-lead',
    },
  },
});

const SIZE_BY_LEVEL = { 1: 'h1', 2: 'h2', 3: 'h3', 4: 'h4', 5: 'lead', 6: 'lead' } as const;

export interface HeadingProps
  extends React.HTMLAttributes<HTMLHeadingElement>,
    VariantProps<typeof headingVariants> {
  level?: 1 | 2 | 3 | 4 | 5 | 6;
}

const Heading = React.forwardRef<HTMLHeadingElement, HeadingProps>(
  ({ level = 2, size, className, ...props }, ref) => {
    const Tag = `h${level}` as 'h1';
    return <Tag ref={ref} className={cn(headingVariants({ size: size ?? SIZE_BY_LEVEL[level] }), className)} {...props} />;
  }
);
Heading.displayName = 'Heading';

export { Heading, headingVariants };

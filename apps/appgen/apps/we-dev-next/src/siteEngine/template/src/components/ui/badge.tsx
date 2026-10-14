import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { componentConfig } from '@/design-system/config';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-badge border px-2.5 py-0.5 text-small font-medium [text-transform:var(--badge-transform)] [&_svg]:size-3.5',
  {
    variants: {
      variant: {
        soft: 'border-transparent bg-primary/10 text-primary',
        solid: 'border-transparent bg-primary text-primary-foreground',
        outline: 'border-border text-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
      },
    },
    defaultVariants: { variant: componentConfig.badge.variant },
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };

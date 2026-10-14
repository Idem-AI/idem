import * as React from 'react';
import { cn } from '@/lib/utils';

/** Aide ou erreur sous un champ. Reliez-la au champ par `id` / `aria-describedby`. */
const FormMessage = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement> & { tone?: 'hint' | 'error' | 'success' }
>(({ className, tone = 'hint', ...props }, ref) => (
  <p
    ref={ref}
    role={tone === 'error' ? 'alert' : undefined}
    className={cn(
      'text-small',
      tone === 'error' ? 'font-medium text-destructive' : tone === 'success' ? 'font-medium text-primary' : 'text-muted-foreground',
      className
    )}
    {...props}
  />
));
FormMessage.displayName = 'FormMessage';

export { FormMessage };

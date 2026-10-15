import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Une section de page avec l'espacement vertical du thème (`py-section`).
 * Elle ne décide ni du fond ni de la disposition : c'est à la page de le faire.
 */
const Section = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(({ className, ...props }, ref) => (
  <section ref={ref} className={cn('relative py-section', className)} {...props} />
));
Section.displayName = 'Section';

export { Section };

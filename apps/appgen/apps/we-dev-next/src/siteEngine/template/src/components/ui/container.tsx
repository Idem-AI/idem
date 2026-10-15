import * as React from 'react';
import { cn } from '@/lib/utils';

/** Largeur de contenu et marges latérales du thème. `wide` : pleine largeur avec marges. */
const Container = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { wide?: boolean }>(
  ({ className, wide = false, ...props }, ref) => (
    <div ref={ref} className={cn('mx-auto w-full px-gutter', !wide && 'max-w-content', className)} {...props} />
  )
);
Container.displayName = 'Container';

export { Container };

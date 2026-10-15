import * as React from 'react';
import { cn } from '@/lib/utils';
import { componentConfig } from '@/design-system/config';

/** Le style des champs (contour, rempli, souligné) vient de design-system.json. */
export const FIELD_STYLES = {
  outline: 'rounded-input border-solid border-input bg-background [border-width:var(--input-border-width)]',
  filled: 'rounded-input border-solid border-transparent bg-muted [border-width:var(--input-border-width)] focus-visible:bg-background',
  underline: 'rounded-none border-0 border-solid border-b-input bg-transparent px-0 [border-bottom-width:var(--input-border-width)]',
} as const;

export const fieldClasses = cn(
  'w-full text-body text-foreground transition-[border-color,box-shadow,background-color] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive',
  FIELD_STYLES[componentConfig.input.style]
);

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = 'text', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(fieldClasses, 'h-[var(--input-height)] px-3 file:border-0 file:bg-transparent file:text-small file:font-medium', className)}
      {...props}
    />
  )
);
Input.displayName = 'Input';

export { Input };

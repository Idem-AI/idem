import * as React from 'react';
import { cn } from '@/lib/utils';
import { fieldClasses } from './input';

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, rows = 4, ...props }, ref) => (
    <textarea ref={ref} rows={rows} className={cn(fieldClasses, 'min-h-24 px-3 py-2', className)} {...props} />
  )
);
Textarea.displayName = 'Textarea';

export { Textarea };

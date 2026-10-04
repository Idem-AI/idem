import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Classes conditionnelles, sans doublon contradictoire (`p-2 p-4` → `p-4`). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

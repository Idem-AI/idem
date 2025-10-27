/**
 * Tailwind CSS 4 Configuration for We Dev Client
 * Extends @idem/shared-styles
 */

import sharedConfig from '@idem/shared-styles/tailwind.config';
import { addDynamicIconSelectors } from '@iconify/tailwind';

/** @type {import('tailwindcss').Config} */
export default {
  ...sharedConfig,
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      ...sharedConfig.theme.extend,
      // Additional project-specific extensions
      borderRadius: {
        ...sharedConfig.theme.extend.borderRadius,
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        ...sharedConfig.theme.extend.fontFamily,
        montserrat: ['Montserrat', 'sans-serif'],
        raleway: ['Raleway', 'sans-serif'],
      },
    },
  },
  plugins: [addDynamicIconSelectors()],
};

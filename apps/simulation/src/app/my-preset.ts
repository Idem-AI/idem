// mypreset.ts — préréglage PrimeNG du simulateur.
//
// Reprend celui du dashboard IDEM pour que les composants aient la même
// apparence d'une application à l'autre, avec un ajout: un `colorScheme.light`.
// Le dashboard force le sombre; ici le thème clair est une exigence produit,
// donc PrimeNG doit savoir le rendre.
import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

export const MyPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#dbeafe',
      100: '#bfdbfe',
      200: '#93c5fd',
      300: '#60a5fa',
      400: '#3b82f6',
      500: '#2563eb',
      600: '#1d4ed8',
      700: '#1e40af',
      800: '#1e3a8a',
      900: '#1e3a8a',
      950: '#172554',
    },
    colorScheme: {
      dark: {
        surface: {
          0: '#0f141b',
          50: '#1a1f2e',
          100: '#1e2332',
          200: '#252b3b',
          300: '#2c3444',
          400: '#343c4d',
          500: '#3b4556',
          600: '#434d5f',
          700: '#4a5568',
          800: '#525e71',
          900: '#59667a',
          950: '#616e83',
        },
        primary: {
          color: '#93c5fd',
          hoverColor: '#bfdbfe',
          activeColor: '#60a5fa',
        },
        highlight: {
          background: 'rgba(20, 71, 230, 0.24)',
          focusBackground: 'rgba(20, 71, 230, 0.32)',
          color: 'rgba(255,255,255,.87)',
          focusColor: 'rgba(255,255,255,.87)',
        },
        text: {
          color: '#ffffff',
          hoverColor: '#f3f4f6',
          mutedColor: '#9ca3af',
        },
        content: {
          background: '#0f141b',
          hoverBackground: '#1a1f2e',
          borderColor: 'rgba(255, 255, 255, 0.1)',
        },
      },
      light: {
        surface: {
          0: '#ffffff',
          50: '#f7f8fc',
          100: '#eef1f8',
          200: '#e2e7f2',
          300: '#d1d8e8',
          400: '#b6c0d6',
          500: '#94a1bd',
          600: '#6f7d9c',
          700: '#54607b',
          800: '#3b455c',
          900: '#28304200',
          950: '#1a2032',
        },
        primary: {
          color: '#1d4ed8',
          hoverColor: '#1e40af',
          activeColor: '#2563eb',
        },
        highlight: {
          background: 'rgba(20, 71, 230, 0.1)',
          focusBackground: 'rgba(20, 71, 230, 0.16)',
          color: '#1e293b',
          focusColor: '#1e293b',
        },
        text: {
          color: '#1e293b',
          hoverColor: '#0f172a',
          mutedColor: '#64748b',
        },
        content: {
          background: '#ffffff',
          hoverBackground: '#f7f8fc',
          borderColor: 'rgba(15, 23, 42, 0.12)',
        },
      },
    },
  },
});

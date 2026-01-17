//mypreset.ts
import { definePreset } from '@primeng/themes';
import Aura from '@primeng/themes/aura';

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
    // Force dark theme only - remove light colorScheme completely
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
          950: '#616e83'
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
    },
  },
  components: {
    // Global dark theme for all components - using correct PrimeNG properties
    inputtext: {
      root: {
        background: 'rgba(15, 20, 27, 0.7)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        hoverBorderColor: '{primary.color}',
        focusBorderColor: '{primary.color}',
        color: '#ffffff',
        placeholderColor: '#9ca3af',
        borderRadius: '0.5rem',
        paddingX: '0.75rem',
        paddingY: '0.5rem',
      },
    },
    textarea: {
      root: {
        background: 'rgba(15, 20, 27, 0.7)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        hoverBorderColor: '{primary.color}',
        focusBorderColor: '{primary.color}',
        color: '#ffffff',
        placeholderColor: '#9ca3af',
        borderRadius: '0.5rem',
        paddingX: '0.75rem',
        paddingY: '0.5rem',
      },
    },
    dropdown: {
      root: {
        background: 'rgba(15, 20, 27, 0.7)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        hoverBorderColor: '{primary.color}',
        focusBorderColor: '{primary.color}',
        color: '#ffffff',
        borderRadius: '0.5rem',
        paddingX: '0.75rem',
        paddingY: '0.5rem',
      },
      panel: {
        background: '#1e2332',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        color: '#ffffff',
        borderRadius: '0.5rem',
        shadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
      },
      item: {
        color: '#ffffff',
        focusBackground: 'rgba(255, 255, 255, 0.05)',
        selectedBackground: '{primary.color}',
        selectedColor: '#ffffff',
        padding: '0.75rem',
      },
    },
    checkbox: {
      root: {
        borderColor: 'rgba(255, 255, 255, 0.2)',
        hoverBorderColor: '{primary.color}',
        checkedBorderColor: '{primary.color}',
        checkedBackground: '{primary.color}',
        borderRadius: '0.25rem',
      },
    },
    radiobutton: {
      root: {
        borderColor: 'rgba(255, 255, 255, 0.2)',
        hoverBorderColor: '{primary.color}',
        checkedBorderColor: '{primary.color}',
        checkedBackground: '{primary.color}',
      },
    },
    accordion: {
      root: {
        transitionDuration: '{transition.duration}',
      },
      panel: {
        borderWidth: '0 0 1px 0',
        borderColor: 'rgba(255, 255, 255, 0.1)',
      },
      header: {
        color: '#ffffff',
        hoverColor: '#f3f4f6',
        activeColor: '#ffffff',
        activeHoverColor: '#f3f4f6',
        padding: '1rem',
        fontWeight: '600',
        borderWidth: '1px',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        background: 'rgba(15, 20, 27, 0.7)',
        hoverBackground: 'rgba(20, 20, 30, 0.6)',
        activeBackground: 'rgba(20, 20, 30, 0.6)',
        activeHoverBackground: 'rgba(20, 20, 30, 0.6)',
        borderRadius: '0.5rem',
      },
      content: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        background: 'rgba(15, 20, 27, 0.7)',
        color: '#ffffff',
        padding: '1rem',
      },
    },
    select: {
      root: {
        background: 'rgba(15, 20, 27, 0.7)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        color: '#ffffff',
        borderRadius: '0.5rem',
        paddingX: '0.75rem',
        paddingY: '0.5rem',
        hoverBorderColor: '{primary.color}',
      },
      overlay: {
        background: '#1e2332',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '0.5rem',
        color: '#ffffff',
        shadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
      },
      option: {
        padding: '0.5rem 0.75rem',
        borderRadius: '0.375rem',
        color: '#ffffff',
        focusBackground: 'rgba(255, 255, 255, 0.05)',
        selectedBackground: '{primary.color}',
        selectedColor: '#ffffff',
      },
    },
  },
});

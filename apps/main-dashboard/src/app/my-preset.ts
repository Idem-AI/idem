//mypreset.ts
import { definePreset } from '@primeng/themes';
import Aura from '@primeng/themes/aura';

/**
 * Idem PrimeNG preset — dual color scheme. The active scheme is selected by the
 * `.dark` class on <html> (`darkModeSelector: '.dark'` in app.config.ts), which
 * is driven by the shared `idem_theme` cookie / ThemeService.
 */
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
      light: {
        surface: {
          0: '#ffffff',
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
        primary: {
          color: '#2563eb',
          hoverColor: '#1d4ed8',
          activeColor: '#1e40af',
        },
        highlight: {
          background: 'rgba(20, 71, 230, 0.10)',
          focusBackground: 'rgba(20, 71, 230, 0.16)',
          color: '#0f172a',
          focusColor: '#0f172a',
        },
        text: {
          color: '#0f172a',
          hoverColor: '#1e293b',
          mutedColor: '#64748b',
        },
        content: {
          background: '#ffffff',
          hoverBackground: '#f1f5f9',
          borderColor: 'rgba(15, 23, 42, 0.10)',
        },
      },
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
    },
  },
  components: {
    // Layout tokens stay shared; colors are per-scheme so components follow the
    // active theme instead of hardcoding dark glass values.
    inputtext: {
      root: {
        borderRadius: '0.5rem',
        paddingX: '0.75rem',
        paddingY: '0.5rem',
        hoverBorderColor: '{primary.color}',
        focusBorderColor: '{primary.color}',
      },
      colorScheme: {
        light: {
          root: {
            background: '#ffffff',
            borderColor: 'rgba(15, 23, 42, 0.12)',
            color: '#0f172a',
            placeholderColor: '#64748b',
          },
        },
        dark: {
          root: {
            background: 'rgba(15, 20, 27, 0.7)',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            color: '#ffffff',
            placeholderColor: '#9ca3af',
          },
        },
      },
    },
    textarea: {
      root: {
        borderRadius: '0.5rem',
        paddingX: '0.75rem',
        paddingY: '0.5rem',
        hoverBorderColor: '{primary.color}',
        focusBorderColor: '{primary.color}',
      },
      colorScheme: {
        light: {
          root: {
            background: '#ffffff',
            borderColor: 'rgba(15, 23, 42, 0.12)',
            color: '#0f172a',
            placeholderColor: '#64748b',
          },
        },
        dark: {
          root: {
            background: 'rgba(15, 20, 27, 0.7)',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            color: '#ffffff',
            placeholderColor: '#9ca3af',
          },
        },
      },
    },
    dropdown: {
      root: {
        borderRadius: '0.5rem',
        paddingX: '0.75rem',
        paddingY: '0.5rem',
        hoverBorderColor: '{primary.color}',
        focusBorderColor: '{primary.color}',
      },
      item: {
        padding: '0.75rem',
        selectedBackground: '{primary.color}',
        selectedColor: '#ffffff',
      },
      colorScheme: {
        light: {
          root: {
            background: '#ffffff',
            borderColor: 'rgba(15, 23, 42, 0.12)',
            color: '#0f172a',
          },
          panel: {
            background: '#ffffff',
            borderColor: 'rgba(15, 23, 42, 0.1)',
            color: '#0f172a',
            borderRadius: '0.5rem',
            shadow: '0 10px 25px -5px rgba(15, 23, 42, 0.15)',
          },
          item: {
            color: '#0f172a',
            focusBackground: 'rgba(15, 23, 42, 0.05)',
          },
        },
        dark: {
          root: {
            background: 'rgba(15, 20, 27, 0.7)',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            color: '#ffffff',
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
          },
        },
      },
    },
    checkbox: {
      root: {
        borderRadius: '0.25rem',
        hoverBorderColor: '{primary.color}',
        checkedBorderColor: '{primary.color}',
        checkedBackground: '{primary.color}',
      },
      colorScheme: {
        light: {
          root: { borderColor: 'rgba(15, 23, 42, 0.25)' },
        },
        dark: {
          root: { borderColor: 'rgba(255, 255, 255, 0.2)' },
        },
      },
    },
    radiobutton: {
      root: {
        hoverBorderColor: '{primary.color}',
        checkedBorderColor: '{primary.color}',
        checkedBackground: '{primary.color}',
      },
      colorScheme: {
        light: {
          root: { borderColor: 'rgba(15, 23, 42, 0.25)' },
        },
        dark: {
          root: { borderColor: 'rgba(255, 255, 255, 0.2)' },
        },
      },
    },
    accordion: {
      root: {
        transitionDuration: '{transition.duration}',
      },
      header: {
        padding: '1rem',
        fontWeight: '600',
        borderWidth: '1px',
        borderRadius: '0.5rem',
      },
      content: {
        padding: '1rem',
      },
      colorScheme: {
        light: {
          panel: { borderWidth: '0 0 1px 0', borderColor: 'rgba(15, 23, 42, 0.1)' },
          header: {
            color: '#0f172a',
            hoverColor: '#1e293b',
            activeColor: '#0f172a',
            activeHoverColor: '#1e293b',
            borderColor: 'rgba(15, 23, 42, 0.1)',
            background: '#ffffff',
            hoverBackground: '#f1f5f9',
            activeBackground: '#f1f5f9',
            activeHoverBackground: '#f1f5f9',
          },
          content: {
            borderColor: 'rgba(15, 23, 42, 0.1)',
            background: '#ffffff',
            color: '#0f172a',
          },
        },
        dark: {
          panel: { borderWidth: '0 0 1px 0', borderColor: 'rgba(255, 255, 255, 0.1)' },
          header: {
            color: '#ffffff',
            hoverColor: '#f3f4f6',
            activeColor: '#ffffff',
            activeHoverColor: '#f3f4f6',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            background: 'rgba(15, 20, 27, 0.7)',
            hoverBackground: 'rgba(20, 20, 30, 0.6)',
            activeBackground: 'rgba(20, 20, 30, 0.6)',
            activeHoverBackground: 'rgba(20, 20, 30, 0.6)',
          },
          content: {
            borderColor: 'rgba(255, 255, 255, 0.1)',
            background: 'rgba(15, 20, 27, 0.7)',
            color: '#ffffff',
          },
        },
      },
    },
    select: {
      root: {
        borderRadius: '0.5rem',
        paddingX: '0.75rem',
        paddingY: '0.5rem',
        hoverBorderColor: '{primary.color}',
      },
      option: {
        padding: '0.5rem 0.75rem',
        borderRadius: '0.375rem',
        selectedBackground: '{primary.color}',
        selectedColor: '#ffffff',
      },
      colorScheme: {
        light: {
          root: {
            background: '#ffffff',
            borderColor: 'rgba(15, 23, 42, 0.12)',
            color: '#0f172a',
          },
          overlay: {
            background: '#ffffff',
            borderColor: 'rgba(15, 23, 42, 0.1)',
            borderRadius: '0.5rem',
            color: '#0f172a',
            shadow: '0 10px 25px -5px rgba(15, 23, 42, 0.15)',
          },
          option: {
            color: '#0f172a',
            focusBackground: 'rgba(15, 23, 42, 0.05)',
          },
        },
        dark: {
          root: {
            background: 'rgba(15, 20, 27, 0.7)',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            color: '#ffffff',
          },
          overlay: {
            background: '#1e2332',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '0.5rem',
            color: '#ffffff',
            shadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
          },
          option: {
            color: '#ffffff',
            focusBackground: 'rgba(255, 255, 255, 0.05)',
          },
        },
      },
    },
  },
});

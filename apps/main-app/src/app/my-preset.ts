//mypreset.ts
import { definePreset } from '@primeng/themes';
import Aura from '@primeng/themes/aura';

export const MyPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '{blue.50}',
      100: '{blue.100}',
      200: '{blue.200}',
      300: '{blue.300}',
      400: '{blue.400}',
      500: '{blue.500}',
      600: '{blue.600}',
      700: '{blue.700}',
      800: '{blue.800}',
      900: '{blue.900}',
      950: '{blue.950}',
    },
    colorScheme: {
      dark: {
        primary: {
          // Slightly lighter tints for dark mode interactions
          color: '#93c5fd',
          hoverColor: '#bfdbfe',
          activeColor: '#60a5fa',
        },
        highlight: {
          // Subtle blue-tinted highlights to match --color-primary-glow
          background: 'rgba(20, 71, 230, 0.24)',
          focusBackground: 'rgba(20, 71, 230, 0.32)',
          color: 'rgba(255,255,255,.87)',
          focusColor: 'rgba(255,255,255,.87)',
        },
      },
    },
  },
  components: {
    // Accordion styling aligned with project glass UI and primary blue
    accordion: {
      root: {
        transitionDuration: '{transition.duration}',
      },
      panel: {
        // subtle bottom divider between panels
        borderWidth: '0 0 1px 0',
        borderColor: '{content.border.color}',
      },
      header: {
        color: '{text.muted.color}',
        hoverColor: '{text.color}',
        activeColor: '{text.color}',
        activeHoverColor: '{text.color}',
        padding: '1rem',
        fontWeight: '600',
        borderWidth: '0.5px',
        borderColor: '{content.border.color}',
        // glass-like backgrounds (match styles.css glass vars)
        background: 'rgba(15, 20, 27, 0.7)',
        hoverBackground: 'rgba(20, 20, 30, 0.6)',
        activeBackground: 'rgba(20, 20, 30, 0.6)',
        activeHoverBackground: 'rgba(20, 20, 30, 0.6)',
        focusRing: {
          width: '{focus.ring.width}',
          style: '{focus.ring.style}',
          color: '{primary.color}',
          offset: '2px',
          shadow: '{focus.ring.shadow}',
        },
        toggleIcon: {
          color: '{text.muted.color}',
          hoverColor: '{text.color}',
          activeColor: '{text.color}',
          activeHoverColor: '{text.color}',
        },
        first: {
          topBorderRadius: '1.25rem',
          borderWidth: '1px',
        },
        last: {
          bottomBorderRadius: '1.25rem',
          activeBottomBorderRadius: '1.25rem',
        },
      },
      content: {
        borderColor: '{content.border.color}',
        background: 'rgba(15, 20, 27, 0.7)',
        color: '{text.color}',
        padding: '0 1rem 1rem 1rem',
      },
    },
    select: {
      root: {
        background: 'rgba(15, 20, 27, 0.7)',
        borderColor: '{content.border.color}',
        color: '{text.color}',
        borderRadius: '0.5rem',
        paddingX: '0.75rem',
        paddingY: '0.5rem',
        transitionDuration: '{transition.duration}',
        hoverBorderColor: '{primary.color}',
        focusRing: {
          width: '{focus.ring.width}',
          style: '{focus.ring.style}',
          color: '{primary.color}',
          offset: '0px',
          shadow: 'none',
        },
      },
      overlay: {
        background: 'rgba(20, 25, 32, 0.95)',
        borderColor: '{content.border.color}',
        borderRadius: '0.5rem',
        color: '{text.color}',
        shadow: 'none',
      },
      list: {
        padding: '0.5rem',
        gap: '2px',
      },
      option: {
        padding: '0.5rem 0.75rem',
        borderRadius: '0.375rem',
        color: '{text.muted.color}',
        focusBackground: 'rgba(255, 255, 255, 0.07)',
        selectedBackground: '{highlight.background}',
        selectedFocusBackground: '{highlight.focus.background}',
        selectedColor: '{highlight.color}',
        selectedFocusColor: '{highlight.focus.color}',
      },
      dropdown: {
        color: '{text.muted.color}',
      },
    },
  },
});

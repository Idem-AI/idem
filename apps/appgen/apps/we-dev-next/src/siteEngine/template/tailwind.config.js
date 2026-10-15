/**
 * Design system du site, posée par IDEM — NE PAS MODIFIER.
 *
 * Aucune valeur ici : tout vient des variables CSS compilées depuis
 * `src/design-system/design-system.json`. La palette par défaut de Tailwind est
 * volontairement absente : seules les couleurs du design system existent
 * (`bg-primary`, `text-muted-foreground`…), avec leurs opacités
 * (`bg-primary/10`). Rayons, ombres, polices et tailles de texte suivent la
 * même règle : `rounded-xl` ou `shadow-lg` restent fidèles au thème du projet.
 */
import animate from 'tailwindcss-animate';

const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;
const pair = (name) => ({ DEFAULT: token(name), foreground: token(`${name}-foreground`) });
const radius = (factor) => `calc(var(--radius) * ${factor})`;

export default {
  darkMode: ['class'],
  content: ['./index.html', './*/index.html', './src/**/*.{ts,tsx}'],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      inherit: 'inherit',
      white: '#ffffff',
      black: '#000000',
      background: token('background'),
      foreground: token('foreground'),
      card: pair('card'),
      popover: pair('popover'),
      primary: pair('primary'),
      secondary: pair('secondary'),
      muted: pair('muted'),
      accent: pair('accent'),
      destructive: pair('destructive'),
      border: token('border'),
      input: token('input'),
      ring: token('ring'),
    },
    fontFamily: {
      heading: 'var(--font-heading)',
      body: 'var(--font-body)',
      sans: 'var(--font-body)',
      mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
    },
    borderRadius: {
      none: '0',
      sm: radius(0.5),
      DEFAULT: 'var(--radius)',
      md: 'var(--radius)',
      lg: radius(1.5),
      xl: radius(2),
      '2xl': radius(3),
      '3xl': radius(4),
      full: '9999px',
      button: 'var(--radius-button)',
      input: 'var(--radius-input)',
      card: 'var(--radius-card)',
      badge: 'var(--radius-badge)',
    },
    boxShadow: {
      none: 'none',
      sm: 'var(--shadow-sm)',
      DEFAULT: 'var(--shadow-md)',
      md: 'var(--shadow-md)',
      lg: 'var(--shadow-lg)',
      xl: 'var(--shadow-xl)',
      '2xl': 'var(--shadow-xl)',
      card: 'var(--shadow-card)',
      button: 'var(--shadow-button)',
      inner: 'inset 0 2px 4px 0 rgb(var(--foreground) / 0.06)',
    },
    extend: {
      borderWidth: { DEFAULT: 'var(--border-width)' },
      fontSize: {
        small: ['var(--text-small)', { lineHeight: '1.5' }],
        body: ['var(--text-body)', { lineHeight: 'var(--leading-body)' }],
        lead: ['var(--text-lead)', { lineHeight: '1.55' }],
        h4: ['var(--text-h4)', { lineHeight: 'var(--leading-heading)' }],
        h3: ['var(--text-h3)', { lineHeight: 'var(--leading-heading)' }],
        h2: ['var(--text-h2)', { lineHeight: 'var(--leading-heading)' }],
        h1: ['var(--text-h1)', { lineHeight: 'var(--leading-heading)' }],
        display: ['var(--text-display)', { lineHeight: 'var(--leading-heading)' }],
      },
      spacing: {
        section: 'var(--space-section)',
        gutter: 'var(--space-gutter)',
        control: 'var(--control-height)',
        'control-sm': 'var(--control-height-sm)',
        'control-lg': 'var(--control-height-lg)',
      },
      maxWidth: { content: 'var(--content-width)', prose: '68ch' },
      transitionDuration: { DEFAULT: 'var(--motion-duration)' },
      transitionTimingFunction: { DEFAULT: 'var(--motion-ease)' },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [animate],
};

const { addDynamicIconSelectors } = require("@iconify/tailwind");

const config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  plugins: [require("tailwindcss-animate"), addDynamicIconSelectors()],
  theme: {
    extend: {
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["Jura", "sans-serif"],
        jura: ["Jura", "sans-serif"],
        montserrat: ["Montserrat", "sans-serif"],
        raleway: ["Raleway", "sans-serif"],
      },
      fontSize: {
        'title': '5.4rem',
        'title-mobile': '1.4rem',
        'subtitle': '1.7rem',
        'light-text': '1rem',
      },
      backdropBlur: {
        'glass': '12px',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        'glass-hover': '0 12px 40px 0 rgba(0, 0, 0, 0.45)',
        'glow-primary': '0 0 15px #1449e6a8',
        'glow-secondary': '0 0 15px #d11ec0a8',
        'glow-accent': '0 0 15px rgba(34, 211, 238, 0.6)',
      },
      colors: {
        // Original shadcn colors
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "#1447e6",
          foreground: "#f5f5f5",
          glow: "#1449e6a8",
        },
        secondary: {
          DEFAULT: "#d11ec0",
          foreground: "#f5f5f5",
          glow: "#d11ec0a8",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "#22d3ee",
          foreground: "#f5f5f5",
          glow: "rgba(34, 211, 238, 0.6)",
        },
        destructive: {
          DEFAULT: "#d34053",
          foreground: "#f5f5f5",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
        },
        // Modern design system colors
        'bg-dark': '#06080d',
        'bg-light': '#0f141b',
        'light-text': '#f5f5f5',
        success: '#219653',
        danger: '#d34053',
        warning: '#ffa70b',
      },
      keyframes: {
        "gradient-shift": {
          "0%": {
            "background-position": "0% 50%",
          },
          "50%": {
            "background-position": "100% 50%",
          },
          "100%": {
            "background-position": "0% 50%",
          },
        },
        "reveal": {
          "0%": {
            "opacity": "0",
            "transform": "translateY(30px)",
          },
          "100%": {
            "opacity": "1",
            "transform": "translateY(0)",
          },
        },
      },
      animation: {
        "gradient-shift": "gradient-shift 3s ease infinite",
        "reveal": "reveal 1s ease",
      },
    },
  },
};

export default config;

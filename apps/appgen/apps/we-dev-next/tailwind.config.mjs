import { fontFamily } from "tailwindcss/defaultTheme";
import animate from "tailwindcss-animate";
import { addDynamicIconSelectors } from "@iconify/tailwind";
import { createPreset } from "fumadocs-ui/tailwind-plugin";

const config = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/fumadocs-ui/dist/**/*.js",

    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./content/**/*.mdx",
    "./mdx-components.tsx",
  ],
  presets: [createPreset()],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // Original shadcn colors
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
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
        destructive: {
          DEFAULT: "#d34053",
          foreground: "#f5f5f5",
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
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
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
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["Jura", "var(--font-sans)", ...fontFamily.sans],
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
      keyframes: {
        "fade-in-down": {
          "0%": {
            opacity: "0",
            transform: "translateY(-10px)",
          },
          "100%": {
            opacity: "1",
            transform: "translateY(0)",
          },
        },
        ripple: {
          "0%": {
            transform: "scale(0)",
            opacity: "0.5",
          },
          "100%": {
            transform: "scale(4)",
            opacity: "0",
          },
        },
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        "shiny-text": {
          "0%, 90%, 100%": {
            "background-position": "calc(-100% - var(--shiny-width)) 0",
          },
          "30%, 60%": {
            "background-position": "calc(100% + var(--shiny-width)) 0",
          },
        },
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
        animation: {
          "fade-in-down": "fade-in-down 0.5s ease-out",
          "accordion-down": "accordion-down 0.2s ease-out",
          "accordion-up": "accordion-up 0.2s ease-out",
          "shiny-text": "shiny-text 8s infinite",
          ripple: "ripple 1s cubic-bezier(0, 0, 0.2, 1)",
        },
        gradient: {
          to: {
            backgroundPosition: "var(--bg-size) 0",
          },
        },
        "border-gradient": {
          "0%, 100%": {
            backgroundPosition: "0% 50%",
          },
          "50%": {
            backgroundPosition: "100% 50%",
          },
        },
      },
      animation: {
        "shiny-text": "shiny-text 8s infinite",
        gradient: "gradient 8s linear infinite",
        "border-gradient": "border-gradient 3s ease infinite",
        ripple: "ripple 1s cubic-bezier(0, 0, 0.2, 1)",
        "gradient-shift": "gradient-shift 3s ease infinite",
        "reveal": "reveal 1s ease",
      },
    },
  },
  plugins: [animate, addDynamicIconSelectors()],
};

export default config;

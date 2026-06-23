import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1200px" },
    },
    extend: {
      colors: {
        // Channel-based vars (--c-*) so Tailwind opacity modifiers work,
        // e.g. bg-primary/10. Hex tokens (--promofy-*) live in globals.css
        // for raw CSS, gradients and Figma reference.
        background: "rgb(var(--c-bg-app) / <alpha-value>)",
        surface: "rgb(var(--c-surface) / <alpha-value>)",
        foreground: "rgb(var(--c-foreground) / <alpha-value>)",
        border: "rgb(var(--c-border) / <alpha-value>)",
        input: "rgb(var(--c-border) / <alpha-value>)",
        ring: "rgb(var(--c-primary) / <alpha-value>)",
        muted: {
          DEFAULT: "rgb(var(--c-muted-bg) / <alpha-value>)",
          foreground: "rgb(var(--c-muted-fg) / <alpha-value>)",
        },
        card: {
          DEFAULT: "rgb(var(--c-surface) / <alpha-value>)",
          foreground: "rgb(var(--c-foreground) / <alpha-value>)",
        },
        // Brand
        primary: {
          DEFAULT: "rgb(var(--c-primary) / <alpha-value>)",
          dark: "rgb(var(--c-primary-dark) / <alpha-value>)",
          foreground: "#FFFFFF",
        },
        yellow: {
          DEFAULT: "rgb(var(--c-yellow) / <alpha-value>)",
          soft: "var(--promofy-yellow-soft)",
          foreground: "var(--text-primary)",
        },
        promofy: {
          blue: "var(--promofy-blue)",
          "blue-dark": "var(--promofy-blue-dark)",
          yellow: "var(--promofy-yellow)",
          "yellow-soft": "var(--promofy-yellow-soft)",
        },
        // Status
        success: {
          DEFAULT: "rgb(var(--c-success) / <alpha-value>)",
          soft: "var(--success-soft)",
        },
        danger: {
          DEFAULT: "rgb(var(--c-danger) / <alpha-value>)",
          soft: "var(--danger-soft)",
        },
        destructive: {
          DEFAULT: "rgb(var(--c-danger) / <alpha-value>)",
          foreground: "#FFFFFF",
        },
      },
      borderRadius: {
        // Brand radii: cards 16px, buttons 12px
        card: "16px",
        btn: "12px",
        lg: "12px",
        md: "10px",
        sm: "8px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(20, 20, 60, 0.04), 0 2px 8px rgba(20, 20, 60, 0.06)",
        "card-hover":
          "0 6px 16px rgba(20, 20, 60, 0.10), 0 2px 6px rgba(20, 20, 60, 0.06)",
        nav: "0 -2px 16px rgba(20, 20, 60, 0.06)",
        focus: "0 0 0 3px rgba(20, 20, 220, 0.18)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-up": "fade-up 0.5s ease-out both",
      },
    },
  },
  plugins: [animate],
};
export default config;

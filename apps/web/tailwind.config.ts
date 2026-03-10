import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
          950: "#1e1b4b",
        },
        // Semantic surface colors
        surface: {
          DEFAULT: "#ffffff",
          subtle:  "#f8f9fb",
          muted:   "#f1f3f7",
          overlay: "#e8ecf4",
        },
        // Clinical status colors — distinct enough for color-blind users
        status: {
          approved:  { DEFAULT: "#16a34a", light: "#dcfce7", text: "#14532d" },
          pending:   { DEFAULT: "#d97706", light: "#fef3c7", text: "#78350f" },
          recalled:  { DEFAULT: "#dc2626", light: "#fee2e2", text: "#7f1d1d" },
          inactive:  { DEFAULT: "#6b7280", light: "#f3f4f6", text: "#1f2937" },
        },
        // Alert severity
        severity: {
          critical: { DEFAULT: "#be123c", light: "#fff1f2", text: "#881337", border: "#fecdd3" },
          high:     { DEFAULT: "#c2410c", light: "#fff7ed", text: "#7c2d12", border: "#fed7aa" },
          medium:   { DEFAULT: "#b45309", light: "#fffbeb", text: "#713f12", border: "#fde68a" },
          low:      { DEFAULT: "#15803d", light: "#f0fdf4", text: "#14532d", border: "#bbf7d0" },
          info:     { DEFAULT: "#0369a1", light: "#f0f9ff", text: "#0c4a6e", border: "#bae6fd" },
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Menlo", "monospace"],
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }],
      },
      boxShadow: {
        // Layered shadows from Refactoring UI
        "card":    "0 1px 3px 0 rgb(0 0 0 / 0.07), 0 1px 2px -1px rgb(0 0 0 / 0.07)",
        "card-md": "0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.06)",
        "card-lg": "0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.05)",
        "inner-brand": "inset 0 0 0 2px rgb(99 102 241 / 0.3)",
      },
      borderRadius: {
        "2xs": "0.125rem",
      },
      spacing: {
        "18": "4.5rem",
        "68": "17rem",
      },
      animation: {
        "fade-in":  "fadeIn 0.15s ease-out",
        "slide-in": "slideIn 0.2s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideIn: {
          "0%":   { opacity: "0", transform: "translateY(-4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [
    require("@tailwindcss/forms"),
    require("@tailwindcss/typography"),
  ],
};

export default config;

import type { Config } from "tailwindcss";
import * as tokens from "./src/ui/tokens";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/ui/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  darkMode: ["class"],
  theme: {
    colors: {
      transparent: "transparent",
      current: "currentColor",
      inherit: "inherit",
      white: "#FFFFFF",
      black: "#000000",
      ...tokens.colors
    },
    spacing: tokens.spacing,
    borderRadius: tokens.radius,
    boxShadow: tokens.shadow,
    fontFamily: {
      sans: tokens.fonts.sans.split(",").map((s) => s.trim()),
      mono: tokens.fonts.mono.split(",").map((s) => s.trim())
    },
    fontSize: tokens.fontSize as Record<string, [string, { lineHeight: string }]>,
    fontWeight: tokens.fontWeight,
    letterSpacing: tokens.letterSpacing,
    extend: {
      animation: {
        "fade-in": "fadeIn 200ms ease-out",
        "slide-up": "slideUp 220ms cubic-bezier(0.16,1,0.3,1)",
        "scale-in": "scaleIn 160ms cubic-bezier(0.16,1,0.3,1)"
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" }
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" }
        }
      }
    }
  },
  plugins: []
};

export default config;

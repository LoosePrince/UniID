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
        "scale-in": "scaleIn 160ms cubic-bezier(0.16,1,0.3,1)",
        sheen: "sheen 7.8s ease-in-out infinite",
        "pulse-glow": "pulseGlow 4.2s ease-in-out infinite",
        "float-subtle": "floatSubtle 5.4s ease-in-out infinite"
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
        },
        sheen: {
          "0%": { transform: "translateX(-120%) rotate(12deg)" },
          "45%": { transform: "translateX(120%) rotate(12deg)" },
          "100%": { transform: "translateX(120%) rotate(12deg)" }
        },
        pulseGlow: {
          "0%, 100%": { opacity: "0.52", transform: "scale(0.98)" },
          "50%": { opacity: "0.9", transform: "scale(1.03)" }
        },
        floatSubtle: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-4px)" }
        }
      }
    }
  },
  plugins: []
};

export default config;
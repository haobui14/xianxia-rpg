import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        xianxia: {
          dark: "#0a0e1a",
          darker: "#060810",
          accent: "#8b5cf6",
          gold: "#fbbf24",
          silver: "#d1d5db",
        },
        realm: {
          mortal: "#6b7280",
          "mortal-light": "#9ca3af",
          qiCondensation: "#10b981",
          "qiCondensation-light": "#34d399",
          foundation: "#3b82f6",
          "foundation-light": "#60a5fa",
          coreFormation: "#8b5cf6",
          "coreFormation-light": "#a78bfa",
          nascentSoul: "#f59e0b",
          "nascentSoul-light": "#fbbf24",
        },
        element: {
          kim: "#d4af37", // Metal - Gold
          moc: "#22c55e", // Wood - Green
          thuy: "#3b82f6", // Water - Blue
          hoa: "#ef4444", // Fire - Red
          tho: "#a16207", // Earth - Brown
        },
      },
      animation: {
        // Existing animations
        "glow-pulse": "progressGlow 2s ease-in-out infinite",
        "progress-pulse": "progressPulse 1.5s ease-in-out infinite",
        "near-breakthrough": "nearBreakthrough 1s ease-in-out infinite",
        "breakthrough-explosion": "breakthroughExplosion 0.8s ease-out forwards",
        "breakthrough-ring": "breakthroughRing 1.5s ease-out infinite",
        "lightning-flash": "lightningFlash 0.5s ease-in-out",
        "realm-reveal": "realmTextReveal 1s ease-out forwards",
        "stat-count": "statCountUp 0.5s ease-out forwards",
        "qi-flow": "qiFlow 3s linear infinite",
        "meridian-pulse": "meridianPulse 2s ease-in-out infinite",
        "meridian-activate": "meridianActivate 0.6s ease-out forwards",
        "particle-rise": "particleRise 2s ease-out forwards",
        "particle-spin": "particleSpin 3s linear infinite",
        "exp-gain": "expGain 0.5s ease-out",
        shimmer: "shimmer 2s linear infinite",

        // UI transition animations
        "tab-fade-in": "tabFadeIn 0.3s ease-out forwards",
        "tab-fade-out": "tabFadeOut 0.2s ease-in forwards",
        "modal-enter": "modalEnter 0.3s ease-out forwards",
        "modal-exit": "modalExit 0.2s ease-in forwards",
        "modal-backdrop": "modalBackdropEnter 0.3s ease-out forwards",
        "button-glow": "buttonGlow 1.5s ease-in-out infinite",
        "button-ripple": "buttonRipple 0.6s ease-out forwards",
        "button-press": "buttonPressDown 0.15s ease-out",
        "list-item-in": "listItemSlideIn 0.4s ease-out forwards",
        "toast-in": "toastSlideIn 0.4s ease-out forwards",
        "toast-out": "toastSlideOut 0.3s ease-in forwards",

        // Cultivation animations
        "meditation-aura": "meditationAura 3s ease-in-out infinite",
        "exp-particle": "expParticleFlow 1.5s ease-out forwards",
        "breakthrough-ready": "breakthroughReadyPulse 1.5s ease-in-out infinite",
        "cosmic-bg": "cosmicBackground 10s ease-in-out infinite",
        "cosmic-stars": "cosmicStars 2s ease-in-out infinite",
        "qi-flow-enhanced": "qiFlowEnhanced 3s linear infinite",

        // World effect animations
        "travel-path": "travelPath 2s ease-in-out forwards",
        "travel-marker": "travelMarker 0.8s ease-out forwards",
        "region-fade": "regionFadeIn 0.8s ease-out forwards",
        "region-name": "regionNameReveal 1s ease-out forwards",
        "portal-swirl": "portalSwirl 1.5s ease-in-out forwards",
        "portal-ring": "portalRing 1s ease-out infinite",
        "sky-shift": "skyColorShift 30s ease-in-out infinite",
        "season-particle": "seasonParticle 8s linear infinite",
        "floating-leaf": "floatingLeaf 4s ease-in-out infinite",

        // Utility animations
        "fade-in": "fadeIn 0.3s ease-out forwards",
        "fade-out": "fadeOut 0.3s ease-in forwards",
        "scale-in": "scaleIn 0.3s ease-out forwards",
        "scale-out": "scaleOut 0.2s ease-in forwards",
        bounce: "bounce 0.5s ease-in-out",
        shake: "shake 0.5s ease-in-out",
        pulse: "pulse 2s ease-in-out infinite",
        spin: "spin 1s linear infinite",
        float: "float 3s ease-in-out infinite",
        glow: "glowPulse 2s ease-in-out infinite",
        "save-indicator": "saveIndicator 2s ease-out forwards",
        "loading-spinner": "loadingSpinner 1s linear infinite",
        "number-pop": "numberPop 0.4s ease-out",
      },
      keyframes: {
        progressGlow: {
          "0%, 100%": { boxShadow: "0 0 5px currentColor, 0 0 10px currentColor", opacity: "1" },
          "50%": {
            boxShadow: "0 0 15px currentColor, 0 0 25px currentColor, 0 0 35px currentColor",
            opacity: "0.9",
          },
        },
      },
      transitionTimingFunction: {
        "bounce-in": "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
        "bounce-out": "cubic-bezier(0.34, 1.56, 0.64, 1)",
        smooth: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
      transitionDuration: {
        "250": "250ms",
        "350": "350ms",
        "400": "400ms",
      },
    },
  },
  plugins: [],
};
export default config;

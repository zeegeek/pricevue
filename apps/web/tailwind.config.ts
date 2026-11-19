import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

export default {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "1rem", screens: { "2xl": "1200px" } },
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-jakarta)", "var(--font-inter)", "sans-serif"],
      },
      colors: {
        brand: { 50: "#F5F3FF", 100: "#EDE9FE", 400: "#A78BFA", 500: "#8B5CF6", 600: "#7C3AED", 700: "#6D28D9" },
        night: "#0A0A14",
        border: "hsl(var(--border))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
      },
      borderRadius: { lg: "1rem", xl: "1.25rem", "2xl": "1.5rem" },
      backgroundImage: { "brand-gradient": "linear-gradient(120deg,#7C3AED,#C026D3 55%,#F59E0B)" },
      boxShadow: {
        soft: "0 1px 2px rgba(15,15,30,.04), 0 8px 24px -12px rgba(15,15,30,.12)",
        lift: "0 2px 4px rgba(15,15,30,.06), 0 24px 48px -20px rgba(76,29,149,.35)",
        glow: "0 10px 40px -10px rgba(124,58,237,.6)",
      },
      transitionTimingFunction: { "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)", spring: "cubic-bezier(0.34, 1.56, 0.64, 1)" },
      keyframes: {
        "fade-up": { from: { opacity: "0", transform: "translateY(12px)" }, to: { opacity: "1", transform: "none" } },
        marquee: { from: { transform: "translateX(0)" }, to: { transform: "translateX(-50%)" } },
        draw: { from: { strokeDashoffset: "1" }, to: { strokeDashoffset: "0" } },
      },
      animation: {
        "fade-up": "fade-up .7s cubic-bezier(0.16,1,0.3,1) both",
        marquee: "marquee 40s linear infinite",
        draw: "draw 1.6s cubic-bezier(0.16,1,0.3,1) both",
      },
    },
  },
  plugins: [animate],
} satisfies Config;

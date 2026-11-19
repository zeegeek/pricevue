# PricePulse — Design Tokens

Target stack: **Next.js + Tailwind CSS + shadcn/ui**. Tokens are expressed as CSS variables (HSL, shadcn convention) and mapped in `tailwind.config.ts`. Both mockups (`landing.html`, `product.html`) use exactly these values.

## 1. Brand idea
"Pulse" = a living price heartbeat. A violet→fuchsia→amber gradient is the brand signature, used **sparingly** (hero headline, primary CTA, chart line, logo). Everything else is calm neutrals so prices and savings stay the loudest thing on screen.

## 2. Colour palette

### Brand
| Token | Hex | Usage |
|---|---|---|
| `brand-50` | `#F5F3FF` | tinted backgrounds |
| `brand-100` | `#EDE9FE` | chips, hover fills |
| `brand-400` | `#A78BFA` | dark-mode accents, focus ring (dark) |
| `brand-500` | `#8B5CF6` | gradient start |
| `brand-600` | `#7C3AED` | **primary** (buttons, links) — 5.7:1 on white |
| `brand-700` | `#6D28D9` | primary hover / text on tint — 7.1:1 |
| `fuchsia-500` | `#D946EF` | gradient mid |
| `amber-400` | `#FBBF24` | gradient end, "hot deal" spark |

`--gradient-brand: linear-gradient(120deg,#7C3AED 0%,#C026D3 55%,#F59E0B 100%)`

### Semantic (price meaning — never rely on colour alone; always pair with icon/label)
| Token | Light | Dark | Meaning |
|---|---|---|---|
| `success` (price drop / best price) | `#047857` (emerald-700, 5.5:1) | `#34D399` | lower price, "Best price", "Good time to buy" |
| `danger` (price rise) | `#B91C1C` (red-700, 6.5:1) | `#F87171` | higher price, "Wait" |
| `warning` (neutral / fair) | `#B45309` (amber-700, 5.0:1) | `#FBBF24` | "Fair price" |
| `info` | `#0369A1` | `#38BDF8` | last-checked, notes |

### Store accents (chips/logo tiles only — text on them is white, ≥4.5:1)
| Store | Hex |
|---|---|
| Amazon.in | `#232F3E` + `#FF9900` mark |
| Flipkart | `#2874F0` (+ `#FFE11B` mark) |
| Myntra | `#E4366F`→ use `#C81E5A` for text bg (AA) |
| Ajio | `#2C4152` |
| Croma | `#0F7D7E` |

### Neutrals (shadcn CSS variables, HSL)
```css
:root {
  --background: 240 33% 99%;      /* #FBFBFE */
  --foreground: 240 30% 9%;       /* #0F0F1E */
  --card: 0 0% 100%;
  --muted: 240 20% 96%;
  --muted-foreground: 240 8% 38%; /* #5A5A6B — 6.6:1 on bg */
  --border: 240 14% 90%;
  --primary: 262 83% 58%;         /* #7C3AED */
  --primary-foreground: 0 0% 100%;
  --success: 161 94% 24%;
  --danger: 0 74% 42%;
  --warning: 26 90% 37%;
  --ring: 262 83% 58%;
  --radius: 1rem;
}
.dark {
  --background: 240 33% 5%;       /* #0A0A14 */
  --foreground: 240 20% 97%;
  --card: 240 25% 9%;             /* #11111E */
  --muted: 240 18% 13%;
  --muted-foreground: 240 10% 70%;/* #ACACBE — 8.9:1 on bg */
  --border: 240 14% 18%;
  --primary: 258 90% 76%;         /* #A78BFA for text/links on dark */
  --primary-foreground: 240 33% 5%;
  --success: 158 64% 52%;
  --danger: 0 91% 71%;
  --warning: 43 96% 56%;
  --ring: 258 90% 76%;
}
```

## 3. Typography
- **Display / headings:** `Plus Jakarta Sans` 700–800, tracking `-0.02em`.
- **Body / UI:** `Inter` 400–600.
- **Prices & numbers:** `Inter` with `font-variant-numeric: tabular-nums` (`tabular-nums` utility) so columns align. Rupee: always `₹` + Indian grouping (`₹1,29,999`) via `Intl.NumberFormat('en-IN')`.

| Role | Mobile | ≥md | Weight / LH |
|---|---|---|---|
| display | 40px | 64px | 800 / 1.05 |
| h1 | 30px | 40px | 800 / 1.1 |
| h2 | 24px | 30px | 700 / 1.2 |
| h3 | 18px | 20px | 700 / 1.3 |
| body | 16px | 16px | 400 / 1.6 |
| small | 14px | 14px | 500 / 1.5 |
| caption | 12px | 12px | 500 / 1.4 (min size; never below 12) |
| price-xl | 36px | 44px | 800 tabular |

## 4. Radius
| Token | Value | Use |
|---|---|---|
| `rounded-sm` | 8px | badges |
| `rounded-md` | 12px | inputs, buttons |
| `rounded-lg` | 16px (`--radius`) | cards |
| `rounded-xl` | 24px | hero search, panels |
| `rounded-full` | 9999px | chips, avatars, toggles |

## 5. Elevation & glass
```txt
shadow-soft : 0 1px 2px rgba(16,16,40,.04), 0 4px 16px rgba(16,16,40,.06)
shadow-lift : 0 10px 30px -10px rgba(76,29,149,.25)        /* hover */
shadow-glow : 0 0 0 1px rgba(124,58,237,.15), 0 20px 60px -15px rgba(124,58,237,.45)  /* primary CTA, search */
glass       : bg-white/60 dark:bg-white/5 + backdrop-blur-xl + border border-white/40 dark:border-white/10
```
Glass is reserved for: sticky header, hero search shell, floating "buy-or-wait" card. Never put body text on glass over busy imagery without a ≥60% opaque fill.

## 6. Motion
| Token | Value | Use |
|---|---|---|
| `duration-fast` | 150ms | hover colour, focus |
| `duration-base` | 250ms | cards lift, toggles |
| `duration-slow` | 600ms | chart draw, meter needle |
| `ease-out-expo` | `cubic-bezier(.16,1,.3,1)` | entrances |
| `ease-spring` | `cubic-bezier(.34,1.56,.64,1)` | chips / button press |

Rules: hover lift `-translate-y-0.5` + `shadow-lift`; press `scale-[.98]`; fade-up entrances staggered 60ms; chart path draws via `stroke-dashoffset`. **All non-essential motion is disabled under `prefers-reduced-motion: reduce`.**

## 7. Accessibility checklist
- Body text ≥ 4.5:1, large text/UI ≥ 3:1 (values above verified).
- Visible focus: `focus-visible:ring-2 ring-ring ring-offset-2 ring-offset-background`.
- Price up/down always paired with ▲/▼ icon + text ("₹2,000 lower").
- Chart has a text summary + table fallback (`aria-describedby`).
- Tap targets ≥ 44px; mobile-first breakpoints `sm 640 / md 768 / lg 1024 / xl 1280`.

## 8. `tailwind.config.ts`
```ts
import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

export default {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "1rem", screens: { "2xl": "1280px" } },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: "hsl(var(--card))",
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        success: "hsl(var(--success))",
        danger: "hsl(var(--danger))",
        warning: "hsl(var(--warning))",
        brand: { 50: "#F5F3FF", 100: "#EDE9FE", 400: "#A78BFA", 500: "#8B5CF6", 600: "#7C3AED", 700: "#6D28D9" },
        store: { amazon: "#232F3E", amazonMark: "#FF9900", flipkart: "#2874F0", myntra: "#C81E5A", ajio: "#2C4152", croma: "#0F7D7E" },
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', "Inter", "system-ui", "sans-serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: { lg: "var(--radius)", md: "calc(var(--radius) - 4px)", sm: "calc(var(--radius) - 8px)", xl: "1.5rem" },
      boxShadow: {
        soft: "0 1px 2px rgba(16,16,40,.04), 0 4px 16px rgba(16,16,40,.06)",
        lift: "0 10px 30px -10px rgba(76,29,149,.25)",
        glow: "0 0 0 1px rgba(124,58,237,.15), 0 20px 60px -15px rgba(124,58,237,.45)",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(120deg,#7C3AED 0%,#C026D3 55%,#F59E0B 100%)",
        "mesh": "radial-gradient(60% 50% at 20% 10%,rgba(124,58,237,.18),transparent 60%),radial-gradient(40% 40% at 85% 20%,rgba(217,70,239,.14),transparent 60%),radial-gradient(40% 40% at 60% 90%,rgba(245,158,11,.10),transparent 60%)",
      },
      transitionTimingFunction: { "out-expo": "cubic-bezier(.16,1,.3,1)", spring: "cubic-bezier(.34,1.56,.64,1)" },
      transitionDuration: { fast: "150ms", base: "250ms", slow: "600ms" },
      keyframes: {
        "fade-up": { from: { opacity: "0", transform: "translateY(12px)" }, to: { opacity: "1", transform: "none" } },
        pulse: { "0%,100%": { opacity: "1" }, "50%": { opacity: ".45" } },
        draw: { to: { strokeDashoffset: "0" } },
        marquee: { to: { transform: "translateX(-50%)" } },
      },
      animation: {
        "fade-up": "fade-up .6s cubic-bezier(.16,1,.3,1) both",
        draw: "draw 1.2s cubic-bezier(.16,1,.3,1) forwards",
        marquee: "marquee 40s linear infinite",
      },
    },
  },
  plugins: [animate],
} satisfies Config;
```

## 9. Component notes (shadcn mapping)
- Omni-search → `Command` + `Input`, detects URL vs. text; store chips are `ToggleGroup`.
- Variant lock → `ToggleGroup` (storage, colour); a lock badge shows the same SKU is compared everywhere.
- Comparison table → `Table`; best row gets `ring-2 ring-success/40 bg-success/5` + "Best price" `Badge`.
- History ranges → `Tabs`; chart via Recharts/visx with the same tokens.
- Alert panel → `Card` + `Form` + `Switch` per channel.
- Buy-or-wait → custom radial meter; always render the "Not a forecast" disclaimer.

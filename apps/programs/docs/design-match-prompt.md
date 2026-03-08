# Prompt: Match This App’s Color Palette and Style in a React App

Copy the block below and use it with an AI (e.g. Cursor, ChatGPT) or hand it to a developer to replicate this project’s look and feel in a React app.

---

## Design match prompt (copy from here)

**Goal:** Match the color palette and visual style of the “AI Fitcopilot” app in a React app (with Tailwind CSS preferred).

### Color palette

- **Page background:** `#0d0500` (very dark brown/black). Use for `body`, full-screen overlays, and main page background.
- **Primary accent / CTA / brand:** `#ffbf00` (amber/gold). Use for:
  - Primary buttons and CTAs (e.g. “Start”, “Save”) — button bg `#ffbf00`, text black.
  - Nav highlights, key labels, badges, and “active” states.
  - Focus rings and important borders (e.g. `border-[#ffbf00]`, `focus:border-[#ffbf00]/50`).
- **Secondary accent (hover/emphasis):** `#ff8000` (orange) — used sparingly for hover overlays (e.g. `bg-[#ff8000]/20`).
- **Text:** Primary `#fff` (white). Muted/secondary use white with opacity: `text-white/90`, `text-white/60`, `text-white/40`, `text-white/20`.
- **Surfaces and borders:**
  - Cards/panels: `bg-black/20`, `bg-black/40`, `bg-white/5`; borders `border-white/10`, `border-white/20`.
  - Admin/darker UI: `bg-slate-800`, `border-slate-700`, `text-slate-300`, `text-slate-400`.
- **Semantic:** Success `green-400`/`green-600`; warning `amber-400`/`amber-500`; error/destructive `red-400`/`red-500`. Rest phase (e.g. timers) `bg-blue-600`.

### Typography

- **Body / UI:** `Space Grotesk` — sans-serif for body, labels, and UI. Weights: 400 (light), 600 (medium), 700 (black).
- **Headings / display:** `Syncopate` — used for all headings (h1–h6) and display text; uppercase, bold/black. In Tailwind: `font-heading` or a custom font family pointing to Syncopate.
- **Monospace / labels:** System or `font-mono` for small caps labels: `font-mono text-[10px] uppercase tracking-[0.2em]` or `tracking-[0.4em]`, often in accent color `#ffbf00`.

### Style patterns

- **Cards:** Rounded corners (`rounded-xl`, `rounded-2xl`, `rounded-3xl`), subtle borders (`border border-white/10`), dark fill (`bg-black/20` or `bg-white/5`). Optional `backdrop-blur-sm`.
- **Buttons — primary:** `bg-[#ffbf00] text-black font-bold` (or `font-medium`), hover `hover:bg-[#ffbf00]/90`. Often `rounded-xl` or `rounded-lg`, `px-6 py-3` (or similar).
- **Buttons — secondary/ghost:** `border border-white/10 bg-white/5 text-white`, hover `hover:bg-white/10`.
- **Badges/pills:** Small rounded pills, e.g. `rounded-full px-3 py-1 text-xs font-bold uppercase`; default accent `bg-[#ffbf00]/20 text-[#ffbf00]`.
- **Inputs:** Dark theme — `bg-black/20` or `bg-transparent`, `border-white/10`, `text-white`, `placeholder:text-white/40`; focus `focus:border-[#ffbf00]/50 focus:outline-none`.
- **Links:** White by default; hover `hover:text-[#ffbf00]` (and optionally `hover:underline`).

### Optional: Tailwind config

- Extend `theme.fontFamily`: `font-heading: ['Syncopate', 'sans-serif']`, `sans: ['Space Grotesk', 'sans-serif']`.
- Use arbitrary values for brand colors: `bg-[#0d0500]`, `bg-[#ffbf00]`, `text-[#ffbf00]`, `border-[#ffbf00]/30`. Or define in `theme.extend.colors` (e.g. `brand: { DEFAULT: '#ffbf00', dark: '#0d0500' }`).

### Optional: protocol/section accents

For different sections or “protocols” (e.g. Warmup, Tabata, AMRAP), keep primary CTA/nav as `#ffbf00` but allow section badges/headers to use:

- Warmup: `slate-600` / `slate-400`
- Tabata: `red-600` / `red-400`
- Mindful: `green-600` / `green-400`
- Others: indigo, amber, yellow, emerald, lime, sky, teal, orange, cyan at 600/400 for badge and work-phase header.

### Summary

- Background: `#0d0500`.
- Primary accent: `#ffbf00` (buttons, nav, labels, focus).
- Text: white with opacity for hierarchy.
- Surfaces: black/white with low opacity; borders white/10–20.
- Fonts: Space Grotesk (body), Syncopate (headings); monospace for small caps labels.
- Rounded corners, subtle borders, dark glass-like panels; primary buttons are gold with black text.

---

## End of prompt (copy until here)

# Sfinx UI Designer — Agent Memory

## Key File Locations

- **SfinxSpinner**: `/app/shared/components/SfinxSpinner.tsx`
- **Shared components barrel**: `/app/shared/components/index.ts`
- **Global CSS / design tokens**: `/app/globals.css`
- **Tailwind config**: check root for `tailwind.config.*`

## Confirmed Design Tokens (from globals.css)

```css
--sfinx-purple: #8B5CF6;
--sfinx-purple-light: #EDE9FE;
--sfinx-purple-dark: #6D28D9;
--page-bg: #F7F5FF;
--card-bg: rgba(255,255,255,0.88);
--border-subtle: rgba(139,92,246,0.10);
--glass-shadow: 0 8px 32px rgba(139,92,246,0.08), 0 2px 8px rgba(0,0,0,0.04);
```

Purple ramp used in spinner: `#8B5CF6` (500), `#A78BFA` (400), `#C4B5FD` (300), `#6D28D9` (700).

## SfinxSpinner — Current State (post-redesign)

- **Props**: `size?: "sm" | "md" | "lg"`, `className?`, `title: string`, `messages: string | string[]`
- **Animation**: Framer Motion — three tilted elliptical orbital rings (preserve-3d CSS tilt + FM rotate),
  breathing gradient nucleus, AnimatePresence message cycling.
- **Colors**: Sfinx purple ramp only. No cyan/indigo (those were removed in the redesign).
- **Entrance**: `motion.div` fade+slide, `delay: 0.15`, no opacity-0 hack.
- **CenterType env-var system was removed** — replaced with single definitive nucleus aesthetic.
- **`-mt-32`** from old component → `marginTop: size === "lg" ? "-4rem" : "0"` inline on root motion.div.

## Framer Motion Patterns Confirmed in This Project

- Version: `^12.23.12` (framer-motion v12)
- API: `motion.*`, `AnimatePresence`, `layoutId` — all standard v12 imports from `"framer-motion"`
- `AnimatePresence mode="wait"` for message/content crossfades
- Negative `delay` values work for offsetting repeating animations (pre-wind orbit positions)

## Pre-existing TS Errors (not our responsibility)

- `/app/(features)/company-dashboard/content.tsx` has parse errors (TS1003, TS1005, etc.) — pre-existing, unrelated to spinner work.

## company-dashboard Patterns (confirmed)

- **Import path for navigationSlice**: `@/shared/state/slices/navigationSlice` (NOT `app/shared/...`)
- **Import path for SfinxSpinner**: `app/shared/components/SfinxSpinner` (bare, no `@`)
- **Import path for DashboardPageLayout**: `{ DashboardPageLayout } from "app/shared/components"` (barrel)
- **DashboardPageLayout props**: `title`, `subtitle`, optional `action`, `children` — wraps in `min-h-screen p-8 md:p-12`
- **BentoStats grid**: 4-col/2-row via inline `style`, not Tailwind class. Featured tile uses `gridColumn:"3/5"` + `gridRow:"1/3"`, purple gradient, no `glass-card` class
- **AnimatedStat**: `useMotionValue` + `useTransform` + `animate` from framer-motion; add `count` to `useEffect` deps array
- **Table row key**: use `applicationId` (unique per application), not `id` (candidate may appear multiple times)
- **Top-performer detection**: `index < 5` on already-filtered sorted array — top 5 in the current view, not globally
- **PendingTable opacity**: set on wrapper via `animate={{ opacity: 0.6 }}` and `className="opacity-60"` together
- **Job filter**: only render when `data.jobs.length > 1`; clicking active pill resets to null (toggle behavior)
- **AnimatePresence**: wrap each conditional table section separately with `mode="wait"` and `key` based on filter state
- **animate-subtle-pulse**: defined in `/app/globals.css`, safe to use via className

## Workflow Notes

- pnpm is the package manager (`pnpm exec tsc --noEmit` for type checks)
- Branch: `master` is the main branch pushed to
- Always run `pnpm exec tsc --noEmit | grep <filename>` to confirm no new errors before committing

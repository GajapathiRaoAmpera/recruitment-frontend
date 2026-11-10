---
name: stitch-to-react
description: Build a React screen from an Ampera Stitch mockup. Use when implementing any page or component that has a folder in stitch_ampera_campus_recruitment_platform/.
---

# Stitch mockup → React screen

1. Open `stitch_ampera_campus_recruitment_platform/<screen>/screen.png` (look at it) and `code.html`.
2. Tokens: use the names from the mockup's `tailwind.config` (e.g. `bg-surface-container`, `text-on-surface`, `text-headline-md`); they live in `tailwind.config.js` already. Never paste hex values.
3. Split into: page in `src/features/<feature>/<Screen>Page.jsx`; repeated pieces into `src/components/` only if a second screen uses them.
4. Replace static mock data with the TanStack Query hook from `src/api/` for the endpoint listed in `../docs/04-api-contracts.md` (screen map). Missing endpoint → stop and flag.
5. Drop from the mockup: CDN scripts, inline `<script>`, fake avatars/remote images, decorative blur blobs that hurt contrast.
6. Add states: loading (skeleton), empty, error with retry, permission-denied. Keep buttons verb-first.
7. Accessibility: labels on inputs, Material Symbols icons get `aria-hidden` + text label, visible focus.
8. Check at 375px and 1280px; run `npm run lint && npm test`.

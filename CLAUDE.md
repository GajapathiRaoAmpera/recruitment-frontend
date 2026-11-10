# recruitment-frontend

**Purpose:** One React SPA with three role-routed portals (Student, HR, Super Admin) for Ampera Campus Hire. Talks only to the Python API (`../docs/04-api-contracts.md`), except the Gemini Live stream via a server-minted ephemeral token.

## Map
```
stitch_ampera_campus_recruitment_platform/   design mockups (code.html + screen.png per screen) — reference, not shipped
  ampera_campus_hire/DESIGN.md               design tokens & rules — source of truth for styling
src/app/          router, providers, role guards
src/api/          fetch client + TanStack Query hooks per feature
src/components/   shared UI built from Stitch tokens
src/features/     auth, hr-dashboard, drives, candidates, question-bank, test-runner, coding, interview, results, admin
src/styles/       Tailwind tokens (copied from DESIGN.md / Stitch tailwind.config)
```
Danger zone with its own CLAUDE.md: `src/features/test-runner/`.

## Commands
```bash
npm install
npm run dev        # Vite on :5173, VITE_API_URL=http://localhost:8000/api/v1
npm run lint
npm test           # Vitest
npm run build
```

## Rules
- React 18 + Vite + **JavaScript** (no TypeScript), React Router, TanStack Query, Tailwind, Monaco for code.
- Build screens from the matching Stitch mockup (skill `stitch-to-react`); use tokens, no hard-coded colours.
- Role checks in UI are convenience only; never hide data the API should not send.
- Only `VITE_*` env vars reach the browser — never put secrets there.
- Every data view handles loading, empty, error and permission-denied states.
- Also follow `.claude/rules/`. Agents in `.claude/agents/` for UI review and API integration.

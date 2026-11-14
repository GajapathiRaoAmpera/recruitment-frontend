# recruitment-frontend

**Purpose:** One Next.js app with three role-routed portals (Student, HR, Super Admin) for Ampera Campus Hire. Talks only to the Python API (`../docs/04-api-contracts.md`), except the Gemini Live stream via a server-minted ephemeral token.

## Map
```
stitch_ampera_campus_recruitment_platform/   design mockups (code.html + screen.png per screen) — reference, not shipped
  ampera_campus_hire/DESIGN.md               design tokens & rules — source of truth for styling
src/app/          Next.js App Router pages; (staff)/(student) layouts are the role guards. A page.tsx only
                  renders a screen from src/features/<area>/ (plus metadata); no logic in route files
src/api/          client.ts: fetch to /api/v1 (same-origin rewrite to FastAPI) with the staff token
src/components/   shared UI built from Stitch tokens
src/features/     auth/ (real staff sign-in), test-runner/ (danger zone); more as screens move off mocks
src/lib/          auth.ts (liveApi switch + staff token from POST /auth/login), helpers
src/mock/         in-memory prototype data; replace screen by screen as endpoints land
src/styles/       SCSS tokens + mixins (copied from DESIGN.md)
```
Danger zone with its own CLAUDE.md: `src/features/test-runner/`.

## Commands
`make` lists shortcuts for these (`make check` before pushing).
```bash
npm install
npm run dev        # Next on :3000; copy .env.example to .env.local (NEXT_PUBLIC_LIVE_API unset = prototype mode)
npm run lint
npm run typecheck
npm test           # Vitest
npm run build
```

## Rules
- Next.js (App Router) + React 19 + TypeScript, SCSS modules with Stitch tokens, Monaco for code.
- Build screens from the matching Stitch mockup (skill `stitch-to-react`); use tokens, no hard-coded colours.
- Role checks in UI are convenience only; never hide data the API should not send.
- Only `NEXT_PUBLIC_*` env vars reach the browser — never put secrets there.
- Every data view handles loading, empty, error and permission-denied states.
- Also follow `.claude/rules/`. Agents in `.claude/agents/` for UI review and API integration.

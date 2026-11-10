# Architecture Rules

- Specs live in ../docs/ (requirements, architecture, schema, API contracts, plan). Read the relevant one before building a feature.
- One SPA, three role-routed portals; feature folders under src/features/, shared UI in src/components/.
- All server data goes through src/api/ (one fetch client + TanStack Query hooks). No direct Supabase DB or Judge0 calls from the browser.
- Do not invent endpoints; if a needed one is missing from 04-api-contracts.md, stop and flag it.

# Testing and Quality Rules

- Inspect existing test tooling and package scripts before running commands.
- Add or update tests for meaningful changes.
- Prefer provider mocks in automated tests; avoid mandatory paid model calls.
- Test authorization, tenant isolation, workflow state transitions, approvals, versioning, stale artifacts, and failure/retry behavior.
- Test diagram schema validation and node/edge references.
- Test budget formulas and project dependency integrity.
- Report exact commands and outcomes; distinguish skipped tests from passing tests.
- Update docs when setup or architecture changes.

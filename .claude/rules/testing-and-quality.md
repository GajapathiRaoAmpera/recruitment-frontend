# Testing and Quality Rules

- Inspect existing test tooling and package scripts before running commands.
- Add or update tests for meaningful changes; reference the AC id from ../docs/01-requirements.md.
- Mock the API (MSW) in component tests; never call Gemini or Judge0 from tests.
- Test role guards, attempt state transitions (in_progress → locked → resumed → submitted), draft recovery and tab-switch handling.
- Report exact commands and outcomes; distinguish skipped tests from passing tests.
- Update docs when setup or architecture changes.

# features/test-runner — danger zone (student test runtime)
- Timer shows `deadline_at - server_now` (offset computed once from GET /attempt); never trust local clock or a locally stored remaining time.
- Drafts: localStorage key `attempt:<attempt_id>:q:<question_id>`; write on change (debounced 500 ms), PUT to API every 10 s and on question switch; on load, prefer the newer of local vs server (`updated_at`).
- Integrity: request fullscreen on start; on `visibilitychange` (hidden) or fullscreen exit, POST /attempt/violations once per event; if response `locked`, show the lock screen and stop timers.
- Clear the attempt's localStorage keys after successful submit.
- Never render data the API didn't send; no answer keys exist client-side.
- Covered by AC-6 and AC-7 Playwright tests.

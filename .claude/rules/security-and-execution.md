# Security and Execution Rules

- Backend authorization is authoritative; enforce tenant isolation server-side.
- Treat uploads, retrieved documents, and model output as untrusted input.
- Validate model-generated structured data before persistence or use.
- Never expose secrets to the browser, prompts, generated artifacts, or logs.
- Never execute arbitrary model-generated shell commands on the host.
- Use an isolated restricted sandbox with resource limits, timeouts, and controlled network access for code execution.
- Require explicit approval for destructive, privileged, deployment, secret-access, and other high-impact operations.
- Do not expose private chain-of-thought; provide concise summaries, assumptions, evidence, and tool outcomes.
- Do not claim execution or validation succeeded without verifiable results.

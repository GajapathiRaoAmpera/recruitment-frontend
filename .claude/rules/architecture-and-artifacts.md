# Architecture and Artifact Rules

- Prefer a modular monolith and background workers initially unless verified needs justify service separation.
- Use typed, versioned structured artifacts as the source of truth.
- Store diagrams as validated JSON node/edge structures; images and Mermaid are export formats.
- Every artifact revision must identify its project and source revisions.
- Approved revisions are immutable; edits create new revisions.
- Downstream agents use approved revisions as authoritative inputs.
- Upstream changes must mark affected outputs stale and explain why.
- Validate schema, references, dependencies, and provenance on the server.

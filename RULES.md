# Rules

## Repository Rules

- Keep code, documentation, and architecture notes in sync for every functional change.
- Use English for Markdown documentation, code comments, file names, identifiers, and commit messages.
- Prefer descriptive commits that explain the behavior change, not just the file touched.
- Do not leave documented features unimplemented.

## Development Workflow

1. Read the existing documentation and affected code before changing behavior.
2. Update the relevant Markdown files whenever user-facing behavior, architecture, or scripts change.
3. Run at least `npm run build` before closing a coding task.
4. Commit the finished change set and push it to GitHub.

## Frontend Conventions

- Keep board interaction logic in React event handlers or lifecycle effects, not in ad hoc global state.
- Treat PeerJS setup as lifecycle-owned state so cleanup is deterministic.
- Prefer typed helpers in `src/lib/board.ts` for shared board and invite utilities.
- Avoid introducing undocumented runtime configuration.

## Networking Conventions

- Public signaling is the default path.
- Local PeerServer mode must remain configurable from the setup UI and serializable into the invite URL.
- Room synchronization stays host-authoritative unless the architecture docs are updated to describe a different model.

## Documentation Targets

- `README.md` explains setup, scripts, and user-facing features.
- `ARCHITECTURE.md` explains runtime structure, synchronization flow, and constraints.
- `RULES.md` records the working conventions for this repository.

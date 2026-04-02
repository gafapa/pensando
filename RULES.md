# Rules

## Repository Rules

- Keep code, documentation, and architecture notes in sync for every functional change.
- Use English for Markdown documentation, code comments, file names, identifiers, and commit messages.
- Prefer descriptive commits that explain the behavior change, not just the file touched.
- Do not leave documented features unimplemented.

## Development Workflow

1. Read the existing documentation and affected code before changing behavior.
2. Update the relevant Markdown files whenever user-facing behavior, architecture, localization, or deployment configuration changes.
3. Run at least `npm run build` before closing a coding task.
4. Commit the finished change set and push it to GitHub.

## Frontend Conventions

- Keep board interaction logic in React event handlers or lifecycle effects, not in ad hoc global state.
- Treat PeerJS setup as lifecycle-owned state so cleanup is deterministic.
- Prefer typed helpers in `src/lib/board.ts` and `src/lib/i18n.ts` for shared board, invite, and translation logic.
- Add new UI copy through the shared translation catalog instead of inline literals.

## Networking Conventions

- Public PeerJS cloud signaling is the only supported runtime path.
- Do not reintroduce local PeerServer configuration unless the architecture and README are updated in the same change.
- Room synchronization stays host-authoritative unless the architecture docs are updated to describe a different model.

## Deployment Conventions

- The published app lives under `/pensando/`.
- Vite base configuration and generated share URLs must remain compatible with that subpath.

## Documentation Targets

- `README.md` explains setup, scripts, localization, and user-facing features.
- `ARCHITECTURE.md` explains runtime structure, synchronization flow, deployment, and constraints.
- `RULES.md` records the working conventions for this repository.

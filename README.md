# AulaFlux

AulaFlux is a local-first collaborative whiteboard for classrooms, workshops, and group activities. It runs as a single-page React app and synchronizes sessions through PeerJS cloud signaling.

## Features

- Shareable room IDs
- Join link with QR code
- Editable sticky notes
- Visual zones with optional grid reflow
- Connectors between board objects
- Drag and drop image upload for files under 2 MB
- Remote cursors with participant names
- Session export and import through Fabric JSON snapshots
- Built-in UI localization for Spanish, Galician, English, French, German, Portuguese, Catalan, and Basque

## Stack

- React 19
- TypeScript
- Vite 8
- Tailwind CSS 4
- Fabric.js 7
- PeerJS
- `qrcode` for invite QR generation
- `motion`
- `lucide-react`
- `sonner`
- `@fontsource-variable/space-grotesk`

## Session Model

The application uses a host-authoritative model.

- The host owns the room ID, accepts peer connections, sends the initial snapshot, and rebroadcasts updates.
- Each peer connects to the host room, sends local edits, and receives object, metadata, and cursor updates.

Supported message types:

- `HELLO`
- `SYNC_SNAPSHOT`
- `UPSERT_OBJECT`
- `REMOVE_OBJECT`
- `UPDATE_META`
- `CURSOR`

## Localization

The app includes these interface languages:

- Spanish (`es`)
- Galician (`gl`)
- English (`en`)
- French (`fr`)
- German (`de`)
- Portuguese (`pt`)
- Catalan (`ca`)
- Basque (`eu`)

The selected language is stored in the `lang` query parameter so invite links keep the same UI language for peers.

## Local Development

```bash
npm install
npm run dev
```

Default dev URL:

```bash
http://localhost:5173/pensando/
```

## Production Build

```bash
npm run build
```

The Vite base path is configured as `/pensando/` for deployment under that subpath.

## Networking

- The app uses PeerJS cloud signaling only.
- There is no local PeerServer configuration in the UI.
- Invite links only carry `room` and `lang`.
- An invited board can only be opened as a peer, so each board keeps a single teacher/host session.
- The teacher can edit every object on the board.
- Each student can create and edit only the objects they own.

## Project Structure

```text
src/
  App.tsx         Main UI, board lifecycle, localization, and P2P session flow
  main.tsx        React bootstrap and toaster setup
  index.css       Global styles
  qrcode.d.ts     Local typing shim for the qrcode package
  lib/board.ts    Board factories, serialization, and share URL helpers
  lib/i18n.ts     Language catalog and localization helpers
```

## Notes

- Networking starts inside the board lifecycle instead of the setup click handler, which keeps development behavior stable under React StrictMode.
- The production bundle still emits a chunk-size warning because the main client bundle is large. This does not block the build.

## Related Docs

- [ARCHITECTURE.md](/D:/ProyectosIA/pensando/ARCHITECTURE.md)
- [RULES.md](/D:/ProyectosIA/pensando/RULES.md)

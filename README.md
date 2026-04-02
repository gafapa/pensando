# AulaFlux

AulaFlux is a local-first collaborative whiteboard for classrooms, workshops, and group activities. It is designed to start quickly, run without an application backend, and support real-time sessions between a host and multiple peers over a local network or the internet.

## Features

- Shareable room IDs
- Join link with QR code
- Editable sticky notes
- Visual zones with optional grid reflow
- Connectors between board objects
- Drag and drop image upload for files under 2 MB
- Remote cursors with participant names
- Session export and import through Fabric JSON snapshots
- Optional local PeerServer support for isolated classroom networks

## Stack

- React 19
- TypeScript
- Vite 8
- Tailwind CSS 4
- Fabric.js 7
- PeerJS
- `peer` for the optional local signaling server
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

## Local Development

```bash
npm install
npm run dev
```

Default dev URL:

```bash
http://localhost:5173
```

## Production Build

```bash
npm run build
```

The current tree builds successfully with that command.

## Offline or Local-Network Signaling

If browsers cannot reach the public PeerJS cloud broker, start a local PeerServer on the host machine:

```bash
npm run peer-server
```

Then, in the setup screen:

1. Enable `Usar PeerServer local`.
2. Enter the host IP or hostname.
3. Confirm the port and path.
4. Share the generated invite URL or QR code.

The shared link now includes the local signaling parameters so peers can connect without manual re-entry.

## Project Structure

```text
src/
  App.tsx         Main UI, board lifecycle, and P2P session flow
  main.tsx        React bootstrap and toaster setup
  index.css       Global styles
  qrcode.d.ts     Local typing shim for the qrcode package
  lib/board.ts    Board factories, serialization, and shared utilities

scripts/
  peer-server.mjs Optional local PeerJS signaling server
```

## Notes

- Networking now starts inside the board lifecycle instead of the setup click handler, which keeps development behavior stable under React StrictMode.
- The build currently emits a Vite chunk-size warning because the main client bundle is still large. This is informational and does not block the build.

## Related Docs

- [ARCHITECTURE.md](/D:/ProyectosIA/pensando/ARCHITECTURE.md)
- [RULES.md](/D:/ProyectosIA/pensando/RULES.md)

# Architecture

## Overview

AulaFlux is a single-page React application that renders a Fabric.js canvas and synchronizes board activity through PeerJS data connections. There is no application backend and no local signaling configuration in the runtime UI.

## Runtime Pieces

### UI shell

- `src/App.tsx` owns the setup flow, room controls, invite UI, language selection, and board toolbar.
- `src/main.tsx` mounts the React tree and global toaster notifications.
- `src/index.css` defines the visual system and board background treatments.

### Board domain

- `src/lib/board.ts` contains board object factories, serialization helpers, snapshot generation, room ID generation, and share URL helpers.
- Fabric objects are tagged with custom metadata such as `id`, `kind`, `updatedAt`, `zoneId`, and connector endpoints.

### Localization

- `src/lib/i18n.ts` defines the supported locales and every user-facing message used by the app UI.
- The selected language is stored in the `lang` query parameter so shared links preserve the interface language.

### Networking

- PeerJS data channels carry all collaboration messages.
- The host creates a peer with the room ID.
- Peers create anonymous peer IDs and connect to the host room ID.
- Signaling uses the default PeerJS cloud broker only.
- If the URL already contains a `room` parameter, the setup flow is forced into peer mode so a shared board cannot spawn a second teacher session.

## Board Objects

Supported object kinds:

- `sticky`
- `image`
- `zone`
- `connector`

Important object rules:

- Connectors depend on `sourceId` and `targetId` and are recalculated whenever linked objects move or scale.
- Zones can own sticky notes and images through `zoneId`.
- Grid mode reflows zone members into a deterministic layout.
- `updatedAt` is used as a last-write-wins guard when applying remote updates.

## Synchronization Flow

### Host flow

1. Start PeerJS with the room ID.
2. Accept incoming peer connections.
3. Reply to `HELLO` with a `SYNC_SNAPSHOT`.
4. Rebroadcast object, removal, metadata, and cursor messages to other peers.

### Peer flow

1. Start PeerJS with a generated peer ID.
2. Connect to the host room ID.
3. Send `HELLO`.
4. Apply the received snapshot.
5. Continue sending incremental board updates.

## Lifecycle Constraints

- Networking starts after the board canvas effect mounts and is disposed in the effect cleanup.
- This keeps the development experience stable under React StrictMode, where mount and cleanup can run more than once.
- Localization is React state owned by `App.tsx` and mirrored to the URL with `history.replaceState`.

## Deployment

- Vite is configured with `base: "/pensando/"`.
- Share URLs are generated from the current browser location, so deployed invite links stay under `/pensando/`.

## Persistence

- Export uses Fabric JSON plus app metadata.
- Import replaces the current board snapshot and can optionally rebroadcast when the local client is the host.
- There is no automatic local persistence yet.

## Known Tradeoffs

- The host-authoritative model is simple and demonstrable, but it does not provide CRDT-style conflict resolution.
- The production bundle is still large because Fabric and the whiteboard UI ship in a single client chunk.

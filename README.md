# Void Sector — multiplayer branch

Top-down wave-survival shooter. Authoritative server sim, up to 4 players per room.

## Layout

```
packages/
  shared/   Types + constants shared by client and server. Build this first.
  server/   Authoritative sim (Node, socket.io). Owns all game state.
  client/   Renderer + input (Vite, socket.io-client). Dumb terminal — sends
            input, renders whatever state the server broadcasts.
client/      Old single-player build (plain JS, no build step). Not part of
             the workspace, not touched by anything below.
```

`shared` is a real npm workspace dependency (`@void-sector/shared`), not copy-pasted — both `client` and `server` import its compiled output, so it must be built before either.

## Requirements

- Node 20+
- npm (workspaces)

## Setup

```bash
npm install
npm run build:shared
```

Re-run `build:shared` any time you change something in `packages/shared/src`. `server` and `client` resolve it via `tsconfig` path mapping / a Vite alias in dev, but the compiled `dist/` is still what actually ships.

## Running

Two processes, two terminals:

```bash
npm run dev:server        # packages/server, port 8080
npm --workspace packages/client run dev   # Vite, port 3000
```

Open `http://localhost:3000`. Client auto-connects to `ws://localhost:8080` when `hostname === 'localhost'`; anywhere else it connects to `window.location.origin` (see "Deploying" below).

### Env vars (server)

| Var | Default | Purpose |
|---|---|---|
| `PORT` | `8080` | HTTP/socket.io listen port |
| `CLIENT_ORIGIN` | `*` | CORS origin allowed to connect |

## Building for prod

```bash
npm run build         # shared + server, outputs to packages/*/dist
npm --workspace packages/client run build   # client, outputs to packages/client/dist
```

Serve `packages/client/dist` as static files behind whatever reverse-proxies to the server's socket.io endpoint. Client assumes **same-origin** in production (`window.location.origin`) — put both behind one host/proxy, or edit `SERVER_URL` in `packages/client/src/net/Net.ts` if client and server are on different origins.

## How the network layer works

One socket.io event, `'msg'`, carries a discriminated-union object in both directions — the `type` field is what the server's `router.ts` switches on and what the client's `Net.on(type, handler)` dispatches on. This is the entire protocol; it's defined once in `packages/shared/src/types/messages.ts` (`ClientMessage` / `ServerMessage`) and both ends import it, so client and server can't drift out of sync on message shape.

```
Client → Server:  create, join, start, input, shop_buy, shop_ready
Server → Client:  room_created, room_joined, player_joined, player_left,
                   error, game_start, state, wave_start, event,
                   shop_result, game_over
```

Reconnection and heartbeat are handled by socket.io itself — there's no app-level ping/pong or manual backoff.

### Server internals

- `room/Room.ts` — room + player shape, factories. No logic.
- `room/RoomManager.ts` — create/join/leave/destroy a room, plus `broadcast` / `broadcastExcept` / `sendTo`. Per-connection state (`roomCode`, `playerId`) lives on `socket.data`, not a separate map.
- `router.ts` — one `'msg'` listener per socket, rate-limited (70 msg/s), dispatches by `msg.type` to the functions below.
- `game/GameLoop.ts` — tick orchestration: wave lifecycle, 60fps sim / 20fps broadcast. Everything else in `game/` is called from here and never touches the socket layer directly — they only call `broadcast()`.
- `game/{PlayerSim,EnemySim,DamageSim,DropSim,WaveBuilder,Shop}.ts` — the actual simulation, transport-agnostic.

### Client internals

- `net/Net.ts` — socket.io-client wrapper. Public API (`connect`, `on`/`off`, `send`, `createRoom()`, etc.) is the only thing the rest of the client touches; swap the transport again later without touching `Lobby.ts` or `main.ts`.
- `net/Lobby.ts` — pre-game state machine (menu, create/join, waiting for host to start).
- `main.ts` — game loop entry point once `game_start` arrives.
- `ui/Render*.ts` — one renderer per screen (HUD, Playing, Shop, GameOver, Lobby).

## Known issues (not yet fixed)

Client-side, pre-existing, unrelated to networking — `npx tsc --noEmit` in `packages/client` surfaces these:

- `ui/{UI,LobbyRenderer,RenderShop,RenderHUD,RenderPlaying,RenderGameOver,Renderer}.ts` — font-size args typed as numeric literals (e.g. `22`) but called with plain `number`; signature is over-narrowed.
- `ui/RenderShop.ts:79` — comparing `UpgradeId` against `'leave'`, which isn't a member of that union.
- `core/save.ts:47` — casting `SaveData` to `Record<string, unknown>` without going through `unknown` first.
- `fx/Particles.ts:142` — assigning a plain `string` where a `'#00ff41'` literal type is expected.

None of these block running the game; they surface under strict typecheck.

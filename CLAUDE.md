# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install      # install express + ws (only runtime deps)
npm start        # node server.js — serves UI + WebSocket on PORT (default 3000)
```

Open `http://localhost:3000`. There are no tests, no linter, and no build step — the browser loads `public/src/main.js` as a native ES module, so edits to anything under `public/` take effect on reload with no rebuild.

## Architecture

A small two-mode Gomoku app on a 15×15 board. The **server is authoritative only for online play**; AI mode runs entirely in the browser and never talks to the server.

### Server (`server.js`)

- Express serves `public/` statically; the same HTTP server is upgraded to WebSocket via `ws`.
- In-memory `rooms: Map<roomId, Room>` — no persistence. A room is GC'd when all players disconnect (`cleanupRoomIfEmpty`).
- Message protocol (JSON over WS):
  - Client → server: `{type:'join', roomId, token?}`, `{type:'move', x, y}`, `{type:'restart'}`
  - Server → client: `{type:'joined', roomId, side, token}`, `{type:'state', board, turn, winner, players}`, `{type:'error', message}`
- **Reconnection**: server returns a random `token` on first `join`; the client stores it in `localStorage['gomoku_token']` and re-sends it on subsequent joins to reclaim the same `side` slot. Tokens are scoped per room (the `players` map is keyed by token).
- Side assignment is fixed: first joiner gets BLACK (1), second gets WHITE (2). Only side `room.turn` may move; server silently drops invalid moves rather than erroring.

### Client (`public/src/`, native ES modules)

- `main.js` — single `state` object plus DOM event wiring; the entry point. Holds both local game state (`board`, `turn`, `winner`, `lastMove`) and `state.online` for the network mode.
- `core/board.js` + `core/constants.js` — pure board utilities (`createBoard`, `isValidMove`, `checkWin`, `isBoardFull`) and the `BLACK=1 / WHITE=2 / EMPTY=0` encoding plus `GAME_MODE` enum.
- `ai/aiPlayer.js` — heuristic AI. `candidateMoves` restricts search to empty cells within a 5×5 neighborhood of any existing piece (full center on empty board). For each candidate it scores `attack(aiSide) * 1.1 + defend(enemy)` using regex pattern matching (FIVE/OPEN_FOUR/FOUR/OPEN_THREE/THREE/TWO) over every row, column, and diagonal. No search depth — single-ply only.
- `render/boardRenderer.js` — Canvas drawing (wood gradient, grid, star points, gradient stones, last-move highlight). `toGrid(px, py)` is the inverse of `toPixel` and rejects clicks farther than ~half a cell from a grid intersection. Note `onCanvasClick` in `main.js` rescales by `canvas.width / rect.width` so the canvas stays click-accurate when CSS resizes it.
- `network/onlineClient.js` — thin WebSocket wrapper; `on(type, cb)` registers handlers that `emit` dispatches based on the incoming `data.type`. Picks `wss://` automatically when the page is HTTPS.
- `ui/dom.js` — three trivial helpers (`$`, `setText`, `toggle` via `.hidden` class).

### Mode flow

- **AI mode**: human click → `applyMove` (local) → `render` → `tryAIMove` (`setTimeout 180ms` so the UI repaints first) → `chooseMove` → `applyMove` → `render`.
- **Online mode**: human click sends `{type:'move'}`; the client never mutates `state.board` directly. It only updates from the next server `state` broadcast in `bindOnline`. Restart in online mode is also server-driven (`{type:'restart'}` resets the room board and broadcasts).

### Things to be careful about

- `BOARD_SIZE = 15` and the win-detection algorithm exist in **two places** — `server.js` and `public/src/core/`. Keep them in sync; the server's check is what decides online wins, the client's only matters for AI mode.
- UI strings are Chinese (zh-CN) — match the existing language when adding user-facing text.
- The AI is single-ply heuristic; it will miss multi-move tactical sequences. If extending, `chooseMove` is the entry point and `evaluateBoard` is the scoring function to reuse.
- Server-side move validation is permissive: out-of-turn or occupied-cell moves are silently ignored (no error sent back), so the client is responsible for hiding invalid affordances rather than relying on rejection messages.

const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;
const BOARD_SIZE = 15;

app.use(express.static(path.join(__dirname, 'public')));

const rooms = new Map();

function createEmptyBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
}

function createRoom(id) {
  return {
    id,
    board: createEmptyBoard(),
    turn: 1,
    players: new Map(),
    winner: 0,
    moveCount: 0
  };
}

function serializeRoomState(room) {
  return {
    type: 'state',
    roomId: room.id,
    board: room.board,
    turn: room.turn,
    winner: room.winner,
    players: Array.from(room.players.entries()).map(([token, entry]) => ({
      token,
      side: entry.side,
      connected: entry.connected
    }))
  };
}

function checkWin(board, x, y, side) {
  const directions = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1]
  ];

  for (const [dx, dy] of directions) {
    let count = 1;

    let cx = x + dx;
    let cy = y + dy;
    while (
      cx >= 0 &&
      cx < BOARD_SIZE &&
      cy >= 0 &&
      cy < BOARD_SIZE &&
      board[cy][cx] === side
    ) {
      count += 1;
      cx += dx;
      cy += dy;
    }

    cx = x - dx;
    cy = y - dy;
    while (
      cx >= 0 &&
      cx < BOARD_SIZE &&
      cy >= 0 &&
      cy < BOARD_SIZE &&
      board[cy][cx] === side
    ) {
      count += 1;
      cx -= dx;
      cy -= dy;
    }

    if (count >= 5) {
      return true;
    }
  }

  return false;
}

function broadcastRoomState(room) {
  const msg = JSON.stringify(serializeRoomState(room));
  for (const { ws, connected } of room.players.values()) {
    if (connected && ws.readyState === ws.OPEN) {
      ws.send(msg);
    }
  }
}

function assignSide(room) {
  const sides = new Set(Array.from(room.players.values()).map((p) => p.side));
  if (!sides.has(1)) return 1;
  if (!sides.has(2)) return 2;
  return 0;
}

function cleanupRoomIfEmpty(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  const anyConnected = Array.from(room.players.values()).some((p) => p.connected);
  if (!anyConnected) {
    rooms.delete(roomId);
  }
}

wss.on('connection', (ws) => {
  let joinedRoomId = null;
  let playerToken = null;

  ws.on('message', (raw) => {
    let data;
    try {
      data = JSON.parse(raw.toString());
    } catch {
      ws.send(JSON.stringify({ type: 'error', message: '无效消息格式' }));
      return;
    }

    if (data.type === 'join') {
      const roomId = (data.roomId || '').trim().slice(0, 32);
      if (!roomId) {
        ws.send(JSON.stringify({ type: 'error', message: '房间号不能为空' }));
        return;
      }

      let room = rooms.get(roomId);
      if (!room) {
        room = createRoom(roomId);
        rooms.set(roomId, room);
      }

      const token = (data.token || '').trim();
      if (token && room.players.has(token)) {
        const existing = room.players.get(token);
        existing.ws = ws;
        existing.connected = true;
        joinedRoomId = roomId;
        playerToken = token;
        ws.send(JSON.stringify({ type: 'joined', roomId, side: existing.side, token }));
        broadcastRoomState(room);
        return;
      }

      if (room.players.size >= 2) {
        ws.send(JSON.stringify({ type: 'error', message: '房间已满' }));
        return;
      }

      const side = assignSide(room);
      const newToken = Math.random().toString(36).slice(2, 10);
      room.players.set(newToken, { ws, side, connected: true });
      joinedRoomId = roomId;
      playerToken = newToken;

      ws.send(JSON.stringify({ type: 'joined', roomId, side, token: newToken }));
      broadcastRoomState(room);
      return;
    }

    if (data.type === 'move') {
      if (!joinedRoomId || !playerToken) {
        ws.send(JSON.stringify({ type: 'error', message: '未加入房间' }));
        return;
      }

      const room = rooms.get(joinedRoomId);
      if (!room || room.winner) return;

      const player = room.players.get(playerToken);
      if (!player) return;

      const { x, y } = data;
      if (
        typeof x !== 'number' ||
        typeof y !== 'number' ||
        x < 0 ||
        y < 0 ||
        x >= BOARD_SIZE ||
        y >= BOARD_SIZE
      ) {
        return;
      }

      if (player.side !== room.turn) return;
      if (room.board[y][x] !== 0) return;

      room.board[y][x] = player.side;
      room.moveCount += 1;

      if (checkWin(room.board, x, y, player.side)) {
        room.winner = player.side;
      } else if (room.moveCount >= BOARD_SIZE * BOARD_SIZE) {
        room.winner = 3;
      } else {
        room.turn = room.turn === 1 ? 2 : 1;
      }

      broadcastRoomState(room);
      return;
    }

    if (data.type === 'restart') {
      if (!joinedRoomId) return;
      const room = rooms.get(joinedRoomId);
      if (!room) return;

      room.board = createEmptyBoard();
      room.turn = 1;
      room.winner = 0;
      room.moveCount = 0;
      broadcastRoomState(room);
    }
  });

  ws.on('close', () => {
    if (!joinedRoomId || !playerToken) return;
    const room = rooms.get(joinedRoomId);
    if (!room) return;
    const player = room.players.get(playerToken);
    if (player) {
      player.connected = false;
      broadcastRoomState(room);
    }
    cleanupRoomIfEmpty(joinedRoomId);
  });
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Gomoku server running at http://localhost:${PORT}`);
});

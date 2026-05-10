import { BoardRenderer } from './render/boardRenderer.js';
import { chooseMove } from './ai/aiPlayer.js';
import { OnlineClient } from './network/onlineClient.js';
import { $, setText, toggle } from './ui/dom.js';
import { BLACK, BOARD_SIZE, GAME_MODE, WHITE } from './core/constants.js';
import { checkWin, createBoard, isBoardFull, isValidMove } from './core/board.js';

const boardEl = $('board');
const modeSelect = $('modeSelect');
const aiSideSelect = $('aiSideSelect');
const aiSideLabel = $('aiSideLabel');
const onlineControls = $('onlineControls');
const roomInput = $('roomInput');
const joinBtn = $('joinBtn');
const restartBtn = $('restartBtn');
const statusEl = $('status');
const onlineMeta = $('onlineMeta');
const resultModal = $('resultModal');
const resultMessage = $('resultMessage');
const resultOkBtn = $('resultOkBtn');

const renderer = new BoardRenderer(boardEl, BOARD_SIZE);

const SESSION_KEY = 'gomoku_session';

function readSavedSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object') return null;
    if (typeof obj.roomId !== 'string' || typeof obj.token !== 'string') return null;
    return obj;
  } catch {
    return null;
  }
}

function saveSession(roomId, token) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ roomId, token }));
  } catch {
    /* sessionStorage unavailable — ignore */
  }
}

function clearSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

const state = {
  mode: GAME_MODE.AI,
  board: createBoard(),
  turn: BLACK,
  winner: 0,
  lastMove: null,
  aiSide: WHITE,
  humanSide: BLACK,
  resultNotified: 0,
  online: {
    client: null,
    roomId: '',
    token: '',
    mySide: 0,
    connected: false,
    players: []
  }
};

function hideResultModal() {
  toggle(resultModal, false);
}

function showResultModal(message) {
  setText(resultMessage, message);
  toggle(resultModal, true);
}

function getResultMessage() {
  if (state.winner === 3) return '本局平局。';

  if (state.mode === GAME_MODE.AI) {
    return state.winner === state.humanSide ? '恭喜，你赢了。' : '本局失败，机器人获胜。';
  }

  return state.winner === state.online.mySide ? '恭喜，你赢了。' : '本局失败，对手获胜。';
}

function getSideName(side) {
  if (side === BLACK) return '黑棋';
  if (side === WHITE) return '白棋';
  return '无';
}

function resetLocalGame() {
  state.board = createBoard();
  state.turn = BLACK;
  state.winner = 0;
  state.lastMove = null;
  state.resultNotified = 0;
  hideResultModal();
}

function notifyResultIfNeeded() {
  if (!state.winner || state.resultNotified === state.winner) return;
  state.resultNotified = state.winner;
  showResultModal(getResultMessage());
}

function render() {
  renderer.draw(state.board, state.lastMove);

  if (state.mode === GAME_MODE.AI) {
    if (state.winner === 3) {
      setText(statusEl, '对局结束。');
    } else if (state.winner) {
      setText(statusEl, '对局结束。');
    } else {
      const myTurn = state.turn === state.humanSide;
      setText(statusEl, myTurn ? `轮到你（${getSideName(state.humanSide)}）` : '机器人思考中...');
    }
    notifyResultIfNeeded();
    return;
  }

  const online = state.online;
  const meSide = getSideName(online.mySide);
  const turnSide = getSideName(state.turn);

  if (!online.connected) {
    setText(statusEl, '在线模式：请先加入房间。');
  } else if (state.winner === 3) {
    setText(statusEl, '在线模式：对局结束。');
  } else if (state.winner) {
    setText(statusEl, '在线模式：对局结束。');
  } else if (!online.mySide) {
    setText(statusEl, '在线模式：房间状态异常。');
  } else {
    const mineTurn = state.turn === online.mySide;
    setText(statusEl, `在线模式：你是${meSide}，当前${turnSide}落子${mineTurn ? '（你的回合）' : ''}`);
  }

  const connectedCount = online.players.filter((p) => p.connected).length;
  setText(onlineMeta, `房间：${online.roomId || '-'} | 已连接玩家：${connectedCount}/2`);
  notifyResultIfNeeded();
}

function applyMove(x, y, side) {
  if (!isValidMove(state.board, x, y)) return false;
  state.board[y][x] = side;
  state.lastMove = { x, y };

  if (checkWin(state.board, x, y, side)) {
    state.winner = side;
    return true;
  }

  if (isBoardFull(state.board)) {
    state.winner = 3;
    return true;
  }

  state.turn = side === BLACK ? WHITE : BLACK;
  return true;
}

function tryAIMove() {
  if (state.mode !== GAME_MODE.AI || state.winner) return;
  if (state.turn !== state.aiSide) return;

  const move = chooseMove(state.board, state.aiSide);
  if (!move) return;

  setTimeout(() => {
    applyMove(move.x, move.y, state.aiSide);
    render();
  }, 180);
}

function onCanvasClick(ev) {
  const rect = boardEl.getBoundingClientRect();
  const scaleX = boardEl.width / rect.width;
  const scaleY = boardEl.height / rect.height;
  const px = (ev.clientX - rect.left) * scaleX;
  const py = (ev.clientY - rect.top) * scaleY;
  const grid = renderer.toGrid(px, py);
  if (!grid) return;

  if (state.mode === GAME_MODE.AI) {
    if (state.winner || state.turn !== state.humanSide) return;
    const ok = applyMove(grid.x, grid.y, state.humanSide);
    if (ok) {
      render();
      tryAIMove();
    }
    return;
  }

  const online = state.online;
  if (!online.connected || state.winner) return;
  if (state.turn !== online.mySide) return;
  if (!isValidMove(state.board, grid.x, grid.y)) return;
  online.client.sendMove(grid.x, grid.y);
}

function switchMode(mode) {
  state.mode = mode;
  toggle(onlineControls, mode === GAME_MODE.ONLINE);
  toggle(aiSideLabel, mode === GAME_MODE.AI);

  resetLocalGame();
  if (mode === GAME_MODE.AI) {
    state.humanSide = Number(aiSideSelect.value);
    state.aiSide = state.humanSide === BLACK ? WHITE : BLACK;
    render();
    tryAIMove();
  } else {
    hideResultModal();
    state.online.connected = false;
    state.online.mySide = 0;
    state.online.players = [];
    setText(onlineMeta, '');
    render();
  }
}

function bindOnline(client) {
  // 'joined' fires synchronously from the message handler BEFORE the
  // immediately-following 'state' broadcast is processed. Updating
  // state.online here ensures the next render() sees the correct mySide
  // and connected flag.
  client.on('joined', (msg) => {
    state.online.connected = true;
    state.online.mySide = msg.side;
    state.online.token = msg.token;
    state.online.roomId = msg.roomId;
    saveSession(msg.roomId, msg.token);
    setText(statusEl, `已加入房间 ${msg.roomId}，你是${getSideName(msg.side)}。`);
    render();
  });

  client.on('state', (msg) => {
    state.board = msg.board;
    state.turn = msg.turn;
    state.winner = msg.winner;
    // Server is the source of truth for lastMove in online mode — the client
    // never mutates state.board locally, so without this the highlight ring
    // would never appear after either player's move.
    state.lastMove = msg.lastMove || null;
    state.online.players = msg.players || [];
    render();
  });

  client.on('error', (msg) => {
    setText(statusEl, `在线错误：${msg.message || '未知错误'}`);
  });

  client.on('closed', () => {
    state.online.connected = false;
    render();
  });
}

async function joinRoom() {
  const roomId = roomInput.value.trim();
  if (!roomId) {
    setText(statusEl, '请输入房间号。');
    return;
  }

  if (state.online.client?.ws) {
    state.online.client.ws.close();
  }

  // Reset local view so the previous game doesn't bleed into the new one.
  resetLocalGame();
  state.online.connected = false;
  state.online.mySide = 0;
  state.online.players = [];

  const client = new OnlineClient();
  state.online.client = client;
  bindOnline(client);

  // Only re-use the saved token when rejoining the SAME room — otherwise we'd
  // hand the server a token that belongs to a different room.
  const saved = readSavedSession();
  const token = saved && saved.roomId === roomId ? saved.token : '';

  try {
    await client.connect(roomId, token);
    // 'joined' handler already populated state.online and rendered.
  } catch (err) {
    state.online.connected = false;
    // If the saved token was rejected (e.g. room full because the slot is
    // still held), drop it so the next attempt starts fresh.
    if (saved && saved.roomId === roomId) clearSession();
    setText(statusEl, `连接房间失败：${err?.message || '未知错误'}`);
    render();
  }
}

function restart() {
  if (state.mode === GAME_MODE.AI) {
    resetLocalGame();
    render();
    tryAIMove();
    return;
  }

  if (!state.online.connected) {
    resetLocalGame();
    render();
    return;
  }

  state.online.client.restart();
}

modeSelect.addEventListener('change', () => switchMode(modeSelect.value));
aiSideSelect.addEventListener('change', () => {
  state.humanSide = Number(aiSideSelect.value);
  state.aiSide = state.humanSide === BLACK ? WHITE : BLACK;
  resetLocalGame();
  render();
  tryAIMove();
});
joinBtn.addEventListener('click', joinRoom);
restartBtn.addEventListener('click', restart);
boardEl.addEventListener('click', onCanvasClick);
resultOkBtn.addEventListener('click', hideResultModal);
resultModal.addEventListener('click', (ev) => {
  if (ev.target === resultModal) hideResultModal();
});

// On page load, if this tab has a saved session (sessionStorage is per-tab,
// so a refresh keeps it but a fresh tab does not), jump straight back into
// the same room so the user reclaims their original side via the token.
function tryAutoReconnect() {
  const saved = readSavedSession();
  if (!saved || !saved.roomId) return;

  modeSelect.value = GAME_MODE.ONLINE;
  switchMode(GAME_MODE.ONLINE);
  roomInput.value = saved.roomId;
  // Fire-and-forget; joinRoom handles its own errors.
  joinRoom();
}

switchMode(state.mode);
render();
tryAutoReconnect();

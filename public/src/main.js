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
const onlineLobby = $('onlineLobby');
const onlineRoom = $('onlineRoom');
const roomInput = $('roomInput');
const joinBtn = $('joinBtn');
const createBtn = $('createBtn');
const copyCodeBtn = $('copyCodeBtn');
const copyLinkBtn = $('copyLinkBtn');
const leaveBtn = $('leaveBtn');
const roomCodeDisplay = $('roomCodeDisplay');
const roleBadge = $('roleBadge');
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
    players: [],
    moveCount: 0
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

function isHost() {
  return state.mode === GAME_MODE.ONLINE && state.online.mySide === BLACK;
}

function canRestart() {
  if (state.mode === GAME_MODE.AI) return true;
  if (!state.online.connected) return false;
  if (!isHost()) return false;
  // Allow restart only when the current game is over OR no moves yet —
  // matches the server-side check so the button can't get out of sync.
  return state.winner !== 0 || state.online.moveCount === 0;
}

function getRestartTooltip() {
  if (state.mode === GAME_MODE.AI) return '';
  if (!state.online.connected) return '请先加入房间';
  if (!isHost()) return '仅房主可重新开始';
  if (state.winner === 0 && state.online.moveCount > 0) return '对局进行中，无法重新开始';
  return '';
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
    if (state.winner) {
      setText(statusEl, '对局结束。');
    } else {
      const myTurn = state.turn === state.humanSide;
      setText(statusEl, myTurn ? `轮到你（${getSideName(state.humanSide)}）` : '机器人思考中...');
    }
    restartBtn.disabled = false;
    restartBtn.title = '';
    notifyResultIfNeeded();
    return;
  }

  const online = state.online;

  toggle(onlineLobby, !online.connected);
  toggle(onlineRoom, online.connected);

  if (online.connected) {
    roomCodeDisplay.textContent = online.roomId || '----';
    const host = isHost();
    if (online.mySide === BLACK) {
      roleBadge.textContent = '房主 · 黑棋';
    } else if (online.mySide === WHITE) {
      roleBadge.textContent = '访客 · 白棋';
    } else {
      roleBadge.textContent = '加入中…';
    }
    roleBadge.classList.toggle('host', host);

    const connectedCount = online.players.filter((p) => p.connected).length;
    setText(onlineMeta, `· 在线 ${connectedCount}/2`);
  }

  const meSide = getSideName(online.mySide);
  const turnSide = getSideName(state.turn);
  const connectedCount = online.players.filter((p) => p.connected).length;

  if (!online.connected) {
    setText(statusEl, '在线模式：创建房间或输入 4 位房间号加入。');
  } else if (state.winner === 3) {
    setText(statusEl, '在线模式：本局平局。');
  } else if (state.winner) {
    const won = state.winner === online.mySide;
    setText(statusEl, won ? '在线模式：恭喜，你赢了！' : '在线模式：本局失败，对手获胜。');
  } else if (connectedCount < 2) {
    setText(statusEl, `在线模式：你是${meSide}，等待对手加入…`);
  } else if (!online.mySide) {
    setText(statusEl, '在线模式：房间状态异常。');
  } else {
    const mineTurn = state.turn === online.mySide;
    setText(
      statusEl,
      mineTurn ? `在线模式：你的回合（${meSide}）` : `在线模式：等待对手落子（${turnSide}）`
    );
  }

  restartBtn.disabled = !canRestart();
  restartBtn.title = getRestartTooltip();

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
    state.online.moveCount = 0;
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
    state.online.moveCount = msg.moveCount || 0;
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
  state.online.moveCount = 0;

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

async function createRoom() {
  createBtn.disabled = true;
  try {
    const resp = await fetch('/api/room/new');
    if (!resp.ok) throw new Error('服务器无响应');
    const data = await resp.json();
    if (!data || !data.roomId) throw new Error('无效响应');
    // Drop any saved session for a different room so joinRoom starts fresh
    // and we become the host (BLACK) of the new room.
    clearSession();
    roomInput.value = data.roomId;
    await joinRoom();
  } catch (err) {
    setText(statusEl, `创建房间失败：${err?.message || '未知错误'}`);
  } finally {
    createBtn.disabled = false;
  }
}

function buildInviteLink(roomId) {
  return `${location.origin}${location.pathname}?room=${encodeURIComponent(roomId)}`;
}

function flashButton(btn, text) {
  if (!btn) return;
  if (!btn.dataset.label) btn.dataset.label = btn.textContent;
  btn.textContent = text;
  setTimeout(() => {
    btn.textContent = btn.dataset.label;
  }, 1500);
}

async function copyText(text, btn) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      // execCommand fallback for http (non-secure context) and older browsers.
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    flashButton(btn, '已复制');
  } catch {
    flashButton(btn, '复制失败');
  }
}

function leaveRoom() {
  const client = state.online.client;
  if (client?.ws) {
    try { client.ws.close(); } catch { /* ignore */ }
  }
  state.online.client = null;
  state.online.connected = false;
  state.online.mySide = 0;
  state.online.players = [];
  state.online.token = '';
  state.online.roomId = '';
  state.online.moveCount = 0;
  clearSession();
  // Strip ?room=… so a refresh from this state doesn't re-enter the room.
  if (location.search) {
    history.replaceState(null, '', location.pathname);
  }
  resetLocalGame();
  setText(statusEl, '已离开房间。');
  render();
}

function getRoomFromUrl() {
  try {
    const params = new URLSearchParams(location.search);
    return (params.get('room') || '').trim();
  } catch {
    return '';
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
createBtn.addEventListener('click', createRoom);
copyCodeBtn.addEventListener('click', () => {
  if (state.online.roomId) copyText(state.online.roomId, copyCodeBtn);
});
copyLinkBtn.addEventListener('click', () => {
  if (state.online.roomId) copyText(buildInviteLink(state.online.roomId), copyLinkBtn);
});
leaveBtn.addEventListener('click', leaveRoom);
roomInput.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter') joinRoom();
});
restartBtn.addEventListener('click', restart);
boardEl.addEventListener('click', onCanvasClick);
resultOkBtn.addEventListener('click', hideResultModal);
resultModal.addEventListener('click', (ev) => {
  if (ev.target === resultModal) hideResultModal();
});

// On page load: if a ?room= invite link was used, jump straight into that
// room. Otherwise, if this tab has a saved session (sessionStorage is per-tab,
// so a refresh keeps it but a fresh tab does not), reclaim the original
// side via the saved token.
function tryAutoEnterOnline() {
  const urlRoom = getRoomFromUrl();
  const saved = readSavedSession();
  const target = urlRoom || (saved && saved.roomId) || '';
  if (!target) return;

  modeSelect.value = GAME_MODE.ONLINE;
  switchMode(GAME_MODE.ONLINE);
  roomInput.value = target;
  joinRoom();
}

switchMode(state.mode);
render();
tryAutoEnterOnline();

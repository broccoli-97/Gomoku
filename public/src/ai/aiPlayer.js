import { BLACK, EMPTY, WHITE } from '../core/constants.js';
import { isValidMove } from '../core/board.js';

const SCORE = {
  FIVE: 100000,
  OPEN_FOUR: 10000,
  FOUR: 1200,
  OPEN_THREE: 900,
  THREE: 150,
  TWO: 20
};

function evaluateLine(line, side) {
  const enemy = side === BLACK ? WHITE : BLACK;
  let s = 0;

  const joined = line.join('');
  const me = String(side);
  const opp = String(enemy);

  const patterns = [
    [new RegExp(`${me}{5}`, 'g'), SCORE.FIVE],
    [new RegExp(`0${me}{4}0`, 'g'), SCORE.OPEN_FOUR],
    [new RegExp(`${me}{4}`, 'g'), SCORE.FOUR],
    [new RegExp(`0${me}{3}0`, 'g'), SCORE.OPEN_THREE],
    [new RegExp(`${me}{3}`, 'g'), SCORE.THREE],
    [new RegExp(`${me}{2}`, 'g'), SCORE.TWO]
  ];

  for (const [reg, value] of patterns) {
    const count = (joined.match(reg) || []).length;
    s += count * value;
  }

  const blockPatterns = [
    [new RegExp(`0${opp}{4}0`, 'g'), SCORE.OPEN_FOUR * 0.95],
    [new RegExp(`${opp}{4}`, 'g'), SCORE.FOUR * 0.9],
    [new RegExp(`0${opp}{3}0`, 'g'), SCORE.OPEN_THREE * 0.85]
  ];

  for (const [reg, value] of blockPatterns) {
    const count = (joined.match(reg) || []).length;
    s += count * value;
  }

  return s;
}

function collectLines(board) {
  const size = board.length;
  const lines = [];

  for (let y = 0; y < size; y += 1) lines.push(board[y]);
  for (let x = 0; x < size; x += 1) lines.push(board.map((row) => row[x]));

  for (let k = 0; k < size * 2; k += 1) {
    const diag1 = [];
    const diag2 = [];
    for (let y = 0; y < size; y += 1) {
      const x1 = k - y;
      const x2 = size - 1 - k + y;
      if (x1 >= 0 && x1 < size) diag1.push(board[y][x1]);
      if (x2 >= 0 && x2 < size) diag2.push(board[y][x2]);
    }
    if (diag1.length >= 5) lines.push(diag1);
    if (diag2.length >= 5) lines.push(diag2);
  }

  return lines;
}

function evaluateBoard(board, side) {
  const lines = collectLines(board);
  return lines.reduce((sum, line) => sum + evaluateLine(line, side), 0);
}

function candidateMoves(board) {
  const size = board.length;
  const moves = [];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (!isValidMove(board, x, y)) continue;
      let near = false;
      for (let dy = -2; dy <= 2 && !near; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          if (board[y + dy]?.[x + dx] && board[y + dy][x + dx] !== EMPTY) {
            near = true;
            break;
          }
        }
      }
      if (near) moves.push({ x, y });
    }
  }

  if (!moves.length) {
    const mid = Math.floor(size / 2);
    return [{ x: mid, y: mid }];
  }

  return moves;
}

export function chooseMove(board, aiSide) {
  const enemy = aiSide === BLACK ? WHITE : BLACK;
  let bestMove = null;
  let bestScore = -Infinity;

  const moves = candidateMoves(board);

  for (const move of moves) {
    board[move.y][move.x] = aiSide;
    const attack = evaluateBoard(board, aiSide);
    board[move.y][move.x] = enemy;
    const defend = evaluateBoard(board, enemy);
    board[move.y][move.x] = EMPTY;

    const score = attack * 1.1 + defend;
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove || moves[0];
}

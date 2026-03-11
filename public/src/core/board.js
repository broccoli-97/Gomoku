import { BOARD_SIZE, EMPTY } from './constants.js';

export function createBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(EMPTY));
}

export function cloneBoard(board) {
  return board.map((row) => [...row]);
}

export function isValidMove(board, x, y) {
  return x >= 0 && y >= 0 && y < board.length && x < board[y].length && board[y][x] === EMPTY;
}

export function checkWin(board, x, y, side) {
  const dirs = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1]
  ];

  for (const [dx, dy] of dirs) {
    let count = 1;
    let cx = x + dx;
    let cy = y + dy;
    while (board[cy]?.[cx] === side) {
      count += 1;
      cx += dx;
      cy += dy;
    }

    cx = x - dx;
    cy = y - dy;
    while (board[cy]?.[cx] === side) {
      count += 1;
      cx -= dx;
      cy -= dy;
    }

    if (count >= 5) return true;
  }

  return false;
}

export function isBoardFull(board) {
  return board.every((row) => row.every((cell) => cell !== EMPTY));
}

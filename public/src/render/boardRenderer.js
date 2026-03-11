import { BLACK, WHITE } from '../core/constants.js';

export class BoardRenderer {
  constructor(canvas, boardSize) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.boardSize = boardSize;
    this.padding = 36;
    this.cell = (canvas.width - this.padding * 2) / (boardSize - 1);
  }

  draw(board, highlight = null) {
    this.drawBoardBackground();
    this.drawGrid();
    this.drawStarPoints();
    this.drawPieces(board);
    if (highlight) this.drawHighlight(highlight.x, highlight.y);
  }

  drawBoardBackground() {
    const { ctx, canvas } = this;
    const wood = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    wood.addColorStop(0, '#e6c793');
    wood.addColorStop(0.5, '#d4ab72');
    wood.addColorStop(1, '#bc8a4f');
    ctx.fillStyle = wood;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.globalAlpha = 0.12;
    for (let i = 0; i < 26; i += 1) {
      const y = i * 28 + (i % 2 ? 4 : -4);
      ctx.strokeStyle = i % 2 ? '#8d5f2f' : '#fff0cb';
      ctx.lineWidth = i % 2 ? 1.3 : 0.9;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(160, y + 8, 520, y - 6, this.canvas.width, y + 3);
      ctx.stroke();
    }
    ctx.restore();

    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.fillRect(0, 0, canvas.width, 10);
    ctx.fillRect(0, canvas.height - 10, canvas.width, 10);
  }

  drawGrid() {
    const { ctx, boardSize, padding, cell } = this;
    ctx.strokeStyle = '#4b2f16';
    ctx.lineWidth = 1.1;
    for (let i = 0; i < boardSize; i += 1) {
      const pos = padding + i * cell;
      ctx.beginPath();
      ctx.moveTo(padding, pos);
      ctx.lineTo(padding + cell * (boardSize - 1), pos);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pos, padding);
      ctx.lineTo(pos, padding + cell * (boardSize - 1));
      ctx.stroke();
    }
  }

  drawStarPoints() {
    const stars = [3, 7, 11];
    const { ctx } = this;
    ctx.fillStyle = '#41240f';
    for (const x of stars) {
      for (const y of stars) {
        this.drawCircle(this.toPixel(x), this.toPixel(y), 4.3);
      }
    }
  }

  drawPieces(board) {
    for (let y = 0; y < board.length; y += 1) {
      for (let x = 0; x < board[y].length; x += 1) {
        const side = board[y][x];
        if (!side) continue;
        this.drawPiece(x, y, side);
      }
    }
  }

  drawPiece(x, y, side) {
    const cx = this.toPixel(x);
    const cy = this.toPixel(y);
    const r = this.cell * 0.43;
    const { ctx } = this;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;

    const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.45, r * 0.1, cx, cy, r);
    if (side === BLACK) {
      g.addColorStop(0, '#7f7f85');
      g.addColorStop(0.25, '#35373d');
      g.addColorStop(1, '#0f1014');
    } else if (side === WHITE) {
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.5, '#f4f4f6');
      g.addColorStop(1, '#cfd1d7');
    }

    ctx.fillStyle = g;
    this.drawCircle(cx, cy, r);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = side === BLACK ? 0.22 : 0.34;
    ctx.fillStyle = '#ffffff';
    this.drawCircle(cx - r * 0.24, cy - r * 0.36, r * 0.23);
    ctx.restore();
  }

  drawHighlight(x, y) {
    const { ctx } = this;
    const cx = this.toPixel(x);
    const cy = this.toPixel(y);
    const r = this.cell * 0.48;
    ctx.strokeStyle = 'rgba(220, 50, 50, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  drawCircle(x, y, r) {
    const { ctx } = this;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  toPixel(index) {
    return this.padding + index * this.cell;
  }

  toGrid(px, py) {
    const x = Math.round((px - this.padding) / this.cell);
    const y = Math.round((py - this.padding) / this.cell);
    if (x < 0 || y < 0 || x >= this.boardSize || y >= this.boardSize) return null;

    const distX = Math.abs(this.toPixel(x) - px);
    const distY = Math.abs(this.toPixel(y) - py);
    if (distX > this.cell * 0.48 || distY > this.cell * 0.48) return null;

    return { x, y };
  }
}

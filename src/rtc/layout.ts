import type { RoomLayout } from '../types';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const GAP = 6;

function grid(count: number, cols: number, x: number, y: number, w: number, h: number): Rect[] {
  const rows = Math.ceil(count / cols);
  const cellW = (w - GAP * (cols - 1)) / cols;
  const cellH = (h - GAP * (rows - 1)) / rows;
  return Array.from({ length: count }, (_, i) => ({
    x: x + (i % cols) * (cellW + GAP),
    y: y + Math.floor(i / cols) * (cellH + GAP),
    w: cellW,
    h: cellH,
  }));
}

const gridColumns = (seats: number) => (seats <= 4 ? 2 : 3);

/**
 * Places the video cards: index 0 is the host, the rest are seats in order.
 * `grid` gives everyone the same card. `stage` gives the host the top and the seats a strip below.
 */
export function videoLayout(seats: number, layout: RoomLayout, width: number, height: number): Rect[] {
  if (layout === 'grid') return grid(seats, gridColumns(seats), 0, 0, width, height);

  const others = seats - 1;
  const cols = others <= 3 ? others : others === 5 ? 3 : 4;
  const rows = Math.ceil(others / cols);
  const stripH = Math.min(height * 0.42, rows * Math.min((width / cols) * 1.05, 150));
  const hostH = height - stripH - GAP;
  // A row that is not full is stretched, so nothing is left hanging.
  const strip: Rect[] = [];
  const rowH = (stripH - GAP * (rows - 1)) / rows;
  for (let r = 0, placed = 0; r < rows; r++) {
    const inRow = Math.min(others - placed, r === rows - 1 ? others - placed : cols);
    const cellW = (width - GAP * (inRow - 1)) / inRow;
    for (let c = 0; c < inRow; c++, placed++) {
      strip.push({ x: c * (cellW + GAP), y: hostH + GAP + r * (rowH + GAP), w: cellW, h: rowH });
    }
  }
  return [{ x: 0, y: 0, w: width, h: hostH }, ...strip];
}

export const audioColumns = (seats: number) => (seats === 8 ? 4 : 5);

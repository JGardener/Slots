/**
 * Fixed paylines for the 5×3 game.
 * Each payline is a path through the grid, one row per reel (left to right).
 * Row indices: 0 (top), 1 (middle), 2 (bottom).
 */

import type { Payline } from './types';

export const PAYLINES: readonly Payline[] = [
  // Horizontal lines
  [1, 1, 1, 1, 1], // Middle
  [0, 0, 0, 0, 0], // Top
  [2, 2, 2, 2, 2], // Bottom

  // Diagonal lines (down-left to up-right)
  [1, 0, 0, 0, 1],
  [1, 2, 2, 2, 1],
  [0, 1, 0, 1, 0],
  [2, 1, 2, 1, 2],

  // Diagonal lines (up-left to down-right)
  [1, 0, 1, 0, 1],
  [1, 2, 1, 2, 1],
  [0, 0, 1, 2, 2],
  [2, 2, 1, 0, 0],

  // V-shaped lines
  [0, 1, 2, 1, 0],
  [2, 1, 0, 1, 2],
  [0, 0, 1, 0, 0],
  [2, 2, 1, 2, 2],

  // W-shaped / zigzag
  [0, 1, 0, 2, 1],
  [2, 1, 2, 0, 1],
  [1, 0, 2, 0, 1],
  [1, 2, 0, 2, 1],
  [0, 2, 1, 2, 0],
];

export const NUM_PAYLINES = PAYLINES.length;

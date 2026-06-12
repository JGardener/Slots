import { GRID_COLS, GRID_ROWS, Symbol, LOW_PAYS, HIGH_PAYS } from '@slots/engine';
import { Container, Graphics } from 'pixi.js';
import { PixiRenderer } from './renderer';
import { SymbolPool, SYMBOL_BASE_SIZE } from './symbols';

/** Symbols cycled through while a reel is in motion (the "blur" strip). */
const FILLER: readonly Symbol[] = [...LOW_PAYS, ...HIGH_PAYS, Symbol.Wild];

/**
 * Main Pixi scene: a 5×3 grid of scrolling reels behind one rect mask.
 * Motion is owned by GSAP (motion/spin.ts); the scene only exposes a
 * scroll position per reel and recycles pooled symbols as cells wrap.
 */
export class SlotScene {
  public reels: ReelView[] = [];
  public renderer: PixiRenderer;
  private pool = new SymbolPool();
  private grid = new Container();
  private maskShape = new Graphics();
  private cellSize = SYMBOL_BASE_SIZE;

  constructor(host: HTMLElement) {
    this.renderer = new PixiRenderer(host);
  }

  async init(): Promise<void> {
    await this.renderer.init({ onResize: () => this.layout() });

    for (let r = 0; r < GRID_COLS; r++) {
      const reel = new ReelView(this.pool, initialColumn(r));
      this.reels.push(reel);
      this.grid.addChild(reel.container);
    }

    this.grid.addChild(this.maskShape);
    this.grid.mask = this.maskShape;
    this.renderer.stage.addChild(this.grid);
    this.layout();
  }

  private layout(): void {
    const { width, height } = this.renderer.getSize();
    this.cellSize = Math.min((width * 0.94) / GRID_COLS, (height * 0.94) / GRID_ROWS);
    const gridW = this.cellSize * GRID_COLS;
    const gridH = this.cellSize * GRID_ROWS;

    this.grid.position.set((width - gridW) / 2, (height - gridH) / 2);
    this.maskShape.clear().rect(0, 0, gridW, gridH).fill(0xffffff);

    for (let r = 0; r < this.reels.length; r++) {
      this.reels[r]!.layout(r * this.cellSize, this.cellSize);
    }
  }

  /** Instantly show a grid (initial fill, recovery after remount mid-spin). */
  setGrid(symbols: readonly (readonly Symbol[])[]): void {
    for (let r = 0; r < this.reels.length; r++) {
      this.reels[r]!.setSymbols(symbols[r]!);
    }
  }

  dispose(): void {
    this.renderer.dispose(); // destroys the stage tree, including all reels
    this.pool.dispose();
  }
}

interface Cell {
  holder: Container;
  symbol: Symbol;
}

/**
 * One reel column: GRID_ROWS visible cells plus one buffer cell above the
 * mask. Scrolling is expressed in cell units; each whole cell scrolled
 * recycles the off-screen bottom cell to the top with the next symbol from
 * the feeder (filler while spinning, the engine's final symbols at the end).
 */
export class ReelView {
  public container = new Container();
  /** Inner wrapper so the post-stop settle bounce composes with scrolling. */
  public inner = new Container();
  public cellSize = SYMBOL_BASE_SIZE;

  private cells: Cell[] = [];
  private pool: SymbolPool;
  private fraction = 0;

  // Spin bookkeeping (set by beginSpin, consumed by setScroll)
  private totalCells = 0;
  private advanced = 0;
  private finals: readonly Symbol[] = [];
  private fillerIdx: number;

  constructor(pool: SymbolPool, initialSymbols: readonly Symbol[]) {
    this.pool = pool;
    this.fillerIdx = Math.floor(Math.random() * FILLER.length);
    this.container.addChild(this.inner);

    for (let i = 0; i < GRID_ROWS + 1; i++) {
      const holder = new Container();
      this.inner.addChild(holder);
      this.cells.push({ holder, symbol: Symbol.Cherry });
    }
    this.setSymbols(initialSymbols);
  }

  layout(x: number, cellSize: number): void {
    this.cellSize = cellSize;
    this.container.position.x = x;
    const scale = (cellSize * 0.88) / SYMBOL_BASE_SIZE;
    for (const cell of this.cells) cell.holder.scale.set(scale);
    this.applyPositions();
  }

  /** Instantly display the given visible symbols (no animation). */
  setSymbols(visible: readonly Symbol[]): void {
    this.setCellSymbol(this.cells[0]!, this.nextFiller());
    for (let row = 0; row < GRID_ROWS; row++) {
      this.setCellSymbol(this.cells[row + 1]!, visible[row]!);
    }
    this.fraction = 0;
    this.applyPositions();
  }

  /**
   * Arm a spin: scrolling `totalCells` cells lands with `finals` (top to
   * bottom) in the visible window and the scroll fraction back at zero.
   */
  beginSpin(finals: readonly Symbol[], totalCells: number): void {
    this.totalCells = totalCells;
    this.advanced = 0;
    this.finals = finals;
    this.inner.position.y = 0;
  }

  /** Set the absolute scroll position in cells (0..totalCells). GSAP-driven. */
  setScroll(cells: number): void {
    const clamped = Math.min(Math.max(cells, 0), this.totalCells);
    const whole = Math.floor(clamped);
    while (this.advanced < whole) {
      this.advanced++;
      this.advance(this.feed(this.advanced));
    }
    this.fraction = clamped - whole;
    this.applyPositions();
  }

  /** Guarantee the reel is in its final state (quick-stop safety net). */
  finishSpin(): void {
    this.setScroll(this.totalCells);
    this.inner.position.y = 0;
  }

  /** Symbol entering at the top on the n-th advance (1-based). */
  private feed(n: number): Symbol {
    const fromEnd = this.totalCells - n;
    // The symbol fed on advance n ends `fromEnd` rows below the buffer cell,
    // so the last GRID_ROWS feeds before the final one are the result rows.
    if (fromEnd >= 1 && fromEnd <= GRID_ROWS) {
      return this.finals[fromEnd - 1]!;
    }
    return this.nextFiller();
  }

  private advance(symbol: Symbol): void {
    const cell = this.cells.pop()!; // bottom cell has scrolled out of view
    this.cells.unshift(cell);
    this.setCellSymbol(cell, symbol);
  }

  private applyPositions(): void {
    for (let i = 0; i < this.cells.length; i++) {
      const holder = this.cells[i]!.holder;
      // i=0 is the buffer cell above the mask; centers offset by fraction.
      holder.position.set(this.cellSize / 2, (i - 1 + this.fraction) * this.cellSize + this.cellSize / 2);
    }
  }

  private setCellSymbol(cell: Cell, symbol: Symbol): void {
    if (cell.symbol === symbol && cell.holder.children.length > 0) return;
    const old = cell.holder.children[0];
    if (old) {
      cell.holder.removeChild(old);
      this.pool.release(cell.symbol, old as Container);
    }
    cell.holder.addChild(this.pool.acquire(symbol));
    cell.symbol = symbol;
  }

  private nextFiller(): Symbol {
    this.fillerIdx = (this.fillerIdx + 1) % FILLER.length;
    return FILLER[this.fillerIdx]!;
  }
}

/** Deterministic, varied starting arrangement for reel `r` before any spin. */
function initialColumn(r: number): readonly Symbol[] {
  const all = [...LOW_PAYS, ...HIGH_PAYS];
  return [all[(r * 3) % all.length]!, all[(r * 3 + 1) % all.length]!, all[(r * 3 + 2) % all.length]!];
}

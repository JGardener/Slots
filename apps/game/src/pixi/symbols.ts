import { Symbol } from '@slots/engine';
import { Container, Graphics, Text, TextStyle } from 'pixi.js';

/**
 * Placeholder symbol rendering for Phase 2: colored tiles with labels,
 * built at a fixed base size and scaled to the cell by the scene.
 * Phase 4 swaps these for spritesheet textures behind the same interface.
 */

export const SYMBOL_BASE_SIZE = 100;

const SYMBOL_COLORS: Record<Symbol, number> = {
  [Symbol.Scatter]: 0xff6b9d, // strawberry
  [Symbol.Wild]: 0xffd700, // bell
  [Symbol.BAR]: 0xc0392b,
  [Symbol.Seven]: 0x2c3e50,
  [Symbol.Orange]: 0xf39c12,
  [Symbol.Lemon]: 0xf1c40f,
  [Symbol.Plum]: 0x9b59b6,
  [Symbol.Banana]: 0xf4d03f,
  [Symbol.Cherry]: 0xe74c3c,
  [Symbol.Grapes]: 0x8e44ad,
  [Symbol.Watermelon]: 0x27ae60,
};

const SYMBOL_NAMES: Record<Symbol, string> = {
  [Symbol.Scatter]: 'SC',
  [Symbol.Wild]: 'WILD',
  [Symbol.BAR]: 'BAR',
  [Symbol.Seven]: '7',
  [Symbol.Orange]: 'OR',
  [Symbol.Lemon]: 'LE',
  [Symbol.Plum]: 'PL',
  [Symbol.Banana]: 'BA',
  [Symbol.Cherry]: 'CH',
  [Symbol.Grapes]: 'GR',
  [Symbol.Watermelon]: 'WM',
};

function createSymbolDisplay(symbol: Symbol): Container {
  const container = new Container();
  const half = SYMBOL_BASE_SIZE / 2;

  const bg = new Graphics()
    .roundRect(-half, -half, SYMBOL_BASE_SIZE, SYMBOL_BASE_SIZE, 12)
    .fill(SYMBOL_COLORS[symbol])
    .stroke({ color: 0x2a2a35, width: 3 });

  const text = new Text({
    text: SYMBOL_NAMES[symbol],
    style: new TextStyle({
      fontFamily: 'Arial',
      fontSize: symbol === Symbol.Wild ? 26 : 32,
      fontWeight: 'bold',
      fill: 0xffffff,
      stroke: { color: 0x000000, width: 3 },
    }),
    anchor: 0.5,
  });

  container.addChild(bg, text);
  return container;
}

/**
 * Lazy pool of symbol displays keyed by symbol. Reels acquire/release on
 * every recycle during a spin, so no Text/Graphics churn at 60fps.
 */
export class SymbolPool {
  private free = new Map<Symbol, Container[]>();
  private readonly maxPerSymbol: number;

  constructor(maxPerSymbol = 12) {
    this.maxPerSymbol = maxPerSymbol;
  }

  acquire(symbol: Symbol): Container {
    return this.free.get(symbol)?.pop() ?? createSymbolDisplay(symbol);
  }

  release(symbol: Symbol, display: Container): void {
    const list = this.free.get(symbol) ?? [];
    if (list.length < this.maxPerSymbol) {
      list.push(display);
      this.free.set(symbol, list);
    } else {
      display.destroy({ children: true });
    }
  }

  dispose(): void {
    for (const list of this.free.values()) {
      for (const display of list) display.destroy({ children: true });
    }
    this.free.clear();
  }
}

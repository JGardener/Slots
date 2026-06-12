import { PAYLINES } from '@slots/engine';
import type { Win } from '@slots/engine';
import { Container, Graphics, Text, TextStyle } from 'pixi.js';

/** Distinct stroke colors per payline index (hue-spread, stable). */
const LINE_COLORS: readonly number[] = [
  0xff5252, 0xffb142, 0xfff200, 0x7bed9f, 0x2ed573,
  0x17c0eb, 0x18dcff, 0x7d5fff, 0xcd84f1, 0xff9ff3,
  0xffaf40, 0x32ff7e, 0x7efff5, 0x67e6dc, 0xff6b81,
  0xc56cf0, 0xffdd59, 0x3ae374, 0x67d5b5, 0xee5a24,
];

export function paylineColor(paylineIndex: number): number {
  return LINE_COLORS[paylineIndex % LINE_COLORS.length]!;
}

/**
 * Payline strokes drawn over the reel grid (grid-local coordinates).
 * The motion layer calls draw() at choreography beats; this class only
 * renders — visibility/alpha are tweened on `graphics` by GSAP.
 */
export class WinLinesView {
  public graphics = new Graphics();

  /**
   * Render every winning line. With `highlight` set, that win is shown at
   * full strength and the rest recede; `null` shows all equally.
   * The paying segment (first `count` reels) is thick; the rest of the
   * path is a thin trace so the line shape stays readable.
   */
  draw(wins: readonly Win[], cellSize: number, highlight: number | null): void {
    const g = this.graphics;
    g.clear();

    wins.forEach((win, i) => {
      const focused = highlight === null || highlight === i;
      const color = paylineColor(win.paylineIndex);
      const alpha = focused ? 1 : 0.15;
      this.strokePath(win.paylineIndex, PAYLINES[win.paylineIndex]!.length, cellSize, {
        width: 3,
        color,
        alpha: alpha * 0.45,
      });
      this.strokePath(win.paylineIndex, win.count, cellSize, { width: 7, color, alpha });
    });
  }

  clear(): void {
    this.graphics.clear();
  }

  private strokePath(
    paylineIndex: number,
    count: number,
    cellSize: number,
    style: { width: number; color: number; alpha: number }
  ): void {
    const line = PAYLINES[paylineIndex]!;
    const g = this.graphics;
    for (let reel = 0; reel < count; reel++) {
      const x = (reel + 0.5) * cellSize;
      const y = (line[reel]! + 0.5) * cellSize;
      if (reel === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke({ ...style, cap: 'round', join: 'round' });
  }
}

/**
 * Full-screen celebration layer: a dimmer plus three text slots
 * (title / amount / sub) used by win tiers, rollups, and the free-spins
 * intro/outro. The motion layer sets text content and tweens alphas and
 * scales; this class owns construction and responsive layout only.
 */
export class CelebrationOverlay {
  public container = new Container();
  public dim = new Graphics();
  public title: Text;
  public amount: Text;
  public sub: Text;

  constructor() {
    this.container.eventMode = 'none';

    this.title = makeText(0xffd700, 72);
    this.amount = makeText(0xffffff, 56);
    this.sub = makeText(0xff9ff3, 28);

    this.dim.alpha = 0;
    this.container.addChild(this.dim, this.title, this.amount, this.sub);
  }

  layout(width: number, height: number): void {
    this.dim.clear().rect(0, 0, width, height).fill(0x000000);

    const base = Math.min(width, height);
    this.title.style.fontSize = Math.round(base * 0.11);
    this.amount.style.fontSize = Math.round(base * 0.085);
    this.sub.style.fontSize = Math.round(base * 0.042);

    this.title.position.set(width / 2, height * 0.38);
    this.amount.position.set(width / 2, height * 0.54);
    this.sub.position.set(width / 2, height * 0.66);
  }

  /** Return to the hidden resting state (called between presentations). */
  reset(): void {
    for (const text of [this.title, this.amount, this.sub]) {
      text.alpha = 0;
      text.scale.set(1);
      text.text = '';
    }
    this.dim.alpha = 0;
  }
}

function makeText(fill: number, fontSize: number): Text {
  return new Text({
    text: '',
    style: new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize,
      fontWeight: '900',
      fill,
      stroke: { color: 0x000000, width: 6 },
      align: 'center',
    }),
    anchor: 0.5,
    alpha: 0,
  });
}

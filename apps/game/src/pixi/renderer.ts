import { Application, Container } from 'pixi.js';

/**
 * Pixi Application wrapper.
 * Manages initialization, resizing, and cleanup.
 */
export class PixiRenderer {
  public app: Application;
  public stage: Container;
  private host: HTMLElement;
  private onResize: (() => void) | null = null;

  constructor(host: HTMLElement) {
    this.host = host;
    this.app = new Application();
    this.stage = this.app.stage as Container;
  }

  /**
   * Initialize the Pixi application asynchronously.
   * Must be called before rendering.
   */
  async init(options?: { onResize?: () => void }): Promise<void> {
    if (options?.onResize) {
      this.onResize = options.onResize;
    }

    await this.app.init({
      background: '#0d0d14',
      resizeTo: this.host,
      antialias: true,
    });

    this.host.appendChild(this.app.canvas);

    // Set up resize listener
    this.app.renderer.on('resize', () => {
      this.onResize?.();
    });
  }

  /**
   * Get the current canvas size.
   */
  getSize(): { width: number; height: number } {
    return {
      width: this.app.screen.width,
      height: this.app.screen.height,
    };
  }

  /**
   * Clean up and destroy the Pixi application.
   */
  dispose(): void {
    this.app.destroy(true, { children: true });
  }
}

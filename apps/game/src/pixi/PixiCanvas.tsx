import { createRng } from '@slots/engine';
import gsap from 'gsap';
import { Application, Container, Graphics } from 'pixi.js';
import { useEffect, useRef } from 'react';

/**
 * Phase 0 smoke scene: React owns the host element, Pixi renders imperatively
 * inside it, GSAP drives all motion, and the symbol tints come from the
 * engine's seeded RNG — one spinning "reel" of diamonds proving every layer
 * of the stack end-to-end.
 */
export function PixiCanvas() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const app = new Application();
    let status: 'booting' | 'ready' | 'disposed' = 'booting';
    const timeline = gsap.timeline();

    const boot = async () => {
      await app.init({ background: '#0d0d14', resizeTo: host, antialias: true });
      // React StrictMode mounts effects twice; if cleanup ran mid-init, bail out.
      if (status === 'disposed') {
        app.destroy(true);
        return;
      }
      status = 'ready';
      host.appendChild(app.canvas);

      const rng = createRng(2026);
      const wheel = new Container();
      app.stage.addChild(wheel);

      const SYMBOLS = 8;
      const RADIUS = 160;
      for (let i = 0; i < SYMBOLS; i++) {
        const angle = (i / SYMBOLS) * Math.PI * 2;
        const tint = 0x806030 + rng.nextInt(0x7fa0c0);
        const diamond = new Graphics().rect(-24, -24, 48, 48).fill(tint);
        diamond.rotation = Math.PI / 4;
        diamond.position.set(Math.cos(angle) * RADIUS, Math.sin(angle) * RADIUS);
        wheel.addChild(diamond);
      }

      const layout = () => {
        wheel.position.set(app.screen.width / 2, app.screen.height / 2);
      };
      layout();
      app.renderer.on('resize', layout);

      timeline
        .from(wheel, { alpha: 0, duration: 0.8, ease: 'power2.out' })
        .from(wheel.scale, { x: 0.6, y: 0.6, duration: 0.8, ease: 'back.out(1.7)' }, 0)
        .to(wheel, { rotation: Math.PI * 2, duration: 12, repeat: -1, ease: 'none' }, 0);
    };

    void boot();

    return () => {
      const wasReady = status === 'ready';
      status = 'disposed';
      timeline.kill();
      if (wasReady) {
        app.destroy(true, { children: true });
      }
    };
  }, []);

  return <div ref={hostRef} style={{ position: 'absolute', inset: 0 }} />;
}

'use client';

// Confetti burst (loaded on demand). Respects "reduce motion".
export async function celebrate(kind = 'default') {
  if (typeof window === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const { default: confetti } = await import('canvas-confetti');
  const colors = ['#d63031', '#fdcb6e', '#00b894', '#6c5ce7', '#74b9ff'];
  if (kind === 'kudos') {
    confetti({ particleCount: 80, spread: 100, startVelocity: 35, origin: { y: 0.7 }, colors, scalar: 1.1 });
    return;
  }
  confetti({ particleCount: 60, angle: 60, spread: 70, origin: { x: 0, y: 0.8 }, colors });
  confetti({ particleCount: 60, angle: 120, spread: 70, origin: { x: 1, y: 0.8 }, colors });
}

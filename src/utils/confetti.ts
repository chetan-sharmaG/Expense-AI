/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import confetti from 'canvas-confetti';

export function fireSettlementConfetti() {
  // Fire primary side bursts
  confetti({
    particleCount: 80,
    spread: 70,
    origin: { y: 0.6 }
  });

  // Delayed secondary gold/emerald celebratory burst
  setTimeout(() => {
    confetti({
      particleCount: 50,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: ['#10b981', '#34d399', '#f59e0b', '#fbbf24']
    });
    confetti({
      particleCount: 50,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors: ['#10b981', '#34d399', '#f59e0b', '#fbbf24']
    });
  }, 200);
}

import { spin } from './spin';

/**
 * Simulation results for a series of spins.
 */
export interface SimulationResult {
  spins: number;
  totalBet: number;
  totalWin: number;
  rtp: number; // Percentage
  hitFrequency: number; // Percentage
  scatterTriggerFrequency: number; // Percentage
  averageWinSize: number;
  largestWin: number;
  smallestWin: number;
  winFrequencyByTier: {
    regular: number; // Percentage
    bigWin: number; // 5× to 25×
    megaWin: number; // 25× to 100×
    jackpot: number; // 100×+
  };
}

/**
 * Run a Monte Carlo simulation: spin N times, track RTP and hit frequency.
 */
export function simulate(spinCount: number, betPerSpin: number = 10): SimulationResult {
  let totalBet = 0;
  let totalWin = 0;
  let winCount = 0;
  let scatterTriggerCount = 0;
  let largestWin = 0;
  let smallestWin = Infinity;

  const winTiers = {
    regular: 0,
    bigWin: 0,
    megaWin: 0,
    jackpot: 0,
  };

  for (let i = 0; i < spinCount; i++) {
    const outcome = spin(betPerSpin, i); // Use spin index as seed for variance
    totalBet += betPerSpin;
    totalWin += outcome.totalWin;

    if (outcome.totalWin > 0) {
      winCount++;
      largestWin = Math.max(largestWin, outcome.totalWin);
      smallestWin = Math.min(smallestWin, outcome.totalWin);

      // Categorize win
      const multiplier = outcome.totalWin / betPerSpin;
      if (multiplier >= 100) {
        winTiers.jackpot++;
      } else if (multiplier >= 25) {
        winTiers.megaWin++;
      } else if (multiplier >= 5) {
        winTiers.bigWin++;
      } else {
        winTiers.regular++;
      }
    }

    if (outcome.triggeredFreeSpins) {
      scatterTriggerCount++;
    }
  }

  const hitFrequency = (winCount / spinCount) * 100;
  const scatterTriggerFrequency = (scatterTriggerCount / spinCount) * 100;
  const rtp = (totalWin / totalBet) * 100;
  const averageWinSize = winCount > 0 ? totalWin / winCount : 0;

  return {
    spins: spinCount,
    totalBet,
    totalWin,
    rtp: Math.round(rtp * 100) / 100, // 2 decimals
    hitFrequency: Math.round(hitFrequency * 100) / 100,
    scatterTriggerFrequency: Math.round(scatterTriggerFrequency * 100) / 100,
    averageWinSize: Math.round(averageWinSize),
    largestWin: largestWin || 0,
    smallestWin: smallestWin === Infinity ? 0 : smallestWin,
    winFrequencyByTier: {
      regular: Math.round((winTiers.regular / winCount) * 100 * 100) / 100 || 0,
      bigWin: Math.round((winTiers.bigWin / winCount) * 100 * 100) / 100 || 0,
      megaWin: Math.round((winTiers.megaWin / winCount) * 100 * 100) / 100 || 0,
      jackpot: Math.round((winTiers.jackpot / winCount) * 100 * 100) / 100 || 0,
    },
  };
}

/**
 * Format simulation results for console output.
 */
export function formatResults(result: SimulationResult): string {
  return `
=== RTP Simulation Results ===
Spins:                   ${result.spins.toLocaleString()}
Total Bet:               ${result.totalBet.toLocaleString()} credits
Total Win:               ${result.totalWin.toLocaleString()} credits
RTP:                     ${result.rtp}%
Hit Frequency:           ${result.hitFrequency}%
Scatter Trigger Rate:    ${result.scatterTriggerFrequency}%
Average Win Size:        ${result.averageWinSize} credits
Largest Win:             ${result.largestWin} credits
Smallest Win:            ${result.smallestWin} credits

Win Frequency by Tier (of all wins):
  Regular (< 5×):        ${result.winFrequencyByTier.regular}%
  Big Win (5–25×):       ${result.winFrequencyByTier.bigWin}%
  Mega Win (25–100×):    ${result.winFrequencyByTier.megaWin}%
  Jackpot (100×+):       ${result.winFrequencyByTier.jackpot}%
`;
}

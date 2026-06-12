#!/usr/bin/env node

import { simulate, formatResults } from './simulator';

/**
 * CLI entry point for the RTP simulator.
 * Usage: node cli.ts [--spins N] [--bet B]
 */

const args = process.argv.slice(2);
let spinCount = 1_000_000; // Default 1M spins
let bet = 10;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--spins' && args[i + 1]) {
    spinCount = parseInt(args[i + 1]!, 10);
    i++;
  } else if (args[i] === '--bet' && args[i + 1]) {
    bet = parseInt(args[i + 1]!, 10);
    i++;
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`
RTP Simulator CLI

Usage: node cli.ts [options]

Options:
  --spins N     Number of spins to simulate (default: 1,000,000)
  --bet B       Bet size per spin in credits (default: 10)
  --help, -h    Show this help message
`);
    process.exit(0);
  }
}

console.log(`Simulating ${spinCount.toLocaleString()} spins at ${bet} credits/spin...`);
const startTime = Date.now();
const result = simulate(spinCount, bet);
const elapsed = Date.now() - startTime;

console.log(formatResults(result));
console.log(`Simulation completed in ${elapsed}ms`);

// Exit with non-zero if RTP is way off (debugging aid)
if (result.rtp < 90 || result.rtp > 105) {
  console.warn(`⚠ RTP is ${result.rtp}% (target: ~96%)`);
}

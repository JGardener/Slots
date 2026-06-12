#!/usr/bin/env node

import { simulate, formatResults } from './simulator';

/**
 * RTP simulator CLI — the paytable/strip tuning loop.
 * Usage: pnpm sim [-- --spins N --bet B --seed S]
 */
const args = process.argv.slice(2);
let spinCount = 1_000_000;
let bet = 10;
let seed = 424242;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--spins' && args[i + 1]) {
    spinCount = parseInt(args[++i]!, 10);
  } else if (args[i] === '--bet' && args[i + 1]) {
    bet = parseInt(args[++i]!, 10);
  } else if (args[i] === '--seed' && args[i + 1]) {
    seed = parseInt(args[++i]!, 10);
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log('Usage: pnpm sim [-- --spins N --bet B --seed S]');
    process.exit(0);
  }
}

console.log(`Simulating ${spinCount.toLocaleString()} rounds at ${bet} credits/spin (seed ${seed})…`);
const start = Date.now();
const result = simulate(spinCount, bet, seed);
console.log(formatResults(result));
console.log(`Done in ${Date.now() - start}ms`);

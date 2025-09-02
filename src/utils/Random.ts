import { createPcg32, randomInt } from 'pcg'

// Simple string -> 32-bit unsigned hash
function hashStringToUint32(seed: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export class Random {
  private state: any;

  constructor(seed: number | string = 42, streamId: number = 54) {
    const initState = typeof seed === 'string' ? hashStringToUint32(seed) : seed;
    this.state = createPcg32({}, initState >>> 0, streamId >>> 0);
  }

  // Returns float in [0, 1)
  random(): number {
    // Use inclusive 32-bit range per pcg API
    const rng = randomInt(0, 0xffffffff);
    const [value, nextState] = rng(this.state);
    this.state = nextState;
    // Divide by 2^32 to get [0,1)
    return value / 0x100000000;
  }

  // Integer in [min, max] inclusive
  int(min: number, max: number): number {
    const a = Math.floor(min);
    const b = Math.floor(max);
    if (b < a) throw new Error(`Random.int: max < min (${b} < ${a})`);
    // pcg.randomInt expects [min, max) (exclusive upper bound); add +1 to include max
    const rng = randomInt(a, b + 1);
    const [value, nextState] = rng(this.state);
    this.state = nextState;
    return value;
  }

  // Float in [min, max)
  range(min: number, max: number): number {
    return min + (max - min) * this.random();
  }

  // Returns true with probability p in [0,1]
  chance(p: number): boolean {
    return this.random() < p;
  }

  // Random angle in [0, 2π)
  angle(): number {
    return this.random() * Math.PI * 2;
  }

  // Pick a random element from array (non-empty)
  pick<T>(arr: T[]): T {
    const i = this.int(0, arr.length - 1);
    return arr[i];
  }

  // Fisher-Yates shuffle in-place
  shuffleInPlace<T>(arr: T[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
}

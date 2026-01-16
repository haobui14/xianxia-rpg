import seedrandom from 'seedrandom';

/**
 * Deterministic random number generator using seed
 */
export class DeterministicRNG {
  private rng: seedrandom.PRNG;

  constructor(seed: string) {
    this.rng = seedrandom(seed);
  }

  /**
   * Get random number between 0 and 1
   */
  random(): number {
    return this.rng();
  }

  /**
   * Get random integer between min (inclusive) and max (inclusive)
   */
  randomInt(min: number, max: number): number {
    return Math.floor(this.random() * (max - min + 1)) + min;
  }

  /**
   * Get random element from array
   */
  randomElement<T>(array: T[]): T {
    return array[this.randomInt(0, array.length - 1)];
  }

  /**
   * Roll dice notation (e.g., "2d6" for 2 six-sided dice)
   */
  rollDice(notation: string): number {
    const [count, sides] = notation.split('d').map(Number);
    let total = 0;
    for (let i = 0; i < count; i++) {
      total += this.randomInt(1, sides);
    }
    return total;
  }

  /**
   * Check if random event happens with given probability (0-1)
   */
  chance(probability: number): boolean {
    return this.random() < probability;
  }
}

/**
 * Create RNG for a specific turn
 */
export function createTurnRNG(worldSeed: string, turnNo: number): DeterministicRNG {
  return new DeterministicRNG(`${worldSeed}-turn-${turnNo}`);
}

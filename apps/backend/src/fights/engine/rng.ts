/** Source de hasard du moteur, injectable pour des tests déterministes. */
export interface Rng {
  /** Mélange arr sur place et le renvoie. */
  shuffle<T>(arr: T[]): T[];
  /** true : player1 commence. */
  coinFlip(): boolean;
}

export const RNG = Symbol('RNG');

export const mathRandomRng: Rng = {
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },
  coinFlip: () => Math.random() < 0.5,
};

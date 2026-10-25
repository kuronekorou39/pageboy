/**
 * 引き切るまで同じ値を出さない「袋」。空になったら詰め直す。
 * 詰め直し直後に直前と同じ値が出ないよう、exclude を避ける。
 */
export class ShuffleBag {
  private bag: number[] = [];

  constructor(
    private readonly size: number,
    private readonly rng: () => number = Math.random,
  ) {}

  next(exclude?: number): number {
    if (this.size <= 0) throw new Error("ShuffleBag: size must be positive");
    if (this.size === 1) return 0;
    if (this.bag.length === 0) this.refill(exclude);
    return this.bag.pop()!;
  }

  private refill(exclude: number | undefined): void {
    const values = Array.from({ length: this.size }, (_, i) => i);
    for (let i = values.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      const vi = values[i]!;
      values[i] = values[j]!;
      values[j] = vi;
    }
    // 次に pop されるのは末尾。末尾が exclude なら先頭と入れ替える
    const last = values.length - 1;
    if (exclude !== undefined && values[last] === exclude) {
      const first = values[0]!;
      values[0] = values[last]!;
      values[last] = first;
    }
    this.bag = values;
  }
}

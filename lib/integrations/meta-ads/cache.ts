export class MetaSuccessCache<T> {
  private readonly entries = new Map<string, { expiresAt: number; value: T }>();
  private readonly ttlMs: number;

  constructor(ttlMs: number) {
    this.ttlMs = ttlMs;
  }

  async getOrLoad(
    key: string,
    loader: () => Promise<T>,
    now: () => number = Date.now,
  ): Promise<T> {
    const cached = this.entries.get(key);
    if (cached && cached.expiresAt > now()) return cached.value;
    const value = await loader();
    this.entries.set(key, { value, expiresAt: now() + this.ttlMs });
    return value;
  }
}

/**
 * Time-windowed counter primitive. The window TTL is refreshed on every
 * increment — 5 attempts within any rolling `windowSeconds` interval will
 * surface to the caller, not just 5 within a fixed bucket from the first hit.
 *
 * Callers own the policy (thresholds, action taken when threshold crosses);
 * this primitive only tracks counts.
 */
export default abstract class SlidingWindowCounter {
  abstract increment(key: string, windowSeconds: number): Promise<number>
  abstract reset(key: string): Promise<void>
}

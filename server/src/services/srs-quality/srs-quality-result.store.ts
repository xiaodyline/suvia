import type { SrsQualityResult } from "./srs-quality.types.ts";

class SrsQualityResultStore {
  private readonly results = new Map<string, SrsQualityResult>();

  set(key: string, result: SrsQualityResult) {
    this.results.set(key, result);
  }

  get(key: string) {
    return this.results.get(key);
  }

  take(key: string) {
    const result = this.results.get(key);
    this.results.delete(key);
    return result;
  }

  delete(key: string) {
    this.results.delete(key);
  }
}

export const srsQualityResultStore = new SrsQualityResultStore();

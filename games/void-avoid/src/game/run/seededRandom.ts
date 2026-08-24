export {
  RUN_RANDOM_ALGORITHM,
  RunRandomStreams,
  SeededRandom,
  deriveStreamSeed,
  formatRunSeed,
  normalizeRunSeed,
  type RunRandomStreamName,
} from '@avoid/voidavoid-contract';

export function createRunSeed(): number {
  const cryptoObject = globalThis.crypto;
  if (cryptoObject?.getRandomValues) {
    return cryptoObject.getRandomValues(new Uint32Array(1))[0] >>> 0;
  }

  // The seed itself does not prove trust; it only makes a local run reproducible.
  return (Date.now() ^ Math.trunc(globalThis.performance?.now?.() ?? 0)) >>> 0;
}

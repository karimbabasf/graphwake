import type { VectorRecord } from "@/lib/domain/types";

const TOKEN_PATTERN = /[\p{L}\p{N}]+/gu;

function fnv1a(value: string): number {
  let hash = 0x811c9dc5;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function featuresFor(text: string): string[] {
  const tokens =
    text.normalize("NFKC").toLocaleLowerCase("en-US").match(TOKEN_PATTERN) ?? [];
  const bigrams = tokens.slice(1).map((token, index) => `${tokens[index]}::${token}`);
  return [...tokens, ...bigrams];
}

export function featureHashVector(
  text: string,
  dimensions = 48,
  createdAt = new Date().toISOString(),
): VectorRecord {
  if (!Number.isInteger(dimensions) || dimensions < 1) {
    throw new RangeError("Vector dimensions must be a positive integer");
  }

  const values = Array<number>(dimensions).fill(0);
  for (const feature of featuresFor(text)) {
    const bucketHash = fnv1a(feature);
    const signHash = fnv1a(`sign:${feature}`);
    const bucket = bucketHash % dimensions;
    values[bucket] += (signHash & 1) === 0 ? 1 : -1;
  }

  const magnitude = Math.hypot(...values);
  const normalizedValues =
    magnitude === 0 ? values : values.map((value) => value / magnitude);

  return {
    method: "feature-hash-v1",
    dimensions,
    values: normalizedValues,
    normalized: magnitude > 0,
    createdAt,
  };
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new RangeError("Vectors must have equal dimensions");
  }

  let dot = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index];
    magnitudeA += a[index] * a[index];
    magnitudeB += b[index] * b[index];
  }

  if (magnitudeA === 0 || magnitudeB === 0) return 0;
  return dot / Math.sqrt(magnitudeA * magnitudeB);
}

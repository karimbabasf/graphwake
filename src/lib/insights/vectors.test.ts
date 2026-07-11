import { describe, expect, it } from "vitest";

import {
  cosineSimilarity,
  featureHashVector,
} from "@/lib/insights/vectors";

describe("featureHashVector", () => {
  it("creates a deterministic normalized vector", () => {
    const first = featureHashVector("memory graph evidence");
    const second = featureHashVector("memory graph evidence");

    expect(first.values).toEqual(second.values);
    expect(first.dimensions).toBe(48);
    expect(Math.hypot(...first.values)).toBeCloseTo(1, 8);
    expect(first.method).toBe("feature-hash-v1");
  });

  it("returns an explicit zero vector for text without tokens", () => {
    const vector = featureHashVector("---", 8);

    expect(vector.values).toEqual(Array(8).fill(0));
    expect(vector.normalized).toBe(false);
  });
});

describe("cosineSimilarity", () => {
  it("computes exact orthogonal and identical scores", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
    expect(cosineSimilarity([1, 0], [1, 0])).toBe(1);
  });

  it("rejects vectors with different dimensions", () => {
    expect(() => cosineSimilarity([1, 0], [1])).toThrow(
      "Vectors must have equal dimensions",
    );
  });
});

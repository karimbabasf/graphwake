import { describe, expect, it } from "vitest";

import {
  distanceToQuadratic,
  quadraticControlPoint,
  quadraticPoint,
} from "@/lib/visual/edgeGeometry";

describe("parallel edge geometry", () => {
  it("places parallel lanes on opposite sides of the direct path", () => {
    const source = { x: 0, y: 0 };
    const target = { x: 100, y: 0 };
    const upper = quadraticControlPoint(source, target, -0.5);
    const lower = quadraticControlPoint(source, target, 0.5);

    expect(upper.y).toBeLessThan(0);
    expect(lower.y).toBeGreaterThan(0);
    expect(upper.x).toBe(50);
    expect(lower.x).toBe(50);
  });

  it("can distinguish the selectable path of each lane", () => {
    const source = { x: 0, y: 0 };
    const target = { x: 100, y: 0 };
    const upper = quadraticControlPoint(source, target, -1);
    const lower = quadraticControlPoint(source, target, 1);
    const pointOnUpper = quadraticPoint(source, upper, target, 0.5);

    expect(
      distanceToQuadratic(pointOnUpper, source, upper, target),
    ).toBeLessThan(0.1);
    expect(
      distanceToQuadratic(pointOnUpper, source, lower, target),
    ).toBeGreaterThan(15);
  });

  it("keeps long curves selectable between sample points", () => {
    const source = { x: 0, y: 0 };
    const target = { x: 2_000, y: 0 };
    const control = quadraticControlPoint(source, target, 1);
    const point = quadraticPoint(source, control, target, 0.517);

    expect(distanceToQuadratic(point, source, control, target)).toBeLessThan(1);
  });
});

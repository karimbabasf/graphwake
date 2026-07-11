export interface Point {
  x: number;
  y: number;
}

const LANE_GAP = 24;

export function quadraticControlPoint(
  source: Point,
  target: Point,
  lane: number,
): Point {
  const deltaX = target.x - source.x;
  const deltaY = target.y - source.y;
  const length = Math.hypot(deltaX, deltaY) || 1;
  const offset = lane * LANE_GAP;

  return {
    x: (source.x + target.x) / 2 - (deltaY / length) * offset,
    y: (source.y + target.y) / 2 + (deltaX / length) * offset,
  };
}

export function quadraticPoint(
  source: Point,
  control: Point,
  target: Point,
  progress: number,
): Point {
  const inverse = 1 - progress;
  return {
    x:
      inverse * inverse * source.x +
      2 * inverse * progress * control.x +
      progress * progress * target.x,
    y:
      inverse * inverse * source.y +
      2 * inverse * progress * control.y +
      progress * progress * target.y,
  };
}

export function quadraticTangent(
  source: Point,
  control: Point,
  target: Point,
  progress: number,
): Point {
  return {
    x:
      2 * (1 - progress) * (control.x - source.x) +
      2 * progress * (target.x - control.x),
    y:
      2 * (1 - progress) * (control.y - source.y) +
      2 * progress * (target.y - control.y),
  };
}

export function distanceToQuadratic(
  point: Point,
  source: Point,
  control: Point,
  target: Point,
  samples = 32,
): number {
  let closest = Number.POSITIVE_INFINITY;
  let previous = source;
  for (let index = 1; index <= samples; index += 1) {
    const candidate = quadraticPoint(source, control, target, index / samples);
    const deltaX = candidate.x - previous.x;
    const deltaY = candidate.y - previous.y;
    const lengthSquared = deltaX * deltaX + deltaY * deltaY;
    const progress = lengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            ((point.x - previous.x) * deltaX +
              (point.y - previous.y) * deltaY) /
              lengthSquared,
          ),
        );
    const projected = {
      x: previous.x + deltaX * progress,
      y: previous.y + deltaY * progress,
    };
    closest = Math.min(
      closest,
      Math.hypot(point.x - projected.x, point.y - projected.y),
    );
    previous = candidate;
  }
  return closest;
}

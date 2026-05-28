import type { Keypoint } from './keypoints';

export interface Point {
  x: number;
  y: number;
}

/**
 * Returns the interior angle at vertex `b` formed by points a → b → c.
 * Output is in degrees, range [0, 180].
 * Independent of coordinate units — works on normalized [0,1] coords or pixels.
 */
export function angleAt(a: Point, b: Point, c: Point): number {
  const v1x = a.x - b.x;
  const v1y = a.y - b.y;
  const v2x = c.x - b.x;
  const v2y = c.y - b.y;

  const dot = v1x * v2x + v1y * v2y;
  const mag1 = Math.hypot(v1x, v1y);
  const mag2 = Math.hypot(v2x, v2y);
  if (mag1 === 0 || mag2 === 0) return 0;

  const cos = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

/** Angle (degrees) of segment from `from` to `to`, measured from the image-vertical axis (up = 0°). */
export function angleFromVertical(from: Point, to: Point): number {
  // image y grows downward, so "up" in image space is -y
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const rad = Math.atan2(dx, -dy);
  return (Math.abs(rad) * 180) / Math.PI;
}

/** Midpoint of two keypoints. Useful for hip/shoulder centers. */
export function midpoint(a: Keypoint, b: Keypoint): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

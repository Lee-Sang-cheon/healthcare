import { angleAt, angleFromVertical, midpoint } from '../geometry';

describe('angleAt', () => {
  it('returns 90° for a right angle', () => {
    // a=(0,1), b=(0,0), c=(1,0)
    expect(angleAt({ x: 0, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(90, 5);
  });

  it('returns 180° for collinear points (straight line through b)', () => {
    expect(angleAt({ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(180, 5);
  });

  it('returns 0° for coincident outer points', () => {
    expect(angleAt({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(0, 5);
  });

  it('returns 60° for an equilateral configuration', () => {
    // Triangle with all sides equal — apex angle is 60°
    const a = { x: -1, y: 0 };
    const b = { x: 0, y: Math.sqrt(3) };
    const c = { x: 1, y: 0 };
    expect(angleAt(a, b, c)).toBeCloseTo(60, 5);
  });

  it('returns 0 when one vector has zero length (guard against NaN)', () => {
    expect(angleAt({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBe(0);
  });
});

describe('angleFromVertical', () => {
  it('returns 0 for a vertical upward segment (image y grows down)', () => {
    // from (0,1) → (0,0) is "up" in image space
    expect(angleFromVertical({ x: 0, y: 1 }, { x: 0, y: 0 })).toBeCloseTo(0, 5);
  });

  it('returns 90° for a horizontal segment', () => {
    expect(angleFromVertical({ x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(90, 5);
  });

  it('returns 45° for a diagonal up-right segment', () => {
    expect(angleFromVertical({ x: 0, y: 1 }, { x: 1, y: 0 })).toBeCloseTo(45, 5);
  });

  it('is symmetric across the vertical axis (absolute value)', () => {
    const left = angleFromVertical({ x: 0, y: 1 }, { x: -1, y: 0 });
    const right = angleFromVertical({ x: 0, y: 1 }, { x: 1, y: 0 });
    expect(left).toBeCloseTo(right, 5);
  });
});

describe('midpoint', () => {
  it('returns the arithmetic mean of x and y', () => {
    const m = midpoint({ x: 0, y: 0, score: 1 }, { x: 2, y: 4, score: 1 });
    expect(m).toEqual({ x: 1, y: 2 });
  });

  it('ignores score (only mid of position)', () => {
    const m = midpoint({ x: 0, y: 0, score: 0.1 }, { x: 4, y: 4, score: 0.9 });
    expect(m).toEqual({ x: 2, y: 2 });
  });
});

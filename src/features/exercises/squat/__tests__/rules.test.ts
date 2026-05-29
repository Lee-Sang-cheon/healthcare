import { deepSquatPose, midSquatPose, standingPose, unreliablePose } from '@/features/pose/__tests__/poseFixtures';

import {
  analyzeSquatFrame,
  detectRepIssues,
  scoreRep,
  SquatThresholds,
  thresholdsFromCalibration,
} from '../rules';

describe('analyzeSquatFrame', () => {
  it('flags unreliable poses', () => {
    const m = analyzeSquatFrame(unreliablePose());
    expect(m.reliable).toBe(false);
    // FALLBACK leaves kneeAngle at 180 (standing) — see rules.ts
    expect(m.kneeAngle).toBe(180);
  });

  it('reports ~180° knee angle and ~0° trunk tilt when standing upright', () => {
    const m = analyzeSquatFrame(standingPose());
    expect(m.reliable).toBe(true);
    expect(m.kneeAngle).toBeCloseTo(180, 1);
    expect(m.trunkTilt).toBeCloseTo(0, 1);
    expect(m.kneeAsymmetry).toBe(0);
    expect(m.kneeCaveIndex).toBeCloseTo(0, 5);
  });

  it('reports a deep knee bend and forward trunk lean in a deep squat', () => {
    const m = analyzeSquatFrame(deepSquatPose());
    expect(m.reliable).toBe(true);
    expect(m.kneeAngle).toBeLessThan(110);
    expect(m.trunkTilt).toBeGreaterThan(20);
  });

  it('reports an intermediate knee angle in a mid-squat', () => {
    const m = analyzeSquatFrame(midSquatPose());
    expect(m.reliable).toBe(true);
    expect(m.kneeAngle).toBeGreaterThan(110);
    expect(m.kneeAngle).toBeLessThan(170);
  });
});

describe('detectRepIssues', () => {
  it('flags shallow_depth when knee angle stays above the default cutoff', () => {
    const m = analyzeSquatFrame(midSquatPose());
    const issues = detectRepIssues(m);
    expect(issues).toContain('shallow_depth');
  });

  it('does not flag shallow_depth on a deep squat', () => {
    const m = analyzeSquatFrame(deepSquatPose());
    const issues = detectRepIssues(m);
    expect(issues).not.toContain('shallow_depth');
  });

  it('flags forward_lean when trunkTilt crosses threshold', () => {
    // Construct: standing legs but very leaned over (shoulder far left of hip)
    const pose = standingPose({
      leftShoulder: { x: 0.1, y: 0.4, score: 0.9 },
      rightShoulder: { x: 0.1, y: 0.4, score: 0.9 },
    });
    const m = analyzeSquatFrame(pose);
    expect(detectRepIssues(m)).toContain('forward_lean');
  });

  it('returns empty for unreliable input', () => {
    expect(detectRepIssues(analyzeSquatFrame(unreliablePose()))).toEqual([]);
  });
});

describe('scoreRep', () => {
  it('returns 0 for unreliable metrics', () => {
    expect(scoreRep(analyzeSquatFrame(unreliablePose()))).toBe(0);
  });

  it('returns ~100 for a clean deep squat', () => {
    const score = scoreRep(analyzeSquatFrame(deepSquatPose()));
    expect(score).toBeGreaterThanOrEqual(80);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('deducts points for a shallow rep', () => {
    const m = analyzeSquatFrame(midSquatPose());
    const score = scoreRep(m);
    expect(score).toBeLessThan(100);
  });

  it('is monotonic — a worse pose never scores higher than a better one', () => {
    const shallow = scoreRep(analyzeSquatFrame(midSquatPose()));
    const deep = scoreRep(analyzeSquatFrame(deepSquatPose()));
    expect(deep).toBeGreaterThanOrEqual(shallow);
  });
});

describe('thresholdsFromCalibration', () => {
  it('returns the population defaults for undefined calibration', () => {
    const t = thresholdsFromCalibration(undefined);
    expect(t).toEqual({ ...SquatThresholds });
  });

  it('lowers the shallow-depth bar to (maxKneeAngle + 15) when calibrated', () => {
    const t = thresholdsFromCalibration({ maxKneeAngle: 85 });
    expect(t.shallowDepthBelow).toBe(100);
  });

  it('clamps shallow-depth above kneeBottom + 5', () => {
    // very deep calibration shouldn't push shallow into the rep-counting zone
    const t = thresholdsFromCalibration({ maxKneeAngle: 50 });
    expect(t.shallowDepthBelow).toBeGreaterThan(t.kneeBottom);
  });

  it('clamps shallow-depth at 140 even with shallow calibration', () => {
    const t = thresholdsFromCalibration({ maxKneeAngle: 200 });
    expect(t.shallowDepthBelow).toBe(140);
  });

  it('derives kneeStanding from minKneeAngle - 5', () => {
    const t = thresholdsFromCalibration({ minKneeAngle: 170 });
    expect(t.kneeStanding).toBe(165);
  });

  it('forwardLeanAbove follows neutralTrunkTilt + 25 baseline offset', () => {
    const t = thresholdsFromCalibration({ neutralTrunkTilt: 10 });
    expect(t.forwardLeanAbove).toBeCloseTo(35, 1);
  });

  it('femurTorsoRatio > 1 grants extra forward-lean leeway', () => {
    const base = thresholdsFromCalibration({ neutralTrunkTilt: 10 });
    const longFemur = thresholdsFromCalibration({ neutralTrunkTilt: 10, femurTorsoRatio: 1.3 });
    expect(longFemur.forwardLeanAbove).toBeGreaterThan(base.forwardLeanAbove);
  });

  it('asymmetry and kneeCave thresholds use deviation-from-baseline', () => {
    const t = thresholdsFromCalibration({ neutralAsymmetry: 4, neutralKneeCaveIndex: 0.04 });
    expect(t.asymmetryAbove).toBe(16);
    expect(t.kneeCaveAbove).toBeCloseTo(0.09, 5);
  });
});

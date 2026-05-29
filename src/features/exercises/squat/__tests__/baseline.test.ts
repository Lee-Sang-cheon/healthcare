import {
  deepSquatPose,
  midSquatPose,
  standingPose,
  unreliablePose,
} from '@/features/pose/__tests__/poseFixtures';

import {
  buildStandingBaseline,
  extractStandingSample,
} from '../baseline';

describe('extractStandingSample', () => {
  it('returns a sample for a clean standing pose', () => {
    const s = extractStandingSample(standingPose());
    expect(s).not.toBeNull();
    expect(s!.kneeAngle).toBeCloseTo(180, 1);
    expect(s!.trunkTilt).toBeCloseTo(0, 1);
    expect(s!.asymmetry).toBe(0);
    expect(s!.femurTorsoRatio).toBeGreaterThan(0);
  });

  it('rejects unreliable poses', () => {
    expect(extractStandingSample(unreliablePose())).toBeNull();
  });

  it('rejects bent-knee poses (user squatting during standing capture)', () => {
    expect(extractStandingSample(deepSquatPose())).toBeNull();
  });

  it('rejects mid-squat poses (knee angle < 150°)', () => {
    expect(extractStandingSample(midSquatPose())).toBeNull();
  });

  it('computes femurTorsoRatio from leg vs torso lengths', () => {
    // Default fixture: shoulder y=0.22, hip y=0.5, ankle y=0.9
    // torso ≈ 0.28, leg ≈ 0.4 → ratio ≈ 1.43
    const s = extractStandingSample(standingPose())!;
    expect(s.femurTorsoRatio).toBeGreaterThan(1.0);
    expect(s.femurTorsoRatio).toBeLessThan(2.0);
  });
});

describe('buildStandingBaseline', () => {
  it('returns null for an empty samples array', () => {
    expect(buildStandingBaseline([])).toBeNull();
  });

  it('averages each field across samples', () => {
    const samples = [
      { kneeAngle: 178, trunkTilt: 2, asymmetry: 1, kneeCaveIndex: 0.01, femurTorsoRatio: 1.4 },
      { kneeAngle: 180, trunkTilt: 4, asymmetry: 3, kneeCaveIndex: 0.03, femurTorsoRatio: 1.5 },
    ];
    const b = buildStandingBaseline(samples);
    expect(b).not.toBeNull();
    expect(b!.sampleCount).toBe(2);
    expect(b!.minKneeAngle).toBeCloseTo(179, 5);
    expect(b!.neutralTrunkTilt).toBeCloseTo(3, 5);
    expect(b!.neutralAsymmetry).toBeCloseTo(2, 5);
    expect(b!.neutralKneeCaveIndex).toBeCloseTo(0.02, 5);
    expect(b!.femurTorsoRatio).toBeCloseTo(1.45, 5);
  });

  it('produces a usable baseline from a single sample', () => {
    const b = buildStandingBaseline([
      { kneeAngle: 175, trunkTilt: 8, asymmetry: 2, kneeCaveIndex: 0.05, femurTorsoRatio: 1.2 },
    ]);
    expect(b!.sampleCount).toBe(1);
    expect(b!.minKneeAngle).toBe(175);
  });
});

import {
  deepSquatPose,
  midSquatPose,
  standingPose,
  unreliablePose,
} from '@/features/pose/__tests__/poseFixtures';

import type { SquatIssue } from '../issues';
import { createSquatAnalyzer } from '../state-machine';

describe('createSquatAnalyzer', () => {
  it('starts in standing phase with 0 reps', () => {
    const analyzer = createSquatAnalyzer();
    const { phase, reps } = analyzer.feed(standingPose(), 0);
    expect(phase).toBe('standing');
    expect(reps).toBe(0);
  });

  it('ignores unreliable frames', () => {
    const onRep = jest.fn();
    const analyzer = createSquatAnalyzer({ onRep });
    for (let i = 0; i < 5; i++) analyzer.feed(unreliablePose(), i * 33);
    expect(onRep).not.toHaveBeenCalled();
    expect(analyzer.snapshot().reps).toBe(0);
  });

  it('counts a complete rep via standing → descending → bottom → ascending → standing', () => {
    const onRep = jest.fn();
    const analyzer = createSquatAnalyzer({ onRep }, { bottomHoldFrames: 3 });
    // 30 fps timeline
    const dt = 33;
    let t = 0;

    // Initial standing frame
    analyzer.feed(standingPose(), t);
    t += dt;

    // Descent — mid then deep, with enough hold frames at bottom
    analyzer.feed(midSquatPose(), t); t += dt;
    for (let i = 0; i < 6; i++) {
      analyzer.feed(deepSquatPose(), t);
      t += dt;
    }

    // Ascend back through mid to standing
    analyzer.feed(midSquatPose(), t); t += dt;
    analyzer.feed(standingPose(), t); t += dt;

    expect(onRep).toHaveBeenCalledTimes(1);
    const result = onRep.mock.calls[0][0];
    expect(result.repNumber).toBe(1);
    expect(result.formScore).toBeGreaterThan(0);
    expect(result.durationMs).toBeGreaterThan(0);
    expect(analyzer.snapshot().reps).toBe(1);
  });

  it('counts multiple consecutive reps', () => {
    const onRep = jest.fn();
    const analyzer = createSquatAnalyzer({ onRep }, { bottomHoldFrames: 3 });
    const dt = 33;
    let t = 0;

    for (let rep = 0; rep < 3; rep++) {
      analyzer.feed(standingPose(), t); t += dt;
      analyzer.feed(midSquatPose(), t); t += dt;
      for (let i = 0; i < 5; i++) {
        analyzer.feed(deepSquatPose(), t);
        t += dt;
      }
      analyzer.feed(midSquatPose(), t); t += dt;
      analyzer.feed(standingPose(), t); t += dt;
    }

    expect(onRep).toHaveBeenCalledTimes(3);
    expect(analyzer.snapshot().reps).toBe(3);
    expect(onRep.mock.calls.map((c) => c[0].repNumber)).toEqual([1, 2, 3]);
  });

  it('does not count a brief bottom touch (hysteresis)', () => {
    const onRep = jest.fn();
    const analyzer = createSquatAnalyzer({ onRep }, { bottomHoldFrames: 6 });
    const dt = 33;
    let t = 0;

    analyzer.feed(standingPose(), t); t += dt;
    // Only 2 frames at bottom — below the 6-frame hold requirement
    analyzer.feed(midSquatPose(), t); t += dt;
    analyzer.feed(deepSquatPose(), t); t += dt;
    analyzer.feed(deepSquatPose(), t); t += dt;
    analyzer.feed(midSquatPose(), t); t += dt;
    analyzer.feed(standingPose(), t); t += dt;

    // Phase should have walked back to standing without going through 'bottom',
    // so completeRep is not called.
    expect(onRep).not.toHaveBeenCalled();
    expect(analyzer.snapshot().reps).toBe(0);
  });

  it('reset clears reps and phase', () => {
    const analyzer = createSquatAnalyzer({}, { bottomHoldFrames: 3 });
    let t = 0;
    analyzer.feed(standingPose(), t); t += 33;
    analyzer.feed(midSquatPose(), t); t += 33;
    for (let i = 0; i < 5; i++) { analyzer.feed(deepSquatPose(), t); t += 33; }
    analyzer.feed(midSquatPose(), t); t += 33;
    analyzer.feed(standingPose(), t); t += 33;
    expect(analyzer.snapshot().reps).toBe(1);

    analyzer.reset();
    expect(analyzer.snapshot().reps).toBe(0);
    expect(analyzer.snapshot().phase).toBe('standing');
  });

  it('respects per-issue cooldown — same issue not voiced twice within cooldownMs', () => {
    const onIssue = jest.fn();
    const analyzer = createSquatAnalyzer(
      { onIssue },
      { bottomHoldFrames: 2, issueCooldownMs: 1000 },
    );
    let t = 0;

    // Trigger descent with a shallow-depth pose (mid-squat keeps knee > 110°)
    analyzer.feed(standingPose(), t); t += 33;
    analyzer.feed(midSquatPose(), t);

    // Replay the same shallow frame many times within the 1s window
    for (let i = 0; i < 10; i++) {
      analyzer.feed(midSquatPose(), t);
      t += 50;
    }

    const issues = onIssue.mock.calls.map((c) => c[0] as SquatIssue);
    const shallowCount = issues.filter((i) => i === 'shallow_depth').length;
    // First descent frame + at most one more after cooldown elapsed
    expect(shallowCount).toBeLessThanOrEqual(2);
  });

  it('passes calibrated thresholds through to scoring', () => {
    const onRep = jest.fn();
    const analyzer = createSquatAnalyzer(
      { onRep },
      {
        bottomHoldFrames: 3,
        // Looser shallow bar (140°) — even a mid-squat depth shouldn't deduct
        thresholds: {
          kneeStanding: 160,
          kneeBottom: 95,
          shallowDepthBelow: 140,
          forwardLeanAbove: 55,
          asymmetryAbove: 18,
          kneeCaveAbove: 0.08,
        },
      },
    );
    const dt = 33;
    let t = 0;

    analyzer.feed(standingPose(), t); t += dt;
    analyzer.feed(midSquatPose(), t); t += dt;
    for (let i = 0; i < 5; i++) { analyzer.feed(deepSquatPose(), t); t += dt; }
    analyzer.feed(midSquatPose(), t); t += dt;
    analyzer.feed(standingPose(), t); t += dt;

    expect(onRep).toHaveBeenCalledTimes(1);
    const result = onRep.mock.calls[0][0];
    expect(result.issues).not.toContain('shallow_depth');
  });
});

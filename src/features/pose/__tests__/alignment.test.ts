import { checkAlignment } from '../alignment';
import { standingPose, unreliablePose } from './poseFixtures';

describe('checkAlignment', () => {
  it('marks every check ok for a clean side-view standing pose', () => {
    const r = checkAlignment(standingPose());
    expect(r.framing.status).toBe('ok');
    expect(r.cameraAngle.status).toBe('ok');
    expect(r.posture.status).toBe('ok');
    expect(r.ready).toBe(true);
  });

  it('warns on framing when joints are low-confidence', () => {
    const r = checkAlignment(unreliablePose());
    expect(r.framing.status).toBe('warn');
    expect(r.ready).toBe(false);
    // angle / posture also fall back to warn when framing fails
    expect(r.cameraAngle.status).toBe('warn');
    expect(r.posture.status).toBe('warn');
  });

  it('warns on framing when joints sit right at the frame edge', () => {
    // Shoulder dropped into top margin
    const pose = standingPose({
      leftShoulder: { x: 0.5, y: 0.01, score: 0.9 },
      rightShoulder: { x: 0.5, y: 0.01, score: 0.9 },
    });
    const r = checkAlignment(pose);
    expect(r.framing.status).toBe('warn');
    expect(r.ready).toBe(false);
  });

  it('warns on camera angle when shoulders span wide (frontal view)', () => {
    // Big lateral shoulder distance — looks like a frontal view to the heuristic
    const pose = standingPose({
      leftShoulder: { x: 0.3, y: 0.22, score: 0.9 },
      rightShoulder: { x: 0.7, y: 0.22, score: 0.9 },
    });
    const r = checkAlignment(pose);
    expect(r.cameraAngle.status).toBe('warn');
    expect(r.ready).toBe(false);
  });

  it('warns on posture when trunk leans far from vertical while "standing"', () => {
    // Heavy forward lean while otherwise standing — bad neutral pose
    const pose = standingPose({
      leftShoulder: { x: 0.1, y: 0.4, score: 0.9 },
      rightShoulder: { x: 0.11, y: 0.4, score: 0.9 },
    });
    const r = checkAlignment(pose);
    expect(r.posture.status).toBe('warn');
    expect(r.ready).toBe(false);
  });
});

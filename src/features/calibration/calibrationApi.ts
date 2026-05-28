import { ensureAuth } from '@/features/auth/ensureAuth';
import { supabase } from '@/lib/supabase/client';
import type { Json } from '@/lib/supabase/types';

/**
 * Personal range-of-motion + postural baselines + body-proportion ratios.
 * Captured once per exercise via the calibration screen; thresholds for
 * scoring/rep-counting are derived from this rather than population averages.
 *
 * All fields below `recordedAt` are nullable in case an older calibration
 * was saved before a field existed — readers must handle missing values.
 */
export interface SquatCalibration {
  /** Smallest knee interior angle reached in the deepest squat (deg). */
  maxKneeAngle: number;
  /**
   * Knee interior angle while standing relaxed (deg). Roughly 170–180 for
   * most people; lower if the user can't fully extend.
   */
  minKneeAngle?: number;
  /** Trunk tilt from vertical while standing relaxed (deg). */
  neutralTrunkTilt?: number;
  /** |left - right| knee angle difference while standing (deg). */
  neutralAsymmetry?: number;
  /** Knee cave indicator while standing (their natural Q-angle proxy). */
  neutralKneeCaveIndex?: number;
  /**
   * (leg length) / (torso length) measured from a single standing frame.
   * Long femurs => higher ratio => more forward lean is anatomically required.
   * Used to slightly relax the forward-lean threshold.
   */
  femurTorsoRatio?: number;
  recordedAt: string;
}

export interface CalibrationData {
  squat?: SquatCalibration;
}

export async function getCalibration(): Promise<CalibrationData> {
  const userId = await ensureAuth();
  const { data, error } = await supabase
    .from('profiles')
    .select('calibration')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data?.calibration as CalibrationData | null) ?? {};
}

/**
 * Persist the full calibration object for squat. Read-modify-write so any
 * future exercise's calibration in the same JSONB is preserved.
 */
export async function saveSquatCalibration(
  cal: Omit<SquatCalibration, 'recordedAt'>,
): Promise<void> {
  const userId = await ensureAuth();
  const existing = await getCalibration();
  const next: CalibrationData = {
    ...existing,
    squat: { ...cal, recordedAt: new Date().toISOString() },
  };
  const { error } = await supabase
    .from('profiles')
    .update({ calibration: next as unknown as Json })
    .eq('id', userId);
  if (error) throw error;
}

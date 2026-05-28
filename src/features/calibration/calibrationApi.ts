import { ensureAuth } from '@/features/auth/ensureAuth';
import { supabase } from '@/lib/supabase/client';
import type { Json } from '@/lib/supabase/types';

/**
 * Personal range-of-motion baseline. Recorded once per exercise (re-recordable).
 * Stored as `profiles.calibration` JSONB so we can add new exercises without
 * schema migrations.
 */
export interface SquatCalibration {
  /** Smallest knee interior angle the user reached in their deepest squat (deg). */
  maxKneeAngle: number;
  /** ISO timestamp when this measurement was recorded. */
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

export async function saveSquatCalibration(maxKneeAngle: number): Promise<void> {
  const userId = await ensureAuth();
  // Read-modify-write — preserves other exercises' calibrations.
  const existing = await getCalibration();
  const next: CalibrationData = {
    ...existing,
    squat: { maxKneeAngle, recordedAt: new Date().toISOString() },
  };
  const { error } = await supabase
    .from('profiles')
    .update({ calibration: next as unknown as Json })
    .eq('id', userId);
  if (error) throw error;
}

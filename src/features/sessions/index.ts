/**
 * Public surface for the sessions feature.
 *
 * Screens & use cases should import only from this barrel — never reach into
 * the Supabase implementation directly. That keeps the boundary swappable.
 */

export type {
  RepInput,
  SessionRepository,
  SessionSummary,
  StartSessionResult,
} from './SessionRepository';

import { supabaseSessionRepository } from './SupabaseSessionRepository';

/** Default repository binding — swap here for tests, offline queues, etc. */
export const sessionRepository = supabaseSessionRepository;

import { supabase } from '@/lib/supabase/client';

/**
 * Returns the current authenticated user's id, creating an anonymous user
 * if no session exists. Idempotent — safe to call before every protected
 * write.
 *
 * Requires "Allow anonymous sign-ins" to be enabled in the Supabase project
 * (Authentication → Sign In / Up). If disabled, `signInAnonymously` returns
 * a 422 and we surface that error.
 */
export async function ensureAuth(): Promise<string> {
  const { data: existing } = await supabase.auth.getSession();
  if (existing.session?.user) return existing.session.user.id;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  if (!data.user) throw new Error('signInAnonymously returned no user');
  return data.user.id;
}

import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL || 'https://pywyynwjeoiozdawjsey.supabase.co';
export const supabaseUrl = rawUrl.startsWith('http')
  ? (rawUrl.includes('.') ? rawUrl : `${rawUrl}.supabase.co`)
  : `https://${rawUrl}.supabase.co`;

export const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5d3l5bndqZW9pb3pkYXdqc2V5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA0NDI0NjIsImV4cCI6MjEwNjAxODQ2Mn0.uzHn3PFMJGE6fNureKoHq41ysoDfJl6HYZjRHfJJwE0';

// Clean client. No custom storage migration loops.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/**
 * Executes a Supabase query with automatic retry handling for PGRST303 / "JWT issued at future" clock drift errors.
 */
export async function withClockDriftRetry<T>(
  queryFn: () => PromiseLike<{ data: T | null; error: any }>,
  maxRetries = 3
): Promise<{ data: T | null; error: any }> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await queryFn();
      if (res.error) {
        const isClockDrift =
          res.error.code === 'PGRST303' ||
          res.error.message?.toLowerCase().includes('future') ||
          res.error.message?.toLowerCase().includes('jwt issued at future');

        if (isClockDrift && attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
          continue;
        }
      }
      return res;
    } catch (err: any) {
      const isClockDrift =
        err?.code === 'PGRST303' ||
        err?.message?.toLowerCase().includes('future');

      if (isClockDrift && attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
        continue;
      }
      return { data: null, error: err };
    }
  }
  return { data: null, error: new Error('Query timed out after retrying clock drift') };
}
import { supabase } from './supabase';

export interface StreakUpdateResult {
  updated: boolean;
  currentStreak: number;
  bestStreak: number;
  streakIncreased: boolean;
  message?: string;
}

/**
 * Utility function to update a user's prediction streak.
 * Runs every time a user submits a match prediction.
 *
 * Rules:
 * - If last_prediction_date is today: do nothing (already counted today).
 * - If last_prediction_date is yesterday: increment current_streak by 1.
 * - If last_prediction_date is older than yesterday (or null): reset current_streak to 1.
 * - Update last_prediction_date to today's date (YYYY-MM-DD).
 * - If new current_streak is higher than best_streak, update best_streak.
 */
export async function updatePredictionStreak(userId: string): Promise<StreakUpdateResult> {
  if (!userId) {
    return { updated: false, currentStreak: 0, bestStreak: 0, streakIncreased: false };
  }

  try {
    // 1. Fetch current user profile streak data
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('current_streak, best_streak, last_prediction_date')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching profile for streak update:', error);
      return { updated: false, currentStreak: 0, bestStreak: 0, streakIncreased: false };
    }

    // Determine today and yesterday in YYYY-MM-DD
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    const yesterdayDate = new Date();
    yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
    const yesterdayStr = yesterdayDate.toISOString().slice(0, 10);

    // Normalize existing last_prediction_date (YYYY-MM-DD)
    const rawLastDate = profile?.last_prediction_date;
    const lastDateStr = rawLastDate ? String(rawLastDate).slice(0, 10) : null;

    const existingCurrentStreak = profile?.current_streak ?? 0;
    const existingBestStreak = profile?.best_streak ?? 0;

    // Condition 1: If last_prediction_date is today -> do nothing
    if (lastDateStr === todayStr) {
      return {
        updated: false,
        currentStreak: existingCurrentStreak,
        bestStreak: existingBestStreak,
        streakIncreased: false,
        message: 'Streak already recorded for today',
      };
    }

    let newCurrentStreak: number;

    // Condition 2: If last_prediction_date was yesterday -> increment streak by 1
    if (lastDateStr === yesterdayStr) {
      newCurrentStreak = existingCurrentStreak + 1;
    } else {
      // Condition 3: Older than yesterday or null -> reset streak to 1
      newCurrentStreak = 1;
    }

    // Check if new streak surpasses best streak
    const newBestStreak = Math.max(newCurrentStreak, existingBestStreak);

    // Update in Supabase profiles table
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        current_streak: newCurrentStreak,
        best_streak: newBestStreak,
        last_prediction_date: todayStr,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Failed to update streak in Supabase:', updateError);
      return {
        updated: false,
        currentStreak: existingCurrentStreak,
        bestStreak: existingBestStreak,
        streakIncreased: false,
      };
    }

    return {
      updated: true,
      currentStreak: newCurrentStreak,
      bestStreak: newBestStreak,
      streakIncreased: newCurrentStreak > existingCurrentStreak,
      message:
        newCurrentStreak > existingCurrentStreak
          ? `🔥 Streak increased to ${newCurrentStreak} days!`
          : `⚡ Streak started: 1 day!`,
    };
  } catch (err) {
    console.error('Unexpected error in updatePredictionStreak:', err);
    return { updated: false, currentStreak: 0, bestStreak: 0, streakIncreased: false };
  }
}

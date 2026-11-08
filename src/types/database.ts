export interface Profile {
  id: string; // uuid PK -> auth.users
  username: string | null;
  avatar: string | null;
  points: number;
  current_streak: number;
  best_streak: number;
  previous_streak: number;
  is_streak_broken: boolean;
  correct_predictions: number;
  total_predictions: number;
  subscription_tier: string | null; // Used for role: 'admin' | 'streamer' | 'member' | 'free'
  role?: 'member' | 'admin' | 'streamer' | string | null;
  trial_ends_at?: string | null; // ISO timestamp for free trial expiration
  selected_color: string | null;
  unlocked_colors: string[] | null;
  badges: string[] | null;
  daily_reward_day: number;
  daily_reward_claimed_today: boolean;
  region: string | null;
  last_prediction_date: string | null; // ISO date string YYYY-MM-DD
  created_at: string;
  updated_at: string;
}

export type MatchStatus = 'upcoming' | 'live' | 'completed' | 'cancelled';

export interface Match {
  id: string; // text PK
  game: string;
  tournament: string;
  status: MatchStatus;
  start_time: string;
  scheduled_at?: string; // PandaScore mapped field
  team1?: string; // PandaScore mapped field
  team2?: string; // PandaScore mapped field
  team_a_id: string;
  team_a_name: string;
  team_a_short: string;
  team_a_logo: string;
  team_a_region: string;
  team_a_winrate?: number;
  team_b_id: string;
  team_b_name: string;
  team_b_short: string;
  team_b_logo: string;
  team_b_region: string;
  team_b_winrate?: number;
  score_a: number;
  score_b: number;
  winner_id: string | null;
  format: string; // e.g. BO1, BO3, BO5
  total_predictions: number;
  odds_a: number;
  odds_b: number;
  live_map?: string | null;
  live_time?: string | null;
  created_at?: string;
}

export interface Prediction {
  id: string; // uuid PK
  user_id: string;
  match_id: string;
  predicted_team_id: string;
  points_awarded: number;
  is_correct: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface PollOption {
  id: string;
  text: string;
  votes?: number;
}

export interface Poll {
  id: string; // text or uuid
  question: string;
  options: PollOption[];
  total_votes: number;
  expires_at: string | null;
  is_live: boolean;
  match_id?: string | null;
  streamer_name?: string | null;
  streamer_avatar?: string | null;
  sponsor_name?: string | null;
  sponsor_tagline?: string | null;
  bonus_points?: number;
  created_at: string;
}

export interface PollVote {
  id: string;
  poll_id: string;
  user_id: string;
  option_id: string;
  created_at: string;
}

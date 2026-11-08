import { supabase } from './supabase';
import type { Match } from '../types/database';

export interface PandaScoreEndpointConfig {
  game: 'Dota 2' | 'Valorant' | 'CS2' | 'League of Legends' | 'Call of Duty' | 'Rocket League' | 'Overwatch 2' | 'Rainbow Six';
  url: string;
}

export const PANDASCORE_ENDPOINTS: PandaScoreEndpointConfig[] = [
  {
    game: 'Dota 2',
    url: `https://api.allorigins.win/raw?url=${encodeURIComponent('https://api.pandascore.co/dota2/matches/upcoming?page[size]=10')}`,
  },
  {
    game: 'Valorant',
    url: `https://api.allorigins.win/raw?url=${encodeURIComponent('https://api.pandascore.co/valorant/matches/upcoming?page[size]=10')}`,
  },
  {
    game: 'CS2',
    url: `https://api.allorigins.win/raw?url=${encodeURIComponent('https://api.pandascore.co/csgo/matches/upcoming?page[size]=10')}`,
  },
  {
    game: 'League of Legends',
    url: `https://api.allorigins.win/raw?url=${encodeURIComponent('https://api.pandascore.co/lol/matches/upcoming?page[size]=10')}`,
  },
  {
    game: 'Call of Duty',
    url: `https://api.allorigins.win/raw?url=${encodeURIComponent('https://api.pandascore.co/codmw/matches/upcoming?page[size]=10')}`,
  },
  {
    game: 'Rocket League',
    url: `https://api.allorigins.win/raw?url=${encodeURIComponent('https://api.pandascore.co/rl/matches/upcoming?page[size]=10')}`,
  },
  {
    game: 'Overwatch 2',
    url: `https://api.allorigins.win/raw?url=${encodeURIComponent('https://api.pandascore.co/ow/matches/upcoming?page[size]=10')}`,
  },
  {
    game: 'Rainbow Six',
    url: `https://api.allorigins.win/raw?url=${encodeURIComponent('https://api.pandascore.co/r6siege/matches/upcoming?page[size]=10')}`,
  },
];

/**
 * Utility delay function to respect API rate limits (e.g. 200ms delay)
 */
export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Interface representing relevant PandaScore Match raw response
 */
export interface PandaScoreMatchRaw {
  id: number | string;
  name?: string;
  begin_at: string | null;
  scheduled_at?: string | null;
  number_of_games: number;
  status?: string;
  opponents?: Array<{
    type?: string;
    opponent: {
      id?: number;
      name: string;
      acronym?: string | null;
      image_url?: string | null;
      location?: string | null;
    };
  }>;
  serie?: {
    full_name?: string | null;
    name?: string | null;
    region?: string | null;
  } | null;
  league?: {
    name?: string | null;
    image_url?: string | null;
  } | null;
  tournament?: {
    name?: string | null;
  } | null;
}

/**
 * Helper to determine match format string from PandaScore number_of_games
 * number_of_games === 1 ? 'BO1' : number_of_games === 3 ? 'BO3' : 'BO5'
 */
export function formatFromNumberOfGames(numberOfGames: number): string {
  if (numberOfGames === 1) return 'BO1';
  if (numberOfGames === 3) return 'BO3';
  return 'BO5';
}

/**
 * Fetch upcoming matches from a specific PandaScore endpoint.
 * - Adds/ensures &page[size]=10
 * - Injects Authorization: Bearer ${VITE_PANDASCORE_API_KEY}
 * - Logs X-RateLimit-Remaining to the console
 */
/**
 * Fetch upcoming matches from PandaScore via Supabase Edge Function 'sync-pandascore'
 * Bypasses browser CORS restrictions by executing on Supabase's Edge runtime.
 */
export async function fetchPandaScoreMatches(
  _endpointUrl?: string,
  gameName?: string
): Promise<PandaScoreMatchRaw[]> {
  const apiKey = import.meta.env.VITE_PANDASCORE_API_KEY;

  const { data, error } = await supabase.functions.invoke('sync-pandascore', {
    body: {
      game: gameName,
      apiKey: apiKey && apiKey !== 'MY_PANDASCORE_API_KEY' ? apiKey.trim() : undefined,
    },
  });

  if (error) {
    throw new Error(`Edge Function error fetching ${gameName || 'matches'}: ${error.message}`);
  }

  if (data?.error) {
    throw new Error(`Edge Function error: ${data.error}`);
  }

  if (data?.matchesByGame && gameName && data.matchesByGame[gameName]) {
    return data.matchesByGame[gameName];
  }

  if (Array.isArray(data?.data)) {
    const found = data.data.find((d: any) => d.game?.toLowerCase() === gameName?.toLowerCase());
    if (found?.matches) return found.matches;
    if (data.data.length === 1 && data.data[0]?.matches) return data.data[0].matches;
  }

  return [];
}

/**
 * Map raw PandaScore match into the database schema format
 */
export function mapPandaScoreMatch(raw: PandaScoreMatchRaw, game: PandaScoreEndpointConfig['game']): Record<string, any> {
  const team1 = raw.opponents?.[0]?.opponent?.name || 'TBD';
  const team2 = raw.opponents?.[1]?.opponent?.name || 'TBD';
  const scheduledAt = raw.begin_at || raw.scheduled_at || new Date().toISOString();
  const tournamentName = raw.serie?.full_name || raw.league?.name || raw.tournament?.name || `${game} Pro Tour`;
  const matchFormat = formatFromNumberOfGames(raw.number_of_games);

  const team1Short = raw.opponents?.[0]?.opponent?.acronym || team1.slice(0, 3).toUpperCase();
  const team2Short = raw.opponents?.[1]?.opponent?.acronym || team2.slice(0, 3).toUpperCase();
  const team1Logo = raw.opponents?.[0]?.opponent?.image_url || '🦅';
  const team2Logo = raw.opponents?.[1]?.opponent?.image_url || '🐉';

  const team1Id = raw.opponents?.[0]?.opponent?.id
    ? `team-${raw.opponents[0].opponent.id}`
    : `team-${team1.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'a'}`;
  const team2Id = raw.opponents?.[1]?.opponent?.id
    ? `team-${raw.opponents[1].opponent.id}`
    : `team-${team2.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'b'}`;

  // Complete payload covering both the user's requested columns (team1, team2, scheduled_at)
  // and UI compatibility columns (team_a_name, team_b_name, start_time, etc.)
  return {
    id: raw.id.toString(),
    game,
    team1,
    team2,
    scheduled_at: scheduledAt,
    status: 'upcoming',
    tournament: tournamentName,
    format: matchFormat,
    // Compatibility fields
    start_time: scheduledAt,
    team_a_id: team1Id,
    team_a_name: team1,
    team_a_short: team1Short,
    team_a_logo: team1Logo,
    team_a_region: raw.serie?.region || 'Global',
    team_a_winrate: 65,
    team_b_id: team2Id,
    team_b_name: team2,
    team_b_short: team2Short,
    team_b_logo: team2Logo,
    team_b_region: raw.serie?.region || 'Global',
    team_b_winrate: 60,
    score_a: 0,
    score_b: 0,
    odds_a: 1.85,
    odds_b: 1.95,
    total_predictions: 0,
    created_at: new Date().toISOString(),
  };
}

export interface SyncResult {
  totalFetched: number;
  newInserted: number;
  skippedExisting: number;
  gameSummaries: Array<{
    game: string;
    fetched: number;
    inserted: number;
    skipped: number;
    error?: string;
  }>;
}

/**
 * Resiliently insert matches into Supabase. If extra columns fail due to schema variance,
 * attempts fallback with minimal requested columns.
 */
async function resilientInsertMatches(matchesToInsert: Record<string, any>[]): Promise<void> {
  if (matchesToInsert.length === 0) return;

  const { error } = await supabase.from('matches').insert(matchesToInsert);

  if (!error) return;

  console.warn('Initial insert failed, attempting schema-adapted fallback:', error.message);

  // If column doesn't exist error (PGRST204 or PostgreSQL 42703), fallback to minimal required schema
  const minimalMatches = matchesToInsert.map((m) => ({
    id: m.id,
    game: m.game,
    team1: m.team1,
    team2: m.team2,
    scheduled_at: m.scheduled_at,
    status: m.status,
    tournament: m.tournament,
    format: m.format,
  }));

  const fallback = await supabase.from('matches').insert(minimalMatches);
  if (fallback.error) {
    // If team1/team2 column didn't exist in the existing table, fallback to legacy schema
    if (fallback.error.message?.includes('team1') || fallback.error.message?.includes('scheduled_at')) {
      const legacyMatches = matchesToInsert.map((m) => ({
        id: m.id,
        game: m.game,
        team_a_id: m.team_a_id,
        team_a_name: m.team_a_name,
        team_a_short: m.team_a_short,
        team_a_logo: m.team_a_logo,
        team_a_region: m.team_a_region,
        team_a_winrate: m.team_a_winrate,
        team_b_id: m.team_b_id,
        team_b_name: m.team_b_name,
        team_b_short: m.team_b_short,
        team_b_logo: m.team_b_logo,
        team_b_region: m.team_b_region,
        team_b_winrate: m.team_b_winrate,
        start_time: m.start_time,
        status: m.status,
        tournament: m.tournament,
        format: m.format,
        score_a: 0,
        score_b: 0,
        odds_a: 1.85,
        odds_b: 1.95,
        total_predictions: 0,
      }));
      const legacyInsert = await supabase.from('matches').insert(legacyMatches);
      if (legacyInsert.error) throw legacyInsert.error;
      return;
    }
    throw fallback.error;
  }
}

/**
 * Calls the Supabase Edge Function 'sync-pandascore' to fetch upcoming esports matches
 * across the 8 games, checks existing records in the database, and inserts newly discovered matches.
 */
export async function syncGlobalEsportsMatches(
  onProgress?: (progressText: string, current: number, total: number) => void
): Promise<SyncResult> {
  const result: SyncResult = {
    totalFetched: 0,
    newInserted: 0,
    skippedExisting: 0,
    gameSummaries: [],
  };

  onProgress?.('Invoking Supabase Edge Function sync-pandascore...', 1, 3);

  const apiKey = import.meta.env.VITE_PANDASCORE_API_KEY;

  const { data, error } = await supabase.functions.invoke('sync-pandascore', {
    body: {
      apiKey: apiKey && apiKey !== 'MY_PANDASCORE_API_KEY' ? apiKey.trim() : undefined,
    },
  });

  if (error) {
    throw new Error(
      `Failed to invoke Supabase Edge Function 'sync-pandascore': ${error.message || 'Unknown error'}`
    );
  }

  if (data?.error) {
    throw new Error(`Edge Function error: ${data.error}`);
  }

  const gameItems: Array<{ game: PandaScoreEndpointConfig['game']; matches: PandaScoreMatchRaw[]; error?: string }> =
    data?.data || [];

  // Fallback to matchesByGame if returned as dictionary
  if (gameItems.length === 0 && data?.matchesByGame) {
    for (const [gameName, matches] of Object.entries(data.matchesByGame)) {
      gameItems.push({
        game: gameName as PandaScoreEndpointConfig['game'],
        matches: Array.isArray(matches) ? (matches as PandaScoreMatchRaw[]) : [],
      });
    }
  }

  const totalGames = gameItems.length;
  onProgress?.(`Mapping and syncing ${totalGames} esports games into database...`, 2, 3);

  for (let i = 0; i < totalGames; i++) {
    const item = gameItems[i];
    const gameName = item.game;
    const fetchedMatches = item.matches || [];
    let gameError = item.error;

    result.totalFetched += fetchedMatches.length;

    let gameInserted = 0;
    let gameSkipped = 0;

    if (fetchedMatches.length > 0) {
      const matchIds = fetchedMatches.map((m) => m.id.toString());

      // Query Supabase to find which match IDs already exist
      const { data: existingRecords, error: fetchErr } = await supabase
        .from('matches')
        .select('id')
        .in('id', matchIds);

      if (fetchErr) {
        console.error(`Error checking existing ${gameName} matches in Supabase:`, fetchErr);
        gameError = fetchErr.message;
      } else {
        const existingIdSet = new Set((existingRecords || []).map((r: { id: string }) => r.id));

        const newMatchesRaw = fetchedMatches.filter((m) => !existingIdSet.has(m.id.toString()));
        gameSkipped = fetchedMatches.length - newMatchesRaw.length;
        result.skippedExisting += gameSkipped;

        if (newMatchesRaw.length > 0) {
          const recordsToInsert = newMatchesRaw.map((m) => mapPandaScoreMatch(m, gameName));
          try {
            await resilientInsertMatches(recordsToInsert);
            gameInserted = recordsToInsert.length;
            result.newInserted += gameInserted;
          } catch (insertErr: any) {
            console.error(`Error inserting ${gameName} matches into Supabase:`, insertErr);
            gameError = `Insert failed: ${insertErr.message}`;
          }
        }
      }
    }

    result.gameSummaries.push({
      game: gameName,
      fetched: fetchedMatches.length,
      inserted: gameInserted,
      skipped: gameSkipped,
      error: gameError,
    });
  }

  onProgress?.('Sync completed successfully!', 3, 3);
  return result;
}

/**
 * Alias for syncGlobalEsportsMatches for automated and manual PandaScore syncs
 */
export const syncPandaScoreMatches = syncGlobalEsportsMatches;

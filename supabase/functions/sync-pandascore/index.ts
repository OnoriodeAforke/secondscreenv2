// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This Supabase Edge Function runs in the Deno runtime to bypass browser CORS restrictions.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

export const PANDASCORE_GAMES = [
  { game: 'Dota 2', endpoint: 'https://api.pandascore.co/dota2/matches/upcoming?page[size]=10' },
  { game: 'Valorant', endpoint: 'https://api.pandascore.co/valorant/matches/upcoming?page[size]=10' },
  { game: 'CS2', endpoint: 'https://api.pandascore.co/csgo/matches/upcoming?page[size]=10' },
  { game: 'League of Legends', endpoint: 'https://api.pandascore.co/lol/matches/upcoming?page[size]=10' },
  { game: 'Call of Duty', endpoint: 'https://api.pandascore.co/codmw/matches/upcoming?page[size]=10' },
  { game: 'Rocket League', endpoint: 'https://api.pandascore.co/rl/matches/upcoming?page[size]=10' },
  { game: 'Overwatch 2', endpoint: 'https://api.pandascore.co/ow/matches/upcoming?page[size]=10' },
  { game: 'Rainbow Six', endpoint: 'https://api.pandascore.co/r6siege/matches/upcoming?page[size]=10' },
];

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    let bodyApiKey: string | undefined;
    let targetGame: string | undefined;

    if (req.method === 'POST') {
      try {
        const body = await req.json();
        bodyApiKey = body?.apiKey;
        targetGame = body?.game;
      } catch {
        // Body was empty or not JSON, continue
      }
    }

    // Retrieve API key from Deno environment secret, with request body fallback
    const apiKey =
      Deno.env.get('PANDASCORE_API_KEY') ||
      Deno.env.get('VITE_PANDASCORE_API_KEY') ||
      bodyApiKey;

    if (!apiKey || apiKey.trim() === '' || apiKey === 'MY_PANDASCORE_API_KEY') {
      return new Response(
        JSON.stringify({
          error:
            'Missing PandaScore API Key. Please set PANDASCORE_API_KEY secret in Supabase Edge Functions.',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const gamesToFetch = targetGame
      ? PANDASCORE_GAMES.filter((g) => g.game.toLowerCase() === targetGame.toLowerCase())
      : PANDASCORE_GAMES;

    if (gamesToFetch.length === 0) {
      return new Response(
        JSON.stringify({ error: `Game "${targetGame}" is not supported.` }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const results: Array<{
      game: string;
      matches: any[];
      error?: string;
    }> = [];

    const matchesByGame: Record<string, any[]> = {};

    for (let i = 0; i < gamesToFetch.length; i++) {
      const { game, endpoint } = gamesToFetch[i];
      try {
        console.log(`[sync-pandascore] Fetching upcoming matches for ${game}...`);
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${apiKey.trim()}`,
            Accept: 'application/json',
          },
        });

        const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
        console.log(`[sync-pandascore] (${game}) X-RateLimit-Remaining:`, rateLimitRemaining ?? 'N/A');

        if (!response.ok) {
          const errText = await response.text();
          console.error(`[sync-pandascore] Error fetching ${game}: status ${response.status}`, errText);
          results.push({
            game,
            matches: [],
            error: `PandaScore returned ${response.status}: ${errText || response.statusText}`,
          });
          matchesByGame[game] = [];
        } else {
          const data = await response.json();
          const matches = Array.isArray(data) ? data : [];
          results.push({
            game,
            matches,
          });
          matchesByGame[game] = matches;
        }
      } catch (err: any) {
        console.error(`[sync-pandascore] Exception fetching ${game}:`, err);
        results.push({
          game,
          matches: [],
          error: err.message || 'Fetch failed',
        });
        matchesByGame[game] = [];
      }

      // Add 200ms delay between requests to stay well within rate limits (60 req/min)
      if (i < gamesToFetch.length - 1) {
        await delay(200);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: results,
        matchesByGame,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('[sync-pandascore] Edge function error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal Edge Function Error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import TopNavigationBar from '../components/TopNavigationBar';
import MatchCard from '../components/MatchCard';
import { supabase, withClockDriftRetry } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { syncPandaScoreMatches } from '../lib/pandascore';
import type { Match, Prediction } from '../types/database';
import { Radio, Clock, CheckCircle2, PlusCircle, RefreshCw, Zap, Sparkles } from 'lucide-react';

export default function DashboardPage() {
  const { user, profile } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'live' | 'upcoming' | 'completed'>('all');
  const [selectedGame, setSelectedGame] = useState<string>('all');
  const [isMobileView, setIsMobileView] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(() => {
    const stored = localStorage.getItem('last_pandascore_sync');
    if (!stored) return null;
    const num = Number(stored);
    return !isNaN(num) ? num : new Date(stored).getTime();
  });
  const [, setTicker] = useState(0);

  // Helper to format relative time (e.g. "2 mins ago", "Just now")
  const formatRelativeTime = (timestamp: number | null): string => {
    if (!timestamp) return 'Never';
    const now = Date.now();
    const diffSec = Math.max(0, Math.floor((now - timestamp) / 1000));
    if (diffSec < 45) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin === 1) return '1 min ago';
    if (diffMin < 60) return `${diffMin} mins ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;
    const diffDays = Math.floor(diffHours / 24);
    return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
  };

  const fetchMatchesAndPredictions = useCallback(async () => {
    try {
      // 1. Fetch matches from Supabase
      const { data: matchData, error: matchError } = await withClockDriftRetry(() =>
        supabase
          .from('matches')
          .select('*')
          .order('start_time', { ascending: true })
      );

      if (matchError) throw matchError;
      setMatches((matchData as Match[]) || []);

      // 2. Fetch user's predictions from Supabase if logged in
      if (user) {
        const predRes = await withClockDriftRetry(() =>
          supabase
            .from('predictions')
            .select('*')
            .eq('user_id', user.id)
        );

        if (!predRes.error && predRes.data) {
          setPredictions(predRes.data as Prediction[]);
        }
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchMatchesAndPredictions();

    // Realtime channel for matches table
    const matchChannel = supabase
      .channel('matches-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches' },
        () => {
          fetchMatchesAndPredictions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(matchChannel);
    };
  }, [fetchMatchesAndPredictions]);

  // PandaScore Esports Auto-Sync:
  // - Runs only if user role is 'admin' (or super admin)
  // - Checks localStorage for 'last_pandascore_sync'
  // - If null OR older than 60 minutes, triggers background sync
  // - On successful sync, saves current timestamp to localStorage
  useEffect(() => {
    const userRole = profile?.role || (profile?.subscription_tier === 'admin' ? 'admin' : 'member');
    const isAdmin =
      profile?.role === 'admin' ||
      userRole === 'admin' ||
      user?.email?.toLowerCase() === 'erendjeagerist@gmail.com';

    if (!isAdmin) return;

    const SIXTY_MINUTES_MS = 60 * 60 * 1000;
    const lastSync = localStorage.getItem('last_pandascore_sync');
    const now = Date.now();

    let shouldSync = false;
    if (!lastSync) {
      shouldSync = true;
    } else {
      const parsedTime = Number(lastSync);
      const lastSyncTime = !isNaN(parsedTime) ? parsedTime : new Date(lastSync).getTime();
      if (isNaN(lastSyncTime) || now - lastSyncTime > SIXTY_MINUTES_MS) {
        shouldSync = true;
      }
    }

    if (shouldSync) {
      console.log('[Dashboard Auto-Sync] PandaScore matches sync initiated in background for admin...');
      setIsSyncing(true);
      syncPandaScoreMatches()
        .then((result) => {
          console.log('[Dashboard Auto-Sync] PandaScore sync succeeded:', result);
          const currentTimestamp = Date.now();
          localStorage.setItem('last_pandascore_sync', currentTimestamp.toString());
          setLastSyncTime(currentTimestamp);
          fetchMatchesAndPredictions();
        })
        .catch((err) => {
          console.error('[Dashboard Auto-Sync] PandaScore background sync error:', err);
        })
        .finally(() => {
          setIsSyncing(false);
        });
    }
  }, [user?.email, profile?.role, profile?.subscription_tier, fetchMatchesAndPredictions]);

  // Periodic ticker to keep the relative time (e.g. "X mins ago") up to date
  useEffect(() => {
    const updateTimeFromStorage = () => {
      setTicker((prev) => prev + 1);
      const stored = localStorage.getItem('last_pandascore_sync');
      if (stored) {
        const num = Number(stored);
        setLastSyncTime(!isNaN(num) ? num : new Date(stored).getTime());
      }
    };

    const interval = setInterval(updateTimeFromStorage, 30000);
    window.addEventListener('storage', updateTimeFromStorage);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', updateTimeFromStorage);
    };
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchMatchesAndPredictions();
  };

  // Filter logic
  const filteredMatches = matches.filter((m) => {
    if (statusFilter !== 'all' && m.status !== statusFilter) return false;
    if (selectedGame !== 'all' && m.game?.toLowerCase() !== selectedGame.toLowerCase()) return false;
    return true;
  });

  // Unique games list
  const availableGames = Array.from(new Set(matches.map((m) => m.game).filter(Boolean)));

  const liveCount = matches.filter((m) => m.status === 'live').length;
  const upcomingCount = matches.filter((m) => m.status === 'upcoming').length;

  return (
    <div className="min-h-screen bg-[#08090f] text-slate-100 flex flex-col">
      <TopNavigationBar isMobileView={isMobileView} setIsMobileView={setIsMobileView} />

      <main className={`flex-1 transition-all duration-300 mx-auto w-full px-4 sm:px-6 py-6 ${
        isMobileView ? 'max-w-md border-x border-slate-800 bg-[#0c0d16]/90 min-h-screen shadow-2xl' : 'max-w-7xl'
      }`}>
        {/* Hero Banner / Esports Companion Arena */}
        <div className="mb-6 p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-violet-950/40 via-[#0e101a] to-cyan-950/30 border border-violet-900/30 flex flex-col sm:flex-row sm:items-center justify-between gap-5 relative overflow-hidden shadow-xl">
          {/* Subtle neon glow orbs */}
          <div className="absolute -top-12 -left-12 w-48 h-48 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-gradient-to-r from-violet-950/80 to-indigo-950/80 border border-violet-500/40 text-violet-300 text-xs font-bold font-display tracking-wider uppercase">
                <Zap className="w-3.5 h-3.5 text-cyan-400" />
                <span>LIVE TOURNAMENT COMPANION</span>
              </span>
              {liveCount > 0 && (
                <span className="flex items-center gap-1.5 text-xs font-display text-rose-400 font-bold px-2 py-0.5 rounded-md bg-rose-950/40 border border-rose-500/30">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  {liveCount} LIVE NOW
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight font-display">
              Match Predictions & Arena
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-xl">
              Lock in your winner picks before match start, claim streaks, and earn points on every map.
            </p>
          </div>

          <div className="flex items-center gap-2.5 relative z-10 shrink-0">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2.5 rounded-xl bg-[#121422] hover:bg-[#181a2c] text-slate-300 border border-slate-800 transition flex items-center gap-2 text-xs font-bold font-display cursor-pointer"
              title="Refresh matches"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-cyan-400' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <Link
              to="/wrapped"
              className="px-3.5 py-2.5 rounded-xl bg-purple-950/60 hover:bg-purple-900/60 text-cyan-300 hover:text-white border border-purple-500/50 hover:border-cyan-400 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-purple-950/50 font-display uppercase tracking-wider transition cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-spin" style={{ animationDuration: '6s' }} />
              <span>Wrapped</span>
            </Link>
            <Link
              to="/polls"
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-violet-950/60 font-display uppercase tracking-wider transition border border-violet-400/30 cursor-pointer"
            >
              <span>View Live Polls</span>
              <span className="w-2 h-2 rounded-full bg-cyan-300 animate-pulse" />
            </Link>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-2 border-b border-indigo-950/50">
          {/* Status filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none font-display">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold tracking-wide uppercase transition cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-gradient-to-r from-violet-600 to-cyan-500 text-white shadow-md shadow-violet-950/50'
                  : 'bg-[#10121d] text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              All ({matches.length})
            </button>
            <button
              onClick={() => setStatusFilter('live')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold tracking-wide uppercase transition flex items-center gap-1.5 cursor-pointer ${
                statusFilter === 'live'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                  : 'bg-[#10121d] text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Radio className="w-3.5 h-3.5 text-rose-400" />
              <span>Live ({liveCount})</span>
            </button>
            <button
              onClick={() => setStatusFilter('upcoming')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold tracking-wide uppercase transition flex items-center gap-1.5 cursor-pointer ${
                statusFilter === 'upcoming'
                  ? 'bg-gradient-to-r from-violet-600 to-cyan-500 text-white shadow-md shadow-violet-950/50'
                  : 'bg-[#10121d] text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Upcoming ({upcomingCount})</span>
            </button>
            <button
              onClick={() => setStatusFilter('completed')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold tracking-wide uppercase transition flex items-center gap-1.5 cursor-pointer ${
                statusFilter === 'completed'
                  ? 'bg-slate-700 text-white'
                  : 'bg-[#10121d] text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Completed</span>
            </button>

            {/* Small status pill next to filters */}
            <div className="h-4 w-px bg-slate-800 mx-1 hidden sm:block" />
            {isSyncing ? (
              <div
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-cyan-950/50 border border-cyan-500/40 text-cyan-300 shadow-sm shadow-cyan-950/50 shrink-0 animate-pulse"
                title="PandaScore background auto-sync is currently running"
              >
                <RefreshCw className="w-3 h-3 text-cyan-400 animate-spin" />
                <span>Syncing...</span>
              </div>
            ) : (
              <div
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#10121d] border border-slate-800 text-slate-400 shrink-0"
                title={lastSyncTime ? `Last updated: ${new Date(lastSyncTime).toLocaleString()}` : 'No sync recorded yet'}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${lastSyncTime ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-slate-500'}`} />
                <span>Last synced: {formatRelativeTime(lastSyncTime)}</span>
              </div>
            )}
          </div>

          {/* Game filter chips */}
          {availableGames.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none font-display">
              <span className="text-xs font-bold text-slate-500 uppercase mr-1">Game:</span>
              <button
                onClick={() => setSelectedGame('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  selectedGame === 'all'
                    ? 'bg-violet-950/60 text-cyan-300 border border-cyan-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All
              </button>
              {availableGames.map((game) => (
                <button
                  key={game}
                  onClick={() => setSelectedGame(game)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                    selectedGame.toLowerCase() === game.toLowerCase()
                      ? 'bg-violet-950/60 text-cyan-300 border border-cyan-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {game}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Loading state */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-400 font-display">Loading Arena Matches...</p>
          </div>
        ) : filteredMatches.length === 0 ? (
          /* Empty state */
          <div className="bg-[#0e101a] border border-slate-800 rounded-2xl p-10 text-center max-w-lg mx-auto my-12 shadow-xl">
            <div className="w-14 h-14 rounded-2xl bg-[#141624] border border-slate-700/80 mx-auto mb-4 flex items-center justify-center text-cyan-400 shadow-inner">
              <Clock className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2 font-display">No Matches Found</h3>
            <p className="text-slate-400 text-xs sm:text-sm mb-6">
              {matches.length === 0
                ? 'Your Supabase "matches" table does not have any matches loaded yet.'
                : 'No matches match the selected filters.'}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              {matches.length === 0 && (
                <Link
                  to="/admin"
                  className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-violet-950/50 font-display uppercase tracking-wider transition border border-violet-400/30"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Go to Admin Panel to Add Matches</span>
                </Link>
              )}
              {matches.length > 0 && (
                <button
                  onClick={() => {
                    setStatusFilter('all');
                    setSelectedGame('all');
                  }}
                  className="w-full sm:w-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs transition font-display cursor-pointer"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Match Cards Grid */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {filteredMatches.map((match) => {
              const userPred = predictions.find((p) => p.match_id === match.id);
              return (
                <MatchCard
                  key={match.id}
                  match={match}
                  userPrediction={userPred}
                  onPredictionUpdated={fetchMatchesAndPredictions}
                />
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

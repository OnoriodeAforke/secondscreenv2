import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import TopNavigationBar from '../components/TopNavigationBar';
import { supabase, withClockDriftRetry } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { Profile } from '../types/database';
import {
  Trophy,
  Crown,
  Medal,
  Flame,
  ArrowLeft,
  RefreshCw,
  Zap,
  User,
  Shield,
  Sparkles,
} from 'lucide-react';

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);

  // Fetch profiles sorted by points DESC
  const fetchLeaderboard = useCallback(async () => {
    try {
      const { data, error } = await withClockDriftRetry(() =>
        supabase
          .from('profiles')
          .select('*')
          .order('points', { ascending: false })
      );

      if (error) {
        console.error('Error fetching leaderboard profiles:', error);
        return;
      }

      setProfiles((data as Profile[]) || []);
    } catch (err) {
      console.error('Failed to load leaderboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();

    // Supabase realtime listener on profiles table
    const channel = supabase
      .channel('profiles-leaderboard-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => {
          fetchLeaderboard();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchLeaderboard]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchLeaderboard();
  };

  // Find logged-in user's rank
  const currentUserIndex = user
    ? profiles.findIndex((p) => p.id === user.id)
    : -1;
  const currentUserRank = currentUserIndex !== -1 ? currentUserIndex + 1 : null;
  const currentUserProfile =
    currentUserIndex !== -1 ? profiles[currentUserIndex] : null;

  // Podium users
  const top1 = profiles[0];
  const top2 = profiles[1];
  const top3 = profiles[2];

  // Helper for rank badge rendering
  const renderRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-300 via-amber-400 to-amber-600 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/30 text-sm">
          <Crown className="w-4 h-4 text-slate-950" />
        </div>
      );
    }
    if (rank === 2) {
      return (
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-slate-200 via-slate-300 to-slate-400 flex items-center justify-center text-slate-950 font-black shadow-md shadow-slate-400/20 text-sm">
          <Medal className="w-4 h-4 text-slate-950" />
        </div>
      );
    }
    if (rank === 3) {
      return (
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-600 via-amber-700 to-amber-800 flex items-center justify-center text-amber-100 font-black shadow-md shadow-amber-700/20 text-sm">
          <Medal className="w-4 h-4 text-amber-100" />
        </div>
      );
    }
    return (
      <div className="w-8 h-8 rounded-xl bg-[#141624] border border-slate-800 flex items-center justify-center text-slate-400 font-mono font-bold text-xs">
        #{rank}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#08090f] text-slate-100 flex flex-col">
      <TopNavigationBar isMobileView={isMobileView} setIsMobileView={setIsMobileView} />

      <main
        className={`flex-1 transition-all duration-300 mx-auto w-full px-4 sm:px-6 py-6 ${
          isMobileView
            ? 'max-w-md border-x border-slate-800 bg-[#0c0d16]/95 min-h-screen shadow-2xl'
            : 'max-w-5xl'
        }`}
      >
        {/* Navigation & Controls */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#0e101a] border border-slate-800 hover:border-violet-500/50 hover:text-cyan-300 text-slate-300 text-xs font-bold font-display uppercase tracking-wider transition group shadow-md"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>Back to Dashboard</span>
          </Link>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2.5 rounded-xl bg-[#121422] hover:bg-[#181a2c] text-slate-300 border border-slate-800 transition flex items-center gap-2 text-xs font-bold font-display cursor-pointer"
            title="Refresh leaderboard"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-cyan-400' : ''}`}
            />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        {/* Hero Banner */}
        <section className="mb-8 p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-violet-950/40 via-[#0e101a] to-cyan-950/30 border border-violet-900/30 relative overflow-hidden shadow-2xl">
          <div className="absolute -top-12 -left-12 w-56 h-56 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-12 -right-12 w-56 h-56 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-violet-950/80 border border-violet-500/40 text-violet-300 text-xs font-bold font-display tracking-wider uppercase">
                  <Trophy className="w-3.5 h-3.5 text-amber-400" />
                  <span>GLOBAL STANDINGS</span>
                </span>
                <span className="text-xs text-slate-400 font-display">
                  {profiles.length} Players Ranked
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight font-display">
                SecondScreen Leaderboard
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-xl font-display">
                Top predictors and live poll champions ranked by points and hot prediction streaks.
              </p>
            </div>

            {/* Current Logged In User Fast Stats Card */}
            {currentUserProfile && (
              <div className="shrink-0 p-4 rounded-2xl bg-gradient-to-r from-violet-950/70 to-cyan-950/60 border border-cyan-400/50 shadow-lg shadow-cyan-950/40 font-display">
                <div className="text-[11px] font-bold uppercase tracking-wider text-cyan-300 mb-1 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-cyan-400" />
                  <span>Your Current Standing</span>
                </div>
                <div className="flex items-center gap-4">
                  <div>
                    <div className="text-2xl font-black text-white">
                      #{currentUserRank}
                    </div>
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Rank</div>
                  </div>
                  <div className="h-7 w-px bg-slate-700/80" />
                  <div>
                    <div className="text-2xl font-black text-cyan-300 font-mono">
                      {currentUserProfile.points ?? 0}
                    </div>
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Points</div>
                  </div>
                  <div className="h-7 w-px bg-slate-700/80" />
                  <div>
                    <div className="text-2xl font-black text-purple-300 font-mono">
                      {currentUserProfile.current_streak ?? 0}d
                    </div>
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Streak</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* TOP 3 PODIUM SECTION (Gold, Silver, Bronze Highlights) */}
        {!loading && profiles.length >= 3 && (
          <section className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4 font-display">
            {/* Rank 2 (Silver) */}
            <div className="order-2 md:order-1 p-5 rounded-2xl bg-[#0e101a] border border-slate-700/80 relative overflow-hidden shadow-xl flex flex-col justify-between items-center text-center">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-slate-400 to-slate-200" />
              <div className="flex items-center gap-2 mb-3">
                <span className="w-6 h-6 rounded-lg bg-slate-300 text-slate-950 text-xs font-black flex items-center justify-center">
                  #2
                </span>
                <span className="text-xs uppercase font-bold text-slate-300 tracking-wider">
                  Silver Medal
                </span>
              </div>
              <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border-2 border-slate-400/80 flex items-center justify-center text-3xl shadow-inner mb-2">
                {top2.avatar || '⚡'}
              </div>
              <div className="font-bold text-base text-white truncate max-w-full">
                {top2.username || 'Anonymous Player'}
              </div>
              <div className="mt-3 flex items-center gap-3">
                <span className="px-3 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 font-mono font-bold text-sm">
                  {top2.points ?? 0} PTS
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-purple-950/60 border border-purple-500/40 text-purple-300 font-mono font-bold text-xs">
                  ⚡ {top2.current_streak ?? 0}d
                </span>
              </div>
            </div>

            {/* Rank 1 (Gold) */}
            <div className="order-1 md:order-2 p-6 rounded-2xl bg-gradient-to-b from-[#141324] via-[#10111f] to-[#0e101a] border-2 border-amber-400/80 relative overflow-hidden shadow-2xl shadow-amber-500/10 flex flex-col justify-between items-center text-center transform md:-translate-y-2">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500" />
              <div className="flex items-center gap-2 mb-3">
                <Crown className="w-5 h-5 text-amber-400 animate-bounce" />
                <span className="text-xs uppercase font-black text-amber-300 tracking-widest">
                  Grand Champion (#1)
                </span>
              </div>
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500/20 to-yellow-600/10 border-2 border-amber-400 flex items-center justify-center text-4xl shadow-xl shadow-amber-500/20 mb-2">
                {top1.avatar || '👑'}
              </div>
              <div className="font-black text-lg text-white truncate max-w-full">
                {top1.username || 'Arena Master'}
              </div>
              <div className="mt-3 flex items-center gap-3">
                <span className="px-3.5 py-1.5 rounded-xl bg-amber-500/20 border border-amber-400/60 text-amber-300 font-mono font-black text-base shadow-sm">
                  {top1.points ?? 0} PTS
                </span>
                <span className="px-3 py-1.5 rounded-xl bg-purple-950/80 border border-purple-500/40 text-purple-300 font-mono font-bold text-xs">
                  ⚡ {top1.current_streak ?? 0}d
                </span>
              </div>
            </div>

            {/* Rank 3 (Bronze) */}
            <div className="order-3 md:order-3 p-5 rounded-2xl bg-[#0e101a] border border-amber-700/60 relative overflow-hidden shadow-xl flex flex-col justify-between items-center text-center">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-700 to-amber-600" />
              <div className="flex items-center gap-2 mb-3">
                <span className="w-6 h-6 rounded-lg bg-amber-700 text-amber-100 text-xs font-black flex items-center justify-center">
                  #3
                </span>
                <span className="text-xs uppercase font-bold text-amber-400 tracking-wider">
                  Bronze Medal
                </span>
              </div>
              <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border-2 border-amber-700/80 flex items-center justify-center text-3xl shadow-inner mb-2">
                {top3.avatar || '⚡'}
              </div>
              <div className="font-bold text-base text-white truncate max-w-full">
                {top3.username || 'Anonymous Player'}
              </div>
              <div className="mt-3 flex items-center gap-3">
                <span className="px-3 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 font-mono font-bold text-sm">
                  {top3.points ?? 0} PTS
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-purple-950/60 border border-purple-500/40 text-purple-300 font-mono font-bold text-xs">
                  ⚡ {top3.current_streak ?? 0}d
                </span>
              </div>
            </div>
          </section>
        )}

        {/* FULL LEADERBOARD TABLE */}
        <section className="bg-[#0e101a] border border-violet-900/30 rounded-3xl p-5 sm:p-6 shadow-2xl font-display">
          <div className="flex items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-800/80">
            <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-wider">
              Player Rankings
            </h3>
            <span className="text-xs text-slate-400 font-medium">
              Sorted by Points (DESC)
            </span>
          </div>

          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-400">Loading standings...</p>
            </div>
          ) : profiles.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              No profiles registered in the database yet.
            </div>
          ) : (
            <div className="space-y-2.5">
              {profiles.map((profile, index) => {
                const rank = index + 1;
                const isCurrentUser = user?.id === profile.id;
                const isTop1 = rank === 1;
                const isTop2 = rank === 2;
                const isTop3 = rank === 3;

                return (
                  <div
                    key={profile.id}
                    className={`flex items-center justify-between p-3.5 sm:p-4 rounded-2xl border transition-all duration-200 ${
                      isCurrentUser
                        ? 'bg-gradient-to-r from-violet-950/60 via-[#13162b] to-cyan-950/50 border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.3)] ring-1 ring-cyan-400/50'
                        : isTop1
                        ? 'bg-[#151322] border-amber-500/50 hover:bg-[#1a172c]'
                        : isTop2
                        ? 'bg-[#121422] border-slate-600/50 hover:bg-[#16182a]'
                        : isTop3
                        ? 'bg-[#121422] border-amber-800/50 hover:bg-[#16182a]'
                        : 'bg-[#10121e]/80 border-slate-800/80 hover:border-slate-700 hover:bg-[#131526]'
                    }`}
                  >
                    {/* Left: Rank & Player info */}
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                      {/* Rank Medal / Number */}
                      <div className="shrink-0">{renderRankBadge(rank)}</div>

                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700/80 flex items-center justify-center text-xl shrink-0 shadow-inner">
                        {profile.avatar || '⚡'}
                      </div>

                      {/* Username + Current User Chip */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-bold text-sm sm:text-base truncate ${
                              isCurrentUser
                                ? 'text-cyan-200'
                                : isTop1
                                ? 'text-amber-200'
                                : 'text-white'
                            }`}
                          >
                            {profile.username || 'Anonymous Player'}
                          </span>
                          {isCurrentUser && (
                            <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 text-slate-950 text-[10px] font-black uppercase tracking-wider shrink-0 shadow-sm">
                              YOU
                            </span>
                          )}
                        </div>

                        {profile.region && (
                          <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
                            {profile.region}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Points & Streak */}
                    <div className="flex items-center gap-3 sm:gap-6 shrink-0">
                      {/* Streak */}
                      <div className="text-right">
                        <div className="text-xs sm:text-sm font-bold text-purple-300 font-mono flex items-center justify-end gap-1">
                          <span className="text-[11px]">⚡</span>
                          <span>{profile.current_streak ?? 0}d</span>
                        </div>
                        <div className="text-[10px] text-slate-500 uppercase font-semibold">
                          Streak
                        </div>
                      </div>

                      {/* Points */}
                      <div className="text-right min-w-[70px]">
                        <div
                          className={`text-base sm:text-lg font-black font-mono ${
                            isCurrentUser
                              ? 'text-cyan-300'
                              : isTop1
                              ? 'text-amber-300'
                              : 'text-white'
                          }`}
                        >
                          {profile.points ?? 0}
                        </div>
                        <div className="text-[10px] text-slate-500 uppercase font-semibold">
                          PTS
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

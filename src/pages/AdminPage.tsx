import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, Navigate } from 'react-router-dom';
import TopNavigationBar from '../components/TopNavigationBar';
import { supabase, withClockDriftRetry } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { Match, Prediction, Profile, Poll } from '../types/database';
import { syncGlobalEsportsMatches, type SyncResult } from '../lib/pandascore';
import {
  Shield,
  PlusCircle,
  Trophy,
  CheckCircle2,
  AlertCircle,
  Clock,
  Radio,
  ArrowLeft,
  RefreshCw,
  X,
  Zap,
  Users,
  Vote,
  ExternalLink,
  Flame,
  ShieldAlert,
  UserCog,
  ShieldCheck,
  UserX,
  Crown,
  Lock,
  User,
  Search,
  Globe,
  Download,
  Layers,
} from 'lucide-react';

export default function AdminPage() {
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'all' | 'users' | 'matches' | 'polls'>('all');
  const [matches, setMatches] = useState<Match[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [roleMessage, setRoleMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);

  // PandaScore Esports Match Sync State
  const [syncingPandaScore, setSyncingPandaScore] = useState(false);
  const [syncProgressText, setSyncProgressText] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Access permissions: role is 'admin' OR email is 'erendjeagerist@gmail.com'
  const SUPER_ADMIN_EMAIL = 'erendjeagerist@gmail.com';
  const isSuperAdmin = user?.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
  const userRole = profile?.role || (profile?.subscription_tier === 'admin' ? 'admin' : 'member');
  const isAdmin = isSuperAdmin || userRole === 'admin';

  // Match Creation Form State
  const [game, setGame] = useState('Valorant');
  const [tournament, setTournament] = useState('VCT Champions 2026');
  const [teamAName, setTeamAName] = useState('');
  const [teamAShort, setTeamAShort] = useState('');
  const [teamALogo, setTeamALogo] = useState('🦅');
  const [teamBName, setTeamBName] = useState('');
  const [teamBShort, setTeamBShort] = useState('');
  const [teamBLogo, setTeamBLogo] = useState('🐉');
  const [format, setFormat] = useState('BO3');
  const [startTime, setStartTime] = useState(() => {
    const d = new Date(Date.now() + 2 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 16);
  });
  const [creatingMatch, setCreatingMatch] = useState(false);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Poll Creation Form State
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [pollMatchId, setPollMatchId] = useState('');
  const [creatingPoll, setCreatingPoll] = useState(false);
  const [pollSuccess, setPollSuccess] = useState<string | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);

  // Poll Dynamic Option Handlers
  const handleAddPollOption = () => {
    setPollOptions((prev) => [...prev, '']);
  };

  const handleRemovePollOption = (indexToRemove: number) => {
    if (pollOptions.length <= 2) return;
    setPollOptions((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handlePollOptionChange = (index: number, value: string) => {
    setPollOptions((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  // Set Winner Modal State
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [scoreA, setScoreA] = useState(2);
  const [scoreB, setScoreB] = useState(1);
  const [resolvingWinner, setResolvingWinner] = useState(false);
  const [scoringResult, setScoringResult] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);

  // Fetch all matches from Supabase
  const fetchMatches = useCallback(async () => {
    try {
      const { data, error } = await withClockDriftRetry(() =>
        supabase
          .from('matches')
          .select('*')
          .order('created_at', { ascending: false })
      );

      if (error) {
        console.error('Error fetching matches in admin:', error);
        return;
      }

      setMatches((data as Match[]) || []);
    } catch (err) {
      console.error('Failed to load admin matches:', err);
    }
  }, []);

  // Fetch all polls from Supabase
  const fetchPolls = useCallback(async () => {
    try {
      const { data, error } = await withClockDriftRetry(() =>
        supabase
          .from('polls')
          .select('*')
          .order('created_at', { ascending: false })
      );

      if (error) {
        console.error('Error fetching polls in admin:', error);
        return;
      }

      setPolls((data as Poll[]) || []);
    } catch (err) {
      console.error('Failed to load admin polls:', err);
    }
  }, []);

  // Fetch all profiles from Supabase for role management
  const fetchProfiles = useCallback(async () => {
    try {
      const { data, error } = await withClockDriftRetry(() =>
        supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false })
      );

      if (error) {
        console.error('Error fetching member profiles in admin:', error);
        return;
      }

      setAllProfiles((data as Profile[]) || []);
    } catch (err) {
      console.error('Failed to load member profiles:', err);
    }
  }, []);

  // Update member role between 'admin', 'streamer', and 'member' in profiles table
  const handleUpdateRole = async (targetProfile: Profile, newRole: 'admin' | 'streamer' | 'member') => {
    setUpdatingUserId(targetProfile.id);
    setRoleMessage(null);
    try {
      const updatePayload: Record<string, any> = {
        role: newRole,
        subscription_tier: newRole,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', targetProfile.id);

      if (error) {
        if (error.code === '42703' || error.message?.includes('column "role"')) {
          const fallback = await supabase
            .from('profiles')
            .update({
              subscription_tier: newRole,
              updated_at: new Date().toISOString(),
            })
            .eq('id', targetProfile.id);
          if (fallback.error) throw fallback.error;
        } else {
          throw error;
        }
      }

      setRoleMessage(
        `Updated role for "${targetProfile.username || 'User'}" to ${
          newRole === 'admin' ? 'Admin 🛡️' : newRole === 'streamer' ? 'Streamer / Creator 🎙️' : 'Member 👤'
        } successfully.`
      );

      setAllProfiles((prev) =>
        prev.map((p) =>
          p.id === targetProfile.id
            ? { ...p, role: newRole, subscription_tier: newRole }
            : p
        )
      );

      await refreshProfile();
    } catch (err: any) {
      console.error('Error updating member role:', err);
      setRoleMessage(`Failed to update role: ${err.message}`);
    } finally {
      setUpdatingUserId(null);
    }
  };

  // Filtered users by username or role
  const filteredProfiles = useMemo(() => {
    if (!searchQuery.trim()) return allProfiles;
    const q = searchQuery.toLowerCase().trim();
    return allProfiles.filter((p) => {
      const usernameMatch = p.username ? p.username.toLowerCase().includes(q) : false;
      const idMatch = p.id ? p.id.toLowerCase().includes(q) : false;
      const roleMatch = (p.role || p.subscription_tier || 'member').toLowerCase().includes(q);
      return usernameMatch || idMatch || roleMatch;
    });
  }, [allProfiles, searchQuery]);

  // Load all admin data
  const loadData = useCallback(async () => {
    await Promise.all([fetchMatches(), fetchPolls(), fetchProfiles()]);
    setLoading(false);
    setRefreshing(false);
  }, [fetchMatches, fetchPolls, fetchProfiles]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Manually sync upcoming esports matches from 8 PandaScore endpoints into Supabase
  // Respects 200ms delay and avoids database bloat (?page[size]=10).
  // Note: Runs ONLY upon manual button click; never on an automated timer.
  const handleSyncPandaScore = async () => {
    setSyncingPandaScore(true);
    setSyncProgressText('Connecting to PandaScore API for 8 esports games...');
    setSyncResult(null);
    setSyncError(null);

    try {
      const result = await syncGlobalEsportsMatches((progressText) => {
        setSyncProgressText(progressText);
      });
      setSyncResult(result);
      localStorage.setItem('last_pandascore_sync', Date.now().toString());
      await fetchMatches();
    } catch (err: any) {
      console.error('Failed to sync PandaScore matches:', err);
      setSyncError(err.message || 'Failed to sync matches from PandaScore.');
    } finally {
      setSyncingPandaScore(false);
      setSyncProgressText(null);
    }
  };

  // Create new match in Supabase
  const handleCreateMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!teamAName.trim() || !teamBName.trim()) {
      setFormError('Please enter both Team A and Team B names.');
      return;
    }

    setCreatingMatch(true);

    try {
      const newId = `match-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
      const teamAId = `team-${teamAName.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'a'}`;
      const teamBId = `team-${teamBName.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'b'}`;

      const newMatch: Partial<Match> = {
        id: newId,
        game: game.trim(),
        tournament: tournament.trim(),
        status: 'upcoming',
        start_time: new Date(startTime).toISOString(),
        team_a_id: teamAId,
        team_a_name: teamAName.trim(),
        team_a_short: teamAShort.trim() || teamAName.slice(0, 3).toUpperCase(),
        team_a_logo: teamALogo.trim() || '🦅',
        team_a_region: 'Global',
        team_a_winrate: 65,
        team_b_id: teamBId,
        team_b_name: teamBName.trim(),
        team_b_short: teamBShort.trim() || teamBName.slice(0, 3).toUpperCase(),
        team_b_logo: teamBLogo.trim() || '🐉',
        team_b_region: 'Global',
        team_b_winrate: 60,
        score_a: 0,
        score_b: 0,
        winner_id: null,
        format: format,
        total_predictions: 0,
        odds_a: 1.85,
        odds_b: 1.95,
        created_at: new Date().toISOString(),
      };

      const { error: insertError } = await supabase
        .from('matches')
        .insert(newMatch);

      if (insertError) {
        throw insertError;
      }

      setFormSuccess(`Match created: ${teamAName} vs ${teamBName} (${game})!`);
      setTeamAName('');
      setTeamAShort('');
      setTeamBName('');
      setTeamBShort('');
      await fetchMatches();
    } catch (err: any) {
      console.error('Match creation error:', err);
      setFormError(err.message || 'Failed to create match in Supabase.');
    } finally {
      setCreatingMatch(false);
    }
  };

  // Create new poll in Supabase
  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    setPollError(null);
    setPollSuccess(null);

    if (!pollQuestion.trim()) {
      setPollError('Please enter a Question for the poll.');
      return;
    }

    if (pollOptions.length < 2) {
      setPollError('A poll must have at least 2 options.');
      return;
    }

    const hasEmptyOption = pollOptions.some((opt) => !opt.trim());
    if (hasEmptyOption) {
      setPollError('Please provide text for all options (or remove unused ones).');
      return;
    }

    setCreatingPoll(true);

    try {
      const pollId = `poll-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const formattedOptions = pollOptions.map((text, idx) => ({
        id: `opt-${idx + 1}`,
        text: text.trim(),
        votes: 0,
      }));

      const newPoll = {
        id: pollId,
        question: pollQuestion.trim(),
        options: formattedOptions,
        is_live: true,
        expires_at: expiresAt,
        total_votes: 0,
        bonus_points: 10,
        created_at: new Date().toISOString(),
        match_id: pollMatchId.trim() || null,
      };

      const { error: insertError } = await supabase
        .from('polls')
        .insert(newPoll);

      if (insertError) {
        throw insertError;
      }

      setPollSuccess(
        `Poll launched successfully! "${pollQuestion.trim()}" is now live with ${formattedOptions.length} options.`
      );
      setPollQuestion('');
      setPollOptions(['', '']);
      setPollMatchId('');
      await fetchPolls();
    } catch (err: any) {
      console.error('Poll creation error:', err);
      setPollError(err.message || 'Failed to launch poll in Supabase.');
    } finally {
      setCreatingPoll(false);
    }
  };

  // Open "Set Winner" dialog
  const openSetWinnerModal = (match: Match) => {
    setSelectedMatch(match);
    setResolveError(null);
    setScoringResult(null);

    if (match.format === 'BO1') {
      setScoreA(1);
      setScoreB(0);
    } else if (match.format === 'BO5') {
      setScoreA(3);
      setScoreB(1);
    } else {
      setScoreA(2);
      setScoreB(1);
    }
  };

  // Execute Winner Selection & Score Predictions
  const handleConfirmWinner = async (winningTeamId: string) => {
    if (!selectedMatch) return;

    setResolvingWinner(true);
    setResolveError(null);
    setScoringResult(null);

    const matchId = selectedMatch.id;
    const isTeamAWinner = winningTeamId === selectedMatch.team_a_id;
    const finalScoreA = isTeamAWinner
      ? Math.max(scoreA, scoreB)
      : Math.min(scoreA, scoreB);
    const finalScoreB = isTeamAWinner
      ? Math.min(scoreA, scoreB)
      : Math.max(scoreA, scoreB);

    try {
      // 1. Update Match status to 'completed' and set winner_id
      const { error: matchUpdateError } = await supabase
        .from('matches')
        .update({
          status: 'completed',
          winner_id: winningTeamId,
          score_a: finalScoreA,
          score_b: finalScoreB,
        })
        .eq('id', matchId);

      if (matchUpdateError) {
        throw matchUpdateError;
      }

      // 2. Fetch all predictions for this match
      const { data: predictionsData, error: predFetchError } = await supabase
        .from('predictions')
        .select('*')
        .eq('match_id', matchId);

      if (predFetchError) {
        throw predFetchError;
      }

      const matchPredictions = (predictionsData as Prediction[]) || [];
      let correctCount = 0;
      let incorrectCount = 0;

      // 3. Score every prediction immediately
      for (const pred of matchPredictions) {
        const isCorrect = pred.predicted_team_id === winningTeamId;

        if (isCorrect) {
          correctCount++;

          await supabase
            .from('predictions')
            .update({
              is_correct: true,
              points_awarded: 5,
              updated_at: new Date().toISOString(),
            })
            .eq('id', pred.id);

          const { data: userProfile } = await supabase
            .from('profiles')
            .select('points, correct_predictions')
            .eq('id', pred.user_id)
            .maybeSingle();

          if (userProfile) {
            await supabase
              .from('profiles')
              .update({
                points: (userProfile.points || 0) + 5,
                correct_predictions: (userProfile.correct_predictions || 0) + 1,
                updated_at: new Date().toISOString(),
              })
              .eq('id', pred.user_id);
          }
        } else {
          incorrectCount++;

          await supabase
            .from('predictions')
            .update({
              is_correct: false,
              points_awarded: 0,
              updated_at: new Date().toISOString(),
            })
            .eq('id', pred.id);
        }
      }

      const winnerName =
        winningTeamId === selectedMatch.team_a_id
          ? selectedMatch.team_a_name
          : selectedMatch.team_b_name;

      setScoringResult(
        `Winner set: ${winnerName}! Scored ${matchPredictions.length} predictions: ${correctCount} correct (+5 PTS awarded to profiles), ${incorrectCount} incorrect.`
      );

      await fetchMatches();
      await refreshProfile();
    } catch (err: any) {
      console.error('Error resolving match winner:', err);
      setResolveError(err.message || 'Failed to complete match and score predictions.');
    } finally {
      setResolvingWinner(false);
    }
  };

  // Loading state while checking user session
  if (authLoading || (loading && !profile && !isSuperAdmin)) {
    return (
      <div className="min-h-screen bg-[#08090f] text-slate-100 flex flex-col">
        <TopNavigationBar isMobileView={isMobileView} setIsMobileView={setIsMobileView} />
        <main className="flex-1 flex flex-col items-center justify-center py-24 gap-3 font-display">
          <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-400 uppercase tracking-wider font-bold">
            Verifying Administrator Privileges...
          </p>
        </main>
      </div>
    );
  }

  // Access control check: Only users with role 'admin' OR email 'erendjeagerist@gmail.com' are allowed.
  // If not admin, redirect directly to dashboard.
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-[#08090f] text-slate-100 flex flex-col">
      <TopNavigationBar isMobileView={isMobileView} setIsMobileView={setIsMobileView} />

      <main
        className={`flex-1 transition-all duration-300 mx-auto w-full px-4 sm:px-6 py-6 ${
          isMobileView
            ? 'max-w-md border-x border-slate-800 bg-[#0c0d16]/95 min-h-screen shadow-2xl'
            : 'max-w-6xl'
        }`}
      >
        {/* Navigation & Controls */}
        <div className="mb-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#0e101a] border border-slate-800 hover:border-violet-500/50 hover:text-cyan-300 text-slate-300 text-xs font-bold font-display uppercase tracking-wider transition group shadow-md"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>Back to Dashboard</span>
          </Link>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Sync Global Esports Matches Button */}
            <button
              type="button"
              onClick={handleSyncPandaScore}
              disabled={syncingPandaScore}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 via-indigo-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 text-white font-bold text-xs uppercase tracking-wider transition flex items-center gap-2 shadow-md shadow-cyan-950/40 border border-cyan-400/40 cursor-pointer disabled:opacity-50"
              title="Manual sync: fetch upcoming matches for 8 esports from PandaScore into Supabase"
            >
              {syncingPandaScore ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Globe className="w-3.5 h-3.5 text-cyan-200" />
              )}
              <span>{syncingPandaScore ? 'Syncing...' : 'Sync Global Esports Matches'}</span>
            </button>

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2.5 rounded-xl bg-[#121422] hover:bg-[#181a2c] text-slate-300 border border-slate-800 transition flex items-center gap-2 text-xs font-bold font-display cursor-pointer"
              title="Refresh active matches and polls"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-cyan-400' : ''}`}
              />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* PANDASCORE SYNC STATUS & RESULTS BANNER */}
        {syncingPandaScore && (
          <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-cyan-950/70 via-[#101326] to-violet-950/70 border border-cyan-500/50 shadow-xl font-display flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin shrink-0" />
              <div>
                <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider block">
                  PandaScore Live Sync In Progress
                </span>
                <span className="text-xs text-slate-300 font-mono">
                  {syncProgressText || 'Fetching esports endpoints...'}
                </span>
              </div>
            </div>
            <div className="text-[11px] text-slate-400 font-mono bg-[#090b14] px-2.5 py-1 rounded-lg border border-slate-800">
              Rate Limit Protection: 200ms delay & 10 matches/game
            </div>
          </div>
        )}

        {syncError && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-950/60 border border-rose-500/60 text-rose-200 text-xs font-display flex items-start justify-between gap-3 shadow-lg">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-rose-300 uppercase tracking-wider block mb-0.5">
                  PandaScore Sync Failed
                </span>
                <p className="text-slate-200">{syncError}</p>
                <p className="text-[11px] text-rose-300/80 mt-1">
                  Ensure <code className="bg-rose-900/50 px-1 py-0.5 rounded">VITE_PANDASCORE_API_KEY</code> is correctly set in your environment.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSyncError(null)}
              className="p-1 rounded-lg hover:bg-rose-900/40 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {syncResult && (
          <div className="mb-6 p-5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-[#0e121e] to-cyan-950/40 border border-emerald-500/50 shadow-xl font-display">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    PandaScore Sync Completed
                  </h3>
                  <p className="text-xs text-slate-300">
                    Fetched <strong>{syncResult.totalFetched}</strong> matches across 8 esports titles. Inserted <strong className="text-emerald-400">{syncResult.newInserted} new</strong> matches into Supabase ({syncResult.skippedExisting} already existed).
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSyncResult(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Game Breakdown Chips */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800/80">
              {syncResult.gameSummaries.map((summary) => (
                <div
                  key={summary.game}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-mono flex items-center gap-1.5 border ${
                    summary.error
                      ? 'bg-rose-950/40 border-rose-800/50 text-rose-300'
                      : summary.inserted > 0
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                      : 'bg-[#121422] border-slate-800 text-slate-400'
                  }`}
                >
                  <span className="font-bold text-slate-200">{summary.game}:</span>
                  <span>{summary.fetched} fetched</span>
                  {summary.inserted > 0 && (
                    <span className="text-emerald-400 font-bold">+{summary.inserted} new</span>
                  )}
                  {summary.error && <span className="text-rose-400">({summary.error})</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ADMIN HEADER BANNER */}
        <section className="mb-8 p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-violet-950/40 via-[#0e101a] to-cyan-950/30 border border-violet-900/40 relative overflow-hidden shadow-2xl font-display">
          <div className="absolute -top-12 -left-12 w-56 h-56 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-12 -right-12 w-56 h-56 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-violet-950/90 border border-violet-500/50 text-violet-300 text-xs font-bold tracking-wider uppercase">
                  <Shield className="w-3.5 h-3.5 text-cyan-400" />
                  <span>ADMIN ARENA CONTROL</span>
                </span>
                <span className="text-xs text-emerald-400 font-bold px-2.5 py-0.5 rounded-md bg-emerald-950/40 border border-emerald-500/30">
                  Authorized Session
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">
                Match & Polls Management Panel
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-xl font-normal">
                Create esports matches, launch interactive live polls for viewers, and resolve match outcomes with automatic +5 PTS scoring.
              </p>
            </div>

            <div className="shrink-0 text-left sm:text-right text-xs text-slate-400">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">
                Signed In Admin
              </span>
              <span className="font-mono text-cyan-300 font-semibold">{user?.email}</span>
            </div>
          </div>
        </section>

        {/* TAB SWITCHER */}
        <div className="flex flex-wrap items-center gap-2 mb-8 font-display border-b border-indigo-950/60 pb-3">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
              activeTab === 'all'
                ? 'bg-gradient-to-r from-violet-600 to-cyan-500 text-white shadow-md shadow-violet-950/50'
                : 'bg-[#10121d] text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            All Controls
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'users'
                ? 'bg-gradient-to-r from-violet-600 to-cyan-500 text-white shadow-md shadow-violet-950/50'
                : 'bg-[#10121d] text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <UserCog className="w-3.5 h-3.5 text-cyan-400" />
            <span>User Management ({allProfiles.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('matches')}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'matches'
                ? 'bg-gradient-to-r from-violet-600 to-cyan-500 text-white shadow-md shadow-violet-950/50'
                : 'bg-[#10121d] text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Trophy className="w-3.5 h-3.5 text-cyan-400" />
            <span>Matches ({matches.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('polls')}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'polls'
                ? 'bg-gradient-to-r from-violet-600 to-cyan-500 text-white shadow-md shadow-violet-950/50'
                : 'bg-[#10121d] text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Vote className="w-3.5 h-3.5 text-cyan-400" />
            <span>Live Polls ({polls.length})</span>
          </button>
        </div>

        {/* SECTION: USER MANAGEMENT (ROLE-BASED ACCESS CONTROL) */}
        {(activeTab === 'all' || activeTab === 'users') && (
          <section className="bg-[#0e101a] border border-cyan-900/40 rounded-3xl p-6 sm:p-8 mb-8 shadow-xl font-display relative overflow-hidden">
            <div className="absolute top-0 right-0 w-56 h-56 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800/80 relative z-10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-violet-950/80 border border-violet-500/40 text-violet-300">
                  <UserCog className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white uppercase tracking-wider">
                    User Management
                  </h2>
                  <p className="text-xs text-slate-400 font-normal">
                    Manage member roles and administrative access. Users can be assigned as <strong>member</strong> or <strong>admin</strong>.
                  </p>
                </div>
              </div>

              <div className="text-xs font-mono text-cyan-300 px-3 py-1.5 rounded-xl bg-[#141628] border border-slate-800 self-start sm:self-auto flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5 text-amber-400" />
                <span>Super Admin: <strong className="text-white">{SUPER_ADMIN_EMAIL}</strong></span>
              </div>
            </div>

            {/* Notification message */}
            {roleMessage && (
              <div className="mb-5 p-3 rounded-xl bg-cyan-950/50 border border-cyan-500/50 text-cyan-300 text-xs flex items-center gap-2 relative z-10">
                <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>{roleMessage}</span>
              </div>
            )}

            {/* Search Bar */}
            <div className="mb-6 relative z-10">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search users by username or user ID..."
                  className="w-full bg-[#121422] border border-slate-800 rounded-xl pl-10 pr-10 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 font-display transition"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-3 text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1.5 px-1 font-mono">
                <span>Showing {filteredProfiles.length} of {allProfiles.length} registered users</span>
                {searchQuery && (
                  <span className="text-cyan-400">Filtering by "{searchQuery}"</span>
                )}
              </div>
            </div>

            {/* Users Directory List */}
            {allProfiles.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-sm relative z-10">
                No users found in the database.
              </div>
            ) : filteredProfiles.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-sm relative z-10">
                No users match your search query "{searchQuery}".
              </div>
            ) : (
              <div className="space-y-3 relative z-10">
                {filteredProfiles.map((p) => {
                  const isUserOwner = p.id === user?.id && isSuperAdmin;
                  const currentRole = p.role || (p.subscription_tier === 'admin' ? 'admin' : 'member');
                  const isCurrentAdmin = currentRole === 'admin' || isUserOwner;
                  const isUpdating = updatingUserId === p.id;
                  const userEmail = p.id === user?.id ? user?.email : ((p as any).email || null);

                  return (
                    <div
                      key={p.id}
                      className={`p-4 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                        isUserOwner
                          ? 'bg-[#141628] border-amber-500/40 shadow-sm'
                          : isCurrentAdmin
                          ? 'bg-[#121626] border-cyan-500/40'
                          : 'bg-[#121422] border-slate-800 hover:border-slate-700/80'
                      }`}
                    >
                      {/* Left: Avatar & User details */}
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-[#181a2e] border border-slate-700/80 flex items-center justify-center text-xl shrink-0 shadow-inner overflow-hidden">
                          {p.avatar && (p.avatar.startsWith('http') || p.avatar.includes('/')) ? (
                            <img src={p.avatar} alt="Avatar" className="w-full h-full object-cover" />
                          ) : (
                            <span>{p.avatar || '👤'}</span>
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm truncate">
                              {p.username || 'Anonymous User'}
                            </span>
                            {isUserOwner ? (
                              <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-400/50 text-amber-300 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shrink-0">
                                <Crown className="w-3 h-3 text-amber-400" />
                                <span>Super Admin</span>
                              </span>
                            ) : isCurrentAdmin ? (
                              <span className="px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-400/40 text-cyan-300 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shrink-0">
                                <ShieldCheck className="w-3 h-3 text-cyan-400" />
                                <span>Admin</span>
                              </span>
                            ) : currentRole === 'streamer' ? (
                              <span className="px-2 py-0.5 rounded-full bg-fuchsia-950/80 border border-fuchsia-400/40 text-fuchsia-300 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shrink-0">
                                <Radio className="w-3 h-3 text-fuchsia-400 animate-pulse" />
                                <span>Streamer / Creator</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-slate-400 text-[10px] font-semibold uppercase tracking-wider shrink-0">
                                Member
                              </span>
                            )}
                          </div>

                          <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                            {userEmail ? (
                              <span className="text-cyan-300 font-semibold">{userEmail}</span>
                            ) : (
                              <span className="text-slate-500">ID: {p.id.slice(0, 8)}...</span>
                            )}
                            <span className="text-slate-600">·</span>
                            <span>{p.points ?? 0} PTS</span>
                            <span className="text-slate-600">·</span>
                            <span>{p.current_streak ?? 0}d streak</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Role Dropdown & Toggle Button */}
                      <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
                        {isUserOwner ? (
                          <span className="text-xs text-amber-300/80 font-bold px-3 py-1.5 rounded-xl bg-amber-950/30 border border-amber-900/40 flex items-center gap-1.5">
                            <Lock className="w-3.5 h-3.5 text-amber-400" />
                            <span>Owner (Permanent Admin)</span>
                          </span>
                        ) : (
                          <div className="flex items-center gap-2">
                            {/* Role Select Dropdown */}
                            <select
                              value={currentRole}
                              disabled={isUpdating}
                              onChange={(e) => handleUpdateRole(p, e.target.value as 'admin' | 'streamer' | 'member')}
                              className="bg-[#0e101a] border border-slate-700/80 hover:border-cyan-400/60 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 font-display font-semibold focus:outline-none focus:border-cyan-400 transition cursor-pointer disabled:opacity-50"
                            >
                              <option value="member">Role: Member</option>
                              <option value="streamer">Role: Streamer</option>
                              <option value="admin">Role: Admin</option>
                            </select>

                            {/* Quick Action Toggle Button */}
                            {isCurrentAdmin ? (
                              <button
                                type="button"
                                disabled={isUpdating}
                                onClick={() => handleUpdateRole(p, 'member')}
                                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 font-bold text-xs uppercase tracking-wider transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                                title="Demote to Member"
                              >
                                <UserX className="w-3.5 h-3.5 text-rose-400" />
                                <span className="hidden md:inline">{isUpdating ? '...' : 'Demote'}</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={isUpdating}
                                onClick={() => handleUpdateRole(p, 'admin')}
                                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 text-white font-bold text-xs uppercase tracking-wider transition shadow-sm border border-cyan-400/30 cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                                title="Promote to Admin"
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span className="hidden md:inline">{isUpdating ? '...' : 'Make Admin'}</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* SECTION: CREATE POLL FORM */}
        {(activeTab === 'all' || activeTab === 'polls') && (
          <section className="bg-[#0e101a] border border-cyan-900/40 rounded-3xl p-6 sm:p-8 mb-8 shadow-xl font-display relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center justify-between gap-3 mb-6 pb-3 border-b border-slate-800/80 relative z-10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-950/80 border border-cyan-500/40 text-cyan-300">
                  <Vote className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white uppercase tracking-wider">
                    Create Live Poll
                  </h2>
                  <p className="text-xs text-slate-400 font-normal">
                    Launch a 2-option real-time community poll active for 30 days.
                  </p>
                </div>
              </div>

              <Link
                to="/polls"
                className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-bold transition group"
              >
                <span>View Public Polls Arena</span>
                <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
              </Link>
            </div>

            <form onSubmit={handleCreatePoll} className="space-y-4 relative z-10">
              {/* Question Input */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Poll Question <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={pollQuestion}
                  onChange={(e) => setPollQuestion(e.target.value)}
                  placeholder="e.g. Who takes the first Roshan / Dragon in Game 2?"
                  className="w-full bg-[#121422] border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 transition font-display"
                />
              </div>

              {/* Dynamic Options List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                    Poll Options ({pollOptions.length}) <span className="text-rose-400">*</span>
                  </label>
                  <span className="text-[11px] text-slate-500 font-display">
                    Minimum 2 options required
                  </span>
                </div>

                <div className="space-y-2.5">
                  {pollOptions.map((optText, index) => {
                    const optNumber = index + 1;
                    const canRemove = pollOptions.length > 2;

                    return (
                      <div
                        key={index}
                        className="p-3 sm:p-3.5 rounded-2xl bg-[#121422]/90 border border-slate-800 flex items-center gap-3 transition focus-within:border-cyan-400/80"
                      >
                        <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700/80 text-cyan-300 font-mono font-bold text-xs shrink-0">
                          Option {optNumber}
                        </span>

                        <input
                          type="text"
                          required
                          value={optText}
                          onChange={(e) => handlePollOptionChange(index, e.target.value)}
                          placeholder={`Enter option ${optNumber} text...`}
                          className="flex-1 bg-transparent border-0 text-xs sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none font-display min-w-0"
                        />

                        {canRemove && (
                          <button
                            type="button"
                            onClick={() => handleRemovePollOption(index)}
                            title={`Remove Option ${optNumber}`}
                            className="p-2 rounded-xl bg-slate-900/80 border border-slate-700/80 text-slate-400 hover:text-rose-400 hover:border-rose-500/50 hover:bg-rose-950/30 transition cursor-pointer shrink-0"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* + Add Option Button */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleAddPollOption}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#141628] hover:bg-[#1a1d35] text-cyan-300 hover:text-cyan-200 border border-cyan-500/30 hover:border-cyan-400/60 font-display text-xs font-bold uppercase tracking-wider transition cursor-pointer shadow-sm"
                  >
                    <PlusCircle className="w-3.5 h-3.5 text-cyan-400" />
                    <span>+ Add Option</span>
                  </button>
                </div>
              </div>

              {/* Optional Match Link */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Link to Active Match (Optional)
                  </label>
                  <select
                    value={pollMatchId}
                    onChange={(e) => setPollMatchId(e.target.value)}
                    className="w-full bg-[#121422] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-400 font-display"
                  >
                    <option value="">— Standalone / General Arena Poll —</option>
                    {matches.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.team_a_name} vs {m.team_b_name} ({m.game})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end">
                  <div className="w-full p-2.5 rounded-xl bg-violet-950/30 border border-violet-900/40 text-violet-300 text-xs flex items-center gap-2">
                    <Clock className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>Expires automatically in <strong>30 days</strong> from launch.</span>
                  </div>
                </div>
              </div>

              {/* Launch Poll Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={creatingPoll}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-600 via-indigo-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-cyan-950/50 border border-cyan-400/40 cursor-pointer disabled:opacity-50 transition flex items-center gap-2"
                >
                  {creatingPoll ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Vote className="w-4 h-4" />
                      <span>Launch Poll</span>
                    </>
                  )}
                </button>
              </div>

              {/* Feedback messages */}
              {pollSuccess && (
                <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{pollSuccess}</span>
                </div>
              )}

              {pollError && (
                <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{pollError}</span>
                </div>
              )}
            </form>
          </section>
        )}

        {/* SECTION: LIVE POLLS DIRECTORY */}
        {(activeTab === 'all' || activeTab === 'polls') && (
          <section className="bg-[#0e101a] border border-violet-900/30 rounded-3xl p-6 sm:p-8 mb-8 shadow-xl font-display">
            <div className="flex items-center justify-between gap-4 mb-6 pb-3 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
                <h2 className="text-lg font-black text-white uppercase tracking-wider">
                  Active & Scheduled Polls
                </h2>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {polls.length} {polls.length === 1 ? 'Poll' : 'Polls'}
              </span>
            </div>

            {polls.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-sm">
                No polls in the database yet. Use the "Create Live Poll" form above to launch one.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {polls.map((poll) => {
                  const isExpired = poll.expires_at ? new Date(poll.expires_at) <= new Date() : false;
                  return (
                    <div
                      key={poll.id}
                      className="p-5 rounded-2xl bg-[#121422] border border-slate-800 flex flex-col justify-between gap-4"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              poll.is_live && !isExpired
                                ? 'bg-cyan-950/80 border border-cyan-500/40 text-cyan-300'
                                : 'bg-slate-900 border border-slate-800 text-slate-400'
                            }`}
                          >
                            {poll.is_live && !isExpired ? '● LIVE' : 'CLOSED'}
                          </span>

                          <span className="text-xs text-slate-400 font-mono">
                            {poll.total_votes || 0} votes
                          </span>
                        </div>

                        <h4 className="text-sm font-bold text-white mb-3">
                          {poll.question}
                        </h4>

                        <div className="space-y-1.5 text-xs text-slate-300">
                          {poll.options?.map((opt, i) => (
                            <div
                              key={opt.id || i}
                              className="px-3 py-1.5 rounded-lg bg-[#090a14] border border-slate-800/80 flex items-center justify-between"
                            >
                              <span className="truncate pr-2">{opt.text}</span>
                              <span className="text-slate-500 font-mono shrink-0">
                                {opt.votes ?? 0} votes
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px] text-slate-500">
                        <span>
                          Expires: {poll.expires_at ? new Date(poll.expires_at).toLocaleDateString() : '30 days'}
                        </span>
                        <Link
                          to="/polls"
                          className="text-cyan-400 hover:text-cyan-300 font-bold transition flex items-center gap-1"
                        >
                          <span>Vote Arena</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* SECTION: CREATE NEW MATCH FORM */}
        {(activeTab === 'all' || activeTab === 'matches') && (
          <section className="bg-[#0e101a] border border-violet-900/30 rounded-3xl p-6 sm:p-8 mb-8 shadow-xl font-display">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-800/80">
              <PlusCircle className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-black text-white uppercase tracking-wider">
                Create New Match
              </h2>
            </div>

            <form onSubmit={handleCreateMatch} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Game */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Game
                  </label>
                  <select
                    value={game}
                    onChange={(e) => setGame(e.target.value)}
                    className="w-full bg-[#121422] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-400 font-display"
                  >
                    <option value="Valorant">Valorant</option>
                    <option value="Dota 2">Dota 2</option>
                    <option value="CS2">Counter-Strike 2</option>
                    <option value="League of Legends">League of Legends</option>
                    <option value="Rocket League">Rocket League</option>
                    <option value="Overwatch 2">Overwatch 2</option>
                  </select>
                </div>

                {/* Tournament */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Tournament / League
                  </label>
                  <input
                    type="text"
                    required
                    value={tournament}
                    onChange={(e) => setTournament(e.target.value)}
                    placeholder="e.g. VCT Champions 2026"
                    className="w-full bg-[#121422] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-400 font-display"
                  />
                </div>

                {/* Format (BO1, BO3, BO5) */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Match Format
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {['BO1', 'BO3', 'BO5'].map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => setFormat(fmt)}
                        className={`py-2 text-xs font-bold rounded-lg uppercase tracking-wider transition cursor-pointer ${
                          format === fmt
                            ? 'bg-gradient-to-r from-violet-600 to-cyan-500 text-white shadow-md'
                            : 'bg-[#121422] text-slate-400 border border-slate-800'
                        }`}
                      >
                        {fmt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Teams Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {/* Team A Details */}
                <div className="p-4 rounded-2xl bg-[#121422]/80 border border-slate-800 space-y-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-cyan-300 block">
                    Team A (Home / Seed 1)
                  </span>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Team Name</label>
                    <input
                      type="text"
                      required
                      value={teamAName}
                      onChange={(e) => setTeamAName(e.target.value)}
                      placeholder="e.g. Sentinels"
                      className="w-full bg-[#090a14] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Tag (Short)</label>
                      <input
                        type="text"
                        value={teamAShort}
                        onChange={(e) => setTeamAShort(e.target.value)}
                        placeholder="e.g. SEN"
                        className="w-full bg-[#090a14] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-400 uppercase"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Logo / Emoji</label>
                      <input
                        type="text"
                        value={teamALogo}
                        onChange={(e) => setTeamALogo(e.target.value)}
                        placeholder="🦅 or URL"
                        className="w-full bg-[#090a14] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>
                </div>

                {/* Team B Details */}
                <div className="p-4 rounded-2xl bg-[#121422]/80 border border-slate-800 space-y-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-cyan-300 block">
                    Team B (Away / Seed 2)
                  </span>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Team Name</label>
                    <input
                      type="text"
                      required
                      value={teamBName}
                      onChange={(e) => setTeamBName(e.target.value)}
                      placeholder="e.g. Fnatic"
                      className="w-full bg-[#090a14] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Tag (Short)</label>
                      <input
                        type="text"
                        value={teamBShort}
                        onChange={(e) => setTeamBShort(e.target.value)}
                        placeholder="e.g. FNC"
                        className="w-full bg-[#090a14] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-400 uppercase"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Logo / Emoji</label>
                      <input
                        type="text"
                        value={teamBLogo}
                        onChange={(e) => setTeamBLogo(e.target.value)}
                        placeholder="🐉 or URL"
                        className="w-full bg-[#090a14] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Scheduled Time */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Scheduled Start Time
                </label>
                <input
                  type="datetime-local"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full sm:w-72 bg-[#121422] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
                />
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={creatingMatch}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-violet-950/50 border border-violet-400/30 cursor-pointer disabled:opacity-50 transition flex items-center gap-2"
                >
                  {creatingMatch ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <PlusCircle className="w-4 h-4" />
                      <span>Publish Match to Supabase Arena</span>
                    </>
                  )}
                </button>
              </div>

              {/* Feedback messages */}
              {formSuccess && (
                <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{formSuccess}</span>
                </div>
              )}

              {formError && (
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}
            </form>
          </section>
        )}

        {/* SECTION: ACTIVE MATCHES LIST & "SET WINNER" */}
        {(activeTab === 'all' || activeTab === 'matches') && (
          <section className="bg-[#0e101a] border border-violet-900/30 rounded-3xl p-6 sm:p-8 shadow-xl font-display">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-3 border-b border-slate-800/80">
              <div>
                <h2 className="text-lg font-black text-white uppercase tracking-wider">
                  All Active & Scheduled Matches
                </h2>
                <span className="text-xs text-slate-400 font-normal">
                  Click "Set Winner" to finalize matches and automatically score all predictions (+5 PTS).
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSyncPandaScore}
                  disabled={syncingPandaScore}
                  className="px-3 py-1.5 rounded-xl bg-[#141728] hover:bg-[#1a1e34] border border-cyan-500/40 text-cyan-300 font-bold text-xs uppercase tracking-wider transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-sm"
                  title="Manual sync: fetch upcoming matches for 8 esports from PandaScore into Supabase"
                >
                  {syncingPandaScore ? (
                    <div className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Globe className="w-3.5 h-3.5 text-cyan-400" />
                  )}
                  <span>Sync Global Esports Matches</span>
                </button>
                <span className="text-xs text-slate-400 font-mono">
                  {matches.length} Matches Total
                </span>
              </div>
            </div>

            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3">
                <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-slate-400">Loading arena matches...</p>
              </div>
            ) : matches.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                No matches found in the database. Use the form above to add one.
              </div>
            ) : (
              <div className="space-y-3">
                {matches.map((m) => {
                  const isLive = m.status === 'live';
                  const isCompleted = m.status === 'completed';
                  const isUpcoming = m.status === 'upcoming';

                  return (
                    <div
                      key={m.id}
                      className="p-4 sm:p-5 rounded-2xl bg-[#121422] border border-slate-800/90 hover:border-violet-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition"
                    >
                      {/* Match Info */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-violet-950/80 border border-violet-500/30 text-violet-300">
                            {m.game || 'Esports'} · {m.format || 'BO3'}
                          </span>

                          {isLive && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-950/80 border border-rose-500/50 text-rose-400 text-[10px] font-bold animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              LIVE ({m.score_a} - {m.score_b})
                            </span>
                          )}

                          {isUpcoming && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-cyan-400 text-[10px] font-bold">
                              <Clock className="w-3 h-3" />
                              Upcoming
                            </span>
                          )}

                          {isCompleted && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold">
                              <CheckCircle2 className="w-3 h-3" />
                              FINAL ({m.score_a} - {m.score_b})
                            </span>
                          )}
                        </div>

                        <div className="text-white font-black text-base sm:text-lg flex items-center gap-2 truncate">
                          <span>{m.team_a_name || m.team1 || 'Team 1'}</span>
                          <span className="text-slate-500 text-xs">VS</span>
                          <span>{m.team_b_name || m.team2 || 'Team 2'}</span>
                        </div>

                        <div className="text-xs text-slate-400 mt-1 flex items-center gap-3">
                          <span>{m.tournament}</span>
                          <span>·</span>
                          <span className="flex items-center gap-1 text-cyan-400">
                            <Zap className="w-3 h-3" />
                            <strong>{m.total_predictions ?? 0}</strong> picks
                          </span>
                        </div>
                      </div>

                      {/* Action Button: Set Winner */}
                      <div className="shrink-0 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openSetWinnerModal(m)}
                          className={`px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition flex items-center gap-2 cursor-pointer shadow-md ${
                            isCompleted
                              ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                              : 'bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 text-white shadow-violet-950/50 border border-violet-400/30'
                          }`}
                        >
                          <Trophy className="w-3.5 h-3.5 text-amber-300" />
                          <span>{isCompleted ? 'Re-set Winner' : 'Set Winner'}</span>
                        </button>

                        <Link
                          to={`/match/${m.id}`}
                          className="px-3 py-2.5 rounded-xl bg-[#090a14] border border-slate-800 text-slate-400 hover:text-white text-xs font-semibold transition"
                        >
                          View Arena
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* SET WINNER MODAL DIALOG */}
        {selectedMatch && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm font-display">
            <div className="w-full max-w-lg bg-[#0e101a] border border-violet-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl relative">
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setSelectedMatch(null)}
                className="absolute top-5 right-5 p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2 mb-3">
                <span className="p-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  <Trophy className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-lg font-black text-white uppercase">
                    Select Match Winner
                  </h3>
                  <p className="text-xs text-slate-400">
                    {selectedMatch.tournament} · {selectedMatch.game}
                  </p>
                </div>
              </div>

              {/* Match Header in Modal */}
              <div className="p-4 rounded-2xl bg-[#141628] border border-slate-800 text-center my-4">
                <div className="text-sm font-black text-white flex items-center justify-center gap-3">
                  <span className="text-cyan-300">{selectedMatch.team_a_name || selectedMatch.team1 || 'Team 1'}</span>
                  <span className="text-slate-500">vs</span>
                  <span className="text-purple-300">{selectedMatch.team_b_name || selectedMatch.team2 || 'Team 2'}</span>
                </div>
              </div>

              {/* Set Final Score inputs */}
              <div className="mb-5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Final Match Score ({selectedMatch.format || 'BO3'})
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-[#121422] border border-slate-800">
                    <span className="text-[11px] text-slate-400 block mb-1">
                      {selectedMatch.team_a_name || selectedMatch.team1 || 'Team 1'} Score
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={5}
                      value={scoreA}
                      onChange={(e) => setScoreA(parseInt(e.target.value) || 0)}
                      className="w-full bg-[#090a14] border border-slate-800 rounded-lg px-3 py-1.5 text-base font-bold text-white font-mono"
                    />
                  </div>
                  <div className="p-3 rounded-xl bg-[#121422] border border-slate-800">
                    <span className="text-[11px] text-slate-400 block mb-1">
                      {selectedMatch.team_b_name || selectedMatch.team2 || 'Team 2'} Score
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={5}
                      value={scoreB}
                      onChange={(e) => setScoreB(parseInt(e.target.value) || 0)}
                      className="w-full bg-[#090a14] border border-slate-800 rounded-lg px-3 py-1.5 text-base font-bold text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Automatic Scoring Explanation Warning */}
              <div className="mb-6 p-3 rounded-xl bg-violet-950/50 border border-violet-500/40 text-violet-200 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-cyan-300">
                  <Zap className="w-3.5 h-3.5" />
                  <span>Automatic Scoring Rule (+5 PTS):</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Selecting a winner updates match status to <code>completed</code> and scores all user predictions: winners get <strong>+5 PTS</strong> added to profile, losers get <strong>0 PTS</strong>.
                </p>
              </div>

              {/* Two Team Winner Buttons */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <button
                  type="button"
                  disabled={resolvingWinner}
                  onClick={() => handleConfirmWinner(selectedMatch.team_a_id || `team-1-${selectedMatch.id}`)}
                  className="p-4 rounded-2xl bg-[#141628] border-2 border-slate-700 hover:border-cyan-400 hover:bg-[#181a30] transition flex flex-col items-center gap-2 group cursor-pointer disabled:opacity-50"
                >
                  <span className="text-2xl">{selectedMatch.team_a_logo || '🦅'}</span>
                  <span className="font-black text-sm text-white group-hover:text-cyan-300 transition text-center truncate max-w-full">
                    {selectedMatch.team_a_name || selectedMatch.team1 || 'Team 1'}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-black uppercase tracking-wider">
                    Declare Winner
                  </span>
                </button>

                <button
                  type="button"
                  disabled={resolvingWinner}
                  onClick={() => handleConfirmWinner(selectedMatch.team_b_id || `team-2-${selectedMatch.id}`)}
                  className="p-4 rounded-2xl bg-[#141628] border-2 border-slate-700 hover:border-purple-400 hover:bg-[#181a30] transition flex flex-col items-center gap-2 group cursor-pointer disabled:opacity-50"
                >
                  <span className="text-2xl">{selectedMatch.team_b_logo || '🐉'}</span>
                  <span className="font-black text-sm text-white group-hover:text-purple-300 transition text-center truncate max-w-full">
                    {selectedMatch.team_b_name || selectedMatch.team2 || 'Team 2'}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-black uppercase tracking-wider">
                    Declare Winner
                  </span>
                </button>
              </div>

              {/* Status indicator */}
              {resolvingWinner && (
                <div className="py-2 text-center text-xs text-cyan-400 font-bold flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                  <span>Completing match and scoring predictions...</span>
                </div>
              )}

              {scoringResult && (
                <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2 mt-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{scoringResult}</span>
                </div>
              )}

              {resolveError && (
                <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2 mt-3">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{resolveError}</span>
                </div>
              )}

              {/* Close Button when done */}
              {scoringResult && (
                <button
                  type="button"
                  onClick={() => setSelectedMatch(null)}
                  className="w-full mt-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase tracking-wider cursor-pointer"
                >
                  Close Arbiter Dialog
                </button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

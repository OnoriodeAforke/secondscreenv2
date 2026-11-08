import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import TopNavigationBar from '../components/TopNavigationBar';
import PollCard from '../components/PollCard';
import { supabase } from '../lib/supabase';
import { updatePredictionStreak } from '../lib/streak';
import { useAuth } from '../context/AuthContext';
import type { Match, Prediction, Poll, PollVote } from '../types/database';
import {
  ArrowLeft,
  Clock,
  Radio,
  CheckCircle2,
  Lock,
  Trophy,
  Zap,
  Flame,
  AlertCircle,
  HelpCircle,
  Users,
  Shield,
  Award
} from 'lucide-react';

export default function MatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();

  const [match, setMatch] = useState<Match | null>(null);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [userPollVotes, setUserPollVotes] = useState<PollVote[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingPick, setSubmittingPick] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);
  const [pickSuccess, setPickSuccess] = useState<string | null>(null);
  const [isMobileView, setIsMobileView] = useState(false);

  // Fetch match details, predictions, and polls
  const fetchMatchData = useCallback(async () => {
    if (!id) return;

    try {
      // 1. Fetch match record
      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (matchError) throw matchError;
      setMatch(matchData as Match | null);

      if (matchData) {
        // 2. Fetch user's prediction for this match if authenticated
        if (user) {
          const { data: predData, error: predError } = await supabase
            .from('predictions')
            .select('*')
            .eq('user_id', user.id)
            .eq('match_id', id)
            .maybeSingle();

          if (!predError && predData) {
            setPrediction(predData as Prediction);
          } else {
            setPrediction(null);
          }
        }

        // 3. Fetch polls attached to this match
        const { data: pollsData, error: pollsError } = await supabase
          .from('polls')
          .select('*')
          .eq('match_id', id)
          .order('created_at', { ascending: false });

        if (!pollsError && pollsData) {
          setPolls(pollsData as Poll[]);

          // 4. Fetch user's votes on these polls
          if (user && pollsData.length > 0) {
            const pollIds = pollsData.map((p) => p.id);
            const { data: votesData } = await supabase
              .from('poll_votes')
              .select('*')
              .eq('user_id', user.id)
              .in('poll_id', pollIds);

            if (votesData) {
              setUserPollVotes(votesData as PollVote[]);
            }
          }
        }
      }
    } catch (err: any) {
      console.error('Error loading match details:', err);
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => {
    fetchMatchData();

    if (!id) return;

    // Realtime subscription for this match & polls
    const channel = supabase
      .channel(`match-detail-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches', filter: `id=eq.${id}` },
        () => {
          fetchMatchData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'polls', filter: `match_id=eq.${id}` },
        () => {
          fetchMatchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, fetchMatchData]);

  // Handle predicting a team
  const handleMakePrediction = async (teamId: string) => {
    if (!user) {
      navigate('/auth');
      return;
    }
    if (!match || match.status !== 'upcoming') return;
    if (prediction?.predicted_team_id === teamId) return;

    setSubmittingPick(true);
    setPickError(null);
    setPickSuccess(null);

    try {
      const isFirstPrediction = !prediction;
      const payload: Partial<Prediction> = {
        user_id: user.id,
        match_id: match.id,
        predicted_team_id: teamId,
        points_awarded: 0,
        is_correct: null,
        updated_at: new Date().toISOString(),
      };

      if (isFirstPrediction) {
        payload.created_at = new Date().toISOString();
      }

      const { data: upsertData, error: upsertError } = await supabase
        .from('predictions')
        .upsert(payload, { onConflict: 'user_id,match_id' })
        .select()
        .single();

      if (upsertError) {
        throw upsertError;
      }

      setPrediction(upsertData as Prediction);

      // Increment total_predictions on match if first pick
      if (isFirstPrediction) {
        await supabase
          .from('matches')
          .update({ total_predictions: (match.total_predictions || 0) + 1 })
          .eq('id', match.id);

        setMatch((prev) =>
          prev ? { ...prev, total_predictions: (prev.total_predictions || 0) + 1 } : null
        );
      }

      // Update user prediction streak logic
      const streakResult = await updatePredictionStreak(user.id);
      await refreshProfile();

      const pickedTeamName = teamId === match.team_a_id ? match.team_a_name : match.team_b_name;
      const streakSuffix = streakResult.updated && streakResult.streakIncreased
        ? ` (Streak: ${streakResult.currentStreak}d 🔥)`
        : '';
      setPickSuccess(`Prediction locked for ${pickedTeamName}!${streakSuffix}`);
    } catch (err: any) {
      console.error('Prediction submission error:', err);
      setPickError(err.message || 'Failed to submit prediction');
    } finally {
      setSubmittingPick(false);
    }
  };

  const isLive = match?.status === 'live';
  const isCompleted = match?.status === 'completed';
  const isUpcoming = match?.status === 'upcoming';
  const userPickTeamId = prediction?.predicted_team_id;

  const teamAName = match?.team_a_name || match?.team1 || 'Team 1';
  const teamBName = match?.team_b_name || match?.team2 || 'Team 2';
  const teamAId = match?.team_a_id || `team-1-${match?.id}`;
  const teamBId = match?.team_b_id || `team-2-${match?.id}`;
  const displayStartTime = match?.start_time || match?.scheduled_at || '';

  // Format start time
  const formatStartTime = (timeStr?: string) => {
    if (!timeStr) return '';
    try {
      const date = new Date(timeStr);
      return date.toLocaleDateString([], {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return timeStr;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#08090f] text-slate-100 flex flex-col">
        <TopNavigationBar isMobileView={isMobileView} setIsMobileView={setIsMobileView} />
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <div className="w-9 h-9 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400 font-display">Loading Match Arena...</p>
        </div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-screen bg-[#08090f] text-slate-100 flex flex-col">
        <TopNavigationBar isMobileView={isMobileView} setIsMobileView={setIsMobileView} />
        <div className="flex-1 max-w-lg mx-auto w-full px-4 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#0f111d] border border-slate-800 flex items-center justify-center text-rose-400 mb-4 shadow-xl">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold font-display text-white mb-2">Match Not Found</h2>
          <p className="text-slate-400 text-sm mb-6">
            The requested match ID could not be located in the arena database.
          </p>
          <Link
            to="/dashboard"
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 text-white font-bold text-xs uppercase tracking-wider font-display flex items-center gap-2 shadow-lg shadow-violet-950/60"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Arena Dashboard</span>
          </Link>
        </div>
      </div>
    );
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
        {/* Back Button to Dashboard */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#0e101a] border border-slate-800 hover:border-violet-500/50 hover:text-cyan-300 text-slate-300 text-xs font-bold font-display uppercase tracking-wider transition group shadow-md"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>Back to Dashboard</span>
          </Link>

          {/* Tournament & Format Pill */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#10121d] border border-violet-900/40 text-xs font-display text-slate-300">
            <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
            <span className="font-bold text-white">{match.game || 'Esports'}</span>
            <span className="text-slate-500">·</span>
            <span>{match.tournament || 'Championship'}</span>
            <span className="text-slate-500">·</span>
            <span className="text-cyan-400 font-mono font-bold">{match.format || 'BO3'}</span>
          </div>
        </div>

        {/* MATCH HEADER ARENA HERO */}
        <section className="bg-gradient-to-b from-[#121422] via-[#0e101a] to-[#08090f] border border-violet-900/30 rounded-3xl p-6 sm:p-8 mb-8 shadow-2xl relative overflow-hidden">
          {/* Ambient Lighting Orbs */}
          <div className="absolute top-0 left-1/4 w-72 h-72 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-0 right-1/4 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Top Status Bar */}
          <div className="flex items-center justify-between gap-4 mb-8 pb-4 border-b border-slate-800/80">
            {/* Status Badges */}
            <div className="flex items-center gap-3">
              {isLive && (
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-rose-950/80 border border-rose-500/50 text-rose-400 text-xs font-black tracking-wider uppercase font-display animate-pulse">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <span>LIVE MATCH</span>
                  {(match.live_map || match.live_time) && (
                    <span className="text-slate-300 font-mono text-[11px] border-l border-rose-500/40 pl-2">
                      {match.live_map ? `${match.live_map} · ` : ''}
                      {match.live_time || '32:45'}
                    </span>
                  )}
                </div>
              )}

              {isUpcoming && (
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#141626] border border-cyan-500/30 text-cyan-300 text-xs font-bold font-display uppercase tracking-wider">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Upcoming</span>
                  <span className="text-slate-400 font-mono">
                    · {formatStartTime(match.start_time)}
                  </span>
                </div>
              )}

              {isCompleted && (
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-bold font-display uppercase tracking-wider">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Match Final</span>
                </div>
              )}
            </div>

            {/* Total Predictions Counter */}
            <div className="text-xs text-slate-400 font-display flex items-center gap-1.5 font-medium">
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              <span>
                <strong className="text-white font-mono">{match.total_predictions || 0}</strong> picks placed
              </span>
            </div>
          </div>

          {/* Teams Faceoff & Score Display */}
          <div className="grid grid-cols-1 md:grid-cols-7 gap-6 items-center">
            {/* Team A Profile */}
            <div className="md:col-span-3 flex flex-col items-center md:items-end text-center md:text-right">
              <div className="flex flex-col md:flex-row-reverse items-center gap-4">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-[#141626] border border-violet-900/40 flex items-center justify-center text-3xl sm:text-4xl shadow-xl shadow-violet-950/40 shrink-0">
                  {match.team_a_logo?.length <= 4 ? (
                    <span>{match.team_a_logo || '🦅'}</span>
                  ) : (
                    <img
                      src={match.team_a_logo}
                      alt={match.team_a_name}
                      className="w-16 h-16 object-contain rounded-xl"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  )}
                </div>
                <div>
                  <h3 className="text-2xl sm:text-3xl font-black text-white font-display uppercase tracking-tight">
                    {match.team_a_name}
                  </h3>
                  <div className="flex items-center justify-center md:justify-end gap-2 text-xs text-slate-400 font-display mt-1">
                    {match.team_a_short && (
                      <span className="font-mono text-cyan-400 font-bold">[{match.team_a_short}]</span>
                    )}
                    <span>· {match.team_a_winrate ?? 65}% Win Rate</span>
                    {match.team_a_region && <span>· {match.team_a_region}</span>}
                  </div>
                  <div className="mt-2 text-xs font-display">
                    <span className="text-slate-500 uppercase font-semibold">Odds: </span>
                    <span className="text-cyan-400 font-mono font-bold text-sm">
                      {Number(match.odds_a || 1.85).toFixed(2)}x
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Center Score & VS Banner */}
            <div className="md:col-span-1 flex flex-col items-center justify-center py-2">
              {isLive || isCompleted ? (
                /* LIVE / FINAL SCORE */
                <div className="flex flex-col items-center">
                  <div className="flex items-center justify-center gap-3 px-5 py-2.5 rounded-2xl bg-[#090a14] border border-slate-700/80 shadow-2xl">
                    <span className="text-3xl sm:text-4xl font-black font-mono text-white tracking-wider">
                      {match.score_a ?? 0}
                    </span>
                    <span className="text-xl font-bold text-slate-500">-</span>
                    <span className="text-3xl sm:text-4xl font-black font-mono text-white tracking-wider">
                      {match.score_b ?? 0}
                    </span>
                  </div>
                  <span className="mt-2 text-[11px] font-bold uppercase tracking-widest text-slate-400 font-display">
                    {isLive ? 'Current Score' : 'Final Result'}
                  </span>
                </div>
              ) : (
                /* UPCOMING VS BADGE */
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 via-indigo-600 to-cyan-500 p-0.5 shadow-lg shadow-violet-950/60">
                    <div className="w-full h-full bg-[#0d0e19] rounded-[14px] flex items-center justify-center text-white font-black text-sm font-display tracking-widest">
                      VS
                    </div>
                  </div>
                  <span className="mt-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 font-display">
                    {match.format || 'BO3'}
                  </span>
                </div>
              )}
            </div>

            {/* Team B Profile */}
            <div className="md:col-span-3 flex flex-col items-center md:items-start text-center md:text-left">
              <div className="flex flex-col md:flex-row items-center gap-4">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-[#141626] border border-cyan-900/40 flex items-center justify-center text-3xl sm:text-4xl shadow-xl shadow-cyan-950/40 shrink-0">
                  {match.team_b_logo?.length <= 4 ? (
                    <span>{match.team_b_logo || '🐉'}</span>
                  ) : (
                    <img
                      src={match.team_b_logo}
                      alt={match.team_b_name}
                      className="w-16 h-16 object-contain rounded-xl"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  )}
                </div>
                <div>
                  <h3 className="text-2xl sm:text-3xl font-black text-white font-display uppercase tracking-tight">
                    {match.team_b_name}
                  </h3>
                  <div className="flex items-center justify-center md:justify-start gap-2 text-xs text-slate-400 font-display mt-1">
                    {match.team_b_short && (
                      <span className="font-mono text-cyan-400 font-bold">[{match.team_b_short}]</span>
                    )}
                    <span>· {match.team_b_winrate ?? 60}% Win Rate</span>
                    {match.team_b_region && <span>· {match.team_b_region}</span>}
                  </div>
                  <div className="mt-2 text-xs font-display">
                    <span className="text-slate-500 uppercase font-semibold">Odds: </span>
                    <span className="text-cyan-400 font-mono font-bold text-sm">
                      {Number(match.odds_b || 1.95).toFixed(2)}x
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PREDICTION SECTION */}
        <section className="bg-[#0e101a] border border-violet-900/30 rounded-3xl p-6 sm:p-8 mb-8 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-800/80">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-white font-display uppercase tracking-wide">
                  Match Winner Prediction
                </h2>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold font-display uppercase tracking-wider bg-violet-950/80 border border-violet-500/40 text-violet-300">
                  +100 PTS
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 font-display mt-1">
                {isUpcoming
                  ? 'Select which team will claim victory in this match. Picks lock when live play begins.'
                  : isLive
                  ? 'Match is currently in progress. Predictions are locked.'
                  : 'This match has ended. Check your prediction outcome below.'}
              </p>
            </div>

            {/* Lock or Status Message */}
            {(isLive || isCompleted) && (
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 text-xs font-bold font-display">
                <Lock className="w-3.5 h-3.5 text-rose-400" />
                <span>Predictions locked</span>
              </div>
            )}
          </div>

          {/* Result Outcome Banner for Completed Match */}
          {isCompleted && prediction && (
            <div
              className={`mb-6 p-4 rounded-2xl border flex items-center justify-between gap-4 font-display ${
                prediction.is_correct === true
                  ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-200'
                  : prediction.is_correct === false
                  ? 'bg-rose-950/50 border-rose-500/50 text-rose-200'
                  : 'bg-violet-950/40 border-violet-500/40 text-violet-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    prediction.is_correct === true
                      ? 'bg-emerald-500 text-slate-950'
                      : prediction.is_correct === false
                      ? 'bg-rose-500 text-white'
                      : 'bg-violet-600 text-white'
                  }`}
                >
                  {prediction.is_correct === true ? (
                    <Trophy className="w-5 h-5" />
                  ) : prediction.is_correct === false ? (
                    <AlertCircle className="w-5 h-5" />
                  ) : (
                    <Clock className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h4 className="font-bold text-sm sm:text-base text-white">
                    {prediction.is_correct === true
                      ? '🎉 Correct Prediction!'
                      : prediction.is_correct === false
                      ? '❌ Prediction Incorrect'
                      : 'Prediction Result Pending Resolution'}
                  </h4>
                  <p className="text-xs opacity-80">
                    {prediction.is_correct === true
                      ? `Congratulations! You picked correctly and earned +${
                          prediction.points_awarded || 100
                        } points.`
                      : prediction.is_correct === false
                      ? `Your pick did not win this match. Better luck next game!`
                      : 'Scores are being finalized by tournament arbiters.'}
                  </p>
                </div>
              </div>

              {prediction.is_correct === true && (
                <div className="shrink-0 px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-mono font-bold text-sm">
                  +{prediction.points_awarded || 100} PTS
                </div>
              )}
            </div>
          )}

          {/* Interactive Pick Cards Side by Side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            {/* Team A Pick Card */}
            <button
              type="button"
              onClick={() => handleMakePrediction(match.team_a_id)}
              disabled={!isUpcoming || submittingPick}
              className={`relative p-5 rounded-2xl border text-left flex flex-col justify-between transition-all duration-200 group cursor-pointer ${
                userPickTeamId === match.team_a_id
                  ? 'bg-gradient-to-b from-violet-950/50 via-[#131627] to-cyan-950/40 border-cyan-400 shadow-[0_0_25px_rgba(6,182,212,0.35)] ring-2 ring-cyan-400/60'
                  : 'bg-[#121422] border-slate-800/90 hover:border-violet-500/50 hover:bg-[#16182a]'
              } ${!isUpcoming ? 'cursor-default' : ''}`}
            >
              {/* "YOUR PICK" Badge */}
              {userPickTeamId === match.team_a_id && (
                <div className="absolute -top-3 right-4 px-3 py-0.5 rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 text-slate-950 text-xs font-black tracking-wider uppercase flex items-center gap-1.5 shadow-lg shadow-cyan-950/60 font-display">
                  <CheckCircle2 className="w-3.5 h-3.5 text-slate-950" />
                  <span>YOUR PICK</span>
                </div>
              )}

              {/* Winner Tag if Completed */}
              {isCompleted && match.winner_id === match.team_a_id && (
                <div className="absolute -top-3 left-4 px-3 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-xs font-black tracking-wider uppercase flex items-center gap-1 shadow-md font-display">
                  <Trophy className="w-3 h-3" />
                  <span>WINNER</span>
                </div>
              )}

              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-xl bg-slate-900 border border-slate-700/80 flex items-center justify-center text-2xl shadow-inner shrink-0 group-hover:scale-105 group-hover:border-cyan-400/60 transition">
                  {match.team_a_logo?.length <= 4 ? (
                    <span>{match.team_a_logo || '🦅'}</span>
                  ) : (
                    <img
                      src={match.team_a_logo}
                      alt={match.team_a_name}
                      className="w-10 h-10 object-contain rounded-lg"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  )}
                </div>
                <div>
                  <div className="text-white font-black text-lg font-display truncate group-hover:text-cyan-300 transition">
                    {match.team_a_name}
                  </div>
                  <div className="text-xs text-slate-400 font-display">
                    {match.team_a_winrate ?? 65}% Win Rate
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-800/90 pt-3 font-display">
                <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
                  Payout Multiplier
                </span>
                <span className="text-base font-bold font-mono text-cyan-400">
                  {Number(match.odds_a || 1.85).toFixed(2)}x
                </span>
              </div>
            </button>

            {/* Team B Pick Card */}
            <button
              type="button"
              onClick={() => handleMakePrediction(match.team_b_id)}
              disabled={!isUpcoming || submittingPick}
              className={`relative p-5 rounded-2xl border text-left flex flex-col justify-between transition-all duration-200 group cursor-pointer ${
                userPickTeamId === match.team_b_id
                  ? 'bg-gradient-to-b from-violet-950/50 via-[#131627] to-cyan-950/40 border-cyan-400 shadow-[0_0_25px_rgba(6,182,212,0.35)] ring-2 ring-cyan-400/60'
                  : 'bg-[#121422] border-slate-800/90 hover:border-violet-500/50 hover:bg-[#16182a]'
              } ${!isUpcoming ? 'cursor-default' : ''}`}
            >
              {/* "YOUR PICK" Badge */}
              {userPickTeamId === match.team_b_id && (
                <div className="absolute -top-3 right-4 px-3 py-0.5 rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 text-slate-950 text-xs font-black tracking-wider uppercase flex items-center gap-1.5 shadow-lg shadow-cyan-950/60 font-display">
                  <CheckCircle2 className="w-3.5 h-3.5 text-slate-950" />
                  <span>YOUR PICK</span>
                </div>
              )}

              {/* Winner Tag if Completed */}
              {isCompleted && match.winner_id === match.team_b_id && (
                <div className="absolute -top-3 left-4 px-3 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-xs font-black tracking-wider uppercase flex items-center gap-1 shadow-md font-display">
                  <Trophy className="w-3 h-3" />
                  <span>WINNER</span>
                </div>
              )}

              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-xl bg-slate-900 border border-slate-700/80 flex items-center justify-center text-2xl shadow-inner shrink-0 group-hover:scale-105 group-hover:border-cyan-400/60 transition">
                  {match.team_b_logo?.length <= 4 ? (
                    <span>{match.team_b_logo || '🐉'}</span>
                  ) : (
                    <img
                      src={match.team_b_logo}
                      alt={match.team_b_name}
                      className="w-10 h-10 object-contain rounded-lg"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  )}
                </div>
                <div>
                  <div className="text-white font-black text-lg font-display truncate group-hover:text-cyan-300 transition">
                    {match.team_b_name}
                  </div>
                  <div className="text-xs text-slate-400 font-display">
                    {match.team_b_winrate ?? 60}% Win Rate
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-800/90 pt-3 font-display">
                <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
                  Payout Multiplier
                </span>
                <span className="text-base font-bold font-mono text-cyan-400">
                  {Number(match.odds_b || 1.95).toFixed(2)}x
                </span>
              </div>
            </button>
          </div>

          {/* Feedback Messages */}
          {pickSuccess && (
            <div className="mt-4 p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs font-display flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{pickSuccess}</span>
            </div>
          )}

          {pickError && (
            <div className="mt-4 p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs font-display flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{pickError}</span>
            </div>
          )}
        </section>

        {/* LIVE POLLS SECTION */}
        <section className="bg-[#0e101a] border border-violet-900/30 rounded-3xl p-6 sm:p-8 shadow-xl">
          <div className="flex items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800/80">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
              <h2 className="text-lg sm:text-xl font-black text-white font-display uppercase tracking-wide">
                Live Match Polls
              </h2>
            </div>
            <span className="text-xs text-slate-400 font-display">
              {polls.length} {polls.length === 1 ? 'poll' : 'polls'} active
            </span>
          </div>

          {polls.length === 0 ? (
            <div className="bg-[#121422]/60 border border-slate-800/80 rounded-2xl p-8 text-center max-w-md mx-auto my-4">
              <div className="w-12 h-12 rounded-xl bg-[#171a2c] border border-slate-700/80 mx-auto mb-3 flex items-center justify-center text-slate-400">
                <HelpCircle className="w-6 h-6 text-cyan-400" />
              </div>
              <h4 className="text-base font-bold text-white mb-1 font-display">
                No Active Polls for This Match
              </h4>
              <p className="text-xs text-slate-400 mb-4 font-display">
                Live polls pop up during map picks, pistol rounds, and halftime. Check back when the match gets underway!
              </p>
              <Link
                to="/polls"
                className="inline-flex items-center gap-2 text-xs font-bold text-cyan-400 hover:text-cyan-300 font-display"
              >
                <span>Browse All Arena Polls →</span>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {polls.map((poll) => {
                const userVote = userPollVotes.find((v) => v.poll_id === poll.id);
                return (
                  <PollCard
                    key={poll.id}
                    poll={poll}
                    userVote={userVote}
                    onVoted={fetchMatchData}
                  />
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Match, Prediction } from '../types/database';
import { supabase } from '../lib/supabase';
import { updatePredictionStreak } from '../lib/streak';
import { useAuth } from '../context/AuthContext';
import { CheckCircle2, Lock, ArrowUpRight, Zap, Trophy, Radio } from 'lucide-react';

interface MatchCardProps {
  match: Match;
  userPrediction?: Prediction;
  onPredictionUpdated?: () => void;
}

export default function MatchCard({ match, userPrediction, onPredictionUpdated }: MatchCardProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [submittingPick, setSubmittingPick] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isLive = match.status === 'live';
  const isCompleted = match.status === 'completed';
  const isUpcoming = match.status === 'upcoming';

  const teamAName = match.team_a_name || match.team1 || 'Team 1';
  const teamBName = match.team_b_name || match.team2 || 'Team 2';
  const teamAId = match.team_a_id || `team-1-${match.id}`;
  const teamBId = match.team_b_id || `team-2-${match.id}`;
  const displayStartTime = match.start_time || match.scheduled_at || '';

  const userPickTeamId = userPrediction?.predicted_team_id;

  const handleMakePrediction = async (teamId: string) => {
    if (!user) {
      navigate('/auth');
      return;
    }
    if (!isUpcoming) return;
    if (userPickTeamId === teamId) return;

    setSubmittingPick(true);
    setErrorMsg(null);

    try {
      // 1. Upsert prediction into Supabase
      const payload: Partial<Prediction> = {
        user_id: user.id,
        match_id: match.id,
        predicted_team_id: teamId,
        points_awarded: 0,
        is_correct: null,
        updated_at: new Date().toISOString(),
      };

      if (!userPrediction) {
        payload.created_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('predictions')
        .upsert(payload, { onConflict: 'user_id,match_id' });

      if (error) {
        throw error;
      }

      // 2. Increment match total_predictions if first time
      if (!userPrediction) {
        await supabase
          .from('matches')
          .update({ total_predictions: (match.total_predictions || 0) + 1 })
          .eq('id', match.id);
      }

      // 3. Update prediction streak in Supabase profiles
      await updatePredictionStreak(user.id);

      onPredictionUpdated?.();
    } catch (err: any) {
      console.error('Prediction error:', err);
      setErrorMsg(err.message || 'Failed to submit prediction');
    } finally {
      setSubmittingPick(false);
    }
  };

  // Format tournament text
  const tournamentText = `${match.game || 'Esports'} · ${match.tournament || 'Championship'} · ${match.format || 'BO3'}`;

  // Format start time display
  const formatStartTime = (timeStr: string) => {
    try {
      const date = new Date(timeStr);
      const today = new Date();
      const isToday = date.toDateString() === today.toDateString();
      const timePart = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      return isToday ? `Today ${timePart} UTC` : date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return timeStr;
    }
  };

  return (
    <div className="bg-[#0e101a]/95 border border-slate-800/90 hover:border-violet-500/40 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden transition-all duration-200 flex flex-col justify-between">
      {/* Subtle top edge neon reflection */}
      <div className="absolute top-0 left-10 right-10 h-px bg-gradient-to-r from-transparent via-violet-500/30 to-transparent pointer-events-none" />

      {/* Top Header: Tournament badge & Status */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        {/* Tournament badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#131522] border border-violet-900/30 text-slate-300 text-xs font-semibold tracking-wide font-display">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
          <span>{tournamentText}</span>
        </div>

        {/* Match status badge */}
        {isLive && (
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-950/80 border border-rose-500/50 text-rose-400 text-xs font-black tracking-wide animate-pulse font-display">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span>🔴 LIVE</span>
            {(match.live_time || match.live_map) && (
              <span className="text-slate-300 font-mono text-[11px] border-l border-rose-500/40 pl-2">
                {match.live_map ? `${match.live_map} · ` : ''}{match.live_time || '32:45'}
              </span>
            )}
          </div>
        )}

        {isUpcoming && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#131522] border border-slate-800 text-slate-300 text-xs font-display">
            <span className="text-cyan-400 font-bold">Upcoming</span>
            <span className="text-slate-400 font-mono">· {formatStartTime(displayStartTime)}</span>
          </div>
        )}

        {isCompleted && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/70 border border-emerald-500/40 text-emerald-400 text-xs font-bold font-display">
            <span>FINAL</span>
            <span className="font-mono text-white">({match.score_a} - {match.score_b})</span>
          </div>
        )}
      </div>

      {/* Center: Two team prediction cards side by side */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 my-2">
        {/* Team A Card */}
        <button
          type="button"
          onClick={() => handleMakePrediction(teamAId)}
          disabled={!isUpcoming || submittingPick}
          className={`relative p-4 rounded-xl border text-left flex flex-col justify-between transition-all duration-200 group cursor-pointer ${
            userPickTeamId === teamAId
              ? 'bg-gradient-to-b from-violet-950/40 to-cyan-950/30 border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.3)] ring-1 ring-cyan-400/50'
              : 'bg-[#121422]/80 border-slate-800/80 hover:border-violet-500/50 hover:bg-[#151829]'
          } ${!isUpcoming ? 'cursor-default' : ''}`}
        >
          {/* "YOUR PICK" label */}
          {userPickTeamId === teamAId && (
            <div className="absolute -top-2.5 right-3 px-2 py-0.5 rounded bg-gradient-to-r from-violet-500 to-cyan-400 text-slate-950 text-[10px] font-black tracking-wider uppercase flex items-center gap-1 shadow-md shadow-cyan-950/60 font-display">
              <CheckCircle2 className="w-3 h-3 text-slate-950" />
              YOUR PICK
            </div>
          )}

          {/* Winner Crown if completed */}
          {isCompleted && match.winner_id === teamAId && (
            <div className="absolute -top-2.5 left-3 px-2 py-0.5 rounded bg-emerald-500 text-slate-950 text-[10px] font-black uppercase shadow-md font-display">
              WINNER
            </div>
          )}

          <div className="flex items-center gap-3 mb-3">
            {/* Team Logo in circular badge */}
            <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-700/80 flex items-center justify-center text-xl shadow-inner shrink-0 group-hover:scale-105 group-hover:border-cyan-400/60 transition">
              {match.team_a_logo && match.team_a_logo.length <= 4 ? (
                <span>{match.team_a_logo || '🦅'}</span>
              ) : match.team_a_logo ? (
                <img
                  src={match.team_a_logo}
                  alt={teamAName}
                  className="w-8 h-8 object-contain rounded-lg"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <span>🦅</span>
              )}
            </div>

            <div className="min-w-0">
              <div className="text-white font-bold text-base truncate font-display group-hover:text-cyan-300 transition">
                {teamAName}
              </div>
              <div className="text-xs text-slate-400 font-medium">
                {match.team_a_winrate ?? 65}% WR
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-slate-800/80 pt-2.5 mt-1 font-display">
            <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
              Odds
            </span>
            <span className="text-sm font-bold text-cyan-400">
              {Number(match.odds_a || 1.85).toFixed(2)}x
            </span>
          </div>
        </button>

        {/* Team B Card */}
        <button
          type="button"
          onClick={() => handleMakePrediction(teamBId)}
          disabled={!isUpcoming || submittingPick}
          className={`relative p-4 rounded-xl border text-left flex flex-col justify-between transition-all duration-200 group cursor-pointer ${
            userPickTeamId === teamBId
              ? 'bg-gradient-to-b from-violet-950/40 to-cyan-950/30 border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.3)] ring-1 ring-cyan-400/50'
              : 'bg-[#121422]/80 border-slate-800/80 hover:border-violet-500/50 hover:bg-[#151829]'
          } ${!isUpcoming ? 'cursor-default' : ''}`}
        >
          {/* "YOUR PICK" label */}
          {userPickTeamId === teamBId && (
            <div className="absolute -top-2.5 right-3 px-2 py-0.5 rounded bg-gradient-to-r from-violet-500 to-cyan-400 text-slate-950 text-[10px] font-black tracking-wider uppercase flex items-center gap-1 shadow-md shadow-cyan-950/60 font-display">
              <CheckCircle2 className="w-3 h-3 text-slate-950" />
              YOUR PICK
            </div>
          )}

          {/* Winner Crown if completed */}
          {isCompleted && match.winner_id === teamBId && (
            <div className="absolute -top-2.5 left-3 px-2 py-0.5 rounded bg-emerald-500 text-slate-950 text-[10px] font-black uppercase shadow-md font-display">
              WINNER
            </div>
          )}

          <div className="flex items-center gap-3 mb-3">
            {/* Team Logo in circular badge */}
            <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-700/80 flex items-center justify-center text-xl shadow-inner shrink-0 group-hover:scale-105 group-hover:border-cyan-400/60 transition">
              {match.team_b_logo && match.team_b_logo.length <= 4 ? (
                <span>{match.team_b_logo || '🐉'}</span>
              ) : match.team_b_logo ? (
                <img
                  src={match.team_b_logo}
                  alt={teamBName}
                  className="w-8 h-8 object-contain rounded-lg"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <span>🐉</span>
              )}
            </div>

            <div className="min-w-0">
              <div className="text-white font-bold text-base truncate font-display group-hover:text-cyan-300 transition">
                {teamBName}
              </div>
              <div className="text-xs text-slate-400 font-medium">
                {match.team_b_winrate ?? 60}% WR
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-slate-800/80 pt-2.5 mt-1 font-display">
            <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
              Odds
            </span>
            <span className="text-sm font-bold text-cyan-400">
              {Number(match.odds_b || 1.95).toFixed(2)}x
            </span>
          </div>
        </button>
      </div>

      {/* Lock state notice or error */}
      {isLive && (
        <div className="my-2 py-1.5 px-3 rounded-lg bg-rose-950/40 border border-rose-900/50 flex items-center justify-center gap-2 text-rose-300 text-xs font-medium font-display">
          <Lock className="w-3.5 h-3.5 text-rose-400" />
          <span>Predictions locked during live match</span>
        </div>
      )}

      {errorMsg && (
        <p className="text-xs text-rose-400 text-center my-1">{errorMsg}</p>
      )}

      {/* Card Footer: Total predictions & Match view link */}
      <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-800/90 text-xs font-display">
        <div className="text-slate-400 flex items-center gap-1.5 font-medium">
          <Zap className="w-3.5 h-3.5 text-cyan-400" />
          <span>
            <strong className="text-white font-mono">{match.total_predictions ?? 0}</strong> predictions placed
          </span>
        </div>

        <Link
          to={`/match/${match.id}`}
          className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-bold transition group"
        >
          <span>Match Arena & Polls</span>
          <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
        </Link>
      </div>
    </div>
  );
}

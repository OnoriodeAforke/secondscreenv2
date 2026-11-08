import React, { useState } from 'react';
import type { Poll, PollVote } from '../types/database';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { CheckCircle2, Trophy, Users, Clock, AlertCircle } from 'lucide-react';

interface PollCardProps {
  poll: Poll;
  userVote?: PollVote;
  voteCounts?: Record<string, number>; // Live vote counts aggregated from poll_votes table
  totalVotesCount?: number;
  onVoted?: () => void;
}

export default function PollCard({
  poll,
  userVote,
  voteCounts,
  totalVotesCount,
  onVoted,
}: PollCardProps) {
  const { user, refreshProfile } = useAuth();
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(
    userVote?.option_id || null
  );
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync state if userVote changes
  React.useEffect(() => {
    if (userVote?.option_id) {
      setSelectedOptionId(userVote.option_id);
    }
  }, [userVote]);

  const hasVoted = Boolean(userVote || selectedOptionId);
  const isExpired = poll.expires_at ? new Date(poll.expires_at) <= new Date() : false;
  const canVote = poll.is_live && !isExpired && !hasVoted;

  // Compute live total votes
  const fallbackOptionTotal =
    poll.options?.reduce((acc, opt) => acc + (opt.votes || 0), 0) || 0;
  const totalVotes =
    totalVotesCount !== undefined
      ? totalVotesCount
      : poll.total_votes || fallbackOptionTotal;

  const handleVote = async (optionId: string) => {
    if (!user) {
      setErrorMsg('Please sign in to vote in live polls');
      return;
    }
    if (!canVote || submitting) return;

    setSubmitting(true);
    setErrorMsg(null);

    try {
      // 1. Insert into poll_votes (poll_id, user_id, option_id)
      const votePayload = {
        poll_id: poll.id,
        user_id: user.id,
        option_id: optionId,
        created_at: new Date().toISOString(),
      };

      const { error: voteError } = await supabase
        .from('poll_votes')
        .insert(votePayload);

      if (voteError) {
        // If already voted (unique constraint violation)
        if (voteError.code === '23505') {
          setSelectedOptionId(optionId);
          onVoted?.();
          return;
        }
        throw voteError;
      }

      // 2. Increment poll votes in poll object if permitted
      const updatedOptions = (poll.options || []).map((opt) => {
        if (opt.id === optionId) {
          return { ...opt, votes: (opt.votes || 0) + 1 };
        }
        return opt;
      });

      await supabase
        .from('polls')
        .update({
          options: updatedOptions,
          total_votes: totalVotes + 1,
        })
        .eq('id', poll.id);

      // 3. Award bonus points to the user if applicable
      const pointsToAward = poll.bonus_points ?? 10;
      if (pointsToAward > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('points')
          .eq('id', user.id)
          .single();

        if (profileData) {
          await supabase
            .from('profiles')
            .update({
              points: (profileData.points || 0) + pointsToAward,
            })
            .eq('id', user.id);

          await refreshProfile();
        }
      }

      setSelectedOptionId(optionId);
      onVoted?.();
    } catch (err: any) {
      console.error('Error submitting vote:', err);
      setErrorMsg(err.message || 'Failed to submit vote');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-[#0e101a]/95 border border-slate-800/90 hover:border-violet-500/40 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden transition-all duration-200 flex flex-col justify-between">
      {/* Top subtle neon reflection line */}
      <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent pointer-events-none" />

      <div>
        {/* Header Info: Live Badge, Streamer/Sponsor, Bonus Points */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            {poll.is_live && !isExpired ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-[11px] font-bold tracking-wider uppercase font-display">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                <span>LIVE POLL</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400 text-[11px] font-semibold font-display">
                <Clock className="w-3 h-3" />
                <span>CLOSED</span>
              </span>
            )}

            {poll.streamer_name && (
              <span className="text-xs text-slate-400 font-display flex items-center gap-1 truncate">
                <span>by</span>
                <strong className="text-violet-300 truncate">@{poll.streamer_name}</strong>
              </span>
            )}

            {poll.sponsor_name && (
              <span className="text-xs text-amber-400 font-display flex items-center gap-1 truncate font-semibold">
                <span>· {poll.sponsor_name}</span>
              </span>
            )}
          </div>

          {/* Bonus Points Chip */}
          {(poll.bonus_points ?? 10) > 0 && (
            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-gradient-to-r from-purple-950/60 to-violet-950/60 border border-purple-500/40 text-purple-300 text-xs font-bold font-display shadow-sm shrink-0">
              <Trophy className="w-3 h-3 text-cyan-400" />
              <span>+{poll.bonus_points ?? 10} PTS</span>
            </div>
          )}
        </div>

        {/* Poll Question */}
        <h4 className="text-base sm:text-lg font-bold text-white mb-4 font-display leading-snug">
          {poll.question}
        </h4>

        {/* Options */}
        <div className="space-y-2.5 mb-4">
          {poll.options?.map((option) => {
            // Live vote counts from poll_votes table or option baseline
            const optVotes =
              voteCounts && voteCounts[option.id] !== undefined
                ? voteCounts[option.id]
                : option.votes || 0;

            const percentage =
              totalVotes > 0 ? Math.round((optVotes / totalVotes) * 100) : 0;

            const isUserPick = selectedOptionId === option.id;

            if (hasVoted || isExpired || !poll.is_live) {
              // Results Mode (Progress Bar)
              return (
                <div
                  key={option.id}
                  className={`relative p-3 rounded-xl border overflow-hidden transition-all duration-200 ${
                    isUserPick
                      ? 'border-cyan-400/90 bg-violet-950/40 ring-1 ring-cyan-400/40 shadow-[0_0_15px_rgba(6,182,212,0.25)]'
                      : 'border-slate-800 bg-[#121422]/80'
                  }`}
                >
                  {/* Background Progress Fill */}
                  <div
                    className={`absolute top-0 bottom-0 left-0 transition-all duration-500 ${
                      isUserPick
                        ? 'bg-gradient-to-r from-violet-600/40 to-cyan-500/40 border-r-2 border-cyan-400'
                        : 'bg-slate-800/40'
                    }`}
                    style={{ width: `${percentage}%` }}
                  />

                  {/* Option Content Overlay */}
                  <div className="relative z-10 flex items-center justify-between text-xs sm:text-sm font-display">
                    <div className="flex items-center gap-2 truncate pr-2">
                      {isUserPick && (
                        <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                      )}
                      <span
                        className={`font-semibold truncate ${
                          isUserPick ? 'text-cyan-200 font-bold' : 'text-slate-200'
                        }`}
                      >
                        {option.text}
                      </span>
                      {isUserPick && (
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-950 px-2 py-0.5 rounded bg-cyan-400 shadow-sm shrink-0">
                          YOUR VOTE
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-slate-400 font-mono text-[11px] hidden sm:inline">
                        ({optVotes})
                      </span>
                      <span
                        className={`font-bold font-mono ${
                          isUserPick ? 'text-cyan-300' : 'text-white'
                        }`}
                      >
                        {percentage}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            }

            // Voting Mode (Clickable Buttons)
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => handleVote(option.id)}
                disabled={submitting}
                className="w-full text-left p-3.5 rounded-xl border border-slate-800 bg-[#121422]/90 hover:border-cyan-400/70 hover:bg-[#16192d] text-slate-200 hover:text-white transition-all duration-150 flex items-center justify-between group cursor-pointer text-xs sm:text-sm font-display font-medium shadow-sm"
              >
                <span className="truncate group-hover:text-cyan-300 transition">
                  {option.text}
                </span>
                <span className="w-2.5 h-2.5 rounded-full border border-slate-600 group-hover:border-cyan-400 group-hover:bg-cyan-400/50 transition shrink-0 ml-2 shadow-[0_0_8px_rgba(6,182,212,0.4)]" />
              </button>
            );
          })}
        </div>

        {errorMsg && (
          <div className="mb-3 p-2 rounded-lg bg-rose-950/40 border border-rose-800/50 flex items-center gap-2 text-rose-300 text-xs font-display">
            <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Footer Info: Total Votes & Status */}
      <div className="flex items-center justify-between text-xs text-slate-500 font-display pt-3 border-t border-slate-800/80">
        <div className="flex items-center gap-1.5 font-medium">
          <Users className="w-3.5 h-3.5 text-cyan-400/80" />
          <span>
            <strong className="text-slate-200 font-mono">{totalVotes}</strong> total votes
          </span>
        </div>

        {hasVoted && (
          <span className="text-cyan-400 text-[11px] font-bold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Choice Recorded</span>
          </span>
        )}
      </div>
    </div>
  );
}

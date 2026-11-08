import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import TopNavigationBar from '../components/TopNavigationBar';
import PollCard from '../components/PollCard';
import PollDistributionChart from '../components/PollDistributionChart';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { Poll, PollVote } from '../types/database';
import {
  Radio,
  RefreshCw,
  Trophy,
  Zap,
  ArrowLeft,
  HelpCircle,
  Clock,
  Sparkles,
} from 'lucide-react';

export default function PollsPage() {
  const { user } = useAuth();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [userVotes, setUserVotes] = useState<PollVote[]>([]);
  const [voteCountsByOption, setVoteCountsByOption] = useState<Record<string, number>>({});
  const [totalVotesByPoll, setTotalVotesByPoll] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);

  // Fetch active polls where is_live = true AND expires_at > now()
  const fetchPollsAndVotes = useCallback(async () => {
    try {
      const now = new Date().toISOString();

      // 1. Fetch polls matching required criteria
      const { data: pollsData, error: pollsError } = await supabase
        .from('polls')
        .select('*')
        .eq('is_live', true)
        .gt('expires_at', now)
        .order('created_at', { ascending: false });

      if (pollsError) {
        console.error('Error fetching live polls:', pollsError);
        return;
      }

      const activePolls = (pollsData as Poll[]) || [];
      setPolls(activePolls);

      if (activePolls.length > 0) {
        const pollIds = activePolls.map((p) => p.id);

        // 2. Fetch live vote counts from poll_votes table for all active polls
        const { data: votesData, error: votesError } = await supabase
          .from('poll_votes')
          .select('poll_id, option_id, user_id')
          .in('poll_id', pollIds);

        if (!votesError && votesData) {
          // Aggregate counts per option_id from poll_votes
          const counts: Record<string, number> = {};
          const totals: Record<string, number> = {};

          // Initialize with any baseline votes from poll options
          activePolls.forEach((poll) => {
            let pTotal = 0;
            poll.options?.forEach((opt) => {
              const baseVotes = opt.votes || 0;
              counts[opt.id] = baseVotes;
              pTotal += baseVotes;
            });
            totals[poll.id] = Math.max(poll.total_votes || 0, pTotal);
          });

          // Add individual votes recorded in poll_votes table
          votesData.forEach((vote) => {
            counts[vote.option_id] = (counts[vote.option_id] || 0) + 1;
            totals[vote.poll_id] = (totals[vote.poll_id] || 0) + 1;
          });

          setVoteCountsByOption(counts);
          setTotalVotesByPoll(totals);

          // Filter votes belonging to current user
          if (user) {
            const myVotes = votesData.filter((v) => v.user_id === user.id) as PollVote[];
            setUserVotes(myVotes);
          }
        }
      } else {
        setVoteCountsByOption({});
        setTotalVotesByPoll({});
        setUserVotes([]);
      }
    } catch (err) {
      console.error('Failed to load polls and votes:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPollsAndVotes();

    // Supabase realtime subscriptions on polls and poll_votes
    const channel = supabase
      .channel('polls-live-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'polls' },
        () => {
          fetchPollsAndVotes();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'poll_votes' },
        () => {
          fetchPollsAndVotes();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPollsAndVotes]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchPollsAndVotes();
  };

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
        {/* Top Navigation Back to Dashboard */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#0e101a] border border-slate-800 hover:border-violet-500/50 hover:text-cyan-300 text-slate-300 text-xs font-bold font-display uppercase tracking-wider transition group shadow-md"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>Back to Dashboard</span>
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2.5 rounded-xl bg-[#121422] hover:bg-[#181a2c] text-slate-300 border border-slate-800 transition flex items-center gap-2 text-xs font-bold font-display cursor-pointer"
              title="Refresh live polls"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-cyan-400' : ''}`}
              />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* Hero Banner / Arena Header */}
        <section className="mb-8 p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-violet-950/40 via-[#0e101a] to-cyan-950/30 border border-violet-900/30 relative overflow-hidden shadow-2xl">
          {/* Subtle neon glow orbs */}
          <div className="absolute -top-12 -left-12 w-56 h-56 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-12 -right-12 w-56 h-56 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-xs font-bold font-display tracking-wider uppercase">
                  <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                  <span>COMMUNITY ARENA</span>
                </span>
                {polls.length > 0 && (
                  <span className="flex items-center gap-1.5 text-xs font-display text-cyan-400 font-bold px-2.5 py-0.5 rounded-md bg-cyan-950/40 border border-cyan-500/30">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                    {polls.length} LIVE {polls.length === 1 ? 'POLL' : 'POLLS'}
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight font-display">
                Live Match & Streamer Polls
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-xl font-display">
                Vote in real-time during live esports broadcasts. Unlock bonus points, see instant community percentages, and compete on the leaderboard.
              </p>
            </div>

            {/* Quick Points Banner */}
            <div className="shrink-0 flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#090a14]/90 border border-violet-900/40 shadow-inner">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center text-slate-950 font-bold shadow-md">
                <Trophy className="w-5 h-5 text-slate-950" />
              </div>
              <div className="text-left font-display">
                <div className="text-xs text-slate-400 font-semibold uppercase">Bonus Rewards</div>
                <div className="text-sm font-bold text-cyan-300">+10 to +15 PTS per vote</div>
              </div>
            </div>
          </div>
        </section>

        {/* Loading State */}
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3">
            <div className="w-9 h-9 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-400 font-display">Loading Live Polls...</p>
          </div>
        ) : polls.length === 0 ? (
          /* Empty State when no live unexpired polls exist */
          <div className="bg-[#0e101a] border border-slate-800 rounded-3xl p-10 sm:p-12 text-center max-w-lg mx-auto my-10 shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-[#141624] border border-slate-700/80 mx-auto mb-4 flex items-center justify-center text-cyan-400 shadow-inner">
              <Clock className="w-8 h-8 text-cyan-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2 font-display">
              No Live Polls Right Now
            </h3>
            <p className="text-slate-400 text-xs sm:text-sm mb-6 font-display">
              There are currently no active polls matching <code className="text-cyan-400">is_live = true AND expires_at &gt; now()</code>. Live polls fire during map transitions and match milestones.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 font-display">
              <button
                onClick={handleRefresh}
                className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-violet-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition cursor-pointer shadow-lg shadow-violet-950/50"
              >
                Check for New Polls
              </button>
              <Link
                to="/dashboard"
                className="w-full sm:w-auto px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs uppercase tracking-wider transition"
              >
                Return to Dashboard
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Real-time Vote Distribution Analytics Chart */}
            <PollDistributionChart
              polls={polls}
              voteCountsByOption={voteCountsByOption}
              totalVotesByPoll={totalVotesByPoll}
            />

            {/* Interactive Poll Cards Grid Header */}
            <div className="flex items-center justify-between gap-4 mb-4 font-display">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
                <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-wider">
                  Interactive Poll Cards
                </h3>
              </div>
              <span className="text-xs text-slate-400">
                Vote to unlock bonus PTS and live results
              </span>
            </div>

            {/* Live Polls Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
              {polls.map((poll) => {
                const userVote = userVotes.find((v) => v.poll_id === poll.id);
                const totalVotes = totalVotesByPoll[poll.id];

                return (
                  <PollCard
                    key={poll.id}
                    poll={poll}
                    userVote={userVote}
                    voteCounts={voteCountsByOption}
                    totalVotesCount={totalVotes}
                    onVoted={fetchPollsAndVotes}
                  />
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

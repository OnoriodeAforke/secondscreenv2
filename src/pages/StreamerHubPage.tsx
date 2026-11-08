import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import TopNavigationBar from '../components/TopNavigationBar';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { Poll, PollOption, PollVote } from '../types/database';
import {
  Radio,
  Zap,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  RefreshCw,
  X,
  Play,
  Square,
  Users,
  Flame,
  Crown,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Sparkles,
  Award,
  Lock,
} from 'lucide-react';

export default function StreamerHubPage() {
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [polls, setPolls] = useState<Poll[]>([]);
  const [voteCountsByOption, setVoteCountsByOption] = useState<Record<string, number>>({});
  const [totalVotesByPoll, setTotalVotesByPoll] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [endingPollId, setEndingPollId] = useState<string | null>(null);
  const [nowTime, setNowTime] = useState(Date.now());
  const [isMobileView, setIsMobileView] = useState(false);

  // Quick Poll Launcher Form State
  const [question, setQuestion] = useState('');
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');
  const [launching, setLaunching] = useState(false);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Access control: only accessible to 'streamer' or 'admin' roles
  const SUPER_ADMIN_EMAIL = 'erendjeagerist@gmail.com';
  const isSuperAdmin = user?.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
  const userRole = profile?.role || (profile?.subscription_tier === 'admin' ? 'admin' : profile?.subscription_tier === 'streamer' ? 'streamer' : 'member');
  const isStreamer = userRole === 'streamer';
  const isAdmin = isSuperAdmin || userRole === 'admin';
  const hasAccess = isStreamer || isAdmin;

  // Real-time clock tick for countdown timers
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch streamer polls & real-time vote tallies
  const fetchPollsAndVotes = useCallback(async () => {
    try {
      // 1. Fetch polls (ordered by creation date desc)
      const { data: pollsData, error: pollsError } = await supabase
        .from('polls')
        .select('*')
        .order('created_at', { ascending: false });

      if (pollsError) {
        console.error('Error fetching streamer polls:', pollsError);
        return;
      }

      const allPolls = (pollsData as Poll[]) || [];
      setPolls(allPolls);

      // 2. Fetch all votes from poll_votes to tally live vote counts
      if (allPolls.length > 0) {
        const pollIds = allPolls.map((p) => p.id);
        const { data: votesData, error: votesError } = await supabase
          .from('poll_votes')
          .select('poll_id, option_id')
          .in('poll_id', pollIds);

        const counts: Record<string, number> = {};
        const totals: Record<string, number> = {};

        // Seed with base votes from options if any
        allPolls.forEach((poll) => {
          let pTotal = 0;
          poll.options?.forEach((opt) => {
            const base = opt.votes || 0;
            counts[opt.id] = base;
            pTotal += base;
          });
          totals[poll.id] = Math.max(poll.total_votes || 0, pTotal);
        });

        // Add real user votes from poll_votes table
        if (!votesError && votesData) {
          votesData.forEach((vote) => {
            counts[vote.option_id] = (counts[vote.option_id] || 0) + 1;
            totals[vote.poll_id] = (totals[vote.poll_id] || 0) + 1;
          });
        }

        setVoteCountsByOption(counts);
        setTotalVotesByPoll(totals);
      }
    } catch (err) {
      console.error('Streamer polls fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPollsAndVotes();

    // Supabase Realtime Subscription for live votes and poll state changes
    const channel = supabase
      .channel('streamer-hub-live')
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

  // Launch Quick Poll (Question, Option A, Option B, expires in 5 minutes)
  const handleLaunchQuickPoll = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!question.trim()) {
      setFormError('Please enter a poll question.');
      return;
    }
    if (!optionA.trim() || !optionB.trim()) {
      setFormError('Please enter both Option A and Option B.');
      return;
    }

    setLaunching(true);
    try {
      const pollId = `poll-${Date.now()}`;
      // Exactly 5 minutes from now as specified in requirements
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

      const options: PollOption[] = [
        { id: 'opt-1', text: optionA.trim(), votes: 0 },
        { id: 'opt-2', text: optionB.trim(), votes: 0 },
      ];

      const newPoll = {
        id: pollId,
        question: question.trim(),
        options: options,
        is_live: true,
        expires_at: expiresAt,
        total_votes: 0,
        bonus_points: 10,
        streamer_name: profile?.username || user?.email?.split('@')[0] || 'Verified Creator',
        streamer_avatar: profile?.avatar || '🎙️',
        created_at: new Date().toISOString(),
      };

      const { error: insertError } = await supabase
        .from('polls')
        .insert(newPoll);

      if (insertError) {
        throw insertError;
      }

      setFormSuccess(
        `⚡ Quick Poll launched! "${question.trim()}" is now live for 5 minutes.`
      );
      setQuestion('');
      setOptionA('');
      setOptionB('');

      await fetchPollsAndVotes();
    } catch (err: any) {
      console.error('Failed to launch quick poll:', err);
      setFormError(err.message || 'Failed to launch quick poll.');
    } finally {
      setLaunching(false);
    }
  };

  // End Poll Early
  const handleEndPoll = async (pollId: string) => {
    setEndingPollId(pollId);
    try {
      const { error } = await supabase
        .from('polls')
        .update({
          is_live: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', pollId);

      if (error) {
        throw error;
      }

      // Update local state immediately
      setPolls((prev) =>
        prev.map((p) => (p.id === pollId ? { ...p, is_live: false } : p))
      );
    } catch (err: any) {
      console.error('Failed to end poll:', err);
      alert(`Failed to end poll: ${err.message}`);
    } finally {
      setEndingPollId(null);
    }
  };

  // Quick preset helper for streamers in the middle of live broadcast
  const handleApplyPreset = (q: string, a: string, b: string) => {
    setQuestion(q);
    setOptionA(a);
    setOptionB(b);
  };

  // Active vs Ended Polls
  const activePolls = useMemo(() => {
    return polls.filter((p) => {
      if (!p.is_live) return false;
      if (p.expires_at) {
        const expTime = new Date(p.expires_at).getTime();
        return expTime > nowTime;
      }
      return true;
    });
  }, [polls, nowTime]);

  const pastPolls = useMemo(() => {
    return polls.filter((p) => {
      if (!p.is_live) return true;
      if (p.expires_at) {
        const expTime = new Date(p.expires_at).getTime();
        return expTime <= nowTime;
      }
      return false;
    });
  }, [polls, nowTime]);

  // Loading state while checking user session
  if (authLoading || (loading && !profile && !isSuperAdmin)) {
    return (
      <div className="min-h-screen bg-[#08090f] text-slate-100 flex flex-col">
        <TopNavigationBar isMobileView={isMobileView} setIsMobileView={setIsMobileView} />
        <main className="flex-1 flex flex-col items-center justify-center py-24 gap-3 font-display">
          <div className="w-10 h-10 border-2 border-fuchsia-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-400 uppercase tracking-wider font-bold">
            Loading Creator Hub...
          </p>
        </main>
      </div>
    );
  }

  // ACCESS DENIED VIEW: Only accessible to 'streamer' or 'admin'
  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-[#08090f] text-slate-100 flex flex-col font-display">
        <TopNavigationBar isMobileView={isMobileView} setIsMobileView={setIsMobileView} />
        <main className="flex-1 max-w-xl mx-auto px-4 py-16 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 rounded-3xl bg-fuchsia-950/60 border-2 border-fuchsia-500/50 flex items-center justify-center text-fuchsia-400 mb-6 shadow-2xl shadow-fuchsia-950/80">
            <Lock className="w-10 h-10" />
          </div>

          <span className="px-3 py-1 rounded-full bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-400/40 text-xs font-bold uppercase tracking-wider mb-3">
            Creator Account Required
          </span>

          <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight mb-3">
            Unlock the Streamer Dashboard
          </h1>

          <p className="text-sm text-slate-300 mb-8 max-w-md leading-relaxed">
            The Creator Hub is exclusively available to verified Streamers and Administrators. Upgrade to launch live 5-minute audience polls, monitor real-time vote metrics, and engage your esports community.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-sm">
            <Link
              to="/profile"
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-fuchsia-600 via-pink-600 to-violet-600 hover:from-fuchsia-500 hover:to-violet-500 text-white font-bold text-xs uppercase tracking-wider transition shadow-xl shadow-fuchsia-950/60 border border-fuchsia-300/40 flex items-center justify-center gap-2"
            >
              <Crown className="w-4 h-4 text-amber-300" />
              <span>Unlock Free 30-Day Trial</span>
            </Link>

            <Link
              to="/dashboard"
              className="w-full py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold text-xs uppercase tracking-wider transition"
            >
              Back to Dashboard
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#08090f] text-slate-100 flex flex-col font-display">
      <TopNavigationBar isMobileView={isMobileView} setIsMobileView={setIsMobileView} />

      <main
        className={`flex-1 transition-all duration-300 mx-auto w-full px-4 sm:px-6 py-6 ${
          isMobileView
            ? 'max-w-md border-x border-slate-800 bg-[#0c0d16]/95 min-h-screen shadow-2xl'
            : 'max-w-6xl'
        }`}
      >
        {/* Top Breadcrumb & Controls */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#0e101a] border border-slate-800 hover:border-fuchsia-500/50 hover:text-fuchsia-300 text-slate-300 text-xs font-bold uppercase tracking-wider transition group shadow-md"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>Back to Dashboard</span>
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              title="Refresh Live Tallies"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0e101a] border border-slate-800 hover:border-fuchsia-500/40 text-slate-300 text-xs font-bold uppercase tracking-wider transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-fuchsia-400' : ''}`} />
              <span className="hidden sm:inline">Sync Live</span>
            </button>

            <Link
              to="/polls"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-950/60 border border-violet-500/40 hover:border-violet-400 text-cyan-300 text-xs font-bold uppercase tracking-wider transition shadow-sm"
            >
              <span>Viewer Arena</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* HERO BANNER: STREAMER STUDIO */}
        <section className="bg-gradient-to-r from-fuchsia-950/40 via-[#141224] to-[#0c0d16] border border-fuchsia-500/40 rounded-3xl p-6 sm:p-8 mb-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-72 h-72 bg-fuchsia-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start sm:items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-fuchsia-600 to-pink-500 border border-fuchsia-300/40 flex items-center justify-center text-white shrink-0 shadow-xl shadow-fuchsia-950/70">
                <Radio className="w-7 h-7 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
                    LIVE BROADCAST STUDIO
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-400/40">
                    {isAdmin ? 'Admin / Host Privileges' : 'Creator Tier Active'}
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
                  Creator Hub
                </h1>
                <p className="text-xs sm:text-sm text-slate-300 max-w-xl mt-1">
                  Deploy rapid 5-minute interactive polls directly to your livestream audience. Track live votes, reveal percentages, and end polls on-demand.
                </p>
              </div>
            </div>

            {/* Streamer Profile Pill */}
            <div className="p-3.5 rounded-2xl bg-[#141628]/80 border border-slate-800 flex items-center gap-3 shrink-0 self-start md:self-auto">
              <div className="w-10 h-10 rounded-xl bg-slate-900 border border-fuchsia-500/40 flex items-center justify-center text-xl overflow-hidden">
                {profile?.avatar && (profile.avatar.startsWith('http') || profile.avatar.includes('/')) ? (
                  <img src={profile.avatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span>{profile?.avatar || '🎙️'}</span>
                )}
              </div>
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>{profile?.username || user?.email?.split('@')[0]}</span>
                  <Crown className="w-3 h-3 text-amber-400" />
                </div>
                <div className="text-[10px] text-fuchsia-300 font-mono">
                  {isAdmin ? 'Super Host' : 'Streamer Account'}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* QUICK POLL LAUNCHER */}
        <section className="bg-[#0e101a] border border-fuchsia-900/40 rounded-3xl p-6 sm:p-8 mb-8 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-fuchsia-600/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-800/80 relative z-10">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-fuchsia-950/80 border border-fuchsia-500/40 text-fuchsia-300">
                <Zap className="w-5 h-5 text-fuchsia-400" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white uppercase tracking-wider">
                  Quick Poll Launcher
                </h2>
                <p className="text-xs text-slate-400">
                  Instant 5-minute countdown. Ideal for live tournament rounds, clutches, and match predictions.
                </p>
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-fuchsia-950/40 border border-fuchsia-500/30 text-fuchsia-300 text-xs font-mono">
              <Clock className="w-3.5 h-3.5 text-fuchsia-400" />
              <span>Expires in 5 Minutes</span>
            </div>
          </div>

          {/* Feedback messages */}
          {formSuccess && (
            <div className="mb-5 p-3.5 rounded-xl bg-emerald-950/50 border border-emerald-500/50 text-emerald-300 text-xs flex items-center gap-2 relative z-10">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{formSuccess}</span>
            </div>
          )}

          {formError && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-950/50 border border-rose-500/50 text-rose-300 text-xs flex items-center gap-2 relative z-10">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Broadcast Quick Presets */}
          <div className="mb-5 relative z-10">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
              Fast Presets for Live Match Moments:
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  handleApplyPreset('Will Team Liquid win the 1v2 clutch?', 'Yes (Clutch God)', 'No (Defuse Secured)')
                }
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-fuchsia-500/40 text-[11px] text-slate-300 hover:text-white transition cursor-pointer"
              >
                1v2 Clutch
              </button>
              <button
                type="button"
                onClick={() =>
                  handleApplyPreset('Who gets First Blood in the next round?', 'Team A', 'Team B')
                }
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-fuchsia-500/40 text-[11px] text-slate-300 hover:text-white transition cursor-pointer"
              >
                First Blood Pick
              </button>
              <button
                type="button"
                onClick={() =>
                  handleApplyPreset('Will this map go into Overtime (OT)?', 'Yes (Overtime)', 'No (Closed Out)')
                }
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-fuchsia-500/40 text-[11px] text-slate-300 hover:text-white transition cursor-pointer"
              >
                Overtime Prediction
              </button>
              <button
                type="button"
                onClick={() =>
                  handleApplyPreset('Will the pistol round be won with an Eco buy?', 'Yes (Eco Win)', 'No (Full Buy Holds)')
                }
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-fuchsia-500/40 text-[11px] text-slate-300 hover:text-white transition cursor-pointer"
              >
                Eco Pistol Round
              </button>
            </div>
          </div>

          <form onSubmit={handleLaunchQuickPoll} className="space-y-4 relative z-10">
            {/* Question Input */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Poll Question <span className="text-fuchsia-400">*</span>
              </label>
              <input
                type="text"
                required
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="e.g. Will Sentinels convert this bonus round on Sunset?"
                className="w-full bg-[#121422] border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-fuchsia-400 focus:ring-1 focus:ring-fuchsia-400/50 transition font-display"
              />
            </div>

            {/* Option A & Option B Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Option A */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>Option A <span className="text-fuchsia-400">*</span></span>
                  <span className="text-[10px] text-cyan-400 font-mono">Team A / Choice 1</span>
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-3 w-5 h-5 rounded-md bg-cyan-950/80 border border-cyan-500/50 text-cyan-300 flex items-center justify-center text-[10px] font-bold">
                    A
                  </div>
                  <input
                    type="text"
                    required
                    value={optionA}
                    onChange={(e) => setOptionA(e.target.value)}
                    placeholder="e.g. Yes / Sentinels"
                    className="w-full bg-[#121422] border border-slate-800 rounded-xl pl-11 pr-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 transition font-display"
                  />
                </div>
              </div>

              {/* Option B */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>Option B <span className="text-fuchsia-400">*</span></span>
                  <span className="text-[10px] text-pink-400 font-mono">Team B / Choice 2</span>
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-3 w-5 h-5 rounded-md bg-pink-950/80 border border-pink-500/50 text-pink-300 flex items-center justify-center text-[10px] font-bold">
                    B
                  </div>
                  <input
                    type="text"
                    required
                    value={optionB}
                    onChange={(e) => setOptionB(e.target.value)}
                    placeholder="e.g. No / Fnatic"
                    className="w-full bg-[#121422] border border-slate-800 rounded-xl pl-11 pr-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-pink-400 focus:ring-1 focus:ring-pink-400/50 transition font-display"
                  />
                </div>
              </div>
            </div>

            {/* Launch Button */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-fuchsia-400" />
                Poll will expire automatically in 5 minutes unless ended early.
              </span>

              <button
                type="submit"
                disabled={launching}
                className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-fuchsia-600 via-pink-600 to-violet-600 hover:from-fuchsia-500 hover:to-violet-500 text-white font-black text-xs uppercase tracking-wider transition shadow-xl shadow-fuchsia-950/60 border border-fuchsia-300/40 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {launching ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Launching Poll...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white" />
                    <span>Launch Poll</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        {/* ACTIVE STREAMER POLLS SECTION */}
        <section className="bg-[#0e101a] border border-violet-900/30 rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800/80">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-violet-950/80 border border-violet-500/40 text-cyan-400">
                <Radio className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <span>Active Streamer Polls</span>
                  <span className="px-2 py-0.5 rounded-full bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-400/40 text-[10px] font-mono">
                    {activePolls.length} Live
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  Live vote counts updating in real-time. Click "End Poll" at any moment to lock final results.
                </p>
              </div>
            </div>

            {/* Tab switcher: Active vs History */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#121422] border border-slate-800 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setActiveTab('active')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
                  activeTab === 'active'
                    ? 'bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Active ({activePolls.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
                  activeTab === 'history'
                    ? 'bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                History ({pastPolls.length})
              </button>
            </div>
          </div>

          {/* ACTIVE POLLS LIST */}
          {activeTab === 'active' && (
            <div>
              {activePolls.length === 0 ? (
                <div className="py-12 text-center max-w-md mx-auto">
                  <div className="w-14 h-14 rounded-2xl bg-[#141628] border border-slate-800 mx-auto mb-3 flex items-center justify-center text-slate-500">
                    <Radio className="w-7 h-7" />
                  </div>
                  <h3 className="text-base font-bold text-white uppercase tracking-tight mb-1">
                    No Live Polls Active Right Now
                  </h3>
                  <p className="text-xs text-slate-400 mb-4">
                    Use the Quick Poll Launcher above to start a 5-minute poll for your viewers.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {activePolls.map((poll) => {
                    const totalVotes = totalVotesByPoll[poll.id] || 0;
                    const optA = poll.options?.[0];
                    const optB = poll.options?.[1];

                    const votesA = optA ? (voteCountsByOption[optA.id] ?? optA.votes ?? 0) : 0;
                    const votesB = optB ? (voteCountsByOption[optB.id] ?? optB.votes ?? 0) : 0;
                    const sumVotes = Math.max(totalVotes, votesA + votesB);

                    const pctA = sumVotes > 0 ? Math.round((votesA / sumVotes) * 100) : 50;
                    const pctB = sumVotes > 0 ? 100 - pctA : 50;

                    // Compute countdown
                    let timeLeftStr = 'Active';
                    let isExpiringSoon = false;
                    if (poll.expires_at) {
                      const expTime = new Date(poll.expires_at).getTime();
                      const diffMs = expTime - nowTime;
                      if (diffMs > 0) {
                        const mins = Math.floor(diffMs / 60000);
                        const secs = Math.floor((diffMs % 60000) / 1000);
                        timeLeftStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
                        if (mins === 0 && secs < 60) isExpiringSoon = true;
                      } else {
                        timeLeftStr = 'Expiring...';
                      }
                    }

                    return (
                      <div
                        key={poll.id}
                        className="p-5 rounded-2xl bg-[#121424] border border-fuchsia-500/30 hover:border-fuchsia-500/50 transition shadow-lg relative overflow-hidden"
                      >
                        {/* Header bar */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
                              LIVE VOTE
                            </span>

                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold flex items-center gap-1 ${
                                isExpiringSoon
                                  ? 'bg-rose-950/80 text-rose-300 border border-rose-500 animate-pulse'
                                  : 'bg-[#181b30] text-fuchsia-300 border border-fuchsia-500/30'
                              }`}
                            >
                              <Clock className="w-3 h-3 text-fuchsia-400" />
                              <span>{timeLeftStr}</span>
                            </span>

                            <span className="text-[11px] text-slate-400 font-mono">
                              Total Votes: <strong className="text-white">{sumVotes}</strong>
                            </span>
                          </div>

                          {/* END POLL BUTTON */}
                          <button
                            type="button"
                            disabled={endingPollId === poll.id}
                            onClick={() => handleEndPoll(poll.id)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 hover:text-white border border-rose-700/60 font-black text-xs uppercase tracking-wider transition cursor-pointer disabled:opacity-50 self-start sm:self-auto shadow-md"
                          >
                            <Square className="w-3.5 h-3.5 fill-rose-400" />
                            <span>{endingPollId === poll.id ? 'Ending...' : 'End Poll'}</span>
                          </button>
                        </div>

                        {/* Question */}
                        <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-tight mb-4">
                          {poll.question}
                        </h3>

                        {/* Live vote comparison breakdown */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                          {/* Option A Card */}
                          <div className="p-3.5 rounded-xl bg-[#0c0d16] border border-cyan-500/30 flex items-center justify-between">
                            <div className="min-w-0">
                              <span className="text-[10px] text-cyan-400 font-mono uppercase font-bold block mb-0.5">
                                Option A
                              </span>
                              <span className="text-sm font-bold text-white truncate block">
                                {optA?.text || 'Option A'}
                              </span>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-lg font-black text-cyan-300 font-mono block">
                                {votesA}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {pctA}% of votes
                              </span>
                            </div>
                          </div>

                          {/* Option B Card */}
                          <div className="p-3.5 rounded-xl bg-[#0c0d16] border border-pink-500/30 flex items-center justify-between">
                            <div className="min-w-0">
                              <span className="text-[10px] text-pink-400 font-mono uppercase font-bold block mb-0.5">
                                Option B
                              </span>
                              <span className="text-sm font-bold text-white truncate block">
                                {optB?.text || 'Option B'}
                              </span>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-lg font-black text-pink-300 font-mono block">
                                {votesB}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {pctB}% of votes
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Visual tug-of-war percentage bar */}
                        <div className="w-full h-3 rounded-full bg-slate-900 overflow-hidden flex shadow-inner">
                          <div
                            style={{ width: `${pctA}%` }}
                            className="bg-gradient-to-r from-cyan-500 to-indigo-500 h-full transition-all duration-500"
                          />
                          <div
                            style={{ width: `${pctB}%` }}
                            className="bg-gradient-to-r from-pink-500 to-fuchsia-500 h-full transition-all duration-500"
                          />
                        </div>

                        {/* Streamer details footer */}
                        <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                          <span>Creator: {poll.streamer_name || 'Streamer'}</span>
                          <span>Poll ID: {poll.id}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* HISTORY (PAST POLLS) LIST */}
          {activeTab === 'history' && (
            <div>
              {pastPolls.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-sm">
                  No completed poll history yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {pastPolls.slice(0, 10).map((poll) => {
                    const totalVotes = totalVotesByPoll[poll.id] || poll.total_votes || 0;
                    const optA = poll.options?.[0];
                    const optB = poll.options?.[1];
                    const votesA = optA ? (voteCountsByOption[optA.id] ?? optA.votes ?? 0) : 0;
                    const votesB = optB ? (voteCountsByOption[optB.id] ?? optB.votes ?? 0) : 0;

                    return (
                      <div
                        key={poll.id}
                        className="p-4 rounded-2xl bg-[#121422] border border-slate-800 hover:border-slate-700 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-slate-400 text-[10px] uppercase font-bold">
                              Ended
                            </span>
                            <span className="text-slate-400 font-mono text-[11px]">
                              {new Date(poll.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <h4 className="font-bold text-white text-sm truncate">
                            {poll.question}
                          </h4>
                          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-3">
                            <span>
                              {optA?.text}: <strong className="text-cyan-300">{votesA}</strong>
                            </span>
                            <span>·</span>
                            <span>
                              {optB?.text}: <strong className="text-pink-300">{votesB}</strong>
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-mono text-sm font-black text-white">
                            {totalVotes} Total Votes
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

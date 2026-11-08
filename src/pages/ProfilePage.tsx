import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import TopNavigationBar from '../components/TopNavigationBar';
import { supabase, withClockDriftRetry } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { Profile } from '../types/database';
import {
  User,
  Camera,
  Upload,
  Trophy,
  Flame,
  Award,
  Zap,
  Target,
  Percent,
  CheckCircle2,
  AlertCircle,
  LogOut,
  ArrowLeft,
  Radio,
  Clock,
  Tv,
  Check,
  Crown,
  Sparkles,
} from 'lucide-react';

export default function ProfilePage() {
  const { user, profile: authProfile, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<Profile | null>(authProfile || null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [isMobileView, setIsMobileView] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Creator Modal & Upgrade State
  const [showCreatorModal, setShowCreatorModal] = useState(false);
  const [upgradingCreator, setUpgradingCreator] = useState(false);
  const [creatorUpgradeError, setCreatorUpgradeError] = useState<string | null>(null);
  const [creatorUpgradeSuccess, setCreatorUpgradeSuccess] = useState<string | null>(null);

  // Fetch real profile from Supabase
  const fetchUserProfile = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await withClockDriftRetry(() =>
        supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle()
      );

      if (error) {
        console.error('Error fetching user profile:', error);
      } else if (data) {
        const p = data as Profile;
        setProfile(p);

        // For regular 'member' accounts, set default trial_ends_at to 14 days from signup if not set
        const currentRole = p.role || (p.subscription_tier === 'admin' ? 'admin' : p.subscription_tier === 'streamer' ? 'streamer' : 'member');
        if (!p.trial_ends_at && currentRole === 'member') {
          const signupDate = p.created_at ? new Date(p.created_at).getTime() : Date.now();
          const default14DayTrial = new Date(signupDate + 14 * 24 * 60 * 60 * 1000).toISOString();
          try {
            await supabase
              .from('profiles')
              .update({ trial_ends_at: default14DayTrial })
              .eq('id', user.id);
            setProfile((prev) => (prev ? { ...prev, trial_ends_at: default14DayTrial } : null));
          } catch (trialErr) {
            console.warn('Could not save default 14-day trial_ends_at:', trialErr);
          }
        }
      }
    } catch (err) {
      console.error('Profile fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchUserProfile();
  }, [fetchUserProfile]);

  // Upgrade to Creator (Streamer) Handler
  const handleUpgradeToCreator = async () => {
    if (!user) return;
    setUpgradingCreator(true);
    setCreatorUpgradeError(null);
    setCreatorUpgradeSuccess(null);

    try {
      const streamerTrialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const updateData: Record<string, any> = {
        role: 'streamer',
        subscription_tier: 'streamer',
        trial_ends_at: streamerTrialEndsAt,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id);

      if (error) {
        // Fallback if trial_ends_at column does not exist yet
        if (error.code === '42703' || error.message?.includes('trial_ends_at')) {
          const fallback = await supabase
            .from('profiles')
            .update({
              role: 'streamer',
              subscription_tier: 'streamer',
              updated_at: new Date().toISOString(),
            })
            .eq('id', user.id);

          if (fallback.error) throw fallback.error;
        } else {
          throw error;
        }
      }

      setCreatorUpgradeSuccess('Welcome to the Creator Tier! Your 30-day free trial is now active.');
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              role: 'streamer',
              subscription_tier: 'streamer',
              trial_ends_at: streamerTrialEndsAt,
            }
          : null
      );
      await refreshProfile();
      setShowCreatorModal(false);
    } catch (err: any) {
      console.error('Failed to upgrade to creator:', err);
      setCreatorUpgradeError(err.message || 'Failed to activate Creator trial. Please try again.');
    } finally {
      setUpgradingCreator(false);
    }
  };

  // Handle Profile Picture File Selection & Upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Reset messages
    setUploadError(null);
    setUploadSuccess(null);
    setUploading(true);

    try {
      // 1. Determine file extension
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const filePath = `user-${user.id}.${fileExt}`;

      // 2. Upload file to Supabase Storage in 'avatars' bucket
      const { error: uploadErr } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadErr) {
        // If bucket does not exist or storage has permission issues
        if (
          uploadErr.message?.toLowerCase().includes('bucket not found') ||
          (uploadErr as any).statusCode === '404'
        ) {
          throw new Error(
            "The 'avatars' storage bucket has not been created yet in your Supabase project. Create a public bucket named 'avatars' in Supabase Dashboard > Storage."
          );
        }
        throw uploadErr;
      }

      // 3. Get Public URL
      const { data: publicUrlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const publicUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;

      // 4. Update the avatar column in the profiles table
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({
          avatar: publicUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateErr) {
        throw updateErr;
      }

      // 5. Update local state and auth context immediately
      setProfile((prev) => (prev ? { ...prev, avatar: publicUrl } : null));
      await refreshProfile();
      setUploadSuccess('Profile picture updated successfully!');
    } catch (err: any) {
      console.error('Avatar upload failed:', err);
      setUploadError(err.message || 'Failed to upload profile picture.');
    } finally {
      setUploading(false);
      // Reset input value
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  // Calculations
  const totalPredictions = profile?.total_predictions ?? 0;
  const correctPredictions = profile?.correct_predictions ?? 0;
  const winRate =
    totalPredictions > 0
      ? Math.round((correctPredictions / totalPredictions) * 100)
      : 0;

  const currentStreak = profile?.current_streak ?? 0;
  const bestStreak = profile?.best_streak ?? 0;
  const totalPoints = profile?.points ?? 0;
  const badges = profile?.badges || [];

  // Helper to determine if avatar is an image URL
  const isImageUrl = (avatarStr?: string | null) => {
    if (!avatarStr) return false;
    return (
      avatarStr.startsWith('http://') ||
      avatarStr.startsWith('https://') ||
      avatarStr.startsWith('data:') ||
      avatarStr.includes('/')
    );
  };

  return (
    <div className="min-h-screen bg-[#08090f] text-slate-100 flex flex-col">
      <TopNavigationBar isMobileView={isMobileView} setIsMobileView={setIsMobileView} />

      <main
        className={`flex-1 transition-all duration-300 mx-auto w-full px-4 sm:px-6 py-6 ${
          isMobileView
            ? 'max-w-md border-x border-slate-800 bg-[#0c0d16]/95 min-h-screen shadow-2xl'
            : 'max-w-4xl'
        }`}
      >
        {/* Navigation Back */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#0e101a] border border-slate-800 hover:border-violet-500/50 hover:text-cyan-300 text-slate-300 text-xs font-bold font-display uppercase tracking-wider transition group shadow-md"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>Back to Dashboard</span>
          </Link>
        </div>

        {/* PROFILE HEADER CARD */}
        <section className="bg-gradient-to-b from-[#121422] via-[#0e101a] to-[#08090f] border border-violet-900/30 rounded-3xl p-6 sm:p-8 mb-8 shadow-2xl relative overflow-hidden font-display">
          {/* Subtle neon glow orbs */}
          <div className="absolute top-0 left-1/4 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-0 right-1/4 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Avatar Image + Upload Overlay */}
            <div className="relative group shrink-0">
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl bg-[#141626] border-2 border-violet-500/50 flex items-center justify-center overflow-hidden shadow-2xl shadow-violet-950/60 transition group-hover:border-cyan-400">
                {isImageUrl(profile?.avatar) ? (
                  <img
                    src={profile?.avatar || ''}
                    alt={profile?.username || 'Player Avatar'}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : profile?.avatar ? (
                  <span className="text-5xl">{profile.avatar}</span>
                ) : (
                  /* Default Placeholder Icon */
                  <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-slate-400">
                    <User className="w-12 h-12 text-slate-500" />
                  </div>
                )}
              </div>

              {/* Upload Trigger Button Badge */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                title="Upload Profile Picture"
                className="absolute -bottom-2 -right-2 p-2.5 rounded-2xl bg-gradient-to-r from-violet-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 text-white shadow-lg shadow-violet-950/60 border border-violet-300/40 cursor-pointer transition transform hover:scale-105 disabled:opacity-50"
              >
                {uploading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
              </button>

              {/* Hidden File Input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png, image/jpeg, image/webp"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {/* Profile Info & Upload Button */}
            <div className="flex-1 text-center sm:text-left min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight truncate">
                    {profile?.username || user?.email?.split('@')[0] || 'Esports Player'}
                  </h1>
                  <p className="text-xs text-slate-400 font-mono mt-0.5 truncate">
                    {user?.email}
                  </p>
                </div>

                {/* Explicit "Upload Profile Picture" Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 text-white font-bold text-xs uppercase tracking-wider transition shadow-lg shadow-violet-950/50 border border-violet-400/30 cursor-pointer disabled:opacity-50"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploading ? 'Uploading...' : 'Upload Profile Picture'}</span>
                </button>
              </div>

              {/* Success / Error Feedback */}
              {uploadSuccess && (
                <div className="mt-3 p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{uploadSuccess}</span>
                </div>
              )}

              {uploadError && (
                <div className="mt-3 p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Creator Upgrade Feedback */}
              {creatorUpgradeSuccess && (
                <div className="mt-3 p-2.5 rounded-xl bg-fuchsia-950/50 border border-fuchsia-500/40 text-fuchsia-200 text-xs flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-fuchsia-400 shrink-0" />
                    <span>{creatorUpgradeSuccess}</span>
                  </div>
                  <Link
                    to="/streamer"
                    className="px-2.5 py-1 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold text-[11px] uppercase tracking-wider transition"
                  >
                    Open Hub &rarr;
                  </Link>
                </div>
              )}

              {creatorUpgradeError && (
                <div className="mt-3 p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{creatorUpgradeError}</span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* CREATOR TIER & UPGRADE SECTION */}
        {(() => {
          const currentRole = profile?.role || (profile?.subscription_tier === 'admin' ? 'admin' : profile?.subscription_tier === 'streamer' ? 'streamer' : 'member');
          const isStreamer = currentRole === 'streamer';
          const isAdmin = user?.email?.toLowerCase() === 'erendjeagerist@gmail.com' || currentRole === 'admin';

          // Calculate trial days left
          let trialDaysLeft = 30;
          let trialDateFormatted = '';
          if (profile?.trial_ends_at) {
            const end = new Date(profile.trial_ends_at).getTime();
            const now = Date.now();
            trialDaysLeft = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
            trialDateFormatted = new Date(profile.trial_ends_at).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });
          }

          if (isStreamer || isAdmin) {
            return (
              <section className="mb-8 p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-fuchsia-950/40 via-[#141224] to-[#0c0d16] border border-fuchsia-500/40 shadow-2xl relative overflow-hidden font-display">
                <div className="absolute top-0 right-0 w-64 h-64 bg-fuchsia-600/10 rounded-full blur-3xl pointer-events-none" />
                <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start sm:items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-fuchsia-600 to-pink-500 border border-fuchsia-300/40 flex items-center justify-center text-white shrink-0 shadow-lg shadow-fuchsia-950/60">
                      <Radio className="w-6 h-6 animate-pulse" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-400/40">
                          {isAdmin ? 'Admin / Creator Status' : 'Creator Tier Active'}
                        </span>
                        {profile?.trial_ends_at && (
                          <span className="text-[11px] text-fuchsia-200/90 font-mono flex items-center gap-1">
                            <Clock className="w-3 h-3 text-fuchsia-400" />
                            {trialDaysLeft} days remaining ({trialDateFormatted})
                          </span>
                        )}
                      </div>
                      <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-tight">
                        Streamer Dashboard & Live Polls
                      </h3>
                      <p className="text-xs text-slate-400">
                        Free for 30 days, then $29.99/mo. Launch 5-minute quick polls and track audience engagement.
                      </p>
                    </div>
                  </div>

                  <Link
                    to="/streamer"
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-fuchsia-600 via-pink-600 to-violet-600 hover:from-fuchsia-500 hover:to-violet-500 text-white font-bold text-xs uppercase tracking-wider transition shadow-xl shadow-fuchsia-950/60 border border-fuchsia-300/40 shrink-0"
                  >
                    <Radio className="w-4 h-4" />
                    <span>Open Creator Hub</span>
                  </Link>
                </div>
              </section>
            );
          }

          // Regular Member View: Prompt to Become a Creator
          return (
            <section className="mb-8 p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-purple-950/30 via-[#101222] to-[#0c0d16] border border-violet-500/30 hover:border-fuchsia-500/50 transition shadow-xl relative overflow-hidden font-display">
              <div className="absolute top-0 right-0 w-64 h-64 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
              <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-[#17192e] border border-violet-500/40 flex items-center justify-center text-fuchsia-400 shrink-0 shadow-lg">
                    <Radio className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-violet-500/20 text-violet-300 border border-violet-400/30">
                        Creator Upgrade Available
                      </span>
                      {profile?.trial_ends_at && (
                        <span className="text-[11px] text-slate-400 font-mono">
                          Member trial: {trialDaysLeft} days left
                        </span>
                      )}
                    </div>
                    <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-tight">
                      Become a Creator
                    </h3>
                    <p className="text-xs text-slate-400 max-w-xl">
                      Unlock the Streamer Dashboard. Free for 30 days, then $29.99/mo. Launch 5-minute interactive quick polls for your stream.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowCreatorModal(true)}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-fuchsia-600 via-pink-600 to-violet-600 hover:from-fuchsia-500 hover:to-violet-500 text-white font-bold text-xs uppercase tracking-wider transition shadow-xl shadow-fuchsia-950/60 border border-fuchsia-300/40 cursor-pointer shrink-0 transform hover:scale-[1.02]"
                >
                  <Crown className="w-4 h-4 text-amber-300" />
                  <span>Become a Creator</span>
                </button>
              </div>
            </section>
          );
        })()}

        {/* BECOME A CREATOR MODAL */}
        {showCreatorModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="relative w-full max-w-lg bg-[#0e101c] border-2 border-fuchsia-500/50 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-fuchsia-950/80 font-display">
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setShowCreatorModal(false)}
                className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition cursor-pointer"
              >
                ✕
              </button>

              {/* Modal Icon & Header */}
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-fuchsia-600 to-pink-500 border border-fuchsia-300/40 mx-auto mb-3 flex items-center justify-center text-white shadow-xl shadow-fuchsia-950/60">
                  <Radio className="w-8 h-8 animate-pulse" />
                </div>
                <h3 className="text-2xl font-black text-white uppercase tracking-tight">
                  Unlock the Streamer Dashboard
                </h3>
                <div className="mt-1.5 inline-block px-3 py-1 rounded-full bg-fuchsia-500/20 border border-fuchsia-400/40 text-fuchsia-300 text-xs font-bold font-mono">
                  Free for 30 days, then $29.99/mo.
                </div>
              </div>

              {/* Value Proposition Highlights */}
              <div className="space-y-3 mb-6 bg-[#141628]/60 p-4 rounded-2xl border border-violet-900/40">
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-fuchsia-500/20 text-fuchsia-400 flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">
                    ✓
                  </div>
                  <div className="text-xs">
                    <span className="font-bold text-white uppercase tracking-wide">
                      5-Minute Quick Polls:
                    </span>{' '}
                    <span className="text-slate-300">
                      Instantly engage your live audience with high-speed tournament polls.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-fuchsia-500/20 text-fuchsia-400 flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">
                    ✓
                  </div>
                  <div className="text-xs">
                    <span className="font-bold text-white uppercase tracking-wide">
                      Real-Time Live Voting Telemetry:
                    </span>{' '}
                    <span className="text-slate-300">
                      Watch spectator votes flow in with live percentages and instant results.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-fuchsia-500/20 text-fuchsia-400 flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">
                    ✓
                  </div>
                  <div className="text-xs">
                    <span className="font-bold text-white uppercase tracking-wide">
                      Instant "End Poll" Control:
                    </span>{' '}
                    <span className="text-slate-300">
                      Conclude predictions the moment a round or clutch ends.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-fuchsia-500/20 text-fuchsia-400 flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">
                    ✓
                  </div>
                  <div className="text-xs">
                    <span className="font-bold text-white uppercase tracking-wide">
                      Verified Streamer Badge:
                    </span>{' '}
                    <span className="text-slate-300">
                      Featured profile distinction across all SecondScreen esports arenas.
                    </span>
                  </div>
                </div>
              </div>

              {/* Terms */}
              <p className="text-[11px] text-slate-400 text-center mb-6">
                Your 30-day free trial activates immediately. You can cancel anytime before the trial ends without penalty.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreatorModal(false)}
                  disabled={upgradingCreator}
                  className="w-full sm:w-1/3 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-bold text-xs uppercase tracking-wider transition cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleUpgradeToCreator}
                  disabled={upgradingCreator}
                  className="w-full sm:w-2/3 py-3 rounded-2xl bg-gradient-to-r from-fuchsia-600 via-pink-600 to-violet-600 hover:from-fuchsia-500 hover:to-violet-500 text-white font-black text-xs uppercase tracking-wider transition shadow-xl shadow-fuchsia-950/60 border border-fuchsia-300/40 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {upgradingCreator ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Activating Free Trial...</span>
                    </>
                  ) : (
                    <>
                      <Crown className="w-4 h-4 text-amber-300" />
                      <span>Confirm & Start 30-Day Free Trial</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STATS MATRIX SECTION */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4 font-display">
            <Trophy className="w-4 h-4 text-cyan-400" />
            <h2 className="text-base font-bold text-white uppercase tracking-wider">
              Player Performance Stats
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 font-display">
            {/* Total Points */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#0e101a] border border-violet-900/40 relative overflow-hidden shadow-xl">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span>Total Points</span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-amber-300 font-mono">
                {totalPoints}
              </div>
              <span className="text-[10px] text-slate-500 uppercase font-semibold">
                Earned from Arena
              </span>
            </div>

            {/* Current Streak */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#0e101a] border border-violet-900/40 relative overflow-hidden shadow-xl">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-cyan-400" />
                <span>Current Streak</span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-cyan-300 font-mono">
                {currentStreak}d
              </div>
              <span className="text-[10px] text-slate-500 uppercase font-semibold">
                Consecutive Days
              </span>
            </div>

            {/* Best Streak */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#0e101a] border border-violet-900/40 relative overflow-hidden shadow-xl">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-purple-400" />
                <span>Best Streak</span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-purple-300 font-mono">
                {bestStreak}d
              </div>
              <span className="text-[10px] text-slate-500 uppercase font-semibold">
                All-Time Peak
              </span>
            </div>

            {/* Win Rate */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#0e101a] border border-violet-900/40 relative overflow-hidden shadow-xl">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1.5">
                <Percent className="w-3.5 h-3.5 text-emerald-400" />
                <span>Win Rate</span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-300 font-mono">
                {winRate}%
              </div>
              <span className="text-[10px] text-slate-500 uppercase font-semibold">
                Prediction Accuracy
              </span>
            </div>

            {/* Correct Predictions */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#0e101a] border border-violet-900/40 relative overflow-hidden shadow-xl">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>Correct Picks</span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-white font-mono">
                {correctPredictions}
              </div>
              <span className="text-[10px] text-slate-500 uppercase font-semibold">
                Matches Won
              </span>
            </div>

            {/* Total Predictions */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#0e101a] border border-violet-900/40 relative overflow-hidden shadow-xl">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-slate-400" />
                <span>Total Predictions</span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-white font-mono">
                {totalPredictions}
              </div>
              <span className="text-[10px] text-slate-500 uppercase font-semibold">
                Picks Placed
              </span>
            </div>
          </div>
        </section>

        {/* UNLOCKED BADGES SECTION */}
        <section className="bg-[#0e101a] border border-violet-900/30 rounded-3xl p-6 sm:p-8 mb-8 shadow-xl font-display">
          <div className="flex items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-cyan-400" />
              <h3 className="text-base font-bold text-white uppercase tracking-wider">
                Unlocked Badges
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              {badges.length} {badges.length === 1 ? 'Badge' : 'Badges'}
            </span>
          </div>

          {badges.length === 0 ? (
            <div className="py-8 text-center max-w-md mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-[#141626] border border-slate-800 mx-auto mb-3 flex items-center justify-center text-slate-400">
                <Award className="w-6 h-6 text-slate-500" />
              </div>
              <h4 className="text-sm font-bold text-white mb-1">
                No Badges Unlocked Yet
              </h4>
              <p className="text-xs text-slate-400">
                Earn badges by building prediction streaks, voting in live match polls, and climbing the arena leaderboard.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {badges.map((badge, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl bg-[#141628] border border-cyan-500/30 flex items-center gap-3 shadow-md"
                >
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center text-slate-950 font-bold shrink-0">
                    <Sparkles className="w-4 h-4 text-slate-950" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">{badge}</div>
                    <div className="text-[10px] text-cyan-400 uppercase font-semibold">
                      Unlocked
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* SIGN OUT SECTION */}
        <section className="pt-2 pb-6 border-t border-slate-800/80 flex items-center justify-center font-display">
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-rose-950/40 hover:bg-rose-950/60 border border-rose-800/60 text-rose-300 hover:text-rose-200 font-bold text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 cursor-pointer shadow-lg"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out of SecondScreen</span>
          </button>
        </section>
      </main>
    </div>
  );
}

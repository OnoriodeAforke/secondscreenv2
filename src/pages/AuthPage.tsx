import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, User as UserIcon, AlertCircle, ArrowRight, ShieldCheck, RefreshCw } from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();

  // Redirect if already authenticated
  React.useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setSubmitting(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email.trim(), password);
        if (error) {
          if (error.status === 429 || error.message?.includes('429') || error.message?.toLowerCase().includes('too many requests')) {
            setErrorMsg('Rate limit reached (HTTP 429). Supabase has temporarily throttled authentication attempts. Please wait 30–60 seconds, or use "Reset Auth Cache" below.');
          } else if (error.message?.toLowerCase().includes('failed to fetch')) {
            setErrorMsg('Failed to connect to Supabase: The project appears to be paused due to inactivity (free-tier projects pause after 7 days). Please go to supabase.com/dashboard and click "Restore project", or verify your database URL.');
          } else {
            setErrorMsg(error.message || 'Invalid email or password.');
          }
        } else {
          navigate('/dashboard');
        }
      } else {
        if (!username.trim()) {
          setErrorMsg('Please choose a username for your player card.');
          setSubmitting(false);
          return;
        }
        if (password.length < 6) {
          setErrorMsg('Password must be at least 6 characters long.');
          setSubmitting(false);
          return;
        }

        const { error, data } = await signUp(email.trim(), password, username.trim());
        if (error) {
          if (error.status === 429 || error.message?.includes('429') || error.message?.toLowerCase().includes('too many requests')) {
            setErrorMsg('Rate limit reached (HTTP 429). Supabase has temporarily paused signups to prevent abuse. Please wait 60 seconds.');
          } else if (error.message?.toLowerCase().includes('failed to fetch')) {
            setErrorMsg('Failed to connect to Supabase: The project appears to be paused due to inactivity. Please go to supabase.com/dashboard and click "Restore project".');
          } else {
            setErrorMsg(error.message);
          }
        } else if (data?.user && !data?.session) {
          setInfoMsg('Account registered! If confirmation is required, please check your email, or sign in.');
          setIsLogin(true);
        } else {
          navigate('/dashboard');
        }
      }
    } catch (err: any) {
      if (err?.status === 429 || err?.message?.includes('429')) {
        setErrorMsg('Rate limit reached (HTTP 429). Please wait 30–60 seconds before trying again.');
      } else if (err?.message?.toLowerCase().includes('failed to fetch')) {
        setErrorMsg('Failed to connect to Supabase: The database project is paused or offline. Visit supabase.com/dashboard to unpause/restore it.');
      } else {
        setErrorMsg(err.message || 'An unexpected authentication error occurred.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetCache = () => {
    try {
      window.localStorage.clear();
    } catch (e) {}
    setErrorMsg(null);
    setInfoMsg('Local session cache cleared. You can now try signing in fresh.');
  };

  return (
    <div className="min-h-screen bg-[#08090f] flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Background ambient lighting - Electric Violet & Cyan */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand header */}
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="mb-3">
            <BrandLogo
              className="flex items-center justify-center gap-3.5"
              iconClassName="w-12 h-12"
              textClassName="text-3xl"
            />
          </div>
          <p className="text-slate-400 text-sm font-medium">
            The live companion platform for real-time predictions & polls
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-[#0e101a]/95 border border-violet-900/40 rounded-2xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl shadow-violet-950/40">
          {/* Mode Switcher */}
          <div className="flex bg-[#080911] p-1 rounded-xl mb-6 border border-slate-800/90 font-display">
            <button
              type="button"
              onClick={() => {
                setIsLogin(true);
                setErrorMsg(null);
                setInfoMsg(null);
              }}
              className={`flex-1 py-2.5 text-xs font-bold rounded-lg uppercase tracking-wider transition cursor-pointer ${
                isLogin
                  ? 'bg-gradient-to-r from-violet-600 to-cyan-500 text-white shadow-md shadow-violet-950/60'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setIsLogin(false);
                setErrorMsg(null);
                setInfoMsg(null);
              }}
              className={`flex-1 py-2.5 text-xs font-bold rounded-lg uppercase tracking-wider transition cursor-pointer ${
                !isLogin
                  ? 'bg-gradient-to-r from-violet-600 to-cyan-500 text-white shadow-md shadow-violet-950/60'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Alerts */}
          {errorMsg && (
            <div className="mb-5 p-3 rounded-xl bg-rose-950/50 border border-rose-800/60 flex items-start gap-3 text-rose-300 text-xs font-display">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {infoMsg && (
            <div className="mb-5 p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 flex items-start gap-3 text-emerald-300 text-xs font-display">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{infoMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-display">
                  Display Username
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required={!isLogin}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. ApexPredator"
                    className="w-full bg-[#080912] border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 transition font-display"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-display">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="player@esports.com"
                  className="w-full bg-[#080912] border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 transition font-sans"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-display">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#080912] border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 transition"
                />
              </div>
              {!isLogin && (
                <p className="text-[11px] text-slate-500 mt-1 font-display">Minimum 6 characters</p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-violet-950/60 disabled:opacity-50 transition border border-violet-400/30 cursor-pointer font-display uppercase tracking-wider"
            >
              {submitting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>{isLogin ? 'Sign In to Play' : 'Join SecondScreen'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Clear Session Button */}
          <div className="mt-5 pt-3.5 border-t border-slate-800/90 flex items-center justify-between text-xs text-slate-500 font-display">
            <span>Stuck on rate limit?</span>
            <button
              type="button"
              onClick={handleResetCache}
              className="text-cyan-400 hover:text-cyan-300 font-semibold transition cursor-pointer"
            >
              Reset Auth Cache
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

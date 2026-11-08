import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Smartphone, ChevronDown, Menu, X, Shield, User, LogOut, Zap, Trophy, Radio, Sparkles } from 'lucide-react';
import { BrandLogo } from './BrandLogo';

interface TopNavigationBarProps {
  isMobileView?: boolean;
  setIsMobileView?: (val: boolean | ((prev: boolean) => boolean)) => void;
}

export default function TopNavigationBar({ isMobileView, setIsMobileView }: TopNavigationBarProps) {
  const { user, profile, signOut } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  const streakDays = profile?.current_streak ?? 0;
  const points = profile?.points ?? 0;

  const userRole = profile?.role || (profile?.subscription_tier === 'admin' ? 'admin' : profile?.subscription_tier === 'streamer' ? 'streamer' : 'member');
  const isStreamer = userRole === 'streamer';
  const isAdmin =
    user?.email?.toLowerCase() === 'erendjeagerist@gmail.com' ||
    userRole === 'admin';
  const hasCreatorAccess = isStreamer || isAdmin;

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard' || location.pathname.startsWith('/match/');
    }
    return location.pathname === path;
  };

  return (
    <header className="sticky top-0 z-50 bg-[#080911]/95 backdrop-blur-md border-b border-indigo-950/70 px-4 sm:px-6 py-2.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Left: Brand Logo & Navigation links */}
        <div className="flex items-center gap-6 lg:gap-8">
          <Link to="/dashboard">
            <BrandLogo />
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            {/* Predictions */}
            <Link
              to="/dashboard"
              className={`relative px-3.5 py-2 rounded-lg text-xs font-bold tracking-wide uppercase transition font-display ${
                isActive('/dashboard')
                  ? 'text-white bg-violet-950/50 border border-violet-500/40 shadow-sm shadow-violet-950/50'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              Predictions
              {isActive('/dashboard') && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-gradient-to-r from-violet-500 via-indigo-500 to-cyan-400 rounded-full" />
              )}
            </Link>

            {/* Live Polls (with neon cyan-violet pulse dot) */}
            <Link
              to="/polls"
              className={`relative px-3.5 py-2 rounded-lg text-xs font-bold tracking-wide uppercase transition flex items-center gap-2 font-display ${
                isActive('/polls')
                  ? 'text-white bg-violet-950/50 border border-violet-500/40 shadow-sm shadow-violet-950/50'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <span>Live Polls</span>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400"></span>
              </span>
              {isActive('/polls') && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-gradient-to-r from-violet-500 via-indigo-500 to-cyan-400 rounded-full" />
              )}
            </Link>

            {/* Creator Hub (visible to streamers and admins) */}
            {hasCreatorAccess && (
              <Link
                to="/streamer"
                className={`relative px-3.5 py-2 rounded-lg text-xs font-bold tracking-wide uppercase transition flex items-center gap-1.5 font-display ${
                  isActive('/streamer')
                    ? 'text-fuchsia-200 bg-fuchsia-950/50 border border-fuchsia-500/40 shadow-sm shadow-fuchsia-950/50'
                    : 'text-fuchsia-300 hover:text-fuchsia-100 hover:bg-fuchsia-950/30'
                }`}
              >
                <Radio className="w-3.5 h-3.5 text-fuchsia-400 animate-pulse" />
                <span>Creator Hub</span>
                {isActive('/streamer') && (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-gradient-to-r from-fuchsia-500 via-pink-500 to-cyan-400 rounded-full" />
                )}
              </Link>
            )}

            {/* Streamers */}
            <Link
              to="/dashboard#streamers"
              className="px-3.5 py-2 rounded-lg text-xs font-bold tracking-wide uppercase text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 transition font-display"
            >
              Streamers
            </Link>

            {/* Leaderboard */}
            <Link
              to="/leaderboard"
              className={`relative px-3.5 py-2 rounded-lg text-xs font-bold tracking-wide uppercase transition font-display ${
                isActive('/leaderboard')
                  ? 'text-white bg-violet-950/50 border border-violet-500/40 shadow-sm shadow-violet-950/50'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              Leaderboard
              {isActive('/leaderboard') && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-gradient-to-r from-violet-500 via-indigo-500 to-cyan-400 rounded-full" />
              )}
            </Link>

            {/* Arcade */}
            <Link
              to="/dashboard#arcade"
              className="px-3.5 py-2 rounded-lg text-xs font-bold tracking-wide uppercase text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 transition font-display"
            >
              Arcade
            </Link>

            {/* Wrapped '26 Story */}
            <Link
              to="/wrapped"
              className={`relative px-3 py-1.5 rounded-lg text-xs font-bold tracking-wide uppercase transition flex items-center gap-1.5 font-display ${
                isActive('/wrapped')
                  ? 'text-cyan-200 bg-purple-950/60 border border-cyan-500/50 shadow-md shadow-purple-950/60'
                  : 'text-purple-300 hover:text-white hover:bg-purple-950/30 border border-purple-500/30'
              }`}
            >
              <Sparkles className="w-3 h-3 text-cyan-400 animate-pulse" />
              <span className="bg-gradient-to-r from-purple-300 to-cyan-300 bg-clip-text text-transparent font-black">Wrapped</span>
            </Link>

            {/* More Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setMoreMenuOpen(!moreMenuOpen)}
                className="px-3 py-2 rounded-lg text-xs font-bold tracking-wide uppercase text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 transition flex items-center gap-1 cursor-pointer font-display"
              >
                <span>More</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              {moreMenuOpen && (
                <div
                  className="absolute left-0 mt-2 w-48 bg-[#0f111d] border border-violet-900/40 rounded-xl shadow-2xl py-1.5 z-50 backdrop-blur-xl"
                  onMouseLeave={() => setMoreMenuOpen(false)}
                >
                  <Link
                    to="/profile"
                    onClick={() => setMoreMenuOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-xs font-bold text-slate-300 hover:text-white hover:bg-violet-950/50 transition font-display"
                  >
                    <User className="w-3.5 h-3.5 text-cyan-400" />
                    <span>My Profile</span>
                  </Link>
                  <Link
                    to="/wrapped"
                    onClick={() => setMoreMenuOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-xs font-bold text-cyan-300 hover:text-white hover:bg-violet-950/50 transition font-display"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    <span>Wrapped '26</span>
                  </Link>
                  {hasCreatorAccess && (
                    <Link
                      to="/streamer"
                      onClick={() => setMoreMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-xs font-bold text-fuchsia-300 hover:text-white hover:bg-fuchsia-950/50 transition font-display"
                    >
                      <Radio className="w-3.5 h-3.5 text-fuchsia-400" />
                      <span>Creator Hub</span>
                    </Link>
                  )}
                  {isAdmin && (
                    <Link
                      to="/admin"
                      onClick={() => setMoreMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-xs font-bold text-slate-300 hover:text-white hover:bg-violet-950/50 transition font-display"
                    >
                      <Shield className="w-3.5 h-3.5 text-violet-400" />
                      <span>Admin Arena</span>
                    </Link>
                  )}
                  <div className="border-t border-slate-800/80 my-1" />
                  <button
                    onClick={() => {
                      setMoreMenuOpen(false);
                      signOut();
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-bold text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 transition text-left cursor-pointer font-display"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </nav>
        </div>

        {/* Right side: streak badge, points badge, phone toggle, and avatar / sign-in button */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Streak badge (🔥 12d) with electric magenta/purple styling */}
          <div
            title="Active Prediction Streak"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-purple-950/80 to-violet-950/80 border border-purple-500/40 text-purple-300 font-display text-xs font-bold shadow-sm shadow-purple-950/50"
          >
            <span className="text-xs">⚡</span>
            <span>{streakDays}d</span>
          </div>

          {/* Points badge (165) with electric cyan styling */}
          <div
            title="Your Total Points"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-950/80 to-cyan-950/80 border border-cyan-500/40 text-cyan-300 font-display text-xs font-bold shadow-sm shadow-cyan-950/50"
          >
            <span className="text-cyan-400/80 text-[10px] tracking-wider uppercase">PTS</span>
            <span className="text-white font-bold">{points}</span>
          </div>

          {/* Phone toggle */}
          {setIsMobileView && (
            <button
              onClick={() => setIsMobileView((prev) => !prev)}
              title={isMobileView ? 'Exit Phone View' : 'Toggle Phone Companion View'}
              className={`p-2 rounded-lg border transition hidden sm:flex items-center justify-center cursor-pointer ${
                isMobileView
                  ? 'bg-gradient-to-r from-violet-600 to-cyan-500 text-white border-cyan-400 shadow-md shadow-violet-950/50'
                  : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border-slate-800 hover:bg-slate-800'
              }`}
            >
              <Smartphone className="w-4 h-4" />
            </button>
          )}

          {/* User Avatar or Sign In button */}
          {user ? (
            <Link
              to="/profile"
              title={`${profile?.username || user?.email || 'Player'} Profile`}
              className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-950/80 to-slate-900 border border-violet-500/40 hover:border-cyan-400 flex items-center justify-center text-base hover:scale-105 transition shadow-sm shadow-violet-950/50 overflow-hidden"
            >
              {profile?.avatar && (profile.avatar.startsWith('http') || profile.avatar.includes('/')) ? (
                <img
                  src={profile.avatar}
                  alt={profile?.username || 'Avatar'}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <span>{profile?.avatar || '⚡'}</span>
              )}
            </Link>
          ) : (
            <Link
              to="/auth"
              className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 text-white font-display font-bold text-xs uppercase tracking-wider transition shadow-md shadow-violet-950/40 border border-violet-400/30 cursor-pointer"
            >
              Sign In
            </Link>
          )}

          {/* Mobile hamburger menu */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 md:hidden text-slate-400 hover:text-white bg-slate-900/80 rounded-lg border border-slate-800 cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden mt-3 pt-3 border-t border-slate-800/90 grid grid-cols-2 gap-2">
          <Link
            to="/dashboard"
            onClick={() => setMobileMenuOpen(false)}
            className={`p-2.5 rounded-lg text-xs font-bold uppercase tracking-wide flex items-center justify-between font-display ${
              isActive('/dashboard') ? 'bg-violet-950/60 text-cyan-300 border border-violet-500/40' : 'bg-slate-900/60 text-slate-300'
            }`}
          >
            Predictions
          </Link>
          <Link
            to="/polls"
            onClick={() => setMobileMenuOpen(false)}
            className={`p-2.5 rounded-lg text-xs font-bold uppercase tracking-wide flex items-center justify-between font-display ${
              isActive('/polls') ? 'bg-violet-950/60 text-cyan-300 border border-violet-500/40' : 'bg-slate-900/60 text-slate-300'
            }`}
          >
            <span>Live Polls</span>
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          </Link>
          <Link
            to="/leaderboard"
            onClick={() => setMobileMenuOpen(false)}
            className={`p-2.5 rounded-lg text-xs font-bold uppercase tracking-wide font-display ${
              isActive('/leaderboard') ? 'bg-violet-950/60 text-cyan-300 border border-violet-500/40' : 'bg-slate-900/60 text-slate-300'
            }`}
          >
            Leaderboard
          </Link>
          {hasCreatorAccess && (
            <Link
              to="/streamer"
              onClick={() => setMobileMenuOpen(false)}
              className={`p-2.5 rounded-lg text-xs font-bold uppercase tracking-wide flex items-center justify-between font-display ${
                isActive('/streamer') ? 'bg-fuchsia-950/60 text-fuchsia-300 border border-fuchsia-500/40' : 'bg-slate-900/60 text-fuchsia-300'
              }`}
            >
              <span>Creator Hub</span>
              <Radio className="w-3 h-3 text-fuchsia-400 animate-pulse" />
            </Link>
          )}
          <Link
            to="/wrapped"
            onClick={() => setMobileMenuOpen(false)}
            className={`p-2.5 rounded-lg text-xs font-bold uppercase tracking-wide flex items-center justify-between font-display ${
              isActive('/wrapped') ? 'bg-purple-950/60 text-cyan-300 border border-purple-500/40' : 'bg-slate-900/60 text-purple-300'
            }`}
          >
            <span>Wrapped '26</span>
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
          </Link>
          {isAdmin && (
            <Link
              to="/admin"
              onClick={() => setMobileMenuOpen(false)}
              className={`p-2.5 rounded-lg text-xs font-bold uppercase tracking-wide font-display ${
                isActive('/admin') ? 'bg-violet-950/60 text-cyan-300 border border-violet-500/40' : 'bg-slate-900/60 text-slate-300'
              }`}
            >
              Admin
            </Link>
          )}
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              signOut();
            }}
            className="col-span-2 p-2.5 rounded-lg text-xs font-bold uppercase tracking-wide text-rose-400 bg-rose-950/20 border border-rose-900/40 text-center font-display cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      )}
    </header>
  );
}

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import MatchDetailPage from './pages/MatchDetailPage';
import PollsPage from './pages/PollsPage';
import LeaderboardPage from './pages/LeaderboardPage';
import ProfilePage from './pages/ProfilePage';
import AdminPage from './pages/AdminPage';
import StreamerHubPage from './pages/StreamerHubPage';
import WrappedPage from './pages/WrappedPage';
import { BrandLogo } from './components/BrandLogo';

// Protected Route helper for sensitive actions/pages
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  // Show restoration loading spinner while checking initial session
  if (loading) {
    return (
      <div className="min-h-screen bg-[#08090f] flex items-center justify-center text-slate-200">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <BrandLogo iconClassName="w-14 h-14 animate-pulse" showText={false} />
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <BrandLogo iconClassName="w-6 h-6" textClassName="text-xl" showText={true} />
            <span className="text-xs text-slate-400 font-display tracking-widest uppercase">Loading Arena...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/match/:id"
            element={
              <ProtectedRoute>
                <MatchDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/polls"
            element={
              <ProtectedRoute>
                <PollsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/leaderboard"
            element={
              <ProtectedRoute>
                <LeaderboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/streamer"
            element={
              <ProtectedRoute>
                <StreamerHubPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/wrapped"
            element={
              <ProtectedRoute>
                <WrappedPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminPage />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

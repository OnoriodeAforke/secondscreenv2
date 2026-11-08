import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, withClockDriftRetry } from '../lib/supabase';
import type { Profile } from '../types/database';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, username?: string) => Promise<{ error: any; data: any }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Profile fetch with clock drift retry protection for PGRST303
  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await withClockDriftRetry(() =>
        supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle()
      );

      if (error) {
        console.error('Profile fetch error:', error);
        return;
      }
      if (data) setProfile(data as Profile);
    } catch (err) {
      console.error('Profile fetch failed:', err);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user?.id) await fetchProfile(user.id);
  }, [user, fetchProfile]);

  useEffect(() => {
    let isMounted = true;

    // 1. Get initial session ONCE
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      if (!isMounted) return;
      if (existingSession?.user) {
        setSession(existingSession);
        setUser(existingSession.user);
        fetchProfile(existingSession.user.id);
      }
      setLoading(false);
    });

    // 2. Listen for changes. Do NOT fetch profile in here to avoid loops.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!isMounted) return;
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (!newSession?.user) setProfile(null);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []); // Empty array = runs ONCE on mount.

  const signIn = async (email: string, password: string) => {
    const res = await supabase.auth.signInWithPassword({ email, password });
    if (!res.error && res.data.user) {
      setUser(res.data.user);
      setSession(res.data.session);
      await fetchProfile(res.data.user.id);
    }
    return { error: res.error };
  };

  const signUp = async (email: string, password: string, username?: string) => {
    const res = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username: username || email.split('@')[0] } },
    });

    if (!res.error && res.data.user) {
      setUser(res.data.user);
      setSession(res.data.session);
      const newUserId = res.data.user.id;
      // Database trigger creates the profile, so we just wait a second and fetch it.
      setTimeout(() => fetchProfile(newUserId), 1000);
    }
    return { error: res.error, data: res.data };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
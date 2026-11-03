import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { supabase, supabaseConfigured } from '../lib/supabaseClient';
import type { User as SupabaseUser, Session } from '@supabase/supabase-js';

export interface User {
  id: string;
  email?: string;
  name?: string;
  preferences?: any;
  user_metadata?: Record<string, any>;
}

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<{ requiresEmailConfirmation?: boolean }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  isAuthModalOpen: boolean;
  authModalMode: 'login' | 'register';
  openAuthModal: (mode?: 'login' | 'register') => void;
  closeAuthModal: () => void;
}

const AuthContext = createContext<AuthContextType>({} as any);

const DEMO_USER: User = {
  id: 'demo-user-1234',
  email: 'demo@journeo.com',
  name: 'Demo Traveler',
  preferences: {
    interests: ['Historical Monuments', 'Ancient Architecture', 'Food and Local Culture'],
    travelStyle: 'balanced',
    budgetPreference: 'medium',
    transportPreference: 'cab',
    idealExperience: 'Curated heritage sites and authentic culinary gems with minimal rush.'
  }
};

function mapSupabaseUser(su: SupabaseUser | null): User | null {
  if (!su) return null;
  return {
    id: su.id,
    email: su.email,
    name: su.user_metadata?.full_name || su.user_metadata?.name || su.email?.split('@')[0] || 'Traveler',
    preferences: su.user_metadata?.preferences || {},
    user_metadata: su.user_metadata
  };
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('register');

  // Initialize auth state
  useEffect(() => {
    let mounted = true;

    async function initSession() {
      // 1. Check local demo session first if saved
      const savedDemo = localStorage.getItem('journeo_demo_session');
      if (savedDemo) {
        try {
          const parsed = JSON.parse(savedDemo);
          if (mounted) {
            setUser(parsed);
            setLoading(false);
          }
          return;
        } catch {
          localStorage.removeItem('journeo_demo_session');
        }
      }

      // 2. Check Supabase session if configured
      if (supabaseConfigured) {
        try {
          const { data, error } = await supabase.auth.getSession();
          if (!error && data?.session?.user) {
            if (mounted) {
              setUser(mapSupabaseUser(data.session.user));
              if (data.session.access_token) {
                localStorage.setItem('journeo_token', data.session.access_token);
              }
            }
          }
        } catch (err) {
          console.warn('[Journeo] Error retrieving Supabase session:', err);
        }
      }

      if (mounted) {
        setLoading(false);
      }
    }

    initSession();

    // Listen for Supabase auth state changes
    let authListener: { unsubscribe: () => void } | null = null;
    if (supabaseConfigured) {
      const { data } = supabase.auth.onAuthStateChange((_event, session: Session | null) => {
        if (!mounted) return;
        if (session?.user) {
          setUser(mapSupabaseUser(session.user));
          if (session.access_token) {
            localStorage.setItem('journeo_token', session.access_token);
          }
        } else if (!localStorage.getItem('journeo_demo_session')) {
          setUser(null);
          localStorage.removeItem('journeo_token');
        }
        setLoading(false);
      });
      authListener = data.subscription;
    }

    return () => {
      mounted = false;
      authListener?.unsubscribe();
    };
  }, []);

  const login = async (email: string, pass: string) => {
    setLoading(true);
    try {
      // Allow demo credentials regardless of backend status
      if (email.toLowerCase() === 'demo@journeo.com' && (pass === 'Password123!' || pass === 'demo' || pass === 'password')) {
        setUser(DEMO_USER);
        localStorage.setItem('journeo_demo_session', JSON.stringify(DEMO_USER));
        localStorage.setItem('journeo_token', 'demo-session-token');
        setLoading(false);
        return;
      }

      if (supabaseConfigured) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password: pass
        });
        if (error) {
          throw new Error(error.message);
        }
        if (data.session) {
          setUser(mapSupabaseUser(data.session.user));
          localStorage.setItem('journeo_token', data.session.access_token);
          localStorage.removeItem('journeo_demo_session');
        }
      } else {
        // Fallback demo user
        const genericUser: User = {
          id: 'user-' + Date.now(),
          email,
          name: email.split('@')[0],
        };
        setUser(genericUser);
        localStorage.setItem('journeo_demo_session', JSON.stringify(genericUser));
        localStorage.setItem('journeo_token', 'local-token-' + Date.now());
      }
    } finally {
      setLoading(false);
    }
  };

  const register = async (name: string, email: string, pass: string) => {
    setLoading(true);
    try {
      if (supabaseConfigured) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: pass,
          options: {
            data: { full_name: name }
          }
        });
        if (error) {
          throw new Error(error.message);
        }

        if (data.session) {
          setUser(mapSupabaseUser(data.session.user));
          localStorage.setItem('journeo_token', data.session.access_token);
          localStorage.removeItem('journeo_demo_session');
          return { requiresEmailConfirmation: false };
        } else if (data.user) {
          // Email confirmation is required by Supabase project settings
          return { requiresEmailConfirmation: true };
        }
      }

      // Fallback local registration
      const newUser: User = {
        id: 'user-' + Date.now(),
        email,
        name: name || email.split('@')[0],
      };
      setUser(newUser);
      localStorage.setItem('journeo_demo_session', JSON.stringify(newUser));
      localStorage.setItem('journeo_token', 'local-token-' + Date.now());
      return { requiresEmailConfirmation: false };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    localStorage.removeItem('journeo_demo_session');
    localStorage.removeItem('journeo_token');
    setUser(null);
    if (supabaseConfigured) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Sign out error:', err);
      }
    }
  };

  const refreshUser = async () => {
    if (supabaseConfigured) {
      try {
        const { data } = await supabase.auth.getUser();
        if (data?.user) {
          setUser(mapSupabaseUser(data.user));
        }
      } catch {}
    }
  };

  const openAuthModal = (mode: 'login' | 'register' = 'register') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
  };

  const status: AuthStatus = loading ? 'loading' : user ? 'authenticated' : 'unauthenticated';

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        status,
        login,
        register,
        logout,
        refreshUser,
        isAuthModalOpen,
        authModalMode,
        openAuthModal,
        closeAuthModal
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

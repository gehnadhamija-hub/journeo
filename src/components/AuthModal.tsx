import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  X,
  Lock,
  Mail,
  User,
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  CheckCircle2,
  Sparkles,
  Loader2
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'login'
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('demo@journeo.com');
  const [password, setPassword] = useState('Password123!');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { login, register } = useAuth();

  if (!isOpen) return null;

  const validateForm = (): boolean => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please provide a valid email address.');
      return false;
    }
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return false;
    }
    if (mode === 'register' && !name.trim()) {
      setError('Please provide your name.');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    if (!validateForm()) return;

    setLoading(true);

    try {
      if (mode === 'login') {
        await login(email.trim(), password);
        onClose();
      } else {
        const result = await register(name.trim(), email.trim(), password);
        if (result?.requiresEmailConfirmation) {
          setInfoMessage(
            'Account created successfully! We sent a confirmation link to your email. Please verify it or sign in.'
          );
          setMode('login');
        } else {
          onClose();
        }
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleUseDemo = async () => {
    setEmail('demo@journeo.com');
    setPassword('Password123!');
    setError(null);
    setLoading(true);
    try {
      await login('demo@journeo.com', 'Password123!');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Demo login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[3000] bg-text/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-ivory border border-border w-full max-w-md rounded-3xl shadow-2xl p-6 sm:p-8 relative overflow-hidden">
        {/* Subtle decorative background glow */}
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-sage/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-terracotta/15 rounded-full blur-2xl pointer-events-none" />

        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-text-subtle hover:text-text p-1.5 rounded-xl hover:bg-ivory-dark/60 transition-colors"
          aria-label="Close authentication modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-deep-green/10 text-deep-green text-xs font-bold uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5 text-terracotta" />
            <span>Journeo Travel Account</span>
          </div>
          <h2 className="font-serif font-bold text-2xl text-text">
            {mode === 'login' ? 'Welcome Back' : 'Begin Your Journey'}
          </h2>
          <p className="text-xs text-text-muted mt-1 max-w-xs mx-auto">
            {mode === 'login'
              ? 'Sign in to access your curated itineraries, active trips and personalized travel preferences.'
              : 'Create a free account to plan and adapt bespoke trips across India.'}
          </p>
        </div>

        {error && (
          <div className="mb-4 bg-terracotta/10 border border-terracotta/30 text-terracotta-dark p-3.5 rounded-2xl text-xs flex items-start gap-2.5 animate-shake">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{error}</div>
          </div>
        )}

        {infoMessage && (
          <div className="mb-4 bg-sage/20 border border-sage/50 text-deep-green p-3.5 rounded-2xl text-xs flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-deep-green" />
            <div className="flex-1 font-medium">{infoMessage}</div>
          </div>
        )}

        {/* Demo login shortcut card */}
        <div className="mb-5 bg-gradient-to-r from-sage/15 via-ivory to-sandstone-light/40 border border-sage/30 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-soft-sm">
          <div>
            <div className="text-[11px] font-bold text-deep-green flex items-center gap-1">
              <span>⚡ One-Click Evaluator Login</span>
            </div>
            <div className="text-[10px] text-text-muted mt-0.5">
              Instant login with verified demo profile & trips
            </div>
          </div>
          <button
            type="button"
            onClick={handleUseDemo}
            disabled={loading}
            className="px-3 py-1.5 bg-deep-green hover:bg-deep-green-dark text-white rounded-xl text-xs font-bold transition-all shadow-soft-sm hover:scale-105 active:scale-95 disabled:opacity-50 flex items-center gap-1"
          >
            <span>Demo In</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-semibold text-text mb-1">
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-text-subtle absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Aditi Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white border border-border rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-text placeholder:text-text-subtle/70 focus:outline-none focus:border-deep-green focus:ring-1 focus:ring-deep-green transition-all"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-text mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-text-subtle absolute left-3.5 top-3" />
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white border border-border rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-text placeholder:text-text-subtle/70 focus:outline-none focus:border-deep-green focus:ring-1 focus:ring-deep-green transition-all"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-text">
                Password
              </label>
              <span className="text-[10px] text-text-subtle">Min 6 characters</span>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-text-subtle absolute left-3.5 top-3" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white border border-border rounded-xl pl-10 pr-10 py-2.5 text-xs text-text placeholder:text-text-subtle/70 focus:outline-none focus:border-deep-green focus:ring-1 focus:ring-deep-green transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-2.5 text-text-subtle hover:text-text p-0.5 rounded"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-deep-green hover:bg-deep-green-dark active:scale-[0.98] text-white font-semibold py-3 rounded-xl text-xs transition-all shadow-soft-sm hover:shadow-soft-md flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed group"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-ivory" />
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <span>{mode === 'login' ? 'Sign In to Journeo' : 'Create Account'}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        <div className="mt-5 pt-4 border-t border-border/70 text-center text-xs text-text-muted">
          {mode === 'login' ? (
            <p>
              New to Journeo?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError(null);
                  setInfoMessage(null);
                }}
                className="text-deep-green font-bold hover:underline"
              >
                Create an account
              </button>
            </p>
          ) : (
            <p>
              Already registered?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                  setInfoMessage(null);
                }}
                className="text-deep-green font-bold hover:underline"
              >
                Sign in instead
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

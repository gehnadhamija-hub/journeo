import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate, useLocation } from 'react-router-dom';
import { Compass } from 'lucide-react';

export const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, status } = useAuth();
  const location = useLocation();

  if (loading || status === 'loading') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-deep-green text-white flex items-center justify-center shadow-soft-md animate-bounce">
          <Compass className="w-6 h-6 text-ivory animate-spin" style={{ animationDuration: '3s' }} />
        </div>
        <p className="text-xs font-semibold text-text-muted tracking-wide">
          Verifying your Journeo session...
        </p>
      </div>
    );
  }

  if (!user || status === 'unauthenticated') {
    return (
      <Navigate
        to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`}
        replace
        state={{ from: location }}
      />
    );
  }

  return <>{children}</>;
};

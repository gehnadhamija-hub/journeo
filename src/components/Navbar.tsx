import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Compass, User, LogOut, Bookmark, Sparkles, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Navbar: React.FC = () => {
  const { user, logout, openAuthModal } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isHome = location.pathname === '/';
  const isActive = (path: string) => location.pathname === path;

  const closeMobile = () => setMobileMenuOpen(false);

  const planningDestination = user ? '/plan' : '/login?redirect=/plan';

  const handlePlanClick = (e: React.MouseEvent) => {
    if (!user && isHome) {
      e.preventDefault();
      openAuthModal('register');
    }
  };

  const handleMobilePlanClick = (e: React.MouseEvent) => {
    if (!user && isHome) {
      e.preventDefault();
      openAuthModal('register');
      closeMobile();
    }
  };

  return (
    <header
      className={`sticky top-0 z-50 backdrop-blur-md border-b transition-all ${
        isHome
          ? 'bg-[#041215]/85 border-white/10 text-white shadow-soft-sm'
          : 'bg-[#E8E9DC]/95 border-[#C9D0BF] text-[#344B3C] shadow-soft-sm'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Left: Brand */}
        <Link to="/" onClick={closeMobile} className="flex items-center gap-3 group">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center font-serif text-xl shadow-soft-sm group-hover:scale-105 transition-transform ${
              isHome
                ? 'bg-[#193D2D] border border-[#718675]/40 text-white'
                : 'bg-[#49634F] text-white'
            }`}
          >
            <Compass className={`w-6 h-6 ${isHome ? 'text-[#C5A36A]' : 'text-[#E8E9DC]'}`} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span
                className={`font-serif font-bold text-2xl tracking-tight ${
                  isHome ? 'text-white' : 'text-[#344B3C]'
                }`}
              >
                Journeo
              </span>
              <span
                className={`w-1.5 h-1.5 rounded-full mb-1 ${
                  isHome ? 'bg-[#C5A36A]' : 'bg-[#B99A68]'
                }`}
              />
            </div>
            <span
              className={`text-[10px] tracking-wider uppercase font-semibold block -mt-1 ${
                isHome ? 'text-[#718675]' : 'text-[#667363]'
              }`}
            >
              Personalized Travel Companion
            </span>
          </div>
        </Link>

        {/* Centre: Desktop Nav links */}
        <nav
          className={`hidden md:flex items-center gap-8 text-sm font-medium ${
            isHome ? 'text-white/80' : 'text-[#667363]'
          }`}
        >
          <Link
            to="/"
            className={`transition-colors ${
              isHome
                ? isActive('/') ? 'text-white font-semibold' : 'hover:text-white'
                : isActive('/') ? 'text-[#49634F] font-semibold' : 'hover:text-[#344B3C]'
            }`}
          >
            Home
          </Link>
          <Link
            to="/explore"
            className={`transition-colors ${
              isHome
                ? isActive('/explore') ? 'text-white font-semibold' : 'hover:text-white'
                : isActive('/explore') ? 'text-[#49634F] font-semibold' : 'hover:text-[#344B3C]'
            }`}
          >
            Explore
          </Link>
          <Link
            to="/destinations"
            className={`transition-colors ${
              isHome
                ? isActive('/destinations') ? 'text-white font-semibold' : 'hover:text-white'
                : isActive('/destinations') ? 'text-[#49634F] font-semibold' : 'hover:text-[#344B3C]'
            }`}
          >
            Destinations
          </Link>
          <a
            href="/#how-it-works"
            className={`transition-colors ${
              isHome ? 'hover:text-white' : 'hover:text-[#344B3C]'
            }`}
          >
            How It Works
          </a>
        </nav>

        {/* Right: Actions */}
        <div className="hidden sm:flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-2">
              <Link
                to="/my-trips"
                className={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                  isHome
                    ? isActive('/my-trips')
                      ? 'bg-[#193D2D] text-white font-bold'
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                    : isActive('/my-trips')
                      ? 'bg-[#C8D2BE]/30 text-[#49634F] font-bold'
                      : 'text-[#667363] hover:text-[#344B3C] hover:bg-[#DFE3D3]'
                }`}
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span>My Trips</span>
              </Link>
              <Link
                to="/profile"
                className={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                  isHome
                    ? isActive('/profile')
                      ? 'bg-[#193D2D] text-white font-bold'
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                    : isActive('/profile')
                      ? 'bg-[#C8D2BE]/30 text-[#49634F] font-bold'
                      : 'text-[#667363] hover:text-[#344B3C] hover:bg-[#DFE3D3]'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>{(user.name || 'User').split(' ')[0]}</span>
              </Link>
              <button
                onClick={logout}
                className={`p-2 transition-colors rounded-lg ${
                  isHome
                    ? 'text-white/60 hover:text-[#C5A36A] hover:bg-white/10'
                    : 'text-[#667363] hover:text-[#C87950] hover:bg-[#DFE3D3]'
                }`}
                title="Log Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : null}

          {/* Prominent CTA */}
          <Link
            to={planningDestination}
            onClick={handlePlanClick}
            className={`px-5 py-2.5 rounded-xl font-semibold text-xs tracking-wide shadow-soft-sm hover:shadow-soft-md transition-all flex items-center gap-1.5 group ${
              isHome
                ? 'bg-[#193D2D] hover:bg-[#174B38] text-white border border-[#718675]/40'
                : 'bg-[#49634F] hover:bg-[#344B3C] text-white'
            }`}
          >
            <Sparkles
              className={`w-3.5 h-3.5 group-hover:rotate-12 transition-transform ${
                isHome ? 'text-[#C5A36A]' : 'text-[#DFE3D3]'
              }`}
            />
            <span>Plan My Trip</span>
          </Link>
        </div>

        {/* Mobile Action & Hamburger Button */}
        <div className="flex items-center gap-2 sm:hidden">
          <Link
            to={planningDestination}
            onClick={handleMobilePlanClick}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
              isHome
                ? 'bg-[#193D2D] text-white border border-[#718675]/40'
                : 'bg-[#49634F] text-white'
            }`}
          >
            Plan
          </Link>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`p-2 rounded-lg ${
              isHome ? 'text-white hover:bg-white/10' : 'text-[#344B3C] hover:bg-[#DFE3D3]'
            }`}
            aria-label="Toggle navigation"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div
          className={`md:hidden border-t px-4 pt-4 pb-6 space-y-3 ${
            isHome
              ? 'border-white/10 bg-[#041215]/95 text-white'
              : 'border-[#C9D0BF] bg-[#E8E9DC] text-[#344B3C]'
          }`}
        >
          <div className="flex flex-col space-y-2 text-sm font-medium">
            <Link
              to="/"
              onClick={closeMobile}
              className={`p-2 rounded-lg ${
                isHome
                  ? isActive('/') ? 'text-[#C5A36A] font-bold bg-white/5' : 'hover:bg-white/10 text-white'
                  : isActive('/') ? 'text-[#49634F] font-bold bg-[#C8D2BE]/30' : 'hover:bg-[#DFE3D3] text-[#344B3C]'
              }`}
            >
              Home
            </Link>
            <Link
              to="/explore"
              onClick={closeMobile}
              className={`p-2 rounded-lg ${
                isHome
                  ? isActive('/explore') ? 'text-[#C5A36A] font-bold bg-white/5' : 'hover:bg-white/10 text-white'
                  : isActive('/explore') ? 'text-[#49634F] font-bold bg-[#C8D2BE]/30' : 'hover:bg-[#DFE3D3] text-[#344B3C]'
              }`}
            >
              Explore
            </Link>
            <Link
              to="/destinations"
              onClick={closeMobile}
              className={`p-2 rounded-lg ${
                isHome
                  ? isActive('/destinations') ? 'text-[#C5A36A] font-bold bg-white/5' : 'hover:bg-white/10 text-white'
                  : isActive('/destinations') ? 'text-[#49634F] font-bold bg-[#C8D2BE]/30' : 'hover:bg-[#DFE3D3] text-[#344B3C]'
              }`}
            >
              Destinations
            </Link>
            <a
              href="/#how-it-works"
              onClick={closeMobile}
              className={`p-2 rounded-lg ${
                isHome ? 'hover:bg-white/10 text-white' : 'hover:bg-[#DFE3D3] text-[#344B3C]'
              }`}
            >
              How It Works
            </a>
            {user ? (
              <>
                <Link
                  to="/my-trips"
                  onClick={closeMobile}
                  className={`p-2 rounded-lg flex items-center justify-between ${
                    isHome ? 'hover:bg-white/10 text-white' : 'hover:bg-[#DFE3D3] text-[#344B3C]'
                  }`}
                >
                  <span>My Trips</span>
                  <Bookmark className={`w-4 h-4 ${isHome ? 'text-[#C5A36A]' : 'text-[#49634F]'}`} />
                </Link>
                <Link
                  to="/profile"
                  onClick={closeMobile}
                  className={`p-2 rounded-lg flex items-center justify-between ${
                    isHome ? 'hover:bg-white/10 text-white' : 'hover:bg-[#DFE3D3] text-[#344B3C]'
                  }`}
                >
                  <span>Profile ({user.name})</span>
                  <User className={`w-4 h-4 ${isHome ? 'text-[#C5A36A]' : 'text-[#49634F]'}`} />
                </Link>
                <button
                  onClick={() => {
                    logout();
                    closeMobile();
                  }}
                  className={`p-2 rounded-lg text-left flex items-center justify-between ${
                    isHome ? 'hover:bg-white/10 text-[#C5A36A]' : 'hover:bg-[#DFE3D3] text-[#C87950]'
                  }`}
                >
                  <span>Log Out</span>
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            ) : null}
          </div>
        </div>
      )}
    </header>
  );
};

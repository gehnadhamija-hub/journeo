import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Compass,
  ArrowRight,
  CheckCircle2,
  Sliders,
  Sparkles,
  Navigation,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { TravelGlobe } from '../components/TravelGlobe';
import { AuthCard } from '../components/AuthCard';
import { InteractiveGlobe3D } from '../components/InteractiveGlobe3D';
import { useUserVisitedPlaces } from '../hooks/useUserVisitedPlaces';

export const HomePage: React.FC = () => {
  const { user, isAuthModalOpen, authModalMode, openAuthModal, closeAuthModal } = useAuth();
  const navigate = useNavigate();
  const { isAuthenticated, summary } = useUserVisitedPlaces();

  const handleStartPlanning = (e: React.MouseEvent) => {
    if (!user) {
      e.preventDefault();
      openAuthModal('register');
    }
  };

  // Compact 4-step workflow
  const compactSteps = [
    {
      number: '01',
      title: 'Set Preferences',
      description: 'Choose your interests, travel pace, and preferred transport mode for a tailored experience.',
      icon: Sliders
    },
    {
      number: '02',
      title: 'Pick Destinations',
      description: 'Explore verified ASI & UNESCO monuments, historical landmarks, and must-visit heritage sites.',
      icon: Compass
    },
    {
      number: '03',
      title: 'Optimize Route',
      description: 'Our constraint engine sequences stops without backtracking, respecting verified opening hours.',
      icon: Sparkles
    },
    {
      number: '04',
      title: 'Travel & Adapt',
      description: 'Track progress in Journey Mode with 1-click adaptive delay replanning if schedules change on the road.',
      icon: Navigation
    }
  ];

  return (
    <div className="space-y-0">
      {/* =========================================================================
          HERO SECTION — CINEMATIC ATMOSPHERE & BALANCED 2-COLUMN LAYOUT
          ========================================================================= */}
      <section className="relative min-h-[88vh] lg:min-h-[92vh] flex items-center overflow-hidden py-12 lg:py-16">
        {/* Background Mountain Lake Landscape with Dark Teal/Green Atmospheric Grading */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          <img
            src="/hero-bg.png"
            alt="Cinematic Mountain Lake"
            className="w-full h-full object-cover object-center filter brightness-[0.5] contrast-[1.25] saturate-[0.9]"
          />
          {/* Dark black & deep teal/emerald atmospheric gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#041215]/96 via-[#072024]/82 to-[#041215]/90" />
          {/* Subtle warm golden ambient glow radiating around the 3D globe */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_45%,rgba(197,163,106,0.18),transparent_60%)]" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#041215] via-transparent to-[#041215]/80" />
        </div>

        {/* Hero Content Container — Strict alignment with navbar (max-w-7xl, px-4 sm:px-6 lg:px-8) */}
        <div className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* -------------------------------------------------------------------
              LEFT COLUMN — Main Content (Left-aligned vertical axis)
              ------------------------------------------------------------------- */}
          <div className="lg:col-span-7 flex flex-col items-start text-left space-y-6 max-w-xl text-white">
            {/* Introductory Pill Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/45 backdrop-blur-md border border-white/20 text-white text-xs font-semibold tracking-wider uppercase shadow-soft-sm">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#C5A36A]" />
              <span>YOUR PERSONAL TRAVEL COMPANION</span>
            </div>

            {/* Main Heading */}
            <div className="space-y-1">
              <h1 className="font-serif text-3xl sm:text-5xl lg:text-[3.5rem] xl:text-[3.8rem] font-bold tracking-tight text-white leading-[1.12]">
                Make your plans
                <span className="italic font-normal text-[#C5A36A] font-serif block mt-1">
                  with Journeo
                </span>
              </h1>

              {/* Supporting Value Proposition */}
              <p className="text-sm sm:text-base text-white/85 leading-relaxed font-normal pt-2">
                Personalized itineraries, intelligent route optimization, and real-time adaptive replanning. Travel at your own pace while Journeo seamlessly coordinates every detail.
              </p>
            </div>

            {/* CTA Button */}
            <div className="pt-1 w-full sm:w-auto">
              <Link
                to={user ? '/plan' : '#'}
                onClick={handleStartPlanning}
                className="inline-flex px-8 py-3.5 rounded-xl bg-[#193D2D] hover:bg-[#174B38] border border-[#718675]/40 text-white font-semibold text-xs tracking-wide shadow-soft-lg hover:shadow-card-hover transition-all items-center justify-center gap-2.5 group"
              >
                <span>Start Planning</span>
                <ArrowRight className="w-4 h-4 text-[#C5A36A] group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            {/* Bottom Feature Labels with Golden Checkmarks */}
            <div className="pt-5 border-t border-white/20 flex flex-wrap items-center gap-5 sm:gap-6 text-xs font-medium text-white/95">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#C5A36A] flex-shrink-0" />
                <span>Personalized Itineraries</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#C5A36A] flex-shrink-0" />
                <span>Smart Route Optimization</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#C5A36A] flex-shrink-0" />
                <span>Adaptive Travel Planning</span>
              </div>
            </div>
          </div>

          {/* -------------------------------------------------------------------
              RIGHT COLUMN — 3D Earth Globe
              Signed-in users see their personalized travel-history globe (visited places);
              guests see the rotating showcase globe with the sign-up call to action.
              ------------------------------------------------------------------- */}
          <div className="lg:col-span-5 flex justify-center lg:justify-end items-center w-full">
            {isAuthenticated ? (
              <div className="w-full bg-black/35 backdrop-blur-md rounded-3xl p-4 border border-white/15 shadow-2xl space-y-3">
                <InteractiveGlobe3D />
                <div className="flex items-center justify-between text-xs text-white/85 px-1">
                  <span>
                    {summary.uniquePlacesCount} unique places across {summary.uniqueCitiesCount} cities
                  </span>
                  <Link
                    to="/my-trips"
                    className="px-3.5 py-1.5 bg-[#193D2D] hover:bg-[#174B38] text-white font-semibold rounded-lg flex items-center gap-1.5"
                  >
                    <span>My Travel Log</span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#C5A36A]" />
                  </Link>
                </div>
              </div>
            ) : (
              <TravelGlobe />
            )}
          </div>
        </div>
      </section>

      {/* =========================================================================
          LIGHT EARTHY SAGE-GREEN "HOW JOURNEO WORKS" SECTION
          ========================================================================= */}
      <section
        id="how-it-works"
        className="bg-[#DFE3D3] text-[#344B3C] py-20 border-t border-[#C9D0BF]"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header with Clear Hierarchy and Alignment */}
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#49634F] bg-[#49634F]/10 px-3.5 py-1 rounded-full border border-[#49634F]/20">
                Intelligent Travel Planning
              </span>
              <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#344B3C] mt-3">
                How Journeo Works
              </h2>
              <p className="text-sm text-[#667363] mt-2 max-w-xl leading-relaxed">
                Four simple, constraint-aware steps to transform unstructured travel ideas into an optimized, adaptive journey.
              </p>
            </div>

            <Link
              to="/explore"
              className="text-xs font-semibold text-[#49634F] hover:text-[#344B3C] flex items-center gap-1.5 transition-colors self-start md:self-auto"
            >
              <span>Explore All Destinations</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* 4-Step Cards Grid with Left-Aligned Text & High Contrast */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {compactSteps.map((step, idx) => {
              const Icon = step.icon;
              return (
                <div
                  key={idx}
                  className="bg-[#F1F0E6] rounded-2xl p-6 border border-[#C9D0BF] shadow-soft-sm hover:shadow-soft-md hover:border-[#B99A68] transition-all duration-300 flex flex-col justify-between group space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-[#49634F] bg-[#49634F]/12 px-2.5 py-1 rounded-md">
                        {step.number}
                      </span>
                      <div className="w-10 h-10 rounded-xl bg-[#DFE3D3] group-hover:bg-[#49634F] group-hover:text-white text-[#344B3C] flex items-center justify-center transition-colors">
                        <Icon className="w-5 h-5" />
                      </div>
                    </div>

                    <h3 className="font-serif font-bold text-lg text-[#344B3C] leading-snug group-hover:text-[#49634F] transition-colors">
                      {step.title}
                    </h3>

                    <p className="text-sm text-[#667363] leading-relaxed text-left">
                      {step.description}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-[#C9D0BF]/60 flex items-center justify-between text-xs text-[#667363] font-medium">
                    <span>Step {idx + 1} of 4</span>
                    <CheckCircle2 className="w-4 h-4 text-[#49634F]" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =========================================================================
          SAME-PAGE SIGN-UP / SIGN-IN OVERLAY MODAL
          ========================================================================= */}
      {isAuthModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/65 backdrop-blur-md overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeAuthModal();
          }}
        >
          <div className="relative w-full max-w-xl flex flex-col items-center my-auto">
            {/* Close Button */}
            <button
              type="button"
              onClick={closeAuthModal}
              className="absolute -top-3 -right-3 sm:-top-4 sm:-right-4 z-50 w-9 h-9 rounded-full bg-[#041215]/90 hover:bg-[#041215] border border-white/25 text-white/80 hover:text-white flex items-center justify-center shadow-lg transition-all hover:scale-105"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Sliding AuthCard directly on the Homepage with mountain background visible */}
            <AuthCard
              initialMode={authModalMode}
              onSuccess={() => {
                closeAuthModal();
                navigate('/plan');
              }}
            />

            {/* Demo Credentials Helper Pill */}
            <div className="mt-4 p-3 rounded-xl bg-[#041215]/85 border border-white/15 text-center text-xs text-white/80 w-full flex flex-col sm:flex-row items-center justify-between gap-2 shadow-lg backdrop-blur-md">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#C5A36A] flex-shrink-0" />
                <span>
                  <strong>Demo account:</strong> <code className="bg-white/15 px-1.5 py-0.5 rounded text-white font-mono">demo@journeo.com</code> / <code className="bg-white/15 px-1.5 py-0.5 rounded text-white font-mono">Password123!</code>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

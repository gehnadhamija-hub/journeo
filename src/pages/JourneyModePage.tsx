import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Compass,
  CheckCircle2,
  XCircle,
  Navigation,
  ExternalLink,
  Clock,
  MapPin,
  Sparkles,
  Flag,
  Trophy,
  Award,
  Calendar,
  Pause,
  Play,
  UtensilsCrossed,
  Wallet
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTripContext } from '../context/TripContext';
import { MapComponent } from '../components/MapComponent';
import { TripExpenseTrackerPanel } from '../components/TripExpenseTrackerPanel';
import { TripAssistantDrawer } from '../components/TripAssistantDrawer';
import { Button } from '../components/ui/Button';
import { summarizeTripExpenses } from '../services/expenseService';
import { OptimizedItineraryResponse } from '../features/itinerary/services/itineraryOptimizer';

export const JourneyModePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    activeTrip,
    markStopVisited,
    markStopSkipped,
    pauseTrip,
    resumeTrip,
    completeTrip,
    applyAssistantItineraryUpdate,
    undoLastAssistantUpdate
  } = useTripContext();

  const [stops, setStops] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [selectedDayNumber, setSelectedDayNumber] = useState<number | 'ALL'>('ALL');
  const [showEndModal, setShowEndModal] = useState<boolean>(false);
  const [tripCompleted, setTripCompleted] = useState<boolean>(false);
  const [completionStats, setCompletionStats] = useState<any>(null);

  useEffect(() => {
    if (activeTrip) {
      const tripStops = activeTrip.stops || activeTrip.itinerary?.stops || [];
      setStops(tripStops);
      setMeta(
        activeTrip.itinerary || {
          destinationCity: activeTrip.destinationName,
          title: `${activeTrip.destinationName} Personalized Circuit`,
          tripId: activeTrip.tripId
        }
      );
      const firstPending = tripStops.findIndex(
        (s: any) => s.visitStatus !== 'VISITED' && s.visitStatus !== 'SKIPPED'
      );
      if (firstPending !== -1) {
        setCurrentIdx(firstPending);
      } else if (activeTrip.currentStopIndex !== undefined) {
        setCurrentIdx(activeTrip.currentStopIndex);
      }
      return;
    }

    const cachedStops = sessionStorage.getItem('journeo_active_journey_stops');
    const cachedMeta = sessionStorage.getItem('journeo_active_journey_meta');

    if (cachedStops) {
      try {
        const parsed = JSON.parse(cachedStops);
        setStops(parsed);
        const firstPending = parsed.findIndex(
          (s: any) => s.visitStatus !== 'VISITED' && s.visitStatus !== 'SKIPPED'
        );
        if (firstPending !== -1) setCurrentIdx(firstPending);
      } catch (err) {
        console.error('Error loading journey:', err);
      }
    }
    if (cachedMeta) {
      try {
        setMeta(JSON.parse(cachedMeta));
      } catch (err) {}
    }
  }, [activeTrip]);

  const handleMarkStatus = async (idx: number, status: 'VISITED' | 'SKIPPED') => {
    const targetStop = stops[idx];
    const stopId = targetStop?.id || targetStop?.placeId;

    if (status === 'VISITED' && stopId) {
      markStopVisited(stopId);
    } else if (status === 'SKIPPED' && stopId) {
      markStopSkipped(stopId);
    }

    const updated = [...stops];
    updated[idx] = {
      ...updated[idx],
      visitStatus: status,
      actualVisitTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setStops(updated);
    sessionStorage.setItem('journeo_active_journey_stops', JSON.stringify(updated));

    if (updated[idx].id && meta?.tripId) {
      try {
        await api.updateStopStatus(updated[idx].id, status);
      } catch (err) {}
    }

    if (idx + 1 < updated.length) {
      setCurrentIdx(idx + 1);
    } else {
      triggerEndTripPrompt();
    }
  };

  const triggerEndTripPrompt = () => {
    setShowEndModal(true);
  };

  const confirmEndTrip = async () => {
    completeTrip();
    const visited = stops.filter(s => s.visitStatus === 'VISITED');
    const skipped = stops.filter(s => s.visitStatus === 'SKIPPED');
    const tripId = activeTrip?.tripId || meta?.tripId || 'active-trip';
    const plannedBudget =
      meta?.budgetBreakdown?.totalBudget || activeTrip?.preferences?.budget || 25000;
    const travellers =
      meta?.tripConfig?.travellers || activeTrip?.preferences?.travellers || 2;
    const expSummary = summarizeTripExpenses(tripId, plannedBudget, travellers);

    const stats = {
      title: meta?.title || `${activeTrip?.destinationName || 'Indian Odyssey'} Journey`,
      city:
        meta?.destinationCity ||
        meta?.tripConfig?.city ||
        activeTrip?.destinationName ||
        'India',
      totalStops: stops.length,
      visitedCount: visited.length,
      skippedCount: skipped.length,
      completionRate: Math.round((visited.length / Math.max(1, stops.length)) * 100),
      totalActualSpent: expSummary.totalActualSpent,
      endedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setCompletionStats(stats);
    setTripCompleted(true);

    try {
      const savedTrips = JSON.parse(localStorage.getItem('journeo_saved_trips') || '[]');
      const updatedTrips = savedTrips.map((t: any) => {
        if (t.title === stats.title || t.id === meta?.tripId || t.id === activeTrip?.tripId) {
          return { ...t, status: 'COMPLETED', stops };
        }
        return t;
      });
      localStorage.setItem('journeo_saved_trips', JSON.stringify(updatedTrips));
    } catch {}

    if (meta?.tripId) {
      try {
        await api.updateTrip(meta.tripId, { status: 'COMPLETED' });
      } catch {}
    }
  };

  const completedCount = stops.filter(s => s.visitStatus === 'VISITED').length;
  const skippedCount = stops.filter(s => s.visitStatus === 'SKIPPED').length;
  const remainingCount = Math.max(0, stops.length - completedCount - skippedCount);
  const progressPercent =
    stops.length > 0 ? Math.round(((completedCount + skippedCount) / stops.length) * 100) : 0;

  if (stops.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center animate-fade-in">
        <div className="bg-white rounded-3xl border border-border p-8 sm:p-12 shadow-soft-sm space-y-5">
          <div className="w-16 h-16 rounded-3xl bg-sage/20 text-deep-green flex items-center justify-center mx-auto">
            <Compass className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-text">
              No Active Journey In Progress
            </h2>
            <p className="text-sm text-text-muted max-w-md mx-auto">
              You don't have an active trip currently running. Use the Smart Trip Planner to choose your destination, customize your preferences, and start tracking your voyage!
            </p>
          </div>
          <div className="pt-2">
            <Link to="/plan">
              <Button variant="primary" size="lg" icon={<Sparkles className="w-4 h-4 text-sage-light" />}>
                Plan a New Voyage
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const currentStop = stops[currentIdx] || stops[0];
  const nextStop = stops[currentIdx + 1];
  const isPaused = activeTrip?.status === 'paused';
  const daysList = meta?.days || activeTrip?.itinerary?.days || [];
  const tripId = activeTrip?.tripId || meta?.tripId || 'active-trip';
  const travellersCount =
    meta?.tripConfig?.travellers ||
    meta?.budgetBreakdown?.travellers ||
    activeTrip?.preferences?.travellers ||
    2;

  const mapMarkers = stops.map((s, i) => {
    const dest = s.destination || {};
    return {
      id: s.id || s.placeId || String(i),
      lat: s.coordinates?.lat || dest.latitude || 28.6139,
      lng: s.coordinates?.lng || dest.longitude || 77.2090,
      title: dest.name || 'Stop',
      order: i + 1,
      status: s.visitStatus,
      isMustVisit: s.isMustVisit,
      isMealStop: s.isMealStop || dest.isMealStop,
      mealType: s.mealType,
      cuisineType: s.cuisineType,
      timing: `${s.plannedArrival} - ${s.plannedDeparture}`,
      imageUrl: dest.imageUrl,
      description: dest.description
    };
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-fade-in">
      {/* Top Journey Tracker Bar */}
      <div className="bg-white rounded-3xl border border-border p-6 sm:p-8 shadow-soft-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <div
                className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  isPaused
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-deep-green/10 text-deep-green'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isPaused ? 'bg-amber-500' : 'bg-emerald-600 animate-pulse'
                  }`}
                />
                <span>{isPaused ? 'Trip Paused' : 'Active Trip Tracker Live'}</span>
              </div>
              {activeTrip?.startedAt && (
                <span className="text-[11px] text-text-subtle">
                  Started {new Date(activeTrip.startedAt).toLocaleDateString()}
                </span>
              )}
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-text">
              {meta?.title || `${activeTrip?.destinationName || 'Personalized'} Travel Journey`}
            </h1>
            <p className="text-xs text-text-muted mt-0.5">
              {completedCount} Visited • {remainingCount} Remaining • {skippedCount} Skipped
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {isPaused ? (
              <Button
                variant="primary"
                size="sm"
                onClick={resumeTrip}
                icon={<Play className="w-3.5 h-3.5 fill-current" />}
              >
                Resume Trip
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={pauseTrip}
                icon={<Pause className="w-3.5 h-3.5" />}
              >
                Pause Trip
              </Button>
            )}

            <Link to="/itinerary/preview">
              <Button variant="outline" size="sm">
                Full Itinerary
              </Button>
            </Link>

            <Button
              variant="destructive"
              size="sm"
              onClick={triggerEndTripPrompt}
              icon={<Flag className="w-4 h-4" />}
            >
              Complete Trip
            </Button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5 pt-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-text">
              Journey Progress: {completedCount} of {stops.length} Places Visited ({remainingCount} remaining)
            </span>
            <span className="font-mono font-bold text-deep-green">{progressPercent}%</span>
          </div>
          <div className="w-full bg-ivory-dark h-3 rounded-full overflow-hidden border border-border/80">
            <div
              className="bg-deep-green h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Multi-Day Selector inside Active Tracker */}
        {daysList.length > 1 && (
          <div className="pt-3 border-t border-border flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-xs font-bold text-text-muted flex items-center gap-1 shrink-0">
              <Calendar className="w-3.5 h-3.5 text-sage" /> Current Day View:
            </span>
            <button
              type="button"
              onClick={() => setSelectedDayNumber('ALL')}
              className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap ${
                selectedDayNumber === 'ALL'
                  ? 'bg-deep-green text-white'
                  : 'bg-ivory text-text border border-border'
              }`}
            >
              All Days ({stops.length})
            </button>
            {daysList.map((d: any) => (
              <button
                key={d.dayNumber}
                type="button"
                onClick={() => setSelectedDayNumber(d.dayNumber)}
                className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap ${
                  selectedDayNumber === d.dayNumber
                    ? 'bg-deep-green text-white'
                    : 'bg-ivory text-text border border-border'
                }`}
              >
                Day {d.dayNumber} {d.date ? `(${d.date.slice(5)})` : ''}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 2-Column Interface: Left Active Stop & Today's Schedule Queue, Right Map */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-6 space-y-6">
          {/* Active Stop Focus Card */}
          {currentStop && (
            <div className="bg-white rounded-3xl border-2 border-deep-green p-6 sm:p-7 shadow-soft-lg space-y-5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-white bg-deep-green px-3 py-1 rounded-full">
                    Current Stop #{currentIdx + 1}
                  </span>
                  {(currentStop.isMealStop || currentStop.destination?.isMealStop) && (
                    <span className="text-xs font-bold text-amber-900 bg-amber-100 px-2.5 py-1 rounded-full flex items-center gap-1">
                      <UtensilsCrossed className="w-3 h-3" /> Meal / Refreshment Break
                    </span>
                  )}
                </div>
                <span className="text-xs text-text-subtle font-mono">
                  Planned: {currentStop.plannedArrival} - {currentStop.plannedDeparture}
                </span>
              </div>

              <div className="space-y-3">
                <div className="relative h-48 sm:h-56 rounded-2xl overflow-hidden border border-border">
                  <img
                    src={currentStop.destination?.imageUrl}
                    alt={currentStop.destination?.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl text-xs font-bold text-deep-green shadow-soft-sm">
                    ⏱️ {currentStop.visitDuration || 90} mins planned stay
                  </div>
                </div>

                <h2 className="font-serif text-2xl font-bold text-text">
                  {currentStop.destination?.name || currentStop.name}
                </h2>

                <p className="text-xs text-text-muted leading-relaxed">
                  {currentStop.destination?.description}
                </p>

                {currentStop.transitInstruction && (
                  <div className="text-xs text-deep-green bg-sage/10 px-3 py-2 rounded-xl border border-sage/20 flex items-center gap-2">
                    <Navigation className="w-3.5 h-3.5 text-terracotta shrink-0" />
                    <span>{currentStop.transitInstruction}</span>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-border flex items-center justify-between gap-3 flex-wrap">
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    (currentStop.destination?.name || '') +
                      ' ' +
                      (currentStop.destination?.city || '')
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2.5 rounded-xl border border-border bg-ivory hover:bg-ivory-dark text-xs font-semibold text-text flex items-center gap-1.5 transition-colors"
                >
                  <Navigation className="w-3.5 h-3.5 text-sage" />
                  <span>Navigate in Maps</span>
                  <ExternalLink className="w-3 h-3 text-text-subtle" />
                </a>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleMarkStatus(currentIdx, 'SKIPPED')}
                    icon={<XCircle className="w-4 h-4 text-text-muted" />}
                  >
                    Skip Stop
                  </Button>

                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => handleMarkStatus(currentIdx, 'VISITED')}
                    icon={<CheckCircle2 className="w-4 h-4 text-sage-light" />}
                  >
                    Mark as Visited
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Up Next Preview with Travel Time */}
          {nextStop && (
            <div className="bg-ivory rounded-2xl border border-border p-5 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-text-subtle uppercase tracking-wider">
                <span>Up Next: Stop {currentIdx + 2}</span>
                <span className="text-deep-green">
                  Est. Transit: ~{nextStop.transitMinutes || nextStop.travelFromPreviousMinutes || 15} mins ({nextStop.distanceFromPrevKm || nextStop.distanceFromPreviousKm || 3.2} km)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-serif font-bold text-base text-text">
                    {nextStop.destination?.name || nextStop.name}
                  </h4>
                  <p className="text-xs text-text-muted">
                    Arrival at {nextStop.plannedArrival} • {nextStop.visitDuration || 75}m stay
                  </p>
                </div>
                <img
                  src={nextStop.destination?.imageUrl}
                  alt={nextStop.destination?.name}
                  className="w-12 h-12 rounded-xl object-cover border border-border"
                />
              </div>
            </div>
          )}

          {/* Complete Stop Checklist Queue */}
          <div className="bg-white rounded-3xl border border-border p-5 space-y-3">
            <h3 className="font-serif font-bold text-base text-text">
              Stop Checklist ({completedCount} Visited / {remainingCount} Remaining)
            </h3>
            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {stops.map((s, idx) => {
                const isVis = s.visitStatus === 'VISITED';
                const isSkip = s.visitStatus === 'SKIPPED';
                const isCur = idx === currentIdx;
                return (
                  <div
                    key={s.id || idx}
                    onClick={() => setCurrentIdx(idx)}
                    className={`cursor-pointer p-3 rounded-xl border text-xs flex items-center justify-between gap-2 transition-all ${
                      isCur
                        ? 'border-deep-green bg-sage/10'
                        : isVis
                        ? 'border-emerald-200 bg-emerald-50/50'
                        : 'border-border bg-ivory/40 hover:bg-ivory'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${
                          isVis
                            ? 'bg-emerald-600 text-white'
                            : isSkip
                            ? 'bg-stone-400 text-white'
                            : 'bg-deep-green text-white'
                        }`}
                      >
                        {isVis ? '✓' : idx + 1}
                      </span>
                      <div className="truncate">
                        <div className="font-bold text-text truncate">
                          {s.destination?.name || s.name}
                        </div>
                        <div className="text-[10px] text-text-subtle">
                          {s.plannedArrival} - {s.plannedDeparture}{' '}
                          {s.isMealStop ? '• 🍽️ Meal Break' : ''}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded shrink-0 ${
                        isVis
                          ? 'bg-emerald-100 text-emerald-800'
                          : isSkip
                          ? 'bg-stone-200 text-stone-600'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {s.visitStatus || 'PENDING'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column (6 cols): Live Map Route */}
        <div className="lg:col-span-6 sticky top-24 space-y-4">
          <div className="bg-white rounded-3xl border border-border p-4 shadow-soft-sm">
            <div className="flex items-center justify-between mb-3 px-2">
              <span className="font-serif font-bold text-base text-text flex items-center gap-2">
                <MapPin className="w-4 h-4 text-deep-green" />
                <span>Active Route Map & Check-ins</span>
              </span>
              <span className="text-xs text-text-muted">
                Stop {currentIdx + 1} of {stops.length} Active
              </span>
            </div>

            <MapComponent
              markers={mapMarkers}
              selectedMarkerId={currentStop?.id || currentStop?.placeId}
              onMarkerClick={m => {
                const foundIdx = stops.findIndex(
                  (s: any) => (s.id || s.placeId) === m.id
                );
                if (foundIdx !== -1) setCurrentIdx(foundIdx);
              }}
              height="480px"
              showRoute={true}
            />
          </div>
        </div>
      </div>

      {/* LIVE EXPENSE TRACKING PANEL DURING ACTIVE TRIP (Part 7 & Part 8) */}
      <TripExpenseTrackerPanel
        tripId={tripId}
        userId={user?.id || 'guest'}
        travellers={travellersCount}
        budgetBreakdown={meta?.budgetBreakdown || activeTrip?.itinerary?.budgetBreakdown}
        stops={stops}
      />

      {/* Phase 7 Conversational AI Trip Assistant during Active Journey */}
      {(activeTrip?.itinerary || meta?.days) && (
        <TripAssistantDrawer
          itinerary={(activeTrip?.itinerary || meta) as OptimizedItineraryResponse}
          onApplyItineraryUpdate={updated => {
            setMeta(updated);
            setStops(updated.stops || []);
            applyAssistantItineraryUpdate(updated);
          }}
          onUndoLastUpdate={() => {
            const restored = undoLastAssistantUpdate();
            if (restored && activeTrip?.itineraryHistory?.length) {
              const prev = activeTrip.itineraryHistory[activeTrip.itineraryHistory.length - 1];
              if (prev) {
                setMeta(prev);
                setStops(prev.stops || []);
              }
            }
            return restored;
          }}
          canUndo={Boolean(activeTrip?.itineraryHistory && activeTrip.itineraryHistory.length > 0)}
        />
      )}

      {/* CONFIRMATION / COMPLETION MODAL */}
      {showEndModal && (
        <div className="fixed inset-0 z-[3000] bg-text/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-ivory border border-border w-full max-w-md rounded-3xl shadow-2xl p-6 sm:p-8 relative">
            {!tripCompleted ? (
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-terracotta/15 text-terracotta flex items-center justify-center mx-auto">
                  <Flag className="w-6 h-6" />
                </div>
                <div className="text-center space-y-1">
                  <h3 className="font-serif text-2xl font-bold text-text">
                    Complete Active Journey?
                  </h3>
                  <p className="text-xs text-text-muted max-w-xs mx-auto">
                    Your visited places (pinned on your 3D Earth globe) and logged trip expenses will be saved to your travel history.
                  </p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-border space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-text-muted">Places Visited:</span>
                    <span className="font-bold text-deep-green">{completedCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Places Skipped:</span>
                    <span className="font-bold text-terracotta">{skippedCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Remaining Pending:</span>
                    <span className="font-bold text-text">{remainingCount}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowEndModal(false)}
                  >
                    Continue Trip
                  </Button>
                  <Button
                    variant="primary"
                    className="flex-1"
                    onClick={confirmEndTrip}
                  >
                    Confirm & Complete
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-5 text-center">
                <div className="w-16 h-16 rounded-3xl bg-deep-green text-white flex items-center justify-center mx-auto shadow-soft-lg animate-bounce">
                  <Trophy className="w-8 h-8 text-sage-light" />
                </div>

                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-terracotta bg-terracotta/10 px-3 py-1 rounded-full">
                    Journey Complete!
                  </span>
                  <h3 className="font-serif text-2xl font-bold text-text">
                    Splendid Voyage!
                  </h3>
                  <p className="text-xs text-text-muted">
                    Your {completionStats?.city} expedition and visited places are now saved on your 3D Earth Globe.
                  </p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-border grid grid-cols-3 gap-3 text-center">
                  <div className="space-y-0.5">
                    <div className="font-serif text-xl font-bold text-deep-green">
                      {completionStats?.visitedCount}/{completionStats?.totalStops}
                    </div>
                    <div className="text-[10px] uppercase font-bold text-text-subtle">
                      Visited
                    </div>
                  </div>

                  <div className="space-y-0.5">
                    <div className="font-serif text-xl font-bold text-terracotta">
                      {completionStats?.completionRate}%
                    </div>
                    <div className="text-[10px] uppercase font-bold text-text-subtle">
                      Completion
                    </div>
                  </div>

                  <div className="space-y-0.5">
                    <div className="font-serif text-xl font-bold text-charcoal">
                      ₹{(completionStats?.totalActualSpent || 0).toLocaleString('en-IN')}
                    </div>
                    <div className="text-[10px] uppercase font-bold text-text-subtle">
                      Logged Spend
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={() => navigate('/my-trips')}
                    icon={<Award className="w-4 h-4 text-sage-light" />}
                  >
                    View in My Trips Dashboard
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/')}
                  >
                    Return to 3D Globe on Home Page
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

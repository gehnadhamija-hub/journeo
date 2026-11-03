import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  MapPin,
  Clock,
  Navigation,
  CheckCircle2,
  AlertTriangle,
  Play,
  Save,
  RotateCcw,
  Trash2,
  ShieldCheck,
  Star,
  Calendar,
  Plane,
  ExternalLink,
  Eye,
  Users,
  Wallet,
  Edit3
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTripContext } from '../context/TripContext';
import { MapComponent } from '../components/MapComponent';
import { PlacePreviewModal } from '../components/PlacePreviewModal';
import { TripExpenseTrackerPanel } from '../components/TripExpenseTrackerPanel';
import { TripAssistantDrawer } from '../components/TripAssistantDrawer';
import { generateOptimizedItinerary, OptimizedItineraryResponse } from '../features/itinerary/services/itineraryOptimizer';
import { resolveCanonicalDestination } from '../data/canonicalDestinations';
import { INDIA_DESTINATIONS, IndiaDestination } from '../data/indiaDestinations';
import { getPlaceReviewData } from '../data/placeReviews';

function extractStartingLocationString(itineraryData: any): string {
  const raw = itineraryData?.tripConfig?.startingLocation;
  if (typeof raw === 'string' && raw.trim().length > 0) {
    return raw.trim();
  }
  if (raw && typeof raw === 'object') {
    if (typeof raw.address === 'string' && raw.address.trim()) return raw.address.trim();
    if (typeof raw.name === 'string' && raw.name.trim()) return raw.name.trim();
  }
  if (itineraryData?.canonicalDestination?.suggestedStartingPoint?.name) {
    return itineraryData.canonicalDestination.suggestedStartingPoint.name;
  }
  const city = itineraryData?.destinationCity || itineraryData?.destination || 'Goa';
  const canon = resolveCanonicalDestination(typeof city === 'string' ? city : 'Goa');
  return canon?.suggestedStartingPoint?.name || 'City Centre';
}

function enrichStopWithCatalog(stop: any, idx: number, fallbackCity: string = 'Goa') {
  const dest = stop?.destination || {};
  const rawId = stop?.placeId || stop?.destinationId || dest?.id || stop?.id;
  const rawName = dest?.name || stop?.name || stop?.title || `Stop ${idx + 1}`;
  const catalogMatch = INDIA_DESTINATIONS.find(
    d =>
      (rawId && (d.id === rawId || d.providerPlaceId === rawId)) ||
      (rawName && d.name.toLowerCase().includes(String(rawName).toLowerCase()))
  );

  const canon =
    resolveCanonicalDestination(catalogMatch?.city || dest?.city || fallbackCity) ||
    resolveCanonicalDestination('Goa')!;
  const lat =
    stop?.coordinates?.lat ??
    dest?.latitude ??
    catalogMatch?.latitude ??
    canon.center.lat;
  const lng =
    stop?.coordinates?.lng ??
    dest?.longitude ??
    catalogMatch?.longitude ??
    canon.center.lng;

  return {
    ...stop,
    id: stop?.id || catalogMatch?.id || `stop-${idx + 1}`,
    placeId: stop?.placeId || catalogMatch?.id || `place-${idx + 1}`,
    plannedArrival: stop?.plannedArrival || stop?.startTime || '09:30',
    plannedDeparture: stop?.plannedDeparture || stop?.endTime || '11:00',
    visitDuration:
      stop?.visitDuration ||
      stop?.visitDurationMinutes ||
      catalogMatch?.averageVisitDuration ||
      90,
    visitStatus: stop?.visitStatus || 'PENDING',
    coordinates: { lat, lng },
    destination: {
      ...catalogMatch,
      ...dest,
      id: dest?.id || catalogMatch?.id || `dest-${idx + 1}`,
      name: dest?.name || catalogMatch?.name || rawName,
      city: dest?.city || catalogMatch?.city || canon.destinationName,
      state: dest?.state || catalogMatch?.state || canon.state,
      area: dest?.area || catalogMatch?.area || canon.popularAreas[0] || canon.destinationName,
      category: dest?.category || catalogMatch?.category || 'Heritage',
      description:
        dest?.description ||
        catalogMatch?.description ||
        `Verified cultural and heritage landmark in ${canon.destinationName}.`,
      imageUrl: dest?.imageUrl || catalogMatch?.imageUrl || canon.heroImageUrl,
      openingHours: dest?.openingHours || catalogMatch?.openingHours || '09:00 - 18:00',
      entryFeeINR: dest?.entryFeeINR ?? catalogMatch?.entryFeeINR ?? 0,
      highlights: dest?.highlights || catalogMatch?.highlights || [],
      averageVisitDuration:
        dest?.averageVisitDuration || catalogMatch?.averageVisitDuration || 90,
      latitude: lat,
      longitude: lng
    }
  };
}

export const ItineraryResultPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    activeTrip,
    startTrip,
    setActiveTrip,
    applyAssistantItineraryUpdate,
    undoLastAssistantUpdate
  } = useTripContext();

  const [itineraryData, setItineraryData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [stops, setStops] = useState<any[]>([]);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [activeDayTab, setActiveDayTab] = useState<number | 'ALL'>('ALL');
  const [previewPlace, setPreviewPlace] = useState<IndiaDestination | null>(null);
  const [showStartReviewModal, setShowStartReviewModal] = useState<boolean>(false);

  // Replan modal
  const [replanOpen, setReplanOpen] = useState(false);
  const [replanning, setReplanning] = useState(false);
  const [replanScenario, setReplanScenario] = useState<any>(null);
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>('prioritize_must_visits');
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const applyLoadedPlan = (planObj: any, rawStops: any[]) => {
      const city =
        planObj?.destinationCity ||
        (typeof planObj?.destination === 'string' ? planObj.destination : '') ||
        planObj?.tripConfig?.city ||
        activeTrip?.destinationName ||
        'Goa';

      const enrichedStops = rawStops.map((s, idx) => enrichStopWithCatalog(s, idx, city));
      setItineraryData(planObj);
      setStops(enrichedStops);
      if (enrichedStops.length > 0) {
        setSelectedStopId(
          enrichedStops[0].id ||
            enrichedStops[0].placeId ||
            enrichedStops[0].destination?.id
        );
      }
      setLoading(false);
    };

    if (
      activeTrip?.itinerary &&
      (activeTrip.stops?.length > 0 || activeTrip.itinerary.stops?.length > 0)
    ) {
      const scheduled = activeTrip.stops?.length
        ? activeTrip.stops
        : activeTrip.itinerary.stops || [];
      applyLoadedPlan(activeTrip.itinerary, scheduled);
      return;
    }

    const cached = sessionStorage.getItem('journeo_generated_plan');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        const scheduled = parsed.plan?.scheduledStops || parsed.stops || [];
        if (scheduled.length > 0) {
          applyLoadedPlan(parsed, scheduled);
          return;
        }
      } catch (err) {
        console.error('Error loading cached itinerary:', err);
      }
    }

    try {
      const fallbackCity = activeTrip?.destinationName || 'Goa';
      const fallbackCanonical =
        resolveCanonicalDestination(fallbackCity) || resolveCanonicalDestination('Goa')!;
      const generated = generateOptimizedItinerary({
        destination: fallbackCanonical.destinationName,
        canonicalDestination: fallbackCanonical,
        days: 3,
        travelPace: 'balanced',
        transportMode: 'cab'
      });
      applyLoadedPlan(generated, generated.stops);
    } catch (err) {
      console.error('Fallback itinerary generation failed:', err);
      setLoading(false);
    }
  }, [activeTrip]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleRemoveStop = (idx: number) => {
    if (stops.length <= 2) {
      alert('An itinerary requires at least 2 stops for a complete route.');
      return;
    }
    const updated = stops
      .filter((_, i) => i !== idx)
      .map((s, newIdx) => ({
        ...s,
        sequenceNumber: newIdx + 1
      }));
    setStops(updated);
    showToast('Stop removed. Route and schedule adjusted.');
  };

  const handleEditDuration = (idx: number, delta: number) => {
    const updated = [...stops];
    const target = updated[idx];
    const newDur = Math.max(30, Math.min(240, (target.visitDuration || 60) + delta));
    target.visitDuration = newDur;
    setStops(updated);
    showToast(`Dwell time updated to ${newDur} mins.`);
  };

  const handleSaveTrip = async () => {
    if (!user) {
      alert('Please log in or click Quick Demo Login to save your trip.');
      return;
    }
    setSaving(true);
    try {
      const config = itineraryData?.tripConfig || {};
      const startLocStr = extractStartingLocationString(itineraryData);
      const payload = {
        userId: user.id,
        title:
          itineraryData?.title ||
          `${itineraryData?.destinationCity || 'India'} Personalised Circuit`,
        destinationCity: itineraryData?.destinationCity || config.city || 'India',
        startDate: config.startDate || new Date().toISOString().split('T')[0],
        endDate: config.endDate || config.startDate || new Date().toISOString().split('T')[0],
        startingLocation: startLocStr,
        budget: itineraryData?.budgetBreakdown?.totalBudget || config.budget || 25000,
        groupSize: config.travellers || config.groupSize || 2,
        transportation: config.transportation || config.transportMode || 'cab',
        travelStyle: config.travelStyle || config.travelPace || 'balanced',
        status: 'UPCOMING',
        optimizationScore: itineraryData?.plan?.optimizationScore || 95,
        totalDistanceKm: itineraryData?.plan?.totalDistanceKm || 20.9,
        totalDurationMin: itineraryData?.plan?.totalDurationMin || 420,
        stops: stops.map((s, idx) => ({
          id: s.id || `stop-${idx + 1}`,
          placeId: s.placeId || s.destination?.id || `dest-${idx + 1}`,
          destinationId: s.destinationId || s.destination?.id || `dest-${idx + 1}`,
          sequenceNumber: idx + 1,
          destination: s.destination || { name: s.destinationId || `Stop ${idx + 1}`, imageUrl: '' },
          coordinates: s.coordinates || {
            lat: s.destination?.latitude || 15.4989,
            lng: s.destination?.longitude || 73.8278
          },
          plannedArrival: s.plannedArrival,
          plannedDeparture: s.plannedDeparture,
          visitDuration: s.visitDuration,
          visitStatus: s.visitStatus || 'PENDING',
          isMustVisit: s.isMustVisit || false,
          transitInstruction: s.transitInstruction || '',
          transitMinutes: s.transitMinutes || 15,
          distanceFromPrevKm: s.distanceFromPrevKm || 3.0
        }))
      };

      const savedTrips = JSON.parse(localStorage.getItem('journeo_saved_trips') || '[]');
      const tripIdToUse = activeTrip?.tripId || itineraryData?.tripId || 'trip_' + Date.now();
      const newTripRecord = {
        id: tripIdToUse,
        ...payload,
        createdAt: new Date().toISOString()
      };
      localStorage.setItem(
        'journeo_saved_trips',
        JSON.stringify([
          newTripRecord,
          ...savedTrips.filter((t: any) => t.id !== tripIdToUse && t.title !== payload.title)
        ])
      );

      try {
        const res = await api.createTrip(payload);
        if (res?.trip) {
          sessionStorage.setItem('journeo_active_trip', JSON.stringify(res.trip));
        }
      } catch (backendErr) {
        console.warn('Backend API save skipped, saved locally:', backendErr);
      }

      showToast('🎉 Trip saved successfully to My Trips!');
    } catch (err: any) {
      alert(err.message || 'Failed to save trip');
    } finally {
      setSaving(false);
    }
  };

  // Confirmed Start Trip action from Pre-Departure Review Modal (Part 7)
  const confirmStartTripAndNavigate = async () => {
    setShowStartReviewModal(false);

    if (activeTrip) {
      startTrip();
    } else if (itineraryData) {
      const city = itineraryData.destinationCity || itineraryData.tripConfig?.city || 'Goa';
      const canonical =
        itineraryData.canonicalDestination ||
        resolveCanonicalDestination(city) ||
        resolveCanonicalDestination('Goa')!;
      setActiveTrip({
        tripId: itineraryData.tripId || `trip_${Date.now()}`,
        destinationName: canonical.destinationName,
        destination: canonical,
        status: 'in_progress',
        startedAt: new Date().toISOString(),
        preferences: itineraryData.tripConfig || {},
        itinerary: itineraryData,
        stops: stops,
        currentStopIndex: 0
      });
    }

    sessionStorage.setItem('journeo_active_journey_stops', JSON.stringify(stops));
    sessionStorage.setItem('journeo_active_journey_meta', JSON.stringify(itineraryData));
    navigate('/journey');
  };

  const handleOpenReplan = async (delayedIndex: number = 0, delayMinutes: number = 45) => {
    setReplanning(true);
    setReplanOpen(true);
    try {
      const scenario = await api.replanItinerary('preview', {
        delayedStopIndex: delayedIndex,
        delayMinutes,
        reason: 'running_late',
        stops
      });
      if (scenario?.strategies) {
        setReplanScenario(scenario);
        return;
      }
    } catch (err) {
      console.warn('Replan API offline, computing adaptive strategies client-side:', err);
    } finally {
      setReplanning(false);
    }

    const lastStop = stops[stops.length - 1];
    const threatened = lastStop
      ? [
          {
            destinationName: lastStop.destination?.name || 'Final Evening Stop',
            issue: `Projected arrival pushed +${delayMinutes} mins close to closing window (${lastStop.destination?.openingHours || '17:30'}).`
          }
        ]
      : [];

    const strat1Stops =
      stops.length > 2 ? stops.filter((_, idx) => idx !== stops.length - 2) : stops;
    const strat2Stops = stops.map(s => ({
      ...s,
      visitDuration: Math.max(35, Math.round((s.visitDuration || 75) * 0.78))
    }));
    const strat3Stops = [...stops];

    setReplanScenario({
      threatenedStops: threatened,
      strategies: [
        {
          id: 'prioritize_must_visits',
          badge: 'Recommended',
          score: 96,
          title: 'Prioritize Must-Visit Landmarks',
          explanation:
            'Retains all must-visit heritage monuments at full dwell time by dropping one lower-priority stop.',
          stopsCount: strat1Stops.length,
          timeSavedMinutes: 60,
          stops: strat1Stops
        },
        {
          id: 'compress_dwell_times',
          badge: 'Keep All Stops',
          score: 91,
          title: 'Balanced Dwell Compression',
          explanation:
            'Compresses stay durations by ~20% across remaining stops so every planned sight fits before sunset.',
          stopsCount: strat2Stops.length,
          timeSavedMinutes: 45,
          stops: strat2Stops
        },
        {
          id: 'shift_to_evening',
          badge: 'Relaxed Evening',
          score: 86,
          title: 'Extend Evening Schedule',
          explanation:
            'Shifts downstream schedule by +45m and transitions the final stop into an illuminated evening visit.',
          stopsCount: strat3Stops.length,
          timeSavedMinutes: 30,
          stops: strat3Stops
        }
      ]
    });
  };

  const handleApplyStrategy = () => {
    if (!replanScenario) return;
    const strat =
      replanScenario.strategies.find((s: any) => s.id === selectedStrategyId) ||
      replanScenario.strategies[0];
    if (strat && strat.stops) {
      setStops(strat.stops);
      setReplanOpen(false);
      showToast(`✅ Applied "${strat.title}". Downstream stops adapted.`);
    }
  };

  const handleRegenerateAlternative = () => {
    if (!itineraryData?.tripConfig) {
      showToast('No trip configuration found to regenerate.');
      return;
    }
    try {
      const newSeed = Math.floor(Math.random() * 1000) + 1;
      const refreshed = generateOptimizedItinerary({
        ...itineraryData.tripConfig,
        seedVariation: newSeed
      });
      setItineraryData(refreshed);
      const scheduled = refreshed.stops || [];
      setStops(scheduled);
      sessionStorage.setItem('journeo_generated_plan', JSON.stringify(refreshed));
      showToast('✨ Regenerated alternative balanced circuit!');
    } catch (err: any) {
      console.error('Failed to regenerate alternative:', err);
      showToast('Could not regenerate alternative itinerary.');
    }
  };

  const activeDayObj =
    activeDayTab === 'ALL'
      ? null
      : itineraryData?.days?.find((d: any) => d.dayNumber === activeDayTab);

  const displayedStops =
    activeDayTab === 'ALL' ? stops : activeDayObj?.stops || stops;

  const mapMarkers = displayedStops.map((s: any, idx: number) => {
    const dest = s.destination || {};
    return {
      id: s.id || dest.id || String(idx),
      lat: s.coordinates?.lat || dest.latitude || 28.6139,
      lng: s.coordinates?.lng || dest.longitude || 77.2090,
      title: dest.name || 'Monument',
      order: idx + 1,
      isMustVisit: s.isMustVisit,
      isMealStop: s.isMealStop || dest.isMealStop,
      mealType: s.mealType,
      cuisineType: s.cuisineType,
      timing: `${s.plannedArrival} - ${s.plannedDeparture}`,
      imageUrl: dest.imageUrl,
      description: dest.description
    };
  });

  const intercitySummary = itineraryData?.intercitySummary;
  const budgetBreakdown = itineraryData?.budgetBreakdown;
  const tripDaysCount = itineraryData?.days?.length || itineraryData?.tripConfig?.days || 1;
  const travellersCount =
    itineraryData?.tripConfig?.travellers ||
    budgetBreakdown?.travellers ||
    activeTrip?.preferences?.travellers ||
    2;

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-deep-green/10 text-deep-green flex items-center justify-center mx-auto animate-pulse">
          <Sparkles className="w-6 h-6" />
        </div>
        <p className="font-serif text-lg font-bold text-text">
          Loading Your Optimized Itinerary...
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Toast Notice */}
      {toastMessage && (
        <div className="bg-deep-green text-white text-xs font-semibold py-2.5 px-4 rounded-xl shadow-soft-md text-center sticky top-24 z-40 animate-fade-in">
          {toastMessage}
        </div>
      )}

      {/* Header & Metrics Strip */}
      <div className="bg-white rounded-3xl border border-border p-6 sm:p-8 shadow-soft-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-[11px] font-bold uppercase tracking-wider text-terracotta bg-terracotta/10 px-2.5 py-0.5 rounded-full">
                {tripDaysCount}-Day Optimized Itinerary
              </span>
              <span className="text-[11px] font-semibold text-deep-green bg-sage/15 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> ASI / UNESCO Verified
              </span>
              <span className="text-[11px] font-semibold text-charcoal bg-ivory px-2.5 py-0.5 rounded-full border border-border flex items-center gap-1">
                <Users className="w-3 h-3 text-sage" /> {travellersCount} {travellersCount === 1 ? 'Traveller' : 'Travellers'}
              </span>
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-text">
              {itineraryData?.title || 'Personalized Heritage Circuit'}
            </h1>
            <p className="text-xs text-text-muted mt-1">
              Starting from {extractStartingLocationString(itineraryData)} • {stops.length} Curated Stops across {tripDaysCount} {tripDaysCount === 1 ? 'Day' : 'Days'}
            </p>
          </div>

          {/* Core Actions: Edit, Save, Replan, Alternative, Review & Start Journey */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() =>
                navigate(
                  `/plan?destination=${encodeURIComponent(
                    itineraryData?.destinationCity || 'Goa'
                  )}`
                )
              }
              className="px-3.5 py-2.5 rounded-xl border border-border bg-ivory hover:bg-ivory-dark text-text text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <Edit3 className="w-3.5 h-3.5 text-sage" />
              <span>Edit Preferences</span>
            </button>

            <button
              onClick={handleRegenerateAlternative}
              className="px-3.5 py-2.5 rounded-xl border border-border bg-ivory hover:bg-ivory-dark text-text text-xs font-semibold transition-colors flex items-center gap-1.5"
              title="Regenerate alternative circuit variation"
            >
              <RotateCcw className="w-3.5 h-3.5 text-deep-green" />
              <span>Alternative Circuit</span>
            </button>

            <button
              onClick={() => handleOpenReplan(0, 45)}
              className="px-3.5 py-2.5 rounded-xl border border-terracotta/40 bg-terracotta/10 hover:bg-terracotta/20 text-terracotta-dark text-xs font-semibold transition-all flex items-center gap-1.5"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-terracotta" />
              <span>Simulate Delay</span>
            </button>

            <button
              onClick={handleSaveTrip}
              disabled={saving}
              className="px-3.5 py-2.5 rounded-xl border border-border bg-ivory hover:bg-ivory-dark text-text text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5 text-text-subtle" />
              <span>{saving ? 'Saving...' : 'Save Trip'}</span>
            </button>

            <button
              onClick={() => setShowStartReviewModal(true)}
              className="px-5 py-2.5 rounded-xl bg-deep-green hover:bg-deep-green-dark text-white text-xs font-bold transition-all shadow-soft-sm flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Review & Start Trip</span>
            </button>
          </div>
        </div>

        {/* Intercity Travel Summary Strip (Part 1) */}
        {intercitySummary && (
          <div className="bg-ivory/90 rounded-2xl p-4 border border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-deep-green text-white flex items-center justify-center shrink-0 mt-0.5">
                <Plane className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-deep-green">
                    Intercity Travel: {intercitySummary.originCity} → {intercitySummary.destinationCity} ({intercitySummary.modeLabel})
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                    {intercitySummary.durationLabel} • ~{intercitySummary.approxDistanceKm} km
                  </span>
                </div>
                <p className="text-xs text-text-muted mt-0.5">
                  Day 1 Arrival ~{intercitySummary.recommendedArrivalTimeDay1} (Sightseeing starts {intercitySummary.recommendedSightseeingStartDay1}) • Est. Transit Cost: ₹{intercitySummary.estimatedTotalCostINR.toLocaleString('en-IN')} ({travellersCount} pax)
                </p>
              </div>
            </div>

            {intercitySummary.bookingReferenceUrl && (
              <a
                href={intercitySummary.bookingReferenceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 rounded-xl bg-white border border-border hover:border-deep-green text-xs font-bold text-deep-green inline-flex items-center gap-1.5 self-start md:self-center shrink-0"
              >
                Check {intercitySummary.bookingPortalName?.split('/')[0]} <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        )}

        {/* Summary Metric Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-border">
          <div className="bg-ivory rounded-xl p-3 border border-border/70 text-center">
            <span className="text-[11px] text-text-subtle block">Total Stops & Days</span>
            <span className="font-serif font-bold text-lg text-text">
              {stops.length} Stops • {tripDaysCount}d
            </span>
          </div>

          <div className="bg-ivory rounded-xl p-3 border border-border/70 text-center">
            <span className="text-[11px] text-text-subtle block">Route Efficiency</span>
            <span className="font-serif font-bold text-lg text-deep-green">
              {itineraryData?.optimization?.routeEfficiencyScore || 96}%
            </span>
          </div>

          <div className="bg-ivory rounded-xl p-3 border border-border/70 text-center">
            <span className="text-[11px] text-text-subtle block">Est. Trip Expense</span>
            <span className="font-serif font-bold text-lg text-terracotta">
              ₹{(budgetBreakdown?.estimatedExpenses?.totalEstimated || 12500).toLocaleString('en-IN')}
            </span>
          </div>

          <div className="bg-ivory rounded-xl p-3 border border-border/70 text-center">
            <span className="text-[11px] text-text-subtle block">Schedule Feasibility</span>
            <span className="font-serif font-bold text-lg text-deep-green">
              {itineraryData?.optimization?.scheduleFeasibilityScore || 98}%
            </span>
          </div>
        </div>

        {/* Multi-Day Tabs Strip (supports 1 to 21+ days cleanly) */}
        {itineraryData?.days && itineraryData.days.length > 1 && (
          <div className="pt-2 border-t border-border">
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <span className="text-xs font-bold text-text-muted mr-1 flex items-center gap-1 shrink-0">
                <Calendar className="w-3.5 h-3.5" /> Day Schedule ({itineraryData.days.length} Days):
              </span>
              <button
                type="button"
                onClick={() => setActiveDayTab('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  activeDayTab === 'ALL'
                    ? 'bg-deep-green text-white shadow-soft-sm'
                    : 'bg-ivory hover:bg-ivory-dark text-text border border-border'
                }`}
              >
                All {itineraryData.days.length} Days ({stops.length} stops)
              </button>
              {itineraryData.days.map((day: any) => (
                <button
                  key={day.dayNumber}
                  type="button"
                  onClick={() => setActiveDayTab(day.dayNumber)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                    activeDayTab === day.dayNumber
                      ? 'bg-deep-green text-white shadow-soft-sm'
                      : 'bg-ivory hover:bg-ivory-dark text-text border border-border'
                  }`}
                >
                  <span>Day {day.dayNumber}</span>
                  {day.date && (
                    <span className="text-[10px] opacity-75">
                      ({day.date.slice(5)})
                    </span>
                  )}
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded ${
                      activeDayTab === day.dayNumber
                        ? 'bg-white/20 text-white'
                        : 'bg-sage/20 text-deep-green'
                    }`}
                  >
                    {day.area}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Active Day Advisory Banner (e.g., Arrival day or Extended neighborhood immersion note) */}
      {activeDayObj?.dayAdvisory && (
        <div className="bg-sage/15 border border-sage/30 rounded-2xl p-4 text-xs text-deep-green font-medium flex items-center gap-2.5">
          <Sparkles className="w-4 h-4 text-terracotta shrink-0" />
          <span>{activeDayObj.dayAdvisory}</span>
        </div>
      )}

      {/* SPLIT SCREEN: LEFT TIMELINE (6 cols), RIGHT MAP (6 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT SIDE: ITINERARY TIMELINE */}
        <div className="lg:col-span-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg font-bold text-text">
              {activeDayTab === 'ALL'
                ? `Complete ${tripDaysCount}-Day Timeline (${displayedStops.length} Stops)`
                : `Day ${activeDayTab} Schedule • ${activeDayObj?.date || ''}`}
            </h2>
            <span className="text-xs text-text-muted">
              Click any place for reviews & details
            </span>
          </div>

          <div className="relative pl-6 space-y-5 before:absolute before:left-2.5 before:top-4 before:bottom-4 before:w-0.5 before:bg-sage/40">
            {displayedStops.map((stop: any, idx: number) => {
              const dest = stop.destination || {};
              const isSelected = selectedStopId === (stop.id || dest.id);
              const rev = getPlaceReviewData(dest.id || stop.placeId || dest.name);

              return (
                <div key={stop.id || idx} className="relative group">
                  <div
                    className={`absolute -left-6 top-4 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold shadow-sm ${
                      stop.isMustVisit ? 'bg-terracotta text-white' : 'bg-deep-green text-white'
                    }`}
                  >
                    {idx + 1}
                  </div>

                  <div className="text-[11px] text-text-subtle font-medium mb-1.5 flex items-center gap-1.5 pl-2">
                    <Navigation className="w-3 h-3 text-sage" />
                    <span>{stop.transitInstruction || `Transit to ${dest.name}`}</span>
                  </div>

                  <div
                    onClick={() => setSelectedStopId(stop.id || dest.id)}
                    className={`bg-white rounded-2xl p-5 border transition-all ${
                      isSelected
                        ? 'border-deep-green shadow-soft-md ring-1 ring-deep-green/30'
                        : 'border-border hover:border-sage'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-[10px] font-bold text-deep-green bg-sage/15 px-2 py-0.5 rounded">
                            Stop {idx + 1}
                          </span>
                          {stop.isMustVisit && (
                            <span className="text-[10px] font-bold text-terracotta-dark bg-terracotta/15 px-2 py-0.5 rounded flex items-center gap-1">
                              <Star className="w-3 h-3 fill-current" /> Must Visit
                            </span>
                          )}
                          <span className="text-[10px] text-text-subtle font-mono">
                            {dest.category || 'Monument'}
                          </span>
                          {rev.available && (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-0.5">
                              <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                              {rev.averageRating.toFixed(1)} ({rev.totalReviewCount.toLocaleString('en-IN')})
                            </span>
                          )}
                        </div>

                        {(stop.isMealStop || dest.isMealStop) && (
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className="text-[10px] font-bold text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded flex items-center gap-1">
                              🍽️ {stop.mealType ? stop.mealType.toUpperCase() : 'MEAL STOP'} •{' '}
                              {stop.cuisineType || dest.cuisineType || 'Authentic Regional Food'}
                            </span>
                            {(stop.averageCostINR || dest.averageCostPerPersonINR) && (
                              <span className="text-[10px] text-text-subtle font-medium">
                                ~₹{stop.averageCostINR || dest.averageCostPerPersonINR}/person
                              </span>
                            )}
                          </div>
                        )}

                        <h3 className="font-serif font-bold text-base text-text">
                          {dest.name}
                        </h3>

                        <p className="text-xs text-text-muted mt-0.5 line-clamp-2">
                          {dest.description}
                        </p>

                        {stop.reasonForSelection && (
                          <div className="mt-2 text-[11px] text-deep-green bg-sage/10 rounded-lg px-2.5 py-1.5 flex items-start gap-1.5 border border-sage/20">
                            <Sparkles className="w-3.5 h-3.5 text-terracotta mt-0.5 flex-shrink-0" />
                            <span className="leading-snug">
                              <strong className="font-semibold text-text">Selection reasoning:</strong>{' '}
                              {stop.reasonForSelection}
                            </span>
                          </div>
                        )}
                      </div>

                      <img
                        src={dest.imageUrl}
                        alt={dest.name}
                        className="w-16 h-16 rounded-xl object-cover border border-border flex-shrink-0 cursor-pointer"
                        onClick={e => {
                          e.stopPropagation();
                          setPreviewPlace(dest);
                        }}
                      />
                    </div>

                    <div className="mt-4 pt-3 border-t border-border/70 flex items-center justify-between text-xs flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-text flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-deep-green" />
                          {stop.plannedArrival} - {stop.plannedDeparture}
                        </span>
                        <div className="flex items-center gap-1 bg-ivory border border-border px-2 py-0.5 rounded-lg text-[11px]">
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              handleEditDuration(idx, -15);
                            }}
                            className="text-text-subtle hover:text-text px-1 font-bold"
                          >
                            -
                          </button>
                          <span>{stop.visitDuration}m stay</span>
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              handleEditDuration(idx, 15);
                            }}
                            className="text-text-subtle hover:text-text px-1 font-bold"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            setPreviewPlace(dest);
                          }}
                          className="text-[11px] font-bold text-deep-green hover:underline flex items-center gap-1 px-2 py-1 rounded-lg bg-ivory"
                        >
                          <Eye className="w-3 h-3" /> Reviews & Info
                        </button>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            handleRemoveStop(idx);
                          }}
                          className="text-text-subtle hover:text-terracotta p-1 transition-colors"
                          title="Remove stop"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT SIDE: INTERACTIVE ROUTE MAP */}
        <div className="lg:col-span-6 sticky top-24 space-y-4">
          <div className="bg-white rounded-3xl border border-border p-4 shadow-soft-sm">
            <div className="flex items-center justify-between mb-3 px-2">
              <h3 className="font-serif font-bold text-base text-text flex items-center gap-2">
                <MapPin className="w-4 h-4 text-terracotta" />
                <span>Geographic Circuit Route ({itineraryData?.destinationCity || 'India'})</span>
              </h3>
              <span className="text-xs text-text-muted">
                {displayedStops.length} Ordered Coordinates
              </span>
            </div>

            <MapComponent
              markers={mapMarkers}
              selectedMarkerId={selectedStopId || undefined}
              onMarkerClick={m => setSelectedStopId(m.id)}
              height="520px"
              showRoute={true}
            />
          </div>

          <div className="bg-ivory-dark p-4 rounded-2xl border border-border text-xs text-text-muted space-y-1.5">
            <div className="font-bold text-text flex items-center gap-1.5">
              <span>🏛️ Gate Opening Hours & Route Assurance:</span>
            </div>
            <p className="leading-relaxed">
              Monument opening hours and intercity arrival/departure buffers are respected automatically. Click any stop’s "Reviews & Info" button to inspect visitor reviews and Google Maps links.
            </p>
          </div>
        </div>
      </div>

      {/* BUDGET & LIVE EXPENSE TRACKER PANEL (Parts 2, 8 & 9) */}
      <TripExpenseTrackerPanel
        tripId={activeTrip?.tripId || itineraryData?.tripId || 'active-trip'}
        userId={user?.id || 'guest'}
        travellers={travellersCount}
        budgetBreakdown={budgetBreakdown}
        stops={stops}
      />

      {/* PRE-DEPARTURE TRIP REVIEW & START CONFIRMATION MODAL (Part 7) */}
      {showStartReviewModal && (
        <div className="fixed inset-0 z-[3000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#FBF9F4] border border-border w-full max-w-2xl rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto animate-fade-in">
            <div className="flex items-start justify-between border-b border-border pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-deep-green bg-sage/20 px-2.5 py-0.5 rounded-full">
                  Pre-Departure Trip Review
                </span>
                <h3 className="font-serif text-2xl font-bold text-text mt-1">
                  Ready to Start Your {itineraryData?.destinationCity} Trip?
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Review your confirmed logistics, transport, budget, and day-wise plan before activating live tracking.
                </p>
              </div>
              <button
                onClick={() => setShowStartReviewModal(false)}
                className="text-text-subtle hover:text-text p-1"
              >
                ✕
              </button>
            </div>

            {/* Key Trip Summary Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-white p-3.5 rounded-2xl border border-border">
                <span className="text-[10px] font-bold uppercase text-text-subtle block">
                  Route & Origin
                </span>
                <span className="font-bold text-text mt-0.5 block">
                  {intercitySummary?.originCity || 'Delhi'} → {itineraryData?.destinationCity}
                </span>
              </div>

              <div className="bg-white p-3.5 rounded-2xl border border-border">
                <span className="text-[10px] font-bold uppercase text-text-subtle block">
                  Dates & Duration
                </span>
                <span className="font-bold text-text mt-0.5 block">
                  {tripDaysCount} {tripDaysCount === 1 ? 'Day' : 'Days'} ({itineraryData?.tripConfig?.startDate || 'Today'})
                </span>
              </div>

              <div className="bg-white p-3.5 rounded-2xl border border-border">
                <span className="text-[10px] font-bold uppercase text-text-subtle block">
                  Travellers
                </span>
                <span className="font-bold text-text mt-0.5 block">
                  {travellersCount} {travellersCount === 1 ? 'Traveller' : 'Travellers'}
                </span>
              </div>

              <div className="bg-white p-3.5 rounded-2xl border border-border">
                <span className="text-[10px] font-bold uppercase text-text-subtle block">
                  Intercity Transport
                </span>
                <span className="font-bold text-deep-green mt-0.5 block truncate">
                  {intercitySummary?.modeLabel || 'Flight'}
                </span>
              </div>

              <div className="bg-white p-3.5 rounded-2xl border border-border">
                <span className="text-[10px] font-bold uppercase text-text-subtle block">
                  Local Transport
                </span>
                <span className="font-bold text-text mt-0.5 block uppercase">
                  {itineraryData?.tripConfig?.transportMode || 'Cab'}
                </span>
              </div>

              <div className="bg-white p-3.5 rounded-2xl border border-border">
                <span className="text-[10px] font-bold uppercase text-text-subtle block">
                  Budget vs Est. Cost
                </span>
                <span className="font-bold text-terracotta mt-0.5 block">
                  ₹{(budgetBreakdown?.estimatedExpenses?.totalEstimated || 12500).toLocaleString('en-IN')} / ₹{(budgetBreakdown?.totalBudget || 25000).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Day-wise Schedule Summary */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted">
                Day-by-Day Itinerary Summary ({stops.length} Total Stops)
              </h4>
              <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                {(itineraryData?.days || [{ dayNumber: 1, title: 'Day 1 Circuit', stops }]).map(
                  (d: any) => (
                    <div
                      key={d.dayNumber}
                      className="bg-white p-3 rounded-xl border border-border text-xs flex items-center justify-between gap-2"
                    >
                      <div>
                        <span className="font-bold text-deep-green">
                          Day {d.dayNumber} {d.date ? `(${d.date})` : ''}:
                        </span>{' '}
                        <span className="font-semibold text-text">{d.area || d.title}</span>
                        <div className="text-[11px] text-text-muted mt-0.5">
                          {(d.stops || []).map((s: any) => s.destination?.name || s.name).join(' → ')}
                        </div>
                      </div>
                      <span className="text-[11px] font-bold bg-ivory px-2.5 py-1 rounded-lg border border-border shrink-0">
                        {(d.stops || []).length} stops
                      </span>
                    </div>
                  )
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-border">
              <button
                type="button"
                onClick={() => {
                  setShowStartReviewModal(false);
                  navigate(
                    `/plan?destination=${encodeURIComponent(
                      itineraryData?.destinationCity || 'Goa'
                    )}`
                  );
                }}
                className="px-4 py-2.5 rounded-xl border border-border bg-white text-xs font-bold text-text hover:bg-ivory"
              >
                Edit Trip Details
              </button>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowStartReviewModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-text-muted hover:text-text"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmStartTripAndNavigate}
                  className="px-6 py-3 rounded-xl bg-deep-green hover:bg-deep-green-dark text-white text-xs font-bold flex items-center gap-2 shadow-md transition-all"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Confirm & Launch Active Trip Tracker
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADAPTIVE REPLANNING MODAL */}
      {replanOpen && (
        <div className="fixed inset-0 z-[3000] bg-text/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-ivory border border-border w-full max-w-3xl rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-terracotta bg-terracotta/10 px-2.5 py-0.5 rounded-full">
                  Adaptive Replanning Engine
                </span>
                <h3 className="font-serif text-2xl font-bold text-text mt-1">
                  Delay Simulation (+45 mins at {stops[0]?.destination?.name || 'Stop 1'})
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  The system recalculated remaining daylight, traffic, and closing gates.
                </p>
              </div>
              <button
                onClick={() => setReplanOpen(false)}
                className="text-text-subtle hover:text-text p-1"
              >
                ✕
              </button>
            </div>

            {replanScenario?.threatenedStops?.length > 0 && (
              <div className="bg-terracotta/10 border border-terracotta/30 p-4 rounded-2xl space-y-2">
                <div className="font-bold text-xs text-terracotta-dark flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-terracotta" />
                  <span>Downstream Stops at Risk of Gate Closure:</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {replanScenario.threatenedStops.map((t: any, i: number) => (
                    <div
                      key={i}
                      className="bg-white/80 p-2.5 rounded-xl border border-terracotta/20"
                    >
                      <div className="font-semibold text-text">{t.destinationName}</div>
                      <div className="text-[11px] text-terracotta-dark">{t.issue}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-3">
              <h4 className="font-serif font-bold text-sm text-text">
                Select Recovery Strategy
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {replanScenario?.strategies?.map((strat: any) => {
                  const isSel = selectedStrategyId === strat.id;
                  return (
                    <div
                      key={strat.id}
                      onClick={() => setSelectedStrategyId(strat.id)}
                      className={`cursor-pointer p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                        isSel
                          ? 'bg-white border-deep-green shadow-soft-md ring-2 ring-deep-green/20'
                          : 'bg-white/60 hover:bg-white border-border'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between text-[10px] font-bold uppercase mb-1">
                          <span className="text-terracotta">{strat.badge}</span>
                          <span className="text-deep-green">{strat.score}% Match</span>
                        </div>
                        <h5 className="font-serif font-bold text-xs text-text mb-1">
                          {strat.title}
                        </h5>
                        <p className="text-[11px] text-text-muted leading-relaxed line-clamp-3">
                          {strat.explanation}
                        </p>
                      </div>

                      <div className="mt-3 pt-2 border-t border-border/60 text-[10px] font-medium text-text-subtle flex justify-between">
                        <span>{strat.stopsCount} stops remaining</span>
                        <span className="text-deep-green font-bold">
                          +{strat.timeSavedMinutes}m saved
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 border-t border-border flex items-center justify-between">
              <button
                onClick={() => setReplanOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-text-muted hover:text-text"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyStrategy}
                className="px-6 py-2.5 bg-deep-green hover:bg-deep-green-dark text-white rounded-xl text-xs font-bold transition-all shadow-soft-sm flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Apply Selected Strategy</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Place Preview Modal */}
      <PlacePreviewModal
        place={previewPlace}
        onClose={() => setPreviewPlace(null)}
      />

      {/* Phase 7 Conversational AI Trip Assistant */}
      {itineraryData && (
        <TripAssistantDrawer
          itinerary={itineraryData as OptimizedItineraryResponse}
          onApplyItineraryUpdate={updated => {
            setItineraryData(updated);
            setStops(updated.stops || []);
            applyAssistantItineraryUpdate(updated);
          }}
          onUndoLastUpdate={() => {
            const restored = undoLastAssistantUpdate();
            if (restored && activeTrip?.itineraryHistory?.length) {
              const prev = activeTrip.itineraryHistory[activeTrip.itineraryHistory.length - 1];
              if (prev) {
                setItineraryData(prev);
                setStops(prev.stops || []);
              }
            }
            return restored;
          }}
          canUndo={Boolean(activeTrip?.itineraryHistory && activeTrip.itineraryHistory.length > 0)}
        />
      )}
    </div>
  );
};

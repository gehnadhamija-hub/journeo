import { HeritageSite, HERITAGE_SITES } from '../data/heritageSites';
import { UserPreferences } from '../data/sampleDemoPlan';
import {
  generateOptimizedItinerary as generateAdvancedItinerary,
  TripOptimizationRequest,
  OptimizedItineraryResponse,
  haversineDistanceKm,
  calculateTransitDuration
} from '../features/itinerary/services/itineraryOptimizer';

export * from '../features/itinerary/services/itineraryOptimizer';

export interface ItineraryStop {
  id: string;
  stopOrder: number;
  site: HeritageSite;
  arrivalTime: string;
  departureTime: string;
  durationMinutes: number;
  transitInstruction: string;
  transitMinutes: number;
  distanceFromPrevKm: number;
  isMustVisit: boolean;
}

export interface OptimizedItinerary {
  id: string;
  title: string;
  generatedAt: string;
  stops: ItineraryStop[];
  totalTravelDistanceKm: number;
  totalDurationMinutes: number;
  optimizationScore: number;
  startingPoint: {
    lat: number;
    lng: number;
    address: string;
  };
}

export const calculateDistanceKm = haversineDistanceKm;

// Backward-compatible wrapper for legacy test-runner & components
export function generateOptimizedItinerary(prefs: UserPreferences): OptimizedItinerary {
  const city = (prefs as any).destination || (prefs as any).city || 'Delhi';
  const request: TripOptimizationRequest = {
    destination: city,
    startingLocation: prefs.startingPoint,
    startTime: prefs.startTime,
    availableHoursPerDay: (parseInt(prefs.endTime || '18') - parseInt(prefs.startTime || '9')) || 8,
    mustVisitPlaceIds: prefs.mustVisitSiteIds,
    travelPace: prefs.maxStops && prefs.maxStops <= 3 ? 'relaxed' : 'balanced'
  };

  const advanced = generateAdvancedItinerary(request);

  // Map to legacy format
  const stops: ItineraryStop[] = advanced.stops.map((s, idx) => {
    const heritageMatch = HERITAGE_SITES.find(h => h.id === s.placeId || h.name.toLowerCase().includes(s.name.toLowerCase())) || HERITAGE_SITES[idx % HERITAGE_SITES.length];

    return {
      id: s.id,
      stopOrder: s.sequenceNumber,
      site: heritageMatch,
      arrivalTime: s.startTime,
      departureTime: s.endTime,
      durationMinutes: s.visitDurationMinutes,
      transitInstruction: s.transitInstruction,
      transitMinutes: s.travelFromPreviousMinutes,
      distanceFromPrevKm: s.distanceFromPreviousKm,
      isMustVisit: s.isMustVisit
    };
  });

  return {
    id: advanced.tripId,
    title: advanced.title,
    generatedAt: new Date().toISOString(),
    stops,
    totalTravelDistanceKm: advanced.plan.totalDistanceKm,
    totalDurationMinutes: advanced.plan.totalDurationMin,
    optimizationScore: advanced.optimization.overallScore,
    startingPoint: prefs.startingPoint
  };
}

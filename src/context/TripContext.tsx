import React, { createContext, useContext, useState } from 'react';
import { CanonicalDestination, resolveCanonicalDestination } from '../data/canonicalDestinations';
import { OptimizedItineraryResponse, ItineraryStopOutput } from '../features/itinerary/services/itineraryOptimizer';
import { IndiaDestination } from '../data/indiaDestinations';
import { useAuth } from './AuthContext';
import { recordPlaceVisited, unmarkPlaceVisited } from '../services/travelHistoryService';
import { IntercityTransportConfig, TripBudgetConfig } from '../services/expenseService';

export type TripLifecycleStatus = 'planned' | 'in_progress' | 'paused' | 'completed' | 'cancelled';

export interface ActiveTripState {
  tripId: string;
  destinationName: string;
  destination: CanonicalDestination;
  status: TripLifecycleStatus;
  startedAt?: string;
  pausedAt?: string;
  completedAt?: string;
  preferences: {
    originCity?: string;
    startDate?: string;
    endDate?: string;
    tripDays?: number;
    travellers?: number;
    availableHours?: number;
    travelStyle?: 'relaxed' | 'balanced' | 'packed';
    crowdPreference?: 'popular' | 'balanced' | 'avoid_crowded';
    discoveryPreference?: 'popular' | 'balanced' | 'hidden_gems';
    walkingTolerance?: 'low' | 'moderate' | 'high';
    indoorOutdoorPreference?: 'any' | 'indoor' | 'outdoor';
    foodStyle?: string;
    excludedCategories?: string[];
    transportMode?: 'cab' | 'public' | 'walking' | 'bicycle';
    intercityTransport?: Partial<IntercityTransportConfig>;
    budgetConfig?: Partial<TripBudgetConfig>;
    dietaryPreference?: 'all' | 'vegetarian' | 'vegan' | 'halal';
    interests?: string[];
    freeTextPrompt?: string;
    budget?: number;
  };
  itinerary: OptimizedItineraryResponse | null;
  stops: ItineraryStopOutput[];
  currentStopIndex: number;
  itineraryHistory?: OptimizedItineraryResponse[];
}

interface TripContextType {
  activeTrip: ActiveTripState | null;
  setActiveTrip: (trip: ActiveTripState | null) => void;
  loadTripFromStorage: () => ActiveTripState | null;
  startTrip: () => void;
  pauseTrip: () => void;
  resumeTrip: () => void;
  cancelTrip: () => void;
  markStopVisited: (stopId: string) => void;
  markStopSkipped: (stopId: string) => void;
  addPlaceToActiveTrip: (place: IndiaDestination) => { added: boolean; message: string };
  applyAssistantItineraryUpdate: (updatedItinerary: OptimizedItineraryResponse) => void;
  undoLastAssistantUpdate: () => boolean;
  completeTrip: () => void;
  clearActiveTrip: () => void;
}

const STORAGE_KEY = 'journeo_active_trip';
const SAVED_TRIPS_KEY = 'journeo_saved_trips';

const TripContext = createContext<TripContextType | undefined>(undefined);

export const TripProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [activeTrip, setActiveTripState] = useState<ActiveTripState | null>(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.warn('Failed to parse active trip from storage:', e);
    }
    return null;
  });

  const persistToSavedTrips = (trip: ActiveTripState) => {
    try {
      const saved = JSON.parse(localStorage.getItem(SAVED_TRIPS_KEY) || '[]');
      const existingIdx = saved.findIndex((t: any) => t.id === trip.tripId);
      const statusMap: Record<TripLifecycleStatus, string> = {
        planned: 'PLANNED',
        in_progress: 'IN_PROGRESS',
        paused: 'PAUSED',
        completed: 'COMPLETED',
        cancelled: 'CANCELLED'
      };
      const tripSummary = {
        id: trip.tripId,
        userId: user?.id,
        title: trip.itinerary?.title || `${trip.destinationName} Personalized Journey`,
        destinationCity: trip.destinationName,
        originCity: trip.preferences.originCity || trip.preferences.intercityTransport?.originCity,
        startDate: trip.preferences.startDate || new Date().toISOString().split('T')[0],
        startedAt: trip.startedAt,
        completedAt: trip.completedAt,
        status: statusMap[trip.status] || 'PLANNED',
        optimizationScore: trip.itinerary?.plan?.optimizationScore || 96,
        totalDistanceKm: trip.itinerary?.plan?.totalDistanceKm || 0,
        totalDurationMin: trip.itinerary?.plan?.totalDurationMin || 0,
        budgetBreakdown: trip.itinerary?.budgetBreakdown,
        intercitySummary: trip.itinerary?.intercitySummary,
        stops: trip.stops
      };

      if (existingIdx !== -1) {
        saved[existingIdx] = tripSummary;
      } else {
        saved.unshift(tripSummary);
      }
      localStorage.setItem(SAVED_TRIPS_KEY, JSON.stringify(saved));
    } catch (e) {}
  };

  const setActiveTrip = (trip: ActiveTripState | null) => {
    setActiveTripState(trip);
    if (trip) {
      try {
        const serialized = JSON.stringify(trip);
        sessionStorage.setItem(STORAGE_KEY, serialized);
        localStorage.setItem(STORAGE_KEY, serialized);
        sessionStorage.setItem('journeo_generated_plan', JSON.stringify(trip.itinerary));
        sessionStorage.setItem('journeo_active_journey_stops', JSON.stringify(trip.stops));
        sessionStorage.setItem('journeo_active_journey_meta', JSON.stringify(trip.itinerary));
        persistToSavedTrips(trip);
      } catch (e) {}
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem('journeo_active_journey_stops');
      sessionStorage.removeItem('journeo_active_journey_meta');
    }
  };

  const loadTripFromStorage = (): ActiveTripState | null => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setActiveTripState(parsed);
        return parsed;
      }
    } catch (e) {}
    return null;
  };

  const startTrip = () => {
    if (!activeTrip) return;
    const nowIso = new Date().toISOString();
    const updated: ActiveTripState = {
      ...activeTrip,
      status: 'in_progress',
      startedAt: activeTrip.startedAt || nowIso
    };
    setActiveTrip(updated);
  };

  const pauseTrip = () => {
    if (!activeTrip) return;
    const updated: ActiveTripState = {
      ...activeTrip,
      status: 'paused',
      pausedAt: new Date().toISOString()
    };
    setActiveTrip(updated);
  };

  const resumeTrip = () => {
    if (!activeTrip) return;
    const updated: ActiveTripState = {
      ...activeTrip,
      status: 'in_progress'
    };
    setActiveTrip(updated);
  };

  const cancelTrip = () => {
    if (!activeTrip) return;
    const updated: ActiveTripState = {
      ...activeTrip,
      status: 'cancelled'
    };
    setActiveTrip(updated);
  };

  const addPlaceToActiveTrip = (place: IndiaDestination): { added: boolean; message: string } => {
    if (!activeTrip) {
      return { added: false, message: 'No active trip found. Start planning a trip first.' };
    }
    if (
      place.destinationId !== activeTrip.destination.destinationId &&
      place.city.toLowerCase() !== activeTrip.destinationName.toLowerCase()
    ) {
      return {
        added: false,
        message: `${place.name} is in ${place.city}, while your current trip is for ${activeTrip.destinationName}.`
      };
    }

    const alreadyExists = activeTrip.stops.some(
      s => s.placeId === place.id || s.destination?.id === place.id
    );
    if (alreadyExists) {
      return { added: false, message: `${place.name} is already included in your ${activeTrip.destinationName} trip.` };
    }

    const newSeq = activeTrip.stops.length + 1;
    const newStop: ItineraryStopOutput = {
      id: `custom-stop-${Date.now()}-${place.id}`,
      placeId: place.id,
      providerPlaceId: place.providerPlaceId,
      name: place.name,
      city: place.city,
      category: place.category,
      startTime: '16:30',
      endTime: '18:00',
      plannedArrival: '16:30',
      plannedDeparture: '18:00',
      visitDurationMinutes: place.averageVisitDuration || 75,
      visitDuration: place.averageVisitDuration || 75,
      travelFromPreviousMinutes: 15,
      transitMinutes: 15,
      distanceFromPreviousKm: 3.2,
      distanceFromPrevKm: 3.2,
      transitInstruction: `Added from Explore • ~15 min local transit`,
      isMustVisit: true,
      visitStatus: 'PENDING',
      estimated: true,
      reasonForSelection: `Manually added by you from Explore / Destination preview.`,
      destination: place,
      coordinates: { lat: place.latitude, lng: place.longitude },
      sequenceNumber: newSeq,
      isMealStop: place.isMealStop,
      mealType: place.mealType,
      cuisineType: place.cuisineType,
      averageCostINR: place.averageCostPerPersonINR
    };

    const updatedStops = [...activeTrip.stops, newStop];
    const updatedItinerary = activeTrip.itinerary
      ? {
          ...activeTrip.itinerary,
          stops: updatedStops,
          plan: {
            ...activeTrip.itinerary.plan,
            scheduledStops: updatedStops
          },
          days:
            activeTrip.itinerary.days && activeTrip.itinerary.days.length > 0
              ? activeTrip.itinerary.days.map((d, idx) =>
                  idx === activeTrip.itinerary!.days.length - 1
                    ? { ...d, stops: [...d.stops, newStop] }
                    : d
                )
              : []
        }
      : null;

    setActiveTrip({
      ...activeTrip,
      stops: updatedStops,
      itinerary: updatedItinerary
    });

    return { added: true, message: `Added ${place.name} to your ${activeTrip.destinationName} trip!` };
  };

  const markStopVisited = (stopId: string) => {
    if (!activeTrip) return;
    let visitedStop: ItineraryStopOutput | undefined;
    const nowIso = new Date().toISOString();
    const updatedStops = activeTrip.stops.map(s => {
      if (s.id === stopId || s.placeId === stopId) {
        visitedStop = s;
        return {
          ...s,
          visitStatus: 'VISITED' as const,
          actualVisitTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          visitedAtISO: nowIso
        };
      }
      return s;
    });

    const nextPending = updatedStops.findIndex(s => s.visitStatus === 'PENDING');
    const updated: ActiveTripState = {
      ...activeTrip,
      stops: updatedStops,
      currentStopIndex: nextPending !== -1 ? nextPending : updatedStops.length - 1
    };
    setActiveTrip(updated);

    if (user?.id && visitedStop) {
      recordPlaceVisited({
        userId: user.id,
        tripId: activeTrip.tripId,
        tripTitle: activeTrip.itinerary?.title || `${activeTrip.destinationName} Personalized Circuit`,
        placeId: visitedStop.placeId || visitedStop.destination?.id || visitedStop.id,
        placeName: visitedStop.destination?.name || visitedStop.name || 'Visited Place',
        destinationCity: visitedStop.destination?.city || visitedStop.city || activeTrip.destinationName,
        country: activeTrip.destination?.country || 'India',
        category: visitedStop.destination?.category || visitedStop.category,
        latitude: visitedStop.coordinates?.lat ?? visitedStop.destination?.latitude,
        longitude: visitedStop.coordinates?.lng ?? visitedStop.destination?.longitude,
        imageUrl: visitedStop.destination?.imageUrl,
        visitedAt: nowIso
      });
    }
  };

  const markStopSkipped = (stopId: string) => {
    if (!activeTrip) return;
    let skippedStop: ItineraryStopOutput | undefined;
    const updatedStops = activeTrip.stops.map(s => {
      if (s.id === stopId || s.placeId === stopId) {
        skippedStop = s;
        return {
          ...s,
          visitStatus: 'SKIPPED' as const
        };
      }
      return s;
    });

    const nextPending = updatedStops.findIndex(s => s.visitStatus === 'PENDING');
    const updated: ActiveTripState = {
      ...activeTrip,
      stops: updatedStops,
      currentStopIndex: nextPending !== -1 ? nextPending : updatedStops.length - 1
    };
    setActiveTrip(updated);

    if (user?.id && skippedStop) {
      unmarkPlaceVisited(
        user.id,
        skippedStop.placeId || skippedStop.destination?.id || skippedStop.id,
        activeTrip.tripId
      );
    }
  };

  const applyAssistantItineraryUpdate = (updatedItinerary: OptimizedItineraryResponse) => {
    if (!activeTrip) return;
    const prevHistory = activeTrip.itineraryHistory || [];
    const nextHistory = activeTrip.itinerary
      ? [...prevHistory.slice(-9), activeTrip.itinerary]
      : prevHistory;

    const updatedTrip: ActiveTripState = {
      ...activeTrip,
      itinerary: updatedItinerary,
      stops: updatedItinerary.stops,
      itineraryHistory: nextHistory
    };
    setActiveTrip(updatedTrip);
  };

  const undoLastAssistantUpdate = (): boolean => {
    if (!activeTrip || !activeTrip.itineraryHistory || activeTrip.itineraryHistory.length === 0) {
      return false;
    }
    const historyCopy = [...activeTrip.itineraryHistory];
    const previousSnapshot = historyCopy.pop()!;

    const restoredTrip: ActiveTripState = {
      ...activeTrip,
      itinerary: previousSnapshot,
      stops: previousSnapshot.stops,
      itineraryHistory: historyCopy
    };
    setActiveTrip(restoredTrip);
    return true;
  };

  const completeTrip = () => {
    if (!activeTrip) return;
    const updated: ActiveTripState = {
      ...activeTrip,
      status: 'completed',
      completedAt: new Date().toISOString()
    };
    setActiveTrip(updated);
  };

  const clearActiveTrip = () => {
    setActiveTrip(null);
  };

  return (
    <TripContext.Provider
      value={{
        activeTrip,
        setActiveTrip,
        loadTripFromStorage,
        startTrip,
        pauseTrip,
        resumeTrip,
        cancelTrip,
        markStopVisited,
        markStopSkipped,
        addPlaceToActiveTrip,
        applyAssistantItineraryUpdate,
        undoLastAssistantUpdate,
        completeTrip,
        clearActiveTrip
      }}
    >
      {children}
    </TripContext.Provider>
  );
};

export const useTripContext = () => {
  const context = useContext(TripContext);
  if (!context) {
    throw new Error('useTripContext must be used within a TripProvider');
  }
  return context;
};

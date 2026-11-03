import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTripContext } from '../context/TripContext';
import {
  VisitedPlaceRecord,
  TravelHistorySummary,
  getVisitedPlacesForUser,
  fetchAndSyncUserVisitedPlaces,
  aggregateUserTravelHistory,
  subscribeToTravelHistoryUpdates
} from '../services/travelHistoryService';

export function useUserVisitedPlaces() {
  const { user, loading: authLoading } = useAuth();
  const { activeTrip } = useTripContext();
  const [records, setRecords] = useState<VisitedPlaceRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);

  const userId = user?.id || null;
  const activeDestinationCity =
    activeTrip?.status === 'in_progress' || activeTrip?.status === 'planned'
      ? activeTrip.destinationName
      : undefined;

  const refreshHistory = useCallback(async () => {
    if (!userId) {
      setRecords([]);
      setHistoryLoading(false);
      return;
    }

    // Immediate synchronous load from user-scoped store & synced trips
    const immediate = getVisitedPlacesForUser(userId);
    setRecords(immediate);

    // Async sync with Supabase if configured
    setHistoryLoading(true);
    try {
      const synced = await fetchAndSyncUserVisitedPlaces(userId);
      setRecords(synced);
    } finally {
      setHistoryLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (authLoading) return;

    if (!userId) {
      // Immediately clear user-specific globe state on logout
      setRecords([]);
      setHistoryLoading(false);
      return;
    }

    refreshHistory();

    const unsubscribe = subscribeToTravelHistoryUpdates(userId, () => {
      const updated = getVisitedPlacesForUser(userId);
      setRecords(updated);
    });

    return () => {
      unsubscribe();
    };
  }, [userId, authLoading, refreshHistory]);

  const summary: TravelHistorySummary = useMemo(() => {
    if (!userId) {
      return {
        totalVisitRecords: 0,
        uniquePlacesCount: 0,
        uniqueCitiesCount: 0,
        uniqueCountriesCount: 0,
        uniqueCities: [],
        uniqueCountries: [],
        uniquePlaces: [],
        allRecords: []
      };
    }
    return aggregateUserTravelHistory(records, activeDestinationCity);
  }, [records, userId, activeDestinationCity]);

  return {
    user,
    isAuthenticated: Boolean(userId) && !authLoading,
    authLoading,
    historyLoading,
    summary,
    refreshHistory
  };
}

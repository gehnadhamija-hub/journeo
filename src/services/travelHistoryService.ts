import { supabase, supabaseConfigured } from '../lib/supabaseClient';
import { INDIA_DESTINATIONS, IndiaDestination } from '../data/indiaDestinations';
import { resolveCanonicalDestination } from '../data/canonicalDestinations';
import { isValidCoordinates, VisitedPlaceMarkerInput } from '../features/globe/globeCoordinates';

export interface VisitedPlaceRecord {
  id: string;
  userId: string;
  tripId: string;
  tripTitle?: string;
  placeId: string;
  placeName: string;
  destinationCity: string;
  country: string;
  category?: string;
  latitude: number;
  longitude: number;
  imageUrl?: string;
  visitedAt: string;
}

export interface TravelHistorySummary {
  totalVisitRecords: number;
  uniquePlacesCount: number;
  uniqueCitiesCount: number;
  uniqueCountriesCount: number;
  uniqueCities: string[];
  uniqueCountries: string[];
  uniquePlaces: VisitedPlaceMarkerInput[];
  allRecords: VisitedPlaceRecord[];
}

const STORAGE_PREFIX = 'journeo_visited_places_';
const DEMO_SEEDED_PREFIX = 'journeo_demo_seeded_';
export const VISITED_PLACES_EVENT = 'journeo:visited-places-updated';

function getUserStorageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

/**
 * Finds the authoritative canonical place record by ID, providerPlaceId, or exact name.
 */
export function findAuthoritativePlace(placeIdOrName?: string, fallbackName?: string): IndiaDestination | undefined {
  if (!placeIdOrName && !fallbackName) return undefined;

  if (placeIdOrName) {
    const byId = INDIA_DESTINATIONS.find(
      d => d.id === placeIdOrName || d.providerPlaceId === placeIdOrName
    );
    if (byId) return byId;
  }

  const targetName = (fallbackName || placeIdOrName || '').trim().toLowerCase();
  if (!targetName) return undefined;

  return INDIA_DESTINATIONS.find(
    d =>
      d.name.toLowerCase() === targetName ||
      d.name.toLowerCase().includes(targetName) ||
      targetName.includes(d.name.toLowerCase())
  );
}

/**
 * Resolves verified country from geographic metadata rather than guessing from a place name.
 */
export function resolveVerifiedCountry(city?: string, lat?: number, lng?: number, explicitCountry?: string): string {
  if (explicitCountry && explicitCountry.trim().length > 0) {
    return explicitCountry.trim();
  }
  if (city) {
    const canon = resolveCanonicalDestination(city);
    if (canon?.country) return canon.country;
  }
  if (typeof lat === 'number' && typeof lng === 'number' && isValidCoordinates(lat, lng)) {
    // Check India bounding box (6°N to 37°N, 68°E to 97.5°E)
    if (lat >= 6.0 && lat <= 37.5 && lng >= 68.0 && lng <= 97.5) {
      return 'India';
    }
  }
  return 'Unknown';
}

/**
 * Emits a cross-component & cross-tab notification when a user's visited places change.
 */
function notifyVisitedPlacesChanged(userId: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(VISITED_PLACES_EVENT, { detail: { userId } }));
    try {
      if ('BroadcastChannel' in window) {
        const bc = new BroadcastChannel('journeo_travel_history');
        bc.postMessage({ type: 'UPDATED', userId, timestamp: Date.now() });
        bc.close();
      }
    } catch {}
  }
}

/**
 * Seeds initial realistic travel history for the demo account ('demo-user-1234')
 * once so demo login immediately demonstrates personal travel history on the Earth globe.
 */
function ensureDemoUserSeeded(userId: string): void {
  if (userId !== 'demo-user-1234') return;
  if (typeof localStorage === 'undefined') return;

  const seededKey = `${DEMO_SEEDED_PREFIX}${userId}`;
  if (localStorage.getItem(seededKey)) return;

  const existing = localStorage.getItem(getUserStorageKey(userId));
  if (existing) {
    localStorage.setItem(seededKey, 'true');
    return;
  }

  const demoPlaceIds = [
    { id: 'delhi_red_fort', tripId: 'demo-trip-delhi', tripTitle: 'Imperial Delhi Heritage Circuit', visitedAt: '2026-10-12T10:15:00.000Z' },
    { id: 'delhi_humayuns_tomb', tripId: 'demo-trip-delhi', tripTitle: 'Imperial Delhi Heritage Circuit', visitedAt: '2026-10-12T14:30:00.000Z' },
    { id: 'agra_taj_mahal', tripId: 'demo-trip-agra', tripTitle: 'Agra Mughal Wonders Odyssey', visitedAt: '2026-10-18T08:45:00.000Z' },
    { id: 'jaipur_amber_fort', tripId: 'demo-trip-jaipur', tripTitle: 'Jaipur Pink City Royal Circuit', visitedAt: '2026-10-24T11:00:00.000Z' },
    { id: 'goa_fort_aguada', tripId: 'demo-trip-goa', tripTitle: 'Goa Coastal Heritage & Sunsets', visitedAt: '2026-10-29T16:40:00.000Z' }
  ];

  const seededRecords: VisitedPlaceRecord[] = [];
  for (const item of demoPlaceIds) {
    const place = findAuthoritativePlace(item.id);
    if (place && isValidCoordinates(place.latitude, place.longitude)) {
      seededRecords.push({
        id: `visit-${userId}-${place.id}`,
        userId,
        tripId: item.tripId,
        tripTitle: item.tripTitle,
        placeId: place.id,
        placeName: place.name,
        destinationCity: place.city,
        country: 'India',
        category: place.category,
        latitude: place.latitude,
        longitude: place.longitude,
        imageUrl: place.imageUrl,
        visitedAt: item.visitedAt
      });
    }
  }

  localStorage.setItem(getUserStorageKey(userId), JSON.stringify(seededRecords));
  localStorage.setItem(seededKey, 'true');
}

/**
 * Synchronizes any stops marked 'VISITED' in the user's activeTrip or saved trips
 * into the user's visited-place history store.
 */
export function syncTripsToVisitedHistory(userId: string): VisitedPlaceRecord[] {
  if (!userId || typeof localStorage === 'undefined') return [];

  ensureDemoUserSeeded(userId);

  const storageKey = getUserStorageKey(userId);
  let records: VisitedPlaceRecord[] = [];
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        records = parsed.filter(
          (r: any) => r && r.userId === userId && isValidCoordinates(r.latitude, r.longitude)
        );
      }
    }
  } catch {
    records = [];
  }

  let modified = false;

  const ingestTripStops = (tripId: string, tripTitle: string, city: string, stops: any[]) => {
    if (!Array.isArray(stops)) return;
    for (const stop of stops) {
      if (stop?.visitStatus !== 'VISITED') continue;

      const rawPlaceId = stop.placeId || stop.destination?.id || stop.id;
      const rawName = stop.destination?.name || stop.title || stop.name;
      const authPlace = findAuthoritativePlace(rawPlaceId, rawName);

      const canonicalPlaceId = authPlace?.id || rawPlaceId || `place-${(rawName || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      const lat = authPlace?.latitude ?? stop.coordinates?.lat ?? stop.destination?.latitude;
      const lng = authPlace?.longitude ?? stop.coordinates?.lng ?? stop.destination?.longitude;

      if (!isValidCoordinates(lat, lng)) continue;

      const resolvedCity = authPlace?.city || stop.destination?.city || city || 'India';
      const resolvedCountry = resolveVerifiedCountry(resolvedCity, lat, lng, stop.destination?.country);

      const alreadyRecorded = records.some(
        r => r.userId === userId && r.placeId === canonicalPlaceId && r.tripId === tripId
      );

      if (!alreadyRecorded) {
        records.unshift({
          id: `visit-${userId}-${tripId}-${canonicalPlaceId}`,
          userId,
          tripId: tripId || 'active-trip',
          tripTitle: tripTitle || `${resolvedCity} Journey`,
          placeId: canonicalPlaceId,
          placeName: authPlace?.name || rawName || 'Visited Monument',
          destinationCity: resolvedCity,
          country: resolvedCountry,
          category: authPlace?.category || stop.destination?.category || 'Heritage',
          latitude: lat,
          longitude: lng,
          imageUrl: authPlace?.imageUrl || stop.destination?.imageUrl,
          visitedAt: stop.visitedAtISO || new Date().toISOString()
        });
        modified = true;
      }
    }
  };

  // Check active trip if it belongs to this user or current session
  try {
    const activeRaw = sessionStorage.getItem('journeo_active_trip') || localStorage.getItem('journeo_active_trip');
    if (activeRaw) {
      const activeTrip = JSON.parse(activeRaw);
      if (!activeTrip.userId || activeTrip.userId === userId) {
        ingestTripStops(
          activeTrip.tripId || 'active-trip',
          activeTrip.itinerary?.title || `${activeTrip.destinationName || 'India'} Journey`,
          activeTrip.destinationName || 'India',
          activeTrip.stops || []
        );
      }
    }
  } catch {}

  // Check saved trips belonging to this user
  try {
    const savedRaw = localStorage.getItem('journeo_saved_trips');
    if (savedRaw) {
      const savedTrips = JSON.parse(savedRaw);
      if (Array.isArray(savedTrips)) {
        for (const trip of savedTrips) {
          if (trip.userId && trip.userId !== userId) continue;
          ingestTripStops(
            trip.id || 'saved-trip',
            trip.title || `${trip.destinationCity || 'India'} Journey`,
            trip.destinationCity || 'India',
            trip.stops || []
          );
        }
      }
    }
  } catch {}

  if (modified) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(records));
    } catch {}
  }

  return records;
}

/**
 * Synchronously reads the authenticated user's visited places from local storage + synced trips.
 * Strictly returns [] if userId is null/empty.
 */
export function getVisitedPlacesForUser(userId?: string | null): VisitedPlaceRecord[] {
  if (!userId) return [];
  return syncTripsToVisitedHistory(userId);
}

/**
 * Asynchronously fetches visited places from Supabase (if configured) and merges
 * with local user-scoped records, ensuring zero cross-user leakage.
 */
export async function fetchAndSyncUserVisitedPlaces(userId?: string | null): Promise<VisitedPlaceRecord[]> {
  if (!userId) return [];

  const localRecords = syncTripsToVisitedHistory(userId);

  if (!supabaseConfigured) {
    return localRecords;
  }

  try {
    const { data, error } = await supabase
      .from('visited_places')
      .select('*')
      .eq('user_id', userId)
      .order('visited_at', { ascending: false });

    if (error || !data || !Array.isArray(data)) {
      return localRecords;
    }

    const mergedMap = new Map<string, VisitedPlaceRecord>();
    for (const rec of localRecords) {
      if (rec.userId === userId && isValidCoordinates(rec.latitude, rec.longitude)) {
        mergedMap.set(`${rec.tripId}:${rec.placeId}`, rec);
      }
    }

    for (const row of data as any[]) {
      if (row.user_id !== userId) continue;
      const authPlace = findAuthoritativePlace(row.place_id, row.place_name);
      const lat = Number(row.latitude ?? authPlace?.latitude);
      const lng = Number(row.longitude ?? authPlace?.longitude);
      if (!isValidCoordinates(lat, lng)) continue;

      const placeId = authPlace?.id || row.place_id || `place-${row.id}`;
      const tripId = row.trip_id || 'saved-trip';
      const city = row.destination_city || authPlace?.city || 'India';
      const record: VisitedPlaceRecord = {
        id: row.id || `visit-${userId}-${tripId}-${placeId}`,
        userId,
        tripId,
        tripTitle: row.trip_title || `${city} Journey`,
        placeId,
        placeName: authPlace?.name || row.place_name || 'Visited Place',
        destinationCity: city,
        country: resolveVerifiedCountry(city, lat, lng, row.country),
        category: authPlace?.category || row.category || 'Heritage',
        latitude: lat,
        longitude: lng,
        imageUrl: authPlace?.imageUrl || row.image_url,
        visitedAt: row.visited_at || new Date().toISOString()
      };
      mergedMap.set(`${tripId}:${placeId}`, record);
    }

    const merged = Array.from(mergedMap.values()).sort(
      (a, b) => new Date(b.visitedAt).getTime() - new Date(a.visitedAt).getTime()
    );

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(getUserStorageKey(userId), JSON.stringify(merged));
    }

    return merged;
  } catch {
    return localRecords;
  }
}

/**
 * Records a newly visited place for the authenticated user.
 * Deduplicates by (userId, tripId, canonical placeId), persists to storage & Supabase,
 * and triggers immediate real-time globe updates.
 */
export async function recordPlaceVisited(input: {
  userId: string;
  tripId: string;
  tripTitle?: string;
  placeId: string;
  placeName: string;
  destinationCity?: string;
  country?: string;
  category?: string;
  latitude?: number;
  longitude?: number;
  imageUrl?: string;
  visitedAt?: string;
}): Promise<VisitedPlaceRecord | null> {
  const { userId } = input;
  if (!userId) return null;

  const authPlace = findAuthoritativePlace(input.placeId, input.placeName);
  const canonicalPlaceId =
    authPlace?.id ||
    input.placeId ||
    `place-${input.placeName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

  const lat = authPlace?.latitude ?? input.latitude;
  const lng = authPlace?.longitude ?? input.longitude;

  if (!isValidCoordinates(lat, lng)) {
    console.warn('[Journeo Globe] Skipping visited place without valid coordinates:', input.placeName);
    return null;
  }

  const city = authPlace?.city || input.destinationCity || 'India';
  const country = resolveVerifiedCountry(city, lat!, lng!, input.country);
  const tripId = input.tripId || 'active-trip';
  const visitedAt = input.visitedAt || new Date().toISOString();

  const newRecord: VisitedPlaceRecord = {
    id: `visit-${userId}-${tripId}-${canonicalPlaceId}`,
    userId,
    tripId,
    tripTitle: input.tripTitle || `${city} Personalized Circuit`,
    placeId: canonicalPlaceId,
    placeName: authPlace?.name || input.placeName,
    destinationCity: city,
    country,
    category: authPlace?.category || input.category || 'Heritage',
    latitude: lat!,
    longitude: lng!,
    imageUrl: authPlace?.imageUrl || input.imageUrl,
    visitedAt
  };

  if (typeof localStorage !== 'undefined') {
    const existing = getVisitedPlacesForUser(userId);
    // Replace if already visited in the same trip, or update timestamp
    const filtered = existing.filter(
      r => !(r.userId === userId && r.placeId === canonicalPlaceId && r.tripId === tripId)
    );
    const updated = [newRecord, ...filtered];
    localStorage.setItem(getUserStorageKey(userId), JSON.stringify(updated));
  }

  if (supabaseConfigured) {
    try {
      await supabase.from('visited_places').upsert(
        {
          id: newRecord.id,
          user_id: newRecord.userId,
          trip_id: newRecord.tripId,
          trip_title: newRecord.tripTitle,
          place_id: newRecord.placeId,
          place_name: newRecord.placeName,
          destination_city: newRecord.destinationCity,
          country: newRecord.country,
          category: newRecord.category,
          latitude: newRecord.latitude,
          longitude: newRecord.longitude,
          image_url: newRecord.imageUrl,
          visited_at: newRecord.visitedAt
        },
        { onConflict: 'id' }
      );
    } catch {}
  }

  notifyVisitedPlacesChanged(userId);
  return newRecord;
}

/**
 * Unmarks a visited place for a user (e.g. if corrected in tracker) and notifies the globe.
 */
export async function unmarkPlaceVisited(
  userId: string,
  placeId: string,
  tripId?: string
): Promise<void> {
  if (!userId) return;
  const authPlace = findAuthoritativePlace(placeId);
  const canonicalId = authPlace?.id || placeId;

  if (typeof localStorage !== 'undefined') {
    const existing = getVisitedPlacesForUser(userId);
    const filtered = existing.filter(r => {
      const matchesPlace = r.placeId === canonicalId || r.placeId === placeId;
      const matchesTrip = !tripId || r.tripId === tripId;
      return !(matchesPlace && matchesTrip);
    });
    localStorage.setItem(getUserStorageKey(userId), JSON.stringify(filtered));
  }

  if (supabaseConfigured) {
    try {
      let query = supabase
        .from('visited_places')
        .delete()
        .eq('user_id', userId)
        .eq('place_id', canonicalId);
      if (tripId) {
        query = query.eq('trip_id', tripId);
      }
      await query;
    } catch {}
  }

  notifyVisitedPlacesChanged(userId);
}

/**
 * Removes visit records associated with a deleted trip so no broken trip references remain.
 */
export function removeVisitsByTrip(userId: string, tripId: string): void {
  if (!userId || !tripId || typeof localStorage === 'undefined') return;
  const existing = getVisitedPlacesForUser(userId);
  const filtered = existing.filter(r => r.tripId !== tripId);
  localStorage.setItem(getUserStorageKey(userId), JSON.stringify(filtered));
  notifyVisitedPlacesChanged(userId);
}

/**
 * Aggregates raw visit records into deduplicated unique places, unique cities,
 * and unique countries with clear separation between total visit records and unique places.
 */
export function aggregateUserTravelHistory(
  records: VisitedPlaceRecord[],
  activeDestinationCity?: string
): TravelHistorySummary {
  const validRecords = records.filter(r => isValidCoordinates(r.latitude, r.longitude));
  const placeMap = new Map<string, VisitedPlaceMarkerInput>();
  const citiesSet = new Set<string>();
  const countriesSet = new Set<string>();

  for (const rec of validRecords) {
    if (rec.destinationCity) citiesSet.add(rec.destinationCity);
    if (rec.country && rec.country !== 'Unknown') countriesSet.add(rec.country);

    const existing = placeMap.get(rec.placeId);
    const isActive =
      Boolean(activeDestinationCity) &&
      rec.destinationCity.toLowerCase() === activeDestinationCity!.toLowerCase();

    if (existing) {
      existing.visitCount = (existing.visitCount || 1) + 1;
      if (new Date(rec.visitedAt).getTime() > new Date(existing.visitedAt).getTime()) {
        existing.visitedAt = rec.visitedAt;
        existing.tripId = rec.tripId;
        existing.tripTitle = rec.tripTitle;
      }
      if (isActive) existing.isActiveDestination = true;
    } else {
      placeMap.set(rec.placeId, {
        ...rec,
        visitCount: 1,
        isActiveDestination: isActive
      });
    }
  }

  const uniquePlaces = Array.from(placeMap.values()).sort(
    (a, b) => new Date(b.visitedAt).getTime() - new Date(a.visitedAt).getTime()
  );

  return {
    totalVisitRecords: validRecords.length,
    uniquePlacesCount: uniquePlaces.length,
    uniqueCitiesCount: citiesSet.size,
    uniqueCountriesCount: countriesSet.size,
    uniqueCities: Array.from(citiesSet),
    uniqueCountries: Array.from(countriesSet),
    uniquePlaces,
    allRecords: validRecords
  };
}

/**
 * Subscribes to real-time visited-place updates for a specific authenticated user
 * across Supabase Realtime, BroadcastChannel, and same-tab CustomEvents.
 * Cleans up all listeners when unmounted or when userId changes.
 */
export function subscribeToTravelHistoryUpdates(
  userId: string,
  onUpdate: () => void
): () => void {
  if (!userId) return () => {};

  const handleDomEvent = (e: Event) => {
    const customEvent = e as CustomEvent<{ userId?: string }>;
    if (!customEvent.detail?.userId || customEvent.detail.userId === userId) {
      onUpdate();
    }
  };

  const handleStorageEvent = (e: StorageEvent) => {
    if (
      e.key === getUserStorageKey(userId) ||
      e.key === 'journeo_active_trip' ||
      e.key === 'journeo_saved_trips'
    ) {
      onUpdate();
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener(VISITED_PLACES_EVENT, handleDomEvent);
    window.addEventListener('storage', handleStorageEvent);
  }

  let bc: BroadcastChannel | null = null;
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    try {
      bc = new BroadcastChannel('journeo_travel_history');
      bc.onmessage = (event) => {
        if (event.data?.userId === userId) {
          onUpdate();
        }
      };
    } catch {}
  }

  let supabaseChannel: ReturnType<typeof supabase.channel> | null = null;
  if (supabaseConfigured) {
    try {
      supabaseChannel = supabase
        .channel(`visited_places_user_${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'visited_places',
            filter: `user_id=eq.${userId}`
          },
          () => {
            onUpdate();
          }
        )
        .subscribe();
    } catch {}
  }

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener(VISITED_PLACES_EVENT, handleDomEvent);
      window.removeEventListener('storage', handleStorageEvent);
    }
    if (bc) {
      try {
        bc.close();
      } catch {}
    }
    if (supabaseChannel) {
      try {
        supabase.removeChannel(supabaseChannel);
      } catch {}
    }
  };
}


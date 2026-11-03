/**
 * Journeo Modular Routing Service
 * Supports MapTiler Routing API with graceful, robust OpenStreetMap & Network-Speed Fallback.
 */

export interface RouteCoordinate {
  lat: number;
  lng: number;
}

export interface RouteRequest {
  origin: RouteCoordinate;
  destination: RouteCoordinate;
  transportMode?: 'cab' | 'public' | 'walking' | 'bicycle';
}

export interface RouteResult {
  distanceKm: number;
  durationMinutes: number;
  polyline?: [number, number][];
  source: 'maptiler' | 'network_estimation';
  transitInstruction: string;
}

const routeCache = new Map<string, RouteResult>();

export const routingService = {
  /**
   * Retrieves route distance, duration and polyline between two coordinates.
   */
  async getRoute(req: RouteRequest): Promise<RouteResult> {
    const { origin, destination, transportMode = 'cab' } = req;
    const cacheKey = `${origin.lat.toFixed(4)},${origin.lng.toFixed(4)}->${destination.lat.toFixed(4)},${destination.lng.toFixed(4)}_${transportMode}`;

    if (routeCache.has(cacheKey)) {
      return routeCache.get(cacheKey)!;
    }

    // Calculate Haversine base distance
    const distKm = haversineDistance(origin.lat, origin.lng, destination.lat, destination.lng);

    // Check MapTiler API Key safely in both browser (Vite) and Node/test environments
    let apiKey = '';
    const proc = (globalThis as any).process;
    if (typeof proc !== 'undefined' && proc?.env?.VITE_MAPTILER_API_KEY) {
      apiKey = proc.env.VITE_MAPTILER_API_KEY;
    } else {
      try {
        const metaEnv = (new Function('try { return import.meta.env; } catch { return null; }'))();
        apiKey = metaEnv?.VITE_MAPTILER_API_KEY || metaEnv?.VITE_GOOGLE_MAPS_API_KEY || '';
      } catch {
        apiKey = '';
      }
    }

    // Attempt MapTiler Routing if API key is configured
    if (apiKey && apiKey.length > 5) {
      try {
        const maptilerProfile = transportMode === 'walking' ? 'pedestrian' : transportMode === 'bicycle' ? 'bicycle' : 'driving';
        const url = `https://api.maptiler.com/routing/v2/${maptilerProfile}/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?key=${apiKey}`;

        // Short timeout (1500ms) to ensure UI remains snappy
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500);

        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          const route = data.routes?.[0];
          if (route) {
            const apiDistKm = Math.round((route.distance / 1000) * 10) / 10;
            const apiDurMin = Math.max(5, Math.round(route.duration / 60));
            const polyline: [number, number][] =
              route.geometry?.coordinates?.map(([lng, lat]: [number, number]) => [lat, lng]) || [];

            const result: RouteResult = {
              distanceKm: apiDistKm,
              durationMinutes: apiDurMin,
              polyline: polyline.length > 0 ? polyline : undefined,
              source: 'maptiler',
              transitInstruction: `${apiDistKm} km • ${apiDurMin} mins via ${transportMode} (MapTiler Road Route)`
            };
            routeCache.set(cacheKey, result);
            return result;
          }
        }
      } catch (err) {
        // Fallback transparently on network failure / offline mode
      }
    }

    // Realistic Urban Transit Network Fallback
    const durationMin = calculateRealisticDuration(distKm, transportMode);
    const result: RouteResult = {
      distanceKm: distKm,
      durationMinutes: durationMin,
      source: 'network_estimation',
      transitInstruction: `${distKm} km • ~${durationMin} mins (${transportMode})`
    };

    routeCache.set(cacheKey, result);
    return result;
  },

  /**
   * Generates travel duration matrix for a sequence of stops
   */
  async getTravelTimeMatrix(
    coords: RouteCoordinate[],
    transportMode: 'cab' | 'public' | 'walking' | 'bicycle' = 'cab'
  ): Promise<number[][]> {
    const matrix: number[][] = [];
    for (let i = 0; i < coords.length; i++) {
      matrix[i] = [];
      for (let j = 0; j < coords.length; j++) {
        if (i === j) {
          matrix[i][j] = 0;
        } else {
          const r = await this.getRoute({ origin: coords[i], destination: coords[j], transportMode });
          matrix[i][j] = r.durationMinutes;
        }
      }
    }
    return matrix;
  }
};

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

function calculateRealisticDuration(
  distKm: number,
  mode: 'cab' | 'public' | 'walking' | 'bicycle'
): number {
  // Road network winding factor (roads are ~1.25x longer than straight-line haversine distance)
  const roadDistKm = distKm * 1.25;

  let speedKmh = 22;
  let fixedDelayMin = 6; // traffic signal / pickup buffer

  switch (mode) {
    case 'walking':
      speedKmh = 4.5;
      fixedDelayMin = 2;
      break;
    case 'bicycle':
      speedKmh = 12;
      fixedDelayMin = 3;
      break;
    case 'public':
      speedKmh = 18;
      fixedDelayMin = 10; // station boarding & wait
      break;
    case 'cab':
    default:
      speedKmh = 24;
      fixedDelayMin = 6;
      break;
  }

  const travelMinutes = Math.round((roadDistKm / speedKmh) * 60) + fixedDelayMin;
  return Math.max(8, travelMinutes);
}

export const calculateRoute = (
  origin: RouteCoordinate,
  destination: RouteCoordinate,
  transportMode: 'cab' | 'public' | 'walking' | 'bicycle' = 'cab'
): Promise<RouteResult> => routingService.getRoute({ origin, destination, transportMode });

export const getEstimatedTravelDurationMinutes = (
  distKm: number,
  transportMode: 'cab' | 'public' | 'walking' | 'bicycle' = 'cab'
): number => calculateRealisticDuration(distKm, transportMode);

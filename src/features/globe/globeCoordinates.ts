import * as THREE from 'three';

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface VisitedPlaceMarkerInput {
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
  visitCount?: number;
  isActiveDestination?: boolean;
}

export interface GlobeMarkerCluster {
  clusterId: string;
  latitude: number;
  longitude: number;
  city: string;
  country: string;
  places: VisitedPlaceMarkerInput[];
  isCluster: boolean;
  hasActiveDestination: boolean;
}

/**
 * Validates whether latitude and longitude are finite and within valid geographic bounds.
 */
export function isValidCoordinates(latitude: unknown, longitude: unknown): boolean {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return false;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  if (latitude < -90 || latitude > 90) return false;
  if (longitude < -180 || longitude > 180) return false;
  // Reject (0, 0) null-island fallback coordinates
  if (Math.abs(latitude) < 0.0001 && Math.abs(longitude) < 0.0001) return false;
  return true;
}

/**
 * Converts geographic (latitude, longitude) in degrees to 3D Cartesian coordinates
 * on a Three.js sphere of radius R.
 *
 * Matches Three.js SphereGeometry standard UV mapping:
 *   phi   = (90 - latitude) * (PI / 180)
 *   theta = (longitude + 180) * (PI / 180)
 *   x = -R * sin(phi) * cos(theta)
 *   y =  R * cos(phi)
 *   z =  R * sin(phi) * sin(theta)
 */
export function latLngToVector3(latitude: number, longitude: number, radius: number): THREE.Vector3 {
  const clampedLat = Math.max(-90, Math.min(90, latitude));
  const normalizedLng = ((((longitude + 180) % 360) + 360) % 360) - 180;

  const phi = (90 - clampedLat) * (Math.PI / 180);
  const theta = (normalizedLng + 180) * (Math.PI / 180);

  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);

  return new THREE.Vector3(x, y, z);
}

/**
 * Inverse conversion: converts a 3D point on a sphere back to (latitude, longitude) in degrees.
 * Used for geographic accuracy verification and raycast testing.
 */
export function vector3ToLatLng(position: THREE.Vector3): GeoPoint {
  const radius = position.length();
  if (radius === 0) return { latitude: 0, longitude: 0 };

  const clampedY = Math.max(-1, Math.min(1, position.y / radius));
  const phi = Math.acos(clampedY);
  const latitude = 90 - phi * (180 / Math.PI);

  // From x = -R * sin(phi) * cos(theta) and z = R * sin(phi) * sin(theta):
  // atan2(z, -x) yields theta in (-PI, PI]
  let theta = Math.atan2(position.z, -position.x);
  if (theta < 0) theta += 2 * Math.PI;
  const longitude = theta * (180 / Math.PI) - 180;

  return {
    latitude: Number(latitude.toFixed(4)),
    longitude: Number(longitude.toFixed(4))
  };
}

/**
 * Calculates the Euler rotation (order 'XYZ') for the globe group so that a given
 * (latitude, longitude) faces directly toward the camera located on the +Z axis.
 *
 * Derivation:
 *   1. Rotate around Y by rotY = (-90 - longitude) * (PI / 180) so point moves to (0, R*sin(lat), R*cos(lat))
 *   2. Rotate around X by rotX = latitude * (PI / 180) so point moves to (0, 0, +R)
 */
export function getGlobeRotationForLatLng(latitude: number, longitude: number): { rotX: number; rotY: number } {
  const clampedLat = Math.max(-75, Math.min(75, latitude));
  const rotY = (-90 - longitude) * (Math.PI / 180);
  const rotX = clampedLat * (Math.PI / 180);
  return { rotX, rotY };
}

/**
 * Calculates the shortest angular delta between current angle and target angle in radians.
 */
export function shortestAngleDelta(currentRad: number, targetRad: number): number {
  const twoPi = Math.PI * 2;
  const diff = ((targetRad - currentRad + Math.PI) % twoPi + twoPi) % twoPi - Math.PI;
  return diff;
}

/**
 * Great-circle Haversine distance in kilometers between two coordinates.
 */
export function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Groups nearby visited places into clusters when they are within `clusterRadiusKm`
 * of each other on the globe, preventing overlapping pins while allowing users to
 * inspect every individual visited place in the cluster.
 */
export function clusterVisitedPlaces(
  places: VisitedPlaceMarkerInput[],
  clusterRadiusKm: number = 45
): GlobeMarkerCluster[] {
  const validPlaces = places.filter(p => isValidCoordinates(p.latitude, p.longitude));
  const clusters: GlobeMarkerCluster[] = [];

  for (const place of validPlaces) {
    let matchedCluster: GlobeMarkerCluster | null = null;
    for (const cluster of clusters) {
      const dist = haversineDistanceKm(
        place.latitude,
        place.longitude,
        cluster.latitude,
        cluster.longitude
      );
      if (dist <= clusterRadiusKm) {
        matchedCluster = cluster;
        break;
      }
    }

    if (matchedCluster) {
      matchedCluster.places.push(place);
      matchedCluster.isCluster = matchedCluster.places.length > 1;
      if (place.isActiveDestination) {
        matchedCluster.hasActiveDestination = true;
      }
      // Recompute centroid of cluster
      const n = matchedCluster.places.length;
      matchedCluster.latitude =
        matchedCluster.places.reduce((sum, p) => sum + p.latitude, 0) / n;
      matchedCluster.longitude =
        matchedCluster.places.reduce((sum, p) => sum + p.longitude, 0) / n;
    } else {
      clusters.push({
        clusterId: `cluster-${place.placeId}`,
        latitude: place.latitude,
        longitude: place.longitude,
        city: place.destinationCity || place.placeName,
        country: place.country || 'India',
        places: [place],
        isCluster: false,
        hasActiveDestination: Boolean(place.isActiveDestination)
      });
    }
  }

  return clusters;
}


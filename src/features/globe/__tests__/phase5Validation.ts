import * as THREE from 'three';
import {
  latLngToVector3,
  vector3ToLatLng,
  getGlobeRotationForLatLng,
  isValidCoordinates,
  clusterVisitedPlaces,
  VisitedPlaceMarkerInput
} from '../globeCoordinates';
import {
  getVisitedPlacesForUser,
  recordPlaceVisited,
  unmarkPlaceVisited,
  removeVisitsByTrip,
  aggregateUserTravelHistory
} from '../../../services/travelHistoryService';

export interface Phase5TestResult {
  name: string;
  passed: boolean;
  details: string;
}

export async function runPhase5ValidationSuite(): Promise<{
  allPassed: boolean;
  results: Phase5TestResult[];
}> {
  const results: Phase5TestResult[] = [];
  const radius = 1.72;

  // 1. Known-location geographic accuracy & surface placement test cases
  const knownLocations = [
    { name: 'Delhi, India', lat: 28.6139, lng: 77.209 },
    { name: 'Goa, India', lat: 15.2993, lng: 74.124 },
    { name: 'London, United Kingdom', lat: 51.5074, lng: -0.1278 },
    { name: 'New York, United States', lat: 40.7128, lng: -74.006 },
    { name: 'Tokyo, Japan', lat: 35.6762, lng: 139.6503 }
  ];

  for (const loc of knownLocations) {
    const vec = latLngToVector3(loc.lat, loc.lng, radius);
    const distFromCenter = vec.length();
    const roundTrip = vector3ToLatLng(vec);
    const latError = Math.abs(roundTrip.latitude - loc.lat);
    const lngError = Math.abs(roundTrip.longitude - loc.lng);

    // Also verify camera focus rotation places point at (0, 0, +R)
    const { rotX, rotY } = getGlobeRotationForLatLng(loc.lat, loc.lng);
    const euler = new THREE.Euler(rotX, rotY, 0, 'XYZ');
    const rotatedVec = vec.clone().applyEuler(euler);
    const facesCamera =
      Math.abs(rotatedVec.x) < 0.001 &&
      Math.abs(rotatedVec.y) < 0.001 &&
      Math.abs(rotatedVec.z - radius) < 0.001;

    const passed =
      Math.abs(distFromCenter - radius) < 0.0001 &&
      latError < 0.01 &&
      lngError < 0.01 &&
      facesCamera;

    results.push({
      name: `Geographic Accuracy & Focus: ${loc.name}`,
      passed,
      details: `Surface R=${distFromCenter.toFixed(4)} | Inverse=(${roundTrip.latitude}°, ${roundTrip.longitude}°) | CameraFocusZ=${rotatedVec.z.toFixed(4)}`
    });
  }

  // 2. Logged-out state has no fake personal markers
  const loggedOutPlaces = getVisitedPlacesForUser(null);
  const loggedOutEmpty = getVisitedPlacesForUser('');
  results.push({
    name: 'Logged-out state returns zero personal markers',
    passed: loggedOutPlaces.length === 0 && loggedOutEmpty.length === 0,
    details: `null user count=${loggedOutPlaces.length}, empty user count=${loggedOutEmpty.length}`
  });

  // 3. User isolation: User A cannot see User B's travel history
  const userA = 'test-user-alpha-p5';
  const userB = 'test-user-beta-p5';
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(`journeo_visited_places_${userA}`);
    localStorage.removeItem(`journeo_visited_places_${userB}`);
  }

  // Empty history check for fresh user
  const initialUserA = getVisitedPlacesForUser(userA);
  results.push({
    name: 'Fresh logged-in user displays empty state (0 markers)',
    passed: initialUserA.length === 0,
    details: `Initial visited count for ${userA}: ${initialUserA.length}`
  });

  await recordPlaceVisited({
    userId: userA,
    tripId: 'trip-a-1',
    placeId: 'delhi_red_fort',
    placeName: 'Red Fort (Lal Qila)',
    destinationCity: 'Delhi',
    country: 'India',
    latitude: 28.6562,
    longitude: 77.241
  });

  await recordPlaceVisited({
    userId: userB,
    tripId: 'trip-b-1',
    placeId: 'goa_fort_aguada',
    placeName: 'Fort Aguada',
    destinationCity: 'Goa',
    country: 'India',
    latitude: 15.4924,
    longitude: 73.7737
  });

  const historyA = getVisitedPlacesForUser(userA);
  const historyB = getVisitedPlacesForUser(userB);
  const isolated =
    historyA.length === 1 &&
    historyA[0].placeId === 'delhi_red_fort' &&
    historyA.every(r => r.userId === userA) &&
    historyB.length === 1 &&
    historyB[0].placeId === 'goa_fort_aguada' &&
    historyB.every(r => r.userId === userB);

  results.push({
    name: 'Strict User Isolation (User A vs User B)',
    passed: isolated,
    details: `User A places=[${historyA.map(p => p.placeId).join(',')}], User B places=[${historyB.map(p => p.placeId).join(',')}]`
  });

  // 4. Deduplication by canonical placeId across multiple visits
  await recordPlaceVisited({
    userId: userA,
    tripId: 'trip-a-1', // Same trip & same place -> should not duplicate record
    placeId: 'delhi_red_fort',
    placeName: 'Red Fort (Lal Qila)',
    destinationCity: 'Delhi'
  });
  const afterSameTripRepeat = getVisitedPlacesForUser(userA);

  await recordPlaceVisited({
    userId: userA,
    tripId: 'trip-a-2', // Second trip to the same monument -> 2 total visit records, 1 unique place marker
    placeId: 'delhi_red_fort',
    placeName: 'Red Fort (Lal Qila)',
    destinationCity: 'Delhi'
  });
  const summaryA = aggregateUserTravelHistory(getVisitedPlacesForUser(userA));

  results.push({
    name: 'Canonical Place ID Deduplication & Visit Count Separation',
    passed:
      afterSameTripRepeat.length === 1 &&
      summaryA.totalVisitRecords === 2 &&
      summaryA.uniquePlacesCount === 1 &&
      summaryA.uniquePlaces[0].visitCount === 2,
    details: `Same-trip records=${afterSameTripRepeat.length}, Cross-trip totalVisits=${summaryA.totalVisitRecords}, uniquePlaces=${summaryA.uniquePlacesCount}`
  });

  // 5. Missing or invalid coordinates are safely rejected
  const invalidRes = await recordPlaceVisited({
    userId: userA,
    tripId: 'trip-invalid',
    placeId: 'unknown_fake_place_xyz',
    placeName: 'Nonexistent Place Without Coords',
    latitude: NaN,
    longitude: undefined
  });
  const nullIslandValid = isValidCoordinates(0, 0);
  const outOfBoundsValid = isValidCoordinates(115, 220);

  results.push({
    name: 'Missing & Invalid Coordinates Safely Rejected',
    passed: invalidRes === null && !nullIslandValid && !outOfBoundsValid,
    details: `Invalid record returned ${invalidRes}, (0,0) valid=${nullIslandValid}, (115,220) valid=${outOfBoundsValid}`
  });

  // 6. Marker Clustering for nearby places in the same city
  const sampleClosePlaces: VisitedPlaceMarkerInput[] = [
    {
      id: '1',
      userId: userA,
      tripId: 't1',
      placeId: 'delhi_red_fort',
      placeName: 'Red Fort',
      destinationCity: 'Delhi',
      country: 'India',
      latitude: 28.6562,
      longitude: 77.241,
      visitedAt: new Date().toISOString()
    },
    {
      id: '2',
      userId: userA,
      tripId: 't1',
      placeId: 'delhi_jama_masjid',
      placeName: 'Jama Masjid',
      destinationCity: 'Delhi',
      country: 'India',
      latitude: 28.6507,
      longitude: 77.2334,
      visitedAt: new Date().toISOString()
    },
    {
      id: '3',
      userId: userA,
      tripId: 't2',
      placeId: 'goa_fort_aguada',
      placeName: 'Fort Aguada',
      destinationCity: 'Goa',
      country: 'India',
      latitude: 15.4924,
      longitude: 73.7737,
      visitedAt: new Date().toISOString()
    }
  ];
  const clustered = clusterVisitedPlaces(sampleClosePlaces, 45);
  results.push({
    name: 'Proximity Marker Clustering (Prevents Overlapping Pins)',
    passed:
      clustered.length === 2 &&
      clustered[0].isCluster === true &&
      clustered[0].places.length === 2 &&
      clustered[1].isCluster === false,
    details: `3 places (2 in Delhi, 1 in Goa) grouped into ${clustered.length} clusters`
  });

  // 7. Unmarking a visit and deleting a parent trip cleans up references
  removeVisitsByTrip(userA, 'trip-a-2');
  const afterTripDelete = getVisitedPlacesForUser(userA);
  await unmarkPlaceVisited(userA, 'delhi_red_fort', 'trip-a-1');
  const afterUnmark = getVisitedPlacesForUser(userA);

  results.push({
    name: 'Unmarking Visit & Trip Deletion Cleanup',
    passed: afterTripDelete.length === 1 && afterUnmark.length === 0,
    details: `After trip-a-2 delete=${afterTripDelete.length}, after unmark=${afterUnmark.length}`
  });

  // Cleanup test storage keys
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(`journeo_visited_places_${userA}`);
    localStorage.removeItem(`journeo_visited_places_${userB}`);
  }

  const allPassed = results.every(r => r.passed);
  return { allPassed, results };
}


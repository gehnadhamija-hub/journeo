import { generateOptimizedItinerary, PlanRequestInput } from '../itineraryOptimizer';
import { INDIA_DESTINATIONS } from '../../../../data/indiaDestinations';
import { CANONICAL_DESTINATIONS, isCoordinateWithinDestination, resolveCanonicalDestination } from '../../../../data/canonicalDestinations';
import { calculateRoute, getEstimatedTravelDurationMinutes } from '../../../../services/routingService';

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, name: string, failureMsg: string) {
  if (condition) {
    results.push({ name, passed: true, message: 'PASS' });
  } else {
    results.push({ name, passed: false, message: `FAIL: ${failureMsg}` });
    console.error(`❌ [FAILED] ${name}: ${failureMsg}`);
  }
}

console.log('🧪 Starting Journeo Phase 4 Regression & Quality Test Suite...\n');

// --------------------------------------------------------------------------
// TEST 1: Image Uniqueness & Place Identity
// --------------------------------------------------------------------------
console.log('--- Test Suite 1: Place Images & Identity ---');
const imageUrlMap = new Map<string, string[]>();
INDIA_DESTINATIONS.forEach(place => {
  const existing = imageUrlMap.get(place.imageUrl) || [];
  existing.push(place.name);
  imageUrlMap.set(place.imageUrl, existing);
});

const duplicateImages = Array.from(imageUrlMap.entries()).filter(([_, names]) => names.length > 1);
assert(
  duplicateImages.length === 0,
  'Unique Place Images',
  `Found duplicate images for: ${duplicateImages.map(([url, names]) => `${names.join(', ')} -> ${url}`).join('; ')}`
);

const placesWithMissingImages = INDIA_DESTINATIONS.filter(p => !p.imageUrl || !p.imageUrl.startsWith('https://'));
assert(
  placesWithMissingImages.length === 0,
  'All Places Have Valid Image URLs',
  `Places missing valid image URLs: ${placesWithMissingImages.map(p => p.name).join(', ')}`
);

// --------------------------------------------------------------------------
// TEST 2: Goa Destination Source of Truth (0 Delhi Places)
// --------------------------------------------------------------------------
console.log('\n--- Test Suite 2: Goa Destination Verification ---');
const goaPlan = generateOptimizedItinerary({
  city: 'Goa',
  tripDays: 2,
  travelStyle: 'balanced',
  transportation: 'cab',
  dietaryPreference: 'all',
  interests: ['beaches', 'forts', 'culture']
});

const goaStops = goaPlan.stops;
const delhiInGoa = goaStops.filter(s => {
  const name = s.destination.name.toLowerCase();
  const city = s.destination.city.toLowerCase();
  return city === 'delhi' || name.includes('qutub') || name.includes('red fort') || name.includes('india gate') || name.includes('humayun');
});

assert(
  delhiInGoa.length === 0,
  'Goa Itinerary Produces Zero Delhi Places',
  `Found Delhi places in Goa itinerary: ${delhiInGoa.map(s => s.destination.name).join(', ')}`
);

const goaCanonical = resolveCanonicalDestination('Goa');
assert(goaCanonical !== null, 'Goa Canonical Resolution', 'Could not resolve Goa canonical destination');

if (goaCanonical) {
  const outsideGoaStops = goaStops.filter(s => {
    const lat = s.destination.latitude || s.coordinates?.lat;
    const lng = s.destination.longitude || s.coordinates?.lng;
    return lat && lng && !isCoordinateWithinDestination(lat, lng, goaCanonical);
  });
  assert(
    outsideGoaStops.length === 0,
    'All Goa Stops Fall Within Geographic Bounds',
    `Stops outside Goa bounds: ${outsideGoaStops.map(s => s.destination.name).join(', ')}`
  );
}

// --------------------------------------------------------------------------
// TEST 3: Jaipur Destination Source of Truth (0 Goa / 0 Delhi Places)
// --------------------------------------------------------------------------
console.log('\n--- Test Suite 3: Jaipur Destination Verification ---');
const jaipurPlan = generateOptimizedItinerary({
  city: 'Jaipur',
  tripDays: 1,
  travelStyle: 'balanced',
  transportation: 'cab',
  dietaryPreference: 'vegetarian',
  interests: ['forts', 'palaces', 'food']
});

const nonJaipurStops = jaipurPlan.stops.filter(s => {
  const city = s.destination.city.toLowerCase();
  return city !== 'jaipur';
});

assert(
  nonJaipurStops.length === 0,
  'Jaipur Itinerary Produces 100% Jaipur Places',
  `Found non-Jaipur places in Jaipur itinerary: ${nonJaipurStops.map(s => `${s.destination.name} (${s.destination.city})`).join(', ')}`
);

// --------------------------------------------------------------------------
// TEST 4: Intelligent Meal & Cafe Scheduling
// --------------------------------------------------------------------------
console.log('\n--- Test Suite 4: Meal & Cafe Scheduling ---');
const mealStopsInJaipur = jaipurPlan.stops.filter(s => s.isMealStop);
assert(
  mealStopsInJaipur.length > 0,
  'Itinerary Includes Scheduled Meal Stops',
  'No meal stop found in full-day Jaipur itinerary'
);

// Check lunch window (between 12:00 and 14:30)
const lunchStops = jaipurPlan.stops.filter(s => s.mealType === 'lunch');
if (lunchStops.length > 0) {
  const lunch = lunchStops[0];
  const [hours, minutes] = lunch.plannedArrival.split(':').map(Number);
  const arrivalMinutes = hours * 60 + minutes;
  const isWithinWindow = arrivalMinutes >= 12 * 60 && arrivalMinutes <= 14 * 60 + 30;
  assert(
    isWithinWindow,
    'Lunch Stop is Scheduled in Realistic Window (12:00 - 14:30)',
    `Lunch was scheduled at ${lunch.plannedArrival} (${lunch.destination.name})`
  );
}

// --------------------------------------------------------------------------
// TEST 5: Unknown / Invalid Destination Handling
// --------------------------------------------------------------------------
console.log('\n--- Test Suite 5: Destination Validation Guardrails ---');
let caughtError = false;
try {
  generateOptimizedItinerary({
    city: 'AtlantisNonExistentCity',
    tripDays: 1,
    travelStyle: 'balanced',
    transportation: 'cab'
  });
} catch (e: any) {
  caughtError = true;
  assert(
    e.message.includes('Destination "AtlantisNonExistentCity" could not be resolved'),
    'Unknown Destination Throws Explicit DestinationResolutionError',
    `Expected resolution error, got: ${e.message}`
  );
}
assert(caughtError, 'Unknown Destination Rejects Silently Defaulting to Delhi', 'Did not throw on unknown destination');

// --------------------------------------------------------------------------
// TEST 6: Road Network Routing & Realistic Speeds
// --------------------------------------------------------------------------
console.log('\n--- Test Suite 6: Modular Routing Service ---');
async function testRouting() {
  const origin = { lat: 28.6562, lng: 77.2410 }; // Red Fort
  const dest = { lat: 28.5244, lng: 77.1855 };   // Qutub Minar
  
  const cabRoute = await calculateRoute(origin, dest, 'cab');
  assert(cabRoute.distanceKm > 10 && cabRoute.distanceKm < 30, 'Routing Distance Feasible (Delhi span ~15-25km)', `Distance was ${cabRoute.distanceKm} km`);
  assert(cabRoute.durationMinutes >= 25 && cabRoute.durationMinutes <= 90, 'Cab Duration Feasible (~30-60 mins for Delhi cross-city)', `Duration was ${cabRoute.durationMinutes} mins`);

  const walkDuration = getEstimatedTravelDurationMinutes(2.0, 'walking');
  assert(walkDuration >= 20 && walkDuration <= 35, 'Walking Speed Profile Realistic (~24-30 mins for 2km)', `Walk duration was ${walkDuration} mins`);
}

testRouting().then(() => {
  console.log('\n=============================================');
  console.log(`📊 TEST SUMMARY: ${results.filter(r => r.passed).length} / ${results.length} PASSED`);
  console.log('=============================================');
  if (results.every(r => r.passed)) {
    console.log('🎉 ALL REGRESSION TESTS PASSED CLEANLY!');
    process.exit(0);
  } else {
    console.error('❌ SOME TESTS FAILED');
    process.exit(1);
  }
}).catch(err => {
  console.error('Test suite runner crashed:', err);
  process.exit(1);
});


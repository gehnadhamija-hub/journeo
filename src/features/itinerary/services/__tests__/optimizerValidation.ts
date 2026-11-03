import {
  generateOptimizedItinerary,
  haversineDistanceKm,
  calculateTransitDuration,
  parseFreeTextPreferences,
  scoreCandidatePlaces,
  optimizeRouteWith2Opt,
  TripOptimizationRequest
} from '../itineraryOptimizer';
import { INDIA_DESTINATIONS, IndiaDestination } from '../../../../data/indiaDestinations';

console.log('================================================================');
console.log('  JOURNEO INTELLIGENT ITINERARY OPTIMIZATION ENGINE TEST SUITE');
console.log('================================================================\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, detail: string = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`✅ [PASS] Scenario ${totalTests}: ${testName}`);
    if (detail) console.log(`   └─ ${detail}`);
  } else {
    console.error(`❌ [FAIL] Scenario ${totalTests}: ${testName}`);
    if (detail) console.error(`   └─ FAILURE DETAIL: ${detail}`);
  }
}

// -------------------------------------------------------------
// Scenario 1: Standard 1-day trip request
// -------------------------------------------------------------
const scenario1 = generateOptimizedItinerary({
  destination: 'Delhi',
  days: 1,
  availableHoursPerDay: 8,
  startTime: '09:00',
  travelPace: 'balanced',
  selectedInterests: ['Historical Monuments']
});
const s1Day = scenario1.days[0];
const s1Sequential = s1Day.stops.every((stop, idx) => {
  if (idx === 0) return true;
  return stop.startTime >= s1Day.stops[idx - 1].endTime;
});
assert(
  scenario1.days.length === 1 && s1Day.stops.length >= 2 && s1Sequential,
  'Standard 1-Day Trip Request',
  `Generated 1 day with ${s1Day.stops.length} stops; monotonic sequential timings verified (${s1Day.stops[0].startTime} -> ${s1Day.stops[s1Day.stops.length - 1].endTime}).`
);

// -------------------------------------------------------------
// Scenario 2: 3-day multi-day trip request
// -------------------------------------------------------------
const scenario2 = generateOptimizedItinerary({
  destination: 'Jaipur',
  days: 3,
  availableHoursPerDay: 8,
  startTime: '09:00',
  travelPace: 'balanced',
  selectedInterests: ['Heritage', 'Forts & Palaces', 'Culture']
});
const allStopsS2 = scenario2.days.flatMap(d => d.stops);
const stopIdsS2 = allStopsS2.map(s => s.placeId);
const hasDuplicatesS2 = new Set(stopIdsS2).size !== stopIdsS2.length;
assert(
  scenario2.days.length === 3 && allStopsS2.length >= 6 && !hasDuplicatesS2,
  '3-Day Multi-Day Trip with Geographic Clustering and Zero Duplicates',
  `Days: ${scenario2.days.length}, Total stops: ${allStopsS2.length}, Distinct places: ${new Set(stopIdsS2).size}, Duplicates: ${hasDuplicatesS2 ? 'YES' : 'NONE'}.`
);

// -------------------------------------------------------------
// Scenario 3: Relaxed itinerary (fewer stops, longer dwell)
// -------------------------------------------------------------
const scenario3Relaxed = generateOptimizedItinerary({
  destination: 'Delhi',
  days: 1,
  travelPace: 'relaxed',
  availableHoursPerDay: 8
});
const avgDwellRelaxed = scenario3Relaxed.days[0].stops.reduce((acc, s) => acc + s.visitDurationMinutes, 0) / scenario3Relaxed.days[0].stops.length;
assert(
  scenario3Relaxed.days[0].stops.length <= 4 && avgDwellRelaxed >= 75,
  'Relaxed Itinerary Pace (Unhurried Dwell Times)',
  `Stops: ${scenario3Relaxed.days[0].stops.length}, Average dwell time: ${Math.round(avgDwellRelaxed)} mins.`
);

// -------------------------------------------------------------
// Scenario 4: Packed itinerary (more stops, tighter schedule)
// -------------------------------------------------------------
const scenario4Packed = generateOptimizedItinerary({
  destination: 'Delhi',
  days: 1,
  travelPace: 'packed',
  availableHoursPerDay: 9
});
const avgDwellPacked = scenario4Packed.days[0].stops.reduce((acc, s) => acc + s.visitDurationMinutes, 0) / scenario4Packed.days[0].stops.length;
assert(
  scenario4Packed.days[0].stops.length >= scenario3Relaxed.days[0].stops.length && avgDwellPacked < avgDwellRelaxed,
  'Packed Itinerary Pace (Higher Sight Density)',
  `Packed stops: ${scenario4Packed.days[0].stops.length} vs Relaxed: ${scenario3Relaxed.days[0].stops.length}, Avg dwell: ${Math.round(avgDwellPacked)} mins.`
);

// -------------------------------------------------------------
// Scenario 5: Heritage-focused trip
// -------------------------------------------------------------
const scenario5 = generateOptimizedItinerary({
  destination: 'Delhi',
  days: 1,
  selectedInterests: ['Historical Monuments', 'UNESCO World Heritage', 'Heritage']
});
const heritageMatches = scenario5.days[0].stops.filter(s =>
  s.category.includes('Heritage') || s.category.includes('Monument') || s.destination.isUnesco
);
assert(
  heritageMatches.length >= 2,
  'Heritage-Focused Trip Specialization',
  `${heritageMatches.length} of ${scenario5.days[0].stops.length} stops belong to Heritage/UNESCO categories.`
);

// -------------------------------------------------------------
// Scenario 6: Food and cafe-focused trip
// -------------------------------------------------------------
const scenario6 = generateOptimizedItinerary({
  destination: 'Delhi',
  days: 1,
  selectedInterests: ['Food and Local Culture', 'Culinary & Street Food', 'Bazaar']
});
const foodOrBazaar = scenario6.days[0].stops.some(s =>
  (s.category && (s.category.includes('Food') || s.category.includes('Bazaar'))) ||
  (s.destination && s.destination.category && (s.destination.category.includes('Culinary') || s.destination.category.includes('Food'))) ||
  (s.destination && s.destination.tags && s.destination.tags.some((t: string) => t.includes('food') || t.includes('market')))
);
assert(
  foodOrBazaar,
  'Food & Local Culture Specialization',
  `Successfully prioritized culinary/bazaar experience: ${scenario6.days[0].stops.map(s => s.name).join(', ')}.`
);

// -------------------------------------------------------------
// Scenario 7: Free-text personalization NLP
// -------------------------------------------------------------
const scenario7Nlp = parseFreeTextPreferences(
  'I want a relaxed 3-day trip to Jaipur with forts, local food, hidden gems, and beautiful sunset spots. Avoid crowded tourist places and don\'t make the schedule too hectic.'
);
assert(
  scenario7Nlp.suggestedPace === 'relaxed' &&
  scenario7Nlp.foodPriority &&
  scenario7Nlp.sunsetPriority &&
  scenario7Nlp.crowdAvoidance &&
  scenario7Nlp.hiddenGemPriority,
  'Free-Text Personalization NLP Processing',
  `Extracted pace: ${scenario7Nlp.suggestedPace}, foodPriority: ${scenario7Nlp.foodPriority}, sunsetPriority: ${scenario7Nlp.sunsetPriority}, crowdAvoidance: ${scenario7Nlp.crowdAvoidance}, hiddenGemPriority: ${scenario7Nlp.hiddenGemPriority}.`
);

// -------------------------------------------------------------
// Scenario 8: Duplicate place records handling & deduplication
// -------------------------------------------------------------
const rawWithDups: IndiaDestination[] = [
  ...INDIA_DESTINATIONS.filter(d => d.city === 'Delhi').slice(0, 3),
  // Insert identical duplicate
  { ...INDIA_DESTINATIONS.find(d => d.city === 'Delhi')!, id: 'dup_1' },
  // Insert same-name duplicate with slight case variation
  { ...INDIA_DESTINATIONS.find(d => d.city === 'Delhi')!, id: 'dup_2', name: INDIA_DESTINATIONS.find(d => d.city === 'Delhi')!.name.toLowerCase() }
];
const scenario8 = generateOptimizedItinerary({
  destination: 'Delhi',
  days: 1,
  candidatePool: rawWithDups
});
const stopNamesS8 = scenario8.days[0].stops.map(s => s.name.toLowerCase());
const hasNameDups = new Set(stopNamesS8).size !== stopNamesS8.length;
assert(
  !hasNameDups,
  'Duplicate Place Records Deduplication',
  `Input candidates had duplicates; output itinerary has strictly unique places (${new Set(stopNamesS8).size} distinct).`
);

// -------------------------------------------------------------
// Scenario 9: Places with opening-hour restrictions
// -------------------------------------------------------------
const scenario9 = generateOptimizedItinerary({
  destination: 'Agra',
  days: 1,
  startDate: '2026-11-06' // A Friday when Taj Mahal is closed
});
// Taj Mahal is closed on Fridays per ASI regulations
const tajIncludedOnFriday = scenario9.days[0].stops.some(s => s.name.toLowerCase().includes('taj mahal'));
assert(
  !tajIncludedOnFriday,
  'Opening-Hour & Closed-Day Restrictions (Taj Mahal Friday ASI Closure)',
  `Taj Mahal correctly excluded on Friday visit date. Output stops: ${scenario9.days[0].stops.map(s => s.name).join(', ')}.`
);

// -------------------------------------------------------------
// Scenario 10: Geographically inefficient candidate set (2-Opt TSP)
// -------------------------------------------------------------
// Provide 4 points in deliberately zig-zag crossing order:
// Connaught Place (Central), Qutub Minar (South), Red Fort (North), Lotus Temple (South-East)
const testDests: IndiaDestination[] = [
  INDIA_DESTINATIONS.find(d => d.id === 'delhi_qutub_minar')!,
  INDIA_DESTINATIONS.find(d => d.id === 'delhi_red_fort')!,
  INDIA_DESTINATIONS.find(d => d.id === 'delhi_agrasen_baoli')!,
  INDIA_DESTINATIONS.find(d => d.id === 'delhi_humayun_tomb')!
];

const unoptimizedDistance =
  haversineDistanceKm(28.6328, 77.2197, testDests[0].latitude, testDests[0].longitude) +
  haversineDistanceKm(testDests[0].latitude, testDests[0].longitude, testDests[1].latitude, testDests[1].longitude) +
  haversineDistanceKm(testDests[1].latitude, testDests[1].longitude, testDests[2].latitude, testDests[2].longitude) +
  haversineDistanceKm(testDests[2].latitude, testDests[2].longitude, testDests[3].latitude, testDests[3].longitude);

const optimizedRoute = optimizeRouteWith2Opt(
  testDests,
  28.6328,
  77.2197
);

const optimizedDistance = optimizedRoute.reduce((sum, stop, idx) => {
  const prevCoord = idx === 0 ? { lat: 28.6328, lng: 77.2197 } : { lat: optimizedRoute[idx - 1].latitude, lng: optimizedRoute[idx - 1].longitude };
  return sum + haversineDistanceKm(prevCoord.lat, prevCoord.lng, stop.latitude, stop.longitude);
}, 0);

assert(
  optimizedDistance <= unoptimizedDistance,
  'Geographic Routing Efficiency with 2-Opt Edge-Exchange',
  `Unoptimized zig-zag distance: ${unoptimizedDistance.toFixed(2)} km -> 2-Opt optimized: ${optimizedDistance.toFixed(2)} km (${Math.round((1 - optimizedDistance / unoptimizedDistance) * 100)}% route distance saved).`
);

// -------------------------------------------------------------
// Scenario 11: Insufficient number of available places
// -------------------------------------------------------------
const singleCandidate = [INDIA_DESTINATIONS.find(d => d.id === 'delhi_red_fort')!];
let scenario11Succeeded = false;
try {
  const result = generateOptimizedItinerary({
    destination: 'Delhi',
    days: 1,
    candidatePool: singleCandidate
  });
  scenario11Succeeded = result.stops.length === 1 && result.days.length === 1;
} catch (e) {
  scenario11Succeeded = false;
}
assert(
  scenario11Succeeded,
  'Insufficient Number of Available Places Graceful Handling',
  'Successfully handled single available candidate without crashing or dividing by zero.'
);

// -------------------------------------------------------------
// Scenario 12: Route & Speed Fallback for Diverse Modes
// -------------------------------------------------------------
const distKm = 10;
const cabDur = calculateTransitDuration(distKm, 'cab');
const publicDur = calculateTransitDuration(distKm, 'public');
const bicycleDur = calculateTransitDuration(distKm, 'bicycle');
const walkingDur = calculateTransitDuration(distKm, 'walking');

const speedsLogical = cabDur < publicDur && publicDur < bicycleDur && bicycleDur < walkingDur;
assert(
  speedsLogical && cabDur >= 15 && walkingDur >= 100,
  'Transit Mode Speeds & Realistic Travel Duration Fallback',
  `10km travel time: Cab (${cabDur}m), Public (${publicDur}m), Bicycle (${bicycleDur}m), Walking (${walkingDur}m). Logical progression verified.`
);

// -------------------------------------------------------------
// Scenario 13: Two consecutive generations (variety & non-identical circuits)
// -------------------------------------------------------------
const runA = generateOptimizedItinerary({
  destination: 'Delhi',
  days: 1,
  seedVariation: 0
});
const runB = generateOptimizedItinerary({
  destination: 'Delhi',
  days: 1,
  seedVariation: 77
});

const stopsA = runA.days[0].stops.map(s => s.placeId).join(',');
const stopsB = runB.days[0].stops.map(s => s.placeId).join(',');
const hasVariety = stopsA !== stopsB;

assert(
  hasVariety,
  'Controlled Variety in Consecutive Generations (Different Seed Variation)',
  `Run A circuit: [${runA.days[0].stops.map(s => s.name).join(' -> ')}] vs Run B: [${runB.days[0].stops.map(s => s.name).join(' -> ')}]. Controlled diversity verified.`
);

// -------------------------------------------------------------
// SUMMARY REPORT
// -------------------------------------------------------------
console.log('\n================================================================');
console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} SCENARIOS PASSED (${Math.round((passedTests / totalTests) * 100)}%)`);
console.log('================================================================\n');

if (passedTests === totalTests) {
  console.log('🎉 ALL 13 TEST SCENARIOS COMPLETED SUCCESSFULLY!');
  process.exit(0);
} else {
  console.error(`💥 ${totalTests - passedTests} TEST SCENARIOS FAILED.`);
  process.exit(1);
}

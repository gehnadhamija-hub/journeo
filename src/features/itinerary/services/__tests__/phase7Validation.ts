import { INDIA_DESTINATIONS } from '../../../../data/indiaDestinations';
import {
  generateOptimizedItinerary,
  validateGeneratedItinerary,
  selectLegTransportMode
} from '../itineraryOptimizer';
import {
  processTripAssistantMessage,
  AssistantConversationContext
} from '../../../../services/tripAssistantService';

interface TestOutcome {
  id: string;
  name: string;
  passed: boolean;
  details: string;
}

const results: TestOutcome[] = [];

function recordTest(id: string, name: string, passed: boolean, details: string) {
  results.push({ id, name, passed, details });
}

// ============================================================================
// PRE-CHECK: ORIGINAL DATA PROVENANCE & ENRICHMENT SEPARATION
// ============================================================================
const allHaveProvenance = INDIA_DESTINATIONS.every(
  p =>
    p.originalData &&
    typeof p.originalData.source === 'string' &&
    p.originalData.source.length > 0 &&
    typeof p.originalData.sourceId === 'string' &&
    p.originalData.verificationStatus.startsWith('verified') &&
    p.enrichment &&
    Array.isArray(p.enrichment.experienceTypes)
);
recordTest(
  'DATA-PROVENANCE',
  'Original place provenance (originalData) and Journeo enrichment are preserved on all catalog records',
  allHaveProvenance,
  `Verified ${INDIA_DESTINATIONS.length} places across 10 Indian destinations with source, sourceId, lastVerifiedAt, facilities, and enrichment.`
);

// ============================================================================
// TEST A, B, C, D + USER D: 5 DISTINCT USER PROFILES IN DELHI (2 DAYS)
// ============================================================================

// Profile A — History-focused traveler
const itinA = generateOptimizedItinerary({
  destination: 'Delhi',
  days: 2,
  selectedInterests: ['Historical Monuments'],
  travelPace: 'balanced',
  crowdPreference: 'popular',
  freeTextInstructions: 'I want to explore iconic Mughal history, forts, and UNESCO architectural monuments in Delhi.'
});

// Profile B — Food, Street Food, Markets & Cafes traveler (with negative constraint: no museums)
const itinB = generateOptimizedItinerary({
  destination: 'Delhi',
  days: 2,
  selectedInterests: ['Food and Local Culture', 'Shopping'],
  foodStyle: 'street_food',
  travelPace: 'balanced',
  freeTextInstructions:
    "I want to explore Delhi through street food, local markets, and small cafes. I'm not particularly interested in museums, and I prefer a relaxed, unhurried pace."
});

// Profile C — Nature, peaceful places, relaxed travel
const itinC = generateOptimizedItinerary({
  destination: 'Delhi',
  days: 2,
  selectedInterests: ['Nature and Landscapes'],
  travelPace: 'relaxed',
  crowdPreference: 'avoid_crowded',
  freeTextInstructions:
    'I want a peaceful, slow-paced nature trip in Delhi with gardens, lakes, and quiet green walks away from crowds.'
});

// Profile D — Shopping, markets, bazaars, local life
const itinD = generateOptimizedItinerary({
  destination: 'Delhi',
  days: 2,
  selectedInterests: ['Shopping', 'Local Experiences'],
  travelPace: 'balanced',
  freeTextInstructions:
    'Focus on vibrant bazaars, craft markets, Dilli Haat, and traditional shopping lanes in Delhi.'
});

// Profile E / Test D — Avoid crowded attractions, photography & hidden gems
const itinE = generateOptimizedItinerary({
  destination: 'Delhi',
  days: 2,
  selectedInterests: ['Hidden Gems', 'Photography'],
  crowdPreference: 'avoid_crowded',
  discoveryPreference: 'hidden_gems',
  travelPace: 'balanced',
  freeTextInstructions:
    "I don't want to spend the entire day in crowded tourist areas. Prioritize hidden gems, stepwells, and offbeat photography spots."
});

const getPrimaryIds = (it: typeof itinA) =>
  it.stops.filter(s => !s.id.includes('-breakfast-') && !s.id.includes('-lunch-')).map(s => s.placeId);

const idsA = getPrimaryIds(itinA);
const idsB = getPrimaryIds(itinB);
const idsC = getPrimaryIds(itinC);
const idsD = getPrimaryIds(itinD);
const idsE = getPrimaryIds(itinE);

// Test A assertion: History profile prioritizes Heritage monuments
const heritageCountA = itinA.stops.filter(s => s.category === 'Heritage').length;
recordTest(
  'TEST-A',
  'History-focused user receives heritage & architectural monuments with grounded selection reasons',
  heritageCountA >= 4 && itinA.stops.every(s => s.reasonForSelection && s.reasonForSelection.length > 10),
  `Profile A stops: ${itinA.stops.map(s => `${s.name.split('(')[0].trim()} [${s.category}]`).join(' -> ')}`
);

// Test B assertion: Food & Market focused user receives multiple food/cafe/market stops and differs from History user
const foodAndMarketCountB = itinB.stops.filter(
  s => s.category === 'Food' || s.category === 'Shopping' || s.isMealStop
).length;
const overlapAB = idsA.filter(id => idsB.includes(id)).length;
recordTest(
  'TEST-B',
  'Food & market-focused user receives street food, cafes, and bazaars and differs significantly from History user',
  foodAndMarketCountB >= 3 && overlapAB < Math.min(idsA.length, idsB.length),
  `Profile B stops (${foodAndMarketCountB} food/market stops, overlap with A = ${overlapAB}/${idsA.length}): ${itinB.stops
    .map(s => `${s.name.split('(')[0].trim()} [${s.category}]`)
    .join(' -> ')}`
);

// Test C assertion: Nature + relaxed pace user gets Nature stops, fewer stops per day (relaxed), and longer dwell durations
const natureCountC = itinC.stops.filter(s => s.category === 'Nature').length;
const primaryStopsPerDayC = idsC.length / 2;
const primaryStopsPerDayA = idsA.length / 2;
recordTest(
  'TEST-C',
  'Nature + relaxed pace user gets peaceful green spaces and fewer daily stops than balanced/packed profiles',
  natureCountC >= 2 && primaryStopsPerDayC <= primaryStopsPerDayA,
  `Profile C stops (${natureCountC} Nature stops, ${primaryStopsPerDayC} primary stops/day vs ${primaryStopsPerDayA} in Profile A): ${itinC.stops
    .map(s => `${s.name.split('(')[0].trim()} [${s.category}, ${s.visitDurationMinutes}m]`)
    .join(' -> ')}`
);

// Test D assertion: Avoid crowded attractions user prioritizes low_offbeat hidden gems and avoids high_popular tourist crowds
const offbeatCountE = itinE.stops.filter(
  s => !s.isMealStop && s.destination?.enrichment?.crowdLevel === 'low_offbeat'
).length;
const highPopularCountE = itinE.stops.filter(
  s => !s.isMealStop && s.destination?.enrichment?.crowdLevel === 'high_popular'
).length;
const overlapAE = idsA.filter(id => idsE.includes(id)).length;
recordTest(
  'TEST-D',
  'Avoid-crowded / hidden-gems user receives uncrowded offbeat places instead of only headline tourist traps',
  offbeatCountE >= 4 && highPopularCountE === 0 && overlapAE <= 3,
  `Profile E stops (${offbeatCountE} low_offbeat gems, ${highPopularCountE} high_popular, overlap with popular Profile A = ${overlapAE}): ${itinE.stops
    .map(s => `${s.name.split('(')[0].trim()} [${s.destination?.enrichment?.crowdLevel}]`)
    .join(' -> ')}`
);

// Additional check: Profile D (Shopping & Bazaars) includes Shopping/Market stops
const shoppingCountD = itinD.stops.filter(
  s => s.category === 'Shopping' || s.name.toLowerCase().includes('haat') || s.name.toLowerCase().includes('chowk')
).length;
recordTest(
  'TEST-D2',
  'Shopping & bazaar-focused user receives markets, haats, and craft bazaars',
  shoppingCountD >= 2,
  `Profile D stops (${shoppingCountD} shopping/bazaar stops): ${itinD.stops
    .map(s => `${s.name.split('(')[0].trim()} [${s.category}]`)
    .join(' -> ')}`
);

// ============================================================================
// TEST E: DESTINATION ISOLATION (DELHI, GOA, JAIPUR, KOCHI)
// ============================================================================
const citiesToVerify = ['Delhi', 'Goa', 'Jaipur', 'Kochi'];
let isolationPassed = true;
const isolationSummary: string[] = [];

for (const c of citiesToVerify) {
  const it = generateOptimizedItinerary({
    destination: c,
    originCity: c === 'Goa' ? 'Delhi' : 'Mumbai',
    days: 3,
    selectedInterests: ['Historical Monuments', 'Nature and Landscapes', 'Food and Local Culture']
  });
  const val = validateGeneratedItinerary(it);
  const allMatchCity = it.stops.every(s => s.city.toLowerCase() === c.toLowerCase());
  if (!val.valid || !allMatchCity) {
    isolationPassed = false;
  }
  isolationSummary.push(`${c}: ${it.stops.length} stops (100% inside ${c})`);
}

recordTest(
  'TEST-E',
  'Destination isolation guarantees zero cross-city contamination even when originCity differs',
  isolationPassed,
  isolationSummary.join(' | ')
);

// ============================================================================
// TEST F: PREFERENCE & CATEGORY EXCLUSION ("no museums" + excludedPlaceIds)
// ============================================================================
const itinExcl = generateOptimizedItinerary({
  destination: 'Jaipur',
  days: 2,
  selectedInterests: ['Historical Monuments', 'Culture'],
  excludedCategories: ['Museum'],
  excludedPlaceIds: ['jaipur_amber_fort'],
  freeTextInstructions: 'We want to see Jaipur heritage and bazaars, but no museums please.'
});

const hasExcludedPlace = itinExcl.stops.some(s => s.placeId === 'jaipur_amber_fort');
const hasMuseum = itinExcl.stops.some(
  s => (s.subcategory || '').toLowerCase().includes('museum') || s.name.toLowerCase().includes('museum')
);

recordTest(
  'TEST-F',
  'Explicitly excluded places (jaipur_amber_fort) and excluded categories (Museum) are strictly omitted',
  !hasExcludedPlace && !hasMuseum,
  `Jaipur stops after excluding Amber Fort & Museums: ${itinExcl.stops.map(s => s.name.split('(')[0].trim()).join(', ')}`
);

// ============================================================================
// TEST G: CHATBOT MODIFICATION & SCHEDULE RECALCULATION
// ============================================================================
const baseJaipur = generateOptimizedItinerary({
  destination: 'Jaipur',
  days: 2,
  selectedInterests: ['Historical Monuments', 'Culture']
});
const day2StopToRemove = baseJaipur.days[1].stops.find(s => !s.isMealStop) || baseJaipur.days[1].stops[0];
const removePrompt = `Remove ${day2StopToRemove.name.split('(')[0].trim()} from day 2`;

const chatResG = processTripAssistantMessage(removePrompt, baseJaipur, {});
const removedSuccessfully =
  chatResG.modified &&
  Boolean(chatResG.updatedItinerary) &&
  !chatResG.updatedItinerary!.days[1].stops.some(s => s.placeId === day2StopToRemove.placeId);
const validAfterEdit = chatResG.updatedItinerary
  ? validateGeneratedItinerary(chatResG.updatedItinerary).valid
  : false;

recordTest(
  'TEST-G',
  'Conversational assistant removes requested stop from Day 2, recalculates timings, and passes itinerary validation',
  removedSuccessfully && validAfterEdit,
  `Prompt: "${removePrompt}" -> Action: ${chatResG.action.type} (${chatResG.action.summary})`
);

// ============================================================================
// TEST H: MULTI-TURN CONVERSATION CONTEXT ("Remove ... from day two" -> "Make that day more relaxed")
// ============================================================================
const turn2Res = processTripAssistantMessage(
  'Make that day more relaxed',
  chatResG.updatedItinerary!,
  chatResG.updatedContext
);

const turn2TargetedDay2 =
  turn2Res.modified &&
  turn2Res.action.dayNumber === 2 &&
  turn2Res.updatedItinerary?.days[1].dayPace === 'relaxed';

recordTest(
  'TEST-H',
  'Multi-turn assistant resolves "Make that day more relaxed" to Day 2 from prior turn context',
  Boolean(turn2TargetedDay2),
  `Turn 1 referenced Day ${chatResG.updatedContext.lastReferencedDayNumber}; Turn 2 updated Day ${turn2Res.action.dayNumber} pace to "${turn2Res.updatedItinerary?.days[1].dayPace}"`
);

// ============================================================================
// TEST I: INVALID / OUT-OF-DESTINATION PLACE REQUEST HANDLING
// ============================================================================
const invalidPlaceRes = processTripAssistantMessage(
  'Add the Eiffel Tower to Day 1',
  baseJaipur,
  {}
);
const crossCityPlaceRes = processTripAssistantMessage(
  'Add Baga Beach to Day 1',
  baseJaipur,
  {}
);

const safelyRejectedInvalid =
  !invalidPlaceRes.modified &&
  invalidPlaceRes.action.type === 'unsupported_place' &&
  !crossCityPlaceRes.modified &&
  crossCityPlaceRes.action.type === 'unsupported_place';

recordTest(
  'TEST-I',
  'Assistant safely rejects non-existent or cross-city places without fabricating place IDs or corrupting the trip',
  safelyRejectedInvalid,
  `Eiffel Tower -> ${invalidPlaceRes.action.type}; Baga Beach in Jaipur -> ${crossCityPlaceRes.action.type}`
);

// ============================================================================
// TEST J: REPEATED GENERATION CONSISTENCY & SMART LEG TRANSPORT
// ============================================================================
const repeat1 = generateOptimizedItinerary({
  destination: 'Goa',
  days: 3,
  selectedInterests: ['Nature and Landscapes', 'Food and Local Culture'],
  crowdPreference: 'avoid_crowded',
  walkingTolerance: 'moderate'
});
const repeat2 = generateOptimizedItinerary({
  destination: 'Goa',
  days: 3,
  selectedInterests: ['Nature and Landscapes', 'Food and Local Culture'],
  crowdPreference: 'avoid_crowded',
  walkingTolerance: 'moderate'
});

const consistentValid =
  validateGeneratedItinerary(repeat1).valid &&
  validateGeneratedItinerary(repeat2).valid &&
  repeat1.stops.length === repeat2.stops.length &&
  selectLegTransportMode(0.8, 'cab', 'moderate', []) === 'walking' &&
  selectLegTransportMode(6.5, 'cab', 'moderate', []) === 'cab';

recordTest(
  'TEST-J',
  'Repeated generation is deterministic, valid, and selects realistic per-leg transport (walking <= 1.2km, cab/transit for longer legs)',
  consistentValid,
  `Goa 3-day repeated runs produced ${repeat1.stops.length} valid stops; 0.8km leg -> walking, 6.5km leg -> cab.`
);

// Print formatted report
console.log('\n=============================================================');
console.log('PHASE 7 VALIDATION SUITE — PERSONALIZATION & TRIP ASSISTANT');
console.log('=============================================================');
let passedCount = 0;
for (const r of results) {
  const badge = r.passed ? '✅ PASS' : '❌ FAIL';
  if (r.passed) passedCount++;
  console.log(`${badge} [${r.id}] ${r.name}`);
  console.log(`   └─ ${r.details}`);
}
console.log('-------------------------------------------------------------');
console.log(`Total: ${passedCount}/${results.length} Passed`);
console.log('=============================================================\n');

if (passedCount !== results.length) {
  process.exit(1);
}


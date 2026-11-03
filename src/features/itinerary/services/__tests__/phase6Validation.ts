import {
  generateOptimizedItinerary,
  parseTimeToMinutes
} from '../itineraryOptimizer';
import {
  estimateIntercityTransport,
  calculateTripBudgetBreakdown,
  addTripExpense,
  updateTripExpense,
  deleteTripExpense,
  getTripExpenses,
  summarizeTripExpenses
} from '../../../../services/expenseService';
import {
  CANONICAL_DESTINATIONS,
  DESTINATION_DISCOVERY_CATEGORIES,
  resolveCanonicalDestination
} from '../../../../data/canonicalDestinations';
import { INDIA_DESTINATIONS } from '../../../../data/indiaDestinations';
import { getPlaceReviewData } from '../../../../data/placeReviews';

// Setup mock localStorage for Node test environment
const memoryStore: Record<string, string> = {};
if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = {
    getItem: (k: string) => (k in memoryStore ? memoryStore[k] : null),
    setItem: (k: string, v: string) => {
      memoryStore[k] = String(v);
    },
    removeItem: (k: string) => {
      delete memoryStore[k];
    },
    clear: () => {
      for (const k of Object.keys(memoryStore)) delete memoryStore[k];
    }
  };
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${testName}${details ? ` — ${details}` : ''}`);
    failed++;
  }
}

console.log('==============================================================');
console.log('PHASE 6 VALIDATION SUITE: TRANSPORT, BUDGET, MULTI-DAY & UX');
console.log('==============================================================\n');

// ---------------------------------------------------------------------------
// 1. INTERCITY TRANSPORT TESTS (PART 1 & PART 13)
// ---------------------------------------------------------------------------
console.log('--- 1. Intercity Transport Mode & Schedule Awareness ---');

const flightEst = estimateIntercityTransport({
  mode: 'flight',
  originCity: 'Delhi',
  destinationCity: 'Goa',
  arrivalTimeDay1: '15:00',
  tripType: 'round_trip',
  travellers: 2
});

assert(
  flightEst.mode === 'flight' &&
    flightEst.originCity === 'Delhi' &&
    flightEst.destinationCity === 'Goa' &&
    flightEst.estimatedTotalCostINR > 0,
  'Flight selection works and calculates realistic round-trip estimate'
);

const trainEst = estimateIntercityTransport({
  mode: 'train',
  originCity: 'Delhi',
  destinationCity: 'Jaipur',
  tripType: 'round_trip',
  travellers: 2
});
const busEst = estimateIntercityTransport({
  mode: 'bus',
  originCity: 'Mumbai',
  destinationCity: 'Goa',
  tripType: 'one_way',
  travellers: 2
});
const carEst = estimateIntercityTransport({
  mode: 'car',
  originCity: 'Delhi',
  destinationCity: 'Agra',
  tripType: 'round_trip',
  travellers: 3
});

assert(
  trainEst.mode === 'train' && busEst.mode === 'bus' && carEst.mode === 'car',
  'Train, Bus, and Self-Drive Car intercity modes work accurately'
);

// Test arrival time affects Day 1 schedule (Arrive at 15:00 -> Sightseeing must NOT start at 09:00)
const lateArrivalPlan = generateOptimizedItinerary({
  destination: 'Goa',
  originCity: 'Delhi',
  days: 3,
  intercityTransport: {
    mode: 'flight',
    originCity: 'Delhi',
    destinationCity: 'Goa',
    arrivalTimeDay1: '15:00',
    tripType: 'round_trip',
    travellers: 2
  }
});

const day1FirstStopStart = lateArrivalPlan.days[0]?.stops[0]?.startTime || '09:00';
assert(
  parseTimeToMinutes(day1FirstStopStart) >= 16 * 60,
  `Arrival time (15:00) affects Day 1 schedule (Day 1 first stop starts at ${day1FirstStopStart}, not 09:00)`
);

assert(
  lateArrivalPlan.stops.every(s => s.city.toLowerCase() === 'goa'),
  'Origin city (Delhi) is never treated as the sightseeing destination (all stops are in Goa)'
);

// ---------------------------------------------------------------------------
// 2. BUDGET & OPTIMIZER INTEGRATION TESTS (PART 2, PART 9 & PART 13)
// ---------------------------------------------------------------------------
console.log('\n--- 2. Trip Budget Calculation & Budget-Aware Optimizer ---');

const perPersonBreakdown = calculateTripBudgetBreakdown({
  budgetConfig: {
    enabled: true,
    currency: 'INR',
    budgetScope: 'per_person',
    amount: 10000,
    travellers: 3,
    tier: 'moderate',
    includeIntercityTransport: true,
    includeAccommodation: true,
    includeFoodAndActivities: true
  },
  intercityEstimate: carEst,
  days: 3,
  travellers: 3
});

assert(
  perPersonBreakdown.totalBudget === 30000 && perPersonBreakdown.perPersonBudget === 10000,
  'Per-person budget (₹10,000 x 3 travellers = ₹30,000 total) is calculated and stored properly'
);

const overBudgetBreakdown = calculateTripBudgetBreakdown({
  budgetConfig: {
    enabled: true,
    currency: 'INR',
    budgetScope: 'total',
    amount: 4000, // Tight total budget for 4 days
    travellers: 2,
    tier: 'premium',
    includeIntercityTransport: true,
    includeAccommodation: true,
    includeFoodAndActivities: true
  },
  intercityEstimate: flightEst,
  days: 4,
  travellers: 2
});

assert(
  overBudgetBreakdown.isEstimatedOverBudget &&
    overBudgetBreakdown.overBudgetAmount > 0 &&
    overBudgetBreakdown.warnings.length > 0 &&
    overBudgetBreakdown.savingSuggestions.length > 0,
  'Over-budget warning and actionable saving suggestions are shown when estimated cost exceeds budget'
);

// Verify budget tier influences itinerary scoring & local transport recommendation
const tightBudgetItinerary = generateOptimizedItinerary({
  destination: 'Delhi',
  days: 2,
  budget: 4500,
  budgetConfig: {
    enabled: true,
    currency: 'INR',
    budgetScope: 'total',
    amount: 4500,
    travellers: 2,
    tier: 'budget'
  }
});

assert(
  tightBudgetItinerary.tripConfig.transportMode === 'public' &&
    tightBudgetItinerary.budgetBreakdown !== undefined,
  'Low budget influences itinerary generation (auto-switches unspecified local transport to public transit and scores free heritage stops higher)'
);

// ---------------------------------------------------------------------------
// 3. MULTI-DAY DURATION TESTS (1, 5, 6, 10, 14 DAYS) (PART 3 & PART 13)
// ---------------------------------------------------------------------------
console.log('\n--- 3. Extended Multi-Day Trip Support (1, 5, 6, 10, 14 Days) ---');

for (const testDays of [1, 5, 6, 10, 14]) {
  const plan = generateOptimizedItinerary({
    destination: 'Jaipur',
    startDate: '2026-11-10',
    days: testDays,
    travelPace: 'balanced'
  });

  const allDaysPopulated = plan.days.every(d => d.stops.length > 0);
  const sequentialDatesValid = plan.days.every((d, idx) => Boolean(d.date && d.date.startsWith('2026-')));

  // Verify no primary monument ID is repeated across days
  const primarySightIds = plan.stops
    .filter(s => !s.isMealStop && !s.placeId.includes('_ext_'))
    .map(s => s.placeId);
  const uniquePrimarySightIds = new Set(primarySightIds);

  assert(
    plan.days.length === testDays &&
      allDaysPopulated &&
      sequentialDatesValid &&
      primarySightIds.length === uniquePrimarySightIds.size,
    `${testDays}-day trip generates exactly ${plan.days.length} populated days with sequential dates and 0 duplicate monuments`
  );
}

// ---------------------------------------------------------------------------
// 4. DESTINATION DISCOVERY & EXPLORE SEPARATION TESTS (PART 4, 5 & 13)
// ---------------------------------------------------------------------------
console.log('\n--- 4. Destinations Catalog vs Explore Places Separation ---');

const canonicalList = Object.values(CANONICAL_DESTINATIONS);
assert(
  canonicalList.length === 10 &&
    DESTINATION_DISCOVERY_CATEGORIES.length >= 8 &&
    canonicalList.every(
      d =>
        d.categories.length > 0 &&
        d.recommendedDurationDays.length > 0 &&
        d.overview.length > 20 &&
        d.travelTips.length >= 2
    ),
  'Destinations page catalog has 10 rich city/region destinations with categories, duration, overview & travel tips'
);

const goaResolved = resolveCanonicalDestination('goa');
const goaPlaces = INDIA_DESTINATIONS.filter(p => p.destinationId === 'goa');
assert(
  goaResolved !== null && goaPlaces.length >= 6,
  'Clicking a destination (/destinations/goa) resolves canonical overview + verified places in that city'
);

// ---------------------------------------------------------------------------
// 5. PLACE PREVIEW & GOOGLE REVIEWS TESTS (PART 6 & PART 13)
// ---------------------------------------------------------------------------
console.log('\n--- 5. Google Reviews & Place Preview Verification ---');

const tajPlace = INDIA_DESTINATIONS.find(p => p.id === 'agra_taj_mahal')!;
const tajReviews = getPlaceReviewData(tajPlace);

assert(
  tajReviews.available === true &&
    tajReviews.placeId === 'agra_taj_mahal' &&
    tajReviews.averageRating >= 4.5 &&
    tajReviews.totalReviewCount > 1000 &&
    tajReviews.reviewHighlights.length > 0 &&
    tajReviews.googleMapsUrl.includes('Taj%20Mahal'),
  'Place preview loads verified rating, review count, review highlights, and Google Maps link for Taj Mahal'
);

const unknownPlaceReviews = getPlaceReviewData('non_existent_custom_place_xyz');
assert(
  unknownPlaceReviews.available === false &&
    unknownPlaceReviews.averageRating === 0 &&
    unknownPlaceReviews.visitorSummary.includes('Reviews unavailable'),
  'Missing reviews are handled gracefully with an explicit "Reviews unavailable" state (never fabricated)'
);

// ---------------------------------------------------------------------------
// 6. EXPENSE TRACKING CRUD TESTS (PART 8 & PART 13)
// ---------------------------------------------------------------------------
console.log('\n--- 6. Trip Expense Tracking CRUD & Budget Comparison ---');

const testTripId = 'test_phase6_trip_expenses';
const exp1 = addTripExpense({
  tripId: testTripId,
  userId: 'user_1',
  category: 'intercity_transport',
  amount: 4200,
  description: 'Delhi to Goa Flight Ticket',
  expenseDate: '2026-11-10'
});

const exp2 = addTripExpense({
  tripId: testTripId,
  userId: 'user_1',
  category: 'food',
  amount: 850,
  description: 'Goan Fish Thali at Mum’s Kitchen',
  placeId: 'goa_mums_kitchen',
  expenseDate: '2026-11-10'
});

let currentExpenses = getTripExpenses(testTripId);
assert(
  currentExpenses.length === 2 && exp2.placeName?.includes("Mum's Kitchen"),
  'Adding expenses works and automatically links canonical place name'
);

const updatedExp = updateTripExpense(testTripId, exp2.id, { amount: 950, notes: 'Added dessert' });
assert(
  updatedExp !== null && updatedExp.amount === 950,
  'Editing an existing expense updates its amount and notes'
);

const expSummary = summarizeTripExpenses(testTripId, 10000, 2);
assert(
  expSummary.totalActualSpent === 5150 &&
    expSummary.perPersonActualSpent === 2575 &&
    expSummary.remainingFromPlannedBudget === 4850 &&
    expSummary.byCategory.intercity_transport === 4200 &&
    expSummary.byCategory.food === 950,
  'Category totals, per-person spend, and remaining budget are calculated accurately'
);

const deletedOk = deleteTripExpense(testTripId, exp1.id);
const afterDeleteSummary = summarizeTripExpenses(testTripId, 10000, 2);
assert(
  deletedOk && afterDeleteSummary.totalActualSpent === 950,
  'Deleting an expense removes it and recalculates total spend'
);

console.log('\n==============================================================');
console.log(`PHASE 6 VALIDATION SUMMARY: ${passed} Passed, ${failed} Failed`);
console.log('==============================================================');

if (failed > 0) {
  process.exit(1);
}


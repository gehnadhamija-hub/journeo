import { INDIA_DESTINATIONS } from '../data/indiaDestinations';
import { resolveCanonicalDestination } from '../data/canonicalDestinations';
import { haversineDistanceKm } from '../features/itinerary/services/itineraryOptimizer';

export type IntercityTransportMode =
  | 'flight'
  | 'train'
  | 'bus'
  | 'car'
  | 'cab'
  | 'other'
  | 'undecided';

export type BudgetStyleTier = 'budget' | 'moderate' | 'premium' | 'luxury';

export type ExpenseCategory =
  | 'intercity_transport'
  | 'accommodation'
  | 'local_transport'
  | 'food'
  | 'attractions'
  | 'shopping'
  | 'miscellaneous';

export interface IntercityTransportConfig {
  mode: IntercityTransportMode;
  originCity: string;
  destinationCity: string;
  departureDate: string;
  returnDate?: string;
  departureTime?: string; // e.g. "08:00"
  arrivalTimeDay1?: string; // e.g. "15:00"
  returnDepartureTime?: string; // e.g. "17:00"
  tripType: 'round_trip' | 'one_way';
  travellers: number;
  customEstimatedCostINR?: number;
  notes?: string;
}

export interface IntercityTransportEstimate {
  mode: IntercityTransportMode;
  modeLabel: string;
  originCity: string;
  destinationCity: string;
  approxDistanceKm: number;
  estimatedDurationHours: number;
  durationLabel: string;
  estimatedCostPerPersonINR: number;
  estimatedTotalCostINR: number;
  recommendedArrivalTimeDay1: string;
  recommendedSightseeingStartDay1: string;
  recommendedFinalDayCutoff: string;
  bookingReferenceUrl?: string;
  bookingPortalName?: string;
  isEstimate: boolean;
  advisoryNote: string;
}

export interface TripBudgetConfig {
  enabled: boolean;
  currency: 'INR' | 'USD' | 'EUR' | 'GBP';
  budgetScope: 'per_person' | 'total';
  amount: number; // in selected currency (default INR)
  travellers: number;
  tier: BudgetStyleTier;
  includeIntercityTransport: boolean;
  includeAccommodation: boolean;
  includeFoodAndActivities: boolean;
}

export interface EstimatedExpenseBreakdown {
  intercityTransport: number;
  accommodation: number;
  localTransport: number;
  food: number;
  attractions: number;
  miscellaneous: number;
  totalEstimated: number;
  perPersonEstimated: number;
}

export interface TripBudgetBreakdown {
  currency: string;
  travellers: number;
  totalBudget: number;
  perPersonBudget: number;
  estimatedExpenses: EstimatedExpenseBreakdown;
  remainingEstimatedBudget: number;
  isEstimatedOverBudget: boolean;
  overBudgetAmount: number;
  warnings: string[];
  savingSuggestions: string[];
}

export interface TripExpenseRecord {
  id: string;
  tripId: string;
  userId: string;
  category: ExpenseCategory;
  amount: number;
  currency: string;
  description: string;
  placeId?: string;
  placeName?: string;
  expenseDate: string;
  notes?: string;
  createdAt?: string;
}

export interface ActualExpenseSummary {
  totalActualSpent: number;
  perPersonActualSpent: number;
  byCategory: Record<ExpenseCategory, number>;
  byDate: Record<string, number>;
  remainingFromPlannedBudget: number;
  amountOverPlannedBudget: number;
  isActualOverBudget: boolean;
  records: TripExpenseRecord[];
}

// Known Indian origin city coordinates for realistic intercity distance calculation
const ORIGIN_CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  delhi: { lat: 28.6139, lng: 77.2090 },
  'new delhi': { lat: 28.6139, lng: 77.2090 },
  mumbai: { lat: 19.0760, lng: 72.8777 },
  bengaluru: { lat: 12.9716, lng: 77.5946 },
  bangalore: { lat: 12.9716, lng: 77.5946 },
  hyderabad: { lat: 17.3850, lng: 78.4867 },
  chennai: { lat: 13.0827, lng: 80.2707 },
  kolkata: { lat: 22.5726, lng: 88.3639 },
  pune: { lat: 18.5204, lng: 73.8567 },
  ahmedabad: { lat: 23.0225, lng: 72.5714 },
  jaipur: { lat: 26.9124, lng: 75.7873 },
  goa: { lat: 15.2993, lng: 74.1240 },
  agra: { lat: 27.1767, lng: 78.0081 },
  udaipur: { lat: 24.5854, lng: 73.7125 },
  varanasi: { lat: 25.3176, lng: 82.9739 },
  amritsar: { lat: 31.6340, lng: 74.8723 },
  rishikesh: { lat: 30.0869, lng: 78.2676 },
  kochi: { lat: 9.9312, lng: 76.2673 },
  chandigarh: { lat: 30.7333, lng: 76.7794 },
  lucknow: { lat: 26.8467, lng: 80.9462 }
};

export const POPULAR_ORIGIN_CITIES = [
  'Delhi',
  'Mumbai',
  'Bengaluru',
  'Hyderabad',
  'Chennai',
  'Kolkata',
  'Pune',
  'Ahmedabad',
  'Jaipur',
  'Chandigarh',
  'Lucknow',
  'Kochi'
];

function resolveCityCoords(cityName: string): { lat: number; lng: number } {
  const key = (cityName || '').trim().toLowerCase();
  if (ORIGIN_CITY_COORDS[key]) return ORIGIN_CITY_COORDS[key];
  const canon = resolveCanonicalDestination(cityName);
  if (canon) return canon.center;
  return { lat: 28.6139, lng: 77.2090 };
}

function addMinutesToTimeStr(timeStr: string, minutesToAdd: number): string {
  const parts = (timeStr || '09:00').split(':');
  const h = parseInt(parts[0], 10) || 9;
  const m = parseInt(parts[1], 10) || 0;
  const total = Math.min(22 * 60, Math.max(6 * 60, h * 60 + m + minutesToAdd));
  const outH = Math.floor(total / 60);
  const outM = total % 60;
  return `${String(outH).padStart(2, '0')}:${String(outM).padStart(2, '0')}`;
}

/**
 * Computes realistic intercity travel estimates (duration, approximate cost, Day 1 sightseeing start time,
 * and final day cutoff time) without fabricating specific flight/train numbers.
 */
export function estimateIntercityTransport(
  config: Partial<IntercityTransportConfig>
): IntercityTransportEstimate {
  const mode: IntercityTransportMode = config.mode || 'flight';
  const originCity = (config.originCity || 'Delhi').trim();
  const destinationCity = (config.destinationCity || 'Goa').trim();
  const travellers = Math.max(1, config.travellers || 2);
  const legMultiplier = config.tripType === 'one_way' ? 1 : 2;

  const sameCity = originCity.toLowerCase() === destinationCity.toLowerCase();
  const originCoords = resolveCityCoords(originCity);
  const destCoords = resolveCityCoords(destinationCity);
  const rawDistanceKm = sameCity
    ? 0
    : Math.max(40, Math.round(haversineDistanceKm(originCoords.lat, originCoords.lng, destCoords.lat, destCoords.lng) * 1.22));

  let modeLabel = 'Flight';
  let durationHours = 2.5;
  let oneWayPerPersonINR = 3800;
  let totalCostINR = 0;
  let defaultArrival = '12:30';
  let portalName = 'Skyscanner / MakeMyTrip Flights';
  let portalUrl = 'https://www.skyscanner.co.in/';
  let advisory = 'Includes ~60m airport transfer and hotel check-in buffer before Day 1 sightseeing.';

  if (sameCity) {
    modeLabel = 'Local Start (Same City)';
    durationHours = 0.5;
    oneWayPerPersonINR = 0;
    defaultArrival = '09:00';
    advisory = 'Starting directly within the destination city.';
  } else {
    switch (mode) {
      case 'flight':
        modeLabel = 'Flight (Economy Estimate)';
        durationHours = Math.round((1.5 + rawDistanceKm / 700) * 10) / 10;
        oneWayPerPersonINR = Math.round((2400 + rawDistanceKm * 2.1) / 100) * 100;
        totalCostINR = oneWayPerPersonINR * travellers * legMultiplier;
        defaultArrival = '13:00';
        portalName = 'Google Flights / MakeMyTrip';
        portalUrl = 'https://www.google.com/travel/flights';
        advisory = `Estimated ${durationHours}h flight + airport transfer. Sightseeing starts after check-in.`;
        break;
      case 'train':
        modeLabel = 'Indian Railways (AC 2-Tier / 3-Tier Estimate)';
        durationHours = Math.round((rawDistanceKm / 58) * 10) / 10;
        oneWayPerPersonINR = Math.round((650 + rawDistanceKm * 1.15) / 50) * 50;
        totalCostINR = oneWayPerPersonINR * travellers * legMultiplier;
        defaultArrival = durationHours > 10 ? '11:00' : '12:00';
        portalName = 'IRCTC Official Railways Portal';
        portalUrl = 'https://www.irctc.co.in/';
        advisory =
          durationHours > 10
            ? `Estimated ${durationHours}h overnight/long-distance rail journey. Includes rest & station transfer buffer on arrival.`
            : `Estimated ${durationHours}h intercity express train journey.`;
        break;
      case 'bus':
        modeLabel = 'Intercity AC Sleeper / Volvo Coach';
        durationHours = Math.round((rawDistanceKm / 48) * 10) / 10;
        oneWayPerPersonINR = Math.round((500 + rawDistanceKm * 1.35) / 50) * 50;
        totalCostINR = oneWayPerPersonINR * travellers * legMultiplier;
        defaultArrival = '11:30';
        portalName = 'redBus / State Transport';
        portalUrl = 'https://www.redbus.in/';
        advisory = `Estimated ${durationHours}h road coach journey with highway rest stops.`;
        break;
      case 'car':
        modeLabel = 'Self-Drive Car (Fuel & Highway Tolls Estimate)';
        durationHours = Math.round((rawDistanceKm / 52) * 10) / 10;
        // Vehicle cost shared across group
        const oneWayVehicleCost = Math.round((rawDistanceKm * 9.5) / 100) * 100;
        totalCostINR = oneWayVehicleCost * legMultiplier;
        oneWayPerPersonINR = Math.round(totalCostINR / travellers / legMultiplier);
        defaultArrival = durationHours > 7 ? '15:00' : '12:30';
        portalName = 'National Highways / Google Maps Route';
        portalUrl = 'https://www.google.com/maps';
        advisory = `Estimated ${durationHours}h drive (${rawDistanceKm} km) including highway meal/rest breaks.`;
        break;
      case 'cab':
        modeLabel = 'Outstation Private Cab / Taxi';
        durationHours = Math.round((rawDistanceKm / 52) * 10) / 10;
        const oneWayCabCost = Math.round((rawDistanceKm * 15.5) / 100) * 100;
        totalCostINR = oneWayCabCost * legMultiplier;
        oneWayPerPersonINR = Math.round(totalCostINR / travellers / legMultiplier);
        defaultArrival = durationHours > 7 ? '14:30' : '12:00';
        portalName = 'MakeMyTrip Cabs / Savaari';
        portalUrl = 'https://www.makemytrip.com/cabs/';
        advisory = `Estimated ${durationHours}h door-to-door outstation cab transfer.`;
        break;
      case 'other':
      case 'undecided':
      default:
        modeLabel = mode === 'other' ? 'Custom Intercity Transit' : 'Transport Not Decided Yet';
        durationHours = Math.round((rawDistanceKm / 65) * 10) / 10;
        oneWayPerPersonINR = mode === 'undecided' ? Math.round((1200 + rawDistanceKm * 1.5) / 100) * 100 : 1500;
        totalCostINR = oneWayPerPersonINR * travellers * legMultiplier;
        defaultArrival = '10:00';
        advisory = 'Flexible arrival schedule; update arrival time once tickets are confirmed.';
        break;
    }
  }

  if (typeof config.customEstimatedCostINR === 'number' && config.customEstimatedCostINR >= 0) {
    totalCostINR = config.customEstimatedCostINR;
    oneWayPerPersonINR = Math.round(totalCostINR / travellers / legMultiplier);
  }

  const arrivalTime = config.arrivalTimeDay1 && config.arrivalTimeDay1.trim()
    ? config.arrivalTimeDay1.trim()
    : defaultArrival;

  // Add 60 mins hotel check-in / freshen-up buffer if arriving from another city
  const sightseeingStartDay1 = sameCity
    ? arrivalTime
    : addMinutesToTimeStr(arrivalTime, mode === 'flight' ? 75 : 60);

  // On final day, stop sightseeing ~2.5 hours before return departure time
  const returnDep = config.returnDepartureTime && config.returnDepartureTime.trim()
    ? config.returnDepartureTime.trim()
    : '19:30';
  const finalDayCutoff = config.tripType === 'one_way'
    ? '19:00'
    : addMinutesToTimeStr(returnDep, mode === 'flight' ? -150 : -90);

  return {
    mode,
    modeLabel,
    originCity,
    destinationCity,
    approxDistanceKm: rawDistanceKm,
    estimatedDurationHours: durationHours,
    durationLabel: sameCity ? 'Local' : `~${durationHours} hrs each way`,
    estimatedCostPerPersonINR: Math.round(totalCostINR / travellers),
    estimatedTotalCostINR: totalCostINR,
    recommendedArrivalTimeDay1: arrivalTime,
    recommendedSightseeingStartDay1: sightseeingStartDay1,
    recommendedFinalDayCutoff: finalDayCutoff,
    bookingReferenceUrl: portalUrl,
    bookingPortalName: portalName,
    isEstimate: true,
    advisoryNote: advisory
  };
}

/**
 * Calculates a complete, transparent budget breakdown for a trip and connects with
 * actual stop entry fees, meal estimates, local transport, accommodation, and intercity transport.
 */
export function calculateTripBudgetBreakdown(params: {
  budgetConfig?: Partial<TripBudgetConfig>;
  intercityEstimate?: IntercityTransportEstimate;
  days: number;
  travellers: number;
  localTransportMode?: 'cab' | 'public' | 'walking' | 'bicycle';
  scheduledStops?: any[];
}): TripBudgetBreakdown {
  const travellers = Math.max(1, params.travellers || params.budgetConfig?.travellers || 2);
  const days = Math.max(1, params.days || 2);
  const tier: BudgetStyleTier = params.budgetConfig?.tier || 'moderate';
  const currency = params.budgetConfig?.currency || 'INR';
  const scope = params.budgetConfig?.budgetScope || 'total';
  const rawAmount = params.budgetConfig?.amount ?? 15000;

  const totalBudget = scope === 'per_person' ? rawAmount * travellers : rawAmount;
  const perPersonBudget = Math.round(totalBudget / travellers);

  const includeIntercity = params.budgetConfig?.includeIntercityTransport ?? true;
  const includeAccommodation = params.budgetConfig?.includeAccommodation ?? true;
  const includeFoodAndActivities = params.budgetConfig?.includeFoodAndActivities ?? true;

  // 1. Intercity transport estimate
  const intercityTransport = includeIntercity
    ? (params.intercityEstimate?.estimatedTotalCostINR ?? 0)
    : 0;

  // 2. Accommodation estimate (nights = Math.max(0, days - 1), rooms = ceil(travellers / 2))
  const nights = Math.max(0, days - 1);
  const rooms = Math.ceil(travellers / 2);
  const nightlyRatePerRoom: Record<BudgetStyleTier, number> = {
    budget: 1400,
    moderate: 2800,
    premium: 5500,
    luxury: 11000
  };
  const accommodation = includeAccommodation
    ? nights * rooms * nightlyRatePerRoom[tier]
    : 0;

  // 3. Local transport estimate
  const localMode = params.localTransportMode || 'cab';
  const dailyLocalPerGroup: Record<string, number> = {
    walking: 150,
    bicycle: 350 * travellers,
    public: 220 * travellers,
    cab: tier === 'budget' ? 950 : 1400
  };
  const localTransport = days * (dailyLocalPerGroup[localMode] || 1000);

  // 4. Food & Dining estimate
  const dailyFoodPerPerson: Record<BudgetStyleTier, number> = {
    budget: 450,
    moderate: 850,
    premium: 1600,
    luxury: 2800
  };
  let food = includeFoodAndActivities
    ? days * travellers * dailyFoodPerPerson[tier]
    : 0;

  // 5. Attractions & Entry tickets from actual scheduled stops when available
  let attractions = 0;
  if (includeFoodAndActivities) {
    if (params.scheduledStops && params.scheduledStops.length > 0) {
      let stopFeePerPerson = 0;
      let mealStopCostPerPerson = 0;
      for (const s of params.scheduledStops) {
        const fee = s.destination?.entryFeeINR ?? s.entryFeeINR ?? 0;
        stopFeePerPerson += fee;
        if (s.isMealStop || s.destination?.isMealStop) {
          mealStopCostPerPerson += s.averageCostINR ?? s.destination?.averageCostPerPersonINR ?? 300;
        }
      }
      attractions = stopFeePerPerson * travellers;
      if (mealStopCostPerPerson > 0) {
        food = Math.max(food, (mealStopCostPerPerson + (days * 250)) * travellers);
      }
    } else {
      attractions = days * travellers * (tier === 'budget' ? 120 : 300);
    }
  }

  // 6. Miscellaneous buffer (~6% of direct costs)
  const directSum = intercityTransport + accommodation + localTransport + food + attractions;
  const miscellaneous = Math.round((directSum * 0.06) / 50) * 50;

  const totalEstimated =
    intercityTransport + accommodation + localTransport + food + attractions + miscellaneous;
  const perPersonEstimated = Math.round(totalEstimated / travellers);

  const remainingEstimatedBudget = totalBudget - totalEstimated;
  const isEstimatedOverBudget = totalBudget > 0 && totalEstimated > totalBudget;
  const overBudgetAmount = isEstimatedOverBudget ? totalEstimated - totalBudget : 0;

  const warnings: string[] = [];
  const savingSuggestions: string[] = [];

  if (isEstimatedOverBudget) {
    warnings.push(
      `Estimated trip cost (₹${totalEstimated.toLocaleString('en-IN')}) exceeds your planned budget (₹${totalBudget.toLocaleString('en-IN')}) by ₹${overBudgetAmount.toLocaleString('en-IN')}.`
    );
    if (params.intercityEstimate?.mode === 'flight' && intercityTransport > totalBudget * 0.35) {
      savingSuggestions.push(
        'Switch intercity transport from Flight to Indian Railways (AC Train) or AC Coach to save 55–70% on transit.'
      );
    }
    if (localMode === 'cab') {
      savingSuggestions.push(
        'Use Public Metro/Bus or Walking for clustered Old City stops instead of full-day private cabs.'
      );
    }
    if (tier !== 'budget') {
      savingSuggestions.push(
        'Switch Budget Style to "Budget" to prioritize free heritage ghats, public gardens, and authentic street-food eateries.'
      );
    }
    if (attractions > 500 * travellers) {
      savingSuggestions.push(
        'Replace high-ticket monuments with free architectural precincts, temples, beaches, and promenade walks.'
      );
    }
  }

  return {
    currency,
    travellers,
    totalBudget,
    perPersonBudget,
    estimatedExpenses: {
      intercityTransport,
      accommodation,
      localTransport,
      food,
      attractions,
      miscellaneous,
      totalEstimated,
      perPersonEstimated
    },
    remainingEstimatedBudget,
    isEstimatedOverBudget,
    overBudgetAmount,
    warnings,
    savingSuggestions
  };
}

// ============================================================================
// ACTUAL TRIP EXPENSE TRACKING CRUD SERVICE (PART 8)
// ============================================================================

const EXPENSE_STORAGE_PREFIX = 'journeo_trip_expenses_';

function getExpenseStorageKey(tripId: string): string {
  return `${EXPENSE_STORAGE_PREFIX}${tripId || 'active-trip'}`;
}

export function getTripExpenses(tripId: string, userId?: string): TripExpenseRecord[] {
  if (typeof localStorage === 'undefined' || !tripId) return [];
  try {
    const raw = localStorage.getItem(getExpenseStorageKey(tripId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((r: TripExpenseRecord) => !userId || !r.userId || r.userId === userId);
  } catch {
    return [];
  }
}

export function addTripExpense(input: {
  tripId: string;
  userId: string;
  category: ExpenseCategory;
  amount: number;
  currency?: string;
  description: string;
  placeId?: string;
  placeName?: string;
  expenseDate?: string;
  notes?: string;
}): TripExpenseRecord {
  const tripId = input.tripId || 'active-trip';
  const existing = getTripExpenses(tripId);
  const amount = Math.max(0, Number(input.amount) || 0);

  let placeName = input.placeName;
  if (input.placeId && !placeName) {
    const match = INDIA_DESTINATIONS.find(d => d.id === input.placeId);
    if (match) placeName = match.name;
  }

  const newRecord: TripExpenseRecord = {
    id: `exp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    tripId,
    userId: input.userId || 'guest',
    category: input.category,
    amount,
    currency: input.currency || 'INR',
    description: (input.description || 'Trip Expense').trim(),
    placeId: input.placeId,
    placeName,
    expenseDate: input.expenseDate || new Date().toISOString().split('T')[0],
    notes: input.notes || '',
    createdAt: new Date().toISOString()
  };

  const updated = [newRecord, ...existing];
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(getExpenseStorageKey(tripId), JSON.stringify(updated));
  }
  return newRecord;
}

export function updateTripExpense(
  tripId: string,
  expenseId: string,
  updates: Partial<Omit<TripExpenseRecord, 'id' | 'tripId'>>
): TripExpenseRecord | null {
  const existing = getTripExpenses(tripId);
  const idx = existing.findIndex(e => e.id === expenseId);
  if (idx === -1) return null;

  const updatedRecord: TripExpenseRecord = {
    ...existing[idx],
    ...updates,
    amount: updates.amount !== undefined ? Math.max(0, Number(updates.amount) || 0) : existing[idx].amount
  };
  existing[idx] = updatedRecord;

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(getExpenseStorageKey(tripId), JSON.stringify(existing));
  }
  return updatedRecord;
}

export function deleteTripExpense(tripId: string, expenseId: string): boolean {
  const existing = getTripExpenses(tripId);
  const filtered = existing.filter(e => e.id !== expenseId);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(getExpenseStorageKey(tripId), JSON.stringify(filtered));
  }
  return filtered.length < existing.length;
}

export function summarizeTripExpenses(
  tripId: string,
  plannedTotalBudget: number = 15000,
  travellers: number = 2,
  userId?: string
): ActualExpenseSummary {
  const records = getTripExpenses(tripId, userId);
  const byCategory: Record<ExpenseCategory, number> = {
    intercity_transport: 0,
    accommodation: 0,
    local_transport: 0,
    food: 0,
    attractions: 0,
    shopping: 0,
    miscellaneous: 0
  };
  const byDate: Record<string, number> = {};
  let totalActualSpent = 0;

  for (const r of records) {
    const amt = Number(r.amount) || 0;
    totalActualSpent += amt;
    const cat = r.category in byCategory ? r.category : 'miscellaneous';
    byCategory[cat] += amt;
    const d = r.expenseDate || 'Unspecified';
    byDate[d] = (byDate[d] || 0) + amt;
  }

  const groupCount = Math.max(1, travellers);
  const perPersonActualSpent = Math.round(totalActualSpent / groupCount);
  const remainingFromPlannedBudget = plannedTotalBudget - totalActualSpent;
  const isActualOverBudget = plannedTotalBudget > 0 && totalActualSpent > plannedTotalBudget;
  const amountOverPlannedBudget = isActualOverBudget ? totalActualSpent - plannedTotalBudget : 0;

  return {
    totalActualSpent,
    perPersonActualSpent,
    byCategory,
    byDate,
    remainingFromPlannedBudget,
    amountOverPlannedBudget,
    isActualOverBudget,
    records
  };
}


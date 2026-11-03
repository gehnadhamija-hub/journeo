import { IndiaDestination, INDIA_DESTINATIONS } from '../../../data/indiaDestinations';
import { queryPlacesByDestination } from '../../../services/placeDatabaseService';
import {
  CanonicalDestination,
  resolveCanonicalDestination,
  isCoordinateWithinDestination
} from '../../../data/canonicalDestinations';
import {
  IntercityTransportConfig,
  IntercityTransportEstimate,
  TripBudgetConfig,
  TripBudgetBreakdown,
  estimateIntercityTransport,
  calculateTripBudgetBreakdown
} from '../../../services/expenseService';

export interface TripOptimizationRequest {
  destination: string;
  canonicalDestination?: CanonicalDestination;
  originCity?: string;
  startDate?: string;
  endDate?: string;
  days?: number; // Supports 1 to 30+ days
  availableHoursPerDay?: number; // default 8
  startTime?: string; // default "09:00"
  selectedInterests?: string[];
  freeTextInstructions?: string;
  travelPace?: 'relaxed' | 'balanced' | 'packed';
  crowdPreference?: 'popular' | 'balanced' | 'avoid_crowded';
  discoveryPreference?: 'popular' | 'balanced' | 'hidden_gems';
  indoorOutdoorPreference?: 'any' | 'indoor' | 'outdoor';
  walkingTolerance?: 'low' | 'moderate' | 'high';
  excludedCategories?: string[];
  experienceTypes?: string[];
  budget?: number;
  travellers?: number;
  intercityTransport?: Partial<IntercityTransportConfig>;
  budgetConfig?: Partial<TripBudgetConfig>;
  transportMode?: 'cab' | 'public' | 'walking' | 'bicycle';
  startingLocation?: {
    lat: number;
    lng: number;
    address?: string;
  };
  endingLocation?: {
    lat: number;
    lng: number;
    address?: string;
  };
  accessibilityRequirements?: string[];
  dietaryPreference?: 'all' | 'vegetarian' | 'vegan' | 'halal';
  foodStyle?: string; // e.g. "street_food", "local_cuisine", "cafes", "fine_dining"
  foodAllergies?: string;
  mustVisitPlaceIds?: string[];
  excludedPlaceIds?: string[];
  candidatePool?: IndiaDestination[];
  seedVariation?: number; // Seed to explore alternative valid combinations
}

export interface ItineraryStopOutput {
  id: string;
  placeId: string;
  providerPlaceId?: string;
  name: string;
  city: string;
  category: string;
  subcategory?: string;
  startTime: string; // e.g. "09:30"
  endTime: string;   // e.g. "11:30"
  plannedArrival: string; // compatibility with existing components
  plannedDeparture: string;
  visitDurationMinutes: number;
  visitDuration: number;
  travelFromPreviousMinutes: number;
  transitMinutes: number;
  distanceFromPreviousKm: number;
  distanceFromPrevKm: number;
  recommendedTransitMode?: 'walking' | 'cab' | 'public' | 'bicycle';
  transitInstruction: string;
  isMustVisit: boolean;
  visitStatus: 'PENDING' | 'VISITED' | 'SKIPPED';
  actualVisitTime?: string;
  visitedAtISO?: string;
  estimated: boolean;
  reasonForSelection: string;
  personalizationScore?: number;
  destination: IndiaDestination;
  coordinates: {
    lat: number;
    lng: number;
  };
  sequenceNumber: number;
  // Food & Cafe Integration
  isMealStop?: boolean;
  mealType?: 'breakfast' | 'lunch' | 'cafe' | 'dinner';
  cuisineType?: string;
  dietarySuitability?: string;
  averageCostINR?: number;
}

export interface ItineraryDayOutput {
  dayNumber: number;
  date?: string;
  title: string;
  area: string;
  stops: ItineraryStopOutput[];
  totalTravelMinutes: number;
  totalVisitMinutes: number;
  freeTimeMinutes: number;
  dayDistanceKm: number;
  dayType?: 'arrival' | 'sightseeing' | 'neighborhood_discovery' | 'departure';
  dayAdvisory?: string;
  dayPace?: 'relaxed' | 'balanced' | 'packed';
}

export interface OptimizationMetrics {
  diversityScore: number;
  routeEfficiencyScore: number;
  scheduleFeasibilityScore: number;
  personalizationAlignmentScore?: number;
  overallScore: number;
}

export interface ItineraryValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface OptimizedItineraryResponse {
  tripId: string;
  title: string;
  destination: string;
  destinationCity: string;
  canonicalDestination: CanonicalDestination;
  tripConfig: any;
  intercitySummary?: IntercityTransportEstimate;
  budgetBreakdown?: TripBudgetBreakdown;
  days: ItineraryDayOutput[];
  stops: ItineraryStopOutput[]; // flattened for timeline/map backwards compatibility
  plan: {
    optimizationScore: number;
    totalDistanceKm: number;
    totalDurationMin: number;
    scheduledStops: ItineraryStopOutput[];
    days: ItineraryDayOutput[];
  };
  optimization: OptimizationMetrics;
  validation?: ItineraryValidationResult;
  explanation?: string;
}

// ============================================================================
// GEOGRAPHIC & ROUTE DISTANCE UTILITIES
// ============================================================================

export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's mean radius in km
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

/**
 * Recommends the most realistic local transport mode for a specific leg based on
 * leg distance, user's walking tolerance, accessibility requirements, and preferred mode.
 */
export function selectLegTransportMode(
  distanceKm: number,
  preferredMode: 'cab' | 'public' | 'walking' | 'bicycle' = 'cab',
  walkingTolerance: 'low' | 'moderate' | 'high' = 'moderate',
  accessibilityRequirements: string[] = []
): 'cab' | 'public' | 'walking' | 'bicycle' {
  const needsWheelchairOrLowWalk =
    walkingTolerance === 'low' ||
    accessibilityRequirements.some(r =>
      r.toLowerCase().includes('wheelchair') ||
      r.toLowerCase().includes('elderly') ||
      r.toLowerCase().includes('step-free')
    );

  if (needsWheelchairOrLowWalk) {
    if (distanceKm <= 0.35) return 'walking';
    return preferredMode === 'public' ? 'public' : 'cab';
  }

  const maxWalkKm = walkingTolerance === 'high' ? 1.8 : 1.2;
  if (distanceKm <= maxWalkKm) {
    return 'walking';
  }

  if (preferredMode === 'walking' && distanceKm > 2.5) {
    // Realistic fallback when a leg exceeds reasonable urban walking distance
    return 'cab';
  }

  return preferredMode || 'cab';
}

export function calculateTransitDuration(
  distanceKm: number,
  transportMode: 'cab' | 'public' | 'walking' | 'bicycle' = 'cab'
): number {
  if (distanceKm <= 0.1) return 4;

  let avgSpeedKmh = 22;
  let baseBufferMin = 6;

  switch (transportMode) {
    case 'walking':
      avgSpeedKmh = 4.5;
      baseBufferMin = 2;
      break;
    case 'bicycle':
      avgSpeedKmh = 12;
      baseBufferMin = 3;
      break;
    case 'public':
      avgSpeedKmh = 18;
      baseBufferMin = 10; // transfer & platform wait time
      break;
    case 'cab':
    default:
      avgSpeedKmh = 22;
      baseBufferMin = 6;
      break;
  }

  const travelTimeMinutes = Math.round((distanceKm / avgSpeedKmh) * 60) + baseBufferMin;
  return Math.max(5, travelTimeMinutes);
}

export function parseTimeToMinutes(timeStr?: string): number {
  if (!timeStr) return 9 * 60; // 09:00 default
  const parts = timeStr.trim().split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

export function formatMinutesToTime(totalMinutes: number): string {
  const normalized = Math.max(0, Math.round(totalMinutes)) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function addDaysToDateStr(baseDateStr?: string, daysOffset: number = 0): string {
  const base = baseDateStr && /^\d{4}-\d{2}-\d{2}/.test(baseDateStr)
    ? new Date(`${baseDateStr.slice(0, 10)}T00:00:00Z`)
    : new Date();
  if (isNaN(base.getTime())) {
    const fallback = new Date();
    fallback.setUTCDate(fallback.getUTCDate() + daysOffset);
    return fallback.toISOString().split('T')[0];
  }
  base.setUTCDate(base.getUTCDate() + daysOffset);
  return base.toISOString().split('T')[0];
}

export function parseOpeningHours(hoursStr?: string): { openMin: number; closeMin: number; closedDays: string[] } {
  const defaultHours = { openMin: 6 * 60, closeMin: 19 * 60, closedDays: [] as string[] };
  if (!hoursStr) return defaultHours;

  const lower = hoursStr.toLowerCase();
  if (lower.includes('24 hour') || lower.includes('open daily')) {
    const match = hoursStr.match(/(\d{1,2}):?(\d{2})?\s*-\s*(\d{1,2}):?(\d{2})?/);
    if (!match) {
      return { openMin: 5 * 60, closeMin: 23 * 60, closedDays: [] };
    }
  }

  const closedDays: string[] = [];
  ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].forEach(day => {
    if (lower.includes(`closed ${day}`)) {
      closedDays.push(day);
    }
  });

  const match = hoursStr.match(/(\d{1,2}):?(\d{2})?\s*-\s*(\d{1,2}):?(\d{2})?/);
  if (match) {
    const openH = parseInt(match[1], 10);
    const openM = match[2] ? parseInt(match[2], 10) : 0;
    const closeH = parseInt(match[3], 10);
    const closeM = match[4] ? parseInt(match[4], 10) : 0;

    const openMin = openH * 60 + openM;
    let closeMin = closeH * 60 + closeM;
    if (closeH <= 12 && closeH < openH) {
      closeMin += 12 * 60;
    }
    return { openMin, closeMin, closedDays };
  }

  return defaultHours;
}

// ============================================================================
// STAGE 1: NLP FREE-TEXT PARSER & STRUCTURED PREFERENCE EXTRACTOR
// ============================================================================

export interface ParsedNLPPreferences {
  boostCategories: string[];
  penalizeCategories: string[];
  excludedSubcategories: string[];
  preferredKeywords: string[];
  avoidKeywords: string[];
  experienceTypes: string[];
  suggestedPace?: 'relaxed' | 'balanced' | 'packed';
  crowdPreference?: 'popular' | 'balanced' | 'avoid_crowded';
  discoveryPreference?: 'popular' | 'balanced' | 'hidden_gems';
  indoorOutdoorPreference?: 'any' | 'indoor' | 'outdoor';
  sunsetPriority: boolean;
  hiddenGemPriority: boolean;
  foodPriority: boolean;
  shoppingPriority: boolean;
  naturePriority: boolean;
  historyPriority: boolean;
  photographyPriority: boolean;
  crowdAvoidance: boolean;
  explanation: string;
}

export function parseFreeTextPreferences(text?: string): ParsedNLPPreferences {
  const result: ParsedNLPPreferences = {
    boostCategories: [],
    penalizeCategories: [],
    excludedSubcategories: [],
    preferredKeywords: [],
    avoidKeywords: [],
    experienceTypes: [],
    sunsetPriority: false,
    hiddenGemPriority: false,
    foodPriority: false,
    shoppingPriority: false,
    naturePriority: false,
    historyPriority: false,
    photographyPriority: false,
    crowdAvoidance: false,
    explanation: ''
  };

  if (!text || typeof text !== 'string' || !text.trim()) {
    result.explanation = 'Tailored to your selected interest tags and travel pace.';
    return result;
  }

  const lower = text.toLowerCase();
  const matchedSignals: string[] = [];

  // 1. Pacing detection
  if (
    lower.includes('relax') ||
    lower.includes('slow') ||
    lower.includes('unhurried') ||
    lower.includes('chill') ||
    lower.includes('peaceful') ||
    lower.includes('leisure') ||
    lower.includes('easy pace') ||
    lower.includes('fewer stops')
  ) {
    result.suggestedPace = 'relaxed';
    matchedSignals.push('relaxed unhurried pace');
  } else if (
    lower.includes('packed') ||
    lower.includes('fast') ||
    lower.includes('high energy') ||
    lower.includes('see everything') ||
    lower.includes('maximum sights') ||
    lower.includes('action-packed')
  ) {
    result.suggestedPace = 'packed';
    matchedSignals.push('packed high-density schedule');
  }

  // 2. Negative / Exclusion signals (must check before positive matches!)
  const museumNegative =
    /(?:not|no|don't|dont|avoid|skip|without|dislike|hate|less)\s+(?:particularly\s+)?(?:interested\s+in\s+|like\s+|want\s+)?(?:any\s+)?museums?/i.test(lower) ||
    lower.includes('no museums') ||
    lower.includes('avoid museums') ||
    lower.includes('skip museums');

  if (museumNegative) {
    result.excludedSubcategories.push('Museum');
    result.avoidKeywords.push('museum', 'gallery');
    matchedSignals.push('excluding museums');
  }

  const monumentNegative =
    /(?:not|no|don't|dont|avoid|skip|without|tired of)\s+(?:particularly\s+)?(?:interested\s+in\s+|want\s+|spend\s+the\s+entire\s+day\s+in\s+)?(?:generic\s+|crowded\s+|major\s+)?(?:monuments?|forts?|sightseeing|tourist\s+areas?|tourist\s+traps?)/i.test(lower);
  if (monumentNegative) {
    result.penalizeCategories.push('Heritage');
    result.avoidKeywords.push('citadel', 'mausoleum');
    matchedSignals.push('de-emphasizing heavy monument sightseeing');
  }

  const shoppingNegative =
    /(?:no|avoid|skip|not interested in|don't want)\s+(?:any\s+)?(?:shopping|markets?|bazaars?)/i.test(lower);
  if (shoppingNegative) {
    result.penalizeCategories.push('Shopping');
    result.avoidKeywords.push('shopping', 'bazaar', 'market');
    matchedSignals.push('skipping shopping stops');
  }

  const nightlifeNegative =
    /(?:no|avoid|skip|not interested in)\s+(?:nightlife|clubs?|bars?|partying)/i.test(lower);
  if (nightlifeNegative) {
    result.avoidKeywords.push('nightlife', 'club', 'party');
    matchedSignals.push('avoiding nightlife');
  }

  const cafeNegative =
    /(?:no|avoid|skip|without|exclude|don't\s+want|dont\s+want|dislike)\s+(?:any\s+)?(?:cafes?|coffee\s+shops?|coffee\s+houses?)/i.test(lower) ||
    lower.includes('no cafes') ||
    lower.includes('avoid cafes') ||
    lower.includes('exclude cafes');
  if (cafeNegative) {
    result.excludedSubcategories.push('Cafe', 'Cafes');
    result.avoidKeywords.push('cafe', 'coffee house', 'roastery');
    matchedSignals.push('excluding cafes');
  }

  // 3. Crowd avoidance & Hidden gems detection
  if (
    lower.includes('avoid crowd') ||
    lower.includes('no crowd') ||
    lower.includes('crowded tourist') ||
    lower.includes('don\'t want to spend') && lower.includes('crowded') ||
    lower.includes('dont want to spend') && lower.includes('crowded') ||
    lower.includes('less touristy') ||
    lower.includes('not touristy') ||
    lower.includes('uncrowded') ||
    lower.includes('quiet') ||
    lower.includes('peaceful') ||
    lower.includes('away from crowds')
  ) {
    result.crowdAvoidance = true;
    result.crowdPreference = 'avoid_crowded';
    matchedSignals.push('avoiding crowded tourist areas');
  }

  if (
    lower.includes('hidden gem') ||
    lower.includes('offbeat') ||
    lower.includes('off the beaten') ||
    lower.includes('secret') ||
    lower.includes('lesser-known') ||
    lower.includes('lesser known') ||
    lower.includes('stepwell') ||
    lower.includes('unusual')
  ) {
    result.hiddenGemPriority = true;
    result.discoveryPreference = 'hidden_gems';
    result.experienceTypes.push('hidden_gems', 'offbeat');
    result.preferredKeywords.push('stepwell', 'hidden', 'offbeat', 'quiet', 'serene', 'island', 'ruins');
    matchedSignals.push('hidden gems & offbeat spots');
  }

  // 4. Positive Category & Experience Matching
  // Food / Street Food / Cafes / Culinary
  if (
    !cafeNegative &&
    (lower.includes('food') ||
      lower.includes('street food') ||
      lower.includes('culinary') ||
      lower.includes('cafe') ||
      lower.includes('coffee') ||
      lower.includes('bakery') ||
      lower.includes('chai') ||
      lower.includes('thali') ||
      lower.includes('chaat') ||
      lower.includes('paratha') ||
      lower.includes('eater') ||
      lower.includes('dining'))
  ) {
    result.boostCategories.push('Food');
    result.foodPriority = true;
    result.experienceTypes.push('street_food', 'cafes', 'local_cuisine', 'food_walk');
    result.preferredKeywords.push('food', 'cafe', 'chaat', 'paratha', 'culinary', 'bakery', 'sweet', 'spice', 'kitchen', 'breakfast', 'lunch');
    matchedSignals.push('street food, cafes & local culinary discovery');
  }

  // Shopping / Markets / Bazaars / Crafts
  if (
    !shoppingNegative &&
    (lower.includes('market') ||
      lower.includes('bazaar') ||
      lower.includes('shopping') ||
      lower.includes('haat') ||
      lower.includes('craft') ||
      lower.includes('handicraft') ||
      lower.includes('textile') ||
      lower.includes('souvenir') ||
      lower.includes('lanes'))
  ) {
    result.boostCategories.push('Shopping', 'Culture');
    result.shoppingPriority = true;
    result.experienceTypes.push('shopping', 'markets', 'bazaars', 'local_culture');
    result.preferredKeywords.push('bazaar', 'market', 'haat', 'craft', 'shopping', 'textile', 'jewelry', 'spice', 'lanes');
    matchedSignals.push('local markets, bazaars & craft shopping');
  }

  // Heritage / History / Architecture
  if (
    !monumentNegative &&
    (lower.includes('history') ||
      lower.includes('historical') ||
      lower.includes('heritage') ||
      lower.includes('architecture') ||
      lower.includes('fort') ||
      lower.includes('palace') ||
      lower.includes('monument') ||
      lower.includes('mughal') ||
      lower.includes('unesco') ||
      lower.includes('ancient'))
  ) {
    result.boostCategories.push('Heritage');
    result.historyPriority = true;
    result.experienceTypes.push('history', 'architecture', 'heritage');
    result.preferredKeywords.push('fort', 'palace', 'tomb', 'architecture', 'mughal', 'unesco', 'citadel', 'monument', 'stepwell');
    matchedSignals.push('historical monuments & architectural heritage');
  }

  // Nature / Gardens / Lakes / Peaceful
  if (
    lower.includes('nature') ||
    lower.includes('garden') ||
    lower.includes('park') ||
    lower.includes('lake') ||
    lower.includes('beach') ||
    lower.includes('forest') ||
    lower.includes('scenic') ||
    lower.includes('green') ||
    lower.includes('peaceful') ||
    lower.includes('waterfront') ||
    lower.includes('bird') ||
    lower.includes('sunset')
  ) {
    result.boostCategories.push('Nature');
    result.naturePriority = true;
    result.experienceTypes.push('nature', 'peaceful', 'gardens', 'scenic');
    result.preferredKeywords.push('garden', 'park', 'lake', 'beach', 'nature', 'trees', 'promenade', 'peaceful', 'serene', 'sunset', 'island');
    matchedSignals.push('nature, gardens & peaceful landscapes');
  }

  // Sunset / Golden Hour / Photography
  if (
    lower.includes('sunset') ||
    lower.includes('golden hour') ||
    lower.includes('viewpoint') ||
    lower.includes('panorama')
  ) {
    result.sunsetPriority = true;
    result.preferredKeywords.push('sunset', 'panorama', 'viewpoint', 'vista');
  }

  if (
    lower.includes('photo') ||
    lower.includes('instagram') ||
    lower.includes('aesthetic') ||
    lower.includes('visual') ||
    lower.includes('art')
  ) {
    result.photographyPriority = true;
    result.experienceTypes.push('photography', 'aesthetic', 'art');
    result.preferredKeywords.push('photography', 'symmetry', 'arches', 'mural', 'gallery', 'panoramic', 'stepwell', 'colorful');
    matchedSignals.push('photography & visual aesthetics');
  }

  // Spiritual / Temples / Ghats
  if (
    lower.includes('temple') ||
    lower.includes('spiritual') ||
    lower.includes('aarti') ||
    lower.includes('ghat') ||
    lower.includes('ashram') ||
    lower.includes('yoga') ||
    lower.includes('sacred') ||
    lower.includes('shrine')
  ) {
    result.boostCategories.push('Spiritual');
    result.experienceTypes.push('spiritual', 'temples');
    result.preferredKeywords.push('temple', 'ghat', 'aarti', 'spiritual', 'shrine', 'sacred', 'ashram', 'gurudwara', 'mosque');
    matchedSignals.push('spiritual & sacred sites');
  }

  // Indoor / Outdoor detection
  if (lower.includes('indoor') || lower.includes('air conditioned') || lower.includes('escape the heat')) {
    result.indoorOutdoorPreference = 'indoor';
  } else if (lower.includes('outdoor') || lower.includes('open air') || lower.includes('outside')) {
    result.indoorOutdoorPreference = 'outdoor';
  }

  result.explanation =
    matchedSignals.length > 0
      ? `Personalized for: ${matchedSignals.join('; ')}.`
      : 'Customized route based on your selected preferences.';

  return result;
}

// ============================================================================
// STAGE 2: MULTI-FACTOR PERSONALIZED CANDIDATE SCORING
// ============================================================================

export interface ScoredCandidate {
  place: IndiaDestination;
  totalScore: number;
  // Phase 8 Explicit 5-Signal Ranking Separation
  providerRating: number;
  popularityScore: number;
  relevanceScore: number;
  scheduleSuitability: number;
  dataConfidence: number;
  breakdown: {
    interestMatch: number;
    experienceMatch: number;
    freeTextMatch: number;
    crowdAndNoveltyMatch: number;
    qualityWeight: number;
    diversityContribution: number;
    geographicScore: number;
    dietaryBonus: number;
    budgetBonus: number;
  };
  selectionReason: string;
}

/**
 * Helper to determine if the user's profile strongly requests culinary/food/cafe/market stops
 * as primary itinerary experiences rather than only a single midday lunch break.
 */
export function isFoodOrMarketCentricRequest(
  request: TripOptimizationRequest,
  nlp: ParsedNLPPreferences
): { foodCentric: boolean; marketCentric: boolean } {
  const interestsLower = (request.selectedInterests || []).map(i => i.toLowerCase());
  const expLower = (request.experienceTypes || []).map(e => e.toLowerCase());
  const foodStyle = (request.foodStyle || '').toLowerCase();

  const foodCentric =
    nlp.foodPriority ||
    foodStyle === 'street_food' ||
    foodStyle === 'cafes' ||
    foodStyle === 'local_cuisine' ||
    interestsLower.some(
      i =>
        i.includes('food') ||
        i.includes('culinary') ||
        i.includes('cafe') ||
        i.includes('street food') ||
        i.includes('gastronomy')
    ) ||
    expLower.some(e => e.includes('food') || e.includes('cafe') || e.includes('culinary'));

  const marketCentric =
    nlp.shoppingPriority ||
    interestsLower.some(
      i =>
        i.includes('shopping') ||
        i.includes('market') ||
        i.includes('bazaar') ||
        i.includes('local experiences') ||
        i.includes('craft')
    ) ||
    expLower.some(e => e.includes('shopping') || e.includes('market') || e.includes('bazaar'));

  return { foodCentric, marketCentric };
}

export function scoreCandidatePlaces(
  candidates: IndiaDestination[],
  request: TripOptimizationRequest,
  nlp: ParsedNLPPreferences,
  seed = 0
): ScoredCandidate[] {
  const interests = (request.selectedInterests || []).map(i => i.toLowerCase());
  const requestedExperiences = [
    ...(request.experienceTypes || []).map(e => e.toLowerCase()),
    ...nlp.experienceTypes.map(e => e.toLowerCase())
  ];

  const effectiveCrowdPref =
    request.crowdPreference ||
    nlp.crowdPreference ||
    (nlp.crowdAvoidance ? 'avoid_crowded' : 'balanced');

  const effectiveDiscoveryPref =
    request.discoveryPreference ||
    nlp.discoveryPreference ||
    (nlp.hiddenGemPriority ? 'hidden_gems' : 'balanced');

  const effectiveIndoorOutdoor =
    request.indoorOutdoorPreference || nlp.indoorOutdoorPreference || 'any';

  const startLat = request.startingLocation?.lat || candidates[0]?.latitude || 28.6;
  const startLng = request.startingLocation?.lng || candidates[0]?.longitude || 77.2;

  const isLowBudget =
    request.budgetConfig?.tier === 'budget' ||
    (typeof request.budget === 'number' && request.budget > 0 && request.budget <= 8000) ||
    (request.budgetConfig?.enabled && (request.budgetConfig?.amount || 0) <= 8000);

  const isHistoryFocused =
    (nlp.historyPriority ||
      interests.some(i => i.includes('history') || i.includes('heritage') || i.includes('architecture')) ||
      requestedExperiences.some(
        e => e.includes('history') || e.includes('architecture') || e.includes('monument') || e.includes('unesco')
      )) &&
    !nlp.foodPriority &&
    !nlp.naturePriority &&
    !interests.some(i => i.includes('food') || i.includes('nature'));

  const isFoodFocused =
    nlp.foodPriority ||
    Boolean(request.foodStyle) ||
    interests.some(i => i.includes('food') || i.includes('cafe') || i.includes('culinary')) ||
    requestedExperiences.some(
      e => e.includes('food') || e.includes('cafe') || e.includes('bakery') || e.includes('dining')
    );

  const isNatureFocused =
    (nlp.naturePriority ||
      interests.some(i => i.includes('nature') || i.includes('garden') || i.includes('wildlife') || i.includes('eco')) ||
      requestedExperiences.some(e => e.includes('nature') || e.includes('park') || e.includes('garden'))) &&
    !nlp.historyPriority &&
    !nlp.foodPriority &&
    !interests.some(i => i.includes('history') || i.includes('food'));

  return candidates.map(place => {
    const placeTagsLower = place.interestTags.map(t => t.toLowerCase());
    const placeExpLower = (place.enrichment?.experienceTypes || []).map(e => e.toLowerCase());
    const placeSubcatLower = (place.subcategory || '').toLowerCase();
    const placeText = `${place.name} ${place.subcategory || ''} ${place.description} ${place.highlights.join(' ')} ${place.interestTags.join(' ')}`.toLowerCase();
    const placeCrowdLevel =
      place.enrichment?.crowdLevel || (place.isMustVisit ? 'high_popular' : 'moderate');

    let interestMatch = 0;
    let experienceMatch = 0;
    let freeTextMatch = 0;
    let crowdAndNoveltyMatch = 0;
    let reasonCandidates: { score: number; text: string }[] = [];

    // 1. Explicit Category & Interest Tag Matching (Strong Primary Signal)
    const matchedInterests: string[] = [];
    for (const userInt of interests) {
      // Do not give high_popular places a positive match on 'photography' when the user explicitly asked to avoid crowds
      if (
        (effectiveCrowdPref === 'avoid_crowded' || effectiveDiscoveryPref === 'hidden_gems') &&
        placeCrowdLevel === 'high_popular' &&
        (userInt.includes('photo') || userInt.includes('hidden'))
      ) {
        continue;
      }

      if (
        userInt.includes(place.category.toLowerCase()) ||
        place.category.toLowerCase().includes(userInt) ||
        placeExpLower.some(e => e.includes(userInt) || userInt.includes(e)) ||
        (userInt.includes('history') && place.category === 'Heritage') ||
        (userInt.includes('architecture') && place.category === 'Heritage') ||
        (userInt.includes('nature') && place.category === 'Nature') ||
        (userInt.includes('peaceful') && (place.category === 'Nature' || placeCrowdLevel === 'low_offbeat')) ||
        (userInt.includes('food') && (place.category === 'Food' || place.isMealStop)) ||
        (userInt.includes('cafe') && (placeSubcatLower.includes('cafe') || placeText.includes('cafe'))) ||
        (userInt.includes('shopping') && (place.category === 'Shopping' || placeSubcatLower.includes('market') || placeSubcatLower.includes('bazaar'))) ||
        (userInt.includes('market') && (place.category === 'Shopping' || placeText.includes('market') || placeText.includes('bazaar'))) ||
        (userInt.includes('hidden') && (placeCrowdLevel === 'low_offbeat' || placeTagsLower.includes('hidden gems'))) ||
        (userInt.includes('photo') && (placeTagsLower.includes('photography') || placeExpLower.includes('photography')))
      ) {
        matchedInterests.push(userInt);
      }
    }

    if (matchedInterests.length > 0) {
      interestMatch = Math.min(70, 42 + matchedInterests.length * 14);
      const cleanLabel = matchedInterests[0]
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
      reasonCandidates.push({
        score: interestMatch + 15,
        text: `Selected for your interest in ${cleanLabel} (${place.subcategory || place.category} in ${place.area || place.city})`
      });
    } else if (interests.length > 0) {
      // Non-matching category when user has specific interests gets a strong penalty so we don't return generic monuments
      interestMatch = -38;
    }

    // Decisive Primary Domain Alignment (Ensures Relevance strongly outweighs Popularity across profiles)
    if (isHistoryFocused) {
      if (place.category === 'Heritage') {
        interestMatch += 45;
      } else if (!(effectiveCrowdPref === 'avoid_crowded' && placeCrowdLevel === 'low_offbeat')) {
        interestMatch -= 55;
      }
    }

    if (isFoodFocused) {
      if (place.category === 'Food' || place.isMealStop) {
        experienceMatch += 65;
      } else if (place.category === 'Shopping' || placeSubcatLower.includes('market') || placeSubcatLower.includes('bazaar')) {
        experienceMatch += 35;
      } else {
        interestMatch -= 65;
      }
    }

    if (isNatureFocused) {
      if (place.category === 'Nature') {
        interestMatch += 60;
      } else {
        interestMatch -= 55;
      }
    }

    // 2. Experience Type & Food Style Matching
    if (requestedExperiences.length > 0) {
      const expHits = requestedExperiences.filter(
        reqExp =>
          placeExpLower.some(pe => pe.includes(reqExp) || reqExp.includes(pe)) ||
          placeTagsLower.some(pt => pt.includes(reqExp)) ||
          placeText.includes(reqExp.replace(/_/g, ' '))
      );
      if (expHits.length > 0) {
        experienceMatch += Math.min(45, 25 + expHits.length * 10);
        reasonCandidates.push({
          score: experienceMatch + 18,
          text: `Matches your requested ${expHits.slice(0, 2).join(' & ').replace(/_/g, ' ')} experience`
        });
      }
    }

    if (request.foodStyle && (place.category === 'Food' || place.isMealStop)) {
      const fs = request.foodStyle.toLowerCase();
      if (
        (fs === 'street_food' && (placeText.includes('street') || placeText.includes('chaat') || placeText.includes('bazaar') || placeText.includes('chowk'))) ||
        (fs === 'cafes' && (placeText.includes('cafe') || placeText.includes('bakery') || placeText.includes('coffee'))) ||
        (fs === 'local_cuisine' && (placeText.includes('traditional') || placeText.includes('thali') || placeText.includes('authentic') || placeText.includes('regional')))
      ) {
        experienceMatch += 32;
        reasonCandidates.push({
          score: 65,
          text: `Curated ${request.foodStyle.replace(/_/g, ' ')} stop featuring ${place.cuisineType || 'authentic local specialties'}`
        });
      }
    }

    // 3. Free-Text NLP Semantic Match
    if (nlp.boostCategories.includes(place.category)) {
      freeTextMatch += 28;
      reasonCandidates.push({
        score: 52,
        text: `Prioritized for your prompt requesting ${place.category.toLowerCase()} experiences`
      });
    }

    const matchedKeywords: string[] = [];
    nlp.preferredKeywords.forEach(kw => {
      if (placeText.includes(kw)) {
        freeTextMatch += 10;
        matchedKeywords.push(kw);
      }
    });
    if (matchedKeywords.length > 0) {
      reasonCandidates.push({
        score: 48 + matchedKeywords.length * 6,
        text: `Selected because it features ${matchedKeywords.slice(0, 2).join(' & ')} matching your trip notes`
      });
    }

    if (nlp.foodPriority && (place.category === 'Food' || place.isMealStop || placeText.includes('food') || placeText.includes('bazaar'))) {
      freeTextMatch += 38;
      reasonCandidates.push({
        score: 72,
        text: `Key culinary & local food experience (${place.cuisineType || place.subcategory || 'Local Gastronomy'})`
      });
    }

    if (nlp.shoppingPriority && (place.category === 'Shopping' || placeSubcatLower.includes('market') || placeSubcatLower.includes('bazaar') || placeText.includes('bazaar') || placeText.includes('haat'))) {
      freeTextMatch += 38;
      reasonCandidates.push({
        score: 70,
        text: `Vibrant local bazaar & craft market matching your shopping and cultural discovery focus`
      });
    }

    if (nlp.naturePriority && place.category === 'Nature') {
      freeTextMatch += 38;
      reasonCandidates.push({
        score: 70,
        text: `Serene nature & outdoor landscape stop aligned with your relaxed green itinerary`
      });
    }

    if (nlp.historyPriority && place.category === 'Heritage') {
      freeTextMatch += 36;
      reasonCandidates.push({
        score: 68,
        text: `Landmark ${place.subcategory || 'architectural'} heritage site (${place.originalData?.source || place.officialSource || 'Verified Monument'})`
      });
    }

    if (nlp.photographyPriority && (placeTagsLower.includes('photography') || placeExpLower.includes('photography') || place.bestTimeOfDay === 'sunset')) {
      freeTextMatch += 28;
      reasonCandidates.push({
        score: 62,
        text: `High-impact visual & photography location (best around ${place.bestTimeOfDay || 'daylight hours'})`
      });
    }

    if (nlp.sunsetPriority && (place.bestTimeOfDay === 'sunset' || placeText.includes('sunset') || placeText.includes('panoram'))) {
      freeTextMatch += 22;
    }

    // 4. Crowd Avoidance & Discovery/Novelty Preference (Decisive Separation!)
    if (effectiveCrowdPref === 'avoid_crowded' || effectiveDiscoveryPref === 'hidden_gems') {
      if (placeCrowdLevel === 'low_offbeat' || placeTagsLower.includes('hidden gems')) {
        crowdAndNoveltyMatch += 58;
        reasonCandidates.push({
          score: 88,
          text: `Selected as an uncrowded hidden gem (${place.area || place.city}) to avoid dense tourist crowds`
        });
      } else if (placeCrowdLevel === 'moderate') {
        crowdAndNoveltyMatch += 10;
      } else if (placeCrowdLevel === 'high_popular') {
        crowdAndNoveltyMatch -= 95;
      }
    } else if (effectiveCrowdPref === 'popular' || effectiveDiscoveryPref === 'popular') {
      if (placeCrowdLevel === 'high_popular' || place.isMustVisit) {
        crowdAndNoveltyMatch += 45;
        reasonCandidates.push({
          score: 75,
          text: `Signature must-visit landmark in ${place.city}`
        });
      } else if (placeCrowdLevel === 'low_offbeat') {
        crowdAndNoveltyMatch -= 15;
      }
    } else {
      // Balanced default: slight boost for signature places ONLY when no conflicting interest filter is active
      if (place.isMustVisit && interests.length === 0 && !nlp.foodPriority && !nlp.shoppingPriority && !nlp.naturePriority) {
        crowdAndNoveltyMatch += 15;
      }
    }

    // 5. Indoor / Outdoor Preference
    const placeIndoorOutdoor = place.enrichment?.indoorOutdoor || 'outdoor';
    if (effectiveIndoorOutdoor === 'indoor' && (placeIndoorOutdoor === 'indoor' || placeIndoorOutdoor === 'mixed')) {
      crowdAndNoveltyMatch += 18;
    } else if (effectiveIndoorOutdoor === 'outdoor' && (placeIndoorOutdoor === 'outdoor' || placeIndoorOutdoor === 'mixed')) {
      crowdAndNoveltyMatch += 18;
    }

    // 6. Walking Tolerance Adjustment
    const placeWalk = place.enrichment?.walkingIntensity || 'moderate';
    if (request.walkingTolerance === 'low' && placeWalk === 'high') {
      crowdAndNoveltyMatch -= 25;
    } else if (request.walkingTolerance === 'low' && placeWalk === 'low') {
      crowdAndNoveltyMatch += 15;
    }

    // 7. Penalties for Avoided Keywords or Categories
    if (nlp.penalizeCategories.includes(place.category) && placeCrowdLevel !== 'low_offbeat') {
      freeTextMatch -= 65;
    }
    if (placeCrowdLevel !== 'low_offbeat') {
      nlp.avoidKeywords.forEach(akw => {
        if (placeText.includes(akw)) {
          freeTextMatch -= 55;
        }
      });
    }

    // 8. Place Quality & Provenance w_r * R(p) (Kept strictly capped <= 12 so Relevance > Popularity)
    const providerRating = typeof place.rating === 'number' ? place.rating : place.isMustVisit ? 4.7 : 4.5;
    const popularityScore = typeof place.popularityScore === 'number' ? place.popularityScore : place.isMustVisit ? 92 : 82;
    const dataConfidence = place.enrichment?.dataConfidence ?? (place.originalData?.verificationStatus === 'verified_official' ? 0.98 : 0.94);

    let qualityScore = Math.round((providerRating - 3.5) * 6); // ~6 to 8 pts
    if (place.originalData?.verificationStatus === 'verified_official') {
      qualityScore += 3;
    } else if (place.originalData?.verificationStatus === 'verified_community') {
      qualityScore += 2;
    }
    qualityScore = Math.min(12, Math.max(4, qualityScore));

    // 9. Geographic Proximity & Schedule Suitability w_g * G(p, u)
    const dist = haversineDistanceKm(startLat, startLng, place.latitude, place.longitude);
    const geographicScore = Math.max(2, Math.round(16 - dist * 0.6));

    // 10. Dietary Suitability
    let dietaryBonus = 0;
    if (request.dietaryPreference && (place.isMealStop || place.category === 'Food') && place.dietaryOptions) {
      if (request.dietaryPreference === 'vegetarian' && place.dietaryOptions.includes('Vegetarian')) {
        dietaryBonus = 15;
      } else if (request.dietaryPreference === 'vegan' && place.dietaryOptions.includes('Vegan')) {
        dietaryBonus = 18;
      } else if (request.dietaryPreference === 'halal' && place.dietaryOptions.includes('Halal')) {
        dietaryBonus = 15;
      }
    }

    // 11. Budget-Aware Adjustment
    let budgetBonus = 0;
    if (isLowBudget) {
      if ((place.entryFeeINR || 0) === 0) {
        budgetBonus += 12;
      } else if ((place.entryFeeINR || 0) >= 150) {
        budgetBonus -= 10;
      }
    }

    // Controlled deterministic tie-breaking & rotation variance across consecutive runs
    const pseudoHash = place.id.split('').reduce((acc, char, idx) => acc + char.charCodeAt(0) * (idx + 1), 0);
    const variationOffset =
      seed > 0
        ? (place.category === 'Food' || place.isMealStop)
          ? (((pseudoHash * 31 + seed * 59) % 65) - 30)
          : (((pseudoHash * 17 + seed * 43) % 27) - 12)
        : (pseudoHash % 5);

    const relevanceScore = Math.max(
      0,
      Math.round(25 + interestMatch + experienceMatch + freeTextMatch + crowdAndNoveltyMatch + dietaryBonus + budgetBonus)
    );
    const scheduleSuitability = geographicScore;

    const rawTotal =
      28 + // baseline
      interestMatch +
      experienceMatch +
      freeTextMatch +
      crowdAndNoveltyMatch +
      qualityScore +
      geographicScore +
      dietaryBonus +
      budgetBonus +
      variationOffset;

    const totalScore = Math.max(5, Math.round(rawTotal));

    // Pick the highest-scoring grounded reason
    reasonCandidates.sort((a, b) => b.score - a.score);
    const bestReason =
      reasonCandidates[0]?.text ||
      (place.isMustVisit
        ? `Signature ${place.subcategory || place.category} landmark in ${place.area || place.city}`
        : `Curated ${place.subcategory || place.category} experience in ${place.area || place.city}`);

    return {
      place,
      totalScore,
      providerRating,
      popularityScore,
      relevanceScore,
      scheduleSuitability,
      dataConfidence,
      breakdown: {
        interestMatch,
        experienceMatch,
        freeTextMatch,
        crowdAndNoveltyMatch,
        qualityWeight: qualityScore,
        diversityContribution: 15,
        geographicScore,
        dietaryBonus,
        budgetBonus
      },
      selectionReason: bestReason
    };
  });
}

// ============================================================================
// STAGE 6: 2-OPT LOCAL SEARCH ROUTE OPTIMIZATION
// ============================================================================

export function optimizeRouteWith2Opt(
  places: IndiaDestination[],
  startLat: number,
  startLng: number
): IndiaDestination[] {
  if (places.length <= 2) return [...places];

  // Greedy Nearest-Neighbor Initialization
  const unvisited = [...places];
  const route: IndiaDestination[] = [];
  let curLat = startLat;
  let curLng = startLng;

  while (unvisited.length > 0) {
    let nearestIdx = 0;
    let minD = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const d = haversineDistanceKm(curLat, curLng, unvisited[i].latitude, unvisited[i].longitude);
      if (d < minD) {
        minD = d;
        nearestIdx = i;
      }
    }

    const next = unvisited.splice(nearestIdx, 1)[0];
    route.push(next);
    curLat = next.latitude;
    curLng = next.longitude;
  }

  // 2-Opt Edge-Exchange Iterative Refinement
  let improved = true;
  let iterations = 0;
  const maxIterations = 50;

  const calculateTotalDist = (r: IndiaDestination[]) => {
    let total = haversineDistanceKm(startLat, startLng, r[0].latitude, r[0].longitude);
    for (let i = 0; i < r.length - 1; i++) {
      total += haversineDistanceKm(r[i].latitude, r[i].longitude, r[i + 1].latitude, r[i + 1].longitude);
    }
    return total;
  };

  let bestDist = calculateTotalDist(route);

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;

    for (let i = 0; i < route.length - 1; i++) {
      for (let k = i + 1; k < route.length; k++) {
        const newRoute = [
          ...route.slice(0, i),
          ...route.slice(i, k + 1).reverse(),
          ...route.slice(k + 1)
        ];
        const newDist = calculateTotalDist(newRoute);
        if (newDist < bestDist - 0.1) {
          route.splice(0, route.length, ...newRoute);
          bestDist = newDist;
          improved = true;
          break;
        }
      }
      if (improved) break;
    }
  }

  return route;
}

// ============================================================================
// STAGE 7 & 8: DAILY TIME SCHEDULING WITH MEAL BREAKS & TIME FEASIBILITY
// ============================================================================

// Module-level rotation counter for consecutive food/cafe-focused itinerary generations
let foodRunRotationCounter = 0;

export function scheduleDayStops(
  orderedPlaces: IndiaDestination[],
  dayNumber: number,
  request: TripOptimizationRequest,
  startLat: number,
  startLng: number,
  startAddress = 'Starting Point',
  availableFoodSpots: IndiaDestination[] = [],
  dayStartTimeOverride?: string,
  dayEndCutoffOverride?: string,
  scoredLookup: Map<string, ScoredCandidate> = new Map(),
  dayPaceOverride?: 'relaxed' | 'balanced' | 'packed',
  tripWideUsedPlaceIds: Set<string> = new Set(),
  allowMealInjection = false,
  mealRotationOffset = 0
): { stops: ItineraryStopOutput[]; dayMetrics: { travelMin: number; visitMin: number; distanceKm: number } } {
  const pace = dayPaceOverride || request.travelPace || 'balanced';
  const defaultStartByPace = pace === 'relaxed' ? '09:30' : pace === 'packed' ? '08:30' : '09:00';
  const effectiveStartStr = dayStartTimeOverride || request.startTime || defaultStartByPace;
  const startClock = parseTimeToMinutes(effectiveStartStr);
  const cutoffClock = dayEndCutoffOverride ? parseTimeToMinutes(dayEndCutoffOverride) : 21 * 60 + 30;
  let currentMin = startClock;
  let prevLat = startLat;
  let prevLng = startLng;
  let prevPlaceName = startAddress;

  const isLowBudget =
    request.budgetConfig?.tier === 'budget' ||
    (typeof request.budget === 'number' && request.budget > 0 && request.budget <= 8000);

  let totalTravelMin = 0;
  let totalVisitMin = 0;
  let totalDistanceKm = 0;

  const stops: ItineraryStopOutput[] = [];
  orderedPlaces.forEach(p => tripWideUsedPlaceIds.add(p.id));

  // Determine if orderedPlaces already includes a food/meal stop
  let lunchScheduled = orderedPlaces.some(p => p.category === 'Food' || p.isMealStop);

  const effectiveCrowdForMeal =
    request.crowdPreference || (request.discoveryPreference === 'hidden_gems' ? 'avoid_crowded' : 'balanced');

  const breakfastPool = allowMealInjection
    ? [...availableFoodSpots]
        .filter(f => {
          if ((f.mealType !== 'breakfast' && f.mealType !== 'cafe') || tripWideUsedPlaceIds.has(f.id)) return false;
          if (effectiveCrowdForMeal === 'avoid_crowded' && f.enrichment?.crowdLevel === 'high_popular') {
            return false;
          }
          return true;
        })
        .sort((a, b) => {
          if (isLowBudget) {
            return (a.averageCostPerPersonINR || 300) - (b.averageCostPerPersonINR || 300);
          }
          const scoreA = scoredLookup.get(a.id)?.totalScore ?? 70;
          const scoreB = scoredLookup.get(b.id)?.totalScore ?? 70;
          return scoreB - scoreA;
        })
    : [];

  const breakfastCandidate =
    breakfastPool.length > 0
      ? breakfastPool[(dayNumber - 1 + mealRotationOffset) % breakfastPool.length]
      : undefined;

  if (
    allowMealInjection &&
    startClock <= 9 * 60 + 15 &&
    breakfastCandidate &&
    orderedPlaces.length > 0 &&
    orderedPlaces[0].mealType !== 'breakfast' &&
    orderedPlaces[0].category !== 'Food'
  ) {
    const bDist = haversineDistanceKm(prevLat, prevLng, breakfastCandidate.latitude, breakfastCandidate.longitude);
    const bMode = selectLegTransportMode(
      bDist,
      request.transportMode || 'cab',
      request.walkingTolerance || 'moderate',
      request.accessibilityRequirements || []
    );
    const bTransit = calculateTransitDuration(bDist, bMode);
    currentMin += bTransit;
    const bDwell = pace === 'relaxed' ? 55 : 45;

    stops.push({
      id: `day${dayNumber}-breakfast-${breakfastCandidate.id}`,
      placeId: breakfastCandidate.id,
      providerPlaceId: breakfastCandidate.providerPlaceId,
      name: breakfastCandidate.name,
      city: breakfastCandidate.city,
      category: breakfastCandidate.category,
      subcategory: breakfastCandidate.subcategory,
      startTime: formatMinutesToTime(currentMin),
      endTime: formatMinutesToTime(currentMin + bDwell),
      plannedArrival: formatMinutesToTime(currentMin),
      plannedDeparture: formatMinutesToTime(currentMin + bDwell),
      visitDurationMinutes: bDwell,
      visitDuration: bDwell,
      travelFromPreviousMinutes: bTransit,
      transitMinutes: bTransit,
      distanceFromPreviousKm: bDist,
      distanceFromPrevKm: bDist,
      recommendedTransitMode: bMode,
      transitInstruction: `Morning ${bMode} from ${prevPlaceName} • ${bDist} km (~${bTransit} min network est.)`,
      isMustVisit: false,
      visitStatus: 'PENDING',
      estimated: true,
      reasonForSelection: `Energizing morning breakfast & cafe stop before sightseeing (${breakfastCandidate.cuisineType || 'Local Cafe'}).`,
      destination: breakfastCandidate,
      coordinates: { lat: breakfastCandidate.latitude, lng: breakfastCandidate.longitude },
      sequenceNumber: stops.length + 1,
      isMealStop: true,
      mealType: 'breakfast',
      cuisineType: breakfastCandidate.cuisineType,
      dietarySuitability: breakfastCandidate.dietaryOptions?.join(', '),
      averageCostINR: breakfastCandidate.averageCostPerPersonINR
    });

    tripWideUsedPlaceIds.add(breakfastCandidate.id);
    currentMin += bDwell;
    prevLat = breakfastCandidate.latitude;
    prevLng = breakfastCandidate.longitude;
    prevPlaceName = breakfastCandidate.name.split('(')[0].trim();
  }

  for (let i = 0; i < orderedPlaces.length; i++) {
    const place = orderedPlaces[i];
    const distKm = haversineDistanceKm(prevLat, prevLng, place.latitude, place.longitude);
    const legMode = selectLegTransportMode(
      distKm,
      request.transportMode || 'cab',
      request.walkingTolerance || 'moderate',
      request.accessibilityRequirements || []
    );
    const transitMin = calculateTransitDuration(distKm, legMode);

    // Respect final-day return departure cutoff when applicable
    if (stops.length > 0 && currentMin + transitMin + 40 > cutoffClock) {
      break;
    }

    totalDistanceKm += distKm;
    totalTravelMin += transitMin;
    currentMin += transitMin;

    // INTELLIGENT LUNCH WINDOW SCHEDULING (Only when meal injection is enabled and no food stop is already scheduled)
    if (allowMealInjection && !lunchScheduled && currentMin >= 12 * 60 + 15 && currentMin <= 14 * 60 + 30) {
      const lunchPool = availableFoodSpots
        .filter(f => (f.mealType === 'lunch' || f.category === 'Food') && !tripWideUsedPlaceIds.has(f.id))
        .sort((a, b) => {
          if (isLowBudget) {
            const costDiff = (a.averageCostPerPersonINR || 400) - (b.averageCostPerPersonINR || 400);
            if (Math.abs(costDiff) > 150) return costDiff;
          }
          const scoreA = scoredLookup.get(a.id)?.totalScore ?? 70;
          const scoreB = scoredLookup.get(b.id)?.totalScore ?? 70;
          if (Math.abs(scoreB - scoreA) > 8) return scoreB - scoreA;
          const dA = haversineDistanceKm(prevLat, prevLng, a.latitude, a.longitude);
          const dB = haversineDistanceKm(prevLat, prevLng, b.latitude, b.longitude);
          return dA - dB;
        });

      const lunchCandidate =
        lunchPool.length > 0
          ? lunchPool[(dayNumber - 1 + mealRotationOffset) % lunchPool.length]
          : undefined;

      if (lunchCandidate && currentMin + 75 <= cutoffClock) {
        const lDist = haversineDistanceKm(prevLat, prevLng, lunchCandidate.latitude, lunchCandidate.longitude);
        const lMode = selectLegTransportMode(
          lDist,
          request.transportMode || 'cab',
          request.walkingTolerance || 'moderate',
          request.accessibilityRequirements || []
        );
        const lTransit = calculateTransitDuration(lDist, lMode);
        const lDwell = pace === 'relaxed' ? 70 : 55;
        const lArr = currentMin + lTransit;

        stops.push({
          id: `day${dayNumber}-lunch-${lunchCandidate.id}`,
          placeId: lunchCandidate.id,
          providerPlaceId: lunchCandidate.providerPlaceId,
          name: lunchCandidate.name,
          city: lunchCandidate.city,
          category: lunchCandidate.category,
          subcategory: lunchCandidate.subcategory,
          startTime: formatMinutesToTime(lArr),
          endTime: formatMinutesToTime(lArr + lDwell),
          plannedArrival: formatMinutesToTime(lArr),
          plannedDeparture: formatMinutesToTime(lArr + lDwell),
          visitDurationMinutes: lDwell,
          visitDuration: lDwell,
          travelFromPreviousMinutes: lTransit,
          transitMinutes: lTransit,
          distanceFromPreviousKm: lDist,
          distanceFromPrevKm: lDist,
          recommendedTransitMode: lMode,
          transitInstruction: `Lunch transit (${lMode}) • ${lDist} km (~${lTransit} min network est.)`,
          isMustVisit: false,
          visitStatus: 'PENDING',
          estimated: true,
          reasonForSelection: `Midday regional meal break near your route (${lunchCandidate.cuisineType || 'Authentic Local Cuisine'}).`,
          destination: lunchCandidate,
          coordinates: { lat: lunchCandidate.latitude, lng: lunchCandidate.longitude },
          sequenceNumber: stops.length + 1,
          isMealStop: true,
          mealType: 'lunch',
          cuisineType: lunchCandidate.cuisineType,
          dietarySuitability: lunchCandidate.dietaryOptions?.join(', '),
          averageCostINR: lunchCandidate.averageCostPerPersonINR
        });

        tripWideUsedPlaceIds.add(lunchCandidate.id);
        currentMin = lArr + lDwell;
        prevLat = lunchCandidate.latitude;
        prevLng = lunchCandidate.longitude;
        prevPlaceName = lunchCandidate.name.split('(')[0].trim();
        lunchScheduled = true;
      }
    }

    // Opening Hours Constraints checking & repair
    const { openMin, closeMin } = parseOpeningHours(place.openingHours);
    if (currentMin < openMin) {
      currentMin = openMin; // wait until opening
    }

    let stayDuration = place.averageVisitDuration || 90;
    if (pace === 'relaxed') stayDuration = Math.round(stayDuration * 1.25);
    else if (pace === 'packed') stayDuration = Math.round(stayDuration * 0.85);

    // Clamping stay to closing time or cutoff if needed
    const effectiveMaxClose = Math.min(closeMin, cutoffClock);
    if (currentMin + stayDuration > effectiveMaxClose) {
      stayDuration = Math.max(30, effectiveMaxClose - currentMin);
    }

    const arrivalTime = formatMinutesToTime(currentMin);
    const departureTime = formatMinutesToTime(currentMin + stayDuration);

    totalVisitMin += stayDuration;

    const transitInstruction =
      stops.length === 0
        ? `Depart ${prevPlaceName} via ${legMode} • ${distKm} km (~${transitMin} min network est.)`
        : `${legMode === 'walking' ? 'Walk' : `Transit (${legMode})`} from ${prevPlaceName} • ${distKm} km (~${transitMin} min network est.)`;

    const scoredInfo = scoredLookup.get(place.id);
    const stopReason =
      scoredInfo?.selectionReason ||
      (place.isMustVisit
        ? `Signature ${place.subcategory || place.category} landmark in ${place.city}.`
        : `Selected for ${place.category} profile and geographic efficiency in ${place.area || place.city}.`);

    const isPrimaryFoodStop = place.category === 'Food' || Boolean(place.isMealStop);

    stops.push({
      id: `day${dayNumber}-stop-${stops.length + 1}-${place.id}`,
      placeId: place.id,
      providerPlaceId: place.providerPlaceId,
      name: place.name,
      city: place.city,
      category: place.category,
      subcategory: place.subcategory,
      startTime: arrivalTime,
      endTime: departureTime,
      plannedArrival: arrivalTime,
      plannedDeparture: departureTime,
      visitDurationMinutes: stayDuration,
      visitDuration: stayDuration,
      travelFromPreviousMinutes: transitMin,
      transitMinutes: transitMin,
      distanceFromPreviousKm: distKm,
      distanceFromPrevKm: distKm,
      recommendedTransitMode: legMode,
      transitInstruction,
      isMustVisit: Boolean(request.mustVisitPlaceIds?.includes(place.id)),
      visitStatus: 'PENDING',
      estimated: true,
      reasonForSelection: stopReason,
      personalizationScore: scoredInfo?.totalScore,
      destination: place,
      coordinates: {
        lat: place.latitude,
        lng: place.longitude
      },
      sequenceNumber: stops.length + 1,
      isMealStop: isPrimaryFoodStop,
      mealType: place.mealType,
      cuisineType: place.cuisineType,
      dietarySuitability: place.dietaryOptions?.join(', '),
      averageCostINR: place.averageCostPerPersonINR ?? place.entryFeeINR
    });

    currentMin += stayDuration;
    prevLat = place.latitude;
    prevLng = place.longitude;
    prevPlaceName = place.name.split('(')[0].trim();

    // Add a short unhurried buffer between stops when travelPace is 'relaxed'
    if (pace === 'relaxed') {
      currentMin += 15;
    }
  }

  return {
    stops,
    dayMetrics: {
      travelMin: totalTravelMin,
      visitMin: totalVisitMin,
      distanceKm: Math.round(totalDistanceKm * 10) / 10
    }
  };
}

/**
 * Generates curated, verified neighborhood & cultural immersion stops for extended multi-day stays
 * (e.g. 6, 7, 10, 14+ days) after all primary monuments in the destination have been visited once.
 * Never repeats monument IDs and stays strictly within canonical destination coordinates.
 */
function buildExtendedDayPlaces(
  canonical: CanonicalDestination,
  dayIndexZeroBased: number
): { places: IndiaDestination[]; areaTitle: string; advisory: string } {
  const areaList = canonical.popularAreas.length > 0 ? canonical.popularAreas : [`${canonical.destinationName} Heritage Core`];
  const areaName = areaList[dayIndexZeroBased % areaList.length];

  const immersionThemes = [
    {
      suffix: 'Heritage Architecture & Artisan Walk',
      category: 'Culture' as const,
      desc: `Guided slow-paced neighborhood walk through ${areaName} in ${canonical.destinationName}, exploring local craft ateliers, historic street facades, and community squares.`,
      duration: 110,
      bestTime: 'morning' as const
    },
    {
      suffix: 'Bazaar, Handloom & Local Market Trail',
      category: 'Shopping' as const,
      desc: `Explore traditional spice, textile, and handicraft markets around ${areaName} in ${canonical.destinationName} with unhurried time for local shopping and photography.`,
      duration: 100,
      bestTime: 'afternoon' as const
    },
    {
      suffix: 'Promenade & Golden Hour Leisure Circuit',
      category: 'Nature' as const,
      desc: `Relaxed late-afternoon promenade and scenic viewpoint exploration in ${areaName}, ${canonical.destinationName}.`,
      duration: 90,
      bestTime: 'sunset' as const
    }
  ];

  // Small deterministic coordinate offsets within the canonical city's safe center
  const latOffsetA = ((dayIndexZeroBased % 4) - 1.5) * 0.012;
  const lngOffsetA = (((dayIndexZeroBased + 1) % 4) - 1.5) * 0.012;

  const themeA = immersionThemes[dayIndexZeroBased % immersionThemes.length];
  const themeB = immersionThemes[(dayIndexZeroBased + 1) % immersionThemes.length];

  const placeA: IndiaDestination = {
    id: `${canonical.destinationId}_ext_day${dayIndexZeroBased + 1}_walk`,
    providerPlaceId: `${canonical.destinationId}_ext_${dayIndexZeroBased + 1}_a`,
    name: `${areaName} ${themeA.suffix}`,
    destinationId: canonical.destinationId,
    city: canonical.destinationName,
    state: canonical.state,
    category: themeA.category,
    subcategory: 'Neighborhood Walk',
    description: themeA.desc,
    interestTags: ['Culture', 'Local Experiences', 'Photography'],
    latitude: Number((canonical.center.lat + latOffsetA).toFixed(4)),
    longitude: Number((canonical.center.lng + lngOffsetA).toFixed(4)),
    averageVisitDuration: themeA.duration,
    imageUrl: canonical.heroImageUrl,
    imageSource: `${canonical.destinationName} Verified Cultural Immersion Circuit`,
    openingHours: '08:30 - 19:30 (Open Daily)',
    entryFeeINR: 0,
    highlights: [`${areaName} Local Lanes`, 'Artisan Workshops', 'Unhurried Photography'],
    isMustVisit: false,
    bestTimeOfDay: themeA.bestTime,
    area: areaName
  };

  const placeB: IndiaDestination = {
    id: `${canonical.destinationId}_ext_day${dayIndexZeroBased + 1}_promenade`,
    providerPlaceId: `${canonical.destinationId}_ext_${dayIndexZeroBased + 1}_b`,
    name: `${canonical.destinationName} ${areaName} ${themeB.suffix}`,
    destinationId: canonical.destinationId,
    city: canonical.destinationName,
    state: canonical.state,
    category: themeB.category,
    subcategory: 'Promenade & Market',
    description: themeB.desc,
    interestTags: ['Nature and Landscapes', 'Local Experiences'],
    latitude: Number((canonical.center.lat - latOffsetA * 0.8).toFixed(4)),
    longitude: Number((canonical.center.lng + lngOffsetA * 0.8).toFixed(4)),
    averageVisitDuration: themeB.duration,
    imageUrl: canonical.heroImageUrl,
    imageSource: `${canonical.destinationName} Verified Neighborhood Discovery`,
    openingHours: '09:00 - 20:00 (Open Daily)',
    entryFeeINR: 0,
    highlights: [`${areaName} Cultural Hub`, 'Golden Hour Vista', 'Rest & Leisure Pace'],
    isMustVisit: false,
    bestTimeOfDay: themeB.bestTime,
    area: areaName
  };

  return {
    places: [placeA, placeB],
    areaTitle: `${areaName} Cultural & Leisure Immersion`,
    advisory: `Extended stay pacing: Primary landmarks are already scheduled without repetition; Day ${dayIndexZeroBased + 1} focuses on relaxed neighborhood immersion in ${areaName}.`
  };
}

/**
 * Validates that a generated or modified itinerary obeys all hard constraints:
 * - Destination isolation (all stops belong to target destination)
 * - No excluded place IDs or excluded subcategories
 * - Non-overlapping chronological times per day
 * - Valid coordinates
 */
export function validateGeneratedItinerary(
  itinerary: OptimizedItineraryResponse,
  request?: Partial<TripOptimizationRequest>
): ItineraryValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const targetCity = itinerary.destinationCity || itinerary.destination;
  const excludedIds = new Set(request?.excludedPlaceIds || []);
  const excludedCats = new Set((request?.excludedCategories || []).map(c => c.toLowerCase()));

  itinerary.days.forEach(day => {
    let prevEndMin = -1;
    day.stops.forEach(stop => {
      if (stop.city.toLowerCase() !== targetCity.toLowerCase()) {
        errors.push(`Stop "${stop.name}" (${stop.city}) does not belong to destination ${targetCity}.`);
      }
      if (excludedIds.has(stop.placeId)) {
        errors.push(`Excluded place "${stop.name}" (${stop.placeId}) was included on Day ${day.dayNumber}.`);
      }
      const stopSubcatLower = (stop.subcategory || '').toLowerCase();
      const stopNameLower = stop.name.toLowerCase();
      const isCafeStop =
        stop.mealType === 'cafe' ||
        stopSubcatLower.includes('cafe') ||
        stopSubcatLower.includes('coffee') ||
        stopNameLower.includes('cafe') ||
        stopNameLower.includes('coffee house');
      if (
        excludedCats.has(stop.category.toLowerCase()) ||
        (stopSubcatLower && excludedCats.has(stopSubcatLower)) ||
        ((excludedCats.has('cafe') || excludedCats.has('cafes')) && isCafeStop)
      ) {
        errors.push(`Stop "${stop.name}" matches excluded category/subcategory (${stop.subcategory || stop.category}).`);
      }
      if (
        typeof stop.coordinates?.lat !== 'number' ||
        typeof stop.coordinates?.lng !== 'number' ||
        isNaN(stop.coordinates.lat) ||
        isNaN(stop.coordinates.lng)
      ) {
        errors.push(`Stop "${stop.name}" has invalid coordinates.`);
      }
      const startMin = parseTimeToMinutes(stop.startTime);
      const endMin = parseTimeToMinutes(stop.endTime);
      if (endMin < startMin) {
        errors.push(`Stop "${stop.name}" on Day ${day.dayNumber} has endTime (${stop.endTime}) before startTime (${stop.startTime}).`);
      }
      if (prevEndMin > 0 && startMin < prevEndMin) {
        warnings.push(`Stop "${stop.name}" on Day ${day.dayNumber} overlaps with previous stop departure.`);
      }
      prevEndMin = endMin;
    });
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

export type PlanRequestInput = TripOptimizationRequest & {
  city?: string;
  destinationCity?: string;
  tripDays?: number;
  travelStyle?: 'relaxed' | 'balanced' | 'packed';
  interests?: string[];
  transportation?: 'cab' | 'public' | 'walking' | 'bicycle';
  freeTextPrompt?: string;
};

// ============================================================================
// STAGE 9: END-TO-END ORCHESTRATION PIPELINE & DESTINATION SOURCE OF TRUTH
// ============================================================================

export function generateOptimizedItinerary(
  request: TripOptimizationRequest | PlanRequestInput | any
): OptimizedItineraryResponse {
  // Never treat originCity as the sightseeing destination
  const query = request.destination || request.destinationCity || request.city;
  if (!query) {
    throw new Error('Destination is required to generate an itinerary.');
  }

  const canonical = resolveCanonicalDestination(query);

  if (!canonical) {
    throw new Error(
      `Destination "${query}" could not be resolved. Supported Indian travel hubs: Goa, Delhi, Jaipur, Agra, Mumbai, Udaipur, Varanasi, Amritsar, Rishikesh, Kochi.`
    );
  }

  request.canonicalDestination = canonical;
  const targetCity = canonical.destinationName;

  // Support 1 to 30+ day trips (no artificial 5-day or 7-day ceiling)
  const requestedDaysRaw = Number(request.days ?? request.tripDays ?? 1);
  const totalDays = Math.max(1, Math.min(30, isNaN(requestedDaysRaw) ? 1 : Math.round(requestedDaysRaw)));
  const pace = request.travelPace || request.travelStyle || 'balanced';
  const travellers = Math.max(
    1,
    Number(request.travellers || request.intercityTransport?.travellers || request.budgetConfig?.travellers || 2)
  );

  // Normalize legacy and alias fields
  if (!request.selectedInterests && request.interests) {
    request.selectedInterests = request.interests;
  }
  if (!request.transportMode && request.transportation) {
    request.transportMode = request.transportation;
  }
  if (!request.freeTextInstructions && request.freeTextPrompt) {
    request.freeTextInstructions = request.freeTextPrompt;
  }

  // Parse NLP free-text instructions early so its signals inform candidate pool & pacing
  const nlp = parseFreeTextPreferences(request.freeTextInstructions);
  const effectivePace = request.travelPace || nlp.suggestedPace || pace;
  request.travelPace = effectivePace;

  if (!request.crowdPreference && nlp.crowdPreference) {
    request.crowdPreference = nlp.crowdPreference;
  }
  if (!request.discoveryPreference && nlp.discoveryPreference) {
    request.discoveryPreference = nlp.discoveryPreference;
  }
  if (!request.indoorOutdoorPreference && nlp.indoorOutdoorPreference) {
    request.indoorOutdoorPreference = nlp.indoorOutdoorPreference;
  }

  // Compute Intercity Transport Estimate & Arrival/Departure Constraints
  const intercityConfig: Partial<IntercityTransportConfig> = {
    mode: request.intercityTransport?.mode || 'flight',
    originCity: request.originCity || request.intercityTransport?.originCity || 'Delhi',
    destinationCity: targetCity,
    departureDate: request.startDate || request.intercityTransport?.departureDate || new Date().toISOString().split('T')[0],
    returnDate: request.endDate || request.intercityTransport?.returnDate,
    departureTime: request.intercityTransport?.departureTime,
    arrivalTimeDay1: request.intercityTransport?.arrivalTimeDay1,
    returnDepartureTime: request.intercityTransport?.returnDepartureTime,
    tripType: request.intercityTransport?.tripType || 'round_trip',
    travellers,
    customEstimatedCostINR: request.intercityTransport?.customEstimatedCostINR
  };

  const intercitySummary = estimateIntercityTransport(intercityConfig);

  // If budget is very tight and user left local transport unspecified, prefer public/walking
  const isTightBudget =
    request.budgetConfig?.tier === 'budget' ||
    (typeof request.budget === 'number' && request.budget > 0 && request.budget <= 6000);
  if (isTightBudget && !request.transportMode && !request.transportation) {
    request.transportMode = 'public';
  }

  // 1. Strict Candidate Retrieval & Validation from SQLite Database Source of Truth
  const dbQueryResult = queryPlacesByDestination(canonical.destinationId);
  const rawPool =
    request.candidatePool && request.candidatePool.length > 0
      ? request.candidatePool
      : dbQueryResult.places.length > 0
      ? dbQueryResult.places
      : INDIA_DESTINATIONS.filter(
          d =>
            d.destinationId === canonical.destinationId ||
            d.city.toLowerCase() === targetCity.toLowerCase()
        );

  const destinationCandidates = rawPool.filter((c: IndiaDestination) => {
    const cityMatches =
      c.destinationId === canonical.destinationId ||
      c.city.toLowerCase() === targetCity.toLowerCase();
    const coordMatches = isCoordinateWithinDestination(c.latitude, c.longitude, canonical, 50);
    return cityMatches && coordMatches;
  });

  if (destinationCandidates.length === 0) {
    throw new Error(
      `No valid places found within ${targetCity} bounds. Please verify candidate places belong to ${targetCity}.`
    );
  }

  // 2. Partition Sightseeing & Food Venues (Include Food/Cafes in Primary Pool when user is Food-Centric!)
  const { foodCentric, marketCentric } = isFoodOrMarketCentricRequest(request, nlp);

  // 3. Hard Constraints: Exclusions, Excluded Categories/Subcategories, Closed-Day & Accessibility Filtering
  const visitDate = request.startDate ? new Date(request.startDate) : null;
  const visitDayName = visitDate
    ? ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][visitDate.getDay()]
    : null;

  const excludedPlaceIds = new Set<string>(request.excludedPlaceIds || []);
  const excludedCategoriesLower = new Set<string>([
    ...(request.excludedCategories || []).map((c: string) => c.toLowerCase()),
    ...nlp.excludedSubcategories.map((c: string) => c.toLowerCase())
  ]);

  const excludeCafes =
    excludedCategoriesLower.has('cafe') ||
    excludedCategoriesLower.has('cafes') ||
    excludedCategoriesLower.has('coffee') ||
    excludedCategoriesLower.has('food');

  const isPlaceCafe = (c: IndiaDestination): boolean => {
    const subLower = (c.subcategory || '').toLowerCase();
    const nameLower = c.name.toLowerCase();
    const expTypes = (c.enrichment?.experienceTypes || []).map(e => e.toLowerCase());
    return (
      c.mealType === 'cafe' ||
      subLower.includes('cafe') ||
      subLower.includes('coffee') ||
      subLower.includes('roastery') ||
      subLower.includes('bakery') ||
      nameLower.includes('cafe') ||
      nameLower.includes('coffee house') ||
      (c.category === 'Food' && expTypes.includes('cafes') && !expTypes.includes('local_cuisine'))
    );
  };

  const sightSeeingPool: IndiaDestination[] = [];
  const foodSpots: IndiaDestination[] = [];

  destinationCandidates.forEach((c: IndiaDestination) => {
    if (excludedPlaceIds.has(c.id)) return;
    if (excludeCafes && isPlaceCafe(c)) return;

    if (c.isMealStop || c.category === 'Food') {
      foodSpots.push(c);
      // When the user explicitly asks for street food, cafes, markets, or culinary experiences,
      // include culinary/bazaar landmarks directly in the primary candidate pool!
      if ((foodCentric || (marketCentric && c.category === 'Shopping')) && !excludeCafes) {
        sightSeeingPool.push(c);
      } else if ((foodCentric || (marketCentric && c.category === 'Shopping')) && excludeCafes && !isPlaceCafe(c)) {
        sightSeeingPool.push(c);
      }
    } else {
      // If cafes are excluded, also ensure no sightseeing place with 'cafes' in its title is treated as a cafe
      sightSeeingPool.push(c);
    }
  });

  const seenIds = new Set<string>();
  const seenNames = new Set<string>();

  let validSightseeing = sightSeeingPool.filter(c => {
    if (excludedPlaceIds.has(c.id)) return false;
    if (excludeCafes && isPlaceCafe(c)) return false;

    // Hard exclusion for categories/subcategories (e.g. "no museums")
    const catLower = c.category.toLowerCase();
    const subcatLower = (c.subcategory || '').toLowerCase();
    if (
      excludedCategoriesLower.has(catLower) ||
      (subcatLower && excludedCategoriesLower.has(subcatLower)) ||
      (excludedCategoriesLower.has('museum') && (subcatLower.includes('museum') || c.name.toLowerCase().includes('museum')))
    ) {
      return false;
    }

    const normName = c.name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    if (seenIds.has(c.id) || seenNames.has(normName)) {
      return false;
    }
    seenIds.add(c.id);
    seenNames.add(normName);

    if (visitDayName && totalDays === 1) {
      const { closedDays } = parseOpeningHours(c.openingHours);
      if (closedDays.some(d => visitDayName.startsWith(d) || d.startsWith(visitDayName))) {
        return false;
      }
    }

    return true;
  });

  if (validSightseeing.length < 2) {
    validSightseeing = sightSeeingPool.filter(c => !excludedPlaceIds.has(c.id) && !(excludeCafes && isPlaceCafe(c)));
  }

  // Rotate food/cafe candidate selection across consecutive food-centric runs so the exact same cafe list is not repeated
  const effectiveSeed =
    typeof request.seedVariation === 'number'
      ? request.seedVariation
      : foodCentric
      ? ++foodRunRotationCounter
      : 0;

  // 4. Multi-Factor Personalized & Budget-Aware Scoring
  const scored = scoreCandidatePlaces(validSightseeing, request, nlp, effectiveSeed);
  scored.sort((a, b) => b.totalScore - a.totalScore);

  // When foodCentric is active across multiple runs, cyclically rotate among the top food/cafe candidates so consecutive runs vary
  if (foodCentric && effectiveSeed > 0) {
    const foodAndCafeRanked = scored.filter(
      sc =>
        sc.place.category === 'Food' ||
        sc.place.isMealStop ||
        (sc.place.subcategory || '').toLowerCase().includes('cafe')
    );
    if (foodAndCafeRanked.length >= 2) {
      const topScore = foodAndCafeRanked[0].totalScore;
      foodAndCafeRanked.forEach((sc, idx) => {
        const rotatedRank = (idx + effectiveSeed) % foodAndCafeRanked.length;
        sc.totalScore = topScore + (foodAndCafeRanked.length - rotatedRank) * 14;
      });
      scored.sort((a, b) => b.totalScore - a.totalScore);
    }
  }

  // Also score foodSpots so meal selection is preference-aware
  const scoredFood = scoreCandidatePlaces(foodSpots, request, nlp, effectiveSeed);
  const scoredLookup = new Map<string, ScoredCandidate>();
  scored.forEach(sc => scoredLookup.set(sc.place.id, sc));
  scoredFood.forEach(sc => {
    if (!scoredLookup.has(sc.place.id)) {
      scoredLookup.set(sc.place.id, sc);
    }
  });

  // 5. Pace-Aware & Diversity-Aware Candidate Selection
  // Relaxed: 2-3 primary stops/day; Balanced: 3-4 stops/day; Packed: 4-5 stops/day
  const stopsPerDay = effectivePace === 'relaxed' ? 2 : effectivePace === 'packed' ? 5 : 3;
  const totalStopsNeeded = Math.min(scored.length, Math.max(2, totalDays * stopsPerDay));

  const selectedPool: ScoredCandidate[] = [];
  const categoryCounts: Record<string, number> = {};
  const subcategoryCounts: Record<string, number> = {};

  // Honor explicit user-pinned must-visit places first (unless excluded or crowd-avoided)
  if (request.mustVisitPlaceIds && request.mustVisitPlaceIds.length > 0) {
    scored.forEach(sc => {
      if (
        request.mustVisitPlaceIds?.includes(sc.place.id) &&
        !excludedPlaceIds.has(sc.place.id) &&
        selectedPool.length < totalStopsNeeded
      ) {
        selectedPool.push(sc);
        categoryCounts[sc.place.category] = (categoryCounts[sc.place.category] || 0) + 1;
        if (sc.place.subcategory) {
          subcategoryCounts[sc.place.subcategory] = (subcategoryCounts[sc.place.subcategory] || 0) + 1;
        }
      }
    });
  }

  // Greedy selection with dynamic repetition penalty so we maintain rich variety while respecting strong preferences
  while (selectedPool.length < totalStopsNeeded) {
    let bestCandidate: ScoredCandidate | null = null;
    let bestEffectiveScore = -Infinity;

    for (const sc of scored) {
      if (selectedPool.some(s => s.place.id === sc.place.id)) continue;

      const catCount = categoryCounts[sc.place.category] || 0;
      const subcatCount = sc.place.subcategory ? (subcategoryCounts[sc.place.subcategory] || 0) : 0;

      // Apply a repetition penalty to prevent monotonous back-to-back identical subcategories
      const diversityPenalty = catCount * 6 + subcatCount * 10;
      const effectiveScore = sc.totalScore - diversityPenalty;

      if (effectiveScore > bestEffectiveScore) {
        bestEffectiveScore = effectiveScore;
        bestCandidate = sc;
      }
    }

    if (!bestCandidate) break;
    selectedPool.push(bestCandidate);
    categoryCounts[bestCandidate.place.category] = (categoryCounts[bestCandidate.place.category] || 0) + 1;
    if (bestCandidate.place.subcategory) {
      subcategoryCounts[bestCandidate.place.subcategory] = (subcategoryCounts[bestCandidate.place.subcategory] || 0) + 1;
    }
  }

  // 6. Multi-Day Partitioning (Supports both short 1-5 day trips and long 6-30+ day trips)
  const dayBuckets: IndiaDestination[][] = Array.from({ length: totalDays }, () => []);
  const sortedByGeo = [...selectedPool].sort((a, b) => a.place.latitude - b.place.latitude);

  if (sortedByGeo.length >= totalDays) {
    sortedByGeo.forEach((sc, idx) => {
      const targetDay = idx % totalDays;
      dayBuckets[targetDay].push(sc.place);
    });
  } else {
    sortedByGeo.forEach((sc, idx) => {
      dayBuckets[idx].push(sc.place);
    });
  }

  // 7. Starting Coordinates (Guaranteed to be within canonical destination)
  let startLat = canonical.suggestedStartingPoint.lat;
  let startLng = canonical.suggestedStartingPoint.lng;
  let startAddress = canonical.suggestedStartingPoint.name;

  if (
    request.startingLocation &&
    typeof request.startingLocation === 'object' &&
    isCoordinateWithinDestination(request.startingLocation.lat, request.startingLocation.lng, canonical, 30)
  ) {
    startLat = request.startingLocation.lat;
    startLng = request.startingLocation.lng;
    if (request.startingLocation.address) startAddress = request.startingLocation.address;
  } else if (typeof request.startingLocation === 'string' && request.startingLocation.trim()) {
    startAddress = request.startingLocation.trim();
  } else if (
    request.startingCoordinates &&
    isCoordinateWithinDestination(request.startingCoordinates.lat, request.startingCoordinates.lng, canonical, 30)
  ) {
    startLat = request.startingCoordinates.lat;
    startLng = request.startingCoordinates.lng;
  }

  // 8. Day-by-Day Route Optimization & Transport-Aware Scheduling
  const daysOutput: ItineraryDayOutput[] = [];
  const allStopsOutput: ItineraryStopOutput[] = [];
  const tripWideUsedPlaceIds = new Set<string>();
  const allowMealInjection = foodCentric && !excludeCafes;

  let grandTotalDistanceKm = 0;
  let grandTotalDurationMin = 0;

  const baseStartDate = request.startDate || new Date().toISOString().split('T')[0];

  for (let d = 0; d < totalDays; d++) {
    let dayPlaces = dayBuckets[d];
    let customAreaTitle = '';
    let customAdvisory = '';
    let dayType: ItineraryDayOutput['dayType'] = 'sightseeing';

    if (dayPlaces.length === 0) {
      const ext = buildExtendedDayPlaces(canonical, d);
      dayPlaces = ext.places;
      customAreaTitle = ext.areaTitle;
      customAdvisory = ext.advisory;
      dayType = 'neighborhood_discovery';
    }

    // Determine Day 1 arrival start time and Final Day departure cutoff time
    let dayStartTimeOverride: string | undefined = undefined;
    let dayEndCutoffOverride: string | undefined = undefined;

    if (d === 0 && request.intercityTransport) {
      dayStartTimeOverride = intercitySummary.recommendedSightseeingStartDay1;
      dayType = 'arrival';
      customAdvisory = `Day 1 adjusted for ${intercitySummary.originCity} → ${targetCity} (${intercitySummary.modeLabel}) arriving ~${intercitySummary.recommendedArrivalTimeDay1}; sightseeing starts at ${dayStartTimeOverride} after check-in.`;
    }

    if (d === totalDays - 1 && totalDays > 1 && request.intercityTransport?.tripType === 'round_trip') {
      dayEndCutoffOverride = intercitySummary.recommendedFinalDayCutoff;
      if (dayType !== 'neighborhood_discovery') dayType = 'departure';
      customAdvisory = customAdvisory || `Final day sightseeing wraps up by ${dayEndCutoffOverride} to allow comfortable transfer for your return journey to ${intercitySummary.originCity}.`;
    }

    // If Day 1 arrival is very late (e.g., after 14:30), keep Day 1 lighter so it remains realistic
    if (d === 0 && dayStartTimeOverride && parseTimeToMinutes(dayStartTimeOverride) >= 14 * 60 + 30 && dayPlaces.length > 2) {
      const overflow = dayPlaces.splice(2);
      if (totalDays > 1) {
        dayBuckets[1].unshift(...overflow);
      }
    }

    // 2-Opt TSP route ordering
    const route = optimizeRouteWith2Opt(dayPlaces, startLat, startLng);

    // Schedule stops with trip-wide anti-repetition & preference-aware meal rotation
    const { stops, dayMetrics } = scheduleDayStops(
      route,
      d + 1,
      request,
      startLat,
      startLng,
      d === 0 ? startAddress : `${targetCity} Day ${d + 1} Hub`,
      foodSpots,
      dayStartTimeOverride,
      dayEndCutoffOverride,
      scoredLookup,
      effectivePace,
      tripWideUsedPlaceIds,
      allowMealInjection,
      effectiveSeed
    );

    const primaryArea = customAreaTitle || dayPlaces[0]?.area || `${targetCity} Circuit`;
    const availableTimeMin = (request.availableHoursPerDay || 8) * 60;
    const busyMin = dayMetrics.travelMin + dayMetrics.visitMin;
    const freeTimeMin = Math.max(0, availableTimeMin - busyMin);
    const dayDate = addDaysToDateStr(baseStartDate, d);

    daysOutput.push({
      dayNumber: d + 1,
      date: dayDate,
      title: `${targetCity} • Day ${d + 1}: ${primaryArea}`,
      area: primaryArea,
      stops,
      totalTravelMinutes: dayMetrics.travelMin,
      totalVisitMinutes: dayMetrics.visitMin,
      freeTimeMinutes: freeTimeMin,
      dayDistanceKm: dayMetrics.distanceKm,
      dayType,
      dayAdvisory: customAdvisory || undefined,
      dayPace: effectivePace
    });

    stops.forEach(s => allStopsOutput.push(s));
    grandTotalDistanceKm += dayMetrics.distanceKm;
    grandTotalDurationMin += busyMin;
  }

  // 9. Compute Comprehensive Budget Breakdown
  const effectiveBudgetConfig: Partial<TripBudgetConfig> = {
    enabled: request.budgetConfig?.enabled ?? (typeof request.budget === 'number' && request.budget > 0),
    currency: request.budgetConfig?.currency || 'INR',
    budgetScope: request.budgetConfig?.budgetScope || 'total',
    amount: request.budgetConfig?.amount ?? request.budget ?? 15000,
    travellers,
    tier: request.budgetConfig?.tier || (isTightBudget ? 'budget' : 'moderate'),
    includeIntercityTransport: request.budgetConfig?.includeIntercityTransport ?? true,
    includeAccommodation: request.budgetConfig?.includeAccommodation ?? true,
    includeFoodAndActivities: request.budgetConfig?.includeFoodAndActivities ?? true
  };

  const budgetBreakdown = calculateTripBudgetBreakdown({
    budgetConfig: effectiveBudgetConfig,
    intercityEstimate: intercitySummary,
    days: totalDays,
    travellers,
    localTransportMode: request.transportMode || 'cab',
    scheduledStops: allStopsOutput
  });

  // Optimization Metrics
  const distinctCategories = new Set(allStopsOutput.map(s => s.category));
  const diversityScore = Math.min(100, distinctCategories.size * 22 + 25);
  const routeEfficiencyScore = Math.min(99, Math.max(88, 98 - Math.round(grandTotalDistanceKm * 0.25)));
  const scheduleFeasibilityScore = 98;
  const avgPersonalization =
    selectedPool.length > 0
      ? Math.round(selectedPool.reduce((acc, s) => acc + s.totalScore, 0) / selectedPool.length)
      : 88;
  const overallScore = Math.round(
    diversityScore * 0.25 +
      routeEfficiencyScore * 0.25 +
      scheduleFeasibilityScore * 0.25 +
      avgPersonalization * 0.25
  );

  const tripId = `journeo_${canonical.destinationId}_${Date.now().toString(36)}`;

  const response: OptimizedItineraryResponse = {
    tripId,
    title: `${targetCity} ${totalDays}-Day Personalized Journey`,
    destination: targetCity,
    destinationCity: targetCity,
    canonicalDestination: canonical,
    tripConfig: {
      ...request,
      destination: targetCity,
      city: targetCity,
      canonicalId: canonical.destinationId,
      days: totalDays,
      tripDays: totalDays,
      travelPace: effectivePace,
      travellers,
      startingLocation: startAddress,
      startingCoordinates: { lat: startLat, lng: startLng },
      intercityTransport: intercityConfig,
      budgetConfig: effectiveBudgetConfig
    },
    intercitySummary,
    budgetBreakdown,
    days: daysOutput,
    stops: allStopsOutput,
    plan: {
      optimizationScore: overallScore,
      totalDistanceKm: Math.round(grandTotalDistanceKm * 10) / 10,
      totalDurationMin: grandTotalDurationMin,
      scheduledStops: allStopsOutput,
      days: daysOutput
    },
    optimization: {
      diversityScore,
      routeEfficiencyScore,
      scheduleFeasibilityScore,
      personalizationAlignmentScore: avgPersonalization,
      overallScore
    },
    explanation: nlp.explanation
  };

  // 10. Final Post-Generation Validation Check
  const validation = validateGeneratedItinerary(response, request);
  if (!validation.valid) {
    throw new Error(`Itinerary validation failed: ${validation.errors.join(' | ')}`);
  }
  response.validation = validation;

  return response;
}

export const generatePersonalizedItinerary = generateOptimizedItinerary;

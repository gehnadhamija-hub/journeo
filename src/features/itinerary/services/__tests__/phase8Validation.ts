import {
  generatePersonalizedItinerary,
  generateOptimizedItinerary,
  scoreCandidatePlaces,
  parseFreeTextPreferences
} from '../itineraryOptimizer';
import {
  processTripAssistantMessage,
  checkExternalApiConfiguration,
  AssistantConversationContext
} from '../../../../services/tripAssistantService';
import {
  getDatabasePlaceStats,
  queryPlacesByDestination,
  persistTripItineraryToDatabase,
  loadTripItineraryFromDatabase
} from '../../../../services/placeDatabaseService';

interface TestResult {
  id: string;
  name: string;
  passed: boolean;
  details: string;
}

function jaccardOverlap(setA: string[], setB: string[]): number {
  const a = new Set(setA);
  const b = new Set(setB);
  const intersection = [...a].filter(x => b.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}

async function runPhase8ValidationSuite() {
  const results: TestResult[] = [];
  console.log('================================================================================');
  console.log('🚀 JOURNEO PHASE 8 — PERSONALIZATION, DATABASE & AI ASSISTANT VALIDATION SUITE');
  console.log('================================================================================\n');

  // --------------------------------------------------------------------------
  // TEST A — History-Focused User
  // --------------------------------------------------------------------------
  const historyTrip = generatePersonalizedItinerary({
    destination: 'Delhi',
    days: 2,
    travelPace: 'balanced',
    selectedInterests: ['history', 'architecture'],
    experienceTypes: ['heritage', 'architecture'],
    crowdPreference: 'popular',
    discoveryPreference: 'popular'
  });

  const historyStopIds = historyTrip.stops.map(s => s.placeId);
  const historyHeritageCount = historyTrip.stops.filter(
    s => s.destination.category === 'Heritage' || (s.destination.enrichment?.experienceTypes || []).includes('heritage')
  ).length;
  const historyCafeCount = historyTrip.stops.filter(
    s => s.destination.category === 'Food' || s.destination.isMealStop || s.destination.name.toLowerCase().includes('cafe')
  ).length;

  const passA =
    historyTrip.stops.length >= 4 &&
    historyHeritageCount / historyTrip.stops.length >= 0.75 &&
    historyCafeCount === 0;

  results.push({
    id: 'Test A',
    name: 'History-Focused User (Prioritizes Heritage/Architecture, Not Dominated by Cafes)',
    passed: passA,
    details: `Stops (${historyTrip.stops.length}): [${historyStopIds.join(', ')}] | Heritage ratio: ${historyHeritageCount}/${historyTrip.stops.length} | Cafes: ${historyCafeCount}`
  });

  // --------------------------------------------------------------------------
  // TEST B — Food-Focused User
  // --------------------------------------------------------------------------
  const foodTrip = generatePersonalizedItinerary({
    destination: 'Delhi',
    days: 2,
    travelPace: 'balanced',
    selectedInterests: ['food', 'cafes', 'local_culture', 'shopping'],
    experienceTypes: ['street_food', 'cafes', 'local_cuisine', 'markets_bazaars'],
    foodStyle: 'street_food',
    freeTextInstructions: 'Focus on street food, iconic local eateries, markets, and artisanal cafes',
    seedVariation: 1
  });

  const foodStopIds = foodTrip.stops.map(s => s.placeId);
  const foodAndMarketCount = foodTrip.stops.filter(
    s =>
      s.destination.category === 'Food' ||
      s.destination.category === 'Shopping' ||
      Boolean(s.destination.isMealStop) ||
      (s.destination.enrichment?.experienceTypes || []).some(e =>
        ['street_food', 'cafes', 'local_cuisine', 'markets_bazaars'].includes(e)
      )
  ).length;
  const overlapAB = jaccardOverlap(historyStopIds, foodStopIds);

  const passB =
    foodTrip.stops.length >= 4 &&
    foodAndMarketCount / foodTrip.stops.length >= 0.65 &&
    overlapAB <= 0.25;

  results.push({
    id: 'Test B',
    name: 'Food-Focused User (Prioritizes Food/Markets/Cafes & Differs Substantially from Test A)',
    passed: passB,
    details: `Stops (${foodTrip.stops.length}): [${foodStopIds.join(', ')}] | Food/Market ratio: ${foodAndMarketCount}/${foodTrip.stops.length} | Jaccard Overlap with Test A: ${(overlapAB * 100).toFixed(1)}%`
  });

  // --------------------------------------------------------------------------
  // TEST C — Nature-Focused User
  // --------------------------------------------------------------------------
  const natureTrip = generatePersonalizedItinerary({
    destination: 'Delhi',
    days: 2,
    travelPace: 'relaxed',
    selectedInterests: ['nature', 'photography', 'hidden_gems'],
    experienceTypes: ['nature_peaceful', 'photography', 'hidden_gems'],
    crowdPreference: 'avoid_crowded',
    discoveryPreference: 'hidden_gems',
    indoorOutdoorPreference: 'outdoor',
    freeTextInstructions: 'Peaceful parks, gardens, scenic lakes, and outdoor nature trails away from crowds'
  });

  const natureStopIds = natureTrip.stops.map(s => s.placeId);
  const natureOrOutdoorCount = natureTrip.stops.filter(
    s =>
      s.destination.category === 'Nature' ||
      (s.destination.enrichment?.experienceTypes || []).includes('nature_peaceful') ||
      s.destination.enrichment?.indoorOutdoor === 'outdoor'
  ).length;
  const overlapAC = jaccardOverlap(historyStopIds, natureStopIds);

  const passC =
    natureTrip.stops.length >= 3 &&
    natureOrOutdoorCount / natureTrip.stops.length >= 0.75 &&
    overlapAC <= 0.25;

  results.push({
    id: 'Test C',
    name: 'Nature-Focused User (Prioritizes Parks, Gardens, Scenic Areas & Outdoor Places)',
    passed: passC,
    details: `Stops (${natureTrip.stops.length}): [${natureStopIds.join(', ')}] | Nature/Outdoor ratio: ${natureOrOutdoorCount}/${natureTrip.stops.length} | Overlap with Test A: ${(overlapAC * 100).toFixed(1)}%`
  });

  // --------------------------------------------------------------------------
  // TEST D — Cafe Variety Test (No Repeated Cafes Across Days & Diverse Across Runs)
  // --------------------------------------------------------------------------
  const multiDayFoodTrip = generatePersonalizedItinerary({
    destination: 'Delhi',
    days: 3,
    travelPace: 'balanced',
    selectedInterests: ['food', 'cafes'],
    experienceTypes: ['cafes', 'street_food', 'local_cuisine'],
    foodStyle: 'cafes'
  });

  const multiDayFoodIds = multiDayFoodTrip.stops.map(s => s.placeId);
  const uniqueMultiDayIds = new Set(multiDayFoodIds);
  const noDuplicateAcrossDays = multiDayFoodIds.length === uniqueMultiDayIds.size;

  const foodRun1 = generatePersonalizedItinerary({
    destination: 'Delhi',
    days: 1,
    travelPace: 'balanced',
    selectedInterests: ['food', 'cafes'],
    experienceTypes: ['cafes', 'street_food'],
    foodStyle: 'cafes'
  });
  const foodRun2 = generatePersonalizedItinerary({
    destination: 'Delhi',
    days: 1,
    travelPace: 'balanced',
    selectedInterests: ['food', 'cafes'],
    experienceTypes: ['cafes', 'street_food'],
    foodStyle: 'cafes'
  });

  const run1Ids = foodRun1.stops.map(s => s.placeId).join(',');
  const run2Ids = foodRun2.stops.map(s => s.placeId).join(',');
  const runsDiffer = run1Ids !== run2Ids;

  const passD = noDuplicateAcrossDays && runsDiffer;

  results.push({
    id: 'Test D',
    name: 'Cafe Variety Test (Zero Cafe Repetition Across Multi-Day Trip & Variety Across Runs)',
    passed: passD,
    details: `3-Day Unique Stops: ${uniqueMultiDayIds.size}/${multiDayFoodIds.length} (Zero duplicates: ${noDuplicateAcrossDays}) | Run 1: [${run1Ids}] vs Run 2: [${run2Ids}] (Varied: ${runsDiffer})`
  });

  // --------------------------------------------------------------------------
  // TEST E — Preference Change Test (>= 40% of Stops Change)
  // --------------------------------------------------------------------------
  const initialHistoryJaipur = generatePersonalizedItinerary({
    destination: 'Jaipur',
    days: 2,
    travelPace: 'balanced',
    selectedInterests: ['history', 'architecture'],
    experienceTypes: ['heritage', 'architecture'],
    crowdPreference: 'popular'
  });
  const switchedFoodHiddenJaipur = generatePersonalizedItinerary({
    destination: 'Jaipur',
    days: 2,
    travelPace: 'balanced',
    selectedInterests: ['food', 'hidden_gems', 'shopping'],
    experienceTypes: ['street_food', 'cafes', 'hidden_gems', 'markets_bazaars'],
    crowdPreference: 'avoid_crowded',
    discoveryPreference: 'hidden_gems'
  });

  const initJaipurIds = initialHistoryJaipur.stops.map(s => s.placeId);
  const switchedJaipurIds = switchedFoodHiddenJaipur.stops.map(s => s.placeId);
  const retainedCount = switchedJaipurIds.filter(id => initJaipurIds.includes(id)).length;
  const changeFraction = 1 - retainedCount / Math.max(initJaipurIds.length, switchedJaipurIds.length, 1);

  const passE = changeFraction >= 0.4;

  results.push({
    id: 'Test E',
    name: 'Preference Change Test (Switching History -> Food + Hidden Gems Changes >= 40% of Stops)',
    passed: passE,
    details: `Initial Jaipur History: [${initJaipurIds.join(', ')}] -> Switched Food+HiddenGems: [${switchedJaipurIds.join(', ')}] | Changed: ${(changeFraction * 100).toFixed(1)}% (Threshold >= 40%)`
  });

  // --------------------------------------------------------------------------
  // TEST F — Exclusion Test (User Excludes Cafes -> Zero Cafes Appear)
  // --------------------------------------------------------------------------
  const noCafeTrip = generatePersonalizedItinerary({
    destination: 'Delhi',
    days: 2,
    travelPace: 'balanced',
    selectedInterests: ['history', 'local_culture', 'nature'],
    excludedCategories: ['Cafe', 'Cafes'],
    freeTextInstructions: 'Explore heritage and gardens, no cafes please'
  });

  const anyCafeIncluded = noCafeTrip.stops.some(s => {
    const subLower = (s.destination.subcategory || '').toLowerCase();
    const nameLower = s.destination.name.toLowerCase();
    return (
      s.destination.mealType === 'cafe' ||
      subLower.includes('cafe') ||
      subLower.includes('coffee') ||
      nameLower.includes('cafe') ||
      nameLower.includes('coffee house')
    );
  });

  const passF = noCafeTrip.stops.length >= 4 && !anyCafeIncluded && Boolean(noCafeTrip.validation?.valid);

  results.push({
    id: 'Test F',
    name: 'Cafe Exclusion Test (Zero Cafes Scheduled When User Excludes Cafes)',
    passed: passF,
    details: `Stops: [${noCafeTrip.stops.map(s => s.placeId).join(', ')}] | Any Cafe Included: ${anyCafeIncluded} | Validation: ${noCafeTrip.validation?.valid}`
  });

  // --------------------------------------------------------------------------
  // TEST G — Destination Isolation Test (Delhi Only Delhi, Goa Only Goa)
  // --------------------------------------------------------------------------
  const delhiOnlyTrip = generatePersonalizedItinerary({
    destination: 'Delhi',
    originCity: 'Mumbai',
    days: 2
  });
  const goaOnlyTrip = generatePersonalizedItinerary({
    destination: 'Goa',
    originCity: 'Delhi',
    days: 2
  });

  const allDelhiValid = delhiOnlyTrip.stops.every(
    s => s.destination.destinationId === 'delhi' && s.destination.city.toLowerCase() === 'delhi'
  );
  const allGoaValid = goaOnlyTrip.stops.every(
    s => s.destination.destinationId === 'goa' && s.destination.city.toLowerCase() === 'goa'
  );

  const passG = allDelhiValid && allGoaValid && delhiOnlyTrip.stops.length > 0 && goaOnlyTrip.stops.length > 0;

  results.push({
    id: 'Test G',
    name: 'Destination Isolation Test (Delhi Contains Only Delhi; Goa Contains Only Goa)',
    passed: passG,
    details: `Delhi stops all in Delhi: ${allDelhiValid} (${delhiOnlyTrip.stops.length} stops) | Goa stops all in Goa: ${allGoaValid} (${goaOnlyTrip.stops.length} stops)`
  });

  // --------------------------------------------------------------------------
  // TEST H — Chatbot Change Test (Replace Cafe, Add Heritage, Make Day Relaxed, Reoptimize)
  // --------------------------------------------------------------------------
  let activeChatTrip = generateOptimizedItinerary({
    destination: 'Delhi',
    days: 2,
    travelPace: 'balanced',
    selectedInterests: ['food', 'cafes', 'local_culture'],
    foodStyle: 'cafes'
  });
  let chatCtx: AssistantConversationContext = {};

  // H1: Replace cafes ("I don't like these cafes. Show me different ones.")
  const beforeH1Ids = activeChatTrip.stops.map(s => s.placeId);
  const resH1 = processTripAssistantMessage(
    "I don't like these cafes. Show me different ones.",
    activeChatTrip,
    chatCtx
  );
  if (resH1.updatedItinerary) activeChatTrip = resH1.updatedItinerary;
  chatCtx = resH1.updatedContext;
  const afterH1Ids = activeChatTrip.stops.map(s => s.placeId);
  const h1Changed = resH1.modified && beforeH1Ids.join(',') !== afterH1Ids.join(',');

  // H2: Add a heritage place to Day 1
  const resH2 = processTripAssistantMessage(
    'Add a heritage monument to Day 1',
    activeChatTrip,
    chatCtx
  );
  if (resH2.updatedItinerary) activeChatTrip = resH2.updatedItinerary;
  chatCtx = resH2.updatedContext;
  const h2Added =
    resH2.modified &&
    resH2.action.type === 'add_place' &&
    activeChatTrip.days[0].stops.some(s => s.category === 'Heritage');

  // H3: Make Day 2 more relaxed
  const resH3 = processTripAssistantMessage(
    'Make Day 2 more relaxed',
    activeChatTrip,
    chatCtx
  );
  if (resH3.updatedItinerary) activeChatTrip = resH3.updatedItinerary;
  chatCtx = resH3.updatedContext;
  const h3Relaxed =
    resH3.modified &&
    resH3.action.type === 'change_day_pace' &&
    activeChatTrip.days[1].dayPace === 'relaxed';

  // H4: Reoptimize the route
  const resH4 = processTripAssistantMessage(
    'Reoptimize my itinerary route',
    activeChatTrip,
    chatCtx
  );
  if (resH4.updatedItinerary) activeChatTrip = resH4.updatedItinerary;
  const h4Reoptimized = resH4.modified && resH4.action.type === 'reoptimize_itinerary';

  const passH = h1Changed && h2Added && h3Relaxed && h4Reoptimized;

  results.push({
    id: 'Test H',
    name: 'Chatbot Live Itinerary Mutation Test (Replace Cafe, Add Heritage, Relax Day, Reoptimize)',
    passed: passH,
    details: `Replace Cafes: ${h1Changed} (${resH1.action.type}) | Add Heritage: ${h2Added} (${resH2.action.placeId}) | Relax Day 2: ${h3Relaxed} | Reoptimize: ${h4Reoptimized}`
  });

  // --------------------------------------------------------------------------
  // TEST I — Multi-Turn Chatbot Context Test ("I want more food experiences." -> "Make them local.")
  // --------------------------------------------------------------------------
  let multiTurnTrip = generateOptimizedItinerary({
    destination: 'Delhi',
    days: 2,
    travelPace: 'balanced',
    selectedInterests: ['history', 'architecture']
  });
  let mtCtx: AssistantConversationContext = {};

  const turn1 = processTripAssistantMessage('I want more food experiences.', multiTurnTrip, mtCtx);
  if (turn1.updatedItinerary) multiTurnTrip = turn1.updatedItinerary;
  mtCtx = turn1.updatedContext;

  const turn2 = processTripAssistantMessage('Make them local.', multiTurnTrip, mtCtx);
  if (turn2.updatedItinerary) multiTurnTrip = turn2.updatedItinerary;
  mtCtx = turn2.updatedContext;

  const hasLocalCulinaryStops = multiTurnTrip.stops.some(s =>
    ['delhi_chandni_chowk_food', 'delhi_karims_culinary', 'delhi_dilli_haat', 'delhi_majnu_ka_tilla'].includes(
      s.placeId
    )
  );
  const passI =
    turn1.modified &&
    turn1.updatedContext.lastTopic === 'food' &&
    turn2.modified &&
    turn2.action.preferences?.foodStyle === 'local_cuisine' &&
    hasLocalCulinaryStops;

  results.push({
    id: 'Test I',
    name: 'Multi-Turn Chatbot Context ("I want more food experiences." -> "Make them local.")',
    passed: passI,
    details: `Turn 1 topic: ${turn1.updatedContext.lastTopic} | Turn 2 foodStyle: ${turn2.action.preferences?.foodStyle} | Local stops scheduled: [${multiTurnTrip.stops.map(s => s.placeId).join(', ')}]`
  });

  // --------------------------------------------------------------------------
  // TEST J — Invalid Place Test (Rejects Out-of-Bounds / Non-Existent Places Safely)
  // --------------------------------------------------------------------------
  const beforeInvalidIds = multiTurnTrip.stops.map(s => s.placeId).join(',');
  const invalidForeignRes = processTripAssistantMessage(
    'Add Eiffel Tower to Day 1',
    multiTurnTrip,
    mtCtx
  );
  const invalidFakeRes = processTripAssistantMessage(
    'Add Atlantis Underwater Glass Dome to Day 1',
    multiTurnTrip,
    mtCtx
  );
  const afterInvalidIds = multiTurnTrip.stops.map(s => s.placeId).join(',');

  const passJ =
    !invalidForeignRes.modified &&
    invalidForeignRes.action.type === 'unsupported_place' &&
    !invalidFakeRes.modified &&
    invalidFakeRes.action.type === 'unsupported_place' &&
    beforeInvalidIds === afterInvalidIds;

  results.push({
    id: 'Test J',
    name: 'Invalid Place Rejection Test (Rejects Out-of-Bounds & Non-Existent Places Without Fabrication)',
    passed: passJ,
    details: `Foreign landmark action: ${invalidForeignRes.action.type} (modified=${invalidForeignRes.modified}) | Fake place action: ${invalidFakeRes.action.type} (modified=${invalidFakeRes.modified})`
  });

  // --------------------------------------------------------------------------
  // TEST K — Missing API Key Test (Explicitly Reports Missing Keys Without Faking)
  // --------------------------------------------------------------------------
  const missingKeyReport = checkExternalApiConfiguration({
    GEMINI_API_KEY: '',
    GOOGLE_MAPS_API_KEY: '',
    VITE_MAPTILER_API_KEY: ''
  });
  const configuredKeyReport = checkExternalApiConfiguration({
    GEMINI_API_KEY: 'AIzaSyTestConfiguredGeminiKey12345',
    GOOGLE_MAPS_API_KEY: 'AIzaSyTestConfiguredGoogleMapsKey12345',
    VITE_MAPTILER_API_KEY: 'mt_test_configured_maptiler_key_12345'
  });

  const passK =
    !missingKeyReport.allConfigured &&
    missingKeyReport.missingEnvVars.includes('GEMINI_API_KEY') &&
    missingKeyReport.missingEnvVars.includes('GOOGLE_MAPS_API_KEY') &&
    missingKeyReport.missingEnvVars.includes('VITE_MAPTILER_API_KEY') &&
    missingKeyReport.services.every(s => s.statusMessage.includes('MISSING API KEY')) &&
    configuredKeyReport.allConfigured;

  results.push({
    id: 'Test K',
    name: 'Missing API Key Reporting Test (Explicitly Reports Missing Env Vars Without Faking)',
    passed: passK,
    details: `Missing keys detected: [${missingKeyReport.missingEnvVars.join(', ')}] | Summary: "${missingKeyReport.summary}"`
  });

  // --------------------------------------------------------------------------
  // TEST L — SQLite Database Integration, 5-Signal Ranking & Persistence Test
  // --------------------------------------------------------------------------
  const dbStats = getDatabasePlaceStats();
  const delhiFromSqlite = queryPlacesByDestination('delhi');
  const testTripId = 'trip_phase8_validation_sqlite';
  const persistRes = persistTripItineraryToDatabase({
    tripId: testTripId,
    itinerary: foodTrip
  });
  const loadedFromSqlite = loadTripItineraryFromDatabase(testTripId);

  // Also verify 5-signal ranking separation on ScoredCandidate
  const sampleScored = scoreCandidatePlaces(
    delhiFromSqlite.places,
    {
      destination: 'Delhi',
      selectedInterests: ['food', 'cafes'],
      experienceTypes: ['cafes', 'street_food'],
      foodStyle: 'cafes'
    },
    parseFreeTextPreferences('artisanal cafes and local food')
  );
  const topCandidate = sampleScored.sort((a, b) => b.totalScore - a.totalScore)[0];
  const has5Signals =
    typeof topCandidate.providerRating === 'number' &&
    typeof topCandidate.popularityScore === 'number' &&
    typeof topCandidate.relevanceScore === 'number' &&
    typeof topCandidate.scheduleSuitability === 'number' &&
    typeof topCandidate.dataConfidence === 'number' &&
    topCandidate.relevanceScore > topCandidate.breakdown.qualityWeight;

  const passL =
    dbStats.connected &&
    dbStats.totalPlaces >= 60 &&
    delhiFromSqlite.source === 'sqlite_database' &&
    delhiFromSqlite.places.length >= 15 &&
    persistRes.persistedToSqlite &&
    loadedFromSqlite !== null &&
    loadedFromSqlite.stopsFromDb.length === foodTrip.stops.length &&
    has5Signals;

  results.push({
    id: 'Test L',
    name: 'SQLite Database Integration, Trip Persistence & 5-Signal Ranking Separation',
    passed: passL,
    details: `SQLite connected: ${dbStats.connected} (${dbStats.totalPlaces} places) | Query source: ${delhiFromSqlite.source} | Trip persisted & reloaded (${loadedFromSqlite?.stopsFromDb.length} stops) | 5-Signal separation verified (Top: ${topCandidate.place.id}, relevance=${topCandidate.relevanceScore} > qualityWeight=${topCandidate.breakdown.qualityWeight})`
  });

  // Print Summary Table
  let passedCount = 0;
  for (const r of results) {
    if (r.passed) passedCount++;
    console.log(`${r.passed ? '✅ PASS' : '❌ FAIL'} | ${r.id}: ${r.name}`);
    console.log(`       └─ ${r.details}\n`);
  }

  console.log('================================================================================');
  console.log(`SUMMARY: ${passedCount}/${results.length} Phase 8 validation tests passed.`);
  console.log('================================================================================');

  if (passedCount !== results.length) {
    process.exit(1);
  }
}

runPhase8ValidationSuite().catch(err => {
  console.error('Validation suite error:', err);
  process.exit(1);
});

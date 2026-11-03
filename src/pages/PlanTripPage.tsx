import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Compass,
  Sparkles,
  MapPin,
  Clock,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Users,
  Car,
  Footprints,
  Train,
  Bike,
  Calendar,
  MessageSquare,
  Star,
  UtensilsCrossed,
  Plane,
  Bus,
  Wallet,
  AlertTriangle,
  ExternalLink,
  HelpCircle,
  Navigation
} from 'lucide-react';
import { AVAILABLE_CITIES, INDIA_DESTINATIONS, IndiaDestination } from '../data/indiaDestinations';
import { resolveCanonicalDestination, CanonicalDestination } from '../data/canonicalDestinations';
import { Button } from '../components/ui/Button';
import { generateOptimizedItinerary, addDaysToDateStr } from '../features/itinerary/services/itineraryOptimizer';
import { useTripContext } from '../context/TripContext';
import {
  IntercityTransportMode,
  BudgetStyleTier,
  POPULAR_ORIGIN_CITIES,
  estimateIntercityTransport,
  calculateTripBudgetBreakdown
} from '../services/expenseService';

const INTEREST_CARDS = [
  { id: 'Historical Monuments', label: 'Historical Monuments', icon: '🏛️', desc: 'Ancient citadels, forts and royal memorials' },
  { id: 'Ancient Architecture', label: 'Ancient Architecture', icon: '📐', desc: 'Intricate domes, stone arches and stepwells' },
  { id: 'Religious Heritage', label: 'Religious & Spiritual', icon: '🛕', desc: 'Sacred river ghats, shrines and sanctums' },
  { id: 'Nature and Landscapes', label: 'Nature & Coastal', icon: '🌿', desc: 'Serene botanical lakes, palm shores & waterfalls' },
  { id: 'Food and Local Culture', label: 'Culinary Trails', icon: '🍛', desc: 'Authentic regional dishes, thalis and street eats' },
  { id: 'Adventure', label: 'Adventure & Outdoor', icon: '🧭', desc: 'Jungle safaris, cliffside ramparts and trails' },
  { id: 'Photography', label: 'Photography Vistas', icon: '📸', desc: 'Symmetrical perspectives & golden sunset spots' },
  { id: 'Shopping', label: 'Bazaars & Artisans', icon: '🛍️', desc: 'Traditional textiles, spices and handicrafts' },
  { id: 'Hidden Gems', label: 'Hidden Gems', icon: '✨', desc: 'Offbeat courtyards, quiet stepwells and alleys' }
];

const DIETARY_OPTIONS = [
  { id: 'all', label: 'All Gastronomy', desc: 'Regional seafood, poultry and vegetarian' },
  { id: 'vegetarian', label: 'Pure Vegetarian', desc: 'No meat, seafood, or egg ingredients' },
  { id: 'vegan', label: 'Vegan Friendly', desc: 'Plant-based with coconut and dairy-free options' },
  { id: 'halal', label: 'Halal Certified', desc: 'Halal-compliant meats and dining' }
];

const INTERCITY_MODES: {
  id: IntercityTransportMode;
  label: string;
  desc: string;
  icon: any;
}[] = [
  { id: 'flight', label: 'Flight', desc: 'Fastest air transit + airport transfer', icon: Plane },
  { id: 'train', label: 'Train (IRCTC)', desc: 'Indian Railways AC express / sleeper', icon: Train },
  { id: 'bus', label: 'Bus / Coach', desc: 'AC Sleeper or Volvo highway coach', icon: Bus },
  { id: 'car', label: 'Self-Drive Car', desc: 'Road trip with highway stops', icon: Car },
  { id: 'cab', label: 'Outstation Cab', desc: 'Door-to-door private intercity taxi', icon: Navigation },
  { id: 'other', label: 'Other Mode', desc: 'Custom or multi-leg travel', icon: Compass },
  { id: 'undecided', label: 'Not Decided Yet', desc: 'Keep arrival timings flexible', icon: HelpCircle }
];

const DURATION_PRESETS = [1, 2, 3, 5, 7, 10, 14];

export const PlanTripPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setActiveTrip } = useTripContext();
  const [step, setStep] = useState<number>(1);

  // Read URL query params (?destination=Goa&placeId=goa_fort_aguada)
  const queryDest = searchParams.get('destination');
  const queryPlaceId = searchParams.get('placeId');

  const initialCity = useMemo(() => {
    if (queryDest) {
      const resolved = resolveCanonicalDestination(queryDest);
      if (resolved) return resolved.destinationName;
    }
    return 'Goa';
  }, [queryDest]);

  // Step 1: Destination, Intercity Transport, Duration & Budget
  const [city, setCity] = useState<string>(initialCity);
  const [canonical, setCanonical] = useState<CanonicalDestination>(() => resolveCanonicalDestination(initialCity)!);
  const [tripDays, setTripDays] = useState<number>(3);
  const [startingAddress, setStartingAddress] = useState<string>(() => resolveCanonicalDestination(initialCity)!.suggestedStartingPoint.name);
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [availableHours, setAvailableHours] = useState<number>(8);
  const [travellers, setTravellers] = useState<number>(2);
  const [transportMode, setTransportMode] = useState<'cab' | 'public' | 'walking' | 'bicycle'>('cab');
  const [travelStyle, setTravelStyle] = useState<'relaxed' | 'balanced' | 'packed'>('balanced');

  // Part 1: Intercity Transport State
  const [originCity, setOriginCity] = useState<string>(initialCity === 'Delhi' ? 'Mumbai' : 'Delhi');
  const [intercityMode, setIntercityMode] = useState<IntercityTransportMode>('flight');
  const [tripType, setTripType] = useState<'round_trip' | 'one_way'>('round_trip');
  const [departureTime, setDepartureTime] = useState<string>('09:00');
  const [arrivalTimeDay1, setArrivalTimeDay1] = useState<string>('');
  const [returnDepartureTime, setReturnDepartureTime] = useState<string>('19:00');
  const [customIntercityCost, setCustomIntercityCost] = useState<string>('');

  // Part 2: Trip Budget State
  const [budgetEnabled, setBudgetEnabled] = useState<boolean>(true);
  const [budgetScope, setBudgetScope] = useState<'total' | 'per_person'>('total');
  const [budgetAmount, setBudgetAmount] = useState<number>(25000);
  const [currency, setCurrency] = useState<'INR' | 'USD' | 'EUR' | 'GBP'>('INR');
  const [budgetTier, setBudgetTier] = useState<BudgetStyleTier>('moderate');
  const [includeIntercityInBudget, setIncludeIntercityInBudget] = useState<boolean>(true);
  const [includeAccommodationInBudget, setIncludeAccommodationInBudget] = useState<boolean>(true);
  const [includeFoodInBudget, setIncludeFoodInBudget] = useState<boolean>(true);

  // Step 2: Preferences, Food & NLP
  const [selectedInterests, setSelectedInterests] = useState<string[]>([
    'Historical Monuments',
    'Food and Local Culture',
    'Nature and Landscapes'
  ]);
  const [crowdPreference, setCrowdPreference] = useState<'popular' | 'balanced' | 'avoid_crowded'>('balanced');
  const [discoveryPreference, setDiscoveryPreference] = useState<'popular' | 'balanced' | 'hidden_gems'>('balanced');
  const [walkingTolerance, setWalkingTolerance] = useState<'low' | 'moderate' | 'high'>('moderate');
  const [indoorOutdoorPreference, setIndoorOutdoorPreference] = useState<'any' | 'indoor' | 'outdoor'>('any');
  const [foodStyle, setFoodStyle] = useState<string>('local_cuisine');
  const [excludedCategories, setExcludedCategories] = useState<string[]>([]);
  const [dietaryPreference, setDietaryPreference] = useState<'all' | 'vegetarian' | 'vegan' | 'halal'>('all');
  const [naturalLanguageInput, setNaturalLanguageInput] = useState<string>('');

  // Step 3: Places & Review
  const [allDestinations, setAllDestinations] = useState<IndiaDestination[]>([]);
  const [selectedDestIds, setSelectedDestIds] = useState<string[]>([]);
  const [mustVisitIds, setMustVisitIds] = useState<string[]>([]);
  const [generating, setGenerating] = useState<boolean>(false);

  // Synchronize when query param changes
  useEffect(() => {
    if (queryDest) {
      const resolved = resolveCanonicalDestination(queryDest);
      if (resolved && resolved.destinationName !== city) {
        setCity(resolved.destinationName);
      }
    }
  }, [queryDest]);

  // Destination synchronization
  useEffect(() => {
    const resolved = resolveCanonicalDestination(city) || resolveCanonicalDestination('Goa')!;
    setCanonical(resolved);
    setStartingAddress(resolved.suggestedStartingPoint.name);

    const destinationMatches = INDIA_DESTINATIONS.filter(
      d =>
        d.destinationId === resolved.destinationId ||
        d.city.toLowerCase() === resolved.destinationName.toLowerCase()
    );

    setAllDestinations(destinationMatches);
    setSelectedDestIds(destinationMatches.map(d => d.id));

    // Only pre-pin a must-visit place if the user explicitly clicked "Plan Trip with this Place" (?placeId=...)
    // Do NOT pre-pin all catalog isMustVisit monuments, so personalization can freely rank candidates by user profile.
    const explicitMust: string[] = [];
    if (queryPlaceId && destinationMatches.some(d => d.id === queryPlaceId)) {
      explicitMust.push(queryPlaceId);
    }
    setMustVisitIds(explicitMust);
  }, [city, queryPlaceId]);

  const computedEndDate = useMemo(
    () => addDaysToDateStr(startDate, Math.max(0, tripDays - 1)),
    [startDate, tripDays]
  );

  // Live Intercity Estimate
  const liveIntercityEstimate = useMemo(() => {
    const parsedCustom = customIntercityCost.trim() !== '' ? Number(customIntercityCost) : undefined;
    return estimateIntercityTransport({
      mode: intercityMode,
      originCity,
      destinationCity: canonical.destinationName,
      departureDate: startDate,
      returnDate: computedEndDate,
      departureTime,
      arrivalTimeDay1: arrivalTimeDay1 || undefined,
      returnDepartureTime: returnDepartureTime || undefined,
      tripType,
      travellers,
      customEstimatedCostINR: parsedCustom !== undefined && !isNaN(parsedCustom) ? parsedCustom : undefined
    });
  }, [
    intercityMode,
    originCity,
    canonical.destinationName,
    startDate,
    computedEndDate,
    departureTime,
    arrivalTimeDay1,
    returnDepartureTime,
    tripType,
    travellers,
    customIntercityCost
  ]);

  // Live Budget Breakdown Preview
  const liveBudgetBreakdown = useMemo(() => {
    return calculateTripBudgetBreakdown({
      budgetConfig: {
        enabled: budgetEnabled,
        currency,
        budgetScope,
        amount: budgetAmount,
        travellers,
        tier: budgetTier,
        includeIntercityTransport: includeIntercityInBudget,
        includeAccommodation: includeAccommodationInBudget,
        includeFoodAndActivities: includeFoodInBudget
      },
      intercityEstimate: liveIntercityEstimate,
      days: tripDays,
      travellers,
      localTransportMode: transportMode
    });
  }, [
    budgetEnabled,
    currency,
    budgetScope,
    budgetAmount,
    travellers,
    budgetTier,
    includeIntercityInBudget,
    includeAccommodationInBudget,
    includeFoodInBudget,
    liveIntercityEstimate,
    tripDays,
    transportMode
  ]);

  const toggleInterest = (id: string) => {
    if (selectedInterests.includes(id)) {
      setSelectedInterests(selectedInterests.filter(i => i !== id));
    } else {
      setSelectedInterests([...selectedInterests, id]);
    }
  };

  const toggleSelectDest = (id: string) => {
    if (selectedDestIds.includes(id)) {
      setSelectedDestIds(selectedDestIds.filter(d => d !== id));
      setMustVisitIds(mustVisitIds.filter(m => m !== id));
    } else {
      setSelectedDestIds([...selectedDestIds, id]);
    }
  };

  const toggleMustVisit = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedDestIds.includes(id)) {
      setSelectedDestIds([...selectedDestIds, id]);
    }
    if (mustVisitIds.includes(id)) {
      setMustVisitIds(mustVisitIds.filter(m => m !== id));
    } else {
      setMustVisitIds([...mustVisitIds, id]);
    }
  };

  const handleGenerateItinerary = async () => {
    if (selectedDestIds.length === 0) {
      alert(`Please select at least 2 places in ${city} for your travel circuit.`);
      return;
    }

    setGenerating(true);
    try {
      const chosenCandidates = allDestinations.filter(d => selectedDestIds.includes(d.id));
      const parsedCustomCost =
        customIntercityCost.trim() !== '' ? Number(customIntercityCost) : undefined;

      const intercityTransportConfig = {
        mode: intercityMode,
        originCity,
        destinationCity: canonical.destinationName,
        departureDate: startDate,
        returnDate: computedEndDate,
        departureTime,
        arrivalTimeDay1: arrivalTimeDay1 || liveIntercityEstimate.recommendedArrivalTimeDay1,
        returnDepartureTime,
        tripType,
        travellers,
        customEstimatedCostINR:
          parsedCustomCost !== undefined && !isNaN(parsedCustomCost) ? parsedCustomCost : undefined
      };

      const budgetConfigObj = {
        enabled: budgetEnabled,
        currency,
        budgetScope,
        amount: budgetAmount,
        travellers,
        tier: budgetTier,
        includeIntercityTransport: includeIntercityInBudget,
        includeAccommodation: includeAccommodationInBudget,
        includeFoodAndActivities: includeFoodInBudget
      };

      const optimized = generateOptimizedItinerary({
        destination: canonical.destinationName,
        canonicalDestination: canonical,
        originCity,
        days: tripDays,
        startDate,
        endDate: computedEndDate,
        availableHoursPerDay: availableHours,
        startTime: '09:00',
        selectedInterests,
        freeTextInstructions: naturalLanguageInput,
        travelPace: travelStyle,
        crowdPreference,
        discoveryPreference,
        walkingTolerance,
        indoorOutdoorPreference,
        foodStyle,
        excludedCategories,
        budget: budgetEnabled ? liveBudgetBreakdown.totalBudget : 0,
        travellers,
        intercityTransport: intercityTransportConfig,
        budgetConfig: budgetConfigObj,
        transportMode,
        dietaryPreference,
        startingLocation: {
          lat: canonical.suggestedStartingPoint.lat,
          lng: canonical.suggestedStartingPoint.lng,
          address: startingAddress || canonical.suggestedStartingPoint.name
        },
        mustVisitPlaceIds: mustVisitIds,
        candidatePool: chosenCandidates.length >= 2 ? chosenCandidates : allDestinations,
        seedVariation: 0
      });

      setActiveTrip({
        tripId: optimized.tripId,
        destinationName: canonical.destinationName,
        destination: canonical,
        status: 'planned',
        preferences: {
          originCity,
          startDate,
          endDate: computedEndDate,
          tripDays,
          travellers,
          availableHours,
          travelStyle,
          crowdPreference,
          discoveryPreference,
          walkingTolerance,
          indoorOutdoorPreference,
          foodStyle,
          excludedCategories,
          transportMode,
          intercityTransport: intercityTransportConfig,
          budgetConfig: budgetConfigObj,
          dietaryPreference,
          interests: selectedInterests,
          freeTextPrompt: naturalLanguageInput,
          budget: budgetEnabled ? liveBudgetBreakdown.totalBudget : 0
        },
        itinerary: optimized,
        stops: optimized.stops,
        currentStopIndex: 0
      });

      navigate('/itinerary/preview');
    } catch (err: any) {
      alert(err.message || 'Error generating itinerary. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 animate-fade-in">
      {/* Stepper Header */}
      <div className="bg-white rounded-3xl border border-border p-6 sm:p-8 shadow-soft-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-deep-green/10 text-deep-green text-xs font-bold uppercase tracking-wider mb-2">
              <Compass className="w-3.5 h-3.5 text-terracotta" />
              <span>Smart Travel Studio</span>
            </div>
            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-text">
              Plan Your {originCity} → {city} Journey
            </h1>
            <p className="text-xs sm:text-sm text-text-muted mt-1 max-w-2xl">
              Transport-aware scheduling, multi-day geographic clustering (1 to 21+ days), and budget-optimized route planning.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {[
              { num: 1, label: 'Logistics & Budget' },
              { num: 2, label: 'Preferences' },
              { num: 3, label: 'Places' }
            ].map(s => (
              <div
                key={s.num}
                onClick={() => setStep(s.num)}
                className={`cursor-pointer flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  step === s.num
                    ? 'bg-deep-green text-white shadow-soft-sm'
                    : step > s.num
                    ? 'bg-sage/20 text-deep-green'
                    : 'bg-ivory text-text-subtle border border-border'
                }`}
              >
                <span>Step {s.num}: {s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Destination Hero Banner */}
        <div className="relative rounded-2xl overflow-hidden border border-border h-36 sm:h-44 flex items-end p-5 shadow-inner">
          <img
            src={canonical.heroImageUrl}
            alt={canonical.destinationName}
            className="absolute inset-0 w-full h-full object-cover brightness-[0.7]"
          />
          <div className="relative z-10 text-white space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-widest text-sage-light bg-black/40 px-2.5 py-0.5 rounded-full backdrop-blur-sm">
              Target Destination: {canonical.destinationName}, {canonical.state} • Ideal: {canonical.recommendedDurationDays}
            </span>
            <h2 className="font-serif text-xl sm:text-2xl font-bold">
              {canonical.tagline}
            </h2>
            <p className="text-xs text-white/80">
              Popular Circuits: {canonical.popularAreas.join(' • ')}
            </p>
          </div>
        </div>
      </div>

      {/* STEP 1: DESTINATION, INTERCITY TRANSPORT, DURATION & BUDGET */}
      {step === 1 && (
        <div className="space-y-8">
          {/* SECTION 1A: DESTINATION, DATES & EXTENDED DURATION */}
          <div className="bg-white rounded-3xl border border-border p-6 sm:p-8 shadow-soft-sm space-y-6">
            <div className="pb-4 border-b border-border">
              <h3 className="font-serif text-2xl font-bold text-text">
                1. Destination, Dates & Trip Duration
              </h3>
              <p className="text-xs text-text-muted mt-0.5">
                Choose your destination hub, number of travellers, and trip length (supports 1 to 21+ days).
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Origin City */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text mb-1.5">
                  Starting / Origin City
                </label>
                <input
                  type="text"
                  list="origin-cities-list"
                  value={originCity}
                  onChange={e => setOriginCity(e.target.value)}
                  placeholder="e.g. Delhi, Mumbai, Bengaluru"
                  className="w-full bg-ivory border border-border rounded-xl px-4 py-3 text-xs font-bold text-text focus:outline-none focus:border-deep-green"
                />
                <datalist id="origin-cities-list">
                  {POPULAR_ORIGIN_CITIES.map(c => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
                <p className="text-[11px] text-text-subtle mt-1">
                  Used for intercity travel time & cost estimation.
                </p>
              </div>

              {/* Destination City */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text mb-1.5">
                  Destination Hub in India
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-terracotta absolute left-3.5 top-3.5" />
                  <select
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    className="w-full bg-ivory border border-border rounded-xl pl-10 pr-4 py-3 text-xs font-bold text-text focus:outline-none focus:border-deep-green transition-all"
                  >
                    {AVAILABLE_CITIES.map(c => (
                      <option key={c} value={c}>
                        {c} — Iconic Hub
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-[11px] text-text-subtle mt-1">
                  All sightseeing stops are strictly verified inside {city}.
                </p>
              </div>

              {/* Number of Travellers */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text mb-1.5">
                  Number of Travellers ({travellers})
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 6].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setTravellers(n)}
                      className={`flex-1 py-3 rounded-xl border text-xs font-bold transition-all ${
                        travellers === n
                          ? 'bg-deep-green text-white border-deep-green'
                          : 'bg-ivory text-text border-border hover:bg-ivory-dark'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                  <input
                    type="number"
                    min={1}
                    max={25}
                    value={travellers}
                    onChange={e => setTravellers(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-16 bg-ivory border border-border rounded-xl px-2.5 py-3 text-xs font-bold text-center text-text"
                    title="Custom group size"
                  />
                </div>
              </div>
            </div>

            {/* Extended Trip Duration (Part 3: 1 to 21+ Days) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
              <div className="lg:col-span-7">
                <label className="block text-xs font-bold uppercase tracking-wider text-text mb-1.5">
                  Trip Duration: <span className="text-deep-green">{tripDays} {tripDays === 1 ? 'Day' : 'Days'}</span> ({startDate} → {computedEndDate})
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {DURATION_PRESETS.map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setTripDays(d)}
                      className={`px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                        tripDays === d
                          ? 'bg-deep-green text-white border-deep-green shadow-soft-sm'
                          : 'bg-ivory hover:bg-ivory-dark text-text border-border'
                      }`}
                    >
                      {d} {d === 1 ? 'Day' : 'Days'}
                    </button>
                  ))}
                  <div className="flex items-center gap-1.5 bg-ivory border border-border rounded-xl px-3 py-1.5">
                    <span className="text-[11px] font-bold text-text-muted">Custom Days:</span>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={tripDays}
                      onChange={e => setTripDays(Math.max(1, Math.min(30, parseInt(e.target.value, 10) || 1)))}
                      className="w-14 bg-white border border-border rounded-lg px-2 py-1 text-xs font-bold text-center text-deep-green"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-text-subtle mt-1.5">
                  Supports short getaways (1–4 days) and extended stays (6, 10, 14+ days) with zero duplicate attractions and balanced neighborhood immersion days.
                </p>
              </div>

              <div className="lg:col-span-5 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-text mb-1.5">
                    Departure / Start Date
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-text-subtle absolute left-3 top-3.5" />
                    <input
                      type="date"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      className="w-full bg-ivory border border-border rounded-xl pl-9 pr-3 py-3 text-xs font-medium text-text focus:outline-none focus:border-deep-green"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-text mb-1.5">
                    Hotel / Base in {city}
                  </label>
                  <input
                    type="text"
                    value={startingAddress}
                    onChange={e => setStartingAddress(e.target.value)}
                    placeholder={canonical.suggestedStartingPoint.name}
                    className="w-full bg-ivory border border-border rounded-xl px-3.5 py-3 text-xs font-medium text-text focus:outline-none focus:border-deep-green"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 1B: INTERCITY TRANSPORT MODE (PART 1) */}
          <div className="bg-white rounded-3xl border border-border p-6 sm:p-8 shadow-soft-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-border">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-terracotta bg-terracotta/10 px-2.5 py-0.5 rounded-full">
                  Intercity Travel Planner
                </span>
                <h3 className="font-serif text-2xl font-bold text-text mt-1">
                  2. How Are You Travelling to {city}?
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Your intercity arrival & departure times automatically adjust Day 1 and Final Day sightseeing schedules.
                </p>
              </div>

              {/* One-Way vs Round Trip */}
              <div className="inline-flex bg-ivory border border-border rounded-xl p-1 self-start">
                <button
                  type="button"
                  onClick={() => setTripType('round_trip')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    tripType === 'round_trip' ? 'bg-deep-green text-white' : 'text-text-muted'
                  }`}
                >
                  Round Trip
                </button>
                <button
                  type="button"
                  onClick={() => setTripType('one_way')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    tripType === 'one_way' ? 'bg-deep-green text-white' : 'text-text-muted'
                  }`}
                >
                  One-Way
                </button>
              </div>
            </div>

            {/* Mode Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
              {INTERCITY_MODES.map(m => {
                const Icon = m.icon;
                const active = intercityMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setIntercityMode(m.id)}
                    className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                      active
                        ? 'bg-deep-green text-white border-deep-green shadow-soft-sm'
                        : 'bg-ivory hover:bg-ivory-dark text-text border-border'
                    }`}
                  >
                    <Icon className={`w-4 h-4 mb-2 ${active ? 'text-sage-light' : 'text-terracotta'}`} />
                    <div>
                      <div className="text-xs font-bold leading-tight">{m.label}</div>
                      <div className={`text-[10px] mt-1 leading-snug ${active ? 'text-ivory/80' : 'text-text-subtle'}`}>
                        {m.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Optional Timings & Confirmed Cost Override */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-text-muted mb-1">
                  Day 1 Arrival Time in {city} (Optional)
                </label>
                <input
                  type="time"
                  value={arrivalTimeDay1}
                  onChange={e => setArrivalTimeDay1(e.target.value)}
                  className="w-full bg-ivory border border-border rounded-xl px-3.5 py-2.5 text-xs font-bold text-text"
                />
                <span className="text-[10px] text-text-subtle mt-0.5 block">
                  Default estimate: {liveIntercityEstimate.recommendedArrivalTimeDay1} (Sightseeing starts {liveIntercityEstimate.recommendedSightseeingStartDay1})
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-text-muted mb-1">
                  Origin Departure Time (Optional)
                </label>
                <input
                  type="time"
                  value={departureTime}
                  onChange={e => setDepartureTime(e.target.value)}
                  className="w-full bg-ivory border border-border rounded-xl px-3.5 py-2.5 text-xs font-bold text-text"
                />
              </div>

              {tripType === 'round_trip' && (
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-text-muted mb-1">
                    Return Departure Time (Final Day)
                  </label>
                  <input
                    type="time"
                    value={returnDepartureTime}
                    onChange={e => setReturnDepartureTime(e.target.value)}
                    className="w-full bg-ivory border border-border rounded-xl px-3.5 py-2.5 text-xs font-bold text-text"
                  />
                  <span className="text-[10px] text-text-subtle mt-0.5 block">
                    Final day sights end by {liveIntercityEstimate.recommendedFinalDayCutoff}
                  </span>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-text-muted mb-1">
                  Confirmed Ticket Cost (₹ Optional)
                </label>
                <input
                  type="number"
                  min={0}
                  value={customIntercityCost}
                  onChange={e => setCustomIntercityCost(e.target.value)}
                  placeholder={`Est. ₹${liveIntercityEstimate.estimatedTotalCostINR}`}
                  className="w-full bg-ivory border border-border rounded-xl px-3.5 py-2.5 text-xs font-bold text-text"
                />
                <span className="text-[10px] text-text-subtle mt-0.5 block">
                  Leave blank to use route estimate
                </span>
              </div>
            </div>

            {/* Live Intercity Estimate Summary Card */}
            <div className="bg-ivory/90 rounded-2xl p-4 border border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-deep-green">
                    {liveIntercityEstimate.originCity} → {liveIntercityEstimate.destinationCity} ({liveIntercityEstimate.modeLabel})
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                    Estimated Transit
                  </span>
                </div>
                <p className="text-xs text-text-muted">
                  Distance: ~{liveIntercityEstimate.approxDistanceKm} km • Duration: {liveIntercityEstimate.durationLabel} • {liveIntercityEstimate.advisoryNote}
                </p>
              </div>

              <div className="flex items-center gap-4 shrink-0">
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-text-subtle block">
                    Est. {tripType === 'round_trip' ? 'Round-Trip' : 'One-Way'} ({travellers} Pax)
                  </span>
                  <span className="text-base font-serif font-bold text-deep-green">
                    ₹{liveIntercityEstimate.estimatedTotalCostINR.toLocaleString('en-IN')}
                  </span>
                </div>

                {liveIntercityEstimate.bookingReferenceUrl && (
                  <a
                    href={liveIntercityEstimate.bookingReferenceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-2 rounded-xl bg-white border border-border hover:border-deep-green text-xs font-bold text-deep-green flex items-center gap-1.5"
                  >
                    {liveIntercityEstimate.bookingPortalName?.split('/')[0]} <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 1C: TRIP BUDGET & EXPENSE PLANNER (PART 2) */}
          <div className="bg-white rounded-3xl border border-border p-6 sm:p-8 shadow-soft-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-deep-green bg-sage/20 px-2.5 py-0.5 rounded-full">
                  Budget-Aware Optimizer
                </span>
                <h3 className="font-serif text-2xl font-bold text-text mt-1 flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-terracotta" />
                  3. Trip Budget & Comfort Tier
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Your budget shapes attraction selection, dining recommendations, and daily expense breakdown.
                </p>
              </div>

              <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-bold text-text">
                <input
                  type="checkbox"
                  checked={budgetEnabled}
                  onChange={e => setBudgetEnabled(e.target.checked)}
                  className="rounded text-deep-green focus:ring-deep-green w-4 h-4"
                />
                Enable Budget Constraint
              </label>
            </div>

            {budgetEnabled && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Budget Scope & Amount */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-text">
                        Planned Budget ({currency})
                      </label>
                      <div className="inline-flex bg-ivory rounded-lg p-0.5 border border-border text-[10px] font-bold">
                        <button
                          type="button"
                          onClick={() => setBudgetScope('total')}
                          className={`px-2 py-0.5 rounded-md ${
                            budgetScope === 'total' ? 'bg-deep-green text-white' : 'text-text-muted'
                          }`}
                        >
                          Total Group
                        </button>
                        <button
                          type="button"
                          onClick={() => setBudgetScope('per_person')}
                          className={`px-2 py-0.5 rounded-md ${
                            budgetScope === 'per_person' ? 'bg-deep-green text-white' : 'text-text-muted'
                          }`}
                        >
                          Per Person
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={currency}
                        onChange={e => setCurrency(e.target.value as any)}
                        className="bg-ivory border border-border rounded-xl px-3 py-3 text-xs font-bold text-text"
                      >
                        <option value="INR">₹ INR</option>
                        <option value="USD">$ USD</option>
                        <option value="EUR">€ EUR</option>
                        <option value="GBP">£ GBP</option>
                      </select>
                      <input
                        type="number"
                        min={1000}
                        step={500}
                        value={budgetAmount}
                        onChange={e => setBudgetAmount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="flex-1 bg-ivory border border-border rounded-xl px-4 py-3 text-sm font-bold text-text focus:outline-none focus:border-deep-green"
                      />
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {[5000, 12000, 25000, 50000, 85000].map(preset => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setBudgetAmount(preset)}
                          className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-ivory hover:bg-ivory-dark border border-border text-text-muted"
                        >
                          ₹{preset.toLocaleString('en-IN')}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Budget Style Tier */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-text mb-1.5">
                      Travel Comfort & Budget Style
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {(
                        [
                          { id: 'budget', label: 'Budget / Backpacker', desc: 'Free heritage sites, street eats & public transit' },
                          { id: 'moderate', label: 'Moderate Value', desc: '3-star stays, iconic monuments & local cafes' },
                          { id: 'premium', label: 'Premium Comfort', desc: 'Boutique stays, private cab & curated dining' },
                          { id: 'luxury', label: 'Royal Luxury', desc: 'Heritage palace hotels & fine dining' }
                        ] as const
                      ).map(t => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setBudgetTier(t.id)}
                          className={`p-3 rounded-2xl border text-left transition-all ${
                            budgetTier === t.id
                              ? 'bg-deep-green text-white border-deep-green shadow-soft-sm'
                              : 'bg-ivory hover:bg-ivory-dark text-text border-border'
                          }`}
                        >
                          <div className="text-xs font-bold">{t.label}</div>
                          <div className={`text-[10px] mt-1 leading-snug ${budgetTier === t.id ? 'text-ivory/80' : 'text-text-subtle'}`}>
                            {t.desc}
                          </div>
                        </button>
                      ))}
                    </div>

                    {/* Inclusion Checkboxes */}
                    <div className="flex flex-wrap items-center gap-5 mt-3 pt-2">
                      <label className="inline-flex items-center gap-2 text-xs font-medium text-text cursor-pointer">
                        <input
                          type="checkbox"
                          checked={includeIntercityInBudget}
                          onChange={e => setIncludeIntercityInBudget(e.target.checked)}
                          className="rounded text-deep-green"
                        />
                        Include Intercity Transport
                      </label>
                      <label className="inline-flex items-center gap-2 text-xs font-medium text-text cursor-pointer">
                        <input
                          type="checkbox"
                          checked={includeAccommodationInBudget}
                          onChange={e => setIncludeAccommodationInBudget(e.target.checked)}
                          className="rounded text-deep-green"
                        />
                        Include Accommodation ({Math.max(0, tripDays - 1)} Nights)
                      </label>
                      <label className="inline-flex items-center gap-2 text-xs font-medium text-text cursor-pointer">
                        <input
                          type="checkbox"
                          checked={includeFoodInBudget}
                          onChange={e => setIncludeFoodInBudget(e.target.checked)}
                          className="rounded text-deep-green"
                        />
                        Include Food & Attractions
                      </label>
                    </div>
                  </div>
                </div>

                {/* Live Estimated Breakdown Bar */}
                <div className="bg-ivory/90 rounded-2xl p-4 sm:p-5 border border-border space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-charcoal">
                        Estimated {tripDays}-Day Expense Breakdown ({travellers} {travellers === 1 ? 'Traveller' : 'Travellers'})
                      </span>
                      <span className="text-[11px] text-text-subtle block">
                        All figures clearly labeled as pre-trip estimates • Per Person: ₹{liveBudgetBreakdown.estimatedExpenses.perPersonEstimated.toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-bold text-text-muted mr-3">
                        Est. Total: <strong className="text-charcoal">₹{liveBudgetBreakdown.estimatedExpenses.totalEstimated.toLocaleString('en-IN')}</strong>
                      </span>
                      <span
                        className={`text-xs font-bold px-3 py-1 rounded-full ${
                          liveBudgetBreakdown.isEstimatedOverBudget
                            ? 'bg-red-100 text-red-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {liveBudgetBreakdown.isEstimatedOverBudget
                          ? `Over Budget by ₹${liveBudgetBreakdown.overBudgetAmount.toLocaleString('en-IN')}`
                          : `₹${liveBudgetBreakdown.remainingEstimatedBudget.toLocaleString('en-IN')} Remaining`}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 text-xs">
                    {[
                      { label: 'Intercity Transit', val: liveBudgetBreakdown.estimatedExpenses.intercityTransport },
                      { label: 'Accommodation', val: liveBudgetBreakdown.estimatedExpenses.accommodation },
                      { label: 'Local Transport', val: liveBudgetBreakdown.estimatedExpenses.localTransport },
                      { label: 'Food & Dining', val: liveBudgetBreakdown.estimatedExpenses.food },
                      { label: 'Attractions', val: liveBudgetBreakdown.estimatedExpenses.attractions },
                      { label: 'Miscellaneous', val: liveBudgetBreakdown.estimatedExpenses.miscellaneous }
                    ].map(item => (
                      <div key={item.label} className="bg-white p-2.5 rounded-xl border border-border/80">
                        <span className="text-[10px] text-text-subtle uppercase font-bold block truncate">
                          {item.label}
                        </span>
                        <span className="font-bold text-charcoal mt-0.5 block">
                          ₹{item.val.toLocaleString('en-IN')}
                        </span>
                      </div>
                    ))}
                  </div>

                  {liveBudgetBreakdown.isEstimatedOverBudget && (
                    <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1.5">
                      <div className="font-bold flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        {liveBudgetBreakdown.warnings[0]}
                      </div>
                      {liveBudgetBreakdown.savingSuggestions.length > 0 && (
                        <ul className="list-disc list-inside text-[11px] space-y-0.5 text-amber-800">
                          {liveBudgetBreakdown.savingSuggestions.map((s, idx) => (
                            <li key={idx}>{s}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* SECTION 1D: LOCAL DESTINATION TRANSPORT & PACE */}
          <div className="bg-white rounded-3xl border border-border p-6 sm:p-8 shadow-soft-sm space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Travel Pace */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text mb-2">
                  4. Daily Sightseeing Pace
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[
                    { id: 'relaxed', label: 'Relaxed', desc: '3 sights/day + long cafe breaks' },
                    { id: 'balanced', label: 'Balanced', desc: '4 sights/day + lunch circuit' },
                    { id: 'packed', label: 'Packed', desc: '5 sights/day high density' }
                  ].map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setTravelStyle(p.id as any)}
                      className={`p-3.5 rounded-2xl border text-left transition-all ${
                        travelStyle === p.id
                          ? 'bg-deep-green text-white border-deep-green shadow-soft-sm'
                          : 'bg-ivory hover:bg-ivory-dark text-text border-border'
                      }`}
                    >
                      <div className="text-xs font-bold">{p.label}</div>
                      <div className={`text-[10px] mt-1 ${travelStyle === p.id ? 'text-ivory/80' : 'text-text-muted'}`}>
                        {p.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Local Transport within Destination */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text mb-2">
                  5. Local Transport Within {city}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    { id: 'cab', label: 'Local Cab / Auto', icon: Car, speed: '~22 km/h' },
                    { id: 'public', label: 'Metro / Local Bus', icon: Train, speed: '~18 km/h' },
                    { id: 'walking', label: 'Walking Trail', icon: Footprints, speed: '~4.5 km/h' },
                    { id: 'bicycle', label: 'Scooter / Cycle', icon: Bike, speed: '~12 km/h' }
                  ].map(t => {
                    const Icon = t.icon;
                    const isSelected = transportMode === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTransportMode(t.id as any)}
                        className={`p-3 rounded-2xl border text-center transition-all ${
                          isSelected
                            ? 'bg-deep-green text-white border-deep-green shadow-soft-sm'
                            : 'bg-ivory hover:bg-ivory-dark text-text border-border'
                        }`}
                      >
                        <Icon className="w-4 h-4 mx-auto mb-1" />
                        <div className="text-[11px] font-bold">{t.label}</div>
                        <div className={`text-[10px] ${isSelected ? 'text-ivory/80' : 'text-text-subtle'}`}>
                          {t.speed}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-border">
              <Button
                variant="outline"
                size="lg"
                loading={generating}
                onClick={handleGenerateItinerary}
                icon={<Sparkles className="w-4 h-4 text-terracotta" />}
              >
                Quick Generate {tripDays}-Day {city} Itinerary
              </Button>
              <Button
                variant="primary"
                size="lg"
                onClick={() => setStep(2)}
                icon={<ArrowRight className="w-4 h-4" />}
              >
                Next: Interests & Dining Preferences
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: PREFERENCES, FOOD & NLP */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-border p-6 sm:p-8 shadow-soft-sm space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-serif text-xl sm:text-2xl font-bold text-text">
                  Travel Interests & Sights
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Pick any themes that inspire your voyage in {city}.
                </p>
              </div>
              <span className="text-xs font-semibold text-deep-green bg-sage/20 px-3 py-1 rounded-xl">
                {selectedInterests.length} selected
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {INTEREST_CARDS.map(item => {
                const isSelected = selectedInterests.includes(item.id);
                return (
                  <div
                    key={item.id}
                    onClick={() => toggleInterest(item.id)}
                    className={`cursor-pointer rounded-2xl p-4.5 transition-all border flex items-start gap-3.5 select-none h-full ${
                      isSelected
                        ? 'bg-sage/15 border-deep-green shadow-soft-sm'
                        : 'bg-ivory/60 hover:bg-ivory border-border hover:border-sandstone'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-white border border-border flex items-center justify-center text-xl flex-shrink-0 shadow-sm">
                      {item.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-text truncate">
                          {item.label}
                        </span>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-deep-green flex-shrink-0" />}
                      </div>
                      <p className="text-[11px] text-text-muted mt-1 leading-snug">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Food & Dining Preferences Section */}
            <div className="pt-6 border-t border-border space-y-4">
              <div className="flex items-center gap-2">
                <UtensilsCrossed className="w-4 h-4 text-terracotta" />
                <h4 className="font-serif font-bold text-base text-text">
                  Intelligent Food, Restaurant & Cafe Preferences
                </h4>
              </div>
              <p className="text-xs text-text-muted">
                Journeo automatically schedules meal stops (lunch 12:15–14:15, morning cafes) along your route without backtracking.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                {DIETARY_OPTIONS.map(diet => {
                  const isSelected = dietaryPreference === diet.id;
                  return (
                    <div
                      key={diet.id}
                      onClick={() => setDietaryPreference(diet.id as any)}
                      className={`cursor-pointer rounded-2xl p-4 border transition-all select-none ${
                        isSelected
                          ? 'bg-deep-green text-white border-deep-green shadow-soft-sm'
                          : 'bg-ivory hover:bg-ivory-dark text-text border-border'
                      }`}
                    >
                      <div className="text-xs font-bold">{diet.label}</div>
                      <div className={`text-[10px] mt-1 ${isSelected ? 'text-ivory/80' : 'text-text-muted'}`}>
                        {diet.desc}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Phase 7 Advanced Personalization: Crowd Tolerance, Discovery Style, Walking & Exclusions */}
            <div className="pt-6 border-t border-border space-y-5">
              <div>
                <h4 className="font-serif font-bold text-base text-text">
                  Personalization & Discovery Style
                </h4>
                <p className="text-xs text-text-muted mt-0.5">
                  Fine-tune how Journeo ranks iconic landmarks versus uncrowded hidden gems, walking intensity, and excluded categories.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Crowd & Discovery Preference */}
                <div className="bg-ivory/70 rounded-2xl p-4 border border-border space-y-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-text">
                    Crowd & Discovery Style
                  </label>
                  <div className="grid grid-cols-1 gap-1.5">
                    {[
                      { id: 'popular', disc: 'popular', label: 'Popular Icons First', desc: 'Must-see UNESCO & headline monuments' },
                      { id: 'balanced', disc: 'balanced', label: 'Balanced Mix', desc: 'Blend of signature sights & local spots' },
                      { id: 'avoid_crowded', disc: 'hidden_gems', label: 'Hidden Gems (Avoid Crowds)', desc: 'Offbeat stepwells, quiet lanes & peaceful spots' }
                    ].map(opt => {
                      const active = crowdPreference === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setCrowdPreference(opt.id as any);
                            setDiscoveryPreference(opt.disc as any);
                          }}
                          className={`p-2.5 rounded-xl border text-left transition-all ${
                            active
                              ? 'bg-deep-green text-white border-deep-green'
                              : 'bg-white hover:bg-ivory text-text border-border'
                          }`}
                        >
                          <div className="text-xs font-bold">{opt.label}</div>
                          <div className={`text-[10px] ${active ? 'text-ivory/80' : 'text-text-muted'}`}>{opt.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Culinary Focus & Walking Tolerance */}
                <div className="bg-ivory/70 rounded-2xl p-4 border border-border space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-text mb-1.5">
                      Culinary & Cafe Focus
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { id: 'local_cuisine', label: 'Regional Thalis' },
                        { id: 'street_food', label: 'Street Food & Chaat' },
                        { id: 'cafes', label: 'Artisanal Cafes' },
                        { id: 'fine_dining', label: 'Heritage Dining' }
                      ].map(f => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setFoodStyle(f.id)}
                          className={`px-2.5 py-2 rounded-xl border text-[11px] font-bold transition-all ${
                            foodStyle === f.id
                              ? 'bg-deep-green text-white border-deep-green'
                              : 'bg-white text-text border-border hover:bg-ivory'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-text mb-1.5">
                      Walking Tolerance
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { id: 'low', label: 'Low / Easy' },
                        { id: 'moderate', label: 'Moderate' },
                        { id: 'high', label: 'High (Walks)' }
                      ].map(w => (
                        <button
                          key={w.id}
                          type="button"
                          onClick={() => setWalkingTolerance(w.id as any)}
                          className={`px-2 py-2 rounded-xl border text-[11px] font-bold transition-all ${
                            walkingTolerance === w.id
                              ? 'bg-deep-green text-white border-deep-green'
                              : 'bg-white text-text border-border hover:bg-ivory'
                          }`}
                        >
                          {w.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Indoor/Outdoor & Categories to Avoid */}
                <div className="bg-ivory/70 rounded-2xl p-4 border border-border space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-text mb-1.5">
                      Setting Preference
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { id: 'any', label: 'Any Mix' },
                        { id: 'outdoor', label: 'Outdoor' },
                        { id: 'indoor', label: 'Indoor / Shaded' }
                      ].map(io => (
                        <button
                          key={io.id}
                          type="button"
                          onClick={() => setIndoorOutdoorPreference(io.id as any)}
                          className={`px-2 py-2 rounded-xl border text-[11px] font-bold transition-all ${
                            indoorOutdoorPreference === io.id
                              ? 'bg-deep-green text-white border-deep-green'
                              : 'bg-white text-text border-border hover:bg-ivory'
                          }`}
                        >
                          {io.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-text mb-1.5">
                      Exclude / Avoid Categories
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {['Museum', 'Shopping', 'Spiritual', 'Heritage'].map(cat => {
                        const isExcl = excludedCategories.includes(cat);
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() =>
                              setExcludedCategories(prev =>
                                prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
                              )
                            }
                            className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-all ${
                              isExcl
                                ? 'bg-red-700 text-white border-red-700'
                                : 'bg-white text-text-muted border-border hover:border-red-300'
                            }`}
                          >
                            {isExcl ? `✕ No ${cat}s` : `Avoid ${cat}s`}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Free-Text NLP Instructions */}
            <div className="pt-6 border-t border-border space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-text flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-deep-green" />
                  Free-Text Custom Instructions (Natural Language)
                </label>
                <span className="text-[11px] font-bold text-terracotta bg-terracotta/10 px-2.5 py-0.5 rounded-full">
                  NLP Parser Active
                </span>
              </div>

              <textarea
                rows={3}
                placeholder="e.g., I want a relaxed trip to Goa with Portuguese churches, authentic Goan fish curry, seaside sunset points, and quiet cafes. Avoid crowded tourist markets."
                value={naturalLanguageInput}
                onChange={e => setNaturalLanguageInput(e.target.value)}
                className="w-full bg-ivory border border-border rounded-2xl p-4 text-xs sm:text-sm text-text placeholder:text-text-subtle focus:outline-none focus:border-deep-green focus:ring-1 focus:ring-deep-green transition-all leading-relaxed"
              />
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-border">
              <Button variant="outline" onClick={() => setStep(1)} icon={<ArrowLeft className="w-4 h-4" />}>
                Back to Logistics & Budget
              </Button>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <Button
                  variant="outline"
                  size="lg"
                  loading={generating}
                  onClick={handleGenerateItinerary}
                  icon={<Sparkles className="w-4 h-4 text-terracotta" />}
                >
                  Generate {city} Itinerary Now
                </Button>
                <Button variant="primary" size="lg" onClick={() => setStep(3)} icon={<ArrowRight className="w-4 h-4" />}>
                  Review Places in {city}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: CANDIDATES IN DESTINATION & GENERATE */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-border p-6 sm:p-8 shadow-soft-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
              <div>
                <h3 className="font-serif text-2xl font-bold text-text">
                  Verified Places & Food Venues in {city}
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Every place is strictly verified for {canonical.destinationName} with official heritage & dining metadata.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-deep-green bg-sage/20 px-3 py-1.5 rounded-xl">
                  {selectedDestIds.length} Places Selected
                </span>
                <Button
                  variant="primary"
                  size="md"
                  loading={generating}
                  onClick={handleGenerateItinerary}
                  icon={<Sparkles className="w-4 h-4 text-sage-light" />}
                >
                  Generate Optimized Itinerary
                </Button>
              </div>
            </div>

            {/* Candidate Controls */}
            <div className="flex items-center justify-between pt-4 pb-2 text-xs">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedDestIds(allDestinations.map(d => d.id))}
                  className="font-bold text-deep-green hover:underline"
                >
                  Select All ({allDestinations.length})
                </button>
                <span className="text-border">|</span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDestIds([]);
                    setMustVisitIds([]);
                  }}
                  className="text-text-muted hover:text-text hover:underline"
                >
                  Clear Selection
                </button>
              </div>
              <span className="text-text-subtle text-[11px]">
                Target Bounding Box: {canonical.bounds.minLat}°N - {canonical.bounds.maxLat}°N
              </span>
            </div>

            {/* Places Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {allDestinations.map(dest => {
                const isSelected = selectedDestIds.includes(dest.id);
                const isMust = mustVisitIds.includes(dest.id);

                return (
                  <div
                    key={dest.id}
                    onClick={() => toggleSelectDest(dest.id)}
                    className={`cursor-pointer rounded-2xl p-4 transition-all border flex gap-4 select-none ${
                      isSelected
                        ? 'bg-white border-deep-green shadow-soft-md'
                        : 'bg-ivory/50 hover:bg-ivory border-border hover:border-sandstone opacity-80'
                    }`}
                  >
                    <img
                      src={dest.imageUrl}
                      alt={dest.name}
                      className="w-24 h-24 rounded-xl object-cover border border-border flex-shrink-0"
                    />

                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                              dest.isMealStop ? 'text-amber-800 bg-amber-100' : 'text-terracotta bg-terracotta/10'
                            }`}
                          >
                            {dest.isMealStop ? `🍽️ ${dest.cuisineType || 'Dining'}` : dest.category}
                          </span>
                          {!dest.isMealStop && (
                            <button
                              type="button"
                              onClick={e => toggleMustVisit(dest.id, e)}
                              className={`p-1 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-bold ${
                                isMust
                                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                  : 'text-text-subtle hover:text-amber-700 hover:bg-amber-50'
                              }`}
                              title="Toggle Must-Visit Priority"
                            >
                              <Star className={`w-3.5 h-3.5 ${isMust ? 'fill-amber-500 text-amber-600' : ''}`} />
                              <span>{isMust ? 'Must-Visit' : 'Mark Must'}</span>
                            </button>
                          )}
                        </div>

                        <h4 className="font-serif font-bold text-sm text-text mt-1.5 leading-snug truncate">
                          {dest.name}
                        </h4>
                        <p className="text-[11px] text-text-muted mt-1 line-clamp-2">
                          {dest.description}
                        </p>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-text-subtle pt-2 border-t border-border/60 mt-2">
                        <span className="flex items-center gap-1 font-semibold text-text">
                          <Clock className="w-3.5 h-3.5 text-deep-green" />
                          {dest.averageVisitDuration || 90} mins
                        </span>
                        <span>
                          {dest.isMealStop
                            ? `~₹${dest.averageCostPerPersonINR || 400}/person`
                            : dest.entryFeeINR === 0
                            ? 'Free Entry'
                            : `₹${dest.entryFeeINR} Entry`}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between items-center pt-8 border-t border-border mt-6">
              <Button variant="outline" onClick={() => setStep(2)} icon={<ArrowLeft className="w-4 h-4" />}>
                Back to Preferences
              </Button>
              <Button
                variant="primary"
                size="lg"
                loading={generating}
                onClick={handleGenerateItinerary}
                icon={<Sparkles className="w-4 h-4 text-sage-light" />}
              >
                {generating ? `Optimizing ${city} Circuit...` : `Generate My ${tripDays}-Day ${city} Itinerary`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

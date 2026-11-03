export interface CanonicalDestination {
  destinationId: string;
  destinationName: string;
  state: string;
  country: string;
  center: {
    lat: number;
    lng: number;
  };
  bounds: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  };
  suggestedStartingPoint: {
    name: string;
    address: string;
    lat: number;
    lng: number;
  };
  heroImageUrl: string;
  tagline: string;
  popularAreas: string[];
  categories: string[];
  recommendedDurationDays: string;
  bestTimeToVisit: string;
  overview: string;
  travelTips: string[];
}

export const DESTINATION_DISCOVERY_CATEGORIES = [
  'All',
  'Heritage',
  'Beaches',
  'Nature & Hills',
  'Religious & Spiritual',
  'Food Destinations',
  'Adventure',
  'Cultural Hubs',
  'Hidden Gems'
] as const;

export const CANONICAL_DESTINATIONS: Record<string, CanonicalDestination> = {
  delhi: {
    destinationId: 'delhi',
    destinationName: 'Delhi',
    state: 'Delhi NCR',
    country: 'India',
    center: { lat: 28.6139, lng: 77.2090 },
    bounds: { minLat: 28.40, maxLat: 28.88, minLng: 76.84, maxLng: 77.40 },
    suggestedStartingPoint: {
      name: 'Connaught Place Central Hub',
      address: 'Inner Circle, Connaught Place, New Delhi',
      lat: 28.6328,
      lng: 77.2197
    },
    heroImageUrl: 'https://images.unsplash.com/photo-1587474260584-136574528ed5?auto=format&fit=crop&w=1200&q=80',
    tagline: 'Heart of Empires, Monumental Mughal Citadels & Spice Bazaars',
    popularAreas: ['Old Delhi', 'Central Delhi', 'South Delhi', 'Mehrauli'],
    categories: ['Heritage', 'Food Destinations', 'Cultural Hubs', 'Hidden Gems'],
    recommendedDurationDays: '3 - 5 Days',
    bestTimeToVisit: 'October to March',
    overview:
      'India’s historic capital layers seven centuries of Sultanate, Mughal, and Lutyens architecture alongside bustling Old Delhi spice bazaars, stepwells, and leafy heritage parks.',
    travelTips: [
      'Use the Delhi Metro (Yellow & Violet Lines) to bypass Old Delhi road congestion.',
      'Red Fort and several museums are closed on Mondays; plan Central/South Delhi parks on Monday.',
      'Carry modest attire or a scarf when visiting Jama Masjid and Gurudwara Bangla Sahib.'
    ]
  },
  jaipur: {
    destinationId: 'jaipur',
    destinationName: 'Jaipur',
    state: 'Rajasthan',
    country: 'India',
    center: { lat: 26.9124, lng: 75.7873 },
    bounds: { minLat: 26.75, maxLat: 27.05, minLng: 75.70, maxLng: 75.92 },
    suggestedStartingPoint: {
      name: 'MI Road Heritage Gateway',
      address: 'Panch Batti, M.I. Road, Jaipur',
      lat: 26.9180,
      lng: 75.8050
    },
    heroImageUrl: 'https://images.unsplash.com/photo-1609137144822-4467c6999244?auto=format&fit=crop&w=1200&q=80',
    tagline: 'The Regal Pink City, Hilltop Fortresses & Artisan Bazaars',
    popularAreas: ['Old Pink City', 'Amer Ridge', 'Aravalli Hills', 'C-Scheme'],
    categories: ['Heritage', 'Cultural Hubs', 'Food Destinations', 'Hidden Gems'],
    recommendedDurationDays: '3 - 4 Days',
    bestTimeToVisit: 'October to March',
    overview:
      'Founded in 1727 by Maharaja Sawai Jai Singh II, Jaipur enchants visitors with rose-terracotta palaces, hilltop Rajput forts along the Aravalli range, astronomical observatories, and vibrant block-print bazaars.',
    travelTips: [
      'Reach Amber Palace by 08:15 AM to photograph Sheesh Mahal in soft morning light before tour buses arrive.',
      'Purchase the Rajasthan Composite Monument Ticket if visiting Amber Fort, Hawa Mahal, Jantar Mantar, and Nahargarh Fort.',
      'Pair Amer Ridge sights in the morning with the walled Old Pink City in the afternoon.'
    ]
  },
  goa: {
    destinationId: 'goa',
    destinationName: 'Goa',
    state: 'Goa',
    country: 'India',
    center: { lat: 15.2993, lng: 74.1240 },
    bounds: { minLat: 14.90, maxLat: 15.80, minLng: 73.68, maxLng: 74.35 },
    suggestedStartingPoint: {
      name: 'Panaji Latin Quarter Hub',
      address: 'Fontainhas, Panaji, Goa 403001',
      lat: 15.4989,
      lng: 73.8278
    },
    heroImageUrl: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=1200&q=80',
    tagline: 'Sun-drenched Coastal Shores, Portuguese Baroque Cathedrals & Spice Havens',
    popularAreas: ['North Goa Beaches', 'Panaji Central', 'Central Old Goa', 'South Goa Coastal'],
    categories: ['Beaches', 'Heritage', 'Food Destinations', 'Adventure', 'Nature & Hills'],
    recommendedDurationDays: '4 - 7 Days',
    bestTimeToVisit: 'November to February (or June–Sept for Lush Monsoon Waterfalls)',
    overview:
      'Blending golden Arabian Sea crescents, UNESCO-listed 16th-century Portuguese cathedrals in Old Goa, pastel villas in Fontainhas, and Western Ghats waterfalls, Goa offers an effortless balance of coastal leisure and rich heritage.',
    travelTips: [
      'Group North Goa (Aguada, Anjuna), Central Panaji/Old Goa, and South Goa (Palolem) on separate days to avoid long highway transits.',
      'Respect residential quiet in Fontainhas Latin Quarter while photographing heritage homes.',
      'Pre-book forest jeep safaris early in the morning when visiting Dudhsagar Waterfalls.'
    ]
  },
  agra: {
    destinationId: 'agra',
    destinationName: 'Agra',
    state: 'Uttar Pradesh',
    country: 'India',
    center: { lat: 27.1767, lng: 78.0081 },
    bounds: { minLat: 27.05, maxLat: 27.25, minLng: 77.90, maxLng: 78.10 },
    suggestedStartingPoint: {
      name: 'Tajganj Heritage Promenade',
      address: 'Taj East Gate Road, Tajganj, Agra',
      lat: 27.1730,
      lng: 78.0460
    },
    heroImageUrl: 'https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=1200&q=80',
    tagline: 'Eternal Monument of Love & Grand Mughal Citadels',
    popularAreas: ['Tajganj', 'Agra Fort Area', 'Fatehpur Sikri', 'Sikandra'],
    categories: ['Heritage', 'Cultural Hubs', 'Food Destinations'],
    recommendedDurationDays: '2 - 3 Days',
    bestTimeToVisit: 'October to March',
    overview:
      'Home to the Taj Mahal, Agra Fort, and Yamuna riverfront charbagh gardens, Agra was the imperial seat of the Mughal Empire at its architectural zenith.',
    travelTips: [
      'The Taj Mahal is closed every Friday for general viewing; plan sunrise visits on other days.',
      'Only small daypacks, water bottles, and phones/cameras are permitted inside the Taj Mahal security perimeter.',
      'Visit Mehtab Bagh across the Yamuna River at sunset for an unobstructed reflection view of the Taj.'
    ]
  },
  mumbai: {
    destinationId: 'mumbai',
    destinationName: 'Mumbai',
    state: 'Maharashtra',
    country: 'India',
    center: { lat: 18.9220, lng: 72.8347 },
    bounds: { minLat: 18.85, maxLat: 19.30, minLng: 72.75, maxLng: 73.05 },
    suggestedStartingPoint: {
      name: 'Colaba Heritage Promenade',
      address: 'Apollo Bunder, Colaba, Mumbai 400001',
      lat: 18.9220,
      lng: 72.8347
    },
    heroImageUrl: 'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?auto=format&fit=crop&w=1200&q=80',
    tagline: 'City of Dreams, Victorian Gothic Splendor & Arabian Sea Sunsets',
    popularAreas: ['South Mumbai Fort & Colaba', 'Marine Drive', 'Bandra West', 'Elephanta Island'],
    categories: ['Cultural Hubs', 'Heritage', 'Beaches', 'Food Destinations'],
    recommendedDurationDays: '3 - 5 Days',
    bestTimeToVisit: 'November to February',
    overview:
      'India’s financial and cinematic metropolis pairs UNESCO-recognized Victorian Gothic and Art Deco ensembles with breezy Arabian Sea promenades, historic Irani cafes, and vibrant coastal neighborhoods.',
    travelTips: [
      'Explore Colaba, Kala Ghoda, and Fort on foot in the morning before afternoon humidity rises.',
      'Historic Irani cafes like Britannia & Co. close by 04:00 PM and remain shut on Sundays.',
      'Spend golden hour walking along Marine Drive toward Girgaon Chowpatty.'
    ]
  },
  udaipur: {
    destinationId: 'udaipur',
    destinationName: 'Udaipur',
    state: 'Rajasthan',
    country: 'India',
    center: { lat: 24.5854, lng: 73.7125 },
    bounds: { minLat: 24.50, maxLat: 24.68, minLng: 73.62, maxLng: 73.78 },
    suggestedStartingPoint: {
      name: 'City Palace Lake Promenade',
      address: 'Old City, Lake Pichola Waterfront, Udaipur',
      lat: 24.5764,
      lng: 73.6835
    },
    heroImageUrl: 'https://images.unsplash.com/photo-1615836245337-f5b9b2303f10?auto=format&fit=crop&w=1200&q=80',
    tagline: 'City of Lakes, White Marble Palaces & Aravalli Reflections',
    popularAreas: ['Old City Pichola', 'Fateh Sagar', 'Aravalli Ridge', 'Sajjangarh'],
    categories: ['Heritage', 'Nature & Hills', 'Cultural Hubs', 'Hidden Gems'],
    recommendedDurationDays: '3 - 4 Days',
    bestTimeToVisit: 'September to March',
    overview:
      'Cradled by the Aravalli hills around shimmering Lake Pichola and Fateh Sagar, Udaipur is celebrated for its Mewar royal palaces, lakeside ghats, miniature painting ateliers, and rooftop dining.',
    travelTips: [
      'The Old City lanes around Jagdish Temple and Gangaur Ghat are best explored on foot.',
      'Book the Lake Pichola boat cruise around 04:30 PM for golden hour light on Jag Mandir.',
      'Carry comfortable walking shoes for the steep palace courtyards.'
    ]
  },
  varanasi: {
    destinationId: 'varanasi',
    destinationName: 'Varanasi',
    state: 'Uttar Pradesh',
    country: 'India',
    center: { lat: 25.3176, lng: 82.9739 },
    bounds: { minLat: 25.25, maxLat: 25.38, minLng: 82.92, maxLng: 83.05 },
    suggestedStartingPoint: {
      name: 'Godowlia Spiritual Gateway',
      address: 'Godowlia Crossing, Dashashwamedh, Varanasi',
      lat: 25.3080,
      lng: 83.0070
    },
    heroImageUrl: 'https://images.unsplash.com/photo-1561361513-2d000a50f0dc?auto=format&fit=crop&w=1200&q=80',
    tagline: 'Timeless Spiritual Capital, Sacred Ganga Ghats & Ancient Lanes',
    popularAreas: ['Dashashwamedh Ghats', 'Assi Ghat', 'Kashi Vishwanath Corridor', 'Sarnath'],
    categories: ['Religious & Spiritual', 'Cultural Hubs', 'Food Destinations', 'Heritage'],
    recommendedDurationDays: '2 - 4 Days',
    bestTimeToVisit: 'October to March',
    overview:
      'One of the world’s oldest continuously inhabited cities, Varanasi unfolds along a crescent of 84 riverfront ghats on the sacred Ganges, alive with dawn boat rides, silk weavers, chaat stalls, and evening Ganga Aarti.',
    travelTips: [
      'Arrive at Dashashwamedh Ghat 45 minutes before sunset to secure a clear view of the evening Ganga Aarti.',
      'Vehicles are restricted near Godowlia in the evening; expect a 10–15 minute walk to the ghats.',
      'Pair morning ghat walks with an afternoon excursion to Sarnath’s Buddhist monuments.'
    ]
  },
  amritsar: {
    destinationId: 'amritsar',
    destinationName: 'Amritsar',
    state: 'Punjab',
    country: 'India',
    center: { lat: 31.6200, lng: 74.8765 },
    bounds: { minLat: 31.55, maxLat: 31.75, minLng: 74.75, maxLng: 75.00 },
    suggestedStartingPoint: {
      name: 'Heritage Street Golden Gateway',
      address: 'Heritage Street, Amritsar, Punjab 143006',
      lat: 31.6210,
      lng: 74.8770
    },
    heroImageUrl: 'https://images.unsplash.com/photo-1514222134-b57cbb8ce073?auto=format&fit=crop&w=1200&q=80',
    tagline: 'Sacred Golden Sanctum, Punjabi Hospitality & Culinary Legends',
    popularAreas: ['Golden Temple Complex', 'Old Walled City', 'Wagah Border', 'Ranjit Avenue'],
    categories: ['Religious & Spiritual', 'Food Destinations', 'Heritage', 'Cultural Hubs'],
    recommendedDurationDays: '2 - 3 Days',
    bestTimeToVisit: 'October to March',
    overview:
      'Centered around the serene Harmandir Sahib (Golden Temple) and its community Langar kitchen, Amritsar blends deep spiritual warmth, poignant history, and legendary Punjabi culinary traditions.',
    travelTips: [
      'Keep a head covering handy and remove footwear at the designated counters before entering the Golden Temple parikrama.',
      'Visit Harmandir Sahib both early in the morning and after dusk when the gold sanctum reflects in the Amrit Sarovar.',
      'Sample traditional Amritsari Kulcha and slow-simmered Dal Makhani in the old walled city lanes.'
    ]
  },
  rishikesh: {
    destinationId: 'rishikesh',
    destinationName: 'Rishikesh',
    state: 'Uttarakhand',
    country: 'India',
    center: { lat: 30.0869, lng: 78.2676 },
    bounds: { minLat: 30.02, maxLat: 30.15, minLng: 78.20, maxLng: 78.35 },
    suggestedStartingPoint: {
      name: 'Triveni Ghat Central Promenade',
      address: 'Mayakund, Rishikesh, Uttarakhand 249201',
      lat: 30.1042,
      lng: 78.2977
    },
    heroImageUrl: 'https://images.unsplash.com/photo-1600100397608-f010f443b794?auto=format&fit=crop&w=1200&q=80',
    tagline: 'Yoga Capital of the World, Himalayan Foothills & Emerald River Ganga',
    popularAreas: ['Triveni Ghat', 'Ram Jhula & Swarg Ashram', 'Tapovan & Laxman Jhula', 'Neelkanth Valley'],
    categories: ['Nature & Hills', 'Religious & Spiritual', 'Adventure', 'Hidden Gems'],
    recommendedDurationDays: '3 - 5 Days',
    bestTimeToVisit: 'September to April',
    overview:
      'Where the emerald Ganges emerges from the Garhwal Himalayas, Rishikesh brings together riverside yoga ashrams, suspension bridges, cliffside organic cafes, white-water rafting rapids, and peaceful evening Maha Aarti.',
    travelTips: [
      'Rishikesh is a strictly vegetarian and alcohol-free spiritual municipality.',
      'Walk across Ram Jhula and the Janki Setu pedestrian bridge to connect Tapovan and Swarg Ashram.',
      'Attend the intimate sunset Maha Aarti at Triveni Ghat or Parmarth Niketan.'
    ]
  },
  kochi: {
    destinationId: 'kochi',
    destinationName: 'Kochi',
    state: 'Kerala',
    country: 'India',
    center: { lat: 9.9312, lng: 76.2673 },
    bounds: { minLat: 9.85, maxLat: 10.05, minLng: 76.20, maxLng: 76.35 },
    suggestedStartingPoint: {
      name: 'Fort Kochi Heritage Parade Ground',
      address: 'Parade Ground, Fort Kochi, Kochi, Kerala 682001',
      lat: 9.9658,
      lng: 76.2427
    },
    heroImageUrl: 'https://images.unsplash.com/photo-1596178065887-1198b6148b2b?auto=format&fit=crop&w=1200&q=80',
    tagline: 'Queen of the Arabian Sea, Chinese Fishing Nets & Spice Trading Outposts',
    popularAreas: ['Fort Kochi Heritage', 'Mattancherry Jew Town', 'Marine Drive Ernakulam', 'Willingdon Island'],
    categories: ['Beaches', 'Cultural Hubs', 'Heritage', 'Food Destinations', 'Hidden Gems'],
    recommendedDurationDays: '3 - 5 Days',
    bestTimeToVisit: 'October to March',
    overview:
      'A historic spice-trade port on the Malabar Coast, Fort Kochi and Mattancherry weave together cantilevered Chinese fishing nets, Dutch and Portuguese townhouses, spice warehouses, and contemporary art cafes.',
    travelTips: [
      'Take the inexpensive public water ferry between Ernakulam and Fort Kochi for scenic harbor views.',
      'Stroll Princess Street and Burgher Street in the morning before midday coastal warmth.',
      'Watch the Chinese Fishing Nets in operation along the Fort Kochi promenade at sunset.'
    ]
  }
};

/**
 * Resolves a destination query strictly to a canonical destination.
 * Never silently defaults to Delhi.
 */
export function resolveCanonicalDestination(query?: string): CanonicalDestination | null {
  if (!query || typeof query !== 'string') return null;
  const normalized = query.trim().toLowerCase();

  // Direct lookup
  if (CANONICAL_DESTINATIONS[normalized]) {
    return CANONICAL_DESTINATIONS[normalized];
  }

  // Common aliases and substrings
  for (const [key, dest] of Object.entries(CANONICAL_DESTINATIONS)) {
    if (normalized === key) return dest;
    if (normalized === dest.destinationName.toLowerCase()) return dest;
    if (normalized.includes(dest.destinationName.toLowerCase())) return dest;
    if (dest.destinationName.toLowerCase().includes(normalized)) return dest;
  }

  // Aliases map
  const aliases: Record<string, string> = {
    'new delhi': 'delhi',
    'old delhi': 'delhi',
    'ncr': 'delhi',
    'panaji': 'goa',
    'north goa': 'goa',
    'south goa': 'goa',
    'calangute': 'goa',
    'bombay': 'mumbai',
    'banaras': 'varanasi',
    'kashi': 'varanasi',
    'benares': 'varanasi',
    'cochin': 'kochi',
    'kerala': 'kochi',
    'pink city': 'jaipur',
    'taj mahal city': 'agra'
  };

  const aliasKey = aliases[normalized];
  if (aliasKey && CANONICAL_DESTINATIONS[aliasKey]) {
    return CANONICAL_DESTINATIONS[aliasKey];
  }

  return null;
}

/**
 * Validates whether a coordinate lies within a destination's geographic bounds.
 */
export function isCoordinateWithinDestination(
  lat: number,
  lng: number,
  dest: CanonicalDestination,
  bufferKm: number = 25
): boolean {
  // Approximate 1 deg lat ~= 111km, 1 deg lng ~= 100km
  const latBuffer = bufferKm / 111;
  const lngBuffer = bufferKm / 100;

  return (
    lat >= dest.bounds.minLat - latBuffer &&
    lat <= dest.bounds.maxLat + latBuffer &&
    lng >= dest.bounds.minLng - lngBuffer &&
    lng <= dest.bounds.maxLng + lngBuffer
  );
}

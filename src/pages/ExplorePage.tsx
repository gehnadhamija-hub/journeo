import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { INDIA_DESTINATIONS, AVAILABLE_CITIES, IndiaDestination } from '../data/indiaDestinations';
import { getPlaceReviewData } from '../data/placeReviews';
import { useTripContext } from '../context/TripContext';
import { PlacePreviewModal } from '../components/PlacePreviewModal';
import { MapComponent } from '../components/MapComponent';
import {
  Search,
  MapPin,
  Star,
  Clock,
  IndianRupee,
  Compass,
  Plus,
  Eye,
  Sparkles,
  Map as MapIcon,
  LayoutGrid,
  Filter
} from 'lucide-react';

const EXPLORE_PLACE_CATEGORIES = [
  'All',
  'Heritage',
  'Nature',
  'Spiritual',
  'Culture',
  'Food',
  'Adventure',
  'Must-Visit',
  'Free Entry'
] as const;

export const ExplorePage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { activeTrip, addPlaceToActiveTrip } = useTripContext();

  const initialDest = searchParams.get('destination') || 'All Cities';
  const [selectedCity, setSelectedCity] = useState<string>(initialDest);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchInput, setSearchInput] = useState<string>('');
  const [debouncedQuery, setDebouncedQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'split_map'>('grid');
  const [previewPlace, setPreviewPlace] = useState<IndiaDestination | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchInput.trim().toLowerCase());
    }, 180);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleCityChange = (city: string) => {
    setSelectedCity(city);
    if (city === 'All Cities') {
      searchParams.delete('destination');
    } else {
      searchParams.set('destination', city);
    }
    setSearchParams(searchParams, { replace: true });
  };

  const filteredPlaces = useMemo(() => {
    return INDIA_DESTINATIONS.filter(place => {
      if (
        selectedCity !== 'All Cities' &&
        place.city.toLowerCase() !== selectedCity.toLowerCase()
      ) {
        return false;
      }

      if (selectedCategory === 'Must-Visit' && !place.isMustVisit) return false;
      if (selectedCategory === 'Free Entry' && (place.entryFeeINR || 0) > 0) return false;
      if (
        selectedCategory !== 'All' &&
        selectedCategory !== 'Must-Visit' &&
        selectedCategory !== 'Free Entry' &&
        place.category.toLowerCase() !== selectedCategory.toLowerCase()
      ) {
        return false;
      }

      if (!debouncedQuery) return true;
      return (
        place.name.toLowerCase().includes(debouncedQuery) ||
        place.city.toLowerCase().includes(debouncedQuery) ||
        place.area.toLowerCase().includes(debouncedQuery) ||
        place.description.toLowerCase().includes(debouncedQuery) ||
        place.interestTags.some(t => t.toLowerCase().includes(debouncedQuery)) ||
        place.highlights.some(h => h.toLowerCase().includes(debouncedQuery))
      );
    });
  }, [selectedCity, selectedCategory, debouncedQuery]);

  const mapMarkers = useMemo(() => {
    return filteredPlaces.slice(0, 25).map((p, idx) => ({
      id: p.id,
      lat: p.latitude,
      lng: p.longitude,
      title: p.name,
      order: idx + 1,
      isMustVisit: p.isMustVisit,
      isMealStop: p.isMealStop,
      imageUrl: p.imageUrl,
      description: p.description
    }));
  }, [filteredPlaces]);

  const handleQuickAddToTrip = (place: IndiaDestination) => {
    const res = addPlaceToActiveTrip(place);
    setToastMessage(res.message);
    setTimeout(() => setToastMessage(null), 4000);
  };

  return (
    <div className="min-h-screen pt-28 pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-40 bg-deep-green text-white px-5 py-3.5 rounded-2xl shadow-xl text-xs font-bold flex items-center gap-3 border border-white/15">
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-8 gap-6">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-terracotta/15 text-terracotta text-xs font-bold tracking-wider uppercase mb-3">
            <Compass className="w-3.5 h-3.5" />
            Place & Experience Explorer
          </div>
          <h1 className="text-4xl sm:text-5xl font-serif font-bold text-charcoal tracking-tight mb-3">
            Explore Landmarks, Cafes & Hidden Gems
          </h1>
          <p className="text-stone-600 text-base leading-relaxed">
            Discover individual attractions, heritage monuments, local dining institutions, and viewpoints across India. Inspect Google review summaries, view coordinates on the map, or add stops directly to your trip. Looking for city-level overviews? Browse{' '}
            <Link to="/destinations" className="text-deep-green font-semibold underline hover:text-terracotta">
              Destinations
            </Link>.
          </p>
        </div>

        {/* Search & Map Toggle */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-stone-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search monument, cafe, area, or tag..."
              className="w-full pl-11 pr-4 py-3 bg-white border border-stone-200/90 rounded-2xl text-sm text-charcoal focus:outline-none focus:border-deep-green shadow-xs"
            />
          </div>

          <div className="inline-flex bg-white border border-stone-200/80 rounded-2xl p-1">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                viewMode === 'grid'
                  ? 'bg-deep-green text-white'
                  : 'text-stone-600 hover:text-charcoal'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Cards
            </button>
            <button
              type="button"
              onClick={() => setViewMode('split_map')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                viewMode === 'split_map'
                  ? 'bg-deep-green text-white'
                  : 'text-stone-600 hover:text-charcoal'
              }`}
            >
              <MapIcon className="w-3.5 h-3.5" /> Map + Cards
            </button>
          </div>
        </div>
      </div>

      {/* City Selector Strip */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-stone-200/80 shadow-xs mb-6 space-y-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1 mr-1 shrink-0">
            <MapPin className="w-3.5 h-3.5 text-terracotta" /> Destination City:
          </span>
          {['All Cities', ...AVAILABLE_CITIES].map(city => (
            <button
              key={city}
              onClick={() => handleCityChange(city)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedCity.toLowerCase() === city.toLowerCase()
                  ? 'bg-deep-green text-white shadow-xs'
                  : 'bg-[#F7F4EA]/80 text-stone-600 hover:bg-stone-200/70'
              }`}
            >
              {city}
            </button>
          ))}
        </div>

        {/* Category Filter Strip */}
        <div className="flex items-center gap-2 overflow-x-auto pt-2 border-t border-stone-100 no-scrollbar">
          <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1 mr-1 shrink-0">
            <Filter className="w-3.5 h-3.5 text-sage" /> Experience Type:
          </span>
          {EXPLORE_PLACE_CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-terracotta text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200/70'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Results Count & Active Trip Context Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 px-1">
        <p className="text-xs font-bold uppercase tracking-wider text-stone-500">
          Showing {filteredPlaces.length} verified places{' '}
          {selectedCity !== 'All Cities' ? `in ${selectedCity}` : 'across India'}
        </p>

        {activeTrip && (
          <div className="flex items-center gap-2 text-xs bg-sage/15 text-deep-green px-3.5 py-1.5 rounded-full font-semibold">
            <span>Active Trip: {activeTrip.destinationName}</span>
            <Link to="/itinerary/preview" className="underline font-bold">
              View Itinerary ({activeTrip.stops.length} stops)
            </Link>
          </div>
        )}
      </div>

      {/* Main Content Area (Grid or Split Map) */}
      <div className={viewMode === 'split_map' ? 'grid grid-cols-1 lg:grid-cols-12 gap-7' : ''}>
        {viewMode === 'split_map' && (
          <div className="lg:col-span-5 lg:sticky lg:top-24 bg-white rounded-3xl p-3 border border-stone-200/80 shadow-sm">
            <MapComponent
              markers={mapMarkers}
              height="580px"
              showRoute={false}
              onMarkerClick={m => {
                const found = filteredPlaces.find(p => p.id === m.id);
                if (found) setPreviewPlace(found);
              }}
            />
          </div>
        )}

        <div className={viewMode === 'split_map' ? 'lg:col-span-7' : ''}>
          {filteredPlaces.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-stone-200/70 max-w-lg mx-auto my-8">
              <Compass className="w-12 h-12 text-sage mx-auto mb-3 stroke-[1.5]" />
              <h3 className="text-xl font-serif font-bold text-charcoal mb-2">
                No places match your current filter
              </h3>
              <p className="text-stone-500 text-sm mb-6">
                Try switching the city selector to "All Cities" or clearing your search query.
              </p>
              <button
                onClick={() => {
                  handleCityChange('All Cities');
                  setSelectedCategory('All');
                  setSearchInput('');
                }}
                className="px-5 py-2.5 rounded-xl bg-deep-green text-white text-xs font-bold uppercase tracking-wider"
              >
                Show All Places
              </button>
            </div>
          ) : (
            <div
              className={`grid grid-cols-1 ${
                viewMode === 'split_map' ? 'md:grid-cols-2' : 'md:grid-cols-2 lg:grid-cols-3'
              } gap-6`}
            >
              {filteredPlaces.map(place => {
                const rev = getPlaceReviewData(place);
                const canAddToActiveTrip =
                  activeTrip &&
                  activeTrip.destinationName.toLowerCase() === place.city.toLowerCase();

                return (
                  <div
                    key={place.id}
                    className="bg-white rounded-[26px] overflow-hidden border border-stone-200/80 hover:border-sage/60 shadow-xs hover:shadow-lg transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div
                        className="relative h-48 overflow-hidden cursor-pointer"
                        onClick={() => setPreviewPlace(place)}
                      >
                        <img
                          src={place.imageUrl}
                          alt={place.name}
                          className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />

                        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                          <span className="px-2.5 py-1 rounded-full bg-white/95 text-[10px] font-bold uppercase tracking-wider text-deep-green">
                            {place.city}
                          </span>
                          <span className="px-2.5 py-1 rounded-full bg-black/55 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider">
                            {place.category}
                          </span>
                        </div>

                        {rev.available && (
                          <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/65 backdrop-blur-md text-white text-xs font-bold flex items-center gap-1">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            {rev.averageRating.toFixed(1)}
                          </div>
                        )}

                        <div className="absolute bottom-3 left-3.5 right-3.5 text-white">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 block">
                            {place.area}
                          </span>
                          <h3 className="text-lg font-serif font-bold leading-snug">
                            {place.name}
                          </h3>
                        </div>
                      </div>

                      <div className="p-5 space-y-3">
                        <p className="text-xs text-stone-600 line-clamp-2 leading-relaxed">
                          {place.description}
                        </p>

                        {rev.available && (
                          <p className="text-[11px] text-stone-500 italic bg-stone-50 px-3 py-2 rounded-xl border border-stone-100 line-clamp-2">
                            "{rev.visitorSummary}"
                          </p>
                        )}

                        <div className="flex items-center justify-between text-xs text-stone-500 pt-2 border-t border-stone-100">
                          <span className="flex items-center gap-1 font-medium">
                            <Clock className="w-3.5 h-3.5 text-sage" />
                            {place.averageVisitDuration} mins
                          </span>
                          <span className="flex items-center gap-0.5 font-bold text-charcoal">
                            <IndianRupee className="w-3 h-3 text-terracotta" />
                            {place.isMealStop
                              ? `₹${place.averageCostPerPersonINR || 400}/person`
                              : place.entryFeeINR === 0
                              ? 'Free Entry'
                              : `₹${place.entryFeeINR}`}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="px-5 pb-5 pt-1 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPreviewPlace(place)}
                        className="flex-1 py-2.5 px-3 rounded-xl bg-stone-100 hover:bg-stone-200/80 text-charcoal text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" /> Preview
                      </button>

                      {canAddToActiveTrip ? (
                        <button
                          type="button"
                          onClick={() => handleQuickAddToTrip(place)}
                          className="py-2.5 px-3.5 rounded-xl bg-terracotta hover:bg-terracotta/90 text-white text-xs font-bold flex items-center gap-1 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add to Trip
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            navigate(
                              `/plan?destination=${encodeURIComponent(place.city)}&placeId=${encodeURIComponent(place.id)}`
                            )
                          }
                          className="py-2.5 px-3.5 rounded-xl bg-deep-green hover:bg-deep-green/90 text-white text-xs font-bold transition-colors"
                        >
                          Plan Trip
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Place Preview Modal */}
      <PlacePreviewModal
        place={previewPlace}
        onClose={() => setPreviewPlace(null)}
      />
    </div>
  );
};

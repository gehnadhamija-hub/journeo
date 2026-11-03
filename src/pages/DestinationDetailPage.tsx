import React, { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  resolveCanonicalDestination,
  CanonicalDestination
} from '../data/canonicalDestinations';
import { INDIA_DESTINATIONS, IndiaDestination } from '../data/indiaDestinations';
import { getPlaceReviewData } from '../data/placeReviews';
import { MapComponent } from '../components/MapComponent';
import { PlacePreviewModal } from '../components/PlacePreviewModal';
import {
  ArrowLeft,
  MapPin,
  Clock,
  Star,
  Compass,
  Calendar,
  Sun,
  IndianRupee,
  Sparkles,
  CheckCircle2,
  Eye,
  Info
} from 'lucide-react';

export const DestinationDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [previewPlace, setPreviewPlace] = useState<IndiaDestination | null>(null);

  // Resolve whether :id is a Canonical City Destination (e.g. "goa") or an Individual Place ID (e.g. "goa_fort_aguada")
  const resolved = useMemo(() => {
    if (!id) return { canonical: null, matchedPlace: null };
    const directPlace = INDIA_DESTINATIONS.find(
      p => p.id.toLowerCase() === id.toLowerCase() || p.providerPlaceId === id
    );
    if (directPlace) {
      const canon = resolveCanonicalDestination(directPlace.destinationId || directPlace.city);
      return { canonical: canon, matchedPlace: directPlace };
    }
    const canon = resolveCanonicalDestination(id);
    return { canonical: canon, matchedPlace: null };
  }, [id]);

  const canonical: CanonicalDestination | null = resolved.canonical;

  const destinationPlaces = useMemo(() => {
    if (!canonical) return [];
    return INDIA_DESTINATIONS.filter(
      p =>
        p.destinationId === canonical.destinationId ||
        p.city.toLowerCase() === canonical.destinationName.toLowerCase()
    );
  }, [canonical]);

  const placeCategories = useMemo(() => {
    const cats = new Set<string>(['All']);
    destinationPlaces.forEach(p => cats.add(p.category));
    return Array.from(cats);
  }, [destinationPlaces]);

  const filteredPlaces = useMemo(() => {
    if (selectedCategory === 'All') return destinationPlaces;
    return destinationPlaces.filter(p => p.category === selectedCategory);
  }, [destinationPlaces, selectedCategory]);

  const mapMarkers = useMemo(() => {
    return filteredPlaces.map((p, idx) => ({
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

  if (!canonical) {
    return (
      <div className="min-h-screen pt-32 px-4 text-center max-w-lg mx-auto">
        <h2 className="text-2xl font-serif font-bold text-charcoal mb-3">
          Destination Not Found
        </h2>
        <p className="text-stone-500 mb-6 text-sm">
          We couldn’t find "{id}" in our verified Indian destination catalog. Browse our 10 canonical travel hubs below.
        </p>
        <Link
          to="/destinations"
          className="bg-deep-green text-white px-6 py-3 rounded-2xl text-sm font-medium inline-flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Browse All Destinations
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate('/destinations')}
          className="inline-flex items-center gap-2 text-sm font-medium text-stone-500 hover:text-charcoal transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> All Destinations
        </button>

        <Link
          to={`/explore?destination=${encodeURIComponent(canonical.destinationName)}`}
          className="text-xs font-bold text-deep-green hover:text-terracotta underline"
        >
          Explore All {canonical.destinationName} Places & Cafes →
        </Link>
      </div>

      {/* Hero Banner */}
      <div className="relative h-[360px] sm:h-[420px] rounded-[36px] overflow-hidden shadow-xl mb-10 border border-stone-200/60">
        <img
          src={canonical.heroImageUrl}
          alt={canonical.destinationName}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#141F18]/90 via-[#141F18]/40 to-transparent" />

        <div className="absolute top-6 left-6 flex flex-wrap gap-2">
          {canonical.categories.map(cat => (
            <span
              key={cat}
              className="px-3.5 py-1.5 rounded-full bg-white/90 backdrop-blur-md text-xs font-bold uppercase tracking-wider text-deep-green shadow-sm"
            >
              {cat}
            </span>
          ))}
        </div>

        <div className="absolute bottom-8 left-8 right-8 flex flex-col md:flex-row md:items-end justify-between gap-6 text-white">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-amber-300 text-xs font-bold uppercase tracking-widest mb-2">
              <MapPin className="w-4 h-4" />
              {canonical.state}, {canonical.country}
            </div>
            <h1 className="text-4xl sm:text-6xl font-serif font-bold tracking-tight mb-2">
              {canonical.destinationName}
            </h1>
            <p className="text-stone-200 text-sm sm:text-base font-medium">
              {canonical.tagline}
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              navigate(`/plan?destination=${encodeURIComponent(canonical.destinationName)}`)
            }
            className="bg-terracotta hover:bg-terracotta/95 text-white px-7 py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2.5 shadow-lg transition-all shrink-0"
          >
            <Compass className="w-5 h-5" />
            Plan a Trip to {canonical.destinationName}
          </button>
        </div>
      </div>

      {/* Highlighted Place Banner if navigated via /destinations/:placeId */}
      {resolved.matchedPlace && (
        <div className="mb-10 bg-amber-50/90 border border-amber-200 rounded-3xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-200/70 px-2.5 py-1 rounded-full">
              Selected Place Highlight
            </span>
            <h3 className="text-xl font-serif font-bold text-charcoal mt-2">
              {resolved.matchedPlace.name}
            </h3>
            <p className="text-xs text-stone-600 mt-1 max-w-2xl">
              {resolved.matchedPlace.description}
            </p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => setPreviewPlace(resolved.matchedPlace)}
              className="px-4 py-2.5 rounded-xl bg-white border border-amber-300 text-charcoal text-xs font-bold"
            >
              View Reviews & Details
            </button>
            <button
              onClick={() =>
                navigate(
                  `/plan?destination=${encodeURIComponent(canonical.destinationName)}&placeId=${encodeURIComponent(resolved.matchedPlace!.id)}`
                )
              }
              className="px-4 py-2.5 rounded-xl bg-deep-green text-white text-xs font-bold"
            >
              Plan Trip With This Stop
            </button>
          </div>
        </div>
      )}

      {/* Overview, Key Metrics & Travel Tips */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-14">
        <div className="lg:col-span-7 bg-white rounded-3xl p-7 sm:p-8 border border-stone-200/80 shadow-xs space-y-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-sage block mb-1">
              Destination Overview
            </span>
            <h2 className="text-2xl font-serif font-bold text-charcoal mb-3">
              About {canonical.destinationName}
            </h2>
            <p className="text-stone-600 text-sm sm:text-base leading-relaxed">
              {canonical.overview}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2">
            <div className="p-4 rounded-2xl bg-[#F7F4EA]/70 border border-stone-200/60">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-sage" /> Recommended Stay
              </span>
              <span className="text-sm font-bold text-charcoal mt-1 block">
                {canonical.recommendedDurationDays}
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-[#F7F4EA]/70 border border-stone-200/60">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
                <Sun className="w-3.5 h-3.5 text-amber-500" /> Best Season
              </span>
              <span className="text-sm font-bold text-charcoal mt-1 block">
                {canonical.bestTimeToVisit}
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-[#F7F4EA]/70 border border-stone-200/60">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-terracotta" /> Key Zones
              </span>
              <span className="text-xs font-bold text-charcoal mt-1 block">
                {canonical.popularAreas.join(' • ')}
              </span>
            </div>
          </div>

          {/* Local Travel Tips */}
          <div className="pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1.5 mb-3">
              <Info className="w-3.5 h-3.5 text-sage" /> Practical Travel & Route Planning Tips
            </h3>
            <div className="space-y-2.5">
              {canonical.travelTips.map((tip, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2.5 text-xs sm:text-sm text-stone-600 bg-stone-50/90 p-3 rounded-xl border border-stone-200/50"
                >
                  <CheckCircle2 className="w-4 h-4 text-sage shrink-0 mt-0.5" />
                  <span>{tip}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Interactive Destination Map */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-5 border border-stone-200/80 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-3 px-1">
            <div>
              <h3 className="text-base font-serif font-bold text-charcoal">
                {canonical.destinationName} Geographic Map
              </h3>
              <p className="text-xs text-stone-400">
                Showing {filteredPlaces.length} verified landmarks & dining stops
              </p>
            </div>
            <span className="text-[11px] font-mono text-stone-400">
              {canonical.center.lat.toFixed(2)}°N, {canonical.center.lng.toFixed(2)}°E
            </span>
          </div>
          <div className="flex-1 min-h-[300px] rounded-2xl overflow-hidden">
            <MapComponent
              markers={mapMarkers}
              height="340px"
              showRoute={false}
              onMarkerClick={m => {
                const found = filteredPlaces.find(p => p.id === m.id);
                if (found) setPreviewPlace(found);
              }}
            />
          </div>
        </div>
      </div>

      {/* Places to Visit Section */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-charcoal">
              Verified Places to Visit in {canonical.destinationName}
            </h2>
            <p className="text-sm text-stone-500">
              Click any place to inspect Google review insights, opening hours, entry fees, or include it in your trip.
            </p>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {placeCategories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  selectedCategory === cat
                    ? 'bg-deep-green text-white'
                    : 'bg-white text-stone-600 border border-stone-200/80 hover:border-sage'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPlaces.map(place => {
            const rev = getPlaceReviewData(place);
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
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

                    <div className="absolute top-3 left-3 flex gap-1.5">
                      <span className="px-2.5 py-1 rounded-full bg-white/90 text-[10px] font-bold uppercase tracking-wider text-deep-green">
                        {place.category}
                      </span>
                      {place.isMustVisit && (
                        <span className="px-2.5 py-1 rounded-full bg-amber-400 text-[#221F1B] text-[10px] font-bold uppercase tracking-wider">
                          Must-Visit
                        </span>
                      )}
                    </div>

                    {rev.available && (
                      <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-xs font-bold flex items-center gap-1">
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

                    <div className="flex items-center justify-between text-xs text-stone-500 pt-2 border-t border-stone-100">
                      <span className="flex items-center gap-1 font-medium">
                        <Clock className="w-3.5 h-3.5 text-sage" />
                        {place.averageVisitDuration} mins
                      </span>
                      <span className="flex items-center gap-0.5 font-bold text-charcoal">
                        <IndianRupee className="w-3 h-3 text-terracotta" />
                        {place.isMealStop
                          ? `₹${place.averageCostPerPersonINR || 400} avg`
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
                    <Eye className="w-3.5 h-3.5" /> Preview & Reviews
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        `/plan?destination=${encodeURIComponent(canonical.destinationName)}&placeId=${encodeURIComponent(place.id)}`
                      )
                    }
                    className="py-2.5 px-3.5 rounded-xl bg-deep-green hover:bg-deep-green/90 text-white text-xs font-bold transition-colors"
                  >
                    Plan With Stop
                  </button>
                </div>
              </div>
            );
          })}
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

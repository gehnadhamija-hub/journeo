import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CANONICAL_DESTINATIONS,
  DESTINATION_DISCOVERY_CATEGORIES,
  CanonicalDestination
} from '../data/canonicalDestinations';
import { INDIA_DESTINATIONS } from '../data/indiaDestinations';
import {
  Search,
  MapPin,
  Calendar,
  Compass,
  Sparkles,
  ArrowRight,
  Sun,
  Landmark
} from 'lucide-react';

export const DestinationsListPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const allDestinations: CanonicalDestination[] = useMemo(
    () => Object.values(CANONICAL_DESTINATIONS),
    []
  );

  // Count verified places per canonical destination
  const placeCountByDest = useMemo(() => {
    const counts: Record<string, { total: number; highlights: string[] }> = {};
    for (const dest of allDestinations) {
      const places = INDIA_DESTINATIONS.filter(
        p => p.destinationId === dest.destinationId || p.city.toLowerCase() === dest.destinationName.toLowerCase()
      );
      counts[dest.destinationId] = {
        total: places.length,
        highlights: places.slice(0, 3).map(p => p.name.split('(')[0].trim())
      };
    }
    return counts;
  }, [allDestinations]);

  const filteredDestinations = useMemo(() => {
    return allDestinations.filter(dest => {
      const matchesCat =
        selectedCategory === 'All' ||
        dest.categories.some(c => c.toLowerCase() === selectedCategory.toLowerCase());

      if (!matchesCat) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.trim().toLowerCase();
      return (
        dest.destinationName.toLowerCase().includes(q) ||
        dest.state.toLowerCase().includes(q) ||
        dest.tagline.toLowerCase().includes(q) ||
        dest.overview.toLowerCase().includes(q) ||
        dest.popularAreas.some(a => a.toLowerCase().includes(q)) ||
        dest.categories.some(c => c.toLowerCase().includes(q))
      );
    });
  }, [allDestinations, selectedCategory, searchQuery]);

  return (
    <div className="min-h-screen pt-28 pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-10 gap-6">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sage/15 text-deep-green text-xs font-semibold tracking-wider uppercase mb-3">
            <Landmark className="w-3.5 h-3.5 text-terracotta" />
            Destination Discovery Catalog
          </div>
          <h1 className="text-4xl sm:text-5xl font-serif font-bold text-charcoal tracking-tight mb-3">
            Iconic Indian Destinations
          </h1>
          <p className="text-stone-600 text-base sm:text-lg leading-relaxed">
            Choose a city or region to inspect its heritage zones, ideal trip duration, best season, and curated landmarks—or jump straight into route planning. Looking for individual monuments or cafes? Visit{' '}
            <Link to="/explore" className="text-deep-green font-semibold underline hover:text-terracotta">
              Explore Places
            </Link>.
          </p>
        </div>

        {/* Search Input */}
        <div className="relative w-full lg:w-96">
          <Search className="w-4 h-4 text-stone-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search city, state, or theme (e.g. Goa, Rajasthan)..."
            className="w-full pl-11 pr-4 py-3.5 bg-white border border-stone-200/90 rounded-2xl text-sm text-charcoal focus:outline-none focus:border-deep-green shadow-xs"
          />
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-8 no-scrollbar">
        {DESTINATION_DISCOVERY_CATEGORIES.map(category => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-4 py-2.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
              selectedCategory === category
                ? 'bg-deep-green text-white shadow-sm'
                : 'bg-white/80 text-stone-600 hover:bg-white border border-stone-200/80'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Destination Cards Grid */}
      {filteredDestinations.length === 0 ? (
        <div className="bg-white/80 rounded-3xl p-12 text-center border border-stone-200/60 max-w-xl mx-auto my-8">
          <Compass className="w-12 h-12 text-sage mx-auto mb-3 stroke-[1.5]" />
          <h3 className="text-xl font-serif font-bold text-charcoal mb-2">
            No matching destinations found
          </h3>
          <p className="text-stone-500 text-sm mb-6">
            Try clearing your search filter or switching to "All" categories to browse all 10 verified Indian destinations.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('All');
            }}
            className="px-5 py-2.5 rounded-xl bg-deep-green text-white text-xs font-bold uppercase tracking-wider"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
          {filteredDestinations.map(dest => {
            const stats = placeCountByDest[dest.destinationId] || { total: 0, highlights: [] };

            return (
              <div
                key={dest.destinationId}
                className="group bg-white rounded-[28px] overflow-hidden border border-stone-200/80 hover:border-sage/60 shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col"
              >
                {/* Hero Image */}
                <Link
                  to={`/destinations/${dest.destinationId}`}
                  className="relative h-56 overflow-hidden block"
                >
                  <img
                    src={dest.heroImageUrl}
                    alt={dest.destinationName}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />

                  <div className="absolute top-3.5 left-3.5 flex flex-wrap gap-1.5">
                    {dest.categories.slice(0, 2).map(cat => (
                      <span
                        key={cat}
                        className="px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-md text-[10px] font-bold uppercase tracking-wider text-deep-green"
                      >
                        {cat}
                      </span>
                    ))}
                  </div>

                  <div className="absolute top-3.5 right-3.5 px-2.5 py-1 rounded-full bg-black/55 backdrop-blur-md text-white text-[11px] font-semibold flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-300" />
                    {stats.total} Verified Places
                  </div>

                  <div className="absolute bottom-3.5 left-4 right-4 text-white">
                    <div className="flex items-center gap-1 text-amber-300 text-xs font-bold uppercase tracking-wider">
                      <MapPin className="w-3.5 h-3.5" />
                      {dest.state}, {dest.country}
                    </div>
                    <h2 className="text-2xl font-serif font-bold leading-tight">
                      {dest.destinationName}
                    </h2>
                  </div>
                </Link>

                {/* Body */}
                <div className="p-6 flex-1 flex flex-col justify-between space-y-5">
                  <div className="space-y-3">
                    <p className="text-xs font-bold text-terracotta uppercase tracking-wider">
                      {dest.tagline}
                    </p>
                    <p className="text-sm text-stone-600 line-clamp-3 leading-relaxed">
                      {dest.overview}
                    </p>

                    {/* Duration & Season Meta */}
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <div className="p-2.5 rounded-xl bg-[#F7F4EA]/70 border border-stone-200/60">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-sage" /> Ideal Duration
                        </span>
                        <span className="text-xs font-bold text-charcoal mt-0.5 block">
                          {dest.recommendedDurationDays}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-[#F7F4EA]/70 border border-stone-200/60">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1">
                          <Sun className="w-3 h-3 text-amber-500" /> Best Season
                        </span>
                        <span className="text-xs font-bold text-charcoal mt-0.5 block truncate">
                          {dest.bestTimeToVisit.split('(')[0].trim()}
                        </span>
                      </div>
                    </div>

                    {/* Top Landmarks Preview */}
                    {stats.highlights.length > 0 && (
                      <div className="pt-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1.5">
                          Signature Highlights
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {stats.highlights.map((h, i) => (
                            <span
                              key={i}
                              className="text-[11px] bg-stone-100 text-stone-700 px-2.5 py-1 rounded-lg font-medium"
                            >
                              {h}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-4 border-t border-stone-100 flex items-center gap-2.5">
                    <Link
                      to={`/destinations/${dest.destinationId}`}
                      className="flex-1 py-2.5 px-3.5 rounded-xl border border-stone-200 hover:border-deep-green text-charcoal hover:text-deep-green text-xs font-bold text-center transition-colors"
                    >
                      Destination Guide
                    </Link>
                    <button
                      type="button"
                      onClick={() =>
                        navigate(`/plan?destination=${encodeURIComponent(dest.destinationName)}`)
                      }
                      className="flex-1 py-2.5 px-3.5 rounded-xl bg-deep-green hover:bg-deep-green/90 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs"
                    >
                      Plan a Trip <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

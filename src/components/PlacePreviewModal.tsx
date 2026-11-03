import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IndiaDestination } from '../data/indiaDestinations';
import { getPlaceReviewData } from '../data/placeReviews';
import { useTripContext } from '../context/TripContext';
import { MapComponent } from './MapComponent';
import {
  X,
  Star,
  MapPin,
  Clock,
  IndianRupee,
  ExternalLink,
  Plus,
  Compass,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  MessageSquareQuote
} from 'lucide-react';

interface PlacePreviewModalProps {
  place: IndiaDestination | null;
  onClose: () => void;
}

export const PlacePreviewModal: React.FC<PlacePreviewModalProps> = ({ place, onClose }) => {
  const navigate = useNavigate();
  const { activeTrip, addPlaceToActiveTrip } = useTripContext();
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [showMap, setShowMap] = useState(false);

  if (!place) return null;

  const reviewData = getPlaceReviewData(place);

  const handleAddToActiveTrip = () => {
    const res = addPlaceToActiveTrip(place);
    setFeedbackMsg({ text: res.message, ok: res.added });
  };

  const handlePlanTripAroundPlace = () => {
    onClose();
    navigate(`/plan?destination=${encodeURIComponent(place.city)}&placeId=${encodeURIComponent(place.id)}`);
  };

  const mapMarkers = [
    {
      id: place.id,
      lat: place.latitude,
      lng: place.longitude,
      title: place.name,
      order: 1,
      isMustVisit: place.isMustVisit,
      imageUrl: place.imageUrl,
      description: place.description
    }
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-[#FBF9F4] border border-stone-200/90 rounded-[32px] max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl relative animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Top Hero Image */}
        <div className="relative h-64 sm:h-72 w-full overflow-hidden rounded-t-[32px]">
          <img
            src={place.imageUrl}
            alt={place.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#1A261E]/90 via-[#1A261E]/35 to-transparent" />

          <button
            onClick={onClose}
            aria-label="Close place preview"
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/45 hover:bg-black/65 text-white flex items-center justify-center backdrop-blur-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="absolute top-4 left-5 flex flex-wrap gap-2">
            <span className="px-3 py-1 rounded-full bg-white/90 backdrop-blur-md text-deep-green text-[11px] font-bold uppercase tracking-wider shadow-sm">
              {place.category}
            </span>
            {place.isMustVisit && (
              <span className="px-3 py-1 rounded-full bg-amber-400/95 text-[#221F1B] text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-sm">
                <Sparkles className="w-3 h-3" /> Iconic Must-Visit
              </span>
            )}
          </div>

          <div className="absolute bottom-5 left-6 right-6 text-white">
            <div className="flex items-center gap-1.5 text-amber-300 text-xs font-bold uppercase tracking-wider mb-1">
              <MapPin className="w-3.5 h-3.5" />
              {place.area} • {place.city}, {place.state}
            </div>
            <h2 className="text-2xl sm:text-3xl font-serif font-bold leading-tight">
              {place.name}
            </h2>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8 space-y-6">
          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-4 rounded-2xl border border-stone-200/80 shadow-xs">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
                Google / Visitor Rating
              </span>
              {reviewData.available ? (
                <div className="flex items-center gap-1.5 mt-1">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  <span className="font-bold text-charcoal text-sm">
                    {reviewData.averageRating.toFixed(1)}
                  </span>
                  <span className="text-xs text-stone-400">
                    ({reviewData.totalReviewCount.toLocaleString('en-IN')})
                  </span>
                </div>
              ) : (
                <span className="text-xs text-stone-500 mt-1 block">See Google Maps</span>
              )}
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
                Suggested Duration
              </span>
              <div className="flex items-center gap-1.5 mt-1 text-sm font-bold text-charcoal">
                <Clock className="w-4 h-4 text-sage" />
                {place.averageVisitDuration} mins
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
                {place.isMealStop ? 'Avg Meal Cost' : 'Entry Ticket'}
              </span>
              <div className="flex items-center gap-1 mt-1 text-sm font-bold text-charcoal">
                <IndianRupee className="w-3.5 h-3.5 text-terracotta" />
                {place.isMealStop
                  ? `₹${place.averageCostPerPersonINR || 400}/person`
                  : place.entryFeeINR === 0
                  ? 'Free Entry'
                  : `₹${place.entryFeeINR}/person`}
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
                Opening Hours
              </span>
              <div className="text-xs font-semibold text-charcoal mt-1 line-clamp-2">
                {place.openingHours || '09:00 - 18:00'}
              </div>
            </div>
          </div>

          {/* Description & Historical Significance */}
          <div className="space-y-3">
            <p className="text-stone-700 text-sm sm:text-base leading-relaxed">
              {place.description}
            </p>
            {place.historicalSignificance && (
              <div className="p-3.5 rounded-xl bg-sage/10 border border-sage/20 text-xs text-deep-green leading-relaxed">
                <strong className="font-bold uppercase tracking-wider block mb-0.5 text-[10px]">
                  Historical & Cultural Context
                </strong>
                {place.historicalSignificance}
              </div>
            )}
          </div>

          {/* Highlights */}
          {place.highlights && place.highlights.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-2.5">
                Key Highlights & What to Expect
              </h4>
              <div className="flex flex-wrap gap-2">
                {place.highlights.map((h, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1.5 rounded-xl bg-white border border-stone-200/80 text-xs font-medium text-charcoal flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-sage" />
                    {h}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Phase 7 Original Source Provenance & Verification Metadata */}
          {place.originalData && (
            <div className="bg-white rounded-2xl p-4 border border-stone-200/80 space-y-2.5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 font-bold text-deep-green">
                  <ShieldCheck className="w-4 h-4 text-sage" />
                  <span>Original Source Provenance: {place.originalData.source}</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase tracking-wider">
                  {place.originalData.verificationStatus} • Verified {place.originalData.lastVerifiedAt}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-stone-600 pt-1">
                <div>
                  <strong className="text-charcoal">Source ID:</strong>{' '}
                  <code className="bg-stone-100 px-1.5 py-0.5 rounded">{place.originalData.sourceId}</code>
                </div>
                {place.originalData.address && (
                  <div>
                    <strong className="text-charcoal">Address:</strong> {place.originalData.address}
                  </div>
                )}
                {place.originalData.accessibilityInfo && (
                  <div className="sm:col-span-2">
                    <strong className="text-charcoal">Accessibility & Walking:</strong>{' '}
                    {place.originalData.accessibilityInfo}
                  </div>
                )}
                {place.originalData.facilities && place.originalData.facilities.length > 0 && (
                  <div className="sm:col-span-2">
                    <strong className="text-charcoal">Facilities:</strong>{' '}
                    {place.originalData.facilities.join(' • ')}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Google Reviews & Verified Visitor Consensus Section (Part 6) */}
          <div className="bg-white rounded-2xl p-5 border border-stone-200/80 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-100">
              <div>
                <div className="flex items-center gap-2">
                  <MessageSquareQuote className="w-4 h-4 text-sage" />
                  <h3 className="text-sm font-bold text-charcoal">
                    Visitor Reviews & Google Maps Insights
                  </h3>
                </div>
                <p className="text-[11px] text-stone-400 flex items-center gap-1 mt-0.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-sage" />
                  Source: {reviewData.sourceLabel} • Place ID: <code className="text-[10px] bg-stone-100 px-1.5 py-0.5 rounded">{reviewData.providerPlaceId}</code>
                </p>
              </div>

              <a
                href={reviewData.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-deep-green hover:text-terracotta transition-colors bg-sage/10 px-3 py-1.5 rounded-xl"
              >
                Open in Google Maps <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {reviewData.available ? (
              <>
                <p className="text-xs sm:text-sm text-stone-600 italic bg-stone-50 p-3.5 rounded-xl border border-stone-200/60">
                  "{reviewData.visitorSummary}"
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {reviewData.reviewHighlights.map((rev, i) => (
                    <div
                      key={i}
                      className="p-3.5 rounded-xl bg-[#FBF9F4] border border-stone-200/70 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-charcoal">
                          {rev.reviewerRole}
                        </span>
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: rev.rating }).map((_, idx) => (
                            <Star
                              key={idx}
                              className="w-3 h-3 fill-amber-400 text-amber-400"
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-stone-600 leading-relaxed">
                        "{rev.snippet}"
                      </p>
                      <span className="text-[10px] font-semibold text-stone-400 block">
                        {rev.visitContext}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/70 text-xs text-stone-500">
                {reviewData.visitorSummary}
              </div>
            )}
          </div>

          {/* Interactive Map Preview Toggle */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-400">
                Exact Geographic Coordinates ({place.latitude.toFixed(4)}°N, {place.longitude.toFixed(4)}°E)
              </span>
              <button
                type="button"
                onClick={() => setShowMap(!showMap)}
                className="text-xs font-bold text-deep-green hover:underline"
              >
                {showMap ? 'Hide Map' : 'Show Interactive Map'}
              </button>
            </div>

            {showMap && (
              <div className="rounded-2xl overflow-hidden border border-stone-200">
                <MapComponent markers={mapMarkers} height="220px" showRoute={false} />
              </div>
            )}
          </div>

          {/* Feedback message when adding to active trip */}
          {feedbackMsg && (
            <div
              className={`p-3.5 rounded-xl text-xs font-bold flex items-center justify-between ${
                feedbackMsg.ok
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border border-amber-200'
              }`}
            >
              <span>{feedbackMsg.text}</span>
              {feedbackMsg.ok && (
                <button
                  onClick={() => {
                    onClose();
                    navigate('/itinerary/preview');
                  }}
                  className="underline ml-3"
                >
                  View Trip
                </button>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-stone-200/80">
            <button
              type="button"
              onClick={handlePlanTripAroundPlace}
              className="flex-1 bg-deep-green hover:bg-deep-green/90 text-white py-3.5 px-5 rounded-2xl font-medium text-sm flex items-center justify-center gap-2 transition-all shadow-md"
            >
              <Compass className="w-4 h-4" />
              Plan a {place.city} Trip Including This Place
            </button>

            {activeTrip &&
              activeTrip.destinationName.toLowerCase() === place.city.toLowerCase() && (
                <button
                  type="button"
                  onClick={handleAddToActiveTrip}
                  className="bg-terracotta hover:bg-terracotta/90 text-white py-3.5 px-5 rounded-2xl font-medium text-sm flex items-center justify-center gap-2 transition-all shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  Add to Current {activeTrip.destinationName} Trip
                </button>
              )}
          </div>
        </div>
      </div>
    </div>
  );
};

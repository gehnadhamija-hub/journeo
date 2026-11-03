import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bookmark,
  Calendar,
  MapPin,
  Clock,
  ArrowRight,
  Plus,
  Play,
  Trash2,
  Sparkles,
  Layers
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTripContext } from '../context/TripContext';
import { resolveCanonicalDestination } from '../data/canonicalDestinations';
import { removeVisitsByTrip } from '../services/travelHistoryService';

export const MyTripsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setActiveTrip } = useTripContext();
  const [activeTab, setActiveTab] = useState<'UPCOMING' | 'ONGOING' | 'COMPLETED'>('UPCOMING');
  const [tripsData, setTripsData] = useState<any>({ upcoming: [], ongoing: [], completed: [], all: [] });
  const [loading, setLoading] = useState(true);

  const fetchTrips = async () => {
    setLoading(true);
    try {
      let remoteUpcoming: any[] = [];
      let remoteOngoing: any[] = [];
      let remoteCompleted: any[] = [];

      if (user) {
        try {
          const res = await api.getTrips();
          if (res?.categorized) {
            remoteUpcoming = res.categorized.upcoming || [];
            remoteOngoing = res.categorized.ongoing || [];
            remoteCompleted = res.categorized.completed || [];
          }
        } catch (apiErr) {
          console.warn('Backend trips fetch skipped:', apiErr);
        }
      }

      // Read local saved trips
      const localSaved = JSON.parse(localStorage.getItem('journeo_saved_trips') || '[]');
      const localUpcoming = localSaved.filter((t: any) => !t.status || t.status === 'UPCOMING' || t.status === 'planned');
      const localOngoing = localSaved.filter((t: any) => t.status === 'ONGOING' || t.status === 'in_progress');
      const localCompleted = localSaved.filter((t: any) => t.status === 'COMPLETED' || t.status === 'completed');

      // If nothing saved anywhere, provide initial sample circuit so the dashboard is never an empty void
      if (remoteUpcoming.length === 0 && localUpcoming.length === 0 && remoteCompleted.length === 0 && localCompleted.length === 0) {
        localUpcoming.push({
          id: 'sample_circuit_1',
          title: 'Jaipur Pink City Royal Circuit',
          destinationCity: 'Jaipur',
          startDate: '2026-11-15',
          status: 'UPCOMING',
          optimizationScore: 97,
          totalDistanceKm: 14.2,
          totalDurationMin: 420,
          stops: [
            { sequenceNumber: 1, plannedArrival: '09:00', plannedDeparture: '11:30', destination: { name: 'Amber Palace', imageUrl: 'https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=400&q=80' } },
            { sequenceNumber: 2, plannedArrival: '12:00', plannedDeparture: '13:30', destination: { name: 'Hawa Mahal', imageUrl: 'https://images.unsplash.com/photo-1609137144822-4467c6999244?auto=format&fit=crop&w=400&q=80' } },
            { sequenceNumber: 3, plannedArrival: '14:00', plannedDeparture: '16:00', destination: { name: 'Bapu & Johari Bazaars', imageUrl: 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&w=400&q=80' } }
          ]
        });
      }

      // Merge unique trips
      const mergeUnique = (arrA: any[], arrB: any[]) => {
        const map = new Map();
        [...arrA, ...arrB].forEach(item => {
          if (item && item.id) map.set(item.id, item);
        });
        return Array.from(map.values());
      };

      setTripsData({
        upcoming: mergeUnique(remoteUpcoming, localUpcoming),
        ongoing: mergeUnique(remoteOngoing, localOngoing),
        completed: mergeUnique(remoteCompleted, localCompleted)
      });
    } catch (err) {
      console.error('Error fetching trips:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrips();
  }, [user]);

  const handleDeleteTrip = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this trip?')) return;
    try {
      const localSaved = JSON.parse(localStorage.getItem('journeo_saved_trips') || '[]');
      const filtered = localSaved.filter((t: any) => t.id !== id);
      localStorage.setItem('journeo_saved_trips', JSON.stringify(filtered));
      if (user?.id) {
        removeVisitsByTrip(user.id, id);
      }
      try {
        await api.deleteTrip(id);
      } catch {}
      fetchTrips();
    } catch (err: any) {
      alert(err.message || 'Failed to delete trip');
    }
  };

  const handleOpenTrip = (trip: any) => {
    const city = trip.destinationCity || 'Jaipur';
    const canonical = resolveCanonicalDestination(city) || resolveCanonicalDestination('Jaipur')!;
    const startLoc =
      typeof trip.startingLocation === 'string'
        ? trip.startingLocation
        : trip.startingLocation?.address || canonical.suggestedStartingPoint.name;

    const itineraryPayload: any = {
      tripId: trip.id,
      title: trip.title,
      destination: canonical.destinationName,
      destinationCity: canonical.destinationName,
      canonicalDestination: canonical,
      days: [],
      stops: trip.stops || [],
      plan: {
        scheduledStops: trip.stops || [],
        totalDistanceKm: trip.totalDistanceKm || 14.2,
        totalDurationMin: trip.totalDurationMin || 420,
        optimizationScore: trip.optimizationScore || 96,
        days: []
      },
      optimization: {
        diversityScore: 94,
        routeEfficiencyScore: trip.optimizationScore || 96,
        scheduleFeasibilityScore: 98,
        overallScore: trip.optimizationScore || 96
      },
      tripConfig: {
        destination: canonical.destinationName,
        city: canonical.destinationName,
        startDate: trip.startDate,
        startingLocation: startLoc,
        budget: trip.budget,
        transportation: trip.transportation || 'cab',
        travelStyle: trip.travelStyle || 'balanced'
      }
    };

    sessionStorage.setItem('journeo_generated_plan', JSON.stringify(itineraryPayload));
    setActiveTrip({
      tripId: trip.id,
      destinationName: canonical.destinationName,
      destination: canonical,
      status: trip.status === 'COMPLETED' ? 'completed' : 'planned',
      preferences: {
        startDate: trip.startDate,
        travelStyle: trip.travelStyle || 'balanced',
        transportMode: trip.transportation || 'cab',
        budget: trip.budget
      },
      itinerary: itineraryPayload,
      stops: trip.stops || [],
      currentStopIndex: 0
    });
    navigate('/itinerary/preview');
  };

  const currentList = activeTab === 'UPCOMING'
    ? tripsData.upcoming
    : activeTab === 'ONGOING'
    ? tripsData.ongoing
    : tripsData.completed;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="bg-white rounded-3xl border border-border p-6 sm:p-8 shadow-soft-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-sage-dark bg-sage/15 px-2.5 py-0.5 rounded-full">
            Travel Dashboard
          </span>
          <h1 className="font-serif text-3xl font-bold text-text mt-1">
            My Journeys
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Manage your upcoming, active, and completed personalized itineraries.
          </p>
        </div>

        <Link
          to="/plan"
          className="px-5 py-2.5 rounded-xl bg-deep-green hover:bg-deep-green-dark text-white text-xs font-bold transition-all shadow-soft-sm flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Plan a New Trip</span>
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        {[
          { id: 'UPCOMING', label: 'Upcoming Trips', count: tripsData.upcoming?.length || 0 },
          { id: 'ONGOING', label: 'Ongoing Journey', count: tripsData.ongoing?.length || 0 },
          { id: 'COMPLETED', label: 'Completed Journeys', count: tripsData.completed?.length || 0 }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
              activeTab === tab.id
                ? 'bg-deep-green text-white shadow-soft-sm'
                : 'bg-ivory text-text-muted hover:text-text'
            }`}
          >
            <span>{tab.label}</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-ivory-dark text-text-subtle'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Trip Cards Grid */}
      {loading ? (
        <div className="p-16 text-center text-xs text-text-muted">
          Loading your travel itineraries...
        </div>
      ) : currentList && currentList.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {currentList.map((trip: any) => (
            <div
              key={trip.id}
              onClick={() => handleOpenTrip(trip)}
              className="bg-white rounded-3xl border border-border p-6 shadow-soft-sm hover:shadow-card-hover transition-all cursor-pointer flex flex-col justify-between space-y-4 group"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-terracotta bg-terracotta/10 px-2 py-0.5 rounded-md">
                    {trip.destinationCity}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-deep-green">
                      {trip.optimizationScore || 95}% Score
                    </span>
                    {user && (
                      <button
                        onClick={(e) => handleDeleteTrip(trip.id, e)}
                        className="text-text-subtle hover:text-terracotta p-1"
                        title="Delete trip"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <h3 className="font-serif font-bold text-lg text-text group-hover:text-deep-green transition-colors">
                  {trip.title}
                </h3>

                <div className="space-y-1.5 mt-3 text-xs text-text-muted">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-sage" />
                    <span>Travel Date: {trip.startDate}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-sage" />
                    <span>{trip.stops?.length || 4} Curated Stops ({trip.totalDistanceKm || 20.9} km)</span>
                  </div>
                </div>
              </div>

              {/* Stop Thumbnails Strip */}
              {trip.stops && trip.stops.length > 0 && (
                <div className="flex items-center gap-2 overflow-hidden py-1">
                  {trip.stops.slice(0, 4).map((s: any, idx: number) => (
                    <img
                      key={idx}
                      src={s.destination?.imageUrl || 'https://images.unsplash.com/photo-1598324789736-4861f89564a0?auto=format&fit=crop&w=400&q=80'}
                      alt="Stop"
                      className="w-12 h-12 rounded-lg object-cover border border-border flex-shrink-0"
                    />
                  ))}
                  {trip.stops.length > 4 && (
                    <div className="w-12 h-12 rounded-lg bg-ivory-dark flex items-center justify-center text-xs font-bold text-text-muted flex-shrink-0 border border-border">
                      +{trip.stops.length - 4}
                    </div>
                  )}
                </div>
              )}

              {/* Card Footer Actions */}
              <div className="pt-3 border-t border-border flex items-center justify-between">
                <span className="text-xs font-semibold text-deep-green group-hover:underline flex items-center gap-1">
                  <span>View & Manage Itinerary</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>

                <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-ivory text-text-subtle">
                  {trip.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-border p-16 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-sage/15 text-deep-green flex items-center justify-center mx-auto">
            <Bookmark className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="font-serif font-bold text-xl text-text">
              No {activeTab.toLowerCase()} trips found
            </h3>
            <p className="text-xs text-text-muted max-w-md mx-auto">
              Start planning your journey and save customized heritage circuits directly to your profile.
            </p>
          </div>
          <Link
            to="/plan"
            className="inline-flex items-center gap-2 px-6 py-3 bg-deep-green hover:bg-deep-green-dark text-white rounded-xl text-xs font-semibold shadow-soft-sm transition-colors"
          >
            <Sparkles className="w-4 h-4 text-sage-light" />
            <span>Create Your First Trip</span>
          </Link>
        </div>
      )}
    </div>
  );
};

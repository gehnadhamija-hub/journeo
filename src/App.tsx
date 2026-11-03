import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { TripProvider } from './context/TripContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { RequireAuth } from './components/RequireAuth';

import { HomePage } from './pages/HomePage';
import { AuthPage } from './pages/AuthPage';
import { PlanTripPage } from './pages/PlanTripPage';
import { ItineraryResultPage } from './pages/ItineraryResultPage';
import { JourneyModePage } from './pages/JourneyModePage';
import { MyTripsPage } from './pages/MyTripsPage';
import { DestinationsListPage } from './pages/DestinationsListPage';
import { DestinationDetailPage } from './pages/DestinationDetailPage';
import { ExplorePage } from './pages/ExplorePage';
import { ProfilePage } from './pages/ProfilePage';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <TripProvider>
        <BrowserRouter>
          <div className="min-h-screen bg-[#E8E9DC] text-[#344B3C] flex flex-col font-sans selection:bg-sage/25 selection:text-deep-green">
            <Navbar />

            <main className="flex-1">
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/login" element={<AuthPage />} />
                <Route path="/register" element={<AuthPage />} />
                <Route path="/explore" element={<ExplorePage />} />
                <Route path="/destinations" element={<DestinationsListPage />} />
                <Route path="/destinations/:id" element={<DestinationDetailPage />} />
                <Route path="/plan" element={<PlanTripPage />} />
                <Route path="/itinerary/preview" element={<ItineraryResultPage />} />
                <Route path="/journey" element={<JourneyModePage />} />
                <Route
                  path="/my-trips"
                  element={
                    <RequireAuth>
                      <MyTripsPage />
                    </RequireAuth>
                  }
                />
                <Route path="/dashboard" element={<Navigate to="/my-trips" replace />} />
                <Route
                  path="/profile"
                  element={
                    <RequireAuth>
                      <ProfilePage />
                    </RequireAuth>
                  }
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>

            <Footer />
          </div>
        </BrowserRouter>
      </TripProvider>
    </AuthProvider>
  );
};

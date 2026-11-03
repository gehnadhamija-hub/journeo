/// <reference types="vite/client" />
import { supabase } from '../lib/supabaseClient';

// NOTE: The backend API is still used for AI / replanner endpoints.
const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000/api';

function getAuthHeaders() {
  const token = localStorage.getItem('journeo_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

export const api = {
  // Auth
  async register(name: string, email: string, password: string) {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to register');
    }
    const data = await res.json();
    if (data.token) localStorage.setItem('journeo_token', data.token);
    return data;
  },

  async login(email: string, password: string) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Invalid credentials');
    }
    const data = await res.json();
    if (data.token) localStorage.setItem('journeo_token', data.token);
    return data;
  },

  async getMe() {
    const token = localStorage.getItem('journeo_token');
    if (!token) return null;
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      localStorage.removeItem('journeo_token');
      return null;
    }
    const data = await res.json();
    return data.user;
  },

  logout() {
    localStorage.removeItem('journeo_token');
  },

  // User Profile & Preferences
  async updatePreferences(prefs: any) {
    const res = await fetch(`${API_BASE}/users/preferences`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(prefs)
    });
    return res.json();
  },

  // Destinations
  async getDestinations(params: { city?: string; category?: string; search?: string; tag?: string } = {}) {
    const query = new URLSearchParams(params as any).toString();
    const res = await fetch(`${API_BASE}/destinations?${query}`);
    return res.json();
  },

  async getDestinationById(id: string) {
    const res = await fetch(`${API_BASE}/destinations/${id}`);
    return res.json();
  },

  async getRecommendedDestinations(city: string = 'Delhi') {
    const res = await fetch(`${API_BASE}/destinations/recommended?city=${city}`, {
      headers: getAuthHeaders()
    });
    return res.json();
  },

  async toggleSaveDestination(id: string) {
    const res = await fetch(`${API_BASE}/destinations/${id}/save`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    return res.json();
  },

  // Itineraries
  async generateItinerary(payload: any) {
    const res = await fetch(`${API_BASE}/itineraries/generate`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    return res.json();
  },

  async replanItinerary(tripId: string, payload: any) {
    const res = await fetch(`${API_BASE}/itineraries/${tripId}/replan`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    return res.json();
  },

  async applyAdaptiveStrategy(tripId: string, updatedStops: any[]) {
    const res = await fetch(`${API_BASE}/itineraries/${tripId}/apply-strategy`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ updatedStops })
    });
    return res.json();
  },

  async updateStopStatus(stopId: string, status: string) {
    const res = await fetch(`${API_BASE}/itineraries/stops/${stopId}/status`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status })
    });
    return res.json();
  },

  // Trips
  async createTrip(tripData: any) {
    const res = await fetch(`${API_BASE}/trips`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(tripData)
    });
    return res.json();
  },

  async getTrips() {
    const res = await fetch(`${API_BASE}/trips`, {
      headers: getAuthHeaders()
    });
    return res.json();
  },

  async getTripById(id: string) {
    const res = await fetch(`${API_BASE}/trips/${id}`, {
      headers: getAuthHeaders()
    });
    return res.json();
  },

  async updateTrip(id: string, payload: any) {
    const res = await fetch(`${API_BASE}/trips/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    return res.json();
  },

  async deleteTrip(id: string) {
    const res = await fetch(`${API_BASE}/trips/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return res.json();
  },

  // Maps
  async getMapsStatus() {
    const res = await fetch(`${API_BASE}/maps/status`);
    return res.json();
  }
};

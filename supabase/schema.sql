-- =====================================================================
-- JOURNEO TRAVEL PLANNER: POSTGRESQL SCHEMA WITH ROW LEVEL SECURITY
-- Target Database: Supabase PostgreSQL
-- =====================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. USER PROFILES TABLE
-- Extends Supabase auth.users with public profile metadata
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  preferences JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. PLACES / DESTINATIONS TABLE
-- Curated places across India with category, coordinates, timing & ASI/UNESCO sources
CREATE TABLE IF NOT EXISTS public.places (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Heritage', 'Nature', 'Spiritual', 'Culture', 'Food', 'Shopping', 'Adventure')),
  description TEXT,
  historical_significance TEXT,
  interest_tags JSONB DEFAULT '[]'::jsonb,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  average_visit_duration INT DEFAULT 90, -- in minutes
  opening_hours TEXT DEFAULT '09:00 - 17:30',
  entry_fee_inr INT DEFAULT 0,
  image_url TEXT,
  official_source TEXT,
  highlights JSONB DEFAULT '[]'::jsonb,
  is_must_visit BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. USER TRIPS TABLE
-- User-created customized travel itineraries
CREATE TABLE IF NOT EXISTS public.trips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  destination_city TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  starting_location TEXT DEFAULT 'City Centre',
  budget NUMERIC(10, 2),
  group_size INT DEFAULT 1,
  transportation TEXT DEFAULT 'cab' CHECK (transportation IN ('cab', 'public', 'walking', 'bicycle')),
  travel_style TEXT DEFAULT 'balanced' CHECK (travel_style IN ('relaxed', 'balanced', 'packed')),
  status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
  optimization_score INT DEFAULT 95,
  total_distance_km NUMERIC(6, 2) DEFAULT 0,
  total_duration_min INT DEFAULT 0,
  preferences JSONB DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. ITINERARY ITEMS / STOPS TABLE
-- Ordered sequential stops belonging to an active or planned trip
CREATE TABLE IF NOT EXISTS public.itinerary_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  place_id UUID REFERENCES public.places(id) ON DELETE SET NULL,
  sequence_number INT NOT NULL,
  planned_arrival TIME NOT NULL,
  planned_departure TIME NOT NULL,
  visit_duration INT DEFAULT 90, -- in minutes
  visit_status TEXT DEFAULT 'PENDING' CHECK (visit_status IN ('PENDING', 'VISITED', 'SKIPPED')),
  actual_visit_time TIMESTAMPTZ,
  is_must_visit BOOLEAN DEFAULT FALSE,
  transit_instruction TEXT,
  transit_minutes INT DEFAULT 15,
  distance_from_prev_km NUMERIC(5, 2) DEFAULT 3.0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. USER PREFERENCES TABLE
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  preferred_categories JSONB DEFAULT '[]'::jsonb,
  travel_pace TEXT DEFAULT 'balanced',
  budget_preference TEXT DEFAULT 'medium',
  transport_preference TEXT DEFAULT 'cab',
  custom_prompt TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================================

-- Enable RLS on all user-sensitive tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itinerary_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- 1. Profiles: Users can view and modify only their own profile
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- 2. Places: Public read for all users, write restricted to service role / admin
CREATE POLICY "Public places can be read by all authenticated or anon users"
  ON public.places FOR SELECT
  USING (true);

-- 3. Trips: Users can manage only their own trips
CREATE POLICY "Users can read own trips"
  ON public.trips FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own trips"
  ON public.trips FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own trips"
  ON public.trips FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own trips"
  ON public.trips FOR DELETE
  USING (auth.uid() = user_id);

-- 4. Itinerary Items: Users can access stops belonging to their own trips
CREATE POLICY "Users can read itinerary stops of their own trips"
  ON public.itinerary_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.trips
      WHERE trips.id = itinerary_items.trip_id
      AND trips.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert itinerary stops into their own trips"
  ON public.itinerary_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.trips
      WHERE trips.id = itinerary_items.trip_id
      AND trips.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update itinerary stops in their own trips"
  ON public.itinerary_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.trips
      WHERE trips.id = itinerary_items.trip_id
      AND trips.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete itinerary stops in their own trips"
  ON public.itinerary_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.trips
      WHERE trips.id = itinerary_items.trip_id
      AND trips.user_id = auth.uid()
    )
  );

-- 5. User Preferences: Users can manage their own preferences
CREATE POLICY "Users can manage own preferences"
  ON public.user_preferences FOR ALL
  USING (auth.uid() = user_id);

-- =====================================================================
-- PERFORMANCE INDEXES
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_places_city ON public.places(city);
CREATE INDEX IF NOT EXISTS idx_places_category ON public.places(category);
CREATE INDEX IF NOT EXISTS idx_trips_user_id ON public.trips(user_id);
CREATE INDEX IF NOT EXISTS idx_itinerary_items_trip ON public.itinerary_items(trip_id, sequence_number);

-- =====================================================================
-- AUTO-SYNC USER PROFILE TRIGGER
-- Creates a public.profiles row automatically when a user signs up via Supabase Auth
-- =====================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


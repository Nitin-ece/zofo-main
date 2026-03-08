-- =============================================================
-- ZoFo Supabase Schema - Full Setup
-- Run ALL of this in your Supabase SQL Editor
-- =============================================================

-- Enable uuid extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------
-- 1. public.users — mirrors auth.users for FK references
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email text NOT NULL,
  username text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ----------------------------------------------------------------
-- 2. Auto-create public.users row when someone signs up
--    This is the FIX for FoPo not saving — without this trigger,
--    all saves silently fail with a foreign key violation.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, username)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        username = COALESCE(EXCLUDED.username, public.users.username);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Also backfill any existing auth users who don't have a public.users row yet
INSERT INTO public.users (id, email, username)
SELECT
  id,
  email,
  COALESCE(raw_user_meta_data->>'username', split_part(email, '@', 1))
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------
-- 3. focus_sessions — stores each completed focus session
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.focus_sessions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES public.users ON DELETE CASCADE NOT NULL,
  start_time timestamp with time zone NOT NULL,
  end_time timestamp with time zone NOT NULL,
  focus_minutes integer NOT NULL,
  distractions integer DEFAULT 0,
  fopo_earned integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add created_at if upgrading from old schema
ALTER TABLE public.focus_sessions ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL;
ALTER TABLE public.focus_sessions ADD COLUMN IF NOT EXISTS fopo_earned integer DEFAULT 0;

-- ----------------------------------------------------------------
-- 4. fopo_points — cumulative FoPo per user (NEVER resets)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fopo_points (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES public.users ON DELETE CASCADE NOT NULL,
  total_fopo integer DEFAULT 0,
  level integer DEFAULT 1,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT fopo_points_user_id_key UNIQUE (user_id)
);

-- Add unique constraint if upgrading from old schema
ALTER TABLE public.fopo_points ADD CONSTRAINT IF NOT EXISTS fopo_points_user_id_key UNIQUE (user_id);

-- ----------------------------------------------------------------
-- 5. daily_fopo — per-day FoPo snapshot for leaderboard/analytics
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_fopo (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  date date NOT NULL,
  fopo_earned integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT daily_fopo_user_date_key UNIQUE (user_id, date)
);

-- ----------------------------------------------------------------
-- 6. music_library
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.music_library (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES public.users ON DELETE CASCADE NOT NULL,
  song_name text NOT NULL,
  file_url text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ----------------------------------------------------------------
-- 7. RLS Policies — each user can only read/write their own data
-- ----------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fopo_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_fopo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.music_library ENABLE ROW LEVEL SECURITY;

-- Users table
CREATE POLICY IF NOT EXISTS "Users can read own record" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY IF NOT EXISTS "Users can insert own record" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY IF NOT EXISTS "Users can update own record" ON public.users FOR UPDATE USING (auth.uid() = id);

-- Focus sessions
CREATE POLICY IF NOT EXISTS "Users can insert own sessions" ON public.focus_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "Users can read own sessions" ON public.focus_sessions FOR SELECT USING (auth.uid() = user_id);

-- FoPo points (readable by all for leaderboard, writable by owner)
CREATE POLICY IF NOT EXISTS "Anyone can view fopo_points" ON public.fopo_points FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Users can upsert own fopo" ON public.fopo_points FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "Users can update own fopo" ON public.fopo_points FOR UPDATE USING (auth.uid() = user_id);

-- Daily FoPo (readable by all for leaderboard, writable by owner)
CREATE POLICY IF NOT EXISTS "Anyone can view daily_fopo" ON public.daily_fopo FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Users can upsert own daily fopo" ON public.daily_fopo FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "Users can update own daily fopo" ON public.daily_fopo FOR UPDATE USING (auth.uid() = user_id);

-- Music library
CREATE POLICY IF NOT EXISTS "Users can manage own music" ON public.music_library FOR ALL USING (auth.uid() = user_id);

-- ----------------------------------------------------------------
-- 8. study_rooms — live focus rooms created by users
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.study_rooms (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  host_id uuid REFERENCES public.users ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  subject text NOT NULL,
  max_participants integer DEFAULT 8,
  participants integer DEFAULT 1,
  is_private boolean DEFAULT false,
  is_live boolean DEFAULT true,
  room_code text UNIQUE NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.study_rooms ENABLE ROW LEVEL SECURITY;

-- Anyone can see public live rooms
CREATE POLICY IF NOT EXISTS "Anyone can view public live rooms" ON public.study_rooms FOR SELECT USING (is_private = false AND is_live = true);

-- Host can read their own private rooms
CREATE POLICY IF NOT EXISTS "Host can view own private rooms" ON public.study_rooms FOR SELECT USING (auth.uid() = host_id);

-- Users can insert their own rooms
CREATE POLICY IF NOT EXISTS "Users can create study rooms" ON public.study_rooms FOR INSERT WITH CHECK (auth.uid() = host_id);

-- Host can update their own rooms
CREATE POLICY IF NOT EXISTS "Host can update own study rooms" ON public.study_rooms FOR UPDATE USING (auth.uid() = host_id);

-- Host can delete their own rooms
CREATE POLICY IF NOT EXISTS "Host can delete own study rooms" ON public.study_rooms FOR DELETE USING (auth.uid() = host_id);

-- ----------------------------------------------------------------
-- 9. webrtc_signals — WebRTC signaling messages (offer/answer/ICE)
--    Used as backup/persistence layer alongside Supabase Realtime Broadcast.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.webrtc_signals (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id text NOT NULL,
  sender_id text NOT NULL,
  type text NOT NULL,   -- 'offer' | 'answer' | 'ice-candidate' | 'peer-joined' | 'peer-left'
  data jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Index on room_id for fast lookups
CREATE INDEX IF NOT EXISTS webrtc_signals_room_id_idx ON public.webrtc_signals (room_id);
-- Index on created_at so cleanup jobs can prune old signals efficiently
CREATE INDEX IF NOT EXISTS webrtc_signals_created_at_idx ON public.webrtc_signals (created_at);

ALTER TABLE public.webrtc_signals ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can insert their own signals
CREATE POLICY IF NOT EXISTS "Authenticated users can insert signals"
  ON public.webrtc_signals FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Any authenticated user can read signals (needed to receive offers / answers)
CREATE POLICY IF NOT EXISTS "Authenticated users can read signals"
  ON public.webrtc_signals FOR SELECT
  USING (auth.role() = 'authenticated');

-- Cleanup: auto-delete signals older than 1 hour to keep the table lean.
-- Run this in Supabase's pg_cron extension (Dashboard > Database > Extensions > pg_cron):
-- SELECT cron.schedule('cleanup-webrtc-signals', '*/30 * * * *',
--   $$DELETE FROM public.webrtc_signals WHERE created_at < now() - interval '1 hour'$$
-- );


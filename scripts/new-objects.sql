-- Run this in the Supabase SQL Editor.
-- Safe to re-run: uses IF NOT EXISTS / ON CONFLICT / DROP POLICY IF EXISTS.
-- Creates: child_milestones, caregiver_notes, card-images bucket, growth_journeys, learning_subjects.

-- === 20260630040000_child_milestones ===
-- Persistent growth milestone progress per child.
CREATE TABLE IF NOT EXISTS public.child_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  child_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  journey_slug text NOT NULL,
  milestone_key text NOT NULL,
  done boolean NOT NULL DEFAULT false,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (child_id, journey_slug, milestone_key)
);

ALTER TABLE public.child_milestones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own milestones select" ON public.child_milestones;
DROP POLICY IF EXISTS "own milestones insert" ON public.child_milestones;
DROP POLICY IF EXISTS "own milestones update" ON public.child_milestones;
DROP POLICY IF EXISTS "own milestones delete" ON public.child_milestones;

CREATE POLICY "own milestones select" ON public.child_milestones FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own milestones insert" ON public.child_milestones FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own milestones update" ON public.child_milestones FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own milestones delete" ON public.child_milestones FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS child_milestones_touch_updated_at ON public.child_milestones;
CREATE TRIGGER child_milestones_touch_updated_at
  BEFORE UPDATE ON public.child_milestones
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS child_milestones_child_idx ON public.child_milestones(child_id);
CREATE INDEX IF NOT EXISTS child_milestones_user_idx ON public.child_milestones(user_id);

-- === 20260630040100_caregiver_notes ===
-- Cross-device caregiver notes (replaces localStorage-only vault).
CREATE TABLE IF NOT EXISTS public.caregiver_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.caregiver_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own notes select" ON public.caregiver_notes;
DROP POLICY IF EXISTS "own notes insert" ON public.caregiver_notes;
DROP POLICY IF EXISTS "own notes update" ON public.caregiver_notes;
DROP POLICY IF EXISTS "own notes delete" ON public.caregiver_notes;

CREATE POLICY "own notes select" ON public.caregiver_notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own notes insert" ON public.caregiver_notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own notes update" ON public.caregiver_notes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own notes delete" ON public.caregiver_notes FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS caregiver_notes_touch_updated_at ON public.caregiver_notes;
CREATE TRIGGER caregiver_notes_touch_updated_at
  BEFORE UPDATE ON public.caregiver_notes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS caregiver_notes_user_idx ON public.caregiver_notes(user_id);

-- === 20260630040200_card_images_bucket ===
-- Public storage bucket for expression-card images uploaded from device.
INSERT INTO storage.buckets (id, name, public)
VALUES ('card-images', 'card-images', true)
ON CONFLICT (id) DO NOTHING;

-- Anyone can read (cards are shown publicly on /communication).
DROP POLICY IF EXISTS "card-images public read" ON storage.objects;
CREATE POLICY "card-images public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'card-images');

-- Only admins may upload / change / remove card images.
DROP POLICY IF EXISTS "card-images admin insert" ON storage.objects;
CREATE POLICY "card-images admin insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'card-images' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "card-images admin update" ON storage.objects;
CREATE POLICY "card-images admin update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'card-images' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "card-images admin delete" ON storage.objects;
CREATE POLICY "card-images admin delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'card-images' AND public.has_role(auth.uid(), 'admin'));

-- === 20260630050000_growth_journeys ===
-- Admin-editable growth journeys (the shipped 6 + any added). Public reads published.
CREATE TABLE IF NOT EXISTS public.growth_journeys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title_en text NOT NULL,
  title_fr text,
  intro_en text NOT NULL DEFAULT '',
  intro_fr text,
  -- milestones: jsonb array of { title_en, title_fr, note_en, note_fr }
  milestones jsonb NOT NULL DEFAULT '[]'::jsonb,
  published boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.growth_journeys TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.growth_journeys TO authenticated;
GRANT ALL ON public.growth_journeys TO service_role;

ALTER TABLE public.growth_journeys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read published journeys" ON public.growth_journeys;
CREATE POLICY "Anyone can read published journeys"
  ON public.growth_journeys FOR SELECT
  USING (published = true OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins insert journeys" ON public.growth_journeys;
CREATE POLICY "Admins insert journeys"
  ON public.growth_journeys FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins update journeys" ON public.growth_journeys;
CREATE POLICY "Admins update journeys"
  ON public.growth_journeys FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins delete journeys" ON public.growth_journeys;
CREATE POLICY "Admins delete journeys"
  ON public.growth_journeys FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_growth_journeys_updated ON public.growth_journeys;
CREATE TRIGGER trg_growth_journeys_updated
  BEFORE UPDATE ON public.growth_journeys
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- === 20260630050100_learning_subjects ===
-- Admin-editable learning subjects (the shipped 12 + any added). Public reads published.
CREATE TABLE IF NOT EXISTS public.learning_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title_en text NOT NULL,
  title_fr text,
  blurb_en text NOT NULL DEFAULT '',
  blurb_fr text,
  -- topics: jsonb array of { title_en, title_fr, minutes, definition_en, definition_fr, explanation_en, explanation_fr, examples_en (text[]), examples_fr (text[]) }
  topics jsonb NOT NULL DEFAULT '[]'::jsonb,
  published boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.learning_subjects TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.learning_subjects TO authenticated;
GRANT ALL ON public.learning_subjects TO service_role;

ALTER TABLE public.learning_subjects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read published subjects" ON public.learning_subjects;
CREATE POLICY "Anyone can read published subjects"
  ON public.learning_subjects FOR SELECT
  USING (published = true OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins insert subjects" ON public.learning_subjects;
CREATE POLICY "Admins insert subjects"
  ON public.learning_subjects FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins update subjects" ON public.learning_subjects;
CREATE POLICY "Admins update subjects"
  ON public.learning_subjects FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins delete subjects" ON public.learning_subjects;
CREATE POLICY "Admins delete subjects"
  ON public.learning_subjects FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_learning_subjects_updated ON public.learning_subjects;
CREATE TRIGGER trg_learning_subjects_updated
  BEFORE UPDATE ON public.learning_subjects
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


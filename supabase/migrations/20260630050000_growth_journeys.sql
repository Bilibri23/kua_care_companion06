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

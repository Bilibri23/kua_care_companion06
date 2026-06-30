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

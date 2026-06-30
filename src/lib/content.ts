// DB-first loaders for editable content (growth journeys, learning subjects),
// falling back to the bundled static content when the DB has no rows.
import { supabase } from "@/integrations/supabase/client";
import { journeys as staticJourneys, journeyBySlug, journeyForLang, type Journey } from "@/lib/kua-content";
import { richSubjects, richSubjectBySlug, type RichSubject, type Topic } from "@/lib/subjects-content";

export type Bi = { en: string; fr: string };
export type LJourney = {
  slug: string;
  title: Bi;
  intro: Bi;
  milestones: { title: Bi; note: Bi }[];
};

// ---- Journeys ----

function staticToLJourney(j: Journey): LJourney {
  const fr = journeyForLang(j, "fr");
  return {
    slug: j.slug,
    title: { en: j.title, fr: fr.title },
    intro: { en: j.intro, fr: fr.intro },
    milestones: j.milestones.map((m, i) => ({
      title: { en: m.title, fr: fr.milestones[i]?.title ?? m.title },
      note: { en: m.note ?? "", fr: fr.milestones[i]?.note ?? m.note ?? "" },
    })),
  };
}

type DbMilestone = { title_en?: string; title_fr?: string; note_en?: string; note_fr?: string };
function dbToLJourney(r: {
  slug: string; title_en: string; title_fr: string | null; intro_en: string; intro_fr: string | null; milestones: unknown;
}): LJourney {
  const ms = Array.isArray(r.milestones) ? (r.milestones as DbMilestone[]) : [];
  return {
    slug: r.slug,
    title: { en: r.title_en, fr: r.title_fr || r.title_en },
    intro: { en: r.intro_en, fr: r.intro_fr || r.intro_en },
    milestones: ms.map((m) => ({
      title: { en: m.title_en ?? "", fr: m.title_fr || m.title_en || "" },
      note: { en: m.note_en ?? "", fr: m.note_fr || m.note_en || "" },
    })),
  };
}

export async function loadJourneys(): Promise<LJourney[]> {
  const { data } = await supabase
    .from("growth_journeys")
    .select("slug,title_en,title_fr,intro_en,intro_fr,milestones")
    .eq("published", true)
    .order("sort_order");
  if (data && data.length) return data.map(dbToLJourney);
  return staticJourneys.map(staticToLJourney);
}

export async function loadJourney(slug: string): Promise<LJourney | null> {
  const { data } = await supabase
    .from("growth_journeys")
    .select("slug,title_en,title_fr,intro_en,intro_fr,milestones")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();
  if (data) return dbToLJourney(data);
  const s = journeyBySlug(slug);
  return s ? staticToLJourney(s) : null;
}

// ---- Learning subjects ----

type DbTopic = {
  title_en: string; title_fr?: string; minutes: number;
  definition_en: string; definition_fr?: string;
  explanation_en: string; explanation_fr?: string;
  examples_en: string[]; examples_fr?: string[];
};

export function topicFromDb(t: DbTopic): Topic {
  return {
    title: { en: t.title_en, fr: t.title_fr || t.title_en },
    definition: { en: t.definition_en, fr: t.definition_fr || t.definition_en },
    explanation: { en: t.explanation_en, fr: t.explanation_fr || t.explanation_en },
    examples: { en: t.examples_en ?? [], fr: t.examples_fr && t.examples_fr.length ? t.examples_fr : (t.examples_en ?? []) },
    minutes: t.minutes ?? 5,
  };
}

function dbToRichSubject(r: {
  slug: string; title_en: string; title_fr: string | null; blurb_en: string; blurb_fr: string | null; topics: unknown;
}): RichSubject {
  const topics = Array.isArray(r.topics) ? (r.topics as DbTopic[]) : [];
  return {
    slug: r.slug,
    title: { en: r.title_en, fr: r.title_fr || r.title_en },
    blurb: { en: r.blurb_en ?? "", fr: r.blurb_fr || r.blurb_en || "" },
    topics: topics.map(topicFromDb),
  };
}

export async function loadSubjects(): Promise<RichSubject[]> {
  const { data } = await supabase
    .from("learning_subjects")
    .select("slug,title_en,title_fr,blurb_en,blurb_fr,topics")
    .eq("published", true)
    .order("sort_order");
  if (data && data.length) return data.map(dbToRichSubject);
  return richSubjects;
}

/** Load a subject page: DB subject (or static), then append admin lessons tagged with this subject. */
export async function loadSubjectBySlug(slug: string): Promise<RichSubject | null> {
  // Base: DB learning_subjects, else built-in.
  const { data: dbSubject } = await supabase
    .from("learning_subjects")
    .select("slug,title_en,title_fr,blurb_en,blurb_fr,topics")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();
  let base: RichSubject | null = dbSubject ? dbToRichSubject(dbSubject) : richSubjectBySlug(slug) ?? null;

  // Append lessons tagged with this subject (category).
  const { data: lessons } = await supabase
    .from("lesson_notes")
    .select("title_en,title_fr,topics,updated_at")
    .eq("subject", slug)
    .eq("published", true)
    .order("updated_at", { ascending: true });
  const extra = (lessons ?? []).flatMap((l) => (Array.isArray(l.topics) ? (l.topics as DbTopic[]).map(topicFromDb) : []));

  if (base) return extra.length ? { ...base, topics: [...base.topics, ...extra] } : base;

  // No built-in/DB subject: maybe a standalone lesson lives at this exact slug.
  const { data: standalone } = await supabase
    .from("lesson_notes")
    .select("slug,title_en,title_fr,blurb_en,blurb_fr,topics")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();
  if (standalone) {
    return {
      slug: standalone.slug,
      title: { en: standalone.title_en, fr: standalone.title_fr || standalone.title_en },
      blurb: { en: standalone.blurb_en ?? "", fr: standalone.blurb_fr || standalone.blurb_en || "" },
      topics: Array.isArray(standalone.topics) ? (standalone.topics as DbTopic[]).map(topicFromDb) : [],
    };
  }
  if (extra.length) return { slug, title: { en: slug, fr: slug }, blurb: { en: "", fr: "" }, topics: extra };
  return null;
}

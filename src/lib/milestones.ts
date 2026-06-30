import { supabase } from "@/integrations/supabase/client";

// Map keyed by `${journey_slug}:${milestone_key}` -> done.
export type MilestoneState = Record<string, boolean>;

export const milestoneId = (slug: string, key: string | number) => `${slug}:${key}`;

/** Load all persisted milestone states for a child. Returns {} on error/empty. */
export async function loadChildMilestones(childId: string): Promise<MilestoneState> {
  const { data, error } = await supabase
    .from("child_milestones")
    .select("journey_slug, milestone_key, done")
    .eq("child_id", childId);
  if (error || !data) return {};
  const map: MilestoneState = {};
  for (const r of data) map[milestoneId(r.journey_slug, r.milestone_key)] = r.done;
  return map;
}

// localStorage fallback so progress never silently reverts when there is no
// active child (or while signed out). Keyed per user (or "anon").
const lsKey = (scope: string) => `kua_milestones_${scope}`;

export function loadLocalMilestones(scope: string): MilestoneState {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(lsKey(scope)) || "{}"); } catch { return {}; }
}

export function setLocalMilestone(scope: string, slug: string, key: string | number, done: boolean) {
  if (typeof window === "undefined") return;
  const map = loadLocalMilestones(scope);
  map[milestoneId(slug, key)] = done;
  localStorage.setItem(lsKey(scope), JSON.stringify(map));
}

/** Upsert a single milestone's done state for a child. */
export async function setChildMilestone(opts: {
  userId: string;
  childId: string;
  slug: string;
  key: string | number;
  done: boolean;
  note?: string | null;
}) {
  const { userId, childId, slug, key, done, note } = opts;
  return supabase.from("child_milestones").upsert(
    {
      user_id: userId,
      child_id: childId,
      journey_slug: slug,
      milestone_key: String(key),
      done,
      note: note ?? null,
    },
    { onConflict: "child_id,journey_slug,milestone_key" },
  );
}

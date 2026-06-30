import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Circle, Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { pickLang } from "@/lib/subjects-content";
import { loadJourney, loadJourneys, type LJourney } from "@/lib/content";
import { usePrefs } from "@/lib/prefs";
import { useAuth } from "@/lib/auth";
import { useChildren } from "@/lib/children";
import { loadChildMilestones, setChildMilestone, milestoneId, loadLocalMilestones, setLocalMilestone } from "@/lib/milestones";
import { toast } from "sonner";

export const Route = createFileRoute("/journey/$slug")({
  head: ({ loaderData }) => {
    const j = (loaderData as { journey?: LJourney } | undefined)?.journey;
    return { meta: [{ title: `${j?.title.en ?? "Journey"} - KUA` }, { name: "description", content: j?.intro.en ?? "Journey details." }] };
  },
  loader: async ({ params }) => {
    const journey = await loadJourney(params.slug);
    if (!journey) throw notFound();
    return { journey };
  },
  notFoundComponent: () => (
    <AppShell title="Journey not found">
      <Link to="/growth" className="text-primary hover:underline">← Back to Growth</Link>
    </AppShell>
  ),
  errorComponent: ({ error }) => <AppShell title="Something went wrong"><p className="text-muted-foreground">{error.message}</p></AppShell>,
  component: JourneyPage,
});

function JourneyPage() {
  const { journey } = Route.useLoaderData() as { journey: LJourney };
  const { lang } = usePrefs();
  const { user } = useAuth();
  const { activeChild } = useChildren();
  const [done, setDone] = useState<boolean[]>(() => journey.milestones.map(() => false));
  const [others, setOthers] = useState<LJourney[]>([]);

  const localScope = activeChild ? `child_${activeChild.id}` : user ? `user_${user.id}` : "anon";

  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      const saved = user && activeChild ? await loadChildMilestones(activeChild.id) : loadLocalMilestones(localScope);
      if (cancelled) return;
      setDone(journey.milestones.map((_, i) => saved[milestoneId(journey.slug, i)] ?? false));
    }
    void hydrate();
    void loadJourneys().then((js) => { if (!cancelled) setOthers(js.filter((j) => j.slug !== journey.slug)); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journey.slug, user?.id, activeChild?.id]);

  async function toggle(i: number) {
    const nextDone = !done[i];
    setDone((arr) => arr.map((d, j) => (j === i ? nextDone : d)));
    if (user && activeChild) {
      const { error } = await setChildMilestone({ userId: user.id, childId: activeChild.id, slug: journey.slug, key: i, done: nextDone });
      if (error) {
        setDone((arr) => arr.map((d, j) => (j === i ? !nextDone : d)));
        toast.error("Couldn't save progress", { description: error.message });
      }
    } else {
      setLocalMilestone(localScope, journey.slug, i, nextDone);
    }
  }

  const doneCount = done.filter(Boolean).length;
  const pct = journey.milestones.length ? Math.round((doneCount / journey.milestones.length) * 100) : 0;

  const ui = lang === "fr"
    ? { back: "Retour à la croissance", celebrated: "célébrées", along: "% du chemin parcouru", others: "Autres parcours" }
    : { back: "Back to Growth", celebrated: "celebrated", along: "% along the path", others: "Other journeys" };

  return (
    <AppShell title={pickLang(journey.title, lang)} subtitle={pickLang(journey.intro, lang)}>
      <Link to="/growth" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {ui.back}
      </Link>

      <section className="rounded-3xl border border-border/60 bg-card p-6 shadow-soft">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-primary">
              <Sparkles className="h-3.5 w-3.5" /> {doneCount} {lang === "fr" ? "sur" : "of"} {journey.milestones.length} {ui.celebrated}
            </div>
            <h2 className="mt-2 font-display text-2xl font-extrabold">{pct}{ui.along}</h2>
          </div>
          <div className="hidden h-2 w-48 overflow-hidden rounded-full bg-muted md:block">
            <div className="h-full bg-gradient-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <ol className="mt-6 space-y-2">
          {journey.milestones.map((m, i) => {
            const isDone = done[i];
            const note = pickLang(m.note, lang);
            return (
              <li key={`${i}-${m.title.en}`}>
                <button
                  onClick={() => void toggle(i)}
                  className={`flex w-full items-start gap-4 rounded-2xl border border-transparent px-4 py-3 text-left transition hover:border-border hover:bg-muted/40 ${isDone ? "opacity-70" : ""}`}
                >
                  {isDone ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" /> : <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />}
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm font-semibold ${isDone ? "line-through" : ""}`}>{pickLang(m.title, lang)}</div>
                    {note && <div className="mt-1 text-xs text-muted-foreground">{note}</div>}
                  </div>
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="mt-8">
        <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-widest text-muted-foreground">{ui.others}</h3>
        <div className="flex flex-wrap gap-2">
          {others.map((j) => (
            <Link key={j.slug} to="/journey/$slug" params={{ slug: j.slug }} className="rounded-full bg-muted px-4 py-2 text-xs font-semibold hover:bg-primary-soft hover:text-primary">
              {pickLang(j.title, lang)}
            </Link>
          ))}
        </div>
      </section>
    </AppShell>
  );
}

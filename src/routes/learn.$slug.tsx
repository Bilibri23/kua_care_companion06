import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Clock, BookOpen, Sparkles, Lightbulb, ListChecks } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  richSubjects,
  pickLang,
  pickList,
  type RichSubject,
} from "@/lib/subjects-content";
import { usePrefs } from "@/lib/prefs";
import { loadSubjectBySlug } from "@/lib/content";

const loadSubject = loadSubjectBySlug;

export const Route = createFileRoute("/learn/$slug")({
  head: ({ loaderData }) => {
    const s = (loaderData as { subject?: RichSubject } | undefined)?.subject;
    return {
      meta: [
        { title: `${s?.title.en ?? "Learn"} - KUA` },
        { name: "description", content: s?.blurb.en ?? "" },
      ],
    };
  },
  loader: async ({ params }) => {
    const s = await loadSubject(params.slug);
    if (!s) throw notFound();
    return { subject: s };
  },
  notFoundComponent: () => (
    <AppShell title="Subject not found">
      <Link to="/growth" className="text-primary hover:underline">← Back to Growth</Link>
    </AppShell>
  ),
  errorComponent: ({ error }) => (
    <AppShell title="Something went wrong">
      <p className="text-muted-foreground">{error.message}</p>
    </AppShell>
  ),
  component: LearnPage,
});

function LearnPage() {
  const { subject } = Route.useLoaderData() as { subject: RichSubject };
  const { lang } = usePrefs();

  const labels = lang === "fr"
    ? { back: "← Retour à Croissance", topics: "Sujets", topic: "Sujet", definition: "Définition", explanation: "Explication", examples: "Exemples", min: "min", other: "Autres matières" }
    : { back: "← Back to Growth", topics: "Topics", topic: "Topic", definition: "Definition", explanation: "Explanation", examples: "Examples", min: "min", other: "Other subjects" };

  return (
    <AppShell title={pickLang(subject.title, lang)} subtitle={pickLang(subject.blurb, lang)}>
      <Link to="/growth" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {labels.back}
      </Link>

      <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
        <BookOpen className="h-3.5 w-3.5" /> {subject.topics.length} {labels.topics}
      </div>

      <section className="grid gap-5">
        {subject.topics.map((t, i) => (
          <article key={i} className="rounded-3xl border border-border/60 bg-card p-6 shadow-soft">
            <header className="flex items-start gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary-soft font-display text-base font-bold text-primary">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-lg font-bold leading-snug">{pickLang(t.title, lang)}</h3>
                <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" /> {t.minutes} {labels.min}
                </div>
              </div>
            </header>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-background p-4">
                <div className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
                  <Sparkles className="h-3.5 w-3.5" /> {labels.definition}
                </div>
                <p className="text-sm leading-relaxed text-foreground">{pickLang(t.definition, lang)}</p>
              </div>
              <div className="rounded-2xl bg-background p-4">
                <div className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
                  <Lightbulb className="h-3.5 w-3.5" /> {labels.explanation}
                </div>
                <p className="text-sm leading-relaxed text-foreground">{pickLang(t.explanation, lang)}</p>
              </div>
              <div className="rounded-2xl bg-background p-4">
                <div className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
                  <ListChecks className="h-3.5 w-3.5" /> {labels.examples}
                </div>
                <ul className="space-y-1.5 text-sm leading-relaxed text-foreground">
                  {pickList(t.examples, lang).map((ex, j) => (
                    <li key={j} className="flex gap-2"><span className="text-primary">•</span><span>{ex}</span></li>
                  ))}
                </ul>
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="mt-10">
        <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-widest text-muted-foreground">{labels.other}</h3>
        <div className="flex flex-wrap gap-2">
          {richSubjects.filter((s) => s.slug !== subject.slug).map((s) => (
            <Link key={s.slug} to="/learn/$slug" params={{ slug: s.slug }} className="rounded-full bg-muted px-4 py-2 text-xs font-semibold hover:bg-primary-soft hover:text-primary">
              {pickLang(s.title, lang)}
            </Link>
          ))}
        </div>
      </section>
    </AppShell>
  );
}

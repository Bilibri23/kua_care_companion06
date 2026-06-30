import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Pause, Volume2, Star, Search, CircleDashed, Play, Square, Trash2, Wand2, Loader2, Maximize2,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PersonalLine } from "@/lib/personalize";
import { usePrefs } from "@/lib/prefs";
import { useTTS } from "@/lib/tts";
import { aiRephrase } from "@/lib/ai-client";
import { toast } from "sonner";
import { CARDS as STATIC_CARDS, CATEGORIES, toneClass, type CommCard, type CategoryKey } from "@/lib/comm-data";
import { CardDetailDialog } from "@/components/CardDetailDialog";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/communication")({
  head: () => ({ meta: [{ title: "Communication - KUA Expression Space" }, { name: "description", content: "AAC-style cards in 9 categories with bilingual voice playback." }] }),
  component: CommPage,
});

function CommPage() {
  const { lang, isFav, toggleFav, favorites, voiceRate } = usePrefs();
  const [sentence, setSentence] = useState<CommCard[]>([]);
  const [q, setQ] = useState("");
  const [active, setActive] = useState<CategoryKey | "all">("all");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiText, setAiText] = useState<string | null>(null);
  const [openCard, setOpenCard] = useState<CommCard | null>(null);
  const [dbCards, setDbCards] = useState<CommCard[]>([]);
  const [seeded, setSeeded] = useState(false);
  const { speak, pause, resume, stop, status, supported } = useTTS(lang, voiceRate);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("expression_cards")
        .select("key,label_en,label_fr,category,tone,image_url,swatch,sort_order,published")
        .eq("published", true)
        .order("sort_order");
      if (cancelled || !data) return;
      const staticByKey = new Map(STATIC_CARDS.map((c) => [c.key, c]));
      const mapped: CommCard[] = (data as Array<{
        key: string; label_en: string; label_fr: string | null; category: string;
        tone: string; image_url: string | null; swatch: string | null;
      }>).map((r) => ({
        key: r.key,
        label: r.label_en,
        fr: r.label_fr ?? r.label_en,
        emoji: "",
        category: (r.category as CategoryKey),
        tone: (["primary", "secondary", "tertiary", "info"].includes(r.tone) ? r.tone : "primary") as CommCard["tone"],
        // Seeded built-ins carry no image_url — reuse the bundled static image by key.
        img: r.image_url ?? staticByKey.get(r.key)?.img,
        swatch: r.swatch ?? staticByKey.get(r.key)?.swatch,
      }));
      // "Seeded" = built-ins were imported into the DB → DB is authoritative
      // (so unpublishing a shipped card hides it). Otherwise merge static + DB.
      setSeeded(mapped.some((c) => staticByKey.has(c.key)));
      setDbCards(mapped);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const CARDS = useMemo(() => {
    if (seeded) return dbCards; // DB authoritative once built-ins imported
    const merged = new Map(STATIC_CARDS.map((c) => [c.key, c]));
    for (const c of dbCards) merged.set(c.key, c); // DB edits override; DB-only appended
    return [...merged.values()];
  }, [dbCards, seeded]);

  const makeSentence = async () => {
    if (!sentence.length) return;
    setAiBusy(true); setAiText(null);
    try {
      const cardWords = sentence.map((c) => (lang === "fr" ? c.fr : c.label));
      const r = await aiRephrase(cardWords, lang);
      setAiText(r.text);
      speak(r.text);
    } catch (e: any) {
      toast.error(e?.message === "credits-exhausted"
        ? (lang === "fr" ? "Crédits IA épuisés" : "AI credits exhausted")
        : (lang === "fr" ? "Échec IA" : "AI failed"));
    } finally { setAiBusy(false); }
  };

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const matches = CARDS.filter((c) => {
      const inCat = active === "all" || c.category === active;
      const inQ = !ql || c.label.toLowerCase().includes(ql) || c.fr.toLowerCase().includes(ql);
      return inCat && inQ;
    });
    return [...matches].sort((a, b) => {
      const fa = favorites.includes(a.key) ? 0 : 1;
      const fb = favorites.includes(b.key) ? 0 : 1;
      return fa - fb;
    });
  }, [q, favorites, active]);

  const sentenceText = sentence.map((c) => (lang === "fr" ? c.fr : c.label)).join(" ");

  return (
    <AppShell
      title={lang === "fr" ? "Espace d'expression KUA" : "KUA Expression Space"}
      subtitle={lang === "fr" ? "Touche pour parler. Construis des phrases." : "Tap to speak. Build sentences. No wrong answers."}
    >
      <PersonalLine pool="communication" className="mb-5" />
      {/* Quick links */}
      <div className="mb-5 flex flex-wrap gap-2">
        <Link to="/wheel" className="inline-flex items-center gap-2 rounded-full bg-gradient-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-glow">
          <CircleDashed className="h-3.5 w-3.5" />
          {lang === "fr" ? "Roue des émotions" : "Emotion wheel"}
        </Link>
        <span className="rounded-full bg-muted px-3 py-2 text-xs text-muted-foreground">
          {lang === "fr" ? `${favorites.length} favoris épinglés` : `${favorites.length} favorites pinned`}
        </span>
      </div>

      {/* Sentence builder */}
      <section className="rounded-3xl border border-border/60 bg-card p-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {lang === "fr" ? "Phrase" : "Sentence"}
          </div>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Speak controls">
            {status === "idle" && (
              <button
                onClick={() => speak(sentenceText)}
                disabled={!sentence.length || !supported}
                className="flex items-center gap-1.5 rounded-full bg-gradient-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-glow disabled:opacity-40"
              >
                <Volume2 className="h-3.5 w-3.5" /> {lang === "fr" ? "Parler" : "Speak"}
              </button>
            )}
            {status === "speaking" && (
              <button onClick={pause} className="flex items-center gap-1.5 rounded-full bg-muted px-4 py-2 text-xs font-semibold hover:bg-muted/70">
                <Pause className="h-3.5 w-3.5" /> {lang === "fr" ? "Pause" : "Pause"}
              </button>
            )}
            {status === "paused" && (
              <button onClick={resume} className="flex items-center gap-1.5 rounded-full bg-gradient-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-glow">
                <Play className="h-3.5 w-3.5" /> {lang === "fr" ? "Reprendre" : "Resume"}
              </button>
            )}
            {status !== "idle" && (
              <button onClick={stop} className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-2 text-xs font-semibold hover:bg-muted/70">
                <Square className="h-3.5 w-3.5" /> {lang === "fr" ? "Arrêter" : "Stop"}
              </button>
            )}
            <button
              onClick={makeSentence}
              disabled={!sentence.length || aiBusy}
              className="flex items-center gap-1.5 rounded-full bg-secondary/40 px-3 py-2 text-xs font-semibold text-secondary-foreground hover:bg-secondary/60 disabled:opacity-40"
              title={lang === "fr" ? "Construire une phrase complète avec l'IA" : "Build a full sentence with AI"}
            >
              {aiBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
              {lang === "fr" ? "Phrase IA" : "Make sentence"}
            </button>
            <button onClick={() => { stop(); setSentence([]); setAiText(null); }} className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-2 text-xs font-semibold hover:bg-muted/70">
              <Trash2 className="h-3.5 w-3.5" /> {lang === "fr" ? "Effacer" : "Clear"}
            </button>
          </div>
        </div>
        {aiText && (
          <div className="mt-4 rounded-2xl bg-gradient-warm p-4 text-sm font-medium leading-relaxed shadow-soft">
            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <Wand2 className="h-3 w-3" /> {lang === "fr" ? "Phrase IA" : "AI sentence"}
            </div>
            "{aiText}"
          </div>
        )}
        <div className="mt-4 flex min-h-[88px] flex-wrap gap-2 rounded-2xl bg-muted/40 p-3">
          {sentence.length === 0 ? (
            <span className="self-center px-2 text-sm text-muted-foreground">
              {lang === "fr" ? "Touche une carte ci-dessous…" : "Tap a card below to start a sentence…"}
            </span>
          ) : (
            sentence.map((c, i) => (
              <button
                key={i}
                onClick={() => setSentence((s) => s.filter((_, j) => j !== i))}
                className={`flex items-center gap-2 rounded-2xl px-3 py-1.5 text-sm font-semibold ${toneClass(c.tone)}`}
              >
                {c.img ? (
                  <img src={c.img} alt="" className="h-5 w-5 object-contain" loading="lazy" />
                ) : c.swatch ? (
                  <span className="h-4 w-4 rounded-full border border-border" style={{ backgroundColor: c.swatch }} aria-hidden />
                ) : null}
                {lang === "fr" ? c.fr : c.label}
              </button>
            ))
          )}
        </div>
      </section>

      {/* Search */}
      <div className="mt-6 flex items-center gap-3 rounded-full border border-border bg-card px-4 py-2.5 shadow-soft">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={lang === "fr" ? "Cherche un besoin ou un sentiment…" : "Search a feeling or need…"}
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      {/* Category tabs */}
      <div className="mt-5 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        <button
          onClick={() => setActive("all")}
          className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition ${
            active === "all" ? "bg-gradient-primary text-primary-foreground shadow-glow" : "bg-muted hover:bg-muted/70"
          }`}
        >
          {lang === "fr" ? "Tout" : "All"}
        </button>
        {CATEGORIES.map((cat) => {
          const on = active === cat.key;
          return (
            <button
              key={cat.key}
              onClick={() => setActive(cat.key)}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition ${
                on ? "bg-gradient-primary text-primary-foreground shadow-glow" : "bg-muted hover:bg-muted/70"
              }`}
            >
              {lang === "fr" ? cat.fr : cat.label}
            </button>
          );
        })}
      </div>

      {/* Cards grid */}
      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {filtered.map((c) => {
          const fav = isFav(c.key);
          return (
            <div key={c.key} className="relative">
              <button
                onClick={() => { setSentence((s) => [...s, c]); speak(lang === "fr" ? c.fr : c.label); }}
                className="group flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-3xl border border-border/60 bg-card p-3 shadow-soft transition hover:-translate-y-0.5 hover:shadow-card"
              >
                <span className={`grid h-24 w-24 place-items-center overflow-hidden rounded-2xl transition group-hover:scale-105 ${c.swatch ? "border border-border" : toneClass(c.tone)}`} style={c.swatch ? { backgroundColor: c.swatch } : undefined}>
                  {c.img ? (
                    <img src={c.img} alt={lang === "fr" ? c.fr : c.label} className="h-full w-full object-contain" loading="lazy" width={512} height={512} />
                  ) : c.swatch ? null : (
                    <span className="text-5xl" aria-hidden>{c.emoji}</span>
                  )}
                </span>
                <div className="text-center">
                  <div className="text-sm font-bold">{lang === "fr" ? c.fr : c.label}</div>
                  <div className="text-[11px] text-muted-foreground">{lang === "fr" ? c.label : c.fr}</div>
                </div>
              </button>
              <button
                onClick={() => setOpenCard(c)}
                aria-label="Expand card"
                className="absolute left-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-card/80 text-muted-foreground hover:bg-card hover:text-foreground"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => toggleFav(c.key)}
                aria-label={fav ? "Unpin favorite" : "Pin favorite"}
                aria-pressed={fav}
                className={`absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full transition ${
                  fav ? "bg-secondary text-secondary-foreground shadow-soft" : "bg-card/80 text-muted-foreground hover:text-secondary-foreground"
                }`}
              >
                <Star className={`h-4 w-4 ${fav ? "fill-current" : ""}`} />
              </button>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-border bg-card/60 p-6 text-center text-sm text-muted-foreground">
            {lang === "fr" ? "Aucune carte trouvée." : "No cards found."}
          </div>
        )}
      </section>

      <section className="mt-8 flex items-center gap-3 rounded-2xl border border-dashed border-border bg-card/60 p-4 text-sm text-muted-foreground">
        <Star className="h-4 w-4 text-secondary" />
        {lang === "fr"
          ? "Touche l'étoile pour épingler une carte. Touche le carré pour l'agrandir."
          : "Tap the star to pin a card. Tap the square to expand it."}
      </section>

      <CardDetailDialog
        card={openCard}
        open={!!openCard}
        onOpenChange={(v) => !v && setOpenCard(null)}
        onAddToSentence={(c) => setSentence((s) => [...s, c])}
      />
    </AppShell>
  );
}

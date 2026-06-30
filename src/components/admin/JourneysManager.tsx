import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2, Pencil, Search, X, Eye, EyeOff, ExternalLink, Download } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { journeys as staticJourneys, journeyForLang } from "@/lib/kua-content";

type DbMilestone = { title_en: string; title_fr?: string; note_en?: string; note_fr?: string };

type Row = {
  id: string;
  slug: string;
  title_en: string;
  title_fr: string | null;
  intro_en: string;
  intro_fr: string | null;
  milestones: DbMilestone[];
  published: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

const EMPTY: Omit<Row, "id" | "created_at" | "updated_at"> = {
  slug: "", title_en: "", title_fr: "", intro_en: "", intro_fr: "", milestones: [], published: true, sort_order: 0,
};

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 80);
}

export function JourneysManager({ onAudit }: { onAudit?: (action: string, detail?: Record<string, unknown>) => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Row | null>(null);
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("growth_journeys").select("*").order("sort_order");
    if (error) toast.error("Couldn't load journeys", { description: error.message });
    setRows(((data ?? []) as unknown) as Row[]);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    if (!ql) return rows;
    return rows.filter((r) => [r.title_en, r.slug].join(" ").toLowerCase().includes(ql));
  }, [rows, q]);

  async function togglePublish(r: Row) {
    const next = !r.published;
    const { error } = await supabase.from("growth_journeys").update({ published: next }).eq("id", r.id);
    if (error) return toast.error("Update failed", { description: error.message });
    onAudit?.(next ? "journey.publish" : "journey.unpublish", { id: r.id, slug: r.slug });
    void load();
  }
  async function remove(r: Row) {
    if (!confirm(`Delete "${r.title_en}"?`)) return;
    const { error } = await supabase.from("growth_journeys").delete().eq("id", r.id);
    if (error) return toast.error("Delete failed", { description: error.message });
    onAudit?.("journey.delete", { id: r.id, slug: r.slug });
    setRows((x) => x.filter((y) => y.id !== r.id));
    toast.success("Deleted.");
  }

  async function importBuiltins() {
    if (!confirm("Import the built-in growth journeys so they can be edited? Rows with the same slug are updated.")) return;
    setImporting(true);
    try {
      const payload = staticJourneys.map((j, i) => {
        const fr = journeyForLang(j, "fr");
        return {
          slug: j.slug,
          title_en: j.title,
          title_fr: fr.title,
          intro_en: j.intro,
          intro_fr: fr.intro,
          milestones: j.milestones.map((m, k) => ({
            title_en: m.title,
            title_fr: fr.milestones[k]?.title ?? m.title,
            note_en: m.note ?? "",
            note_fr: fr.milestones[k]?.note ?? m.note ?? "",
          })) as unknown as never,
          published: true,
          sort_order: i,
        };
      });
      const { error } = await supabase.from("growth_journeys").upsert(payload, { onConflict: "slug" });
      if (error) return toast.error("Import failed", { description: error.message });
      onAudit?.("journey.import", { count: payload.length, builtins: true });
      toast.success(`Imported ${payload.length} journeys. You can now edit them.`);
      void load();
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, slug…"
              className="w-full rounded-full border border-input bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20" />
          </div>
          <button onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:scale-[1.02]">
            <Plus className="h-4 w-4" /> New journey
          </button>
          <button onClick={() => void importBuiltins()} disabled={importing} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50">
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Import built-ins
          </button>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Journeys appear on <code className="rounded bg-muted px-1">/growth</code> and at <code className="rounded bg-muted px-1">/journey/&lt;slug&gt;</code>.
        </p>
      </div>

      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        {loading && rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" /> Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">No journeys yet. Use “Import built-ins” to start.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="px-5 py-3">Title</th><th className="px-5 py-3">Milestones</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Actions</th></tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-border align-top">
                  <td className="px-5 py-3"><div className="font-medium text-foreground">{r.title_en}</div><div className="text-[11px] text-muted-foreground">/journey/{r.slug}</div></td>
                  <td className="px-5 py-3 text-xs">{r.milestones?.length ?? 0}</td>
                  <td className="px-5 py-3 text-xs"><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${r.published ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}>{r.published ? "Published" : "Draft"}</span></td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex flex-wrap items-center justify-end gap-1">
                      <Link to="/journey/$slug" params={{ slug: r.slug }} className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-muted"><ExternalLink className="h-3.5 w-3.5" /></Link>
                      <button onClick={() => togglePublish(r)} className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-muted">{r.published ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</button>
                      <button onClick={() => setEditing(r)} className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-muted"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => remove(r)} className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {(editing || creating) && (
        <JourneyEditor
          initial={editing ?? EMPTY}
          isNew={creating}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={(action, detail) => { onAudit?.(action, detail); setEditing(null); setCreating(false); void load(); }}
        />
      )}
    </div>
  );
}

function JourneyEditor({ initial, isNew, onClose, onSaved }: {
  initial: Row | Omit<Row, "id" | "created_at" | "updated_at">;
  isNew: boolean;
  onClose: () => void;
  onSaved: (action: string, detail: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [slugTouched, setSlugTouched] = useState(!isNew && !!(initial as Row).slug);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  function updateMs(i: number, patch: Partial<DbMilestone>) {
    set("milestones", form.milestones.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  }
  function addMs() { set("milestones", [...form.milestones, { title_en: "", title_fr: "", note_en: "", note_fr: "" }]); }
  function removeMs(i: number) { set("milestones", form.milestones.filter((_, idx) => idx !== i)); }

  async function save() {
    const slug = (form.slug || slugify(form.title_en)).trim();
    if (!slug || !form.title_en.trim()) return toast.error("Title and slug required.");
    setSaving(true);
    const payload = {
      slug, title_en: form.title_en.trim(), title_fr: form.title_fr || null,
      intro_en: form.intro_en, intro_fr: form.intro_fr || null,
      milestones: form.milestones as unknown as never, published: form.published, sort_order: Number(form.sort_order) || 0,
    };
    if (isNew) {
      const { data, error } = await supabase.from("growth_journeys").insert(payload).select("id").single();
      setSaving(false);
      if (error) return toast.error("Create failed", { description: error.message });
      onSaved("journey.create", { id: data?.id, slug });
      toast.success("Journey created.");
    } else {
      const id = (initial as Row).id;
      const { error } = await supabase.from("growth_journeys").update(payload).eq("id", id);
      setSaving(false);
      if (error) return toast.error("Save failed", { description: error.message });
      onSaved("journey.update", { id, slug });
      toast.success("Saved.");
    }
  }

  return (
    <div className="fixed inset-0 z-[1100] grid place-items-center bg-foreground/40 p-4">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-border bg-card p-6 shadow-card">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-bold">{isNew ? "New journey" : "Edit journey"}</h3>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-muted hover:bg-muted/70"><X className="h-4 w-4" /></button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Title (EN) *" className="sm:col-span-2">
            <input value={form.title_en} onChange={(e) => { set("title_en", e.target.value); if (isNew && !slugTouched) set("slug", slugify(e.target.value)); }} className={inputCls} />
          </Field>
          <Field label="Title (FR)" className="sm:col-span-2"><input value={form.title_fr ?? ""} onChange={(e) => set("title_fr", e.target.value)} className={inputCls} /></Field>
          <Field label="Slug *"><input value={form.slug} onChange={(e) => { setSlugTouched(true); set("slug", slugify(e.target.value)); }} className={inputCls} /></Field>
          <Field label="Published">
            <select value={String(form.published)} onChange={(e) => set("published", e.target.value === "true")} className={inputCls}><option value="true">Published</option><option value="false">Draft</option></select>
          </Field>
          <Field label="Intro (EN)" className="sm:col-span-2"><textarea rows={2} value={form.intro_en} onChange={(e) => set("intro_en", e.target.value)} className={inputCls} /></Field>
          <Field label="Intro (FR)" className="sm:col-span-2"><textarea rows={2} value={form.intro_fr ?? ""} onChange={(e) => set("intro_fr", e.target.value)} className={inputCls} /></Field>
        </div>

        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-semibold">Milestones ({form.milestones.length})</h4>
            <button onClick={addMs} className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs font-medium hover:bg-muted/70"><Plus className="h-3 w-3" /> Add milestone</button>
          </div>
          <div className="space-y-2">
            {form.milestones.map((m, i) => (
              <div key={i} className="grid gap-3 rounded-2xl border border-border bg-background p-4 sm:grid-cols-2">
                <Field label={`#${i + 1} Title (EN)`}><input value={m.title_en} onChange={(e) => updateMs(i, { title_en: e.target.value })} className={inputCls} /></Field>
                <Field label="Title (FR)"><input value={m.title_fr ?? ""} onChange={(e) => updateMs(i, { title_fr: e.target.value })} className={inputCls} /></Field>
                <Field label="Note (EN)"><input value={m.note_en ?? ""} onChange={(e) => updateMs(i, { note_en: e.target.value })} className={inputCls} /></Field>
                <Field label="Note (FR)"><input value={m.note_fr ?? ""} onChange={(e) => updateMs(i, { note_fr: e.target.value })} className={inputCls} /></Field>
                <div className="sm:col-span-2 flex justify-end">
                  <button onClick={() => removeMs(i)} className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive hover:bg-destructive/20"><Trash2 className="h-3 w-3" /> Remove</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full border border-border px-4 py-2 text-sm hover:bg-muted">Cancel</button>
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground shadow-sm disabled:opacity-50">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}{isNew ? "Create" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-2xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20";

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

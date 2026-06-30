import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2, Pencil, Search, X, Eye, EyeOff, Upload, Download } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, CARDS as STATIC_CARDS } from "@/lib/comm-data";
import { ImageUpload } from "@/components/admin/ImageUpload";

type Row = {
  id: string;
  key: string;
  label_en: string;
  label_fr: string | null;
  category: string;
  tone: string;
  image_url: string | null;
  swatch: string | null;
  sort_order: number;
  published: boolean;
  created_at: string;
  updated_at: string;
};

const EMPTY: Omit<Row, "id" | "created_at" | "updated_at"> = {
  key: "",
  label_en: "",
  label_fr: "",
  category: "emotions",
  tone: "primary",
  image_url: "",
  swatch: "",
  sort_order: 0,
  published: true,
};

const TONES = ["primary", "secondary", "tertiary", "info"] as const;

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
}

function csvParse(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = (cells[i] ?? "").trim()));
    return row;
  });
}
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') inQ = false;
      else cur += ch;
    } else {
      if (ch === ",") {
        out.push(cur);
        cur = "";
      } else if (ch === '"') inQ = true;
      else cur += ch;
    }
  }
  out.push(cur);
  return out;
}

export function CardsManager({ onAudit }: { onAudit?: (action: string, detail?: Record<string, unknown>) => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [filterCat, setFilterCat] = useState<string>("all");
  const [editing, setEditing] = useState<Row | null>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("expression_cards")
      .select("*")
      .order("category")
      .order("sort_order")
      .order("label_en");
    if (error) toast.error("Couldn't load cards", { description: error.message });
    setRows((data ?? []) as Row[]);
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (filterCat !== "all" && r.category !== filterCat) return false;
      if (!ql) return true;
      return [r.key, r.label_en, r.label_fr ?? "", r.category].join(" ").toLowerCase().includes(ql);
    });
  }, [rows, q, filterCat]);

  async function togglePublish(r: Row) {
    const next = !r.published;
    const { error } = await supabase.from("expression_cards").update({ published: next }).eq("id", r.id);
    if (error) return toast.error("Update failed", { description: error.message });
    onAudit?.(next ? "card.publish" : "card.unpublish", { id: r.id, key: r.key });
    void load();
  }
  async function remove(r: Row) {
    if (!confirm(`Delete "${r.label_en}"?`)) return;
    const { error } = await supabase.from("expression_cards").delete().eq("id", r.id);
    if (error) return toast.error("Delete failed", { description: error.message });
    onAudit?.("card.delete", { id: r.id, key: r.key });
    setRows((x) => x.filter((y) => y.id !== r.id));
    toast.success("Deleted.");
  }

  async function handleImport(file: File) {
    setImporting(true);
    try {
      const text = await file.text();
      const rows = csvParse(text);
      if (rows.length === 0) {
        toast.error("CSV is empty.");
        return;
      }
      const payload = rows.map((r, i) => ({
        key: r.key || slugify(r.label_en || `card-${Date.now()}-${i}`),
        label_en: r.label_en ?? "",
        label_fr: r.label_fr || null,
        category: r.category || "emotions",
        tone: r.tone || "primary",
        image_url: r.image_url || null,
        swatch: r.swatch || null,
        sort_order: Number(r.sort_order) || i,
        published: r.published ? r.published.toLowerCase() !== "false" : true,
      }));
      const { error } = await supabase.from("expression_cards").upsert(payload, { onConflict: "key" });
      if (error) {
        toast.error("Import failed", { description: error.message });
        return;
      }
      onAudit?.("card.import", { count: payload.length });
      toast.success(`Imported ${payload.length} cards.`);
      void load();
    } finally {
      setImporting(false);
    }
  }

  async function importBuiltins() {
    if (!confirm("Import the built-in communication cards into the database so they can be edited? Existing rows with the same key are updated.")) return;
    setImporting(true);
    try {
      const payload = STATIC_CARDS.map((c, i) => ({
        key: c.key,
        label_en: c.label,
        label_fr: c.fr ?? null,
        category: c.category,
        tone: c.tone ?? "primary",
        image_url: null, // built-in image is the bundled asset; comm page falls back by key
        swatch: c.swatch ?? null,
        sort_order: i,
        published: true,
      }));
      const { error } = await supabase.from("expression_cards").upsert(payload, { onConflict: "key" });
      if (error) {
        toast.error("Import failed", { description: error.message });
        return;
      }
      onAudit?.("card.import", { count: payload.length, builtins: true });
      toast.success(`Imported ${payload.length} built-in cards. You can now edit them.`);
      void load();
    } finally {
      setImporting(false);
    }
  }

  function downloadTemplate() {
    const headers = ["key", "label_en", "label_fr", "category", "tone", "image_url", "swatch", "sort_order", "published"];
    const sample = ["sample-key", "Happy", "Heureux", "emotions", "secondary", "", "", "0", "true"];
    const text = headers.join(",") + "\n" + sample.join(",");
    const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "expression-cards-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search key, label, category…"
              className="w-full rounded-full border border-input bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <select
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value)}
            className="rounded-full border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="all">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:scale-[1.02]"
          >
            <Plus className="h-4 w-4" /> New card
          </button>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted">
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Import CSV
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleImport(f);
                e.target.value = "";
              }}
            />
          </label>
          <button
            onClick={downloadTemplate}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            <Download className="h-4 w-4" /> Template
          </button>
          <button
            onClick={() => void importBuiltins()}
            disabled={importing}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            <Download className="h-4 w-4" /> Import built-ins
          </button>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Cards appear on <code className="rounded bg-muted px-1">/communication</code> alongside the built-in set.
          CSV columns: <code className="rounded bg-muted px-1">key,label_en,label_fr,category,tone,image_url,swatch,sort_order,published</code>.
        </p>
      </div>

      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        {loading && rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">No cards yet. Use “New card” or “Import CSV”.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3">Card</th>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3">Tone</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-border align-middle">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span
                        className="grid h-10 w-10 place-items-center overflow-hidden rounded-xl border border-border bg-muted"
                        style={r.swatch ? { backgroundColor: r.swatch } : undefined}
                      >
                        {r.image_url ? (
                          <img src={r.image_url} alt="" className="h-full w-full object-cover" />
                        ) : null}
                      </span>
                      <div>
                        <div className="font-medium text-foreground">
                          {r.label_en}
                          {r.label_fr ? <span className="text-muted-foreground"> · {r.label_fr}</span> : null}
                        </div>
                        <div className="text-[11px] text-muted-foreground">{r.key}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-xs">{r.category}</td>
                  <td className="px-5 py-3 text-xs">{r.tone}</td>
                  <td className="px-5 py-3 text-xs">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        r.published ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {r.published ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex flex-wrap items-center justify-end gap-1">
                      <button
                        onClick={() => togglePublish(r)}
                        className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-muted"
                      >
                        {r.published ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        onClick={() => setEditing(r)}
                        className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-muted"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => remove(r)}
                        className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {(editing || creating) && (
        <CardEditor
          initial={editing ?? EMPTY}
          isNew={creating}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSaved={(action, detail) => {
            onAudit?.(action, detail);
            setEditing(null);
            setCreating(false);
            void load();
          }}
        />
      )}
    </div>
  );
}

function CardEditor({
  initial,
  isNew,
  onClose,
  onSaved,
}: {
  initial: Row | Omit<Row, "id" | "created_at" | "updated_at">;
  isNew: boolean;
  onClose: () => void;
  onSaved: (action: string, detail: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  // Track manual key edits so auto-fill from the label stops cleanly.
  const [keyTouched, setKeyTouched] = useState(!isNew && !!(initial as Row).key);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    const key = (form.key || slugify(form.label_en)).trim();
    if (!key || !form.label_en.trim()) return toast.error("Key and label (EN) required.");
    setSaving(true);
    const payload = {
      key,
      label_en: form.label_en.trim(),
      label_fr: form.label_fr || null,
      category: form.category || "emotions",
      tone: form.tone || "primary",
      image_url: form.image_url || null,
      swatch: form.swatch || null,
      sort_order: Number(form.sort_order) || 0,
      published: form.published,
    };
    if (isNew) {
      const { data, error } = await supabase.from("expression_cards").insert(payload).select("id").single();
      setSaving(false);
      if (error) return toast.error("Create failed", { description: error.message });
      onSaved("card.create", { id: data?.id, key });
      toast.success("Card created.");
    } else {
      const id = (initial as Row).id;
      const { error } = await supabase.from("expression_cards").update(payload).eq("id", id);
      setSaving(false);
      if (error) return toast.error("Save failed", { description: error.message });
      onSaved("card.update", { id, key });
      toast.success("Saved.");
    }
  }

  return (
    <div className="fixed inset-0 z-[1100] grid place-items-center bg-foreground/40 p-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-border bg-card p-6 shadow-card">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-bold">{isNew ? "New expression card" : "Edit expression card"}</h3>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-muted hover:bg-muted/70">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Label (EN) *">
            <input
              value={form.label_en}
              onChange={(e) => {
                set("label_en", e.target.value);
                if (isNew && !keyTouched) set("key", slugify(e.target.value));
              }}
              className={inputCls}
            />
          </Field>
          <Field label="Label (FR)">
            <input value={form.label_fr ?? ""} onChange={(e) => set("label_fr", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Key *">
            <input
              value={form.key}
              onChange={(e) => { setKeyTouched(true); set("key", slugify(e.target.value)); }}
              className={inputCls}
            />
          </Field>
          <Field label="Category">
            <select value={form.category} onChange={(e) => set("category", e.target.value)} className={inputCls}>
              {CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tone">
            <select value={form.tone} onChange={(e) => set("tone", e.target.value)} className={inputCls}>
              {TONES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Sort order">
            <input
              type="number"
              value={form.sort_order}
              onChange={(e) => set("sort_order", Number(e.target.value))}
              className={inputCls}
            />
          </Field>
          <Field label="Card image" className="sm:col-span-2">
            <div className="space-y-2">
              <ImageUpload value={form.image_url ?? ""} onChange={(url) => set("image_url", url)} />
              <input
                value={form.image_url ?? ""}
                onChange={(e) => set("image_url", e.target.value)}
                placeholder="https://… (leave blank to use swatch)"
                className={inputCls}
              />
            </div>
          </Field>
          <Field label="Swatch (hex)">
            <input
              value={form.swatch ?? ""}
              onChange={(e) => set("swatch", e.target.value)}
              placeholder="#E63946"
              className={inputCls}
            />
          </Field>
          <Field label="Published">
            <select
              value={String(form.published)}
              onChange={(e) => set("published", e.target.value === "true")}
              className={inputCls}
            >
              <option value="true">Published</option>
              <option value="false">Draft</option>
            </select>
          </Field>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full border border-border px-4 py-2 text-sm hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground shadow-sm disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isNew ? "Create" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-2xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20";

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

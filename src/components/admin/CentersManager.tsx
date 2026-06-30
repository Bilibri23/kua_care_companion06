import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2, CheckCircle2, XCircle, Pencil, Upload, Search, X, MapPin } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CENTER_CATEGORIES, CATEGORY_LABELS, type CenterCategory } from "@/features/autism-centers/types";

type Row = {
  id: string;
  name: string;
  category: CenterCategory;
  description: string | null;
  services_offered: string[];
  address: string | null;
  city: string | null;
  region: string | null;
  latitude: number;
  longitude: number;
  phone: string | null;
  email: string | null;
  website: string | null;
  opening_hours: string | null;
  verification_status: "pending" | "verified" | "rejected";
  created_at: string;
  updated_at: string;
};

const EMPTY: Omit<Row, "id" | "created_at" | "updated_at"> = {
  name: "",
  category: "ngo",
  description: "",
  services_offered: [],
  address: "",
  city: "",
  region: "",
  latitude: 3.848,
  longitude: 11.5021,
  phone: "",
  email: "",
  website: "",
  opening_hours: "",
  verification_status: "pending",
};

export function CentersManager({ onAudit }: { onAudit?: (action: string, detail?: Record<string, unknown>) => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "pending" | "verified" | "rejected">("all");
  const [editing, setEditing] = useState<Row | null>(null);
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("autism_centers")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error("Couldn't load centers", { description: error.message });
    setRows((data ?? []) as Row[]);
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "all" && r.verification_status !== status) return false;
      if (!ql) return true;
      return [r.name, r.city ?? "", r.region ?? "", r.address ?? "", r.description ?? ""].join(" ").toLowerCase().includes(ql);
    });
  }, [rows, q, status]);

  async function setVerification(row: Row, next: Row["verification_status"]) {
    const { error } = await supabase.from("autism_centers").update({ verification_status: next }).eq("id", row.id);
    if (error) return toast.error("Update failed", { description: error.message });
    onAudit?.(`center.${next}`, { id: row.id, name: row.name });
    toast.success(`Marked ${next}.`);
    void load();
  }

  async function remove(row: Row) {
    if (!confirm(`Delete "${row.name}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("autism_centers").delete().eq("id", row.id);
    if (error) return toast.error("Delete failed", { description: error.message });
    onAudit?.("center.delete", { id: row.id, name: row.name });
    toast.success("Deleted.");
    setRows((r) => r.filter((x) => x.id !== row.id));
  }

  async function importCsv(file: File) {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return toast.error("CSV looks empty.");
    const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
    const required = ["name", "category", "latitude", "longitude"];
    const missing = required.filter((c) => !headers.includes(c));
    if (missing.length) return toast.error(`Missing columns: ${missing.join(", ")}`);
    const skipped: string[] = [];
    const rowsToInsert = lines.slice(1).map((line, i) => {
      const cols = parseCsvLine(line);
      const get = (k: string) => cols[headers.indexOf(k)] ?? "";
      const services = get("services_offered").split("|").map((s) => s.trim()).filter(Boolean);
      const category = normalizeCategory(get("category"));
      if (!category) {
        skipped.push(`row ${i + 2}: unknown category "${get("category")}"`);
        return null;
      }
      return {
        name: get("name"),
        category,
        description: get("description") || null,
        services_offered: services,
        address: get("address") || null,
        city: get("city") || null,
        region: get("region") || null,
        latitude: Number(get("latitude")),
        longitude: Number(get("longitude")),
        phone: get("phone") || null,
        email: get("email") || null,
        website: get("website") || null,
        opening_hours: get("opening_hours") || null,
        verification_status: normalizeStatus(get("verification_status")),
      };
    }).filter((r): r is NonNullable<typeof r> => r !== null);

    if (rowsToInsert.length === 0) {
      return toast.error("No valid rows to import.", { description: skipped.slice(0, 4).join("; ") });
    }
    const { error, count } = await supabase.from("autism_centers").insert(rowsToInsert, { count: "exact" });
    if (error) return toast.error("Import failed", { description: error.message });
    const base = `Imported ${count ?? rowsToInsert.length} rows.`;
    if (skipped.length) toast.warning(base, { description: `Skipped ${skipped.length}: ${skipped.slice(0, 3).join("; ")}${skipped.length > 3 ? "…" : ""}` });
    else toast.success(base);
    onAudit?.("center.import", { count: rowsToInsert.length, skipped: skipped.length });
    void load();
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
              placeholder="Search name, city, region…"
              className="w-full rounded-full border border-input bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted">
            <Upload className="h-4 w-4" /> Import CSV
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importCsv(f);
                e.target.value = "";
              }}
            />
          </label>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:scale-[1.02]"
          >
            <Plus className="h-4 w-4" /> Add center
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
          {(["all", "pending", "verified", "rejected"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`rounded-full border px-3 py-1 ${status === s ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted"}`}
            >
              {s} ({s === "all" ? rows.length : rows.filter((r) => r.verification_status === s).length})
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          CSV columns: name, category, latitude, longitude (required); description, services_offered (pipe-separated), address, city, region, phone, email, website, opening_hours, verification_status (optional).
        </p>
      </div>

      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        {loading && rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" /> Loading centers…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">No centers match.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3">Location</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-border align-top">
                  <td className="px-5 py-3">
                    <div className="font-medium text-foreground">{r.name}</div>
                    <div className="text-[11px] text-muted-foreground line-clamp-1">{r.description}</div>
                  </td>
                  <td className="px-5 py-3 text-xs">{CATEGORY_LABELS[r.category]?.en ?? r.category}</td>
                  <td className="px-5 py-3 text-xs">
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-muted-foreground" /> {r.city || "—"}
                      {r.region ? `, ${r.region}` : ""}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {r.latitude.toFixed(3)}, {r.longitude.toFixed(3)}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-xs">
                    <StatusBadge status={r.verification_status} />
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex flex-wrap items-center justify-end gap-1">
                      {r.verification_status !== "verified" && (
                        <button
                          onClick={() => setVerification(r, "verified")}
                          className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-600 hover:bg-emerald-500/20"
                        >
                          <CheckCircle2 className="h-3 w-3" /> Verify
                        </button>
                      )}
                      {r.verification_status !== "rejected" && (
                        <button
                          onClick={() => setVerification(r, "rejected")}
                          className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-600 hover:bg-amber-500/20"
                        >
                          <XCircle className="h-3 w-3" /> Reject
                        </button>
                      )}
                      <button
                        onClick={() => setEditing(r)}
                        className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-muted"
                        aria-label="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => remove(r)}
                        className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Delete"
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
        <CenterEditor
          initial={editing ?? { ...EMPTY }}
          isNew={creating}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSaved={(action, data) => {
            onAudit?.(action, data);
            setEditing(null);
            setCreating(false);
            void load();
          }}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: Row["verification_status"] }) {
  const map = {
    pending: "bg-amber-500/10 text-amber-600",
    verified: "bg-emerald-500/10 text-emerald-600",
    rejected: "bg-rose-500/10 text-rose-600",
  } as const;
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${map[status]}`}>{status}</span>;
}

function CenterEditor({
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
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    if (!form.name.trim()) return toast.error("Name is required.");
    if (!Number.isFinite(form.latitude) || !Number.isFinite(form.longitude)) return toast.error("Valid coordinates required.");
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      category: form.category,
      description: form.description || null,
      services_offered: form.services_offered,
      address: form.address || null,
      city: form.city || null,
      region: form.region || null,
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
      phone: form.phone || null,
      email: form.email || null,
      website: form.website || null,
      opening_hours: form.opening_hours || null,
      verification_status: form.verification_status,
    };
    if (isNew) {
      const { data, error } = await supabase.from("autism_centers").insert(payload).select("id").single();
      setSaving(false);
      if (error) return toast.error("Create failed", { description: error.message });
      onSaved("center.create", { id: data?.id, name: payload.name });
      toast.success("Center created.");
    } else {
      const id = (initial as Row).id;
      const { error } = await supabase.from("autism_centers").update(payload).eq("id", id);
      setSaving(false);
      if (error) return toast.error("Save failed", { description: error.message });
      onSaved("center.update", { id, name: payload.name });
      toast.success("Saved.");
    }
  }

  return (
    <div className="fixed inset-0 z-[1100] grid place-items-center bg-foreground/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-border bg-card p-6 shadow-card">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-bold">{isNew ? "Add center" : "Edit center"}</h3>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-muted hover:bg-muted/70">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Name *" className="sm:col-span-2">
            <input value={form.name} onChange={(e) => set("name", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Category *">
            <select value={form.category} onChange={(e) => set("category", e.target.value as CenterCategory)} className={inputCls}>
              {CENTER_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c].en}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select
              value={form.verification_status}
              onChange={(e) => set("verification_status", e.target.value as Row["verification_status"])}
              className={inputCls}
            >
              <option value="pending">pending</option>
              <option value="verified">verified</option>
              <option value="rejected">rejected</option>
            </select>
          </Field>
          <Field label="Latitude *">
            <input
              type="number"
              step="0.0001"
              value={form.latitude}
              onChange={(e) => set("latitude", Number(e.target.value))}
              className={inputCls}
            />
          </Field>
          <Field label="Longitude *">
            <input
              type="number"
              step="0.0001"
              value={form.longitude}
              onChange={(e) => set("longitude", Number(e.target.value))}
              className={inputCls}
            />
          </Field>
          <Field label="City">
            <input value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Region">
            <input value={form.region ?? ""} onChange={(e) => set("region", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Address" className="sm:col-span-2">
            <input value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Phone">
            <input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Email">
            <input value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Website" className="sm:col-span-2">
            <input value={form.website ?? ""} onChange={(e) => set("website", e.target.value)} className={inputCls} placeholder="https://" />
          </Field>
          <Field label="Opening hours" className="sm:col-span-2">
            <input value={form.opening_hours ?? ""} onChange={(e) => set("opening_hours", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Services offered (one per line)" className="sm:col-span-2">
            <textarea
              rows={3}
              value={form.services_offered.join("\n")}
              onChange={(e) => set("services_offered", e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))}
              className={inputCls}
            />
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <textarea rows={4} value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} className={inputCls} />
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

// Map any case/spacing/hyphen variant of a category to the Postgres enum value.
function normalizeCategory(raw: string): CenterCategory | null {
  const norm = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if ((CENTER_CATEGORIES as readonly string[]).includes(norm)) return norm as CenterCategory;
  // Friendly-label fallback (e.g. "NGO", "Special Needs School").
  const aliases: Record<string, CenterCategory> = {
    ngo: "ngo",
    "non_governmental_organization": "ngo",
    special_needs_school: "special_school",
    special: "special_school",
    inclusive: "inclusive_school",
    therapy: "therapy_center",
    speech: "speech_therapist",
    occupational: "occupational_therapist",
    paediatrician: "pediatrician",
  };
  return aliases[norm] ?? null;
}

function normalizeStatus(raw: string): Row["verification_status"] {
  const v = raw.trim().toLowerCase();
  return v === "verified" || v === "rejected" ? v : "pending";
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQ = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQ = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

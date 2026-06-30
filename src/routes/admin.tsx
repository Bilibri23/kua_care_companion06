import type { LucideIcon } from "lucide-react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Shield,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Users,
  Trash2,
  RefreshCw,
  Search,
  Calendar,
  Loader2,
  Globe,
  AlertTriangle,
  WifiOff,
  Sparkles,
  Crown,
  ArrowLeft,
  Download,
  Eye,
  X,
  UserPlus,
  ScrollText,
  TrendingUp,
  Heart,
  Activity,
  ChevronRight,
  MapPin,
  BookOpen,
  Newspaper,
  LayoutGrid,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { CentersManager } from "@/components/admin/CentersManager";
import { BlogManager } from "@/components/admin/BlogManager";
import { LessonsManager } from "@/components/admin/LessonsManager";
import { CardsManager } from "@/components/admin/CardsManager";
import { SubjectsManager } from "@/components/admin/SubjectsManager";
import { JourneysManager } from "@/components/admin/JourneysManager";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin · KUA" },
      {
        name: "description",
        content: "KUA admin dashboard — help bot conversations, ratings, and user activity.",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminPage,
});

type AppRole = "admin" | "moderator" | "user";

type ChatRow = {
  id: string;
  user_id: string | null;
  prompt: string;
  response: string;
  lang: string;
  source: string;
  rating: "up" | "down" | null;
  feedback: string | null;
  created_at: string;
  rated_at: string | null;
};

type ProfileLite = {
  id: string;
  preferred_name: string | null;
  caregiver_name: string | null;
  email: string | null;
};

type RoleRow = { id: string; user_id: string; role: AppRole; created_at: string };

type AuditRow = {
  id: string;
  actor_id: string;
  action: string;
  target_chat_id: string | null;
  target_user_id: string | null;
  detail: Record<string, unknown>;
  created_at: string;
};

type MoodRow = {
  id: string;
  user_id: string;
  mood: string;
  entry_date: string;
  created_at: string;
};

type Tab =
  | "overview"
  | "conversations"
  | "centers"
  | "blog"
  | "lessons"
  | "subjects"
  | "journeys"
  | "cards"
  | "roles"
  | "audits"
  | "moods";

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
function dayKey(iso: string) {
  return iso.slice(0, 10); // YYYY-MM-DD
}
function monthKey(iso: string) {
  return iso.slice(0, 7); // YYYY-MM
}
function csvEscape(v: unknown) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
) {
  const text = [headers.join(","), ...rows.map((r) => r.map(csvEscape).join(","))].join("\n");
  const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [anyAdmin, setAnyAdmin] = useState<boolean | null>(null);

  const [chats, setChats] = useState<ChatRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [allProfiles, setAllProfiles] = useState<ProfileLite[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [audits, setAudits] = useState<AuditRow[]>([]);
  const [moods, setMoods] = useState<MoodRow[]>([]);

  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "up" | "down" | "unrated">("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | "gateway" | "offline" | "crisis">("all");
  const [detail, setDetail] = useState<ChatRow | null>(null);
  const [grantEmail, setGrantEmail] = useState("");
  const [grantRole, setGrantRole] = useState<AppRole>("moderator");

  // ---- Auth gate ----
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate({ to: "/signin", search: { redirect: "/admin" } as never });
      return;
    }
    (async () => {
      setChecking(true);
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      setIsAdmin(!!roleRow);
      const { count } = await supabase
        .from("user_roles")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin");
      setAnyAdmin((count ?? 0) > 0);
      setChecking(false);
    })();
  }, [user, authLoading, navigate]);

  async function claimAdmin() {
    if (!user) return;
    const { error } = await supabase.from("user_roles").insert({ user_id: user.id, role: "admin" });
    if (error) {
      toast.error("Couldn't claim admin", { description: error.message });
      return;
    }
    toast.success("You are now the admin.");
    setIsAdmin(true);
    setAnyAdmin(true);
  }

  async function logAudit(
    action: string,
    extra: Partial<Pick<AuditRow, "target_chat_id" | "target_user_id" | "detail">> = {},
  ) {
    if (!user) return;
    try {
      await supabase.from("prompt_audits").insert({
        actor_id: user.id,
        action,
        target_chat_id: extra.target_chat_id ?? null,
        target_user_id: extra.target_user_id ?? null,
        detail: (extra.detail ?? {}) as never,
      });
    } catch {
      /* non-blocking */
    }
  }

  async function loadData() {
    setLoading(true);
    const [chatsRes, rolesRes, auditsRes, moodsRes, profsRes] = await Promise.all([
      supabase.from("help_chats").select("*").order("created_at", { ascending: false }).limit(1000),
      supabase.from("user_roles").select("*").order("created_at", { ascending: false }),
      supabase
        .from("prompt_audits")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("mood_entries")
        .select("id,user_id,mood,entry_date,created_at")
        .order("created_at", { ascending: false })
        .limit(1000),
      supabase.from("profiles").select("id, preferred_name, caregiver_name, email"),
    ]);
    if (chatsRes.error)
      toast.error("Failed to load chats", { description: chatsRes.error.message });
    setChats((chatsRes.data ?? []) as ChatRow[]);
    setRoles((rolesRes.data ?? []) as RoleRow[]);
    setAudits((auditsRes.data ?? []) as AuditRow[]);
    setMoods((moodsRes.data ?? []) as MoodRow[]);
    const profs = (profsRes.data ?? []) as ProfileLite[];
    setAllProfiles(profs);
    const map: Record<string, ProfileLite> = {};
    profs.forEach((p) => (map[p.id] = p));
    setProfiles(map);
    setLoading(false);
  }

  useEffect(() => {
    if (isAdmin) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  async function deleteChat(id: string) {
    if (!confirm("Delete this conversation? This cannot be undone.")) return;
    const { error } = await supabase.from("help_chats").delete().eq("id", id);
    if (error) {
      toast.error("Couldn't delete", { description: error.message });
      return;
    }
    setChats((c) => c.filter((r) => r.id !== id));
    void logAudit("chat.delete", { target_chat_id: id });
    toast.success("Deleted.");
  }

  async function grantRoleToEmail() {
    const email = grantEmail.trim().toLowerCase();
    if (!email) return;
    const target = allProfiles.find((p) => (p.email ?? "").toLowerCase() === email);
    if (!target) {
      toast.error("No user found with that email.");
      return;
    }
    const { error } = await supabase
      .from("user_roles")
      .insert({ user_id: target.id, role: grantRole });
    if (error) {
      toast.error("Couldn't grant role", { description: error.message });
      return;
    }
    void logAudit("role.grant", { target_user_id: target.id, detail: { role: grantRole, email } });
    toast.success(`Granted ${grantRole} to ${email}.`);
    setGrantEmail("");
    await loadData();
  }

  async function revokeRole(row: RoleRow) {
    if (row.role === "admin" && roles.filter((r) => r.role === "admin").length <= 1) {
      toast.error("Can't revoke the last admin.");
      return;
    }
    if (!confirm(`Revoke ${row.role} from this user?`)) return;
    const { error } = await supabase.from("user_roles").delete().eq("id", row.id);
    if (error) {
      toast.error("Couldn't revoke", { description: error.message });
      return;
    }
    void logAudit("role.revoke", { target_user_id: row.user_id, detail: { role: row.role } });
    setRoles((r) => r.filter((x) => x.id !== row.id));
    toast.success("Role revoked.");
  }

  // ---- Filters & derived ----
  const filteredChats = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return chats.filter((r) => {
      if (filter === "up" && r.rating !== "up") return false;
      if (filter === "down" && r.rating !== "down") return false;
      if (filter === "unrated" && r.rating !== null) return false;
      if (sourceFilter !== "all" && r.source !== sourceFilter) return false;
      if (!ql) return true;
      const p = r.user_id ? profiles[r.user_id] : null;
      const haystack = [r.prompt, r.response, p?.preferred_name, p?.caregiver_name, p?.email]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(ql);
    });
  }, [chats, q, filter, sourceFilter, profiles]);

  const stats = useMemo(() => {
    const total = chats.length;
    const up = chats.filter((c) => c.rating === "up").length;
    const down = chats.filter((c) => c.rating === "down").length;
    const rated = up + down;
    const satisfaction = rated > 0 ? Math.round((up / rated) * 100) : null;
    const uniqueUsers = new Set(chats.map((c) => c.user_id).filter(Boolean)).size;
    const offline = chats.filter((c) => c.source === "offline").length;
    const crisis = chats.filter((c) => c.source === "crisis").length;
    return { total, up, down, satisfaction, uniqueUsers, offline, crisis };
  }, [chats]);

  // 30-day daily series
  const daily = useMemo(() => buildDailySeries(chats, 30), [chats]);
  const monthly = useMemo(() => buildMonthlySeries(chats, 12), [chats]);
  const moodMonthly = useMemo(() => buildMoodMonthlySeries(moods, 12), [moods]);

  // ---- Gating UI ----
  if (authLoading || checking) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 px-4 py-12">
        <div className="mx-auto max-w-md">
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Link>
          <div className="mt-6 rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Shield className="h-7 w-7" />
            </div>
            <h1 className="mt-4 text-xl font-semibold text-foreground">Admin access only</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {anyAdmin === false
                ? "No admin has been set up yet. You can claim the admin role for this workspace."
                : "Your account doesn't have admin permissions. Ask an existing admin to grant you access."}
            </p>
            {anyAdmin === false && (
              <button
                type="button"
                onClick={claimAdmin}
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-primary to-primary/80 px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition hover:scale-105"
              >
                <Crown className="h-4 w-4" />
                Claim admin
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Link
              to="/"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to app
            </Link>
            <div className="mt-2 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                  Admin dashboard
                </h1>
                <p className="text-sm text-muted-foreground">
                  Conversations, ratings, roles, audits & mood activity.
                </p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition hover:bg-muted disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </button>
        </header>

        {/* Tabs */}
        <nav className="flex flex-wrap gap-2">
          {(
            [
              ["overview", "Overview", TrendingUp],
              ["conversations", "Conversations", MessageSquare],
              ["centers", "Centers", MapPin],
              ["blog", "Blog posts", Newspaper],
              ["lessons", "Lesson notes", BookOpen],
              ["subjects", "Learning subjects", BookOpen],
              ["journeys", "Growth journeys", TrendingUp],
              ["cards", "Expression cards", LayoutGrid],
              ["roles", "Roles", Users],
              ["audits", "Audit log", ScrollText],
              ["moods", "Moods", Heart],
            ] as Array<[Tab, string, never]>
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition",
                tab === id
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-card text-foreground hover:bg-muted",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>

        {/* Stats */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard icon={MessageSquare} label="Conversations" value={stats.total} tone="primary" />
          <StatCard icon={Users} label="Unique users" value={stats.uniqueUsers} tone="slate" />
          <StatCard icon={ThumbsUp} label="Thumbs up" value={stats.up} tone="emerald" />
          <StatCard icon={ThumbsDown} label="Thumbs down" value={stats.down} tone="rose" />
          <StatCard
            icon={Sparkles}
            label="Satisfaction"
            value={stats.satisfaction === null ? "—" : `${stats.satisfaction}%`}
            tone="amber"
          />
          <StatCard icon={AlertTriangle} label="Crisis flags" value={stats.crisis} tone="rose" />
        </section>

        {tab === "overview" && (
          <section className="space-y-6">
            <ChartCard
              title="Daily conversations — last 30 days"
              subtitle={`${daily.total} total · peak ${daily.peak} on ${daily.peakDay ?? "—"}`}
            >
              <BarChart series={daily.points} kind="bar" />
              <Readings
                rows={[
                  ["Total chats (30d)", daily.total],
                  ["Daily average", (daily.total / 30).toFixed(1)],
                  ["Best day", daily.peakDay ?? "—"],
                  ["Quiet days", `${daily.zeroDays} / 30`],
                ]}
              />
            </ChartCard>

            <ChartCard
              title="Monthly conversations — last 12 months"
              subtitle={`${monthly.total} total · ${monthly.activeMonths} active months`}
            >
              <BarChart series={monthly.points} kind="bar" />
              <Readings
                rows={[
                  ["Total chats (12mo)", monthly.total],
                  ["Best month", monthly.peakMonth ?? "—"],
                  [
                    "Avg per active month",
                    monthly.activeMonths ? Math.round(monthly.total / monthly.activeMonths) : 0,
                  ],
                ]}
              />
            </ChartCard>

            <ChartCard
              title="Mood entries — last 12 months"
              subtitle={`${moodMonthly.total} entries logged · ${moodMonthly.activeUsers} children tracked`}
            >
              <BarChart series={moodMonthly.points} kind="bar" tone="rose" />
              <Readings
                rows={[
                  ["Total mood entries", moodMonthly.total],
                  ["Top mood", moodMonthly.topMood ?? "—"],
                  ["Children tracked", moodMonthly.activeUsers],
                ]}
              />
            </ChartCard>
          </section>
        )}

        {tab === "conversations" && (
          <ConversationsTab
            chats={chats}
            filtered={filteredChats}
            profiles={profiles}
            q={q}
            setQ={setQ}
            filter={filter}
            setFilter={setFilter}
            sourceFilter={sourceFilter}
            setSourceFilter={setSourceFilter}
            loading={loading}
            onView={(c) => {
              setDetail(c);
              void logAudit("chat.view", {
                target_chat_id: c.id,
                target_user_id: c.user_id ?? null,
              });
            }}
            onDelete={deleteChat}
            onExport={() => {
              downloadCsv(
                `kua-conversations-${new Date().toISOString().slice(0, 10)}.csv`,
                [
                  "id",
                  "created_at",
                  "user",
                  "email",
                  "lang",
                  "source",
                  "rating",
                  "prompt",
                  "response",
                ],
                filteredChats.map((c) => {
                  const p = c.user_id ? profiles[c.user_id] : null;
                  return [
                    c.id,
                    c.created_at,
                    p?.caregiver_name || p?.preferred_name || "",
                    p?.email || "",
                    c.lang,
                    c.source,
                    c.rating ?? "",
                    c.prompt,
                    c.response,
                  ];
                }),
              );
              void logAudit("chat.export", { detail: { count: filteredChats.length } });
              toast.success(`Exported ${filteredChats.length} rows.`);
            }}
          />
        )}

        {tab === "roles" && (
          <RolesTab
            roles={roles}
            profiles={profiles}
            allProfiles={allProfiles}
            grantEmail={grantEmail}
            setGrantEmail={setGrantEmail}
            grantRole={grantRole}
            setGrantRole={setGrantRole}
            onGrant={grantRoleToEmail}
            onRevoke={revokeRole}
            currentUserId={user?.id ?? ""}
          />
        )}

        {tab === "audits" && (
          <AuditsTab
            audits={audits}
            profiles={profiles}
            onExport={() => {
              downloadCsv(
                `kua-audits-${new Date().toISOString().slice(0, 10)}.csv`,
                ["id", "created_at", "actor", "action", "target_chat", "target_user", "detail"],
                audits.map((a) => [
                  a.id,
                  a.created_at,
                  profiles[a.actor_id]?.email || a.actor_id,
                  a.action,
                  a.target_chat_id ?? "",
                  a.target_user_id ?? "",
                  JSON.stringify(a.detail ?? {}),
                ]),
              );
              toast.success(`Exported ${audits.length} audit rows.`);
            }}
          />
        )}

        {tab === "centers" && (
          <CentersManager onAudit={(a, d) => void logAudit(a, { detail: d })} />
        )}
        {tab === "blog" && <BlogManager onAudit={(a, d) => void logAudit(a, { detail: d })} />}
        {tab === "lessons" && (
          <LessonsManager onAudit={(a, d) => void logAudit(a, { detail: d })} />
        )}
        {tab === "subjects" && (
          <SubjectsManager onAudit={(a, d) => void logAudit(a, { detail: d })} />
        )}
        {tab === "journeys" && (
          <JourneysManager onAudit={(a, d) => void logAudit(a, { detail: d })} />
        )}
        {tab === "cards" && <CardsManager onAudit={(a, d) => void logAudit(a, { detail: d })} />}

        {tab === "moods" && <MoodsTab moods={moods} profiles={profiles} />}
      </div>

      {detail && (
        <DetailDialog
          chat={detail}
          who={detail.user_id ? profiles[detail.user_id] : null}
          onClose={() => setDetail(null)}
          onDelete={async () => {
            await deleteChat(detail.id);
            setDetail(null);
          }}
        />
      )}
    </div>
  );
}

/* ============================== Components ============================== */

function ConversationsTab({
  chats,
  filtered,
  profiles,
  q,
  setQ,
  filter,
  setFilter,
  sourceFilter,
  setSourceFilter,
  loading,
  onView,
  onDelete,
  onExport,
}: {
  chats: ChatRow[];
  filtered: ChatRow[];
  profiles: Record<string, ProfileLite>;
  q: string;
  setQ: (v: string) => void;
  filter: "all" | "up" | "down" | "unrated";
  setFilter: (v: "all" | "up" | "down" | "unrated") => void;
  sourceFilter: "all" | "gateway" | "offline" | "crisis";
  setSourceFilter: (v: "all" | "gateway" | "offline" | "crisis") => void;
  loading: boolean;
  onView: (c: ChatRow) => void;
  onDelete: (id: string) => void;
  onExport: () => void;
}) {
  return (
    <>
      <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search prompts, responses, or users…"
              className="w-full rounded-full border border-input bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <button
            type="button"
            onClick={onExport}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:scale-[1.02]"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
            All
          </FilterChip>
          <FilterChip active={filter === "up"} onClick={() => setFilter("up")}>
            <ThumbsUp className="h-3 w-3" /> Up
          </FilterChip>
          <FilterChip active={filter === "down"} onClick={() => setFilter("down")}>
            <ThumbsDown className="h-3 w-3" /> Down
          </FilterChip>
          <FilterChip active={filter === "unrated"} onClick={() => setFilter("unrated")}>
            Unrated
          </FilterChip>
          <span className="mx-1 h-5 w-px self-center bg-border" />
          <FilterChip active={sourceFilter === "all"} onClick={() => setSourceFilter("all")}>
            All sources
          </FilterChip>
          <FilterChip
            active={sourceFilter === "gateway"}
            onClick={() => setSourceFilter("gateway")}
          >
            AI
          </FilterChip>
          <FilterChip
            active={sourceFilter === "offline"}
            onClick={() => setSourceFilter("offline")}
          >
            <WifiOff className="h-3 w-3" /> Offline
          </FilterChip>
          <FilterChip active={sourceFilter === "crisis"} onClick={() => setSourceFilter("crisis")}>
            <AlertTriangle className="h-3 w-3" /> Crisis
          </FilterChip>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Showing {filtered.length} of {chats.length} conversations.
        </p>
      </div>

      <section className="space-y-3">
        {loading && chats.length === 0 && (
          <div className="rounded-3xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin" />
            Loading conversations…
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="rounded-3xl border border-dashed border-border bg-card/50 p-10 text-center text-sm text-muted-foreground">
            No conversations match these filters yet.
          </div>
        )}
        {filtered.map((c) => {
          const p = c.user_id ? profiles[c.user_id] : null;
          const who =
            p?.caregiver_name ||
            p?.preferred_name ||
            p?.email ||
            (c.user_id ? `User ${c.user_id.slice(0, 8)}` : "Anonymous");
          return (
            <article
              key={c.id}
              onClick={() => onView(c)}
              className="group cursor-pointer rounded-3xl border border-border bg-card p-5 shadow-sm transition hover:border-primary/30 hover:shadow-md"
            >
              <header className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{who}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> {fmtDate(c.created_at)}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                      <Globe className="h-3 w-3" /> {c.lang.toUpperCase()}
                    </span>
                    <SourceBadge source={c.source} />
                    <RatingBadge rating={c.rating} />
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onView(c);
                    }}
                    className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    aria-label="View"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(c.id);
                    }}
                    className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </header>
              <p className="mt-3 line-clamp-2 text-sm text-foreground">{c.prompt}</p>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{c.response}</p>
            </article>
          );
        })}
      </section>
    </>
  );
}

function RolesTab({
  roles,
  profiles,
  allProfiles,
  grantEmail,
  setGrantEmail,
  grantRole,
  setGrantRole,
  onGrant,
  onRevoke,
  currentUserId,
}: {
  roles: RoleRow[];
  profiles: Record<string, ProfileLite>;
  allProfiles: ProfileLite[];
  grantEmail: string;
  setGrantEmail: (v: string) => void;
  grantRole: AppRole;
  setGrantRole: (v: AppRole) => void;
  onGrant: () => void;
  onRevoke: (r: RoleRow) => void;
  currentUserId: string;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground">Grant a role</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Enter the user's account email. They must have signed up at least once.{" "}
          {allProfiles.length} users in workspace.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            value={grantEmail}
            onChange={(e) => setGrantEmail(e.target.value)}
            placeholder="user@example.com"
            list="kua-emails"
            className="flex-1 rounded-full border border-input bg-background px-4 py-2 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
          />
          <datalist id="kua-emails">
            {allProfiles.map((p) => (p.email ? <option key={p.id} value={p.email} /> : null))}
          </datalist>
          <select
            value={grantRole}
            onChange={(e) => setGrantRole(e.target.value as AppRole)}
            className="rounded-full border border-input bg-background px-4 py-2 text-sm outline-none focus:border-primary/40"
          >
            <option value="admin">admin</option>
            <option value="moderator">moderator</option>
          </select>
          <button
            type="button"
            onClick={onGrant}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:scale-[1.02]"
          >
            <UserPlus className="h-4 w-4" /> Grant
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-5 py-3">User</th>
              <th className="px-5 py-3">Role</th>
              <th className="px-5 py-3">Granted</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {roles.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-sm text-muted-foreground">
                  No roles assigned yet.
                </td>
              </tr>
            )}
            {roles.map((r) => {
              const p = profiles[r.user_id];
              return (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-5 py-3">
                    <div className="font-medium text-foreground">
                      {p?.caregiver_name || p?.preferred_name || `User ${r.user_id.slice(0, 8)}`}
                    </div>
                    <div className="text-xs text-muted-foreground">{p?.email || r.user_id}</div>
                  </td>
                  <td className="px-5 py-3">
                    <RoleBadge role={r.role} />
                  </td>
                  <td className="px-5 py-3 text-xs text-muted-foreground">
                    {fmtDate(r.created_at)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {r.user_id === currentUserId && r.role === "admin" ? (
                      <span className="text-xs text-muted-foreground">You</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onRevoke(r)}
                        className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs text-foreground transition hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" /> Revoke
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AuditsTab({
  audits,
  profiles,
  onExport,
}: {
  audits: AuditRow[];
  profiles: Record<string, ProfileLite>;
  onExport: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{audits.length} audit events</p>
        <button
          type="button"
          onClick={onExport}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:scale-[1.02]"
        >
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>
      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-5 py-3">When</th>
              <th className="px-5 py-3">Actor</th>
              <th className="px-5 py-3">Action</th>
              <th className="px-5 py-3">Detail</th>
            </tr>
          </thead>
          <tbody>
            {audits.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-sm text-muted-foreground">
                  No audit events yet.
                </td>
              </tr>
            )}
            {audits.map((a) => {
              const p = profiles[a.actor_id];
              return (
                <tr key={a.id} className="border-t border-border">
                  <td className="px-5 py-3 text-xs text-muted-foreground">
                    {fmtDate(a.created_at)}
                  </td>
                  <td className="px-5 py-3">
                    <div className="font-medium text-foreground">
                      {p?.caregiver_name || p?.preferred_name || a.actor_id.slice(0, 8)}
                    </div>
                    <div className="text-xs text-muted-foreground">{p?.email || ""}</div>
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      <Activity className="h-3 w-3" />
                      {a.action}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-muted-foreground">
                    {a.target_chat_id && (
                      <span className="mr-2">chat: {a.target_chat_id.slice(0, 8)}</span>
                    )}
                    {a.target_user_id && (
                      <span className="mr-2">user: {a.target_user_id.slice(0, 8)}</span>
                    )}
                    {a.detail && Object.keys(a.detail).length > 0 && (
                      <code className="rounded bg-muted px-1.5 py-0.5 text-[11px]">
                        {JSON.stringify(a.detail)}
                      </code>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MoodsTab({
  moods,
  profiles,
}: {
  moods: MoodRow[];
  profiles: Record<string, ProfileLite>;
}) {
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    moods.forEach((m) => map.set(m.mood, (map.get(m.mood) ?? 0) + 1));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [moods]);
  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground">Mood distribution</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {counts.map(([mood, n]) => (
            <span
              key={mood}
              className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs"
            >
              <span className="font-medium capitalize text-foreground">{mood}</span>
              <span className="text-muted-foreground">{n}</span>
            </span>
          ))}
          {counts.length === 0 && (
            <p className="text-sm text-muted-foreground">No mood entries logged yet.</p>
          )}
        </div>
      </div>
      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-5 py-3">When</th>
              <th className="px-5 py-3">User</th>
              <th className="px-5 py-3">Mood</th>
            </tr>
          </thead>
          <tbody>
            {moods.slice(0, 200).map((m) => {
              const p = profiles[m.user_id];
              return (
                <tr key={m.id} className="border-t border-border">
                  <td className="px-5 py-3 text-xs text-muted-foreground">
                    {fmtDate(m.created_at)}
                  </td>
                  <td className="px-5 py-3">
                    <div className="font-medium text-foreground">
                      {p?.caregiver_name || p?.preferred_name || m.user_id.slice(0, 8)}
                    </div>
                    <div className="text-xs text-muted-foreground">{p?.email || ""}</div>
                  </td>
                  <td className="px-5 py-3 text-sm capitalize text-foreground">{m.mood}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DetailDialog({
  chat,
  who,
  onClose,
  onDelete,
}: {
  chat: ChatRow;
  who: ProfileLite | null;
  onClose: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-border bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Conversation detail</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{fmtDate(chat.created_at)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="mt-4 space-y-3">
          <div className="rounded-2xl border border-border bg-muted/40 p-3 text-sm">
            <p className="font-medium text-foreground">
              {who?.caregiver_name ||
                who?.preferred_name ||
                (chat.user_id ? `User ${chat.user_id.slice(0, 8)}` : "Anonymous")}
            </p>
            <p className="text-xs text-muted-foreground">{who?.email || chat.user_id || "—"}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
              <span className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-0.5">
                <Globe className="h-3 w-3" /> {chat.lang.toUpperCase()}
              </span>
              <SourceBadge source={chat.source} />
              <RatingBadge rating={chat.rating} />
              {chat.rated_at && (
                <span className="text-muted-foreground">rated {fmtDate(chat.rated_at)}</span>
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-primary/5 p-3 text-sm">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-primary">
              Prompt
            </span>
            <p className="whitespace-pre-wrap text-foreground">{chat.prompt}</p>
          </div>
          <div className="rounded-2xl bg-muted/40 p-3 text-sm">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Response
            </span>
            <p className="whitespace-pre-wrap text-foreground/90">{chat.response}</p>
          </div>
          {chat.feedback && (
            <div className="rounded-2xl border border-border bg-background p-3 text-sm">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                User feedback
              </span>
              <p className="whitespace-pre-wrap text-foreground/90">{chat.feedback}</p>
            </div>
          )}
        </div>

        <footer className="mt-5 flex justify-between">
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-4 py-2 text-sm text-destructive transition hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" /> Delete
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:scale-[1.02]"
          >
            Close <ChevronRight className="h-4 w-4" />
          </button>
        </footer>
      </div>
    </div>
  );
}

/* ============================== Charts ============================== */

function buildDailySeries(chats: ChatRow[], days: number) {
  const map = new Map<string, number>();
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    map.set(d.toISOString().slice(0, 10), 0);
  }
  chats.forEach((c) => {
    const k = dayKey(c.created_at);
    if (map.has(k)) map.set(k, (map.get(k) ?? 0) + 1);
  });
  const points = Array.from(map.entries()).map(([label, value]) => ({
    label: label.slice(5),
    fullLabel: label,
    value,
  }));
  const total = points.reduce((s, p) => s + p.value, 0);
  const peak = points.reduce((m, p) => Math.max(m, p.value), 0);
  const peakDay = points.find((p) => p.value === peak && peak > 0)?.fullLabel ?? null;
  const zeroDays = points.filter((p) => p.value === 0).length;
  return { points, total, peak, peakDay, zeroDays };
}

function buildMonthlySeries(chats: ChatRow[], months: number) {
  const map = new Map<string, number>();
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    map.set(k, 0);
  }
  chats.forEach((c) => {
    const k = monthKey(c.created_at);
    if (map.has(k)) map.set(k, (map.get(k) ?? 0) + 1);
  });
  const points = Array.from(map.entries()).map(([label, value]) => ({
    label: label.slice(2),
    fullLabel: label,
    value,
  }));
  const total = points.reduce((s, p) => s + p.value, 0);
  const peak = points.reduce((m, p) => Math.max(m, p.value), 0);
  const peakMonth = points.find((p) => p.value === peak && peak > 0)?.fullLabel ?? null;
  const activeMonths = points.filter((p) => p.value > 0).length;
  return { points, total, peak, peakMonth, activeMonths };
}

function buildMoodMonthlySeries(moods: MoodRow[], months: number) {
  const map = new Map<string, number>();
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    map.set(k, 0);
  }
  moods.forEach((m) => {
    const k = monthKey(m.created_at);
    if (map.has(k)) map.set(k, (map.get(k) ?? 0) + 1);
  });
  const points = Array.from(map.entries()).map(([label, value]) => ({
    label: label.slice(2),
    fullLabel: label,
    value,
  }));
  const total = points.reduce((s, p) => s + p.value, 0);
  const moodTally = new Map<string, number>();
  moods.forEach((m) => moodTally.set(m.mood, (moodTally.get(m.mood) ?? 0) + 1));
  const top = Array.from(moodTally.entries()).sort((a, b) => b[1] - a[1])[0];
  const activeUsers = new Set(moods.map((m) => m.user_id)).size;
  return { points, total, topMood: top?.[0] ?? null, activeUsers };
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
      <header className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </header>
      {children}
    </div>
  );
}

function BarChart({
  series,
  kind: _kind = "bar",
  tone = "primary",
}: {
  series: Array<{ label: string; fullLabel: string; value: number }>;
  kind?: "bar";
  tone?: "primary" | "rose";
}) {
  const max = Math.max(1, ...series.map((p) => p.value));
  const w = 720;
  const h = 160;
  const padX = 8;
  const padY = 16;
  const innerW = w - padX * 2;
  const innerH = h - padY * 2;
  const bw = innerW / series.length;
  const fill = tone === "rose" ? "hsl(var(--destructive) / 0.65)" : "hsl(var(--primary) / 0.7)";
  return (
    <div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-40 w-full overflow-visible"
        role="img"
        aria-label="bar chart"
      >
        {/* Grid lines */}
        {[0.25, 0.5, 0.75, 1].map((g) => (
          <line
            key={g}
            x1={padX}
            x2={w - padX}
            y1={padY + innerH * (1 - g)}
            y2={padY + innerH * (1 - g)}
            stroke="hsl(var(--border))"
            strokeDasharray="3 4"
            strokeWidth={1}
          />
        ))}
        {series.map((p, i) => {
          const barH = (p.value / max) * innerH;
          const x = padX + i * bw + bw * 0.15;
          const y = padY + innerH - barH;
          return (
            <g key={p.fullLabel}>
              <rect x={x} y={y} width={bw * 0.7} height={Math.max(barH, 2)} rx={3} fill={fill}>
                <title>{`${p.fullLabel}: ${p.value}`}</title>
              </rect>
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
        <span>{series[0]?.label}</span>
        <span>{series[Math.floor(series.length / 2)]?.label}</span>
        <span>{series[series.length - 1]?.label}</span>
      </div>
    </div>
  );
}

function Readings({ rows }: { rows: Array<[string, React.ReactNode]> }) {
  return (
    <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {rows.map(([k, v]) => (
        <div key={k} className="rounded-2xl bg-muted/40 p-3">
          <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {k}
          </dt>
          <dd className="mt-1 text-sm font-semibold text-foreground">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ============================== Small UI ============================== */

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: unknown;
  label: string;
  value: number | string;
  tone: "primary" | "emerald" | "rose" | "amber" | "slate";
}) {
  const tones: Record<typeof tone, string> = {
    primary: "from-primary/15 to-primary/5 text-primary",
    emerald: "from-emerald-500/15 to-emerald-500/5 text-emerald-600 dark:text-emerald-400",
    rose: "from-rose-500/15 to-rose-500/5 text-rose-600 dark:text-rose-400",
    amber: "from-amber-500/15 to-amber-500/5 text-amber-600 dark:text-amber-400",
    slate: "from-slate-500/15 to-slate-500/5 text-slate-600 dark:text-slate-400",
  };
  return (
    <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
      <div
        className={cn("grid h-9 w-9 place-items-center rounded-2xl bg-gradient-to-br", tones[tone])}
      >
        <Icon className="h-4 w-4" />
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function SourceBadge({ source }: { source: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    gateway: { label: "AI", cls: "bg-primary/10 text-primary" },
    offline: { label: "Offline", cls: "bg-muted text-muted-foreground" },
    crisis: { label: "Crisis", cls: "bg-destructive/10 text-destructive" },
  };
  const m = map[source] ?? { label: source, cls: "bg-muted text-muted-foreground" };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5", m.cls)}>
      {m.label}
    </span>
  );
}

function RatingBadge({ rating }: { rating: "up" | "down" | null }) {
  if (!rating) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
        Unrated
      </span>
    );
  }
  if (rating === "up") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-600 dark:text-emerald-400">
        <ThumbsUp className="h-3 w-3" /> Helpful
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-rose-600 dark:text-rose-400">
      <ThumbsDown className="h-3 w-3" /> Not helpful
    </span>
  );
}

function RoleBadge({ role }: { role: AppRole }) {
  const map: Record<AppRole, string> = {
    admin: "bg-primary/15 text-primary",
    moderator: "bg-slate-500/15 text-slate-600 dark:text-slate-400",
    user: "bg-muted text-muted-foreground",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        map[role],
      )}
    >
      {role === "admin" && <Crown className="h-3 w-3" />}
      {role}
    </span>
  );
}

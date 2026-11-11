"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";

// ── Types ─────────────────────────────────────────────────────────────────────

type Platform = "instagram" | "facebook" | "twitter" | "linkedin" | "tiktok";

type MarketingPost = {
  id: number;
  title: string;
  caption: string | null;
  platforms: string; // JSON
  status: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  productionId: number | null;
  production: { id: number; name: string } | null;
  imageUrl: string | null;
  link: string | null;
  tags: string | null;
  notes: string | null;
  createdByUser: { id: number; name: string; avatarUrl?: string | null } | null;
};

type Production = { id: number; name: string };

// ── Constants ────────────────────────────────────────────────────────────────

const PLATFORMS: { key: Platform; label: string; color: string; emoji: string }[] = [
  { key: "instagram", label: "Instagram", color: "#e1306c", emoji: "📸" },
  { key: "facebook",  label: "Facebook",  color: "#1877f2", emoji: "👤" },
  { key: "twitter",   label: "Twitter / X", color: "#1da1f2", emoji: "🐦" },
  { key: "linkedin",  label: "LinkedIn",  color: "#0a66c2", emoji: "💼" },
  { key: "tiktok",    label: "TikTok",    color: "#010101", emoji: "🎵" },
];

const STATUSES: { key: string; label: string; color: string }[] = [
  { key: "draft",     label: "Draft",     color: "#6b7280" },
  { key: "scheduled", label: "Scheduled", color: "#3b82f6" },
  { key: "published", label: "Published", color: "#10b981" },
  { key: "cancelled", label: "Cancelled", color: "#ef4444" },
];

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const inp = "w-full rounded px-3 py-2 text-sm text-white border focus:outline-none focus:ring-1 focus:ring-blue-500";
const inpStyle = { backgroundColor: "var(--psg-dark-bg)", borderColor: "var(--psg-card-border)" };

// ── Helpers ───────────────────────────────────────────────────────────────────

function parsePlatforms(raw: string): Platform[] {
  try { return JSON.parse(raw) as Platform[]; } catch { return []; }
}

function fmtDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function fmtDateTime(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) + " " +
    d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function statusMeta(key: string) {
  return STATUSES.find(s => s.key === key) ?? STATUSES[0];
}

// ── BLANK form ───────────────────────────────────────────────────────────────

const BLANK = {
  title: "", caption: "", platforms: [] as Platform[],
  status: "draft", scheduledAt: "", productionId: "",
  imageUrl: "", link: "", tags: "", notes: "",
};

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MarketingPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;

  const [posts, setPosts] = useState<MarketingPost[]>([]);
  const [productions, setProductions] = useState<Production[]>([]);
  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPlatform, setFilterPlatform] = useState<string>("all");

  const [showForm, setShowForm] = useState(false);
  const [editPost, setEditPost] = useState<MarketingPost | null>(null);
  const [form, setForm] = useState({ ...BLANK });
  const [selectedPost, setSelectedPost] = useState<MarketingPost | null>(null);
  const [saving, setSaving] = useState(false);

  const loadPosts = useCallback(async () => {
    const params = new URLSearchParams();
    if (view === "calendar") params.set("month", viewMonth);
    if (filterStatus !== "all") params.set("status", filterStatus);
    const res = await fetch(`/api/marketing?${params}`);
    if (res.ok) setPosts(await res.json());
  }, [view, viewMonth, filterStatus]);

  useEffect(() => { loadPosts(); }, [loadPosts]);
  useEffect(() => { fetch("/api/productions").then(r => r.json()).then(d => { if (Array.isArray(d)) setProductions(d); }); }, []);

  function openAdd(defaultDate?: string) {
    setEditPost(null);
    setForm({ ...BLANK, scheduledAt: defaultDate ? `${defaultDate}T09:00` : "" });
    setShowForm(true);
  }

  function openEdit(p: MarketingPost) {
    setEditPost(p);
    setForm({
      title: p.title,
      caption: p.caption ?? "",
      platforms: parsePlatforms(p.platforms),
      status: p.status,
      scheduledAt: p.scheduledAt ? p.scheduledAt.slice(0, 16) : "",
      productionId: p.productionId ? String(p.productionId) : "",
      imageUrl: p.imageUrl ?? "",
      link: p.link ?? "",
      tags: p.tags ?? "",
      notes: p.notes ?? "",
    });
    setSelectedPost(null);
    setShowForm(true);
  }

  async function savePost(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const body = {
      ...form,
      scheduledAt: form.scheduledAt || null,
      productionId: form.productionId || null,
      imageUrl: form.imageUrl || null,
      link: form.link || null,
      tags: form.tags || null,
      notes: form.notes || null,
    };
    const url = editPost ? `/api/marketing/${editPost.id}` : "/api/marketing";
    const method = editPost ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) {
      await loadPosts();
      setShowForm(false);
      setEditPost(null);
      setForm({ ...BLANK });
    }
    setSaving(false);
  }

  async function deletePost(id: number) {
    if (!confirm("Delete this post?")) return;
    await fetch(`/api/marketing/${id}`, { method: "DELETE" });
    await loadPosts();
    if (selectedPost?.id === id) setSelectedPost(null);
  }

  async function quickStatus(post: MarketingPost, status: string) {
    const res = await fetch(`/api/marketing/${post.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const updated = await res.json();
      setPosts(ps => ps.map(p => p.id === post.id ? updated : p));
      if (selectedPost?.id === post.id) setSelectedPost(updated);
    }
  }

  function togglePlatform(key: Platform) {
    setForm(f => ({
      ...f,
      platforms: f.platforms.includes(key)
        ? f.platforms.filter(p => p !== key)
        : [...f.platforms, key],
    }));
  }

  // ── Calendar helpers ────────────────────────────────────────────────────────

  const [year, month] = viewMonth.split("-").map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  // ISO week starts Monday; getDay() is 0=Sun
  const startOffset = (firstDay.getDay() + 6) % 7; // 0=Mon

  const calDays: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (calDays.length % 7 !== 0) calDays.push(null);

  function postsForDay(day: number) {
    return posts.filter(p => {
      const d = p.scheduledAt ? new Date(p.scheduledAt) : null;
      if (!d) return false;
      return d.getFullYear() === year && d.getMonth() + 1 === month && d.getDate() === day;
    }).filter(p => filterPlatform === "all" || parsePlatforms(p.platforms).includes(filterPlatform as Platform));
  }

  function prevMonth() {
    const d = new Date(year, month - 2, 1);
    setViewMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  function nextMonth() {
    const d = new Date(year, month, 1);
    setViewMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const monthLabel = new Date(year, month - 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const today = new Date();
  const isToday = (day: number) => day === today.getDate() && month === today.getMonth() + 1 && year === today.getFullYear();

  // ── Filtered list view ──────────────────────────────────────────────────────

  const filteredList = posts.filter(p =>
    (filterStatus === "all" || p.status === filterStatus) &&
    (filterPlatform === "all" || parsePlatforms(p.platforms).includes(filterPlatform as Platform))
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Marketing</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--psg-muted)" }}>Social media content calendar & planning</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <a
            href="https://app.socialpilot.co"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm px-3 py-2 rounded border hover:bg-white/5 transition-colors flex items-center gap-1.5"
            style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}
          >
            ↗ SocialPilot
          </a>
          <button
            onClick={() => openAdd()}
            className="text-sm px-4 py-2 rounded font-medium text-white hover:opacity-90 transition-opacity"
            style={{ backgroundColor: "var(--psg-blue)" }}
          >
            + New Post
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* View toggle */}
        <div className="flex rounded overflow-hidden border" style={{ borderColor: "var(--psg-card-border)" }}>
          {(["calendar", "list"] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className="px-3 py-1.5 text-xs capitalize transition-colors"
              style={{
                backgroundColor: view === v ? "var(--psg-blue)" : "transparent",
                color: view === v ? "white" : "var(--psg-muted)",
              }}
            >{v}</button>
          ))}
        </div>

        {/* Status filter */}
        <div className="flex rounded overflow-hidden border" style={{ borderColor: "var(--psg-card-border)" }}>
          <button onClick={() => setFilterStatus("all")}
            className="px-3 py-1.5 text-xs transition-colors"
            style={{ backgroundColor: filterStatus === "all" ? "rgba(255,255,255,0.1)" : "transparent", color: filterStatus === "all" ? "white" : "var(--psg-muted)" }}
          >All</button>
          {STATUSES.map(s => (
            <button key={s.key} onClick={() => setFilterStatus(s.key)}
              className="px-3 py-1.5 text-xs transition-colors"
              style={{ backgroundColor: filterStatus === s.key ? "rgba(255,255,255,0.1)" : "transparent", color: filterStatus === s.key ? "white" : "var(--psg-muted)" }}
            >{s.label}</button>
          ))}
        </div>

        {/* Platform filter */}
        <div className="flex gap-1">
          <button onClick={() => setFilterPlatform("all")}
            className="text-xs px-2 py-1 rounded border transition-colors"
            style={{ borderColor: "var(--psg-card-border)", backgroundColor: filterPlatform === "all" ? "rgba(255,255,255,0.1)" : "transparent", color: filterPlatform === "all" ? "white" : "var(--psg-muted)" }}
          >All</button>
          {PLATFORMS.map(p => (
            <button key={p.key} onClick={() => setFilterPlatform(filterPlatform === p.key ? "all" : p.key)}
              className="text-xs px-2 py-1 rounded border transition-colors"
              style={{
                borderColor: filterPlatform === p.key ? p.color : "var(--psg-card-border)",
                backgroundColor: filterPlatform === p.key ? `${p.color}22` : "transparent",
                color: filterPlatform === p.key ? p.color : "var(--psg-muted)",
              }}
              title={p.label}
            >{p.emoji}</button>
          ))}
        </div>
      </div>

      {/* ── CALENDAR VIEW ─────────────────────────────────────────────────── */}
      {view === "calendar" && (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--psg-card-border)", backgroundColor: "var(--psg-card-bg)" }}>
          {/* Month nav */}
          <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: "var(--psg-card-border)" }}>
            <button onClick={prevMonth} className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 transition-colors" style={{ color: "var(--psg-muted)" }}>‹</button>
            <span className="text-sm font-semibold text-white">{monthLabel}</span>
            <button onClick={nextMonth} className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 transition-colors" style={{ color: "var(--psg-muted)" }}>›</button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 border-b" style={{ borderColor: "var(--psg-card-border)" }}>
            {DAYS.map(d => (
              <div key={d} className="py-2 text-center text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--psg-muted)" }}>{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7" style={{ minHeight: 500 }}>
            {calDays.map((day, i) => {
              const dayPosts = day ? postsForDay(day) : [];
              const isWeekend = i % 7 >= 5;
              return (
                <div
                  key={i}
                  className="border-b border-r p-1.5 min-h-[90px] flex flex-col"
                  style={{
                    borderColor: "var(--psg-card-border)",
                    backgroundColor: !day ? "rgba(255,255,255,0.01)" : isWeekend ? "rgba(255,255,255,0.015)" : "transparent",
                  }}
                >
                  {day && (
                    <>
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${isToday(day) ? "text-white" : ""}`}
                          style={{ backgroundColor: isToday(day) ? "var(--psg-blue)" : "transparent", color: isToday(day) ? "white" : "var(--psg-muted)" }}
                        >{day}</span>
                        <button
                          onClick={() => openAdd(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`)}
                          className="w-5 h-5 flex items-center justify-center rounded opacity-0 hover:opacity-100 group-hover:opacity-100 transition-opacity text-xs hover:bg-white/10"
                          style={{ color: "var(--psg-muted)" }}
                          title="Add post"
                        >+</button>
                      </div>
                      <div className="space-y-0.5 flex-1 overflow-hidden">
                        {dayPosts.slice(0, 4).map(p => {
                          const plats = parsePlatforms(p.platforms);
                          const st = statusMeta(p.status);
                          return (
                            <button
                              key={p.id}
                              onClick={() => setSelectedPost(p)}
                              className="w-full text-left text-xs rounded px-1.5 py-0.5 truncate transition-colors hover:brightness-110"
                              style={{ backgroundColor: `${st.color}33`, color: st.color, border: `1px solid ${st.color}44` }}
                              title={p.title}
                            >
                              {plats.map(k => PLATFORMS.find(pl => pl.key === k)?.emoji).join("")}{" "}
                              {p.title}
                            </button>
                          );
                        })}
                        {dayPosts.length > 4 && (
                          <p className="text-xs pl-1" style={{ color: "var(--psg-muted)" }}>+{dayPosts.length - 4} more</p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── LIST VIEW ────────────────────────────────────────────────────── */}
      {view === "list" && (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--psg-card-border)", backgroundColor: "var(--psg-card-bg)" }}>
          {filteredList.length === 0 ? (
            <p className="text-center py-10 text-sm" style={{ color: "var(--psg-muted)" }}>No posts found.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b" style={{ borderColor: "var(--psg-card-border)" }}>
                  <th className="px-4 py-3 font-medium text-white">Post</th>
                  <th className="px-4 py-3 font-medium text-white">Platforms</th>
                  <th className="px-4 py-3 font-medium text-white">Scheduled</th>
                  <th className="px-4 py-3 font-medium text-white">Status</th>
                  <th className="px-4 py-3 font-medium text-white">Production</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--psg-card-border)" }}>
                {filteredList.map(p => {
                  const plats = parsePlatforms(p.platforms);
                  const st = statusMeta(p.status);
                  return (
                    <tr key={p.id} className="hover:bg-white/5 transition-colors cursor-pointer group" onClick={() => setSelectedPost(p)}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-white">{p.title}</p>
                        {p.caption && <p className="text-xs mt-0.5 truncate max-w-xs" style={{ color: "var(--psg-muted)" }}>{p.caption}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {plats.map(k => {
                            const pl = PLATFORMS.find(x => x.key === k);
                            return pl ? <span key={k} title={pl.label} className="text-sm">{pl.emoji}</span> : null;
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--psg-muted)" }}>{fmtDateTime(p.scheduledAt)}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${st.color}33`, color: st.color }}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--psg-muted)" }}>{p.production?.name ?? "—"}</td>
                      <td className="px-4 py-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={e => { e.stopPropagation(); openEdit(p); }} className="text-xs mr-2" style={{ color: "var(--psg-muted)" }}>Edit</button>
                        {role === "admin" && <button onClick={e => { e.stopPropagation(); deletePost(p.id); }} className="text-xs text-red-400">Delete</button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── POST DETAIL PANEL ────────────────────────────────────────────── */}
      {selectedPost && (
        <div className="fixed inset-y-0 right-0 w-96 max-w-full z-40 flex flex-col border-l shadow-2xl"
          style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--psg-card-border)" }}>
            <h2 className="text-sm font-semibold text-white truncate pr-4">{selectedPost.title}</h2>
            <button onClick={() => setSelectedPost(null)} className="shrink-0 text-lg hover:text-white transition-colors" style={{ color: "var(--psg-muted)" }}>✕</button>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Status + quick change */}
            <div>
              <p className="text-xs mb-1.5 font-medium" style={{ color: "var(--psg-muted)" }}>Status</p>
              <div className="flex flex-wrap gap-1.5">
                {STATUSES.map(s => (
                  <button key={s.key}
                    onClick={() => quickStatus(selectedPost, s.key)}
                    className="text-xs px-2.5 py-1 rounded-full font-medium transition-colors"
                    style={{
                      backgroundColor: selectedPost.status === s.key ? `${s.color}44` : "rgba(255,255,255,0.05)",
                      color: selectedPost.status === s.key ? s.color : "var(--psg-muted)",
                      border: `1px solid ${selectedPost.status === s.key ? s.color : "var(--psg-card-border)"}`,
                    }}
                  >{s.label}</button>
                ))}
              </div>
            </div>

            {/* Platforms */}
            <div>
              <p className="text-xs mb-1.5 font-medium" style={{ color: "var(--psg-muted)" }}>Platforms</p>
              <div className="flex flex-wrap gap-1.5">
                {parsePlatforms(selectedPost.platforms).map(k => {
                  const pl = PLATFORMS.find(x => x.key === k);
                  return pl ? (
                    <span key={k} className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: `${pl.color}22`, color: pl.color, border: `1px solid ${pl.color}44` }}>
                      {pl.emoji} {pl.label}
                    </span>
                  ) : null;
                })}
                {parsePlatforms(selectedPost.platforms).length === 0 && <span style={{ color: "var(--psg-muted)" }} className="text-xs">None selected</span>}
              </div>
            </div>

            {selectedPost.scheduledAt && (
              <div>
                <p className="text-xs mb-0.5 font-medium" style={{ color: "var(--psg-muted)" }}>Scheduled</p>
                <p className="text-sm text-white">{fmtDateTime(selectedPost.scheduledAt)}</p>
              </div>
            )}

            {selectedPost.production && (
              <div>
                <p className="text-xs mb-0.5 font-medium" style={{ color: "var(--psg-muted)" }}>Production</p>
                <p className="text-sm text-white">{selectedPost.production.name}</p>
              </div>
            )}

            {selectedPost.caption && (
              <div>
                <p className="text-xs mb-0.5 font-medium" style={{ color: "var(--psg-muted)" }}>Caption</p>
                <p className="text-sm text-white whitespace-pre-wrap">{selectedPost.caption}</p>
              </div>
            )}

            {selectedPost.link && (
              <div>
                <p className="text-xs mb-0.5 font-medium" style={{ color: "var(--psg-muted)" }}>Link</p>
                <a href={selectedPost.link} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-400 hover:underline break-all">{selectedPost.link}</a>
              </div>
            )}

            {selectedPost.tags && (
              <div>
                <p className="text-xs mb-1 font-medium" style={{ color: "var(--psg-muted)" }}>Tags</p>
                <div className="flex flex-wrap gap-1">
                  {selectedPost.tags.split(",").map(t => t.trim()).filter(Boolean).map(t => (
                    <span key={t} className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.08)", color: "var(--psg-muted)" }}>{t}</span>
                  ))}
                </div>
              </div>
            )}

            {selectedPost.notes && (
              <div>
                <p className="text-xs mb-0.5 font-medium" style={{ color: "var(--psg-muted)" }}>Notes</p>
                <p className="text-sm" style={{ color: "var(--psg-muted)" }}>{selectedPost.notes}</p>
              </div>
            )}

            {selectedPost.createdByUser && (
              <div>
                <p className="text-xs mb-0.5 font-medium" style={{ color: "var(--psg-muted)" }}>Created by</p>
                <p className="text-sm text-white">{selectedPost.createdByUser.name}</p>
              </div>
            )}
          </div>
          <div className="px-5 py-4 border-t flex gap-2" style={{ borderColor: "var(--psg-card-border)" }}>
            <button onClick={() => openEdit(selectedPost)}
              className="flex-1 py-2 rounded text-sm font-medium text-white hover:opacity-90 transition-opacity"
              style={{ backgroundColor: "var(--psg-blue)" }}>Edit</button>
            {role === "admin" && (
              <button onClick={() => deletePost(selectedPost.id)}
                className="px-4 py-2 rounded text-sm border hover:bg-red-900/20 text-red-400 transition-colors"
                style={{ borderColor: "rgba(248,113,113,0.3)" }}>Delete</button>
            )}
          </div>
        </div>
      )}

      {/* ── ADD / EDIT FORM ───────────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.6)" }}>
          <form onSubmit={savePost}
            className="w-full max-w-lg rounded-xl border p-6 space-y-4 max-h-[90vh] overflow-y-auto"
            style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-semibold text-white">{editPost ? "Edit Post" : "New Post"}</h2>
              <button type="button" onClick={() => { setShowForm(false); setEditPost(null); }} className="text-lg hover:text-white" style={{ color: "var(--psg-muted)" }}>✕</button>
            </div>

            <div>
              <label className="block text-xs mb-1 font-medium" style={{ color: "var(--psg-muted)" }}>Title *</label>
              <input required className={inp} style={inpStyle} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Opening night announcement" />
            </div>

            <div>
              <label className="block text-xs mb-1 font-medium" style={{ color: "var(--psg-muted)" }}>Caption / Copy</label>
              <textarea rows={4} className={inp} style={inpStyle} value={form.caption} onChange={e => setForm(f => ({ ...f, caption: e.target.value }))} placeholder="Post text…" />
            </div>

            <div>
              <label className="block text-xs mb-2 font-medium" style={{ color: "var(--psg-muted)" }}>Platforms</label>
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map(p => {
                  const on = form.platforms.includes(p.key);
                  return (
                    <button key={p.key} type="button" onClick={() => togglePlatform(p.key)}
                      className="text-xs px-3 py-1.5 rounded-full font-medium transition-colors"
                      style={{
                        backgroundColor: on ? `${p.color}33` : "rgba(255,255,255,0.05)",
                        color: on ? p.color : "var(--psg-muted)",
                        border: `1px solid ${on ? p.color : "var(--psg-card-border)"}`,
                      }}
                    >{p.emoji} {p.label}</button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs mb-1 font-medium" style={{ color: "var(--psg-muted)" }}>Status</label>
                <select className={inp} style={inpStyle} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1 font-medium" style={{ color: "var(--psg-muted)" }}>Scheduled date/time</label>
                <input type="datetime-local" className={inp} style={inpStyle} value={form.scheduledAt} onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))} />
              </div>
            </div>

            <div>
              <label className="block text-xs mb-1 font-medium" style={{ color: "var(--psg-muted)" }}>Production</label>
              <select className={inp} style={inpStyle} value={form.productionId} onChange={e => setForm(f => ({ ...f, productionId: e.target.value }))}>
                <option value="">None</option>
                {productions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs mb-1 font-medium" style={{ color: "var(--psg-muted)" }}>Link URL</label>
              <input type="url" className={inp} style={inpStyle} value={form.link} onChange={e => setForm(f => ({ ...f, link: e.target.value }))} placeholder="https://…" />
            </div>

            <div>
              <label className="block text-xs mb-1 font-medium" style={{ color: "var(--psg-muted)" }}>Tags (comma-separated)</label>
              <input className={inp} style={inpStyle} value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="opening-night, announcement, cast" />
            </div>

            <div>
              <label className="block text-xs mb-1 font-medium" style={{ color: "var(--psg-muted)" }}>Notes</label>
              <textarea rows={2} className={inp} style={inpStyle} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>

            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={saving}
                className="flex-1 py-2 rounded text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                style={{ backgroundColor: "var(--psg-blue)" }}>
                {saving ? "Saving…" : editPost ? "Save Changes" : "Add Post"}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditPost(null); }}
                className="px-4 py-2 rounded text-sm border hover:bg-white/5"
                style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

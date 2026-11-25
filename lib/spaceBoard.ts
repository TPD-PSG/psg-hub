// Company space noticeboard, build photos and build of the month (TWS part 5, 25 Nov 2026).
//   - anyone who can open the space (its team and PSG staff) can post, add photos and vote
//   - authors (and admins) delete their own posts and photos; PSG staff pin posts
//   - build of the month: this month's nominees are the space's builds with a photo taken this
//     month; one vote each per month, changeable until the month ends; last month's top build wins
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { spaceBySlug, canSeeSpace, type SpaceTheme } from "@/lib/spaces";
import { saveFile } from "@/lib/storage";

export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const PHOTO_MAX = 10 * 1024 * 1024;

export type SpaceMember = { userId: number; role: string; staff: boolean; space: SpaceTheme };

export async function spaceMember(slug: string): Promise<SpaceMember | { error: NextResponse }> {
  const session = await auth();
  const u = session?.user as { id?: string; role?: string } | undefined;
  if (!u?.id) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const space = await spaceBySlug(slug);
  if (!space) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  const role = u.role ?? "member";
  if (!(await canSeeSpace({ id: Number(u.id), role }, space.id))) return { error: NextResponse.json({ error: "This space isn't yours" }, { status: 403 }) };
  return { userId: Number(u.id), role, staff: role === "admin" || role === "member", space };
}

/** Same check, starting from an entity id (photos and posts). */
export async function memberOfEntity(entityId: number): Promise<SpaceMember | { error: NextResponse }> {
  const e = await prisma.entity.findUnique({ where: { id: entityId }, select: { slug: true } });
  if (!e?.slug) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  return spaceMember(e.slug);
}

/** "2026-11" in UK time */
export function monthKey(d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", { year: "numeric", month: "2-digit", timeZone: "Europe/London" }).formatToParts(d);
  return `${parts.find(p => p.type === "year")!.value}-${parts.find(p => p.type === "month")!.value}`;
}
export const prevMonth = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
};
/** First moment of a month key, UTC (close enough for "photos this month"). */
export const monthStart = (key: string) => new Date(`${key}-01T00:00:00Z`);
export const monthLabel = (key: string) => monthStart(key).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

/** Check and store uploaded photos; returns the rows to create. */
export async function storePhotos(files: File[], entityId: number, uploadedById: number, extra: { jobId?: number | null; postId?: number | null; caption?: string | null }) {
  const rows = [];
  for (const f of files) {
    if (!PHOTO_TYPES.includes(f.type)) throw new Error("Photos must be JPEG, PNG or WebP");
    if (f.size > PHOTO_MAX) throw new Error("Each photo must be under 10 MB");
  }
  for (const f of files) {
    const stored = await saveFile("space-photos", f.name || "photo.jpg", await f.arrayBuffer(), f.type);
    rows.push({ entityId, uploadedById, mime: f.type, fileKey: stored.key, data: stored.base64, jobId: extra.jobId ?? null, postId: extra.postId ?? null, caption: extra.caption ?? null });
  }
  return rows;
}

export const photoUrl = (id: number) => `/api/space-photos/${id}`;
const PHOTO_SELECT = { id: true, caption: true, jobId: true, createdAt: true, uploadedById: true, uploadedBy: { select: { name: true } } } as const;
export const withUrl = <T extends { id: number }>(p: T) => ({ ...p, url: photoUrl(p.id) });

/** Build of the month for a space: this month's nominees with votes, my vote, last month's winner. */
export async function buildOfMonth(entityId: number, userId: number) {
  const month = monthKey(), last = prevMonth(month);
  const [photosThisMonth, votes, lastVotes] = await Promise.all([
    prisma.spacePhoto.findMany({ where: { entityId, jobId: { not: null }, createdAt: { gte: monthStart(month) } }, select: { ...PHOTO_SELECT, job: { select: { id: true, title: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.buildVote.findMany({ where: { entityId, monthYear: month }, select: { jobId: true, userId: true } }),
    prisma.buildVote.groupBy({ by: ["jobId"], where: { entityId, monthYear: last }, _count: { jobId: true }, orderBy: { _count: { jobId: "desc" } }, take: 1 }),
  ]);
  const nominees = new Map<number, { job: { id: number; title: string }; photo: ReturnType<typeof withUrl<(typeof photosThisMonth)[number]>>; votes: number }>();
  for (const p of photosThisMonth) if (p.job && !nominees.has(p.job.id)) nominees.set(p.job.id, { job: p.job, photo: withUrl(p), votes: 0 });
  for (const v of votes) { const n = nominees.get(v.jobId); if (n) n.votes++; }
  let winner = null;
  if (lastVotes[0]) {
    const job = await prisma.job.findUnique({ where: { id: lastVotes[0].jobId }, select: { id: true, title: true, photos: { select: PHOTO_SELECT, orderBy: { createdAt: "desc" }, take: 1 } } });
    if (job) winner = { month: last, monthLabel: monthLabel(last), job: { id: job.id, title: job.title }, votes: lastVotes[0]._count.jobId, photo: job.photos[0] ? withUrl(job.photos[0]) : null };
  }
  return {
    month, monthLabel: monthLabel(month),
    nominees: [...nominees.values()].sort((a, b) => b.votes - a.votes || a.job.title.localeCompare(b.job.title)),
    myVote: votes.find(v => v.userId === userId)?.jobId ?? null,
    voters: votes.length, winner,
  };
}

export const POST_INCLUDE = {
  author: { select: { id: true, name: true } },
  job: { select: { id: true, title: true } },
  photos: { select: PHOTO_SELECT, orderBy: { id: "asc" as const } },
};

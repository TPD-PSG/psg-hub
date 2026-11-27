// A company's space (e.g. The Workshop Stoke): loaded on the server like the rest of the Hub.
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { serverApi } from "@/lib/serverApi";
import SpaceHome, { type SpaceData } from "./SpaceHome";
import type { BoardData } from "./noticeboard/Noticeboard";
import { staffPageOrMyWork } from "@/lib/spaceStaffPage";

export default async function SpacePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{2,30}$/.test(slug)) notFound();
  await staffPageOrMyWork(slug); // freelancers work from My work
  const [data, session, board] = await Promise.all([serverApi<SpaceData & { error?: string }>(`/api/spaces/${slug}`), auth(), serverApi<BoardData>(`/api/spaces/${slug}/noticeboard`)]);
  if (!data || !("space" in data)) notFound();
  const firstName = (session?.user?.name ?? "").trim().split(/\s+/)[0] || "team";
  return <SpaceHome data={data} firstName={firstName} board={board && "posts" in board ? board : null} />;
}

// Fun Corner inside a company space: the group's shared stories in the space's own look, with
// its build of the month on top. Stories posted here carry the company's badge everywhere.
import { notFound } from "next/navigation";
import { serverApi } from "@/lib/serverApi";
import type { Submission, Roundup } from "@/app/fun/FunView";
import type { BoardData } from "../noticeboard/Noticeboard";
import SpaceFun from "./SpaceFun";

export default async function SpaceFunPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{2,30}$/.test(slug)) notFound();
  const [board, fun] = await Promise.all([
    serverApi<BoardData>(`/api/spaces/${slug}/noticeboard`),
    serverApi<{ pending?: Submission[]; roundups?: Roundup[] }>("/api/fun/submissions"),
  ]);
  if (!board || !("space" in board)) notFound();
  return <SpaceFun board={board} fun={fun && Array.isArray(fun.roundups) ? { pending: fun.pending ?? [], roundups: fun.roundups } : null} />;
}

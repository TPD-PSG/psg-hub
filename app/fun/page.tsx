// Server side of the Fun Corner: submissions and roundups arrive with the page, plus each
// company space's build of the month.
import { serverApi } from "@/lib/serverApi";
import FunView, { type Submission, type Roundup } from "./FunView";
import FunBuildOfMonth, { type SpaceBotm } from "@/components/FunBuildOfMonth";

export default async function FunPage() {
  const [data, spaces] = await Promise.all([
    serverApi<{ pending?: Submission[]; roundups?: Roundup[] }>("/api/fun/submissions"),
    serverApi<SpaceBotm[]>("/api/spaces"),
  ]);
  return (
    <>
      {Array.isArray(spaces) && <FunBuildOfMonth spaces={spaces} />}
      <FunView initial={data ? { pending: data.pending ?? [], roundups: data.roundups ?? [] } : null} />
    </>
  );
}

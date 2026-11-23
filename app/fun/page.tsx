// Server side of the Fun Corner: submissions and roundups arrive with the page.
import { serverApi } from "@/lib/serverApi";
import FunView, { type Submission, type Roundup } from "./FunView";

export default async function FunPage() {
  const data = await serverApi<{ pending?: Submission[]; roundups?: Roundup[] }>("/api/fun/submissions");
  return <FunView initial={data ? { pending: data.pending ?? [], roundups: data.roundups ?? [] } : null} />;
}

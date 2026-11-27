// Freelancer logins (27 Nov 2026): inside a company space, freelancers work from "My work" (their
// own parts). The build-wide pages (home, board, jobs, planner, quotes, storage…) are for staff:
// anyone else opening one is sent to My work.
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export const isStaffRole = (role: string | undefined) => role === "admin" || role === "member";

export async function staffPageOrMyWork(slug: string) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (session?.user && !isStaffRole(role) && /^[a-z0-9-]{2,30}$/.test(slug)) redirect(`/spaces/${slug}/my-work`);
}

// A client's builds and the drawings waiting for their sign-off
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { serverApi } from "@/lib/serverApi";
import MyBuilds, { type MyBuildsData } from "./MyBuilds";

export const metadata = { title: "My builds · PSG Hub" };

export default async function MyBuildsPage() {
  const session = await auth();
  if (!session) redirect("/login?callbackUrl=/my-builds");
  const data = await serverApi<Partial<MyBuildsData> & { error?: string }>("/api/my-builds");
  if (!data?.builds || !data.me) {
    return (
      <div className="max-w-xl rounded-xl border p-6" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
        <h1 className="text-xl font-bold text-white mb-2">My builds</h1>
        <p className="text-sm" style={{ color: "var(--psg-muted)" }}>Your builds couldn&apos;t be shown. This page is for client logins: if that&apos;s you, ask PSG to link your login to your company.</p>
      </div>
    );
  }
  return <MyBuilds initial={{ me: data.me, builds: data.builds }} />;
}

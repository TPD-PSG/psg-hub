// A client's builds and the drawings waiting for their sign-off, in the builder's brand
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { serverApi } from "@/lib/serverApi";
import { spaceTokens } from "@/lib/spaceTheme";
import ClientShell from "./ClientShell";
import MyBuilds, { type MyBuildsData } from "./MyBuilds";
import { prisma } from "@/lib/prisma";

export default async function MyBuildsPage() {
  const session = await auth();
  if (!session) redirect("/login?callbackUrl=/my-builds");
  const data = await serverApi<Partial<MyBuildsData> & { error?: string }>("/api/my-builds");
  const brand = data?.brand ?? null;
  // Hires (PSG Rentals & Crew) sit alongside builds once there's a rentals space
  const rentals = await prisma.entity.count({ where: { spaceKind: "rentals", hasSpace: true, archived: false } });
  return (
    <div style={{ ...spaceTokens(brand?.color ?? null), fontFamily: "var(--tws-font), system-ui, sans-serif" } as React.CSSProperties}>
      <ClientShell brand={brand} company={data?.me?.company ?? null} nav={rentals ? [{ href: "/my-builds", label: "Builds", on: true }, { href: "/my-hires", label: "Hires" }] : undefined}>
        {data?.builds && data.me ? <MyBuilds initial={{ me: data.me, builds: data.builds, brand }} /> : (
          <div className="px-4 sm:px-10 py-10">
            <div className="max-w-xl p-6" style={{ background: "var(--tws-card)", border: "1px solid var(--tws-line)" }}>
              <h1 style={{ margin: "0 0 8px", fontSize: 24, fontWeight: 800 }}>Your builds</h1>
              <p className="text-sm" style={{ color: "var(--tws-muted)" }}>Your builds couldn&apos;t be shown. This page is for client logins: if that&apos;s you, ask PSG to link your login to your company.</p>
            </div>
          </div>
        )}
      </ClientShell>
    </div>
  );
}

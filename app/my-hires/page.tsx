// A client's hires from PSG Rentals & Crew: quotes, confirmed and past hires, the rate card and
// asking for a quote. In the rentals company's look.
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { serverApi } from "@/lib/serverApi";
import { spaceTokens } from "@/lib/spaceTheme";
import ClientShell from "../my-builds/ClientShell";
import MyHires, { type MyHiresData } from "./MyHires";

export const metadata = { title: "Your hires · PSG" };

export default async function MyHiresPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const session = await auth();
  if (!session) redirect("/login?callbackUrl=/my-hires");
  const data = await serverApi<Partial<MyHiresData> & { error?: string }>("/api/my-hires");
  const brand = data?.brand ?? null;
  const tab = (await searchParams).tab === "rates" ? "rates" : (await searchParams).tab === "request" ? "request" : "hires";
  return (
    <div style={{ ...spaceTokens(brand?.color ?? null), fontFamily: "var(--tws-font), system-ui, sans-serif" } as React.CSSProperties}>
      <ClientShell brand={brand} company={data?.me?.company ?? null} home="/my-hires" nav={[{ href: "/my-builds", label: "Builds" }, { href: "/my-hires", label: "Hires", on: true }]}>
        {data?.hires && data.me ? <MyHires initial={data as MyHiresData} tab={tab} /> : (
          <div className="px-4 sm:px-10 py-10"><div className="max-w-xl p-6" style={{ background: "var(--tws-card)", border: "1px solid var(--tws-line)" }}>
            <h1 style={{ margin: "0 0 8px", fontSize: 24, fontWeight: 800 }}>Your hires</h1>
            <p className="text-sm" style={{ color: "var(--tws-muted)" }}>Your hires couldn&apos;t be shown. This page is for client logins: if that&apos;s you, ask PSG to link your login to your company.</p>
          </div></div>
        )}
      </ClientShell>
    </div>
  );
}

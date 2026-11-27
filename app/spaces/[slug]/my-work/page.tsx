// My work (freelancer logins, 27 Nov 2026): the signed-in person's build parts in this space
import { notFound } from "next/navigation";
import { serverApi } from "@/lib/serverApi";
import MyWork, { type MyWorkPageData } from "./MyWork";

export default async function MyWorkPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{2,30}$/.test(slug)) notFound();
  const data = await serverApi<MyWorkPageData & { error?: string }>(`/api/spaces/${slug}/my-work`);
  if (!data || !("space" in data)) notFound();
  return <MyWork initial={data} />;
}

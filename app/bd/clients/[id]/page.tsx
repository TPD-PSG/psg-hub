// Server side of a client's page: everything about the client arrives with the page.
import { notFound } from "next/navigation";
import { serverApi } from "@/lib/serverApi";
import ClientView, { type ClientDetail } from "./ClientView";
import type { UserOption } from "../../BDView";

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const [client, users] = await Promise.all([serverApi<ClientDetail>(`/api/clients/${id}`), serverApi<UserOption[]>("/api/users")]);
  if (!client || !("id" in client)) notFound();
  return <ClientView initial={client} users={Array.isArray(users) ? users : []} />;
}

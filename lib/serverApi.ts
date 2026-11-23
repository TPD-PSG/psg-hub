// For server components: call this app's own API as the signed-in user (their cookies), so a page
// can arrive with its data while going through exactly the same access checks as the browser would.
import { headers } from "next/headers";

export async function serverApi<T>(path: string): Promise<T | null> {
  const cookie = (await headers()).get("cookie") ?? "";
  // Talk to this server directly rather than out through the public domain
  const base = `http://127.0.0.1:${process.env.PORT || 3000}`;
  try {
    const res = await fetch(base + path, { headers: { cookie }, cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null; // the page falls back to loading it in the browser
  }
}

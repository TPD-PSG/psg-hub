// New look components (build brief stage 2): every shared component on one page, in the new
// look's tokens, whether or not the viewer has the switch on. Admins only.
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { nlFontVars } from "@/lib/nlFonts";
import Gallery from "./Gallery";

export const metadata = { title: "New look components · PSG Hub" };

export default async function NewLookComponentsPage() {
  const session = await auth();
  if ((session?.user as { role?: string } | undefined)?.role !== "admin") redirect("/");
  return (
    <div className={`nl-scope ${nlFontVars}`} style={{ background: "var(--nl-bg)", minHeight: "100vh" }}>
      <Gallery />
    </div>
  );
}

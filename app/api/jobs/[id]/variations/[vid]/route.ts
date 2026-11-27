// One variation. PATCH action: edit (drafts only: title, notes, VAT, lines) · send (to the client)
// · withdraw (back to draft) · record (admins: the client's decision given by email or phone).
// DELETE: drafts and declined ones (whoever made it, or an admin).
import { NextResponse } from "next/server";
import { blanked } from "@/lib/required";
import { prisma } from "@/lib/prisma";
import { parseLines } from "@/lib/quotes";
import { notify } from "@/lib/clientPortal";
import { variationStaff, variationsFor, decideVariation, variationPdfData } from "@/lib/variations";

type P = { params: Promise<{ id: string; vid: string }> };

async function load(p: P) {
  const { id, vid } = await p.params;
  const a = await variationStaff(id);
  if ("error" in a) return a;
  const v = await prisma.jobVariation.findFirst({ where: { id: parseInt(vid) || 0, jobId: a.id }, include: { lines: true, job: { select: { title: true, clientId: true } } } });
  if (!v) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  return { ...a, variation: v };
}

// The variation as PDF data (prices only)
export async function GET(_req: Request, p: P) {
  const r = await load(p);
  if ("error" in r) return r.error;
  return NextResponse.json(await variationPdfData(r.variation.id));
}

export async function PATCH(req: Request, p: P) {
  const r = await load(p);
  if ("error" in r) return r.error;
  const v = r.variation;
  const body = await req.json().catch(() => ({}));
  const blank = blanked(body, { title: "The title can't be blank" });
  if (blank) return blank;
  const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });
  switch (body.action) {
    case "edit": {
      if (v.status !== "draft") return bad("Only a draft can be changed. Withdraw it first.");
      const data: Record<string, unknown> = {};
      if (typeof body.title === "string") { if (!body.title.trim()) return bad("Say what the variation is"); data.title = body.title.trim().slice(0, 200); }
      if ("notes" in body) data.notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim().slice(0, 4000) : null;
      if ("vatRate" in body) { const n = Number(body.vatRate); if (!Number.isFinite(n) || n < 0 || n > 100) return bad("VAT must be 0 to 100"); data.vatRate = n; }
      if (Array.isArray(body.lines)) {
        const parsed = parseLines(body.lines.filter((l: { description?: string }) => l?.description?.trim()));
        if ("error" in parsed) return bad(parsed.error);
        data.lines = { deleteMany: {}, create: parsed.lines.map((l, i) => ({ ...l, sortOrder: i })) };
      }
      await prisma.jobVariation.update({ where: { id: v.id }, data });
      break;
    }
    case "send": {
      if (v.status !== "draft") return bad("It has already been sent");
      if (!v.lines.length) return bad("Add at least one line before sending");
      await prisma.jobVariation.update({ where: { id: v.id }, data: { status: "sent", sentAt: new Date() } });
      if (v.job.clientId) {
        const clients = await prisma.user.findMany({ where: { clientId: v.job.clientId, role: "client" }, select: { id: true } });
        await notify(clients.map(c => c.id), { title: `Variation V${v.number} to approve on ${v.job.title}`, body: v.title, link: "/my-builds" }).catch(() => {});
      }
      break;
    }
    case "withdraw": {
      if (v.status !== "sent") return bad("Only a sent variation can be withdrawn");
      await prisma.jobVariation.update({ where: { id: v.id }, data: { status: "draft", sentAt: null } });
      break;
    }
    case "record": {
      if (r.v.role !== "admin") return bad("Only admins record a client's decision", 403);
      if (body.decision !== "approved" && body.decision !== "declined") return bad("Approved or declined");
      if (!v.lines.length) return bad("Add at least one line first");
      const me = await prisma.user.findUnique({ where: { id: r.v.userId }, select: { name: true } });
      const err = await decideVariation(v.id, body.decision, { name: me?.name ?? "PSG", onBehalf: true }, typeof body.comment === "string" ? body.comment : null);
      if (err) return bad(err);
      break;
    }
    default:
      return bad("Unknown action");
  }
  return NextResponse.json(await variationsFor(r.id));
}

export async function DELETE(_req: Request, p: P) {
  const r = await load(p);
  if ("error" in r) return r.error;
  const v = r.variation;
  if (v.status !== "draft" && v.status !== "declined") return NextResponse.json({ error: "Only drafts and declined variations can be deleted" }, { status: 400 });
  if (v.createdById !== r.v.userId && r.v.role !== "admin") return NextResponse.json({ error: "Only whoever made it, or an admin, can delete it" }, { status: 403 });
  await prisma.jobVariation.delete({ where: { id: v.id } });
  return NextResponse.json(await variationsFor(r.id));
}

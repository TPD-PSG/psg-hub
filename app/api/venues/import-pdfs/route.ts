import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { fileToContent, parseVenueDocument } from "@/lib/venueParser";
import { ClaudeOutputError } from "@/lib/claude";

export const dynamic = "force-dynamic";

async function processPDF(file: File): Promise<{ ok: true; name: string } | { ok: false; name: string; error: string }> {
  try {
    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const doc = await fileToContent(buffer, file.name, file.type);
    if (!doc) return { ok: false, name: file.name, error: "Unsupported file type" };

    const extracted = await parseVenueDocument(doc);
    const v = extracted.venue;
    if (!v.name) return { ok: false, name: file.name, error: "Could not extract venue name" };
    const techSpecs = Object.keys(extracted.techSpecs).length ? extracted.techSpecs : null;

    const venue = await prisma.venue.create({
      data: {
        name: v.name,
        type: v.type || "other",
        address: v.address || null,
        city: v.city || null,
        postcode: v.postcode || null,
        phone: v.phone || null,
        email: v.email || null,
        website: v.website || null,
        capacity: v.capacity ?? null,
        notes: v.notes || null,
        techSpecFile: base64,
        techSpecName: file.name,
        techSpecMime: file.type,
        techSpecs: techSpecs ? JSON.stringify(techSpecs) : null,
      },
    });

    if (extracted.contacts.length) {
      await prisma.venueContact.createMany({
        data: extracted.contacts.map(c => ({
          venueId: venue.id,
          name: c.name,
          role: c.role || null,
          email: c.email || null,
          phone: c.phone || null,
          notes: c.notes || null,
        })),
      });
    }
    return { ok: true, name: v.name };
  } catch (err) {
    return { ok: false, name: file.name, error: err instanceof ClaudeOutputError ? err.message : "Couldn't read this document" };
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const files = formData.getAll("files") as File[];
  if (!files.length) return NextResponse.json({ error: "No files" }, { status: 400 });

  // Process up to 10 at a time to avoid overwhelming the API
  const results: ({ ok: true; name: string } | { ok: false; name: string; error: string })[] = [];
  const BATCH = 5;
  for (let i = 0; i < files.length; i += BATCH) {
    const batch = files.slice(i, i + BATCH);
    const batchResults = await Promise.all(batch.map(f => processPDF(f)));
    results.push(...batchResults);
  }

  const succeeded = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);

  return NextResponse.json({ succeeded, failed, results });
}

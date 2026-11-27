import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { touchVenue } from "@/lib/night-run-sync";
import { fileToContent, parseVenueDocument, type ParsedVenue } from "@/lib/venueParser";
import { ClaudeOutputError } from "@/lib/claude";
import { saveFile, removeFile } from "@/lib/storage";

export const dynamic = "force-dynamic";

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isSimilar(a: string, b: string) {
  const na = normalize(a);
  const nb = normalize(b);
  return na === nb || na.includes(nb) || nb.includes(na);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "Choose a file to upload" }, { status: 400 });
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  // forceCreate=true skips duplicate check and always creates
  const forceCreate = formData.get("forceCreate") === "true";
  // updateId=N updates an existing venue instead of creating
  const updateId = formData.get("updateId") ? Number(formData.get("updateId")) : null;

  const buffer = await file.arrayBuffer();
  const doc = await fileToContent(buffer, file.name, file.type);
  if (!doc) return NextResponse.json({ error: "Upload a PDF, Word document or image" }, { status: 400 });

  let extracted: ParsedVenue;
  try {
    extracted = await parseVenueDocument(doc);
  } catch (err) {
    const message = err instanceof ClaudeOutputError ? err.message : "Couldn't read this document";
    return NextResponse.json({ error: message }, { status: 422 });
  }
  const v = extracted.venue;
  const venueName = v.name;
  if (!venueName) {
    return NextResponse.json({ error: "Could not extract venue name from document" }, { status: 422 });
  }
  const techSpecs = Object.keys(extracted.techSpecs).length ? extracted.techSpecs : null;
  const rawContacts = extracted.contacts;

  // ── Update existing venue ──────────────────────────────────────────────────
  if (updateId) {
    const previous = await prisma.venue.findUnique({ where: { id: updateId }, select: { techSpecFileKey: true } });
    const stored = await saveFile("venue-tech-specs", file.name, buffer, file.type);
    await removeFile(previous?.techSpecFileKey);
    // Re-importing fills in what the document gives; it never blanks details someone entered by hand
    await prisma.venue.update({
      where: { id: updateId },
      data: {
        name: venueName,
        type: v.type || undefined,
        address: v.address || undefined,
        city: v.city || undefined,
        postcode: v.postcode || undefined,
        phone: v.phone || undefined,
        email: v.email || undefined,
        website: v.website || undefined,
        capacity: v.capacity ?? undefined,
        notes: v.notes || undefined,
        techSpecFile: stored.base64,
        techSpecFileKey: stored.key,
        techSpecName: file.name,
        techSpecMime: file.type,
        techSpecs: techSpecs ? JSON.stringify(techSpecs) : undefined,
      },
    });

    // Merge contacts by name: add new people, fill gaps on existing ones, never duplicate
    const existing = await prisma.venueContact.findMany({ where: { venueId: updateId } });
    const byName = new Map(existing.map(c => [c.name.trim().toLowerCase(), c]));
    for (const c of rawContacts) {
      const match = byName.get(c.name.trim().toLowerCase());
      if (match) {
        await prisma.venueContact.update({
          where: { id: match.id },
          data: {
            role: match.role || c.role || null,
            email: match.email || c.email || null,
            phone: match.phone || c.phone || null,
            notes: match.notes || c.notes || null,
          },
        });
      } else {
        const created = await prisma.venueContact.create({
          data: { venueId: updateId, name: c.name, role: c.role || null, email: c.email || null, phone: c.phone || null, notes: c.notes || null },
        });
        byName.set(c.name.trim().toLowerCase(), created);
      }
    }
    if (rawContacts.length > 0) await touchVenue(updateId);

    const venueWithContacts = await prisma.venue.findUnique({
      where: { id: updateId },
      include: { contacts: true, _count: { select: { contacts: true } } },
    });

    return NextResponse.json({ venue: venueWithContacts, extracted });
  }

  // ── Duplicate check ────────────────────────────────────────────────────────
  if (!forceCreate) {
    const allVenues = await prisma.venue.findMany({ select: { id: true, name: true, city: true } });
    const match = allVenues.find(existing => isSimilar(existing.name, venueName));
    if (match) {
      return NextResponse.json({
        duplicate: true,
        existing: { id: match.id, name: match.name, city: match.city },
        extractedName: venueName,
        // Pass back the base64 so the client doesn't need to re-upload
        // (we'll use forceCreate or updateId on the next call)
      });
    }
  }

  // ── Create new venue ───────────────────────────────────────────────────────
  const stored = await saveFile("venue-tech-specs", file.name, buffer, file.type);
  const venue = await prisma.venue.create({
    data: {
      name: venueName,
      type: v.type || "other",
      address: v.address || null,
      city: v.city || null,
      postcode: v.postcode || null,
      phone: v.phone || null,
      email: v.email || null,
      website: v.website || null,
      capacity: v.capacity ?? null,
      notes: v.notes || null,
      techSpecFile: stored.base64,
      techSpecFileKey: stored.key,
      techSpecName: file.name,
      techSpecMime: file.type,
      techSpecs: techSpecs ? JSON.stringify(techSpecs) : null,
    },
    include: { contacts: true, _count: { select: { contacts: true } } },
  });

  if (rawContacts.length > 0) {
    await prisma.venueContact.createMany({
      data: rawContacts
                .map(c => ({
          venueId: venue.id,
          name: c.name,
          role: c.role || null,
          email: c.email || null,
          phone: c.phone || null,
          notes: c.notes || null,
        })),
    });
    await touchVenue(venue.id);
  }

  const venueWithContacts = await prisma.venue.findUnique({
    where: { id: venue.id },
    include: { contacts: true, _count: { select: { contacts: true } } },
  });

  return NextResponse.json({ venue: venueWithContacts, extracted });
}

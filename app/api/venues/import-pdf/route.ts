import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import Anthropic from "@anthropic-ai/sdk";

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

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  // forceCreate=true skips duplicate check and always creates
  const forceCreate = formData.get("forceCreate") === "true";
  // updateId=N updates an existing venue instead of creating
  const updateId = formData.get("updateId") ? Number(formData.get("updateId")) : null;

  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");

  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: "claude-sonnet-5-5",
    max_tokens: 8192,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: base64 },
          },
          {
            type: "text",
            text: `Extract information from this venue document. Return ONLY valid JSON with this structure — omit any key where the value is unknown, omit entire techSpecs sections with no data:

{
  "venue": { "name": "...", "type": "theatre|arena|outdoor|club|conference|hotel|other", "address": "...", "city": "...", "postcode": "...", "phone": "...", "email": "...", "website": "...", "capacity": 0, "notes": "..." },
  "contacts": [
    { "name": "...", "role": "...", "email": "...", "phone": "...", "notes": "..." }
  ],
  "techSpecs": {
    "stage": { "Stage Width": "...", "Stage Depth": "...", "Stage Height": "...", "Wing Width (PS)": "...", "Wing Width (OP)": "...", "Grid Height": "...", "Fly Tower Height": "...", "Proscenium Width": "...", "Proscenium Height": "...", "Crossover": "..." },
    "loadIn": { "Loading Dock": "...", "Access Width": "...", "Access Height": "...", "Dock Height": "...", "Truck Capacity": "...", "Notes": "..." },
    "rigging": { "Number of Bars": "...", "Bar Length": "...", "Bar Capacity": "...", "Bar Spacing": "...", "Counterweight System": "...", "Motor Hoists": "...", "House Tabs": "..." },
    "lighting": { "Control Desk": "...", "Dimmers": "...", "Follow Spots": "...", "House Rig": "...", "Sockets": "...", "Notes": "..." },
    "sound": { "PA System": "...", "Control Position": "...", "Monitor System": "...", "Playback": "...", "Notes": "..." },
    "dressingRooms": { "Number of Rooms": "...", "Principal Rooms": "...", "Chorus Rooms": "...", "Shower Facilities": "...", "Notes": "..." },
    "wardrobe": { "Location": "...", "Washing Machine": "...", "Dryer": "...", "Notes": "..." },
    "healthSafety": { "First Aid": "...", "Fire Exits": "...", "Notes": "..." }
  }
}

Extract all named contacts (technical manager, production manager, stage door, marketing, box office, etc.) into the contacts array. Return only valid JSON, no markdown, no explanation.`,
          },
        ],
      },
    ],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  const cleaned = text.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
  const extracted = JSON.parse(cleaned);
  const v = extracted.venue ?? extracted;

  if (!v.name) {
    return NextResponse.json({ error: "Could not extract venue name from document" }, { status: 422 });
  }

  const techSpecs = extracted.techSpecs
    ? Object.fromEntries(Object.entries(extracted.techSpecs).filter(([, val]) => val !== null))
    : null;

  const rawContacts = Array.isArray(extracted.contacts) ? extracted.contacts : [];

  // ── Update existing venue ──────────────────────────────────────────────────
  if (updateId) {
    const updated = await prisma.venue.update({
      where: { id: updateId },
      data: {
        name: v.name,
        type: v.type || "other",
        address: v.address || null,
        city: v.city || null,
        postcode: v.postcode || null,
        phone: v.phone || null,
        email: v.email || null,
        website: v.website || null,
        capacity: v.capacity ? Number(v.capacity) : null,
        notes: v.notes || null,
        techSpecFile: base64,
        techSpecName: file.name,
        techSpecMime: file.type,
        techSpecs: techSpecs ? JSON.stringify(techSpecs) : null,
      },
      include: { contacts: true, _count: { select: { contacts: true } } },
    });

    if (rawContacts.length > 0) {
      await prisma.venueContact.createMany({
        data: rawContacts
          .filter((c: { name?: string }) => c.name)
          .map((c: { name: string; role?: string; email?: string; phone?: string; notes?: string }) => ({
            venueId: updateId,
            name: c.name,
            role: c.role || null,
            email: c.email || null,
            phone: c.phone || null,
            notes: c.notes || null,
          })),
      });
    }

    const venueWithContacts = await prisma.venue.findUnique({
      where: { id: updateId },
      include: { contacts: true, _count: { select: { contacts: true } } },
    });

    return NextResponse.json({ venue: venueWithContacts, extracted });
  }

  // ── Duplicate check ────────────────────────────────────────────────────────
  if (!forceCreate) {
    const allVenues = await prisma.venue.findMany({ select: { id: true, name: true, city: true } });
    const match = allVenues.find(existing => isSimilar(existing.name, v.name));
    if (match) {
      return NextResponse.json({
        duplicate: true,
        existing: { id: match.id, name: match.name, city: match.city },
        extractedName: v.name,
        // Pass back the base64 so the client doesn't need to re-upload
        // (we'll use forceCreate or updateId on the next call)
      });
    }
  }

  // ── Create new venue ───────────────────────────────────────────────────────
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
      capacity: v.capacity ? Number(v.capacity) : null,
      notes: v.notes || null,
      techSpecFile: base64,
      techSpecName: file.name,
      techSpecMime: file.type,
      techSpecs: techSpecs ? JSON.stringify(techSpecs) : null,
    },
    include: { contacts: true, _count: { select: { contacts: true } } },
  });

  if (rawContacts.length > 0) {
    await prisma.venueContact.createMany({
      data: rawContacts
        .filter((c: { name?: string }) => c.name)
        .map((c: { name: string; role?: string; email?: string; phone?: string; notes?: string }) => ({
          venueId: venue.id,
          name: c.name,
          role: c.role || null,
          email: c.email || null,
          phone: c.phone || null,
          notes: c.notes || null,
        })),
    });
  }

  const venueWithContacts = await prisma.venue.findUnique({
    where: { id: venue.id },
    include: { contacts: true, _count: { select: { contacts: true } } },
  });

  return NextResponse.json({ venue: venueWithContacts, extracted });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

const PROMPT = `Extract information from this venue document. Return ONLY valid JSON with this structure — omit any key where the value is unknown, omit entire techSpecs sections with no data:

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

Extract all named contacts (technical manager, production manager, stage door, marketing, box office, etc.) into the contacts array. Return only valid JSON, no markdown, no explanation.`;

async function processPDF(file: File, client: Anthropic): Promise<{ ok: true; name: string } | { ok: false; name: string; error: string }> {
  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  const isDocx = file.name.toLowerCase().endsWith(".docx") || file.name.toLowerCase().endsWith(".doc") || file.type.includes("wordprocessingml") || file.type.includes("msword");

  let docContent: Anthropic.MessageParam["content"][number];
  if (isDocx) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mammoth = require("mammoth") as { extractRawText: (input: { buffer: Buffer }) => Promise<{ value: string }> };
    const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
    docContent = { type: "text", text: `Venue document text:\n\n${result.value}` };
  } else {
    docContent = { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } };
  }

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-5-5",
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: [
            docContent,
            { type: "text", text: PROMPT },
          ],
        },
      ],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const cleaned = text.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
    const extracted = JSON.parse(cleaned);
    const v = extracted.venue ?? extracted;

    if (!v.name) return { ok: false, name: file.name, error: "Could not extract venue name" };

    const techSpecs = extracted.techSpecs
      ? Object.fromEntries(Object.entries(extracted.techSpecs).filter(([, val]) => val !== null))
      : null;

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
    });

    const rawContacts = Array.isArray(extracted.contacts) ? extracted.contacts : [];
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

    return { ok: true, name: v.name };
  } catch (err) {
    return { ok: false, name: file.name, error: String(err) };
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });

  const formData = await req.formData();
  const files = formData.getAll("files") as File[];
  if (!files.length) return NextResponse.json({ error: "No files" }, { status: 400 });

  const client = new Anthropic({ apiKey });

  // Process up to 10 at a time to avoid overwhelming the API
  const results: ({ ok: true; name: string } | { ok: false; name: string; error: string })[] = [];
  const BATCH = 5;
  for (let i = 0; i < files.length; i += BATCH) {
    const batch = files.slice(i, i + BATCH);
    const batchResults = await Promise.all(batch.map(f => processPDF(f, client)));
    results.push(...batchResults);
  }

  const succeeded = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);

  return NextResponse.json({ succeeded, failed, results });
}

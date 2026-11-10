import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");

  // Store the file first
  await prisma.venue.update({
    where: { id: Number(id) },
    data: { techSpecFile: base64, techSpecName: file.name, techSpecMime: file.type },
  });

  // Parse with Claude if API key is set
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: true, name: file.name, parsed: false });
  }

  try {
    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: "claude-sonnet-5-5",
      max_tokens: 4096,
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
              text: `Extract all technical specifications from this venue tech spec document. Return ONLY a JSON object with this exact structure (omit any section that has no data, leave values null if not found):

{
  "general": { "Stage Type": null, "Stage Width": null, "Stage Depth": null, "Stage Height": null, "Grid Height": null, "Proscenium Width": null, "Proscenium Height": null, "Flying": null, "Orchestra Pit": null },
  "loadIn": { "Loading Dock": null, "Dock Height": null, "Access Width": null, "Access Height": null, "Truck Capacity": null, "Freight Elevator": null, "Notes": null },
  "stage": { "Stage Width": null, "Stage Depth": null, "Stage Height": null, "Wing Width (PS)": null, "Wing Width (OP)": null, "Fly Tower Height": null, "Grid Height": null, "Crossover": null },
  "rigging": { "Grid Type": null, "Number of Bars": null, "Bar Spacing": null, "Bar Length": null, "Bar Capacity": null, "House Tabs": null, "Counterweight System": null, "Motor Hoists": null },
  "masking": { "Legs": null, "Borders": null, "Blacks": null, "Cyclorama": null, "Gauze": null, "Notes": null },
  "lighting": { "Dimmers": null, "Control Desk": null, "Follow Spots": null, "House Rig": null, "Sockets": null, "Notes": null },
  "sound": { "PA System": null, "Control Position": null, "Monitor System": null, "Comms": null, "Playback": null, "Notes": null },
  "wardrobe": { "Location": null, "Number of Rails": null, "Washing Machine": null, "Dryer": null, "Iron": null, "Notes": null },
  "dressingRooms": { "Number of Rooms": null, "Principal Rooms": null, "Chorus Rooms": null, "Shower Facilities": null, "Notes": null },
  "comms": { "Clearcom": null, "Show Relay": null, "CCTV": null, "Notes": null },
  "healthSafety": { "First Aid": null, "Fire Exits": null, "Evacuation": null, "Risk Assessment": null, "Notes": null }
}

Return only valid JSON, no markdown, no explanation.`,
            },
          ],
        },
      ],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    // Strip markdown code fences if present
    const cleaned = text.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
    const techSpecs = JSON.parse(cleaned);

    await prisma.venue.update({
      where: { id: Number(id) },
      data: { techSpecs: JSON.stringify(techSpecs) },
    });

    return NextResponse.json({ ok: true, name: file.name, parsed: true, techSpecs });
  } catch (err) {
    console.error("Tech spec parse error:", err);
    return NextResponse.json({ ok: true, name: file.name, parsed: false, error: "Parse failed — file saved" });
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const venue = await prisma.venue.findUnique({ where: { id: Number(id) }, select: { techSpecFile: true, techSpecName: true, techSpecMime: true } });
  if (!venue?.techSpecFile) return NextResponse.json({ error: "No file" }, { status: 404 });

  const buffer = Buffer.from(venue.techSpecFile, "base64");
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": venue.techSpecMime ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${venue.techSpecName ?? "tech-spec"}"`,
    },
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.venue.update({ where: { id: Number(id) }, data: { techSpecFile: null, techSpecName: null, techSpecMime: null } });
  return NextResponse.json({ ok: true });
}

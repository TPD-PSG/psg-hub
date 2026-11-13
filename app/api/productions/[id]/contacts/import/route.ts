import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Claude API can take 15–30s on large documents

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });

  const { id } = await params;
  const productionId = Number(id);

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  // Bulk import from pre-parsed contacts (from preview step)
  const bulkJson = formData.get("contacts");
  if (bulkJson) {
    const toImport = JSON.parse(bulkJson as string) as Array<{
      section: string; name: string; company?: string; role?: string; phone?: string; email?: string; notes?: string;
    }>;
    const maxOrder = await prisma.productionContact.aggregate({
      where: { productionId },
      _max: { sortOrder: true },
    });
    let sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;
    await prisma.productionContact.createMany({
      data: toImport.map(c => ({
        productionId,
        section: c.section || "General",
        sortOrder: sortOrder++,
        name: c.name,
        company: c.company || null,
        role: c.role || null,
        phone: c.phone || null,
        email: c.email || null,
        notes: c.notes || null,
      })),
    });
    const contacts = await prisma.productionContact.findMany({
      where: { productionId },
      orderBy: [{ section: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    });
    return NextResponse.json({ imported: toImport.length, contacts });
  }

  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (file.size > 20_000_000) return NextResponse.json({ error: "File too large (max 20 MB)" }, { status: 413 });

  const buffer = await file.arrayBuffer();
  const isDocx = file.name.toLowerCase().endsWith(".docx") || file.name.toLowerCase().endsWith(".doc") || file.type.includes("wordprocessingml") || file.type.includes("msword");
  const isCsv = file.name.toLowerCase().endsWith(".csv") || file.type.includes("csv");
  const isXlsx = file.name.toLowerCase().endsWith(".xlsx") || file.name.toLowerCase().endsWith(".xls") || file.type.includes("spreadsheet") || file.type.includes("excel");

  const client = new Anthropic({ apiKey });

  let docContent: Anthropic.MessageParam["content"][number];

  if (isDocx) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mammoth = require("mammoth") as { extractRawText: (input: { buffer: Buffer }) => Promise<{ value: string }> };
    const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
    docContent = { type: "text", text: `Contact sheet document:\n\n${result.value}` };
  } else if (isXlsx) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const XLSX = require("xlsx") as typeof import("xlsx");
    const wb = XLSX.read(Buffer.from(buffer), { type: "buffer" });
    const rows: string[] = [];
    for (const sheetName of wb.SheetNames) {
      rows.push(`Sheet: ${sheetName}`);
      rows.push(XLSX.utils.sheet_to_csv(wb.Sheets[sheetName]));
    }
    docContent = { type: "text", text: `Contact sheet data:\n\n${rows.join("\n")}` };
  } else if (isCsv) {
    const text = Buffer.from(buffer).toString("utf-8");
    docContent = { type: "text", text: `Contact sheet data:\n\n${text}` };
  } else {
    // Assume PDF
    const base64 = Buffer.from(buffer).toString("base64");
    docContent = { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } };
  }

  const SECTION_PRESETS = ["Creative Team", "Production Team", "Show Team", "Cast", "Venue", "Press & Marketing", "Transport & Haulage", "General"];

  const message = await client.messages.create({
    model: "claude-sonnet-5-5",
    max_tokens: 8192,
    messages: [
      {
        role: "user",
        content: [
          docContent,
          {
            type: "text",
            text: `This is a contact sheet for a theatre/live production. Extract all contacts.

Section headers: rows that contain only a category label (often ALL-CAPS, e.g. CREATIVES, CAST, PRODUCTION, COMPANY) with no name/email/phone data are section dividers — not contacts. Use them to group the people below.

Map each section to the closest name from this list: ${SECTION_PRESETS.join(", ")}
If nothing fits, use the section heading from the document as-is.

For each person extract:
- section: group they belong to
- name: full name (skip rows with no name)
- role: job title/role
- company: organisation they represent (if shown)
- phone: phone number(s) — combine multiples with " / "
- email: email address
- notes: any other relevant info

Return ONLY valid JSON (no markdown, no explanation):
{
  "contacts": [
    { "section": "...", "name": "...", "role": "...", "company": "...", "phone": "...", "email": "...", "notes": "..." }
  ]
}

Omit any field if unknown. Skip rows with no name. Include every named person.`,
          },
        ],
      },
    ],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  const cleaned = text.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
  let extracted: { contacts?: unknown[] };
  try {
    extracted = JSON.parse(cleaned);
  } catch {
    return NextResponse.json({ error: "AI returned an unreadable response — please try again" }, { status: 502 });
  }
  const contacts = Array.isArray(extracted.contacts) ? extracted.contacts : [];

  return NextResponse.json({ contacts });
}

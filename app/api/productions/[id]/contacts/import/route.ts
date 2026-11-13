import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

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
  } else if (isCsv || isXlsx) {
    const text = Buffer.from(buffer).toString("utf-8");
    docContent = { type: "text", text: `Contact sheet data:\n\n${text}` };
  } else {
    // Assume PDF
    const base64 = Buffer.from(buffer).toString("base64");
    docContent = { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } };
  }

  const SECTION_PRESETS = ["Creative Team", "Production Team", "Cast", "Venue", "Press & Marketing", "Transport & Haulage", "General"];

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
            text: `This is a contact sheet or contacts document for a theatre/live production. Extract all contacts.

For each person, identify:
- section: which group they belong to (use one of: ${SECTION_PRESETS.join(", ")} — or create a sensible section name from headings in the document)
- name: full name
- role: their job title/role (e.g. Director, Production Manager, Stage Manager, Lighting Designer)
- company: organisation/company they represent (if shown)
- phone: phone number(s) — combine multiple into one string separated by " / "
- email: email address
- notes: any other relevant info

Return ONLY valid JSON (no markdown, no explanation):
{
  "contacts": [
    { "section": "...", "name": "...", "role": "...", "company": "...", "phone": "...", "email": "...", "notes": "..." }
  ]
}

Omit any field if unknown. Include every named person in the document.`,
          },
        ],
      },
    ],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  const cleaned = text.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
  const extracted = JSON.parse(cleaned);
  const contacts = Array.isArray(extracted.contacts) ? extracted.contacts : [];

  return NextResponse.json({ contacts });
}

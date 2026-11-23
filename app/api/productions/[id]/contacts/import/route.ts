import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProductionAccess } from "@/lib/access";
import Anthropic, { toFile } from "@anthropic-ai/sdk";
import { CONTACT_SECTIONS_SETTING, defaultSections, parseSections } from "@/lib/contactSections";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Claude API can take 15–30s on large documents

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProductionAccess(id, "contacts");
  if ("error" in access) return access.error;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });

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
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mammoth = require("mammoth") as { extractRawText: (input: { buffer: Buffer }) => Promise<{ value: string }> };
      const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
      docContent = { type: "text", text: `Contact sheet document:\n\n${result.value}` };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Contacts import: DOCX parse error", msg);
      return NextResponse.json({ error: `Could not read DOCX file: ${msg}` }, { status: 400 });
    }
  } else if (isXlsx) {
    try {
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await wb.xlsx.load(Buffer.from(buffer) as any);
      const rows: string[] = [];
      wb.eachSheet((ws) => {
        rows.push(`Sheet: ${ws.name}`);
        ws.eachRow((row) => {
          rows.push(row.values ? (row.values as unknown[]).slice(1).map(v => v == null ? "" : String(v)).join(",") : "");
        });
      });
      docContent = { type: "text", text: `Contact sheet data:\n\n${rows.join("\n")}` };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Contacts import: XLSX parse error", msg);
      return NextResponse.json({ error: `Could not read Excel file: ${msg}` }, { status: 400 });
    }
  } else if (isCsv) {
    const text = Buffer.from(buffer).toString("utf-8");
    docContent = { type: "text", text: `Contact sheet data:\n\n${text}` };
  } else {
    // PDF — upload via Files API to avoid large inline base64 payloads causing connection resets
    let fileId: string;
    try {
      const uploadedFile = await client.files.upload({
        file: await toFile(Buffer.from(buffer), file.name || "contact-sheet.pdf", { type: "application/pdf" }),
        expires_in_seconds: 3600,
      });
      fileId = uploadedFile.id;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Contacts import: failed to upload PDF to Files API", msg);
      return NextResponse.json({ error: `PDF upload failed: ${msg}` }, { status: 502 });
    }
    docContent = { type: "document", source: { type: "file", file_id: fileId } };
  }

  const [sectionSetting, prodSections] = await Promise.all([
    prisma.setting.findUnique({ where: { key: CONTACT_SECTIONS_SETTING } }),
    prisma.production.findUnique({ where: { id: Number(id) }, select: { contactSections: true } }),
  ]);
  const SECTION_PRESETS = Array.from(new Set([...parseSections(prodSections?.contactSections), ...defaultSections(sectionSetting?.value)]));

  const PROMPT = `This is a contact sheet for a theatre/live production. Extract every named person using the extract_contacts tool.

Section headers: rows/cells that contain only a category label (often ALL-CAPS, e.g. CREATIVES, CAST, PRODUCTION, COMPANY) with no name/email/phone data are section dividers — not contacts. Use them to group the people below.

Map each section to the closest name from this list: ${SECTION_PRESETS.join(", ")}
If nothing fits, use the section heading from the document as-is.

Skip any row with no name. Include every named person. Call extract_contacts once with all contacts.`;

  let message;
  try {
    message = await client.messages.create({
      model: "claude-sonnet-5-5",
      max_tokens: 16000,
      tools: [
        {
          name: "extract_contacts",
          description: "Output all extracted contacts from the contact sheet",
          input_schema: {
            type: "object" as const,
            properties: {
              contacts: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    section: { type: "string", description: "Group/section this person belongs to" },
                    name: { type: "string", description: "Full name" },
                    role: { type: "string", description: "Job title or role" },
                    company: { type: "string", description: "Organisation they represent" },
                    phone: { type: "string", description: "Phone number(s), combine multiples with ' / '" },
                    email: { type: "string", description: "Email address" },
                    notes: { type: "string", description: "Any other relevant info" },
                  },
                  required: ["section", "name"],
                },
              },
            },
            required: ["contacts"],
          },
        },
      ],
      tool_choice: { type: "auto" as const },
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
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Contacts import: Anthropic API error", msg);
    return NextResponse.json({ error: `AI processing failed: ${msg}` }, { status: 502 });
  }

  const toolBlock = message.content.find(b => b.type === "tool_use" && b.name === "extract_contacts");
  if (toolBlock && toolBlock.type === "tool_use") {
    const contacts = Array.isArray((toolBlock.input as { contacts?: unknown[] }).contacts)
      ? (toolBlock.input as { contacts: unknown[] }).contacts
      : [];
    return NextResponse.json({ contacts });
  }

  // Fallback: Claude returned text — try JSON parsing
  const textBlock = message.content.find(b => b.type === "text");
  const rawText = textBlock && textBlock.type === "text" ? textBlock.text : "";
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  const cleaned = jsonMatch ? jsonMatch[0] : rawText.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
  try {
    const extracted = JSON.parse(cleaned) as { contacts?: unknown[] };
    const contacts = Array.isArray(extracted.contacts) ? extracted.contacts : [];
    return NextResponse.json({ contacts });
  } catch {
    console.error("Contacts import: failed to parse AI response", rawText.slice(0, 500));
    return NextResponse.json({ error: "AI returned an unreadable response — please try again" }, { status: 502 });
  }
}

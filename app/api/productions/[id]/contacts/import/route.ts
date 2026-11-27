import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProductionAccess } from "@/lib/access";
import type Anthropic from "@anthropic-ai/sdk";
import { toFile } from "@anthropic-ai/sdk";
import { extractJson, objectSchema, nullable, ClaudeOutputError, claude } from "@/lib/claude";
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

  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "Choose a file to upload" }, { status: 400 });
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

  let docContent: Anthropic.Beta.BetaContentBlockParam;

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
      const uploadedFile = await claude.files.upload({
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

  const PROMPT = `This is a contact sheet for a theatre/live production. Extract every named person.

Section headers: rows/cells that contain only a category label (often ALL-CAPS, e.g. CREATIVES, CAST, PRODUCTION, COMPANY) with no name/email/phone data are section dividers — not contacts. Use them to group the people below.

Map each section to the closest name from this list: ${SECTION_PRESETS.join(", ")}
If nothing fits, use the section heading from the document as-is.

Skip any row with no name. Include every named person. Use null for details that aren't given; combine several phone numbers with ' / '.`;

  type Extracted = { section: string; name: string; role: string | null; company: string | null; phone: string | null; email: string | null; notes: string | null };
  let extracted: Extracted[];
  try {
    ({ contacts: extracted } = await extractJson<{ contacts: Extracted[] }>({
      feature: "contacts",
      model: "claude-sonnet-5-5",
      content: [docContent, { type: "text", text: PROMPT }],
      schema: objectSchema({
        contacts: {
          type: "array",
          items: objectSchema({
            section: { type: "string", description: "Group/section this person belongs to" },
            name: { type: "string", description: "Full name" },
            role: nullable("string", "Job title or role"),
            company: nullable("string", "Organisation they represent"),
            phone: nullable("string"),
            email: nullable("string"),
            notes: nullable("string", "Any other relevant info"),
          }),
        },
      }),
    }));
  } catch (err: unknown) {
    const msg = err instanceof ClaudeOutputError ? err.message : "AI processing failed — please try again";
    console.error("Contacts import:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  // The review screen expects missing details to be absent rather than null
  const contacts = extracted
    .filter(c => c.name?.trim())
    .map(c => Object.fromEntries(Object.entries(c).filter(([, v]) => v !== null)));
  return NextResponse.json({ contacts });
}

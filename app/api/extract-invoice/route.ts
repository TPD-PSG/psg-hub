import { NextRequest, NextResponse } from "next/server";
import { extractJson, pdfBlock, nullable, objectSchema, ClaudeOutputError } from "@/lib/claude";
import { auth } from "@/auth";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString("base64");
  const isImage = file.type.startsWith("image/");
  const isPdf = file.type === "application/pdf";

  if (!isImage && !isPdf) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }

  const doc = isPdf
    ? pdfBlock(base64)
    : { type: "image" as const, source: { type: "base64" as const, media_type: file.type as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: base64 } };

  try {
    const data = await extractJson<{ dueDate: string | null; grossAmount: number | null; invoiceNumber: string | null; supplier: string | null }>({
      model: "claude-haiku-5-5",
      maxTokens: 4000,
      content: [doc, {
        type: "text",
        text: `Read this invoice. Use null for anything it doesn't show.
- dueDate: the payment due date (not the issue date if different), as YYYY-MM-DD
- grossAmount: the total including VAT, as a number
- invoiceNumber: the invoice reference or number
- supplier: the company or person who issued it`,
      }],
      schema: objectSchema({
        dueDate: nullable("string"),
        grossAmount: nullable("number"),
        invoiceNumber: nullable("string"),
        supplier: nullable("string"),
      }),
    });
    return NextResponse.json(data);
  } catch (err) {
    // The form still works by hand if reading fails
    console.error("Invoice extract failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ dueDate: null, grossAmount: null, invoiceNumber: null, supplier: null, error: err instanceof ClaudeOutputError ? err.message : "Couldn't read this invoice" });
  }
}

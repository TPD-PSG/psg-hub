import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function POST(req: NextRequest) {
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

  const mediaType = isPdf ? "application/pdf" : (file.type as "image/jpeg" | "image/png" | "image/gif" | "image/webp");

  const message = await client.messages.create({
    model: "claude-haiku-5-5",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: [
          {
            type: isPdf ? "document" : "image",
            source: { type: "base64", media_type: mediaType, data: base64 },
          } as any,
          {
            type: "text",
            text: `Extract the following fields from this invoice and return ONLY valid JSON (no markdown, no explanation):
{
  "dueDate": "YYYY-MM-DD or null",
  "grossAmount": number or null,
  "invoiceNumber": "string or null",
  "supplier": "string or null"
}
- dueDate: the payment due date on the invoice (not the invoice issue date if different)
- grossAmount: the total gross amount including VAT
- invoiceNumber: the invoice reference or number shown on the document
- supplier: the company or person who issued the invoice`,
          },
        ],
      },
    ],
  });

  const text = (message.content[0] as any).text?.trim() ?? "";
  try {
    const data = JSON.parse(text);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ dueDate: null, grossAmount: null, invoiceNumber: null, supplier: null });
  }
}

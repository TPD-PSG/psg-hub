import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { question, history } = await req.json();
  if (!question?.trim()) return NextResponse.json({ error: "No question" }, { status: 400 });

  const docs = await prisma.knowledgeDoc.findMany({ select: { name: true, mime: true, file: true } });

  if (docs.length === 0) {
    return NextResponse.json({ answer: "No documents have been uploaded to the knowledge base yet. An admin needs to upload some policy documents first." });
  }

  // Build document blocks for PDFs, plain text for others
  const docBlocks: Anthropic.MessageParam["content"] = [];
  for (const doc of docs) {
    if (doc.mime === "application/pdf") {
      docBlocks.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: doc.file },
        title: doc.name,
      } as any);
    } else {
      // For non-PDF docs, include as text with a header
      const text = Buffer.from(doc.file, "base64").toString("utf-8");
      docBlocks.push({ type: "text", text: `--- Document: ${doc.name} ---\n${text}` });
    }
  }

  // Build conversation messages
  const messages: Anthropic.MessageParam[] = [];

  // Prior conversation turns
  if (Array.isArray(history)) {
    for (const turn of history) {
      messages.push({ role: turn.role, content: turn.content });
    }
  }

  // Current question — docs only on first turn or if no history
  if (messages.length === 0) {
    messages.push({
      role: "user",
      content: [...docBlocks, { type: "text", text: question }],
    });
  } else {
    messages.push({ role: "user", content: question });
  }

  const response = await client.messages.create({
    model: "claude-sonnet-5-5",
    max_tokens: 1024,
    system: `You are a helpful assistant for Production Solutions Group. Answer questions based on the company policy documents provided. Be concise and practical. If the answer isn't in the documents, say so clearly rather than guessing.`,
    messages,
  });

  const answer = (response.content[0] as Anthropic.TextBlock).text;
  return NextResponse.json({ answer });
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type Anthropic from "@anthropic-ai/sdk";
import { generateText, ClaudeOutputError } from "@/lib/claude";
import { loadFile, loadBase64 } from "@/lib/storage";
import { allowUse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role === "client") return NextResponse.json({ error: "Not available" }, { status: 403 }); // (the proxy's "ask" module rule too)

  const { question, history } = await req.json().catch(() => ({}));
  if (typeof question !== "string" || !question.trim()) return NextResponse.json({ error: "No question" }, { status: 400 });
  if (question.length > 4000) return NextResponse.json({ error: "Please keep the question shorter" }, { status: 400 });
  // Each question sends the documents to Claude: a sensible allowance per person (audit round 2)
  if (!allowUse(`ask:${user.id}`, 30, 3600e3)) return NextResponse.json({ error: "That's a lot of questions this hour. Try again a bit later." }, { status: 429 });

  const docs = await prisma.knowledgeDoc.findMany({ select: { name: true, mime: true, file: true, fileKey: true } });

  if (docs.length === 0) {
    return NextResponse.json({ answer: "No documents have been uploaded to the knowledge base yet. An admin needs to upload some policy documents first." });
  }

  // Build document blocks for PDFs, plain text for others; stop at a total size Claude can take
  const MAX_TOTAL = 24 * 1024 * 1024; // base64 characters, under the request limit
  let total = 0;
  const docBlocks: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const doc of docs) {
    if (doc.mime === "application/pdf") {
      docBlocks.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: await (async () => { const d = (await loadBase64(doc.fileKey, doc.file)) ?? ""; total += d.length; return d; })() },
        title: doc.name,
      });
    } else {
      // For non-PDF docs, include as text with a header
      const text = ((await loadFile(doc.fileKey, doc.file)) ?? Buffer.alloc(0)).toString("utf-8");
      total += text.length;
      docBlocks.push({ type: "text", text: `--- Document: ${doc.name} ---\n${text}` });
    }
  }

  if (total > MAX_TOTAL) return NextResponse.json({ error: "The document library has grown too big to send with each question. An admin needs to remove or split some documents." }, { status: 413 });

  // Mark the end of the documents for caching: follow-up questions reuse them at a fraction of the cost
  const last = docBlocks[docBlocks.length - 1];
  if (last && (last.type === "document" || last.type === "text")) last.cache_control = { type: "ephemeral" };

  // The documents always lead the conversation, so follow-up questions are answered from them too
  const turns = (Array.isArray(history) ? history : [])
    .filter((t: { role?: string; content?: unknown }) => (t.role === "user" || t.role === "assistant") && typeof t.content === "string" && t.content.trim())
    .slice(-20) as { role: "user" | "assistant"; content: string }[];
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: "user", content: [...docBlocks, { type: "text", text: "These are Production Solutions Group's policy documents. Answer my questions from them." }] },
    { role: "assistant", content: "Understood. What would you like to know?" },
    ...turns,
    { role: "user", content: question },
  ];

  try {
    const answer = await generateText({
      feature: "ask",
      model: "claude-sonnet-5-5",
      maxTokens: 8000,
      system: `You are a helpful assistant for Production Solutions Group. Answer questions based on the company policy documents provided. Be concise and practical. If the answer isn't in the documents, say so clearly rather than guessing.`,
      messages,
    });
    return NextResponse.json({ answer });
  } catch (err) {
    const message = err instanceof ClaudeOutputError ? err.message : "Couldn't get an answer just now — please try again";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";

type Doc = { id: number; name: string; mime: string; createdAt: string };
type Message = { role: "user" | "assistant"; content: string };

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function AskPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role ?? "member";

  const [docs, setDocs] = useState<Doc[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [drag, setDrag] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function loadDocs() {
    const r = await fetch("/api/knowledge-docs");
    const d = await r.json();
    if (Array.isArray(d)) setDocs(d);
  }

  useEffect(() => { loadDocs(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function uploadFile(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    await fetch("/api/knowledge-docs", { method: "POST", body: fd });
    await loadDocs();
    setUploading(false);
  }

  async function deleteDoc(id: number) {
    if (!confirm("Remove this document from the knowledge base?")) return;
    await fetch(`/api/knowledge-docs/${id}`, { method: "DELETE" });
    loadDocs();
  }

  async function ask() {
    const q = input.trim();
    if (!q || loading) return;
    setInput("");
    const userMsg: Message = { role: "user", content: q };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    // Send conversation history (exclude docs — API handles that for first turn)
    const history = messages.map(m => ({ role: m.role, content: m.content }));

    const r = await fetch("/api/knowledge-docs/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: q, history }),
    });
    const data = await r.json();
    setMessages(prev => [...prev, { role: "assistant", content: data.answer ?? "Sorry, something went wrong." }]);
    setLoading(false);
  }

  return (
    <div className="max-w-4xl flex flex-col gap-6 h-full">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Ask Me Anything</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--psg-muted)" }}>Ask questions about company policies and documents</p>
      </div>

      <div className="flex gap-6 items-start flex-col lg:flex-row">

        {/* Docs panel */}
        <div className="lg:w-64 shrink-0 space-y-3">
          <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold tracking-widest uppercase" style={{ color: "var(--psg-muted)" }}>Knowledge Base</h2>
              {role === "admin" && (
                <button onClick={() => fileRef.current?.click()} className="text-xs" style={{ color: "var(--psg-blue)" }}>
                  {uploading ? "Uploading…" : "+ Add"}
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept=".pdf,.txt,.md" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ""; }} />

            {/* Drag zone (admin only) */}
            {role === "admin" && (
              <div
                className="rounded-lg border-2 border-dashed p-3 text-center text-xs mb-3 transition-colors"
                style={{ borderColor: drag ? "var(--psg-blue)" : "var(--psg-card-border)", color: "var(--psg-muted)", backgroundColor: drag ? "rgba(59,130,246,0.05)" : undefined }}
                onDragOver={e => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) uploadFile(f); }}
              >
                Drop PDF or text file here
              </div>
            )}

            {docs.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--psg-muted)" }}>No documents yet{role === "admin" ? " — upload some above" : ""}.</p>
            ) : (
              <div className="space-y-2">
                {docs.map(doc => (
                  <div key={doc.id} className="flex items-start gap-2">
                    <span className="text-sm shrink-0 mt-0.5">{doc.mime === "application/pdf" ? "📄" : "📝"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white truncate" title={doc.name}>{doc.name}</p>
                      <p className="text-xs" style={{ color: "var(--psg-muted)" }}>{fmtDate(doc.createdAt)}</p>
                    </div>
                    {role === "admin" && (
                      <button onClick={() => deleteDoc(doc.id)} className="text-xs text-red-400 hover:text-red-300 shrink-0">×</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border p-4 text-xs space-y-1" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>
            <p className="font-semibold text-white/60">Tips</p>
            <p>Ask in plain English — e.g. "What is the expenses policy?" or "How much annual leave do I get?"</p>
            <p className="mt-1">You can follow up with more questions in the same conversation.</p>
          </div>
        </div>

        {/* Chat panel */}
        <div className="flex-1 flex flex-col rounded-xl border overflow-hidden" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)", minHeight: 480 }}>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center py-12 space-y-3">
                <span className="text-4xl">💬</span>
                <p className="text-sm font-medium text-white">Ask anything about PSG policies</p>
                <p className="text-xs max-w-xs" style={{ color: "var(--psg-muted)" }}>
                  {docs.length === 0 ? "No documents uploaded yet." : `${docs.length} document${docs.length !== 1 ? "s" : ""} in the knowledge base.`}
                </p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className="max-w-[80%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap"
                  style={msg.role === "user"
                    ? { backgroundColor: "var(--psg-blue)", color: "white", borderBottomRightRadius: 4 }
                    : { backgroundColor: "rgba(255,255,255,0.06)", color: "white", borderBottomLeftRadius: 4 }}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl px-4 py-3 text-sm" style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "var(--psg-muted)", borderBottomLeftRadius: 4 }}>
                  <span className="animate-pulse">Thinking…</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t" style={{ borderColor: "var(--psg-card-border)" }}>
            {messages.length > 0 && (
              <button onClick={() => setMessages([])} className="text-xs mb-2 hover:text-white transition-colors" style={{ color: "var(--psg-muted)" }}>
                ↺ Start new conversation
              </button>
            )}
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-lg px-4 py-2.5 text-sm text-white border focus:outline-none focus:ring-1 focus:ring-blue-500"
                style={{ backgroundColor: "rgba(255,255,255,0.05)", borderColor: "var(--psg-card-border)" }}
                placeholder={docs.length === 0 ? "Upload documents first…" : "Ask a question…"}
                value={input}
                disabled={docs.length === 0 || loading}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); } }}
              />
              <button
                onClick={ask}
                disabled={!input.trim() || loading || docs.length === 0}
                className="px-4 py-2 rounded-lg text-sm text-white font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
                style={{ backgroundColor: "var(--psg-blue)" }}
              >
                Ask
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

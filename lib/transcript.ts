// Meeting transcripts from files people actually have (safe for the browser):
//   Zoom .vtt      "00:00:01.234 --> 00:00:04.567" then "Toby Darvill: Hello"
//   Teams .vtt     "<v Toby Darvill>Hello</v>"
//   .srt           numbered cues with "00:00:01,234 --> …"
//   Word Transcribe (pasted or saved as .txt)  "00:00:01 Speaker 1" then the words
// Timestamps and cue numbers go; consecutive lines from the same speaker are joined, one
// "Name: words" paragraph per turn. Anything else is kept as plain text.

const TIMING = /^\s*\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?\s*-->\s*\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?.*$/;
const STAMP = /^\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?$/;
const STAMP_THEN_NAME = /^\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s+(.{1,60})$/; // Word: "00:00:01 Speaker 1"
const NAME_THEN_STAMP = /^\[?([^\]\d:][^\]:]{0,58})\]?\s+(\d{1,2}:\d{2}(?::\d{2})?)$/; // "[Toby] 10:01:02"
const SAID = /^([A-Z][^:]{0,50}?):\s+(.+)$/; // "Toby Darvill: Hello"
const VOICE = /^<v(?:\.[^\s>]*)?\s+([^>]+)>(.*?)(?:<\/v>)?$/; // Teams

export const TRANSCRIPT_MAX_CHARS = 500_000;

export function parseTranscript(raw: string): string {
  const lines = raw.replace(/^﻿/, "").replace(/\r\n?/g, "\n").split("\n");
  const turns: { who: string | null; text: string }[] = [];
  let pendingSpeaker: string | null = null;
  const say = (who: string | null, text: string) => {
    text = text.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (!text) return;
    const last = turns[turns.length - 1];
    if (last && last.who === who) last.text += " " + text;
    else turns.push({ who, text });
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line === "WEBVTT" || line.startsWith("WEBVTT ") || /^NOTE\b/.test(line) || /^(Kind|Language):/i.test(line)) continue;
    if (TIMING.test(line) || STAMP.test(line)) continue;
    if (/^\d+$/.test(line) && (TIMING.test(lines[i + 1]?.trim() ?? "") || STAMP.test(lines[i + 1]?.trim() ?? ""))) continue; // cue number
    let m = line.match(VOICE);
    if (m) { say(m[1].trim(), m[2]); continue; }
    m = line.match(STAMP_THEN_NAME) ?? null;
    if (m && !/[.!?]$/.test(m[2])) { pendingSpeaker = m[2].trim(); continue; }
    const n = line.match(NAME_THEN_STAMP);
    if (n) { pendingSpeaker = n[1].trim(); continue; }
    m = line.match(SAID);
    if (m) { say(m[1].trim(), m[2]); continue; }
    say(pendingSpeaker, line);
  }
  return turns.map(t => (t.who ? `${t.who}: ${t.text}` : t.text)).join("\n\n").slice(0, TRANSCRIPT_MAX_CHARS);
}

/** A recording link worth keeping: http(s) only, or null. */
export function recordingUrl(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    const u = new URL(raw.trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString().slice(0, 1000) : null;
  } catch { return null; }
}

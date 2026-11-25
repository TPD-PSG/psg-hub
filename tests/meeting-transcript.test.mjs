import { run } from "./lib.mjs";

// Meetings keep their transcript and a recording link; transcript files from Zoom, Teams, .srt and
// Word's Transcribe are read into "Name: words" turns. (Minutes generation calls Claude: not tested.)
export default () => run("meeting-transcript", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [, , , admin] = users;
  const a = await login(admin.email);
  const json = r => r.json();
  let prod;
  try {
    const { parseTranscript, recordingUrl } = await import("../lib/transcript.ts");
    const zoom = "WEBVTT\n\n1\n00:00:01.000 --> 00:00:04.000\nToby Darvill: Morning all.\n\n2\n00:00:04.500 --> 00:00:06.000\nToby Darvill: Get-in is Monday.\n\n3\n00:00:06.000 --> 00:00:09.000\nSam Lee: Truck arrives 8am.\n";
    ok(parseTranscript(zoom) === "Toby Darvill: Morning all. Get-in is Monday.\n\nSam Lee: Truck arrives 8am.", "a Zoom .vtt becomes one paragraph per speaker, timings gone");
    ok(parseTranscript("WEBVTT\n\n00:00:01.000 --> 00:00:03.000\n<v Toby Darvill>Hello there</v>\n") === "Toby Darvill: Hello there", "a Teams .vtt keeps the speaker");
    ok(parseTranscript("00:00:01 Speaker 1\nWelcome.\n00:00:09 Speaker 2\nSet is on schedule.\n") === "Speaker 1: Welcome.\n\nSpeaker 2: Set is on schedule.", "a Word transcript keeps Speaker 1 / Speaker 2");
    ok(parseTranscript("1\n00:00:01,000 --> 00:00:02,000\nJust plain words\n\n2\n00:00:02,000 --> 00:00:03,000\nmore words\n") === "Just plain words more words", "an .srt without names is plain text");
    ok(recordingUrl("https://us02web.zoom.us/rec/share/abc") !== null && recordingUrl("javascript:alert(1)") === null && recordingUrl("not a link") === null, "only real web links are kept as the recording");

    prod = await db.production.create({ data: { name: "Transcript test show", type: "Other" } });
    let r = await a(`/api/productions/${prod.id}/meetings`, { method: "POST", body: JSON.stringify({ title: "PM 1", meetingDate: "2026-11-26T10:00", transcript: "Toby: Hello", recordingUrl: "https://zoom.us/rec/share/x" }) });
    const m = await json(r);
    ok(r.status === 201 && m.transcript === "Toby: Hello" && m.recordingUrl === "https://zoom.us/rec/share/x", "a new meeting saves its transcript and recording link");
    r = await a(`/api/meetings/${m.id}`, { method: "PUT", body: JSON.stringify({ title: "PM 1", meetingDate: "2026-11-26T10:00", transcript: "", recordingUrl: "javascript:alert(1)" }) });
    const u = await json(r);
    ok(r.status === 200 && u.transcript === null && u.recordingUrl === null, "clearing the transcript and a bad link are both saved as empty");
  } finally {
    if (prod) await db.production.delete({ where: { id: prod.id } }).catch(() => {});
  }
});

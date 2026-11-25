// Minutes → tasks: ask Claude for the action items in a meeting's minutes, each with a suggested
// owner and due date. Nothing is saved here; a person reviews the suggestions first.

export type SuggestedAction = {
  title: string; detail: string | null;
  ownerUserId: number | null; ownerName: string | null;
  dueDate: string | null; // YYYY-MM-DD
  priority: "low" | "medium" | "high";
  alreadyTask: boolean; // a task with this title already came from this meeting
};

export const ACTIONS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["actions"],
  properties: {
    actions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "detail", "owner_user_id", "owner_name", "due_date", "priority"],
        properties: {
          title: { type: "string", description: "The action as a short imperative, e.g. 'Send revised lighting plot to the venue'" },
          detail: { type: ["string", "null"], description: "Any useful context from the minutes, one or two sentences; null if none" },
          owner_user_id: { type: ["integer", "null"], description: "id from the people list if the owner is one of them; otherwise null" },
          owner_name: { type: ["string", "null"], description: "The owner's name as written in the minutes when they're not in the people list; null if no owner" },
          due_date: { type: ["string", "null"], description: "YYYY-MM-DD if a deadline is stated or clearly implied; null otherwise" },
          priority: { type: "string", enum: ["low", "medium", "high"] },
        },
      },
    },
  },
} as const;

export function actionsPrompt(m: { title: string; meetingDate: Date; production: string; minutes: string }, people: { id: number; name: string }[]) {
  const day = m.meetingDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" });
  return `These are the minutes of "${m.title}", a production meeting for ${m.production} held on ${day} (${m.meetingDate.toISOString().slice(0, 10)}).

People on the PSG Hub (id: name):
${people.map(p => `${p.id}: ${p.name}`).join("\n") || "(none)"}

List every action item someone agreed to do. For each:
- title: a short instruction starting with a verb.
- owner: if the person responsible is in the list above (match first names and obvious nicknames), give their id; otherwise give their name as written, or null if nobody was named. Never guess an owner who isn't mentioned.
- due_date: turn "by Friday", "next week", "before tech" etc. into a date only when the minutes make it clear, counting from the meeting date; otherwise null.
- priority: high for anything blocking the show, safety, or due within two days; low for nice-to-haves; otherwise medium.
Don't include decisions or discussion points that nobody has to act on. Don't merge separate actions.

Minutes:
${m.minutes}`;
}

type Raw = { title: string; detail: string | null; owner_user_id: number | null; owner_name: string | null; due_date: string | null; priority: string };

/** Keep only well-formed suggestions; owners must be real people from the list. */
export function cleanActions(raw: Raw[], people: { id: number }[], existingTitles: string[]): SuggestedAction[] {
  const ids = new Set(people.map(p => p.id));
  const seen = new Set(existingTitles.map(t => t.trim().toLowerCase()));
  return raw
    .filter(a => typeof a.title === "string" && a.title.trim())
    .map(a => {
      const uid = a.owner_user_id != null && ids.has(a.owner_user_id) ? a.owner_user_id : null;
      const due = typeof a.due_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(a.due_date) && !isNaN(Date.parse(a.due_date)) ? a.due_date : null;
      return {
        title: a.title.trim().slice(0, 200),
        detail: a.detail?.trim() ? a.detail.trim().slice(0, 1000) : null,
        ownerUserId: uid,
        ownerName: uid ? null : a.owner_name?.trim() ? a.owner_name.trim().slice(0, 80) : null,
        dueDate: due,
        priority: (["low", "medium", "high"].includes(a.priority) ? a.priority : "medium") as SuggestedAction["priority"],
        alreadyTask: seen.has(a.title.trim().toLowerCase()),
      };
    });
}

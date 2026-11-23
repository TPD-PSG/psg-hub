// One parser for venue documents and tech specs, shared by single import, bulk import and the
// per-venue tech-spec upload (these used to carry three different prompts and section lists).
import type Anthropic from "@anthropic-ai/sdk";
import { extractJson, pdfBlock, nullable, objectSchema } from "@/lib/claude";

// Tech-spec sections and the fields in each, in display order. The venue page shows whatever is filled in.
export const TECH_SPEC_SECTIONS: Record<string, string[]> = {
  general: ["Stage Type", "Flying", "Orchestra Pit"],
  stage: ["Stage Width", "Stage Depth", "Stage Height", "Wing Width (PS)", "Wing Width (OP)", "Grid Height", "Fly Tower Height", "Proscenium Width", "Proscenium Height", "Crossover"],
  loadIn: ["Loading Dock", "Dock Height", "Access Width", "Access Height", "Truck Capacity", "Freight Elevator", "Notes"],
  rigging: ["Grid Type", "Number of Bars", "Bar Spacing", "Bar Length", "Bar Capacity", "House Tabs", "Counterweight System", "Motor Hoists"],
  masking: ["Legs", "Borders", "Blacks", "Cyclorama", "Gauze", "Notes"],
  lighting: ["Control Desk", "Dimmers", "Follow Spots", "House Rig", "Sockets", "Notes"],
  sound: ["PA System", "Control Position", "Monitor System", "Comms", "Playback", "Notes"],
  wardrobe: ["Location", "Number of Rails", "Washing Machine", "Dryer", "Iron", "Notes"],
  dressingRooms: ["Number of Rooms", "Principal Rooms", "Chorus Rooms", "Shower Facilities", "Notes"],
  comms: ["Clearcom", "Show Relay", "CCTV", "Notes"],
  healthSafety: ["First Aid", "Fire Exits", "Evacuation", "Risk Assessment", "Notes"],
};

// A flat list of {section, field, value} keeps the schema small (a fixed field per spec item is too big
// for structured outputs); it's regrouped into sections afterwards.
const TECH_SPEC_ENTRIES = {
  type: "array",
  description: "One entry per technical detail the document gives",
  items: objectSchema({
    section: { type: "string", enum: Object.keys(TECH_SPEC_SECTIONS) },
    field: { type: "string", description: "Use the suggested field name for the section where one fits" },
    value: { type: "string", description: "As written in the document, with units" },
  }),
};
const TECH_SPECS_SCHEMA = objectSchema({ techSpecs: TECH_SPEC_ENTRIES });
type SpecEntry = { section: string; field: string; value: string };

const VENUE_SCHEMA = objectSchema({
  venue: objectSchema({
    name: nullable("string"),
    type: { type: "string", enum: ["theatre", "arena", "outdoor", "club", "conference", "hotel", "other"] },
    address: nullable("string"),
    city: nullable("string"),
    postcode: nullable("string"),
    phone: nullable("string"),
    email: nullable("string"),
    website: nullable("string"),
    capacity: nullable("integer", "Seated/standing capacity of the main space"),
    notes: nullable("string"),
  }),
  contacts: {
    type: "array",
    items: objectSchema({
      name: { type: "string" },
      role: nullable("string"),
      email: nullable("string"),
      phone: nullable("string"),
      notes: nullable("string"),
    }),
  },
  techSpecs: TECH_SPEC_ENTRIES,
});

export type TechSpecs = Record<string, Record<string, string>>;
export type ParsedVenue = {
  venue: { name: string | null; type: string; address: string | null; city: string | null; postcode: string | null; phone: string | null; email: string | null; website: string | null; capacity: number | null; notes: string | null };
  contacts: { name: string; role: string | null; email: string | null; phone: string | null; notes: string | null }[];
  techSpecs: TechSpecs;
};

// Group entries into sections (in the standard order), dropping blanks and repeats
export function cleanTechSpecs(entries: SpecEntry[] | null | undefined): TechSpecs {
  const out: TechSpecs = {};
  for (const section of Object.keys(TECH_SPEC_SECTIONS)) {
    for (const e of entries ?? []) {
      if (e.section !== section || !e.field?.trim() || !e.value?.trim()) continue;
      (out[section] ??= {})[e.field.trim()] ??= e.value.trim();
    }
  }
  return out;
}

const SPEC_INSTRUCTIONS = `For the technical specification, add one entry per detail the document gives, with the value as written (keep units, e.g. "10.5m", "16A"). Suggested fields for each section:
${Object.entries(TECH_SPEC_SECTIONS).map(([sec, f]) => `- ${sec}: ${f.join(", ")}`).join("\n")}
Use these names where they fit; use a short clear name for anything else worth recording. Skip anything the document doesn't cover. For venue details it doesn't give, use null.`;

/**
 * Turn an uploaded file into content Claude can read: PDFs and images directly, Word documents as text.
 * Returns null for formats we can't send (e.g. Excel).
 */
export async function fileToContent(buffer: ArrayBuffer, filename: string, mime: string): Promise<Anthropic.Beta.BetaContentBlockParam | null> {
  const name = filename.toLowerCase();
  if (mime === "application/pdf" || name.endsWith(".pdf")) {
    return pdfBlock(Buffer.from(buffer).toString("base64"));
  }
  if (name.endsWith(".docx") || name.endsWith(".doc") || mime.includes("wordprocessingml") || mime.includes("msword")) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mammoth = require("mammoth") as { extractRawText: (input: { buffer: Buffer }) => Promise<{ value: string }> };
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
    return { type: "text", text: `Document text (${filename}):\n\n${value}` };
  }
  const imageType = (["image/jpeg", "image/png", "image/gif", "image/webp"] as const).find(t => t === mime);
  if (imageType) {
    return { type: "image", source: { type: "base64", media_type: imageType, data: Buffer.from(buffer).toString("base64") } };
  }
  return null;
}

/** Venue details, contacts and tech spec from a venue pack / tech spec document. */
export async function parseVenueDocument(doc: Anthropic.Beta.BetaContentBlockParam): Promise<ParsedVenue> {
  const raw = await extractJson<Omit<ParsedVenue, "techSpecs"> & { techSpecs: SpecEntry[] }>({
    model: "claude-sonnet-5-5",
    content: [doc, {
      type: "text",
      text: `This is a theatre/venue document (venue pack or technical specification). Extract the venue's details, every named contact (technical manager, production manager, stage door, marketing, box office, etc.) and its technical specification. ${SPEC_INSTRUCTIONS}`,
    }],
    schema: VENUE_SCHEMA,
  });
  return { ...raw, contacts: raw.contacts.filter(c => c.name?.trim()), techSpecs: cleanTechSpecs(raw.techSpecs) };
}

/** Just the technical specification. */
export async function parseTechSpec(doc: Anthropic.Beta.BetaContentBlockParam): Promise<TechSpecs> {
  const raw = await extractJson<{ techSpecs: SpecEntry[] }>({
    model: "claude-sonnet-5-5",
    content: [doc, { type: "text", text: `This is a venue technical specification. Extract its details. ${SPEC_INSTRUCTIONS}` }],
    schema: TECH_SPECS_SCHEMA,
  });
  return cleanTechSpecs(raw.techSpecs);
}

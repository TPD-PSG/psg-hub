// Spots missing and repeated performance numbers in a production's show reports.
// Previews are numbered separately from performances, so each is checked on its own.

type Report = { performanceNumber: number | null; performance?: string | null; emailSubject?: string | null };

export type ReportGaps = { label: "Previews" | "Performances"; missing: string; repeated: string }[];

/** [1,2,3,5,7,8] → "1–3, 5, 7–8" */
export function compressRanges(nums: number[]): string {
  const sorted = [...new Set(nums)].sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    parts.push(j === i ? String(sorted[i]) : `${sorted[i]}–${sorted[j]}`);
    i = j;
  }
  return parts.join(", ");
}

const isPreview = (r: Report) => /preview/i.test(`${r.performance ?? ""} ${r.emailSubject ?? ""}`);

/** Gaps between the lowest and highest number seen, and numbers that appear more than once. */
export function findReportGaps(reports: Report[]): ReportGaps {
  const out: ReportGaps = [];
  for (const label of ["Previews", "Performances"] as const) {
    const nums = reports
      .filter(r => r.performanceNumber != null && isPreview(r) === (label === "Previews"))
      .map(r => r.performanceNumber as number);
    if (!nums.length) continue;
    const seen = new Set<number>();
    const twice = new Set<number>();
    for (const n of nums) (seen.has(n) ? twice : seen).add(n);
    const missing: number[] = [];
    for (let n = Math.min(...nums) + 1; n < Math.max(...nums); n++) if (!seen.has(n)) missing.push(n);
    if (missing.length || twice.size) out.push({ label, missing: compressRanges(missing), repeated: compressRanges([...twice]) });
  }
  return out;
}

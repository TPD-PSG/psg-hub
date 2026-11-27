import { run } from "./lib.mjs";

// Workshop quoting (28 Nov 2026): quote items wrap their lines with a subtotal; lines are material,
// labour or misc, and can be hidden on the client's PDF or shown without a price (still counted);
// a whole item can be left out of the totals and the PDF.
export default () => run("quote-items", async ({ users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [, , , admin] = users;
  let qid = null;
  const a = await login(admin.email);
  try {
    const q = await import("../lib/quotes.ts");
    ok(q.defaultKind("Coffin refit", "days") === "labour" && q.defaultKind("Coffin refit", "sheets") === "material" && q.defaultKind("Coffin refit", "each") === "misc" && q.defaultKind("Timber", "each") === "material", "a line's type is worked out from its unit or section");
    const t = q.quoteTotals([{ quantity: 1, unitCost: 50, unitPrice: 100 }, { quantity: 2, unitCost: 10, unitPrice: 40, leaveOut: true }], 20);
    ok(t.net === 100 && t.cost === 50 && t.gross === 120, "items left out don't count in the totals");
    const p = q.parseQuoteLines([
      { section: "Option B", description: "Extra flat", quantity: 1, unitPrice: 300, leaveOut: true },
      { section: "option b", description: "Paint", quantity: 1, unitPrice: 50 },
      { section: "Main", description: "Fixings", quantity: 1, unitPrice: 20, hidePrice: true, kind: "material" },
    ]);
    ok(p.lines[1].leaveOut === true && p.lines[2].leaveOut === false, "leaving out is per item: every line of the item goes");
    ok(p.lines[2].hidePrice === true && p.lines[2].kind === "material" && p.lines[0].kind === "misc", "line type and mutes are kept");

    let r = await a("/api/quotes", { method: "POST", body: JSON.stringify({ title: "QI test quote" }) });
    qid = (await r.json()).id;
    r = await a(`/api/quotes/${qid}`, { method: "PUT", body: JSON.stringify({ lines: [
      { section: "Coffin Refit", description: "Labour", quantity: 2, unit: "days", unitCost: 200, unitPrice: 300, kind: "labour" },
      { section: "Coffin Refit", description: "Screws", quantity: 1, unit: "each", unitCost: 5, unitPrice: 10, hideLine: true },
      { section: "Coffin Refit", description: "Hinges", quantity: 2, unit: "each", unitCost: 5, unitPrice: 15, hidePrice: true, kind: "material" },
      { section: "Option: lining", description: "Velvet", quantity: 3, unit: "m", unitCost: 10, unitPrice: 20, leaveOut: true },
    ] }) });
    const saved = await r.json();
    const by = d => saved.lines.find(l => l.description === d);
    ok(r.status === 200 && by("Labour").kind === "labour" && by("Screws").hideLine && by("Hinges").hidePrice && by("Velvet").leaveOut, "a quote saves each line's type and mutes");
    ok(saved.totals?.net === 640 || q.quoteTotals(saved.lines, saved.vatRate).net === 640, "hidden and price-less lines still count; the left-out item doesn't (£640)");
  } catch (err) {
    ok(false, `threw: ${err instanceof Error ? err.message : err}`);
  } finally {
    if (qid) await a(`/api/quotes/${qid}`, { method: "DELETE" });
  }
});

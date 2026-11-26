import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { parsePerms, canAccess } from "@/lib/permissions";

// Which module each API area belongs to. `read` lists modules that may also GET it
// (e.g. a production's budget picks a client from BD). "staff" = admin or member only.
type Rule = { prefixes: string[]; write: string[]; read?: string[]; staff?: boolean };
const PRODUCTION_AREAS = [
  "/api/productions", "/api/budget-lines", "/api/budget-expenses", "/api/call-sheets", "/api/call-sheet-entries",
  "/api/hotel-bookings", "/api/hotels", "/api/production-", "/api/show-reports", "/api/meetings", "/api/key-dates",
  "/api/hs-documents", "/api/tour-stops", "/api/events",
];
const RULES: Rule[] = [
  { prefixes: ["/api/crew", "/api/staff-assignments", "/api/budget-reallocation", "/api/haulage"], write: ["productions"], staff: true },
  { prefixes: PRODUCTION_AREAS, write: ["productions"] },
  { prefixes: ["/api/bd-tasks", "/api/opportunities"], write: ["bd"] },
  // Quotes and jobs: BD work, PSG staff only (the routes check staff too)
  { prefixes: ["/api/quotes", "/api/quote-templates"], write: ["bd"], staff: true },
  // Jobs: any PSG staff can see them and log their own days; money is limited in the routes
  { prefixes: ["/api/jobs"], write: ["productions", "bd", "finance"], staff: true },
  { prefixes: ["/api/clients"], write: ["bd"], read: ["bd", "productions"] },
  // Entities: read by BD, productions and finance; the routes themselves only let admins write
  { prefixes: ["/api/entities"], write: ["bd"], read: ["bd", "productions", "finance"] },
  { prefixes: ["/api/invoices", "/api/invoice-todos", "/api/finance", "/api/expenses"], write: ["finance"] },
  { prefixes: ["/api/extract-invoice", "/api/spend-documents"], write: ["finance", "productions"] },
  { prefixes: ["/api/sales"], write: ["sales"] },
  { prefixes: ["/api/marketing"], write: ["marketing"] },
  { prefixes: ["/api/roadmap"], write: ["roadmap"] },
  { prefixes: ["/api/property"], write: ["property"] },
  { prefixes: ["/api/suppliers"], write: ["suppliers"] },
  { prefixes: ["/api/fun"], write: ["fun"] },
  // Ask Me Anything: the policy documents and the paid Q&A (clients don't have this module)
  { prefixes: ["/api/knowledge-docs"], write: ["ask"] },
  { prefixes: ["/api/tasks", "/api/task-lists"], write: ["tasks", "productions"] },
  { prefixes: ["/api/venues", "/api/venue-contacts", "/api/venue-documents"], write: ["venues"], read: ["venues", "productions"] },
];

// Upload size caps, checked before any route reads the body
const MB = 1024 * 1024;
function maxBodyBytes(pathname: string): number {
  if (pathname === "/api/users/me/avatar" || pathname.endsWith("/logo")) return 5 * MB;
  if (pathname === "/api/venues/import-pdfs") return 100 * MB; // several PDFs at once
  if (pathname.startsWith("/api/integrations/")) return 1 * MB; // JSON only
  if (/^\/api\/productions\/\d+\/(documents|hs-documents)$/.test(pathname)) return 100 * MB; // drawings, packs
  return 25 * MB;
}

function moduleDenied(pathname: string, method: string, user: { role?: string; permissions?: string | null }): boolean {
  const role = user.role ?? "member";
  if (role === "admin") return false;
  const rule = RULES.find(r => r.prefixes.some(p => pathname === p || pathname.startsWith(p.endsWith("-") ? p : p + "/")));
  if (!rule) return false;
  if (rule.staff && role !== "member") return true;
  const perms = parsePerms(user.permissions);
  const allowed = method === "GET" || method === "HEAD" ? (rule.read ?? rule.write) : rule.write;
  return !allowed.some(m => canAccess(perms, m, role));
}

// Next 16 "proxy" (formerly middleware): runs before every request, on the Node.js runtime
export const proxy = auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  if (req.method !== "GET" && req.method !== "HEAD" && pathname.startsWith("/api/")) {
    const len = Number(req.headers.get("content-length") ?? 0);
    const max = maxBodyBytes(pathname);
    // A body sent in chunks states no size, so the cap above can't see it: refuse it (browsers
    // always send the size; audit round 2)
    if (!req.headers.get("content-length") && /chunked/i.test(req.headers.get("transfer-encoding") ?? "")) {
      return NextResponse.json({ error: "Send the request with its size" }, { status: 411 });
    }
    if (len > max) {
      return NextResponse.json({ error: `File too large (max ${Math.round(max / MB)} MB)` }, { status: 413 });
    }
  }

  // Routes that guard themselves: invite links (token), cron jobs (shared secret),
  // Night Run and x-over venue sync (bearer tokens, checked in lib/night-run-sync.ts and lib/xover-sync.ts)
  const selfGuarded =
    pathname.startsWith("/invite/") ||
    pathname.startsWith("/api/integrations/night-run/") ||
    pathname.startsWith("/api/integrations/x-over/") ||
    pathname.startsWith("/api/invites/") ||
    pathname === "/api/notify/daily" ||
    pathname === "/api/backup";
  if (selfGuarded) return NextResponse.next();

  // Allow auth routes and public assets
  if (pathname.startsWith("/api/auth") || pathname === "/api/users/public" || pathname.startsWith("/_next") || pathname === "/login" || pathname.startsWith("/toolbox-talk") || pathname.startsWith("/report-incident/") || pathname.startsWith("/api/report-incident/") || pathname.startsWith("/api/productions/") && pathname.endsWith("/toolbox-signatures") || pathname.startsWith("/api/productions/") && pathname.endsWith("/toolbox-qr") || pathname.startsWith("/api/productions/") && pathname.endsWith("/toolbox-info") || pathname === "/api/show-reports/ingest") {
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/api/") && moduleDenied(pathname, req.method, (req.auth?.user ?? {}) as { role?: string; permissions?: string | null })) {
    return NextResponse.json({ error: "Your account doesn't have access to this area" }, { status: 403 });
  }

  return NextResponse.next();
});

export default proxy;

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|psg-logo.png).*)"],
};

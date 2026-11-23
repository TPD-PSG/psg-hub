"use client";

import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";

// The layout passes the session it read on the server, so useSession() has the user from the very
// first render. Without it every page starts as "signed out" for a moment: menus and tiles flicker,
// and the Director page's admin check bounced admins back to the dashboard.
export default function AuthProvider({ children, session }: { children: React.ReactNode; session: Session | null }) {
  return <SessionProvider session={session}>{children}</SessionProvider>;
}

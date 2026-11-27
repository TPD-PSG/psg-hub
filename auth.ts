import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, resetRateLimit } from "@/lib/rate-limit";
import { headers } from "next/headers";

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const headersList = await headers();
        // The left-most X-Forwarded-For entry is whatever the client sent; Railway's proxy appends the real one last
        const ip = headersList.get("x-forwarded-for")?.split(",").pop()?.trim() || headersList.get("x-real-ip") || "unknown";
        const email = String(credentials.email).trim().toLowerCase();
        const byIp = checkRateLimit(`ip:${ip}`);
        const byEmail = checkRateLimit(`email:${email}`);
        const allowed = byIp.allowed && byEmail.allowed;
        const retryAfterMs = Math.max(byIp.retryAfterMs, byEmail.retryAfterMs);
        if (!allowed) {
          const minutes = Math.ceil(retryAfterMs / 60000);
          throw new Error(`Too many login attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`);
        }

        const user = await prisma.user.findUnique({
          where: { email: String(credentials.email) },
        });
        if (!user) return null;
        const valid = await compare(String(credentials.password), user.passwordHash);
        if (!valid) return null;
        if (user.deactivatedAt) return null; // deactivated by an admin

        resetRateLimit(`ip:${ip}`);
        resetRateLimit(`email:${email}`);
        return { id: String(user.id), name: user.name, email: user.email, role: user.role, permissions: user.permissions, avatarUrl: user.avatarUrl ?? null };
      },
    }),
  ],
  pages: { signIn: "/login" },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        // authorize() above returns these extra fields alongside the standard ones
        const u = user as { role?: string; permissions?: string | null; avatarUrl?: string | null };
        token.role = u.role;
        token.id = user.id;
        token.permissions = u.permissions ?? null;
        token.avatarUrl = u.avatarUrl ?? null;
        token.permissionsCheckedAt = Date.now();
      }
      if (trigger === "update" && session) {
        if (session.avatarUrl !== undefined) token.avatarUrl = session.avatarUrl;
        // Never take role/permissions from the browser — re-read them from the database instead
        token.permissionsCheckedAt = 0;
      }
      // Re-fetch role + permissions from DB at most once every 5 minutes
      const FIVE_MIN = 5 * 60 * 1000;
      const checkedAt = (token.permissionsCheckedAt as number) ?? 0;
      if (token.id && Date.now() - checkedAt > FIVE_MIN) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: Number(token.id) },
            select: { role: true, permissions: true, avatarUrl: true, deactivatedAt: true },
          });
          // Deleted or deactivated since they signed in: end the session
          if (!dbUser || dbUser.deactivatedAt) return null;
          if (dbUser) {
            token.role = dbUser.role;
            token.permissions = dbUser.permissions ?? null;
            token.avatarUrl = dbUser.avatarUrl ?? null;
          }
        } catch {}
        token.permissionsCheckedAt = Date.now();
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        const u = session.user as { role?: unknown; id?: unknown; permissions?: unknown; avatarUrl?: unknown };
        u.role = token.role;
        u.id = token.id;
        u.permissions = token.permissions ?? null;
        u.avatarUrl = token.avatarUrl ?? null;
      }
      return session;
    },
  },
});

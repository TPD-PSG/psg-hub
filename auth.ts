import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await prisma.user.findUnique({
          where: { email: String(credentials.email) },
        });
        if (!user) return null;
        const valid = await compare(String(credentials.password), user.passwordHash);
        if (!valid) return null;
        return { id: String(user.id), name: user.name, email: user.email, role: user.role, permissions: user.permissions, avatarUrl: user.avatarUrl ?? null };
      },
    }),
  ],
  pages: { signIn: "/login" },
  callbacks: {
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.role = (user as any).role;
        token.id = user.id;
        token.permissions = (user as any).permissions ?? null;
        token.avatarUrl = (user as any).avatarUrl ?? null;
      }
      if (trigger === "update" && session) {
        if (session.avatarUrl !== undefined) token.avatarUrl = session.avatarUrl;
        if (session.permissions !== undefined) token.permissions = session.permissions;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).id = token.id;
        (session.user as any).permissions = token.permissions ?? null;
        (session.user as any).avatarUrl = token.avatarUrl ?? null;
      }
      return session;
    },
  },
});

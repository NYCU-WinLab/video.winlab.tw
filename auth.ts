import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { eq } from "drizzle-orm";
import { isBootstrapAdmin, normalizeEmail } from "@/lib/access";
import { db } from "@/lib/db";
import { findUser, verifyLoginCode } from "@/lib/login-codes";
import { users } from "@/lib/schema";

/** Bootstrap admins never need an invitation: they are inserted into the allow
 * list the first time they sign in, so ADMIN_EMAILS alone is enough to get in. */
async function allowListRow(email: string, name?: string | null) {
  const address = normalizeEmail(email);
  if (!address) return null;
  const existing = await findUser(address);
  if (existing) {
    if (!existing.name && name) {
      await db.update(users).set({ name }).where(eq(users.email, address));
      return { ...existing, name };
    }
    return existing;
  }
  if (!isBootstrapAdmin(address)) return null;
  const row = {
    email: address,
    name: name ?? null,
    role: "admin",
    createdAt: Date.now(),
  };
  await db.insert(users).values(row).onConflictDoNothing();
  return row;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google,
    Credentials({
      id: "email-pin",
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        code: { label: "Code", type: "text" },
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const code = credentials?.code;
        if (typeof email !== "string" || typeof code !== "string") return null;
        const user = await verifyLoginCode(email, code);
        if (!user) return null;
        return { id: user.email, email: user.email, name: user.name ?? user.email };
      },
    }),
  ],
  // The error page is the login page so a rejected sign-in lands somewhere
  // that explains itself instead of on the Auth.js default page.
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    async signIn({ user }) {
      return (await allowListRow(user.email ?? "", user.name)) !== null;
    },
    async jwt({ token }) {
      const row = await allowListRow(token.email ?? "", token.name);
      // Dropping someone from the allow list ends their session on the next
      // request: returning null clears the session cookie.
      if (!row) return null;
      token.isAdmin = row.role === "admin" || isBootstrapAdmin(row.email);
      return token;
    },
    session({ session, token }) {
      session.user.isAdmin = token.isAdmin === true;
      return session;
    },
  },
});

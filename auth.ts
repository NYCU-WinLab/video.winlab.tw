import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { allowListRow, isBootstrapAdmin } from "@/lib/access";
import { verifyLoginCode } from "@/lib/login-codes";

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

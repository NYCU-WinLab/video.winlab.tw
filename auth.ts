import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { allowListRow, isBootstrapAdmin } from "@/lib/access";
import { checkPassword } from "@/lib/password";
import { consumeSigninTicket } from "@/lib/webauthn";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google,
    Credentials({
      id: "password",
      name: "Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") return null;

        const result = await checkPassword(email, password);
        if (!result.ok) return null;
        // The allow list has the last word, even for a correct password.
        const row = await allowListRow(result.user.email, result.user.name);
        if (!row) return null;
        return { id: row.email, email: row.email, name: row.name ?? row.email };
      },
    }),
    Credentials({
      id: "passkey",
      name: "Passkey",
      credentials: { ticket: { label: "Ticket", type: "text" } },
      // The assertion itself is verified by /api/auth/passkey/authenticate, which
      // hands out a short-lived single-use ticket. Without one this provider
      // cannot mint a session.
      async authorize(credentials) {
        const ticket = credentials?.ticket;
        if (typeof ticket !== "string" || !ticket) return null;
        const row = await consumeSigninTicket(ticket, "passkey");
        if (!row) return null;
        const user = await allowListRow(row.email);
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

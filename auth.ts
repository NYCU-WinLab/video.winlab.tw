import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const adminEmails = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  pages: { signIn: "/login" },
  callbacks: {
    jwt({ token }) {
      token.isAdmin = adminEmails.includes((token.email ?? "").toLowerCase());
      return token;
    },
    session({ session, token }) {
      session.user.isAdmin = token.isAdmin === true;
      return session;
    },
  },
});

import type { NextAuthConfig } from "next-auth";

export default {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.restaurantId = (user as { restaurantId?: string }).restaurantId;
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
    session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        (session.user as { restaurantId?: string }).restaurantId =
          token.restaurantId as string;
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

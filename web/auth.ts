import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import sql from "@/lib/db";
import authConfig from "./auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const rows = await sql(
          "SELECT id, name, email, password_hash, restaurant_id, role FROM users WHERE email = $1",
          [credentials.email]
        );
        const user = rows[0];
        if (!user || !user.password_hash) return null;

        const valid = await compare(
          credentials.password as string,
          user.password_hash as string
        );
        if (!valid) return null;

        return {
          id: user.id as string,
          name: user.name as string,
          email: user.email as string,
          restaurantId: user.restaurant_id as string,
          role: user.role as string,
        };
      },
    }),
  ],
});

import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/db";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  session: {
    strategy: "jwt", // Use JWT for session to avoid database lookups on every request if preferred, OR "database"
  },
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        // @ts-expect-error - id is missing in default type
        session.user.id = token.sub;
      }
      return session;
    },
  },
};

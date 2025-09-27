// lib/auth.ts
import type { NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  session: {
    // You can use "database" for server-side sessions.
    // If you prefer "jwt", you can—but the adapter still creates users/accounts.
    strategy: "database",
  },
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_ID ?? "your_client_id",
      clientSecret: process.env.GITHUB_SECRET ?? "your_client_secret",
      // Important for localhost dev:
      // Make sure your GitHub OAuth App has the callback:
      // http://localhost:3000/api/auth/callback/github
    }),
  ],
  pages: {
    signIn: "/signin", // your custom sign-in page
  },
  callbacks: {
    // Put the database user.id into session for convenience
    async session({ session, user }) {
      if (session.user) {
        (session.user as any).id = user.id;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET, // must be set
};

import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
// You can add Google/Auth0/etc later
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };

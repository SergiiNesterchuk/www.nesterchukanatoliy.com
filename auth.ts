import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

function getAdapter() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return undefined; // No DB at build time
  const pool = new pg.Pool({ connectionString });
  const client = new PrismaClient({ adapter: new PrismaPg(pool) });
  return PrismaAdapter(client);
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: getAdapter(),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
    Resend({
      apiKey: process.env.RESEND_API_KEY || "",
      from: `${process.env.EMAIL_FROM_NAME || "Магазин"} <${process.env.EMAIL_FROM || "noreply@example.com"}>`,
    }),
  ],
  pages: {
    signIn: "/account/login",
    verifyRequest: "/account/verify",
    error: "/account/login",
  },
  callbacks: {
    session({ session, user }) {
      if (session.user && user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
  debug: process.env.NODE_ENV === "development",
  trustHost: true,
});

import { betterAuth } from "better-auth"
import { mongodbAdapter } from "better-auth/adapters/mongodb"
import { MongoClient } from "mongodb"
import { nextCookies } from "better-auth/next-js"
import { emailOTP, username } from "better-auth/plugins"
import { dash } from "@better-auth/infra"
import nodemailer from "nodemailer"
import { passwordResetEmailHtml, verificationOtpEmailHtml } from '@/lib/email-templates'

const MONGODB_URI = process.env.MONGODB_URI

if (!MONGODB_URI) {
  throw new Error("Missing MONGODB_URI environment variable.")
}

// Global caching for the raw MongoClient to survive Next.js / Vercel Serverless re-execution
let client: MongoClient

if (process.env.NODE_ENV === "production") {
  client = new MongoClient(MONGODB_URI)
} else {
  const globalWithMongo = global as typeof globalThis & {
    _mongoClient?: MongoClient
  }
  if (!globalWithMongo._mongoClient) {
    globalWithMongo._mongoClient = new MongoClient(MONGODB_URI)
  }
  client = globalWithMongo._mongoClient
}

// Explicitly connect to guarantee connection in Vercel Serverless before operations run
const db = client.db()

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
})

export const auth = betterAuth({
  // 1. Convert baseURL from a rigid string into a dynamic allowed hosts engine
  baseURL: {
    allowedHosts: [
      "localhost:3000",
      "127.0.0.1:3000",
      "habit-flow-9684.vercel.app", // Your main canonical domain
      "*.vercel.app"                 // Wildcard fallback to automatically catch all random deployment hashes
    ],
    // Force standard HTTPS encryption protocol matching across your live server containers
    protocol: process.env.NODE_ENV === "development" ? "http" : "https"
  },
  database: mongodbAdapter(db),
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "USER",
        required: false
      }
    }
  },
  // 2. Expand trusted origins to cover the root wildcard as well
  trustedOrigins: [
    "https://habit-flow-9684.vercel.app",
    "https://*.vercel.app",
    "http://localhost:3000"
  ],
  plugins: [
    dash(),
    username(),
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        console.log(`[Better Auth] Sending ${type} OTP to ${email}: ${otp}`)

        if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
          await transporter.sendMail({
            from: `"HabytFlow" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "Your HabytFlow Verification Code",
            text: `Your HabytFlow verification code is:${otp}
                  This code expires shortly.
        If you didn't request this code, you can safely ignore this email.
            `,html: verificationOtpEmailHtml(otp),
          });
        }
      }
    }),
    nextCookies(),
  ],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,

    revokeSessionsOnPasswordReset: true,

    resetPasswordTokenExpiresIn: 300, // 5 minutes

    async sendResetPassword({ user, url }) {
      try {
        await transporter.sendMail({
          from: `"HabytFlow" <${process.env.EMAIL_USER}>`,
          to: user.email,
          subject: "Reset your HabytFlow password",

          text: `
          Hello ${user.name ?? "there"},
          You requested to reset your HabytFlow password.
          Reset your password here:
          ${url}
          
          This link expires in 5 minutes.

          If you didn't request this reset, you can safely ignore this email.
                `,

                    html: passwordResetEmailHtml(user.name ?? "there", url),
                });
              } catch (error) {
                console.error("Failed to send password reset email:", error);
                throw error;
              }
            },

    async onPasswordReset({ user }) {
      console.log(
        `[Better Auth] Password reset completed for ${user.email}`
      );
    },
  },
  emailVerification: {
    requireVerification: true,
    autoSignInAfterVerification: true,
    sendOnSignUp: false
  },
  advanced: {
    // Force cross-site secure cookie protocols natively on live domains
    useSecureCookies: process.env.NODE_ENV === "production",
    defaultTheme: "dark",
    ipAddress: {
      ipAddressHeaders: ["x-vercel-forwarded-for", "x-forwarded-for"],
    },
  }
})
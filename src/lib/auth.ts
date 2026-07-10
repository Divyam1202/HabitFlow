import { betterAuth } from "better-auth"
import { mongodbAdapter } from "better-auth/adapters/mongodb"
import { MongoClient } from "mongodb"
import { nextCookies } from "better-auth/next-js"
import { emailOTP, username } from "better-auth/plugins"
import { dash } from "@better-auth/infra"
import nodemailer from "nodemailer"

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
            `,html: `
              <div style="font-family: Arial, Helvetica, sans-serif; max-width:600px; margin:0 auto; padding:32px; color:#111827;">
                <h2 style="margin-bottom:8px;">HabytFlow Verification</h2>
                <p>Hello,</p>
                <p>Use the verification code below to continue signing in or creating your account.</p>
                <div style="
                  margin:32px 0;
                  padding:20px;
                  background:#f4f4f5;
                  border:1px solid #e4e4e7;
                  text-align:center;
                  border-radius:8px;
                ">
                  <span style="
                    font-size:32px;
                    font-weight:700;
                    letter-spacing:10px;
                  ">
                    ${otp}
                  </span>
                </div>
                <p>This code will expire shortly.</p>
                <p>If you didn't request this verification code, you can safely ignore this email.</p>
                <hr style="margin:32px 0; border:none; border-top:1px solid #e5e7eb;" />
                <p style="font-size:12px; color:#6b7280;">
                  © ${new Date().getFullYear()} HabytFlow
                </p>
              </div>
            `,
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

                html: `
                  <!DOCTYPE html>
                  <html>
                  <head>
                  <meta charset="utf-8">
                  <title>Reset Password</title>
                  </head>
                  <body style="margin:0;padding:40px;background:#f5f5f5;font-family:Arial,sans-serif;">

                  <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                  <td align="center">

                  <table width="600" cellpadding="0" cellspacing="0"
                  style="background:#ffffff;border-radius:10px;padding:40px;">

                  <tr>
                  <td>

                  <h1 style="margin:0 0 16px;color:#111;">
                  HabytFlow
                  </h1>

                  <h2 style="margin:0 0 24px;color:#222;">
                  Reset your password
                  </h2>

                  <p style="font-size:16px;color:#444;">
                  Hello ${user.name ?? "there"},
                  </p>

                  <p style="font-size:16px;color:#444;line-height:1.6;">
                  We received a request to reset your HabytFlow password.
                  Click the button below to continue.
                  </p>

                  <div style="margin:40px 0;text-align:center;">

                  <a
                  href="${url}"
                  style="
                  background:#111;
                  color:#fff;
                  padding:14px 30px;
                  text-decoration:none;
                  border-radius:6px;
                  font-weight:bold;
                  display:inline-block;
                  ">

                  Reset Password

                  </a>

                  </div>

                  <p style="font-size:14px;color:#666;">
                  This link expires in
                  <strong>5 minutes</strong>.
                  </p>

                  <p style="font-size:14px;color:#666;">
                  If you didn't request this password reset,
                  you can safely ignore this email.
                  </p>

                  <hr style="margin:32px 0;border:none;border-top:1px solid #eee;">

                  <p style="font-size:12px;color:#999;">
                  © ${new Date().getFullYear()} HabytFlow
                  </p>

                  </td>
                  </tr>

                  </table>

                  </td>
                  </tr>
                  </table>

                  </body>
                  </html>
                        `,
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
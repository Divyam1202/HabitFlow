'use client'

import React, { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { motion } from 'framer-motion'

const UniverseBackground = () => {
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => {
    setMounted(true)
  }, [])

  const stars = useMemo(() => {
    return Array.from({ length: 80 }).map((_, i) => {
      const randomX = (Math.sin(i * 123) * 0.5 + 0.5) * 100
      const randomY = (Math.cos(i * 321) * 0.5 + 0.5) * 100
      const randomSize = (Math.sin(i * 456) * 0.5 + 0.5) * 1.5 + 0.5
      const randomDuration = (Math.sin(i * 789) * 0.5 + 0.5) * 4 + 3
      const randomDelay = (Math.sin(i * 987) * 0.5 + 0.5) * 3
      
      return {
        id: i,
        x: randomX,
        y: randomY,
        size: randomSize,
        duration: randomDuration,
        delay: randomDelay
      }
    })
  }, [])

  if (!mounted) {
    return <div className="fixed inset-0 z-0 bg-background" />
  }

  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-background">
      {stars.map((star) => (
        <motion.div
          key={star.id}
          className="absolute bg-foreground rounded-full"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            opacity: 0.08
          }}
          animate={{
            opacity: [0.08, 0.6, 0.08],
            scale: [1, 1.3, 1]
          }}
          transition={{
            duration: star.duration,
            repeat: Infinity,
            delay: star.delay,
            ease: "easeInOut"
          }}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
    </div>
  )
}

export default function PrivacyPolicyPage() {
  const router = useRouter()

  return (
    <div className="relative min-h-screen bg-background text-foreground/80 font-sans selection:bg-foreground selection:text-background pb-24">
      <UniverseBackground />

      {/* Back Button */}
      <motion.div 
        className="fixed top-8 left-6 md:top-12 md:left-12 z-50"
        initial={{ opacity: 0, x: -10 }} 
        animate={{ opacity: 1, x: 0 }} 
        transition={{ duration: 0.8 }}
      >
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-zinc-500 hover:text-foreground uppercase tracking-widest text-xs font-bold transition-colors group"
        >
          <ArrowLeft size={16} className="transform group-hover:-translate-x-1 transition-transform" /> Back
        </button>
      </motion.div>

      {/* Content wrapper */}
      <div className="relative z-10 max-w-3xl mx-auto px-6 pt-32 md:pt-40">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <span className="text-xs font-panchang tracking-[0.4em] uppercase bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent block mb-4">
            Legal & Compliance
          </span>
          <h1 
            style={{ fontVariationSettings: '"wdth" 130, "wght" 800' }}
            className="text-4xl sm:text-5xl md:text-6xl text-foreground font-panchang tracking-tight mb-6"
          >
            Privacy Policy
          </h1>
          <p className="text-zinc-500 text-sm mb-12">
            Last updated: June 17, 2026
          </p>

          <div className="h-px bg-border w-full mb-12" />

          {/* Legal Copy */}
          <div className="space-y-10 text-sm md:text-base leading-relaxed text-muted-foreground">
            
            <section>
              <h2 className="text-foreground text-lg md:text-xl font-semibold mb-4">1. Introduction</h2>
              <p>
                Welcome to HabytFlow. We are committed to protecting your privacy and security. This Privacy Policy describes how we collect, use, and process your personal information when you use our proprietary habit-tracking and productivity platform. By accessing or using HabytFlow, you agree to the collection and use of information in accordance with this policy.
              </p>
            </section>

            <section>
              <h2 className="text-foreground text-lg md:text-xl font-semibold mb-4">2. Information We Collect</h2>
              <p className="mb-4">
                We collect information directly from you and automatically through your use of the service to operate, maintain, improve, secure, and personalize HabytFlow.
              </p>
              <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                <li>
                  <strong className="text-foreground">Account Information:</strong> When you register an account, we collect credentials such as your email address and authentication details provided through Better Auth.
                </li>
                <li>
                  <strong className="text-foreground">Habit, Streak, and Progress Data:</strong> We collect and store data related to habits you create, tracking metrics, logs, completion statuses, streak counts, and progress statistics.
                </li>
                <li>
                  <strong className="text-foreground">Device and Usage Information:</strong> We collect details about the device you use to access HabytFlow, including your IP address, browser type, operating system version, and general interaction metrics with the application interface.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-foreground text-lg md:text-xl font-semibold mb-4">3. Cookies and Session Data</h2>
              <p>
                To provide secure sessions, authenticate users, and optimize user experience, we utilize cookies and local session storage technologies. These files are necessary for managing user logins, securing account credentials, and preserving your profile preferences. You can configure your browser to reject cookies, but doing so may limit your access to certain functions of the platform.
              </p>
            </section>

            <section>
              <h2 className="text-foreground text-lg md:text-xl font-semibold mb-4">4. Analytics and Performance Monitoring</h2>
              <p>
                We use secure analytics and monitoring tools to track app performance, error rates, and user interaction patterns. This data helps us debug technical issues, analyze usage statistics, and refine the interface design. All analytics information is treated with strict security controls and is utilized internally to optimize system stability.
              </p>
            </section>

            <section>
              <h2 className="text-foreground text-lg md:text-xl font-semibold mb-4">5. How We Use Information</h2>
              <p className="mb-4">
                We use the information we collect solely for the purpose of providing and maintaining our service. Specifically, we use your data to:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                <li>Authenticate your identity and manage secure account sessions.</li>
                <li>Display your personalized habit metrics, calendar tracking, and streak history.</li>
                <li>Generate and display daily, weekly, and monthly progress analytics.</li>
                <li>Send transactional email notifications and optional push alerts related to your routines.</li>
                <li>Monitor, detect, and prevent technical bugs, security incidents, or fraudulent use.</li>
              </ul>
              <p className="mt-4 font-semibold text-foreground">
                HabytFlow does not sell personal information to third parties under any circumstances.
              </p>
            </section>

            <section>
              <h2 className="text-foreground text-lg md:text-xl font-semibold mb-4">6. Notifications and Communications</h2>
              <p>
                By registering an account, you consent to receive system-generated transactional communications such as verification links, account updates, security warnings, and data export notifications. You may also opt to receive daily/weekly habit reminders and motivational push alerts, which can be modified or disabled at any time through your profile settings.
              </p>
            </section>

            <section>
              <h2 className="text-foreground text-lg md:text-xl font-semibold mb-4">7. Data Sharing and Third Parties</h2>
              <p>
                We do not share your private account details, habits, or metrics with third-party advertising companies. We may share information with trusted hosting, database providers (such as Neon PostgreSQL), authentication services, and analytics operators strictly to the extent required to execute the platform's core infrastructure.
              </p>
            </section>

            <section>
              <h2 className="text-foreground text-lg md:text-xl font-semibold mb-4">8. Data Security</h2>
              <p>
                We implement reasonable technical and organizational security measures to prevent unauthorized access, alteration, disclosure, or destruction of your personal data. However, please be aware that no security infrastructure can be guaranteed to be completely invulnerable. You are responsible for keeping your account credentials private and securing your local sessions.
              </p>
            </section>

            <section>
              <h2 className="text-foreground text-lg md:text-xl font-semibold mb-4">9. Data Retention and Deletion</h2>
              <p className="mb-4">
                We retain your account details and productivity records for as long as your account remains active. Users retain complete ownership of their habit and productivity data.
              </p>
              <p>
                You have the right to export your data or delete your account at any time through the dashboard settings. Upon initiating an account deletion request, all personal metrics, habits, and user authentication associations will be permanently and securely erased from our active databases.
              </p>
            </section>

            <section>
              <h2 className="text-foreground text-lg md:text-xl font-semibold mb-4">10. Children's Privacy</h2>
              <p>
                HabytFlow is not intended for use by individuals under the age of 13. We do not knowingly collect personal information from children. If you become aware that a child has provided us with personal data, please contact us immediately, and we will take steps to remove it.
              </p>
            </section>

            <section>
              <h2 className="text-foreground text-lg md:text-xl font-semibold mb-4">11. International Users</h2>
              <p>
                As a web-based productivity application, your data may be processed and stored in servers located in the United States and other global infrastructure regions. By using the platform, you consent to the transfer and storage of your data outside your country of residence, under standards that comply with applicable data protection legislation.
              </p>
            </section>

            <section>
              <h2 className="text-foreground text-lg md:text-xl font-semibold mb-4">12. Changes to This Privacy Policy</h2>
              <p>
                We may update our Privacy Policy periodically to reflect shifts in technology, operational guidelines, or legal standards. We will notify you of any adjustments by posting the updated text on this page and updating the "Last updated" timestamp. We encourage you to review this page periodically to remain informed.
              </p>
            </section>

            <section>
              <h2 className="text-foreground text-lg md:text-xl font-semibold mb-4">13. Contact Information</h2>
              <p>
                If you have any questions, concerns, or requests regarding this Privacy Policy, data retention, or your personal information, please contact our privacy team:
              </p>
              <div className="bg-card border border-border rounded-lg p-6 mt-4 text-card-foreground">
                <p className="font-semibold text-foreground">HabytFlow Legal & Privacy</p>
                <p className="text-muted-foreground mt-2">Email: habytflow+privacy@gmail.com</p>
              </div>
            </section>

            <div className="h-px bg-border w-full my-12" />

            {/* Additional Legal Notice */}
            <div className="bg-card/40 border border-border/50 rounded-lg p-6 text-xs md:text-sm text-muted-foreground/60 leading-relaxed space-y-4 tracking-widest uppercase font-bold">
              <p className="font-extrabold text-foreground/80">Additional Legal Notice</p>
              <p>HabytFlow is an original and independently developed software product. Its branding, design, features, and user experience have been created to support its own distinct vision and purpose.</p>
              <p>Any similarities to other applications, products, services, interfaces, workflows, or industry practices are coincidental, functional in nature, or derived from commonly accepted design standards and productivity principles.</p>
              <p>HabytFlow respects the intellectual property rights of all creators, organizations, and trademark holders. Any third-party names, trademarks, logos, or references remain the property of their respective owners and do not imply endorsement, affiliation, or partnership unless explicitly stated.</p>
            </div>

          </div>
        </motion.div>
      </div>
    </div>
  )
}

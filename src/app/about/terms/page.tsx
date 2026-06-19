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

export default function TermsAndConditionsPage() {
  const router = useRouter()

  return (
    <div className="relative min-h-screen bg-background text-foreground/80 font-sans selection:bg-foreground selection:text-background pb-24">
      <UniverseBackground />

      {/* Content wrapper */}
      <div className="relative z-10 max-w-3xl mx-auto px-6 pt-24 md:pt-32">
        {/* Back Button */}
        <motion.div 
          className="mb-8"
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
            Terms & Conditions
          </h1>
          <p className="text-zinc-500 text-sm mb-12">
            Last updated: June 17, 2026
          </p>

          <div className="h-px bg-border w-full mb-12" />

          {/* Legal Copy */}
          <div className="space-y-10 text-sm md:text-base leading-relaxed text-muted-foreground">
            
            <section>
              <h2 className="text-foreground text-lg md:text-xl font-semibold mb-4">1. Acceptance of Terms</h2>
              <p>
                Welcome to HabytFlow. These Terms & Conditions govern your access to and use of the HabytFlow software platform, including any associated features, routines, analytics, profile dashboards, and notifications. By creating an account or using the service, you agree to be bound by these Terms. If you do not agree, please do not access or use the platform.
              </p>
            </section>

            <section>
              <h2 className="text-foreground text-lg md:text-xl font-semibold mb-4">2. Eligibility</h2>
              <p>
                You must be at least 13 years of age to use HabytFlow. By using the service, you represent and warrant that you meet this age requirement, possess the legal capacity to enter into a binding agreement, and are not barred from receiving services under applicable jurisdiction laws.
              </p>
            </section>

            <section>
              <h2 className="text-foreground text-lg md:text-xl font-semibold mb-4">3. User Accounts</h2>
              <p className="mb-4">
                To access certain features of HabytFlow, you must register for an account using email authentication supported by Better Auth.
              </p>
              <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                <li>
                  <strong className="text-foreground">Account Security:</strong> You are solely responsible for maintaining the privacy and security of your account credentials, security sessions, and active cookies. You are fully responsible for all activities that occur under your account.
                </li>
                <li>
                  <strong className="text-foreground">Truthful Information:</strong> You agree to provide accurate, current, and complete information during registration and keep your account details updated.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-foreground text-lg md:text-xl font-semibold mb-4">4. Acceptable Use and Prohibited Activities</h2>
              <p className="mb-4">
                You agree to use HabytFlow only for personal, lawful productivity tracking purposes. You explicitly agree not to engage in any of the following prohibited activities:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                <li>Attempt to bypass authentication mechanisms, probe system vulnerabilities, or disrupt server infrastructure.</li>
                <li>Use automated scripts, bots, scrapers, or indexers to access, extract, or load platform interfaces.</li>
                <li>Upload malicious code, viruses, spyware, or execute denial of service attacks.</li>
                <li>Impersonate any person or entity, or falsely represent your affiliation with the platform or developer.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-foreground text-lg md:text-xl font-semibold mb-4">5. User Content and Data</h2>
              <p className="mb-4">
                Users retain full ownership and intellectual property rights over the custom habit lists, tracking logs, schedule parameters, and personal metrics they input into the platform.
              </p>
              <p>
                By inputting data, you grant HabytFlow a limited, non-exclusive, royalty-free, worldwide license to host, process, store, and transmit your content solely for the purpose of operating, rendering, securing, and improving the features of the service. You may export or permanently delete your data and account at any time through your dashboard settings.
              </p>
            </section>

            <section>
              <h2 className="text-foreground text-lg md:text-xl font-semibold mb-4">6. Service Availability and Modifications</h2>
              <p>
                We strive to maintain continuous uptime and platform stability. However, HabytFlow may update, modify, suspend, restrict, or discontinue certain features, workflows, or sections of the platform at any time, with or without prior notice, to execute security patches, roll out updates, or undergo system maintenance.
              </p>
            </section>

            <section>
              <h2 className="text-foreground text-lg md:text-xl font-semibold mb-4">7. Intellectual Property Rights & Proprietary Software Notice</h2>
              <p className="mb-4">
                HabytFlow is a proprietary software product. All branding, visual layouts, logo assets, Panchang variable typography styling, interactive interfaces, design tokens, codebase files, and workflow systems are owned exclusively by HabytFlow or its licensors, and are protected by copyright, trademark, and intellectual property legislation.
              </p>
              <p className="font-semibold text-foreground">
                All rights are reserved. You are explicitly prohibited from copying, reproducing, reverse engineering, decompiling, redistributing, reselling, sublicensing, or creating derivative works from any portion of the HabytFlow platform or its source code without prior written authorization.
              </p>
            </section>

            <section>
              <h2 className="text-foreground text-lg md:text-xl font-semibold mb-4">8. Third-Party Services</h2>
              <p>
                The service integrates with third-party components (such as hosting nodes, PostgreSQL servers, and authentication libraries) to provide database services, analytics, and session security. Your interactions with these integrations are subject to the respective terms and privacy policies of those operators. HabytFlow does not assume liability for the uptime, performance, or behavior of third-party systems.
              </p>
            </section>

            <section>
              <h2 className="text-foreground text-lg md:text-xl font-semibold mb-4">9. Account Suspension and Termination</h2>
              <p>
                We reserve the right to suspend or terminate your account access to HabytFlow at our sole discretion, without prior notice, for conduct that we believe violates these Terms, harms other users, breaches server security guidelines, or compromises system integrity.
              </p>
            </section>

            <section>
              <h2 className="text-foreground text-lg md:text-xl font-semibold mb-4">10. Professional Disclaimer</h2>
              <p className="font-semibold text-foreground mb-2">
                HabytFlow is strictly a productivity and habit-tracking tool.
              </p>
              <p>
                The platform is designed to assist you with organizing daily routines and visualizing progress metrics. It does not provide medical, psychological, financial, legal, or other professional advice. Any routines, habit guidelines, or analytics data generated by the platform are for informational purposes only. You remain solely responsible for how you interpret and act upon your tracking results, and should consult qualified professionals for any health or lifestyle decisions.
              </p>
            </section>

            <section>
              <h2 className="text-foreground text-lg md:text-xl font-semibold mb-4">11. Disclaimer of Warranties</h2>
              <p>
                HabytFlow is provided on an "as is" and "as available" basis, without warranties of any kind, either express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, non-infringement, or uninterrupted service. We do not warrant that the application will be free of bugs, server latency, security vulnerabilities, or data entry errors.
              </p>
            </section>

            <section>
              <h2 className="text-foreground text-lg md:text-xl font-semibold mb-4">12. Limitation of Liability</h2>
              <p>
                To the maximum extent permitted by applicable law, in no event shall HabytFlow or its operators be liable for any direct, indirect, incidental, special, consequential, or exemplary damages, including but not limited to loss of profits, data corruption, loss of goodwill, or other intangible losses resulting from your use of or inability to use the platform.
              </p>
            </section>

            <section>
              <h2 className="text-foreground text-lg md:text-xl font-semibold mb-4">13. Indemnification</h2>
              <p>
                You agree to defend, indemnify, and hold harmless HabytFlow and its operators from and against any claims, damages, obligations, losses, liabilities, costs, or debt, and expenses (including attorney's fees) arising from your misuse of the platform, violation of these Terms, or infringement of third-party rights.
              </p>
            </section>

            <section>
              <h2 className="text-foreground text-lg md:text-xl font-semibold mb-4">14. Governing Law</h2>
              <p>
                These Terms & Conditions shall be governed by and construed in accordance with the laws of India, without regard to its conflict of law provisions. Any legal disputes or claims arising out of or related to these Terms will be resolved exclusively in the competent courts located in Pune, Maharashtra.
              </p>
            </section>

            <section>
              <h2 className="text-foreground text-lg md:text-xl font-semibold mb-4">15. Changes to Terms</h2>
              <p>
                We reserve the right to modify or replace these Terms & Conditions at any time. We will indicate changes by updating the "Last updated" date at the top of this document. Continued use of the platform after updates have been posted constitutes your acceptance of the revised Terms.
              </p>
            </section>

            <section>
              <h2 className="text-foreground text-lg md:text-xl font-semibold mb-4">16. Contact Information</h2>
              <p>If you have any questions, concerns, or requests regarding these Terms & Conditions, please contact our support team:</p>
              <div className="bg-card border border-border rounded-lg p-6 mt-4 text-card-foreground">
                <p className="font-semibold text-foreground">HabytFlow Legal & Support</p>
                <p className="text-muted-foreground mt-2">Email: habytflow+legal@gmail.com</p>
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

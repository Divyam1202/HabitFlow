'use client'

import React, { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { motion } from 'framer-motion'

// Robust inline SVG for LinkedIn
const LinkedInIcon = () => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="20" 
    height="20" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className="transition-colors duration-200"
  >
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
    <rect width="4" height="12" x="2" y="9"/>
    <circle cx="4" cy="4" r="2"/>
  </svg>
)

// Removed TwinklingDotGrid in favor of static dot grid background

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { 
    opacity: 1, 
    y: 0, 
    transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] as const } 
  }
}

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12
    }
  }
}

export default function AboutPage() {
  const router = useRouter()

  return (
    <div className="relative min-h-screen overflow-hidden">

      <div className="relative z-10 max-w-[900px] mx-auto px-6 pt-12 pb-24 space-y-16">
        
        {/* Back Button */}
        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
          <button 
            onClick={() => router.back()} 
            className="flex items-center gap-2 text-zinc-500 hover:text-white uppercase tracking-widest text-xs font-bold transition-colors group"
          >
            <ArrowLeft size={16} className="transform group-hover:-translate-x-1 transition-transform" /> Back
          </button>
        </motion.div>

        {/* Hero Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] as const }}
          className="space-y-4 text-center md:text-left"
        >
          <h1 
            style={{ fontVariationSettings: '"wdth" 150, "wght" 900' }}
            className="text-6xl md:text-8xl text-white font-panchang leading-none tracking-tight"
          >
            HabytFLow
          </h1>
          <p className="text-lg md:text-xl font-bold tracking-wide text-emerald-400 font-sans">
            Consistency in Motion.
          </p>
        </motion.div>

        {/* Divider */}
        <div className="h-px w-full bg-zinc-900" />

        {/* Main Body (Animated Text Blocks) */}
        <motion.div 
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="space-y-8 text-zinc-400 text-sm md:text-base leading-relaxed max-w-[780px]"
        >
          <motion.p variants={fadeInUp}>
            HabytFlow began with a simple belief: <strong className="text-white">meaningful change is built through consistency.</strong>
          </motion.p>

          <motion.p variants={fadeInUp}>
            Most people don't struggle because they lack goals, ambition, or potential. They struggle because progress is often invisible, motivation is temporary, and the small actions that create long-term results are easy to overlook.
          </motion.p>

          <motion.p variants={fadeInUp} className="text-white font-bold text-base border-l-2 border-emerald-500 pl-4 py-1 bg-emerald-950/10">
            We built HabytFlow to change that.
          </motion.p>

          <motion.p variants={fadeInUp}>
            Habits shape outcomes, but <strong className="text-white">consistency shapes habits.</strong> The challenge isn't knowing what to do—it's doing it often enough for it to matter. That's why HabytFlow exists: to make progress visible, reduce friction, and help you stay focused on what truly moves you forward. Every completed habit, every maintained streak, and every day you show up becomes part of a larger picture. A picture of growth, discipline, and momentum built one action at a time.
          </motion.p>

          <motion.p variants={fadeInUp}>
            We've intentionally designed HabytFlow around clarity and simplicity. <strong className="text-white">No distractions. No unnecessary complexity. No productivity theater.</strong> Just a reliable system that helps you build better routines, stay accountable, and maintain momentum over the long term.
          </motion.p>

          <motion.p variants={fadeInUp}>
            Whether you're improving your health, developing new skills, strengthening discipline, increasing productivity, or creating structure in your daily life, HabytFlow provides a space where consistency becomes measurable and progress becomes visible.
          </motion.p>

          <motion.p variants={fadeInUp} className="text-zinc-300 italic text-base md:text-lg font-medium border-l border-zinc-700 pl-4">
            Because lasting results are rarely created by a single breakthrough. <br />
            They are created by <strong className="text-white">what you do repeatedly.</strong>
          </motion.p>
        </motion.div>

        {/* 3-Column Gen-Z Action Grid */}
        <motion.div 
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 my-12"
        >
          {['Stack Habits.', 'Lock In.', 'Own the Streak.'].map((phrase, i) => (
            <motion.div
              key={phrase}
              variants={fadeInUp}
              whileHover={{ scale: 1.02, y: -2 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="text-center flex items-center justify-center py-8 cursor-pointer group select-none relative"
            >
              {/* Subtle glowing ambient light behind text on hover */}
              <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 blur-2xl transition-all duration-500 pointer-events-none" />
              
              <span 
                style={{ fontVariationSettings: '"wdth" 150, "wght" 900' }}
                className="relative z-10 font-panchang text-2xl md:text-3xl lg:text-4xl text-zinc-500 group-hover:text-white transition-all duration-300 uppercase drop-shadow-none group-hover:drop-shadow-[0_0_10px_rgba(255,255,255,0.25)]"
              >
                {phrase}
              </span>
            </motion.div>
          ))}
        </motion.div>

        {/* Creator / Profile Block */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative w-full"
        >
          {/* The Content Container */}
          <div className="relative z-10 py-8 md:py-16 flex flex-col gap-16 md:gap-20">
            
            {/* Identity Group */}
            <div className="flex flex-col w-fit">
              <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-bold mb-6 font-sans">
                Developed by
              </p>
              
              <div className="space-y-4 mb-8">
                <h3 
                  style={{ fontVariationSettings: '"wdth" 150, "wght" 900' }}
                  className="text-4xl md:text-5xl lg:text-6xl text-white font-panchang leading-none tracking-tight"
                >
                  Divyam Chandak
                </h3>
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <p className="text-lg md:text-xl font-bold uppercase tracking-wider text-cyan-400 font-sans">
                    AI ML Developer
                  </p>
                  
                  <motion.a
                    href="https://www.linkedin.com/in/divyam-chandak/"
                    target="_blank"
                    rel="noopener noreferrer"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="inline-flex items-center gap-2 px-5 py-2.5 border border-zinc-800 bg-black/40 text-zinc-400 hover:bg-white hover:text-black hover:border-white transition-all rounded-md text-sm font-semibold w-fit"
                  >
                    <LinkedInIcon />
                    <span>LinkedIn</span>
                  </motion.a>
                </div>
              </div>
            </div>
            
            {/* Philosophy Group */}
            <div className="flex flex-col">
              <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-bold mb-6 font-sans">
                Philosophy
              </p>
              <div className="border-l-2 border-zinc-800 pl-6 py-1">
                <p className="text-xl md:text-2xl lg:text-3xl text-zinc-200 font-sans tracking-tight leading-relaxed">
                  "Data over delusion.
                  <br />
                  Action over intention."
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Separator */}
        <div className="h-px w-full bg-zinc-900" />

        {/* Independence & Product Integrity / Legal Footer */}
        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="space-y-6"
        >
          <div className="text-zinc-500 text-[11px] md:text-xs leading-relaxed space-y-4 max-w-[800px] text-justify tracking-wide uppercase font-semibold">
            <p>
              HabytFlow is an original and independently developed software product. Its branding, design, features, and user experience have been created to support its own distinct vision and purpose.
            </p>
            <p>
              Any similarities to other applications, products, services, interfaces, workflows, or industry practices are coincidental, functional in nature, or derived from commonly accepted design standards and productivity principles.
            </p>
            <p>
              HabytFlow respects the intellectual property rights of all creators, organizations, and trademark holders. Any third-party names, trademarks, logos, or references remain the property of their respective owners and do not imply endorsement, affiliation, or partnership unless explicitly stated.
            </p>
          </div>

          <div className="pt-6 border-t border-zinc-900 flex flex-col md:flex-row justify-between items-center gap-4 text-zinc-500 text-[11px] md:text-xs uppercase tracking-widest font-black">
            <div>
              © 2026 HabytFlow. All Rights Reserved.
            </div>
            <div className="flex items-center gap-4">
              <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
              <span className="text-zinc-700">·</span>
              <Link href="/terms" className="hover:text-white transition-colors">Terms of Conditions</Link>
            </div>
          </div>
        </motion.div>

      </div>
    </div>
  )
}

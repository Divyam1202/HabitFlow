'use client'

import React, { useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { motion, useScroll, useTransform } from 'framer-motion'

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
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect width="4" height="12" x="2" y="9" />
    <circle cx="4" cy="4" r="2" />
  </svg>
)

const UniverseBackground = () => {
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => {
    setMounted(true)
  }, [])

  const stars = useMemo(() => {
    return Array.from({ length: 150 }).map((_, i) => {
      const randomX = (Math.sin(i * 123) * 0.5 + 0.5) * 100;
      const randomY = (Math.cos(i * 321) * 0.5 + 0.5) * 100;
      const randomSize = (Math.sin(i * 456) * 0.5 + 0.5) * 2 + 1;
      const randomDuration = (Math.sin(i * 789) * 0.5 + 0.5) * 4 + 3;
      const randomDelay = (Math.sin(i * 987) * 0.5 + 0.5) * 3;

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
    return <div className="fixed inset-0 z-0 bg-[#050505]" />
  }

  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-[#050505]">
      {stars.map((star) => (
        <motion.div
          key={star.id}
          className="absolute bg-white rounded-full"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            opacity: 0.1
          }}
          animate={{
            opacity: [0.1, 0.8, 0.1],
            scale: [1, 1.5, 1]
          }}
          transition={{
            duration: star.duration,
            repeat: Infinity,
            delay: star.delay,
            ease: "easeInOut"
          }}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#050505]" />
    </div>
  )
}

const CinematicBlock = ({
  children,
  containerRef
}: {
  children: React.ReactNode
  containerRef: React.RefObject<HTMLDivElement | null>
}) => {
  const targetRef = useRef<HTMLDivElement>(null)

  const { scrollYProgress } = useScroll({
    target: targetRef,
    container: containerRef,
    offset: ["start end", "end start"]
  })

  // Soften and slow down transition ranges for a cleaner cinematic curve
  const opacity = useTransform(scrollYProgress, [0.15, 0.42, 0.58, 0.85], [0, 1, 1, 0])
  const y = useTransform(scrollYProgress, [0.15, 0.42, 0.58, 0.85], [30, 0, 0, -30])
  const filter = useTransform(
    scrollYProgress,
    [0.15, 0.42, 0.58, 0.85],
    ["blur(6px)", "blur(0px)", "blur(0px)", "blur(6px)"]
  )

  return (
    <div
      ref={targetRef}
      className="h-screen w-full flex flex-col items-center justify-center px-6 snap-center select-none"
    >
      <motion.div
        style={{ opacity, y, filter }}
        className="text-center max-w-4xl w-full text-[1.15rem] md:text-[1.7rem] leading-relaxed text-zinc-300 font-medium"
      >
        {children}
      </motion.div>
    </div>
  )
}

export default function AboutPage() {
  const router = useRouter()
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  return (
    <div
      ref={scrollContainerRef}
      className="relative h-screen overflow-y-auto snap-y snap-mandatory scroll-smooth bg-[#050505]"
    >
      <UniverseBackground />

      {/* Back Button - Pinned to absolute top left */}
      <motion.div
        className="fixed top-8 left-6 md:top-12 md:left-12 z-50"
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 1, delay: 3.5 }}
      >
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-zinc-500 hover:text-white uppercase tracking-widest text-xs font-bold transition-colors group"
        >
          <ArrowLeft size={16} className="transform group-hover:-translate-x-1 transition-transform" /> Back
        </button>
      </motion.div>

      {/* Hero Section - Full Screen & Absolute Center */}
      <div className="relative z-10 flex flex-col items-center justify-center h-screen w-full px-6 text-center snap-center">
        <div className="flex flex-col items-center gap-4">
          <h1
            style={{ fontVariationSettings: '"wdth" 150, "wght" 900', perspective: "1000px" }}
            className="text-[4rem] sm:text-7xl md:text-9xl text-white font-panchang leading-none tracking-tighter flex justify-center overflow-visible w-full"
          >
            {"HabytFlow".split("").map((char, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, y: 50, rotateX: -90 }}
                animate={{ opacity: 1, y: 0, rotateX: 0 }}
                transition={{ duration: 0.8, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                style={{ transformOrigin: "bottom" }}
              >
                {char}
              </motion.span>
            ))}
          </h1>

          <div className="text-xs md:text-sm font-panchang tracking-[0.4em] uppercase flex justify-center flex-wrap mt-2 w-full">
            {"CONSISTENCY IN MOTION".split("").map((char, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                  type: "spring",
                  stiffness: 150,
                  damping: 20,
                  delay: 1.6 + i * 0.08
                }}
                className={`inline-block ${char !== " " ? "bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent" : ""}`}
              >
                {char === " " ? "\u00A0" : char}
              </motion.span>
            ))}
          </div>

        </div>

        {/* Scroll Indicator - Pinned to bottom center */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 3.5, duration: 1 }}
          className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center justify-center gap-6"
        >
          <span className="text-[8px] uppercase tracking-[0.4em] text-zinc-500 font-bold font-sans">Scroll</span>
          <motion.div
            className="w-px h-16 bg-zinc-700"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>
      </div>

      {/* Main Content Constraints */}
      <div className="relative z-10 w-full">

        {/* Cinematic Manifesto Blocks */}
        <div className="w-full flex flex-col relative z-10">
          {/* Section 1 */}
          <CinematicBlock containerRef={scrollContainerRef}>
            <p className="text-left md:text-justify max-w-2xl mx-auto w-full">
              HabytFlow began with a simple belief: meaningful change is built through consistency.
            </p>
            <br />
            <p className="text-left md:text-justify max-w-2xl mx-auto w-full">
              Most people don't struggle because they lack goals, ambition, or potential. They struggle because progress is often invisible, motivation is temporary, and the small actions that compound into long-term results are easy to overlook.
            </p>
            <br />
            <span className="text-2xl md:text-4xl text-white font-bold bg-gradient-to-b from-emerald-400 to-cyan-400 bg-clip-text text-transparent block text-center mt-4">
              We built HabytFlow to change that.
            </span>
          </CinematicBlock>

          {/* Section 2 */}
          <CinematicBlock containerRef={scrollContainerRef}>
            <p className="text-left md:text-justify max-w-2xl mx-auto w-full">
              Habits shape outcomes, but <strong className="text-white">consistency shapes habits.</strong> The challenge isn't knowing what to do—it's doing it often enough for it to matter.
            </p>
            <br />
            <p className="text-left md:text-justify max-w-2xl mx-auto w-full">
              That's why HabytFlow exists: to make execution trackable, reduce friction, and help you stay focused on what truly moves you forward.
            </p>
          </CinematicBlock>

          {/* Section 3 */}
          <CinematicBlock containerRef={scrollContainerRef}>
            <p className="text-left md:text-justify max-w-2xl mx-auto w-full">
              Every completed habit, every maintained streak, and every day you show up becomes part of a larger picture. A picture of growth, discipline, and forward drive forged one action at a time.
            </p>
            <br />
            <p className="text-left md:text-justify max-w-2xl mx-auto w-full">
              We've intentionally designed HabytFlow around clarity and simplicity. <strong className="text-white">No distractions, no unnecessary complexity, and a better productivity display.</strong> Just a reliable system that helps you engineer better routines, stay accountable, and maintain momentum over the long term.
            </p>
          </CinematicBlock>

          {/* Section 4 */}
          <CinematicBlock containerRef={scrollContainerRef}>
            <p className="text-left md:text-justify max-w-2xl mx-auto w-full">
              Whether you're improving your health, developing new skills, strengthening discipline, increasing productivity, or establishing structure in your daily life, HabytFlow provides a space where consistency becomes measurable and progress becomes visible.
            </p>
            <br />
            <strong className="text-white text-base sm:text-lg md:text-xl block text-center mt-4">
              Because lasting results are rarely achieved by a single breakthrough.
              <br />
              They are forged by what you do repeatedly.
            </strong>
          </CinematicBlock>

          {/* Section 5 (Action Grid) */}
          <CinematicBlock containerRef={scrollContainerRef}>
            <div className="flex flex-col md:flex-row justify-center items-center gap-12 w-full">
              {['Begin.', 'Rhythm.', 'Elevate.'].map((phrase, i) => (
                <div
                  key={phrase}
                  className="text-center flex items-center justify-center py-8 select-none relative"
                >
                  <motion.div
                    className="absolute inset-0 bg-white/10 blur-2xl rounded-full pointer-events-none"
                    animate={{ opacity: [0.1, 0.6, 0.1], scale: [0.8, 1.3, 0.8] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: i * 0.8 }}
                  />
                  <span
                    style={{ fontVariationSettings: '"wdth" 150, "wght" 900' }}
                    className="relative z-10 font-panchang text-3xl md:text-4xl lg:text-5xl text-white uppercase drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]"
                  >
                    {phrase}
                  </span>
                </div>
              ))}
            </div>
          </CinematicBlock>

          {/* Section 6 (Developed by) */}
          <CinematicBlock containerRef={scrollContainerRef}>
            <div className="flex flex-col items-center gap-8">
              <p className="text-xs md:text-sm uppercase tracking-[0.3em] text-zinc-500 font-bold font-sans">
                Developed by
              </p>
              <h3
                style={{ fontVariationSettings: '"wdth" 150, "wght" 900' }}
                className="text-[clamp(2.5rem,6vw,5rem)] text-white font-panchang leading-none tracking-tight whitespace-nowrap"
              >
                Divyam Chandak
              </h3>
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <p className="text-lg md:text-xl font-bold uppercase tracking-widest bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent font-sans">
                  AI ML Developer
                </p>
                <motion.a
                  href="https://www.linkedin.com/in/divyam-chandak/"
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="inline-flex items-center gap-2 px-6 py-3 border border-zinc-800 bg-black/40 text-zinc-400 hover:bg-white hover:text-black hover:border-white transition-all rounded-md text-sm font-semibold"
                >
                  <LinkedInIcon />
                  <span>LinkedIn</span>
                </motion.a>
              </div>
            </div>
          </CinematicBlock>

          {/* Section 7 (Philosophy) */}
          <CinematicBlock containerRef={scrollContainerRef}>
            <div className="flex flex-col items-center gap-8">
              <p className="text-xs md:text-sm uppercase tracking-[0.3em] text-zinc-500 font-bold font-sans">
                Philosophy
              </p>
              <p className="text-3xl md:text-5xl lg:text-6xl text-white font-sans tracking-tight leading-tight">
                "Data over delusion.
                <br />
                Action over intention."
              </p>
            </div>
          </CinematicBlock>

          {/* Section 8 (Disclaimer & Footer) */}
          <CinematicBlock containerRef={scrollContainerRef}>
            <div className="text-zinc-600 text-sm md:text-base leading-relaxed tracking-widest uppercase font-bold max-w-2xl w-full mx-auto space-y-6 text-left md:text-justify">
              <p>HabytFlow is an original and independently developed software product. Its branding, design, features, and user experience have been created to support its own distinct vision and purpose.</p>
              <p>Any similarities to other applications, products, services, interfaces, workflows, or industry practices are coincidental, functional in nature, or derived from commonly accepted design standards and productivity principles.</p>
              <p>HabytFlow respects the intellectual property rights of all creators, organizations, and trademark holders. Any third-party names, trademarks, logos, or references remain the property of their respective owners and do not imply endorsement, affiliation, or partnership unless explicitly stated.</p>
            </div>
            <div className="flex flex-col items-center gap-4 w-full mx-auto mt-12 text-center select-none">
              {/* Copyright with scroll-like lines on both sides */}
              <div className="flex items-center gap-4 w-full justify-center">
                <div className="h-px bg-zinc-800 flex-grow max-w-[80px]" />
                <span className="text-zinc-400 text-xs md:text-sm uppercase tracking-widest font-black whitespace-nowrap">
                  © 2026 HabytFlow. All Rights Reserved.
                </span>
                <div className="h-px bg-zinc-800 flex-grow max-w-[80px]" />
              </div>

              {/* Links with scroll-like lines on both sides */}
              <div className="flex items-center gap-4 w-full justify-center">
                <div className="h-px bg-zinc-850 flex-grow max-w-[60px]" />
                <div className="flex items-center gap-4 text-zinc-500 text-[10px] md:text-xs uppercase tracking-widest font-black whitespace-nowrap">
                  <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
                  <span className="text-zinc-700">·</span>
                  <Link href="/terms" className="hover:text-white transition-colors">Terms of Conditions</Link>
                </div>
                <div className="h-px bg-zinc-850 flex-grow max-w-[60px]" />
              </div>
            </div>
          </CinematicBlock>
        </div>

      </div>
    </div>
  )
}

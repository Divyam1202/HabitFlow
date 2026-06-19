'use client'

import React, { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion'

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

const DeveloperMarquee = () => {
  return (
    <div className="relative w-full overflow-hidden whitespace-nowrap py-6 select-none my-4">
      <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
      <motion.div
        className="inline-flex gap-16 whitespace-nowrap"
        animate={{ x: [0, "-50%"] }}
        transition={{
          repeat: Infinity,
          ease: "linear",
          duration: 25
        }}
      >
        {/* We repeat the elements twice for a perfect seamless loop */}
        {Array.from({ length: 2 }).map((_, outerIdx) => (
          <div key={outerIdx} className="flex gap-16">
            {Array.from({ length: 4 }).map((_, idx) => (
              <span
                key={idx}
                style={{ fontVariationSettings: '"wdth" 150, "wght" 900' }}
                className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl text-zinc-500/10 dark:text-zinc-800/20 font-panchang tracking-[0.2em] uppercase leading-none"
              >
                DEVELOPER
              </span>
            ))}
          </div>
        ))}
      </motion.div>
    </div>
  )
}

const DeveloperCard = () => {
  const cardRef = useRef<HTMLDivElement>(null)
  const [rotateX, setRotateX] = useState(0)
  const [rotateY, setRotateY] = useState(0)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return
    const card = cardRef.current
    const rect = card.getBoundingClientRect()
    const x = e.clientX - rect.left - rect.width / 2
    const y = e.clientY - rect.top - rect.height / 2
    // Max rotation 15 degrees
    const rx = -(y / (rect.height / 2)) * 15
    const ry = (x / (rect.width / 2)) * 15
    setRotateX(rx)
    setRotateY(ry)
  }

  const handleMouseLeave = () => {
    setRotateX(0)
    setRotateY(0)
  }

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      animate={{ rotateX, rotateY }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      style={{ transformStyle: "preserve-3d", perspective: 1000 }}
      className="relative w-80 bg-card border border-border rounded-xl p-8 flex flex-col items-start select-none cursor-pointer group shadow-xl text-card-foreground"
    >
      {/* Glow background */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl pointer-events-none" />
      
      <div style={{ transform: "translateZ(50px)" }} className="w-full space-y-6">
        <div className="text-left">
          <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1">Architect & Creator</p>
          <h4 className="text-foreground text-2xl font-panchang tracking-tight font-extrabold">Divyam Chandak</h4>
        </div>

        <div className="flex justify-between items-center w-full border-t border-border pt-6">
          <div className="text-left">
            <p className="text-[9px] font-mono text-zinc-650 uppercase tracking-wider mb-0.5">Established</p>
            <p className="text-foreground/80 text-xs font-semibold">June 2027</p>
          </div>

          <a
            href="https://www.linkedin.com/in/divyam-chandak/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-zinc-500 hover:text-foreground uppercase tracking-widest text-[10px] font-bold transition-colors group/link text-left"
          >
            <LinkedInIcon />
            <span>LinkedIn</span>
          </a>
        </div>
      </div>
    </motion.div>
  )
}

const UniverseBackground = () => {
  const [mounted, setMounted] = useState(false)
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
            opacity: 0.1
          }}
          animate={{
            opacity: [0.05, 0.4, 0.05],
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
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
    </div>
  )
}

const CinematicBlock = ({
  children,
  containerRef,
  animateOnScroll = false
}: {
  children: React.ReactNode
  containerRef: React.RefObject<HTMLDivElement | null>
  animateOnScroll?: boolean
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
      className="w-full flex flex-col items-center justify-center py-12 px-6 select-none"
    >
      <motion.div
        style={animateOnScroll ? { opacity, y, filter } : undefined}
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
  const [noteOpen, setNoteOpen] = useState(false)

  return (
    <div
      ref={scrollContainerRef}
      className="relative min-h-screen overflow-x-hidden scroll-smooth bg-background text-foreground"
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
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-zinc-500 hover:text-foreground uppercase tracking-widest text-xs font-bold transition-colors group"
        >
          <ArrowLeft size={16} className="transform group-hover:-translate-x-1 transition-transform" /> Back
        </button>
      </motion.div>

      {/* Hero Section - Full Screen & Absolute Center */}
      <div className="relative z-10 flex flex-col items-center justify-center h-screen w-full px-6 text-center snap-center">
        <div className="flex flex-col items-center gap-4">
          <h1
            style={{ fontVariationSettings: '"wdth" 150, "wght" 900', perspective: "1000px" }}
            className="text-[4rem] sm:text-7xl md:text-9xl text-foreground font-panchang leading-none tracking-tighter flex justify-center overflow-visible w-full"
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
          
          {/* Section: The Engine (Core Features) */}
          <div className="w-full flex flex-col items-center justify-center py-16 px-6 select-none border-t border-border/30">
            <div className="max-w-4xl w-full">
              <p className="text-xs font-panchang tracking-[0.3em] text-zinc-500 font-bold uppercase mb-4 text-center">
                The Engine
              </p>
              <h2
                style={{ fontVariationSettings: '"wdth" 130, "wght" 800' }}
                className="text-2xl sm:text-4xl text-foreground font-panchang tracking-tight mb-12 text-center"
              >
                Core Features
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                  { title: "Intelligent Auth", desc: "Secure account registration and passwordless session states powered by Better Auth." },
                  { title: "Habit Engine", desc: "Create, schedule, and log routines with adaptive calendar configurations." },
                  { title: "Streak Tracking", desc: "Keep momentum alive with real-time consistency metrics and milestone tracking." },
                  { title: "Deep Analytics", desc: "Understand your execution with weekly and monthly progress graphs." },
                  { title: "Reminders & Alerts", desc: "Stay accountable with push notifications and automated transaction emails." },
                  { title: "Data Ownership", desc: "Export details or permanently delete your account directly from the settings." },
                ].map((feature, i) => (
                  <div key={i} className="bg-card border border-border rounded-lg p-6 hover:border-foreground transition-colors duration-200 text-card-foreground">
                    <h4 className="text-foreground font-sans font-bold text-base mb-2">{feature.title}</h4>
                    <p className="text-zinc-500 text-sm font-sans leading-relaxed">{feature.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Merged Manifesto Section */}
          <div className="w-full flex flex-col items-center justify-center py-12 px-6 select-none border-t border-border/30">
            <div className="max-w-2xl mx-auto w-full space-y-6 text-zinc-600 dark:text-zinc-400 text-left leading-relaxed text-sm md:text-base font-sans">
              <p className="text-foreground font-extrabold text-base md:text-lg uppercase tracking-wider text-center">
                THE GAP IS IN THE EXECUTION.
              </p>
              <p>
                Meaningful progress is rarely the result of a single breakthrough. It's built through the small actions we repeat every day—the choices that seem insignificant in the moment but compound into something remarkable over time.
              </p>
              <p>
                Most people already know what they need to do.
              </p>
              <p>
                <strong className="text-foreground font-semibold">HabytFlow was born from that realization.</strong>
              </p>
              <p>
                I wasn't looking for another productivity platform. I was looking for a system that made consistency visible. Something simple enough to use every day, yet powerful enough to reveal the truth about my habits, routines, and progress.
              </p>
              <p className="py-2 text-center">
                <span className="text-sm md:text-base text-foreground font-extrabold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent inline-block font-sans uppercase tracking-wider">
                  A system that measured actions, not intentions.
                </span>
              </p>
              <p>
                What started as a personal tool gradually evolved into HabytFlow.
              </p>
              <p>
                Built alongside my work as an AI & Machine Learning Engineer, HabytFlow was developed through late-night iterations, constant refinement, and a relentless focus on simplicity. Every feature exists because it solves a real problem. Every decision was made with one goal in mind: helping people stay consistent with the things that matter.
              </p>
              <p>
                Just a clear view of the promises you make to yourself—and whether you're keeping them.
              </p>
              <p>
                Today, HabytFlow is more than a habit tracker.
              </p>
              <div className="pl-4 border-l border-border space-y-2 py-1 italic">
                <p>It's a system for accountability.</p>
                <p>A record of consistency.</p>
                <p>A reminder that progress isn't created by what we intend to do, but by what we repeatedly choose to do.</p>
              </div>
              
              <div className="pt-4 text-center">
                <strong className="text-foreground text-base sm:text-lg font-bold block leading-relaxed font-sans">
                  Because lasting results are rarely achieved by a single breakthrough.
                  <br />
                  They are forged by what you do repeatedly.
                </strong>
              </div>
            </div>
          </div>

          {/* Section 5 (Action Grid) */}
          <CinematicBlock containerRef={scrollContainerRef}>
            <div className="flex flex-col md:flex-row justify-center items-center gap-12 w-full">
              {['Define.', 'Execute.', 'Elevate.'].map((phrase, i) => (
                <div
                  key={phrase}
                  className="text-center flex items-center justify-center py-8 select-none relative"
                >
                  <motion.div
                    className="absolute inset-0 bg-foreground/5 blur-2xl rounded-full pointer-events-none"
                    animate={{ opacity: [0.05, 0.3, 0.05], scale: [0.9, 1.1, 0.9] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: i * 0.8 }}
                  />
                  <span
                    style={{ fontVariationSettings: '"wdth" 150, "wght" 900' }}
                    className="relative z-10 font-panchang text-xl md:text-2xl text-foreground uppercase dark:drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]"
                  >
                    {phrase}
                  </span>
                </div>
              ))}
            </div>
          </CinematicBlock>
          {/* Section 5.5 (Developer Note Section) */}
          <div className="relative w-full flex flex-col items-center justify-center py-16 px-6 select-none overflow-hidden border-y border-border/30 border-t">
            {/* Grid mesh background */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />
            
            <div className="relative z-10 max-w-4xl w-full flex flex-col items-center text-center gap-8">
              <h2
                style={{ fontVariationSettings: '"wdth" 150, "wght" 900' }}
                className="text-lg sm:text-2xl md:text-3xl lg:text-4xl text-foreground font-panchang tracking-wider uppercase whitespace-nowrap"
              >
                WE'RE JUST GETTING STARTED.
              </h2>

              <div className="w-full flex flex-col items-center gap-4 mt-2">
                <DeveloperMarquee />
                
                {/* 3D Tilt Developer Card */}
                <DeveloperCard />
              </div>
              
              <button
                onClick={() => setNoteOpen(true)}
                className="px-6 py-3 bg-card border border-border text-foreground font-mono text-xs md:text-sm font-bold tracking-widest uppercase rounded-none hover:bg-foreground hover:text-background hover:border-foreground active:scale-95 transition-all duration-200 mt-4"
              >
                [ A NOTE FROM THE DEVELOPER ]
              </button>
            </div>
          </div>

          {/* Modal Popup for Developer Note */}
          <AnimatePresence>
            {noteOpen && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-black/60 backdrop-blur-md">
                {/* Click outside to close */}
                <div className="absolute inset-0" onClick={() => setNoteOpen(false)} />
                
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  className="relative max-w-2xl w-full max-h-[90vh] md:max-h-[85vh] bg-card border border-border rounded-xl p-6 md:p-10 shadow-2xl z-10 select-text flex flex-col overflow-hidden text-card-foreground"
                >
                  {/* Close Cross Button */}
                  <button
                    onClick={() => setNoteOpen(false)}
                    className="absolute top-5 right-5 p-2 rounded-full border border-border text-zinc-500 hover:text-foreground hover:border-foreground hover:bg-muted transition-all duration-200 z-50"
                    aria-label="Close Note"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>

                  <div className="flex-1 flex flex-col overflow-hidden mt-4 text-left">
                    <div className="space-y-1 pb-4 border-b border-border">
                      <h2 
                        style={{ fontVariationSettings: '"wdth" 140, "wght" 900' }}
                        className="text-foreground text-xl md:text-3xl font-panchang tracking-tight font-extrabold uppercase pr-8"
                      >
                        A NOTE FROM THE ARCHITECT
                      </h2>
                      <p className="text-zinc-500 font-mono text-[10px] md:text-xs uppercase tracking-widest">
                        Thank you for being here.
                      </p>
                    </div>

                    {/* Scrollable container for the letter text */}
                    <div className="flex-1 overflow-y-auto py-6 pr-2 space-y-4 text-zinc-500 dark:text-zinc-400 font-sans text-sm md:text-base leading-relaxed scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                      <p>
                        Every habit completed, every streak maintained, and every commitment honored represents something larger than a number on a screen.
                      </p>
                      <p className="text-foreground font-medium italic">
                        It represents a promise kept.
                      </p>
                      <p>
                        HabytFlow was built with a simple goal: to create a space where progress feels honest. A place where consistency matters more than perfection and where small actions are given the recognition they deserve.
                      </p>
                      <p>
                        Like many people, I've started routines I couldn't maintain, set goals I didn't achieve, and underestimated the power of simply showing up. HabytFlow is the result of those lessons.
                      </p>
                      <p>
                        If this platform helps you stay consistent for one more day, finish one more workout, read one more chapter, or keep one more promise to yourself, then it has already served its purpose.
                      </p>
                      <p>
                        Thank you for trusting HabytFlow to be part of your journey.
                      </p>
                      <p className="text-foreground font-semibold pt-2">
                        Keep showing up.
                      </p>
                    </div>

                    <div className="pt-4 border-t border-border flex justify-between items-baseline text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                      <div>
                        <p className="text-foreground font-bold text-xs">— Divyam Chandak</p>
                        <p className="text-[9px] text-zinc-600 font-semibold mt-0.5">Founder & Developer</p>
                      </div>
                      <span>June 2027</span>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Section 8 (Footer Only) */}
          <div className="w-full flex flex-col items-center justify-center py-12 px-6 select-none">
            <div className="flex flex-col items-center gap-4 w-full mx-auto text-center select-none">
              {/* Copyright with scroll-like lines on both sides */}
              <div className="flex items-center gap-4 w-full justify-center">
                <div className="h-px bg-border flex-grow max-w-[80px]" />
                <span className="text-zinc-650 dark:text-zinc-400 text-xs md:text-sm uppercase tracking-widest font-black whitespace-nowrap">
                  © 2026 HabytFlow. All Rights Reserved.
                </span>
                <div className="h-px bg-border flex-grow max-w-[80px]" />
              </div>

              {/* Links with scroll-like lines on both sides */}
              <div className="flex items-center gap-4 w-full justify-center">
                <div className="h-px bg-border flex-grow max-w-[60px]" />
                <div className="flex items-center gap-4 text-zinc-500 text-[10px] md:text-xs uppercase tracking-widest font-black whitespace-nowrap">
                  <Link href="/about/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
                  <span className="text-zinc-300 dark:text-zinc-700">·</span>
                  <Link href="/about/terms" className="hover:text-foreground transition-colors">Terms of Conditions</Link>
                </div>
                <div className="h-px bg-border flex-grow max-w-[60px]" />
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

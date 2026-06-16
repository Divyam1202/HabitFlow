'use client'

import React, { useEffect, useRef, useState } from 'react'

interface CanvasLoaderProps {
  onComplete: () => void
}

export function CanvasLoader({ onComplete }: CanvasLoaderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [fading, setFading] = useState(false)
  const fadingRef = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = window.innerWidth
    let height = window.innerHeight
    const dpr = window.devicePixelRatio || 1

    const resize = () => {
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = width * dpr
      canvas.height = height * dpr
      ctx.scale(dpr, dpr)
    }
    resize()
    window.addEventListener('resize', resize)

    const PARTICLE_COUNT = 2000
    const particles: any[] = []

    const phi = Math.PI * (3 - Math.sqrt(5))
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const y = 1 - (i / (PARTICLE_COUNT - 1)) * 2
      const radius = Math.sqrt(1 - y * y)
      const theta = phi * i

      const x = Math.cos(theta) * radius
      const z = Math.sin(theta) * radius

      // Random explosive vector for phase 2
      const explodeM = 2 + Math.random() * 3

      particles.push({
        origX: x, origY: y, origZ: z,
        expX: x * explodeM, expY: y * explodeM, expZ: z * explodeM,
        tx: 0, ty: 0,
        color: Math.random() > 0.8 ? '#ffffff' : Math.random() > 0.5 ? '#a1a1aa' : '#27272a'
      })
    }

    // Grid Targets mapping for the 3 structures
    const navCount = 200
    const gridCount = 1000
    const lineCount = PARTICLE_COUNT - navCount - gridCount

    // 1. Nav Bar Line (Flatten out horizontally at y=48)
    for (let i = 0; i < navCount; i++) {
      particles[i].tx = (width / navCount) * i
      particles[i].ty = 48
    }

    // 2. Habit Grid Block (Matrix bounded in the middle)
    const gridCols = Math.ceil(Math.sqrt(gridCount * ((width * 0.8) / (height * 0.3))))
    const gridRows = Math.ceil(gridCount / gridCols)
    const cw = (width * 0.8) / gridCols
    const ch = (height * 0.3) / gridRows
    for (let i = 0; i < gridCount; i++) {
      const r = Math.floor(i / gridCols)
      const c = i % gridCols
      particles[navCount + i].tx = (width * 0.1) + (c * cw)
      particles[navCount + i].ty = (height * 0.25) + (r * ch)
    }

    // 3. Line Graph Wave (Trace path across bottom)
    for (let i = 0; i < lineCount; i++) {
      const x = (width * 0.1) + ((width * 0.8) / lineCount) * i
      const wave = Math.sin(i * 0.1) * 20 + Math.cos(i * 0.05) * 10
      particles[navCount + gridCount + i].tx = x
      particles[navCount + gridCount + i].ty = (height * 0.75) + wave
    }

    let frameId: number
    let startTime: number | null = null;
    const PHASE_1_DURATION = 1000;
    const PHASE_2_DURATION = 500;
    const PHASE_3_DURATION = 500;
    const T_PHASE1_END = PHASE_1_DURATION;
    const T_PHASE2_END = PHASE_1_DURATION + PHASE_2_DURATION;
    const T_PHASE3_END = PHASE_1_DURATION + PHASE_2_DURATION + PHASE_3_DURATION;

    const easeInOutCubic = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const render = (time: number) => {
      if (startTime === null) startTime = time;
      const elapsed = time - startTime
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, width, height)

      const cx = width / 2
      const cy = height / 2
      const radiusScale = Math.min(width, height) * 0.3

      // Draw Center Text
      if (elapsed < T_PHASE2_END) {
        const opacity = Math.max(0, 1 - (elapsed - T_PHASE1_END)/1000);
        const fontFamily = typeof window !== 'undefined' ? getComputedStyle(document.body).getPropertyValue('--font-panchang') || 'sans-serif' : 'sans-serif';
        const fontSize = Math.min(width, height) < 768 ? 24 : 32;
        
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        const pulse = 1 + Math.sin(time * 0.005) * 0.05
        ctx.save()
        ctx.translate(cx, cy)
        ctx.scale(pulse, pulse)
        
        // Main title
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`
        ctx.font = `700 ${fontSize}px ${fontFamily}`
        ctx.letterSpacing = '2px'
        ctx.fillText('HabytFLow', 0, -fontSize * 0.3)
        
        // Subtitle "Consistency in Motion"
        ctx.fillStyle = `rgba(161, 161, 170, ${opacity * 0.8})` // zinc-400 with slight fade
        ctx.font = `500 ${fontSize * 0.35}px sans-serif`
        ctx.letterSpacing = '4px'
        ctx.fillText('CONSISTENCY IN MOTION', 0, fontSize * 0.8)
        
        ctx.restore()
      }

      // Draw Void Space Text "Consistency in motion" in Phase 2 & 3 (between Grid and Wave)
      if (elapsed > T_PHASE1_END) {
        const fadeInOpacity = Math.min((elapsed - T_PHASE1_END) / 500, 1);
        const fontSize = Math.min(width, height) < 768 ? 24 : 32;
        ctx.save()
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        
        // Neon white glow effect
        ctx.shadowColor = `rgba(255, 255, 255, ${fadeInOpacity * 0.8})`
        ctx.shadowBlur = 8
        
        ctx.fillStyle = `rgba(255, 255, 255, ${fadeInOpacity})` // Neon white color
        ctx.font = `700 ${fontSize * 0.55}px sans-serif`
        ctx.letterSpacing = '5px'
        ctx.fillText('CONSISTENCY IN MOTION', cx, height * 0.65)
        ctx.restore()
      }
      
      // Rotate sphere (Freeze rotation when explosion/morph begins)
      const activeRotTime = Math.min(time, (startTime || 0) + T_PHASE1_END);
      const rotY = activeRotTime * 0.0005
      const rotX = activeRotTime * 0.0002
      const cosY = Math.cos(rotY), sinY = Math.sin(rotY)
      const cosX = Math.cos(rotX), sinX = Math.sin(rotX)

      if (elapsed >= T_PHASE3_END && !fadingRef.current) {
        fadingRef.current = true
        setFading(true)
        setTimeout(() => onComplete(), 500)
      }

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const p = particles[i]

        let x = p.origX
        let y = p.origY
        let z = p.origZ

        // Apply explosive force if in Phase 2/3
        if (elapsed > T_PHASE1_END) {
          const expP = Math.min((elapsed - T_PHASE1_END) / 500, 1)
          const expEase = 1 - Math.pow(1 - expP, 3)
          x = x + (p.expX - x) * expEase
          y = y + (p.expY - y) * expEase
          z = z + (p.expZ - z) * expEase
        }

        // Apply 3D Rotation Matrix
        let tx = x * cosY - z * sinY
        let tz = x * sinY + z * cosY
        x = tx
        z = tz

        let ty = y * cosX - z * sinX
        tz = y * sinX + z * cosX
        y = ty
        z = tz

        // 3D to 2D Projection
        const scale = 200 / (200 + z * 100)
        let projX = cx + x * radiusScale * scale
        let projY = cy + y * radiusScale * scale

        // Morph to Dashboard Geometry targets
        if (elapsed > T_PHASE1_END) {
          const morphP = Math.max(0, Math.min((elapsed - T_PHASE1_END) / PHASE_2_DURATION, 1)) // dynamic timing
          const ease = easeInOutCubic(morphP)
          projX = projX + (p.tx - projX) * ease
          projY = projY + (p.ty - projY) * ease
        }

        ctx.fillStyle = p.color
        ctx.fillRect(projX, projY, 1.5, 1.5)
      }

      if (elapsed < T_PHASE3_END || !fadingRef.current) {
        frameId = requestAnimationFrame(render)
      }
    }

    frameId = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener('resize', resize)
    }
  }, [onComplete])

  return (
    <div className={`fixed inset-0 z-[100] bg-black transition-opacity duration-500 pointer-events-none ${fading ? 'opacity-0' : 'opacity-100'}`}>
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  )
}

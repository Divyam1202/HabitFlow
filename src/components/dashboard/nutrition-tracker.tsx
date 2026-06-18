'use client'

import React, { useState } from 'react'
import { Plus, Droplet, Beef, Wheat, Flame as FlameIcon, Target, CircleAlert } from 'lucide-react'
import { ProductionHabitTrackerSchema } from '@/lib/validations/habit'
import { z } from 'zod'
import { useHabitContext } from '@/contexts/habit-context'

type TrackerType = 'hydration' | 'calories' | 'protein' | 'carbs' | null
type ActionType = 'add' | 'edit' | 'goal' | null

export function NutritionTracker() {
  const { todayNutrition, updateNutrition } = useHabitContext()
  const { hydration, hydrationGoal, calories, caloriesGoal, protein, proteinGoal, carbs, carbsGoal } = todayNutrition

  // Modal State
  const [modalOpen, setModalOpen] = useState(false)
  const [modalType, setModalType] = useState<TrackerType>(null)
  const [modalAction, setModalAction] = useState<ActionType>(null)
  const [inputValue, setInputValue] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const openModal = (type: TrackerType, action: ActionType) => {
    setModalType(type)
    setModalAction(action)
    setInputValue('')
    setErrorMsg(null)
    setModalOpen(true)
  }

  const handleModalSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const val = parseInt(inputValue, 10)
    if (isNaN(val) || val < 0) return

    if (modalAction === 'add' || modalAction === 'edit') {
      let nextCalories = calories;
      let nextProtein = protein;
      let nextCarbs = carbs;

      if (modalType === 'calories') nextCalories = modalAction === 'add' ? calories + val : val;
      if (modalType === 'protein') nextProtein = modalAction === 'add' ? protein + val : val;
      if (modalType === 'carbs') nextCarbs = modalAction === 'add' ? carbs + val : val;

      // Auto-Balancing Logic: If editing macros, auto-calculate calories
      if (['protein', 'carbs'].includes(modalType as string)) {
        nextCalories = (nextProtein * 4) + (nextCarbs * 4);
      }
      
      // The Macro Integrity Check (Global Guardrail)
      if (['calories', 'protein', 'carbs'].includes(modalType as string)) {
        try {
          ProductionHabitTrackerSchema.parse({
            name: "Daily Nutrition",
            clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            targetDate: new Date().toISOString().split('T')[0],
            type: "numeric_volume",
            targetValue: 1,
            nutritionPayload: {
              calories: nextCalories,
              protein: nextProtein,
              carbs: nextCarbs
            }
          });
          setErrorMsg(null);
        } catch (error) {
          if (error instanceof z.ZodError) {
            const issue = error.issues.find(i => i.path.includes('nutritionPayload') || i.message.includes('Thermodynamic'));
            if (issue) {
               setErrorMsg(issue.message);
               return; // STOP execution, preventing corrupt state
            }
          }
        }
      }

      if (modalType === 'hydration') updateNutrition(p => ({ ...p, hydration: modalAction === 'add' ? p.hydration + val : val }))
      if (modalType === 'calories') updateNutrition(p => ({ ...p, calories: nextCalories }))
      if (modalType === 'protein') updateNutrition(p => ({ ...p, protein: nextProtein }))
      if (modalType === 'carbs') updateNutrition(p => ({ ...p, carbs: nextCarbs }))
    }
    else if (modalAction === 'goal') {
      if (modalType === 'hydration') updateNutrition(p => ({ ...p, hydrationGoal: val }))
      if (modalType === 'calories') updateNutrition(p => ({ ...p, caloriesGoal: val }))
      if (modalType === 'protein') updateNutrition(p => ({ ...p, proteinGoal: val }))
      if (modalType === 'carbs') updateNutrition(p => ({ ...p, carbsGoal: val }))
    }

    setModalOpen(false)
  }

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 md:gap-4">
        
        {/* Hydration Tracker */}
        <div className="border border-zinc-800 bg-black p-2.5 min-[400px]:p-3 md:p-4 flex flex-col justify-between gap-1.5 md:gap-2 relative group transition-all duration-150 ease-in-out hover:border-zinc-700">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-[10px] min-[400px]:text-[11px] md:text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1 md:gap-1.5 leading-tight">
                <Droplet size={12} /> Hydration
              </h3>
              <p className="text-[8.5px] min-[400px]:text-[9.5px] md:text-[10.5px] text-zinc-500 mt-0.5 font-medium">Goal: {hydrationGoal}ml</p>
            </div>
            <button onClick={() => openModal('hydration', 'goal')} className="flex flex-col items-center gap-0.5 text-zinc-500 hover:text-black hover:bg-white p-0.5 rounded-[1px] transition-all duration-150 group/target" title="Set Limit">
              <Target size={11} className="group-hover/target:text-black" />
              <span className="text-[7px] uppercase font-bold tracking-widest">Set Limit</span>
            </button>
          </div>

          <div className="text-lg min-[400px]:text-xl md:text-2xl font-black tracking-tighter tabular-nums text-white group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.3)] transition-all duration-150 py-0.5">
            {hydration} <span className="text-[9px] min-[400px]:text-[10px] md:text-sm text-zinc-650 font-bold">/ {hydrationGoal} ml</span>
          </div>

          <div className="space-y-1">
            <button 
              onClick={() => openModal('hydration', 'add')}
              className="h-7 min-[400px]:h-8 md:h-9 w-full border border-zinc-800 hover:border-white hover:bg-white hover:text-black text-white flex items-center justify-center gap-0.5 transition-all duration-150 font-bold uppercase text-[9px] min-[400px]:text-[10px] md:text-[11px]"
            >
              <Plus size={14} /> Add ML
            </button>
            <button 
              onClick={() => openModal('hydration', 'edit')}
              className="h-4 min-[400px]:h-5 md:h-6 w-full text-zinc-500 hover:bg-white hover:text-black transition-all duration-150 font-bold uppercase text-[8px] min-[400px]:text-[8.5px] md:text-[9.5px] tracking-wider rounded-[1px]"
            >
              Edit Value
            </button>
          </div>
        </div>

        {/* Calories Tracker */}
        <div className="border border-zinc-800 bg-black p-2.5 min-[400px]:p-3 md:p-4 flex flex-col justify-between gap-1.5 md:gap-2 relative group transition-all duration-150 ease-in-out hover:border-zinc-700">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-[10px] min-[400px]:text-[11px] md:text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1 md:gap-1.5 leading-tight">
                <FlameIcon size={12} /> Calories
              </h3>
              <p className="text-[8.5px] min-[400px]:text-[9.5px] md:text-[10.5px] text-zinc-500 mt-0.5 font-medium">Goal: {caloriesGoal}kcal</p>
            </div>
            <button onClick={() => openModal('calories', 'goal')} className="flex flex-col items-center gap-0.5 text-zinc-500 hover:text-black hover:bg-white p-0.5 rounded-[1px] transition-all duration-150 group/target" title="Set Limit">
              <Target size={11} className="group-hover/target:text-black" />
              <span className="text-[7px] uppercase font-bold tracking-widest">Set Limit</span>
            </button>
          </div>

          <div className="text-lg min-[400px]:text-xl md:text-2xl font-black tracking-tighter tabular-nums text-white group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.3)] transition-all duration-150 py-0.5">
            {calories} <span className="text-[9px] min-[400px]:text-[10px] md:text-sm text-zinc-650 font-bold">/ {caloriesGoal}</span>
          </div>

          <div className="space-y-1">
            <button 
              onClick={() => openModal('calories', 'add')}
              className="h-7 min-[400px]:h-8 md:h-9 w-full border border-zinc-800 hover:border-white hover:bg-white hover:text-black text-white flex items-center justify-center gap-0.5 transition-all duration-150 font-bold uppercase text-[9px] min-[400px]:text-[10px] md:text-[11px]"
            >
              <Plus size={14} /> Add Kcal
            </button>
            <button 
              onClick={() => openModal('calories', 'edit')}
              className="h-4 min-[400px]:h-5 md:h-6 w-full text-zinc-500 hover:bg-white hover:text-black transition-all duration-150 font-bold uppercase text-[8px] min-[400px]:text-[8.5px] md:text-[9.5px] tracking-wider rounded-[1px]"
            >
              Edit Value
            </button>
          </div>
        </div>

        {/* Protein Tracker */}
        <div className="border border-zinc-800 bg-black p-2.5 min-[400px]:p-3 md:p-4 flex flex-col justify-between gap-1.5 md:gap-2 relative group transition-all duration-150 ease-in-out hover:border-zinc-700">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-[10px] min-[400px]:text-[11px] md:text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1 md:gap-1.5 leading-tight">
                <Beef size={12} /> Protein
              </h3>
              <p className="text-[8.5px] min-[400px]:text-[9.5px] md:text-[10.5px] text-zinc-500 mt-0.5 font-medium">Goal: {proteinGoal}g</p>
            </div>
            <button onClick={() => openModal('protein', 'goal')} className="flex flex-col items-center gap-0.5 text-zinc-500 hover:text-black hover:bg-white p-0.5 rounded-[1px] transition-all duration-150 group/target" title="Set Limit">
              <Target size={11} className="group-hover/target:text-black" />
              <span className="text-[7px] uppercase font-bold tracking-widest">Set Limit</span>
            </button>
          </div>

          <div className="text-lg min-[400px]:text-xl md:text-2xl font-black tracking-tighter tabular-nums text-white group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.3)] transition-all duration-150 py-0.5">
            {protein} <span className="text-[9px] min-[400px]:text-[10px] md:text-sm text-zinc-650 font-bold">/ {proteinGoal} g</span>
          </div>

          <div className="space-y-1">
            <button 
              onClick={() => openModal('protein', 'add')}
              className="h-7 min-[400px]:h-8 md:h-9 w-full border border-zinc-800 hover:border-white hover:bg-white hover:text-black text-white flex items-center justify-center gap-0.5 transition-all duration-150 font-bold uppercase text-[9px] min-[400px]:text-[10px] md:text-[11px]"
            >
              <Plus size={14} /> Add Protein
            </button>
            <button 
              onClick={() => openModal('protein', 'edit')}
              className="h-4 min-[400px]:h-5 md:h-6 w-full text-zinc-500 hover:bg-white hover:text-black transition-all duration-150 font-bold uppercase text-[8px] min-[400px]:text-[8.5px] md:text-[9.5px] tracking-wider rounded-[1px]"
            >
              Edit Value
            </button>
          </div>
        </div>

        {/* Carbs Tracker */}
        <div className="border border-zinc-800 bg-black p-2.5 min-[400px]:p-3 md:p-4 flex flex-col justify-between gap-1.5 md:gap-2 relative group transition-all duration-150 ease-in-out hover:border-zinc-700">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-[10px] min-[400px]:text-[11px] md:text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1 md:gap-1.5 leading-tight">
                <Wheat size={12} /> Carbs
              </h3>
              <p className="text-[8.5px] min-[400px]:text-[9.5px] md:text-[10.5px] text-zinc-500 mt-0.5 font-medium">Goal: {carbsGoal}g</p>
            </div>
            <button onClick={() => openModal('carbs', 'goal')} className="flex flex-col items-center gap-0.5 text-zinc-500 hover:text-black hover:bg-white p-0.5 rounded-[1px] transition-all duration-150 group/target" title="Set Limit">
              <Target size={11} className="group-hover/target:text-black" />
              <span className="text-[7px] uppercase font-bold tracking-widest">Set Limit</span>
            </button>
          </div>

          <div className="text-lg min-[400px]:text-xl md:text-2xl font-black tracking-tighter tabular-nums text-white group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.3)] transition-all duration-150 py-0.5">
            {carbs} <span className="text-[9px] min-[400px]:text-[10px] md:text-sm text-zinc-650 font-bold">/ {carbsGoal} g</span>
          </div>

          <div className="space-y-1">
            <button 
              onClick={() => openModal('carbs', 'add')}
              className="h-7 min-[400px]:h-8 md:h-9 w-full border border-zinc-800 hover:border-white hover:bg-white hover:text-black text-white flex items-center justify-center gap-0.5 transition-all duration-150 font-bold uppercase text-[9px] min-[400px]:text-[10px] md:text-[11px]"
            >
              <Plus size={14} /> Add Carbs
            </button>
            <button 
              onClick={() => openModal('carbs', 'edit')}
              className="h-4 min-[400px]:h-5 md:h-6 w-full text-zinc-500 hover:bg-white hover:text-black transition-all duration-150 font-bold uppercase text-[8px] min-[400px]:text-[8.5px] md:text-[9.5px] tracking-wider rounded-[1px]"
            >
              Edit Value
            </button>
          </div>
        </div>

      </div>

      {/* Custom Brutalist Modal Overlay */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-6 backdrop-blur-sm">
          <div className="bg-black border border-zinc-700 max-w-sm w-full p-8 shadow-2xl">
            <h2 className="text-xl font-bold uppercase tracking-wider text-white mb-2">
              {modalAction === 'add' && `Add ${modalType}`}
              {modalAction === 'edit' && `Edit ${modalType}`}
              {modalAction === 'goal' && `Set ${modalType} Goal`}
            </h2>
            <p className="text-sm text-zinc-500 mb-6">
              Enter the numeric value below.
            </p>
            
            {errorMsg && (
              <div className="bg-red-950/50 border border-red-900 text-red-500 p-4 mb-6 text-xs uppercase font-bold tracking-wider flex items-start gap-2">
                <CircleAlert size={16} className="shrink-0" />
                <p>{errorMsg}</p>
              </div>
            )}
            
            <form onSubmit={handleModalSubmit}>
              <input 
                type="number"
                min="0"
                autoFocus
                className="w-full bg-zinc-950 border border-zinc-800 text-white p-4 text-xl font-bold outline-none focus:border-white transition-colors mb-6"
                placeholder="e.g. 250"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
              />
              <div className="flex gap-4">
                <button 
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 py-3 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors uppercase font-bold text-sm"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 bg-white text-black hover:bg-zinc-200 transition-colors uppercase font-bold text-sm"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

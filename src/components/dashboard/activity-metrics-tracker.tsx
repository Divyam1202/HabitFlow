'use client'

import React, { useState } from 'react'
import { Plus, Activity, Heart, Target, X } from 'lucide-react'
import { useHabitContext } from '@/contexts/habit-context'

type TrackerType = 'sports' | 'hr' | null
type ActionType = 'add' | 'edit' | 'goal' | null

export function ActivityMetricsTracker() {
  const { todayActivity, updateActivity } = useHabitContext()
  const sportsList = todayActivity.sportsLog

  const [modalOpen, setModalOpen] = useState(false)
  const [modalType, setModalType] = useState<TrackerType>(null)
  const [modalAction, setModalAction] = useState<ActionType>(null)
  const [inputValue, setInputValue] = useState('')
  const [inputSportsName, setInputSportsName] = useState('')
  const [inputSportsHrs, setInputSportsHrs] = useState('')

  const openModal = (type: TrackerType, action: ActionType) => {
    setModalType(type)
    setModalAction(action)
    setInputValue('')
    setInputSportsName('')
    setInputSportsHrs('')
    setModalOpen(true)
  }

  const handleModalSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (modalType === 'sports') {
      if (inputSportsName.trim()) {
        const hrs = parseFloat(inputSportsHrs) || 0
        updateActivity(p => ({
          ...p,
          sportsLog: [...p.sportsLog, { id: Date.now().toString(), name: inputSportsName.toUpperCase(), duration: hrs }]
        }))
      }
    }

    setModalOpen(false)
  }

  const clearSports = () => updateActivity(p => ({ ...p, sportsLog: [] }))

  return (
    <>
      <div className="w-full">
        
        {/* Sports Tracker */}
        <div className="border border-border bg-card p-3 md:p-4 flex flex-col justify-between gap-3 md:gap-4 relative group transition-all duration-150 ease-in-out hover:border-foreground">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-[11px] md:text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5 md:gap-2 leading-tight">
                <Activity size={14} /> Sports Played
              </h3>
              <p className="text-[8.5px] min-[400px]:text-[9px] md:text-[10px] text-zinc-500 mt-0.5">Today's active sports</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 py-1">
            {sportsList.length === 0 && (
              <div className="text-2xl md:text-3xl font-black tracking-tighter text-zinc-300 dark:text-zinc-800 uppercase">NONE</div>
            )}
            {sportsList.map((sport, idx) => (
              <div 
                key={sport.id || idx} 
                className="border border-border p-2 min-w-[90px] relative group pr-8 cursor-pointer hover:border-foreground transition-colors duration-150"
                onClick={() => {
                  updateActivity(p => {
                    const newLog = [...p.sportsLog];
                    newLog.splice(idx, 1);
                    return { ...p, sportsLog: newLog };
                  })
                }}
              >
                <div className="text-base md:text-lg font-black tracking-tighter text-foreground uppercase truncate group-hover:opacity-80 transition-opacity duration-150">
                  {sport.name}
                </div>
                {sport.duration > 0 && (
                  <div className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5 group-hover:text-foreground transition-colors duration-150">
                    {sport.duration} HRS
                  </div>
                )}
                <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  <X size={12} className="text-zinc-500 hover:text-red-500 transition-colors" />
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button 
              onClick={() => openModal('sports', 'add')}
              className="h-8 md:h-9 flex-1 border border-border hover:border-foreground hover:bg-foreground hover:text-background text-foreground flex items-center justify-center gap-1 transition-colors font-bold uppercase text-[9.5px] min-[400px]:text-[10.5px] md:text-[11.5px]"
            >
              <Plus size={16} /> Add Sport
            </button>
            <button 
              onClick={clearSports}
              className="h-8 md:h-9 w-24 border border-border text-zinc-500 hover:bg-foreground hover:text-background hover:border-foreground transition-colors font-bold uppercase text-[8.5px] min-[400px]:text-[9.5px] md:text-[10.5px] tracking-wider"
            >
              Clear All
            </button>
          </div>
        </div>

      </div>

      {/* Custom Brutalist Modal Overlay */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-6 backdrop-blur-sm">
          <div className="bg-card text-card-foreground border border-border max-w-sm w-full p-8 shadow-2xl">
            <h2 className="text-xl font-bold uppercase tracking-wider text-foreground mb-2">
              {modalAction === 'add' && `Add ${modalType}`}
            </h2>
            <p className="text-sm text-zinc-500 mb-6">
              Enter sports played (e.g. TENNIS):
            </p>
            
            <form onSubmit={handleModalSubmit}>
              {modalType === 'sports' ? (
                <div className="flex flex-col gap-4 mb-6">
                  <input 
                    type="text"
                    autoFocus
                    className="w-full bg-background border border-border text-foreground p-4 text-xl font-bold outline-none focus:border-foreground transition-colors uppercase"
                    placeholder="SPORT (e.g. TENNIS)"
                    value={inputSportsName}
                    onChange={(e) => setInputSportsName(e.target.value)}
                  />
                  <input 
                    type="number"
                    step="0.5"
                    min="0"
                    className="w-full bg-background border border-border text-foreground p-4 text-xl font-bold outline-none focus:border-foreground transition-colors uppercase"
                    placeholder="HRS (e.g. 1.5)"
                    value={inputSportsHrs}
                    onChange={(e) => setInputSportsHrs(e.target.value)}
                  />
                </div>
              ) : null}
              <div className="flex gap-4">
                <button 
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 py-3 border border-border text-zinc-500 hover:text-foreground hover:border-foreground transition-colors uppercase font-bold text-sm"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 bg-foreground text-background hover:bg-foreground/90 transition-colors uppercase font-bold text-sm"
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

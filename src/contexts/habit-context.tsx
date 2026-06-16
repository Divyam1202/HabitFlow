'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { toast } from 'sonner'

export type NutritionState = {
  hydration: number; hydrationGoal: number;
  calories: number; caloriesGoal: number;
  protein: number; proteinGoal: number;
  carbs: number; carbsGoal: number;
}

export type ActivityState = {
  activeMetric: 'sports' | 'hr' | null;
  sportsLog: Array<{ id: string; name: string; duration: number }>;
  hrAverage: number | null;
}

export type HabitDef = { id: number; name: string; category: string; time: string; notification?: number | null; goal?: string; streak?: number; frequency?: number[]; }
export type GridHabit = HabitDef & { days: {day: number; completed: boolean}[] }

export type HabitContextType = {
  currentSystemDate: string;
  todayHabits: number[];
  toggleTodayHabit: (id: number) => void;
  
  todayNutrition: NutritionState;
  updateNutrition: (updater: (prev: NutritionState) => NutritionState) => void;
  
  todayActivity: ActivityState;
  updateActivity: (updater: (prev: ActivityState) => ActivityState) => void;
  
  gridData: GridHabit[];
  toggleGridHabit: (habitId: number, dayNum: number) => void;
  
  heatmapData: Array<{ id: number; count: number }>;
  
  addHabit: (habit: Omit<HabitDef, 'id'>) => void;
  editHabit: (id: number, habit: Partial<HabitDef>) => void;
  deleteHabit: (id: number) => void;
  isMounted: boolean;
  isInitialized: boolean;
  initializeJourney: () => void;
}

const HabitContext = createContext<HabitContextType | null>(null)

export const useHabitContext = () => {
  const ctx = useContext(HabitContext)
  if (!ctx) throw new Error("useHabitContext must be used within HabitProvider")
  return ctx
}

// --- Initial Seed Data ---
const MOCK_HABITS: HabitDef[] = [
  { id: 1, name: "Gym", category: "🏋️ Health", time: "18:00", frequency: [1, 3, 5] },
  { id: 2, name: "Reading", category: "🧠 Growth", time: "21:30", frequency: [0, 1, 2, 3, 4, 5, 6] },
  { id: 3, name: "Office", category: "💼 Career", time: "09:00", frequency: [1, 2, 3, 4, 5] },
  { id: 4, name: "Meditation", category: "🕉️ Spiritual", time: "07:00", frequency: [0, 1, 2, 3, 4, 5, 6] },
  { id: 5, name: "Laundry", category: "🏠 Home", time: "10:00", frequency: [0, 1, 2, 3, 4, 5, 6] }
]

const SEED_GRID_DATA = MOCK_HABITS.map(habit => ({
  ...habit,
  days: Array.from({ length: 30 }).map((_, i) => ({
    day: i + 1,
    // Ensure Day 30 is strictly false to sync properly with an empty `todayHabits` array on initial load
    completed: i === 29 ? false : ((i + habit.id) % 3 === 0 || (i + habit.id) % 7 === 0)
  }))
}))

const SEED_HEATMAP = Array.from({ length: 364 }).map((_, i) => {
  let count = 0
  if (i >= 50 && i < 195) {
    count = (i % 3 === 0) ? 4 : (i % 2 === 0) ? 2 : 1
  } else {
    if (i % 8 === 0) count = 5
    else if (i % 5 === 0) count = 3
    else if (i % 2 === 0) count = 1
  }
  return { id: i, count }
})

const INITIAL_NUTRITION: NutritionState = {
  hydration: 0, hydrationGoal: 2500,
  calories: 0, caloriesGoal: 2000,
  protein: 0, proteinGoal: 150,
  carbs: 0, carbsGoal: 250
}

const INITIAL_ACTIVITY: ActivityState = {
  activeMetric: null,
  sportsLog: [],
  hrAverage: null
}

const getLocalYYYYMMDD = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function HabitProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  const { requireAuth, user, isLoading, isAuthenticated } = useAuth()
  
  const [currentSystemDate, setCurrentSystemDate] = useState<string>(() => getLocalYYYYMMDD())
  const [todayHabits, setTodayHabits] = useState<number[]>([])
  const [todayNutrition, setTodayNutrition] = useState<NutritionState>(INITIAL_NUTRITION)
  const [todayActivity, setTodayActivity] = useState<ActivityState>(INITIAL_ACTIVITY)
  
  const [gridData, setGridData] = useState<GridHabit[]>(SEED_GRID_DATA)
  const [heatmapData, setHeatmapData] = useState<{id: number, count: number}[]>(SEED_HEATMAP)
  const [isInitialized, setIsInitialized] = useState<boolean>(false)

  const getStorageKey = () => user?.id ? `habitflow_state_${user.id}` : 'habitflow_state'

  // Hydration
  useEffect(() => {
    if (isLoading) return;

    const loadState = async () => {
      let parsed = null;
      
      if (isAuthenticated) {
        try {
          const res = await fetch('/api/user-state', { cache: 'no-store' });
          if (res.ok) {
            const data = await res.json();
            if (data.stateData) {
              parsed = JSON.parse(data.stateData);
            }
          }
        } catch (e) {
          console.error("Failed to fetch remote state", e);
        }
      }

      if (!parsed) {
        try {
          const saved = localStorage.getItem(getStorageKey())
          if (saved) parsed = JSON.parse(saved)
        } catch(e) {}
      }

      if (parsed) {
        setIsInitialized(true)
        setCurrentSystemDate(parsed.currentSystemDate || getLocalYYYYMMDD())
        setTodayHabits(parsed.todayHabits || [])
        setTodayNutrition(parsed.todayNutrition || INITIAL_NUTRITION)
        setTodayActivity(parsed.todayActivity || INITIAL_ACTIVITY)
        setGridData(parsed.gridData || SEED_GRID_DATA)
        setHeatmapData(parsed.heatmapData || SEED_HEATMAP)
      } else {
        const hasInitialized = localStorage.getItem('habitflow_has_initialized') === 'true'
        if (hasInitialized || isAuthenticated) {
          setIsInitialized(true)
          setCurrentSystemDate(getLocalYYYYMMDD())
          setTodayHabits([])
          setTodayNutrition(INITIAL_NUTRITION)
          setTodayActivity(INITIAL_ACTIVITY)
          setGridData([])
          setHeatmapData(Array.from({ length: 364 }).map((_, i) => ({ id: i, count: 0 })))
        } else {
          setIsInitialized(false)
          setCurrentSystemDate(getLocalYYYYMMDD())
          setTodayHabits([1, 3])
          setTodayNutrition(INITIAL_NUTRITION)
          setTodayActivity(INITIAL_ACTIVITY)
          setGridData(SEED_GRID_DATA)
          setHeatmapData(SEED_HEATMAP)
        }
      }
      setMounted(true)
    };

    loadState();

    // Background sync when returning to the tab (Cross-platform updates)
    const onFocus = async () => {
      if (isAuthenticated) {
        try {
          const res = await fetch('/api/user-state', { cache: 'no-store' });
          if (res.ok) {
            const data = await res.json();
            if (data.stateData) {
              const parsed = JSON.parse(data.stateData);
              if (parsed) {
                setCurrentSystemDate(parsed.currentSystemDate || getLocalYYYYMMDD())
                setTodayHabits(parsed.todayHabits || [])
                setTodayNutrition(parsed.todayNutrition || INITIAL_NUTRITION)
                setTodayActivity(parsed.todayActivity || INITIAL_ACTIVITY)
                setGridData(parsed.gridData || SEED_GRID_DATA)
                setHeatmapData(parsed.heatmapData || SEED_HEATMAP)
              }
            }
          }
        } catch (e) {
          console.error("Failed to sync on focus", e);
        }
      }
    };

    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [user?.id, isLoading, isAuthenticated])

  // Persistence & Rollover Check
  useEffect(() => {
    if (!mounted || isLoading) return

    const stateToSave = {
      currentSystemDate, todayHabits, todayNutrition, todayActivity, gridData, heatmapData
    }
    const stateString = JSON.stringify(stateToSave);
    localStorage.setItem(getStorageKey(), stateString)

    if (isAuthenticated) {
      const timer = setTimeout(() => {
        fetch('/api/user-state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          keepalive: true,
          body: JSON.stringify({ stateData: stateString })
        }).catch(e => console.error("Failed to sync remote state", e));
      }, 1500); // 1.5s debounce
      
      return () => clearTimeout(timer);
    }
  }, [currentSystemDate, todayHabits, todayNutrition, todayActivity, gridData, heatmapData, mounted])

  const initializeJourney = () => {
    localStorage.setItem('habitflow_has_initialized', 'true')
    setIsInitialized(true)
    setGridData([])
    setHeatmapData(Array.from({ length: 364 }).map((_, i) => ({ id: i, count: 0 })))
    setTodayHabits([])
    setTodayNutrition(INITIAL_NUTRITION)
    setTodayActivity(INITIAL_ACTIVITY)
  }

  // Midnight Rollover Engine
  useEffect(() => {
    if (!mounted) return

    const checkRollover = () => {
      const nowStr = getLocalYYYYMMDD()
      if (nowStr !== currentSystemDate) {
        console.log(`[HabytFlow Engine] Rollover triggered: ${currentSystemDate} -> ${nowStr}`);
        
        // 1. Archive: Append today's total ticks to heatmap
        const totalTicks = todayHabits.length
        setHeatmapData(prev => {
          const newMap = [...prev.slice(1)] // shift 1 day off
          newMap.push({ id: prev.length ? prev[prev.length - 1].id + 1 : 0, count: totalTicks })
          return newMap
        })

        // 2. Archive: Shift Grid 1 day forward
        setGridData(prev => prev.map(h => {
          const wasCompleted = todayHabits.includes(h.id)
          const newDays = [...h.days]
          // The last element in days is roughly "today" in the 30-day window
          // We lock yesterday's completion status into the grid if it isn't already there.
          // For a true rolling window, we drop day 0, shift everything, and add a blank day.
          newDays.shift()
          const lastDayNum = newDays[newDays.length - 1].day
          newDays.push({ day: lastDayNum + 1, completed: false })
          return { ...h, days: newDays }
        }))

        // 3. Reset Today
        setTodayHabits([])
        // Keep goals, reset actuals
        setTodayNutrition(prev => ({
          ...prev, hydration: 0, calories: 0, protein: 0, carbs: 0
        }))
        setTodayActivity({ activeMetric: null, sportsLog: [], hrAverage: null })
        
        // 4. Advance System Date
        setCurrentSystemDate(nowStr)
      }
    }

    // Check immediately on focus/mount
    checkRollover()
    window.addEventListener('focus', checkRollover)
    
    // Check every minute
    const interval = setInterval(checkRollover, 60000)

    return () => {
      window.removeEventListener('focus', checkRollover)
      clearInterval(interval)
    }
  }, [mounted, currentSystemDate, todayHabits])

  const toggleTodayHabit = (id: number) => {
    requireAuth(() => {
      const isCompleting = !todayHabits.includes(id);
      setTodayHabits(prev => isCompleting ? [...prev, id] : prev.filter(x => x !== id))
      
      if (isCompleting) {
        const habit = gridData.find(h => h.id === id);
        if (habit) {
          fetch('/api/telemetry', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              eventType: 'habit_completed', 
              metadata: { habitName: habit.name, category: habit.category } 
            })
          }).catch(console.error)
        }
      }
      // Sync to gridData's "last day" which represents today
      setGridData(prev => prev.map(h => {
        if (h.id !== id) return h
        const newDays = [...h.days]
        const lastIdx = newDays.length - 1
        newDays[lastIdx] = { ...newDays[lastIdx], completed: isCompleting }
        return { ...h, days: newDays }
      }))
    })
  }

  const toggleGridHabit = (habitId: number, dayNum: number) => {
    requireAuth(() => {
      setGridData(prev => prev.map(h => {
        if (h.id !== habitId) return h
        return {
          ...h,
          days: h.days.map(d => d.day === dayNum ? { ...d, completed: !d.completed } : d)
        }
      }))
    })
  }

  const updateNutritionWrapped = (updater: (prev: NutritionState) => NutritionState) => {
    requireAuth(() => setTodayNutrition(updater))
  }

  const updateActivityWrapped = (updater: (prev: ActivityState) => ActivityState) => {
    requireAuth(() => setTodayActivity(updater))
  }

  const addHabit = (habit: Omit<HabitDef, 'id'>) => {
    requireAuth(() => {
      const newHabit = {
        ...habit,
        id: Date.now(),
        days: Array.from({ length: 30 }).map((_, i) => ({ day: i + 1, completed: false }))
      };

      // 1. Optimistic local update
      setGridData(prev => [...prev, newHabit])

      // 2. Immediate Remote Sync (Bypass debounce) for visual confidence
      const stateToSave = {
        currentSystemDate, todayHabits, todayNutrition, todayActivity, 
        gridData: [...gridData, newHabit], 
        heatmapData
      };

      toast.promise(
        fetch('/api/user-state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stateData: JSON.stringify(stateToSave) })
        }),
        {
          loading: 'Syncing habit securely...',
          success: 'Habit saved and synced across all devices!',
          error: 'Warning: Failed to sync to cloud.'
        }
      );

      fetch('/api/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          eventType: 'habit_created', 
          metadata: { habitName: habit.name, category: habit.category } 
        })
      }).catch(console.error)
    })
  }

  const editHabit = (id: number, habit: Partial<HabitDef>) => {
    requireAuth(() => {
      const updatedGridData = gridData.map(h => h.id === id ? { ...h, ...habit } : h);
      setGridData(updatedGridData);

      // Immediate Remote Sync (Bypass debounce) for visual confidence
      const stateToSave = {
        currentSystemDate, todayHabits, todayNutrition, todayActivity, 
        gridData: updatedGridData, 
        heatmapData
      };

      toast.promise(
        fetch('/api/user-state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stateData: JSON.stringify(stateToSave) })
        }),
        {
          loading: 'Syncing edits securely...',
          success: 'Habit changes saved and synced!',
          error: 'Warning: Failed to sync edits to cloud.'
        }
      );
    })
  }

  const deleteHabit = (id: number) => {
    requireAuth(() => {
      const updatedGridData = gridData.filter(h => h.id !== id);
      const updatedTodayHabits = todayHabits.filter(x => x !== id);
      
      setGridData(updatedGridData);
      setTodayHabits(updatedTodayHabits);

      // Immediate Remote Sync (Bypass debounce) for visual confidence
      const stateToSave = {
        currentSystemDate, todayHabits: updatedTodayHabits, todayNutrition, todayActivity, 
        gridData: updatedGridData, 
        heatmapData
      };

      toast.promise(
        fetch('/api/user-state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stateData: JSON.stringify(stateToSave) })
        }),
        {
          loading: 'Deleting habit...',
          success: 'Habit deleted and synced!',
          error: 'Warning: Failed to sync deletion to cloud.'
        }
      );
    })
  }

  return (
    <HabitContext.Provider value={{
      currentSystemDate,
      todayHabits, toggleTodayHabit,
      todayNutrition, updateNutrition: updateNutritionWrapped,
      todayActivity, updateActivity: updateActivityWrapped,
      gridData, toggleGridHabit,
      heatmapData,
      addHabit,
      editHabit,
      deleteHabit,
      isMounted: mounted,
      isInitialized,
      initializeJourney
    }}>
      {children}
    </HabitContext.Provider>
  )
}

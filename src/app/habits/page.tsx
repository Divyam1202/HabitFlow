'use client'

import React, { useState, useEffect } from 'react'
import { Plus, Settings2, Trash2, X, Clock, Bell } from 'lucide-react'
import { useSettings, formatTime } from '@/hooks/useSettings'
import { useAuth } from '@/contexts/auth-context'
import { useRouter } from 'next/navigation'

import { useHabitContext } from '@/contexts/habit-context'

export default function HabitsPage() {
  const { timeFormat } = useSettings()
  const { gridData: habits, addHabit, editHabit, deleteHabit: deleteHabitContext } = useHabitContext()
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/')
    }
  }, [isAuthenticated, isLoading, router])

  const [isEditing, setIsEditing] = useState<number | null>(null)

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-sm font-bold uppercase tracking-widest text-zinc-500 animate-pulse">
          Authenticating...
        </div>
      </div>
    )
  }
  const [showAddForm, setShowAddForm] = useState(false)

  // Form State
  const [name, setName] = useState('')
  const [category, setCategory] = useState('🏋️ Health')
  const [time, setTime] = useState('09:00')
  const [frequency, setFrequency] = useState<number[]>([])
  const [notification, setNotification] = useState<number>(0)

  const CATEGORY_SUGGESTIONS: Record<string, string[]> = {
    '🏋️ Health': ['Gym', 'Water', 'Breakfast', 'Dinner', 'Sleep'],
    '💼 Career': ['Office', 'Building', 'Job Switch'],
    '🧠 Growth': ['Reading', 'Learning', 'Courses', 'Certifications'],
    '🕉️ Spiritual': ['Offer Water to Surya Dev', 'Meditation', 'Prayer'],
    '🏠 Home': ['Laundry', 'Cleaning', 'Groceries', 'Room Reset'],
    '📅 Planning': ['Weekly Review', 'Weekly Planning', 'Goal Review'],
  }
  
  const CATEGORIES = Object.keys(CATEGORY_SUGGESTIONS)

  const DAYS_OF_WEEK = [
    { label: 'S', value: 0 },
    { label: 'M', value: 1 },
    { label: 'T', value: 2 },
    { label: 'W', value: 3 },
    { label: 'T', value: 4 },
    { label: 'F', value: 5 },
    { label: 'S', value: 6 },
  ]

  const getFrequencyLabel = (freq: number[]) => {
    if (freq.length === 7) return 'Daily';
    if (freq.length === 0) return 'None';
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return freq.sort().map(d => days[d]).join(', ');
  }

  const resetForm = () => {
    setName('')
    setCategory('🏋️ Health')
    setTime('09:00')
    setFrequency([])
    setNotification(0)
    setIsEditing(null)
    setShowAddForm(false)
  }

  const handleEdit = (habit: any) => {
    setName(habit.name || '')
    setCategory(habit.category || '🏋️ Health')
    setTime(habit.time || '09:00')
    setFrequency(habit.frequency || [])
    setNotification(habit.notification !== undefined && habit.notification !== null ? habit.notification : 0)
    setIsEditing(habit.id)
    setShowAddForm(true)
  }

  const handleDelete = (id: number) => {
    deleteHabitContext(id)
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    const goal = getFrequencyLabel(frequency);

    if (isEditing) {
      editHabit(isEditing, { name, category, goal, time, frequency, notification })
    } else {
      addHabit({ name, category, goal, streak: 0, time, frequency, notification })
    }
    resetForm()
  }

  return (
    <div className="max-w-[1000px] mx-auto px-6 pt-12 pb-24 space-y-12 relative">

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-tight text-foreground">Manage Habits</h1>
          <p className="text-zinc-500 mt-2 text-sm">Configure your routines and digital timings.</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowAddForm(true); }}
          className="flex items-center gap-2 px-6 py-3 bg-foreground text-background font-bold uppercase tracking-wider text-sm hover:bg-foreground/90 transition-colors"
        >
          <Plus size={18} /> New Habit
        </button>
      </div>

      <div className="border border-border bg-card">
        {habits.map((habit, idx) => (
          <div key={habit.id} className={`p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 ${idx !== habits.length - 1 ? 'border-b border-border' : ''}`}>
            <div>
              <h3 className="font-bold text-lg text-foreground">{habit.name}</h3>
              <div className="flex flex-wrap items-center gap-4 mt-2 text-xs font-medium uppercase tracking-widest text-zinc-500">
                <span>{habit.category}</span>
                <span className="w-1 h-1 bg-zinc-300 dark:bg-zinc-700 rounded-full" />
                <span>{habit.goal || 'Daily'}</span>
                <span className="w-1 h-1 bg-zinc-300 dark:bg-zinc-700 rounded-full" />
                <span className="text-foreground flex items-center gap-1">🔥 {habit.streak || 0} Days</span>
              </div>
            </div>

            <div className="flex items-center justify-between md:justify-end gap-6 w-full md:w-auto">
              {/* Timing Block */}
              <div className="flex items-center gap-4 border border-border px-4 py-2 bg-background">
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-zinc-500" />
                  <span className="text-xs font-black text-foreground tabular-nums">{habit.time ? formatTime(habit.time, timeFormat) : 'Anytime'}</span>
                </div>
                {habit.notification !== undefined && (
                  <>
                    <div className="w-[1px] h-4 bg-border" />
                    <div className="flex items-center gap-2">
                      <Bell size={14} className="text-blue-500" />
                      <span className="text-xs font-bold text-zinc-500">
                        {habit.notification === 0 ? 'On Time' : `-${habit.notification}m`}
                      </span>
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button onClick={() => handleEdit(habit)} className="p-3 border border-border hover:border-foreground text-zinc-500 hover:text-foreground transition-colors">
                  <Settings2 size={18} />
                </button>
                <button onClick={() => handleDelete(habit.id)} className="p-3 border border-border hover:border-red-650 hover:bg-red-500/10 text-zinc-500 hover:text-red-500 transition-colors">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          </div>
        ))}
        {habits.length === 0 && (
          <div className="p-12 text-center text-zinc-500 uppercase tracking-widest text-xs font-bold">
            No habits configured.
          </div>
        )}
      </div>

      {/* Editor Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border w-full max-w-[500px] p-6 shadow-2xl relative text-card-foreground">
            <button onClick={resetForm} className="absolute top-4 right-4 text-zinc-500 hover:text-foreground">
              <X size={24} />
            </button>
            <h2 className="text-xl font-bold uppercase tracking-tight text-foreground mb-6">
              {isEditing ? 'Edit Habit' : 'Create New Habit'}
            </h2>

            <form onSubmit={handleSave} className="space-y-6">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Habit Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-background border border-border p-3 text-foreground focus:outline-none focus:border-foreground transition-colors"
                  placeholder="e.g., Gym, Reading, Meditation"
                  list="habit-suggestions"
                  required
                />
                <datalist id="habit-suggestions">
                  {CATEGORY_SUGGESTIONS[category]?.map(suggestion => (
                    <option key={suggestion} value={suggestion} />
                  ))}
                </datalist>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Category</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full bg-background border border-border p-3 text-foreground focus:outline-none focus:border-foreground appearance-none"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Goal Frequency</label>
                  <div className="flex gap-1 border border-border bg-background p-1">
                    {DAYS_OF_WEEK.map(day => {
                      const isSelected = frequency.includes(day.value);
                      return (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setFrequency(frequency.filter(d => d !== day.value))
                            } else {
                              setFrequency([...frequency, day.value])
                            }
                          }}
                          className={`flex-1 py-1.5 text-xs font-bold uppercase transition-colors rounded-[1px] ${isSelected ? 'bg-foreground text-background' : 'text-zinc-500 hover:bg-muted hover:text-foreground'}`}
                        >
                          {day.label}
                        </button>
                      )
                    })}
                  </div>
                  <div className="text-[9px] text-zinc-500 font-medium uppercase tracking-widest mt-2 px-1">
                    Current: {getFrequencyLabel(frequency)}
                  </div>
                </div>
              </div>

              <div className="border-t border-border pt-6 mt-6">
                <h3 className="text-xs font-bold uppercase tracking-widest text-foreground mb-4 flex items-center gap-2"><Clock size={14} /> Timing</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="w-full">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Digital Time</label>
                    <input
                      type="time"
                      value={time}
                      onChange={e => setTime(e.target.value)}
                      required
                      className="w-full bg-background border border-border p-3 text-foreground focus:outline-none focus:border-foreground"
                    />
                  </div>
                  <div className="w-full">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Remind Before</label>
                    <select
                      value={notification.toString()}
                      onChange={(e) => setNotification(parseInt(e.target.value))}
                      className="w-full bg-background border border-border p-3 text-foreground focus:outline-none focus:border-foreground appearance-none"
                    >
                      <option value="0">None</option>
                      <option value="5">5 mins before</option>
                      <option value="15">15 mins before</option>
                      <option value="20">20 mins before</option>
                      <option value="30">30 mins before</option>
                      <option value="60">1 hour before</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <button type="submit" className="w-full py-4 bg-foreground text-background font-bold uppercase tracking-wider text-sm hover:bg-foreground/90 transition-colors">
                  {isEditing ? 'Save Changes' : 'Create Habit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

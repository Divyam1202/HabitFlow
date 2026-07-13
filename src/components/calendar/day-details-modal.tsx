'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { format } from 'date-fns'
import { Check, X } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { saveDayNote } from '@/actions/note-actions'

interface Habit {
  id: string | number
  name: string
  color?: string
}

interface DayDetailsModalProps {
  date: Date | null
  isOpen: boolean
  onClose: () => void
  completedHabits: Habit[]
  missedHabits: Habit[]
  initialNote: string
}

export function DayDetailsModal({ date, isOpen, onClose, completedHabits, missedHabits, initialNote }: DayDetailsModalProps) {
  const [note, setNote] = useState(initialNote)
  const [saving, setSaving] = useState(false)

  if (!date) return null

  const handleSaveNote = async () => {
    setSaving(true)
    const dateStr = date.toISOString().split('T')[0]
    await saveDayNote(dateStr, note)
    setSaving(false)
  }

  const total = completedHabits.length + missedHabits.length
  const completionRate = total > 0 ? Math.round((completedHabits.length / total) * 100) : 0

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-125">
        <DialogHeader>
          <DialogTitle>{format(date, 'MMMM d, yyyy')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          <div className="flex items-center justify-between border-b pb-4">
            <span className="font-medium">Completion Rate</span>
            <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{completionRate}%</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold text-emerald-600 mb-2 flex items-center gap-2"><Check className="h-4 w-4" /> Completed</h4>
              <ul className="space-y-1">
                {completedHabits.map(h => (
                  <li key={h.id} className="text-sm flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${h.color ?? 'bg-green-500'}`}/>
                    {h.name}
                  </li>
                ))}
                {completedHabits.length === 0 && <p className="text-xs text-muted-foreground">None</p>}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-rose-600 mb-2 flex items-center gap-2"><X className="h-4 w-4" /> Missed</h4>
              <ul className="space-y-1">
                {missedHabits.map(h => (
                  <li key={h.id} className="text-sm flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${h.color ?? 'bg-green-500'}`}/>
                    {h.name}
                  </li>
                ))}
                {missedHabits.length === 0 && <p className="text-xs text-muted-foreground">None</p>}
              </ul>
            </div>
          </div>

          <div className="space-y-2 pt-4 border-t">
            <h4 className="font-medium">Daily Notes</h4>
            <Textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="How did your day go?"
              className="min-h-25"
            />
            <div className="flex justify-end pt-2 flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
              <Button onClick={handleSaveNote} disabled={saving || note === initialNote}>
                {saving ? 'Saving...' : 'Save Note'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
